/**
 * Batch Minting Service
 *
 * Processes withdrawal batches by converting virtual balance to on-chain tokens.
 * Connects the WithdrawPool with the Charms Prover API.
 *
 * Architecture:
 * 1. WithdrawPool collects withdrawal requests (virtual balance → BTC address)
 * 2. BatchMintingService fetches ready batches
 * 3. Creates batch transfer spell (v10)
 * 4. Submits to Prover API
 * 5. Returns transactions for external signing
 * 6. After broadcast, confirms withdrawal completion
 *
 * NOTE: This service requires a treasury wallet with pre-minted BABTC tokens.
 * The treasury is funded by the system's mining operations.
 *
 * Alternative approach (future): Direct proof-to-mint flow where each user's
 * mining proofs are converted to on-chain tokens individually.
 */

import type { Env } from "../lib/types";
import { balanceLogger } from "../lib/logger";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Batch recipient from WithdrawPool
 */
export interface BatchRecipient {
  address: string;
  amount: string; // BigInt as string
}

/**
 * Ready batch from WithdrawPool
 */
export interface ReadyBatch {
  id: string;
  recipients: BatchRecipient[];
  totalAmount: string;
  feeRate: number;
  createdAt: number;
}

/**
 * Minting batch result
 */
export interface MintingBatchResult {
  success: boolean;
  batchId: string;
  /** Error message if failed */
  error?: string;
  /** Spell for Prover API (if using batch mint) */
  spell?: Record<string, unknown>;
  /** Commit TX hex (needs signing) */
  commitTxHex?: string;
  /** Spell TX hex (needs signing) */
  spellTxHex?: string;
  /** Estimated total fee in sats */
  estimatedFee?: number;
  /** Recipients in this batch */
  recipients?: BatchRecipient[];
}

/**
 * Service configuration
 */
export interface BatchMintingServiceConfig {
  /** Prover API URL */
  proverUrl?: string;
  /** Treasury address (holds BABTC for transfers) */
  treasuryAddress?: string;
  /** Maximum recipients per batch */
  maxRecipientsPerBatch?: number;
  /** Minimum batch size to process */
  minBatchSize?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PROVER_URL = "https://v11.charms.dev";
const DEFAULT_MAX_RECIPIENTS = 50;
const DEFAULT_MIN_BATCH_SIZE = 1;

// BABTC deployment config (testnet4)
const BABTC_TESTNET4 = {
  appId: "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",
  appVk: "ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6",
};

// =============================================================================
// SERVICE
// =============================================================================

/**
 * Batch Minting Service
 *
 * Processes withdrawal requests by minting tokens on-chain.
 */
export class BatchMintingService {
  private readonly proverUrl: string;
  private readonly treasuryAddress: string;
  private readonly maxRecipientsPerBatch: number;
  private readonly minBatchSize: number;

  constructor(env: Env, config: BatchMintingServiceConfig = {}) {
    this.proverUrl = config.proverUrl || env.PROVER_URL || DEFAULT_PROVER_URL;
    this.treasuryAddress = config.treasuryAddress || env.TREASURY_ADDRESS || "";
    this.maxRecipientsPerBatch =
      config.maxRecipientsPerBatch || DEFAULT_MAX_RECIPIENTS;
    this.minBatchSize = config.minBatchSize || DEFAULT_MIN_BATCH_SIZE;

    if (!this.treasuryAddress) {
      balanceLogger.warn(
        "BatchMintingService: No treasury address configured. Set TREASURY_ADDRESS env var.",
      );
    }
  }

  /**
   * Process a ready batch from WithdrawPool
   *
   * Creates a batch transfer spell and submits to Prover API.
   * Returns transactions that need external signing.
   */
  async processBatch(batch: ReadyBatch): Promise<MintingBatchResult> {
    try {
      balanceLogger.info("Processing batch", {
        batchId: batch.id,
        recipientCount: batch.recipients.length,
        totalAmount: batch.totalAmount,
      });

      // Validate batch
      if (batch.recipients.length === 0) {
        return {
          success: false,
          batchId: batch.id,
          error: "Batch has no recipients",
        };
      }

      if (batch.recipients.length > this.maxRecipientsPerBatch) {
        return {
          success: false,
          batchId: batch.id,
          error: `Batch exceeds max recipients (${this.maxRecipientsPerBatch})`,
        };
      }

      if (!this.treasuryAddress) {
        return {
          success: false,
          batchId: batch.id,
          error: "Treasury address not configured",
        };
      }

      // Create batch transfer spell
      const spell = this.createBatchTransferSpell(batch);

      // Submit to Prover API
      const proverResult = await this.submitToProver(spell);

      if (!proverResult.success) {
        return {
          success: false,
          batchId: batch.id,
          error: proverResult.error,
        };
      }

      return {
        success: true,
        batchId: batch.id,
        spell,
        commitTxHex: proverResult.commitTx,
        spellTxHex: proverResult.spellTx,
        estimatedFee: this.estimateFee(batch.recipients.length, batch.feeRate),
        recipients: batch.recipients,
      };
    } catch (error) {
      balanceLogger.error("Batch processing failed", error, {
        batchId: batch.id,
      });

      return {
        success: false,
        batchId: batch.id,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Create a batch transfer spell (V10 format)
   *
   * Transfers tokens from treasury to multiple recipients.
   */
  private createBatchTransferSpell(batch: ReadyBatch): Record<string, unknown> {
    const appRef = `t/${BABTC_TESTNET4.appId}/${BABTC_TESTNET4.appVk}`;

    // Calculate total amount needed
    const totalAmount = BigInt(batch.totalAmount);

    // Build outputs - one per recipient
    const outs = batch.recipients.map((recipient) => ({
      address: recipient.address,
      charms: {
        $01: parseInt(recipient.amount, 10), // Safe for reasonable amounts
      },
      sats: 546, // Dust limit
    }));

    // V10 spell structure
    return {
      version: 10,
      apps: {
        $01: appRef,
      },
      ins: [
        {
          // Treasury UTXO (to be filled by signer)
          utxo_id: "TREASURY_UTXO_PLACEHOLDER",
          charms: {
            $01: Number(totalAmount),
          },
        },
      ],
      outs,
    };
  }

  /**
   * Submit spell to Prover API
   */
  private async submitToProver(spell: Record<string, unknown>): Promise<{
    success: boolean;
    commitTx?: string;
    spellTx?: string;
    error?: string;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min timeout

      const response = await fetch(`${this.proverUrl}/prove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/1.0",
        },
        body: JSON.stringify({ spell }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        return {
          success: false,
          error: `Prover API error: ${response.status} - ${errorText}`,
        };
      }

      const data = (await response.json()) as {
        commitTx: string;
        spellTx: string;
      };

      if (!data.commitTx || !data.spellTx) {
        return {
          success: false,
          error: "Invalid prover response: missing transactions",
        };
      }

      return {
        success: true,
        commitTx: data.commitTx,
        spellTx: data.spellTx,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: "Prover API request timed out",
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : "Network error",
      };
    }
  }

  /**
   * Estimate fee for batch transaction
   */
  private estimateFee(recipientCount: number, feeRate: number): number {
    // Estimate TX size: ~100 bytes base + ~34 bytes per output
    const baseTxSize = 100;
    const perOutputSize = 34;
    const totalSize = baseTxSize + perOutputSize * recipientCount;
    return totalSize * feeRate;
  }

  /**
   * Check if prover service is available
   */
  async isProverAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.proverUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get service configuration (for debugging)
   */
  getConfig(): {
    proverUrl: string;
    treasuryAddress: string;
    maxRecipientsPerBatch: number;
    minBatchSize: number;
  } {
    return {
      proverUrl: this.proverUrl,
      treasuryAddress: this.treasuryAddress,
      maxRecipientsPerBatch: this.maxRecipientsPerBatch,
      minBatchSize: this.minBatchSize,
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a BatchMintingService instance
 */
export function createBatchMintingService(
  env: Env,
  config?: BatchMintingServiceConfig,
): BatchMintingService {
  return new BatchMintingService(env, config);
}

// =============================================================================
// DIRECT MINT FLOW (Alternative - per-user proof-to-mint)
// =============================================================================

/**
 * Mining proof for direct minting
 */
export interface MiningProofForMint {
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  reward: bigint;
  createdAt: number;
}

/**
 * Direct mint result (single user)
 */
export interface DirectMintResult {
  success: boolean;
  error?: string;
  miningTxHex?: string;
  miningPsbt?: string;
  estimatedReward?: bigint;
}

/**
 * Create a direct mint transaction for a user
 *
 * STATUS: NOT IMPLEMENTED
 *
 * This is an alternative flow where each user's mining proof
 * is converted to on-chain tokens individually (like BRO token).
 *
 * The implementation exists in `packages/bitcoin/src/charms/minting-manager.ts`
 * but is not yet integrated into Cloudflare Workers due to:
 * 1. WASM/bitcoinjs-lib compatibility with Workers runtime
 * 2. Signing flow requires client-side wallet interaction
 *
 * CURRENT WORKAROUND:
 * Use batch minting via WithdrawPool instead:
 * 1. User mines and accumulates virtual balance
 * 2. User requests withdrawal to BTC address
 * 3. System batches withdrawals and mints on-chain
 *
 * FUTURE IMPLEMENTATION:
 * Integrate MintingManager.createMintV9() flow:
 * 1. Build mining TX with OP_RETURN
 * 2. Return PSBT for client signing
 * 3. Broadcast and wait for confirmation
 * 4. Generate Merkle proof and submit to Prover
 *
 * @see packages/bitcoin/src/charms/minting-manager.ts
 */
export async function createDirectMintTransaction(
  _proof: MiningProofForMint,
  _minerAddress: string,
  _minerPublicKey: string,
  _utxos: Array<{ txid: string; vout: number; value: number }>,
): Promise<DirectMintResult> {
  // Direct mint not yet available in Workers environment
  // Use batch minting via WithdrawPool API instead
  return {
    success: false,
    error:
      "Direct mint not available. Use POST /api/withdraw to queue withdrawal, " +
      "then batch minting will process your tokens automatically.",
  };
}
