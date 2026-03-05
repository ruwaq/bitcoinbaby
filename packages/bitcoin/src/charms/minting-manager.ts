/**
 * Minting Manager
 *
 * Orchestrates the complete flow of minting BABTC tokens on-chain.
 * Connects mining proofs to the Charms protocol via the Prover API.
 *
 * TWO FLOWS SUPPORTED:
 *
 * Flow V9 (PoW Direct - Recommended):
 * 1. Mine PoW (challenge:nonce -> hash with D bits)
 * 2. Create V9 spell with pow_challenge, pow_nonce, pow_difficulty
 * 3. Submit to Prover API
 * 4. Sign and broadcast commit + spell TXs
 * 5. Tokens appear in wallet
 *
 * Flow V10 (With Merkle Proofs - Legacy):
 * 1. Create mining TX with OP_RETURN
 * 2. Sign and broadcast mining TX
 * 3. Wait for confirmation
 * 4. Get Merkle proof of inclusion
 * 5. Create V10 mint spell
 * 6. Submit to Prover API
 * 7. Sign and broadcast commit + spell TXs
 * 8. Tokens appear in wallet
 */

import { CharmsProverClient, createCharmsProverClient } from "./prover";
import type { ProverResponse } from "./prover";
import type { SpellV9, SpellV10 } from "./types";
import {
  createBABTCMintSpellV9,
  createBABTCMintSpellV10,
  BABTC_CONFIG,
  calculateMiningReward,
} from "./token";
import type {
  TokenMintParamsV9,
  TokenMintParamsV10,
  MiningReward,
} from "./token";
import {
  MempoolClient,
  createMempoolClient,
  getEncodedMerkleProof,
  type MerkleProof,
  type UTXO,
} from "../blockchain";
import { TransactionBuilder, createTransactionBuilder } from "../transactions";
import type { BitcoinNetwork } from "../types";
import { BABTC_TESTNET4 } from "../config/deployment";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Minting manager configuration
 */
export interface MintingManagerOptions {
  /** Bitcoin network */
  network?: BitcoinNetwork;
  /** Prover API URL override */
  proverUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Mining data for creating a mint
 */
export interface MiningData {
  /** Challenge string (usually txid:vout) */
  challenge: string;
  /** Nonce that produces valid hash */
  nonce: string;
  /** Valid PoW hash */
  hash: string;
  /** Difficulty (leading zero bits) */
  difficulty: number;
  /** Timestamp of mining */
  timestamp: number;
}

/**
 * Step in the minting flow
 */
export type MintingStep =
  | "idle"
  | "building_mining_tx"
  | "awaiting_mining_signature"
  | "broadcasting_mining_tx"
  | "waiting_confirmation"
  | "generating_merkle_proof"
  | "building_spell"
  | "submitting_to_prover"
  | "awaiting_spell_signature"
  | "broadcasting_spell"
  | "completed"
  | "failed";

/**
 * Minting progress callback
 */
export type MintingProgressCallback = (
  step: MintingStep,
  data?: {
    message?: string;
    txid?: string;
    confirmations?: number;
    estimatedTimeRemaining?: number;
  },
) => void;

/**
 * Result of minting flow
 */
export interface MintingResult {
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Mining transaction ID */
  miningTxid?: string;
  /** Spell transaction ID (final result) */
  spellTxid?: string;
  /** Commit transaction ID */
  commitTxid?: string;
  /** Amount of tokens minted */
  mintedAmount?: bigint;
  /** Block height of mining TX */
  blockHeight?: number;
}

/**
 * Prepared transactions for external signing
 */
export interface PreparedMintingTxs {
  /** Step in the flow */
  step: "mining_tx" | "spell_txs";
  /** Mining TX PSBT (base64) - for step "mining_tx" */
  miningPsbt?: string;
  /** Mining TX raw hex (for reference) */
  miningTxHex?: string;
  /** Commit TX hex (needs signing) - for step "spell_txs" */
  commitTxHex?: string;
  /** Spell TX hex (needs signing) - for step "spell_txs" */
  spellTxHex?: string;
  /** Estimated reward */
  estimatedReward?: bigint;
  /** Additional data for continuing flow */
  context?: {
    miningTxid?: string;
    miningTxHex?: string;
    leadingZeros?: number;
    merkleProof?: MerkleProof;
    merkleProofHex?: string;
    spell?: SpellV9 | SpellV10;
  };
}

/**
 * Result of V9 spell generation (no mining TX needed)
 */
export interface PreparedSpellV9 {
  /** V9 spell ready for proving */
  spell: SpellV9;
  /** Commit TX hex from prover */
  commitTxHex: string;
  /** Spell TX hex from prover */
  spellTxHex: string;
  /** Calculated reward */
  reward: MiningReward;
  /** Input UTXO used */
  inputUtxo: { txid: string; vout: number };
}

// =============================================================================
// MINTING MANAGER
// =============================================================================

/**
 * Minting Manager
 *
 * Orchestrates the complete minting flow from mining proof to on-chain tokens.
 *
 * @example
 * ```typescript
 * const manager = new MintingManager({
 *   network: 'testnet4',
 *   debug: true,
 * });
 *
 * // For external signing flow (recommended for security):
 * const miningData = { challenge: 'txid:0', nonce: '12345', hash: '000...', difficulty: 24 };
 * const prepared = await manager.prepareMinigTransaction(
 *   miningData,
 *   minerAddress,
 *   minerPublicKey,
 * );
 *
 * // Sign the PSBT externally...
 * const signedMiningTx = signExternally(prepared.miningPsbt);
 *
 * // Continue with signed TX
 * const result = await manager.completeMintingFlow(
 *   signedMiningTx,
 *   prepared.context,
 *   onProgress,
 * );
 * ```
 */
export class MintingManager {
  private readonly network: BitcoinNetwork;
  private readonly proverClient: CharmsProverClient;
  private readonly mempoolClient: MempoolClient;
  private readonly txBuilder: TransactionBuilder;
  private readonly debug: boolean;

  constructor(options: MintingManagerOptions = {}) {
    this.network = options.network || "testnet4";
    this.debug = options.debug || false;

    this.proverClient = createCharmsProverClient({
      proverUrl: options.proverUrl,
      debug: this.debug,
    });

    this.mempoolClient = createMempoolClient({
      network: this.network,
    });

    this.txBuilder = createTransactionBuilder({
      network: this.network,
    });
  }

  // ===========================================================================
  // PUBLIC API - Two-Phase Flow (for external signing)
  // ===========================================================================

  /**
   * Phase 1: Prepare mining transaction for external signing
   *
   * Creates a Bitcoin transaction with OP_RETURN containing the mining proof.
   * Returns a PSBT that needs to be signed by the user's wallet.
   */
  async prepareMiningTransaction(
    miningData: MiningData,
    minerAddress: string,
    minerPublicKey: string,
  ): Promise<PreparedMintingTxs> {
    this.log("Preparing mining transaction...");

    // Get UTXOs
    const utxos = await this.mempoolClient.getUTXOs(minerAddress);
    if (utxos.length === 0) {
      throw new MintingError("No UTXOs available for mining transaction");
    }

    // Filter UTXOs that are large enough (min 7000 sats for mining)
    const validUtxos = utxos.filter((u) => u.value >= 7000);
    if (validUtxos.length === 0) {
      throw new MintingError("No UTXOs with at least 7000 sats available");
    }

    // Extract x-only public key from compressed key
    const pubKeyBytes = Buffer.from(minerPublicKey, "hex");
    let xOnlyPubKey: Uint8Array;
    if (pubKeyBytes.length === 33) {
      xOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
    } else if (pubKeyBytes.length === 65) {
      xOnlyPubKey = new Uint8Array(pubKeyBytes.subarray(1, 33));
    } else {
      throw new MintingError(
        `Invalid public key length: ${pubKeyBytes.length}`,
      );
    }

    // Build OP_RETURN data: challenge:nonce:hash
    const opReturnData = `${miningData.challenge}:${miningData.nonce}:${miningData.hash}`;

    // Get fee estimates
    const feeEstimates = await this.mempoolClient.getFeeEstimates();
    this.txBuilder.setFeeRate(feeEstimates.halfHourFee);

    // Convert UTXOs for builder
    const txUtxos = TransactionBuilder.convertUTXOs(
      validUtxos,
      minerAddress,
      this.network,
      xOnlyPubKey,
    );

    // Build mining TX with OP_RETURN
    const tx = this.txBuilder.buildMiningTxWithOpReturn(
      txUtxos,
      minerAddress,
      opReturnData,
      700, // Minimum output for spell input
    );

    // Build PSBT for external signing
    const psbt = this.txBuilder.buildPSBT(tx);

    // Calculate estimated reward
    const currentHeight = await this.mempoolClient.getBlockHeight();
    const reward = calculateMiningReward(currentHeight);

    this.log("Mining TX prepared", {
      opReturnLength: opReturnData.length,
      estimatedReward: reward.minerShare.toString(),
    });

    return {
      step: "mining_tx",
      miningPsbt: psbt.toBase64(),
      miningTxHex: tx.hex,
      estimatedReward: reward.minerShare,
      context: {
        // Will be filled after broadcast
      },
    };
  }

  /**
   * Phase 2: Broadcast signed mining TX and wait for confirmation
   *
   * Takes the signed mining TX and waits for it to be confirmed.
   * Returns data needed to continue with proof generation.
   */
  async broadcastAndWaitForConfirmation(
    signedMiningTxHex: string,
    onProgress?: MintingProgressCallback,
  ): Promise<{
    miningTxid: string;
    blockHeight: number;
    merkleProof: MerkleProof;
    merkleProofHex: string;
  }> {
    onProgress?.("broadcasting_mining_tx", {
      message: "Broadcasting mining transaction...",
    });

    // Broadcast
    const miningTxid =
      await this.mempoolClient.broadcastTransaction(signedMiningTxHex);
    this.log("Mining TX broadcast", { miningTxid });

    onProgress?.("waiting_confirmation", {
      message: "Waiting for confirmation...",
      txid: miningTxid,
    });

    // Wait for confirmation
    const confirmed = await this.waitForConfirmation(miningTxid, onProgress);

    if (!confirmed.blockHeight) {
      throw new MintingError("Failed to get block height for confirmed TX");
    }

    onProgress?.("generating_merkle_proof", {
      message: "Generating Merkle proof...",
    });

    // Get Merkle proof
    const { proof: merkleProof, hex: merkleProofHex } =
      await getEncodedMerkleProof(this.mempoolClient, miningTxid);

    this.log("Merkle proof obtained", {
      blockHeight: merkleProof.blockHeight,
      proofLength: merkleProofHex.length,
    });

    return {
      miningTxid,
      blockHeight: confirmed.blockHeight,
      merkleProof,
      merkleProofHex,
    };
  }

  /**
   * Phase 3: Generate spell and submit to Prover API
   *
   * Creates the V10 spell and submits it to the Charms Prover API.
   * Returns the commit and spell transactions that need to be signed.
   */
  async generateSpellAndProve(
    minerAddress: string,
    miningTxid: string,
    miningTxHex: string,
    leadingZeros: number,
    merkleProofHex: string,
    onProgress?: MintingProgressCallback,
  ): Promise<PreparedMintingTxs> {
    onProgress?.("building_spell", { message: "Building mint spell..." });

    // Create V10 spell with BRO-style reward based on difficulty
    const spellParams: TokenMintParamsV10 = {
      appId: BABTC_TESTNET4.appId,
      appVk: BABTC_TESTNET4.appVk,
      minerAddress,
      devAddress: BABTC_CONFIG.addresses.devFund,
      stakingAddress: BABTC_CONFIG.addresses.stakingPool,
      leadingZeros,
      miningTxHex,
      merkleProofHex,
      miningUtxo: {
        txid: miningTxid,
        vout: 0, // First output is the spell input
      },
    };

    const spell = createBABTCMintSpellV10(spellParams);
    this.log("Spell created", {
      apps: spell.apps,
      outsCount: spell.outs.length,
    });

    onProgress?.("submitting_to_prover", {
      message: "Submitting to Prover API...",
    });

    // Submit to prover
    const proverResponse = await this.proverClient.prove(spell);
    this.log("Prover response received", {
      commitTxLength: proverResponse.commitTx.length,
      spellTxLength: proverResponse.spellTx.length,
    });

    const reward = calculateMiningReward(leadingZeros);

    return {
      step: "spell_txs",
      commitTxHex: proverResponse.commitTx,
      spellTxHex: proverResponse.spellTx,
      estimatedReward: reward.minerShare,
      context: {
        miningTxid,
        miningTxHex,
        leadingZeros,
        merkleProofHex,
        spell,
      },
    };
  }

  /**
   * Phase 4: Broadcast signed spell transactions
   *
   * Takes the signed commit and spell transactions and broadcasts them.
   * After this, tokens will appear in the wallet.
   */
  async broadcastSpellTransactions(
    signedCommitTxHex: string,
    signedSpellTxHex: string,
    onProgress?: MintingProgressCallback,
  ): Promise<MintingResult> {
    onProgress?.("broadcasting_spell", {
      message: "Broadcasting commit transaction...",
    });

    // Broadcast commit TX first
    const commitTxid =
      await this.mempoolClient.broadcastTransaction(signedCommitTxHex);
    this.log("Commit TX broadcast", { commitTxid });

    // Broadcast spell TX
    const spellTxid =
      await this.mempoolClient.broadcastTransaction(signedSpellTxHex);
    this.log("Spell TX broadcast", { spellTxid });

    onProgress?.("completed", {
      message: "Minting complete! Tokens will appear after confirmation.",
      txid: spellTxid,
    });

    return {
      success: true,
      commitTxid,
      spellTxid,
    };
  }

  // ===========================================================================
  // PUBLIC API - Complete Flow (for server-side or trusted environments)
  // ===========================================================================

  /**
   * Execute complete minting flow
   *
   * WARNING: This method requires the private key to be passed directly.
   * Only use in trusted server environments. For client-side, use the
   * two-phase flow with external signing.
   *
   * @param miningData - Mining proof data
   * @param minerAddress - Miner's Bitcoin address
   * @param minerPublicKey - Miner's public key (hex)
   * @param signerFn - Function to sign transactions
   * @param onProgress - Progress callback
   */
  async executeMintingFlow(
    miningData: MiningData,
    minerAddress: string,
    minerPublicKey: string,
    signerFn: (txHex: string) => Promise<string>,
    onProgress?: MintingProgressCallback,
  ): Promise<MintingResult> {
    try {
      // Phase 1: Prepare mining TX
      onProgress?.("building_mining_tx", {
        message: "Building mining transaction...",
      });
      const prepared = await this.prepareMiningTransaction(
        miningData,
        minerAddress,
        minerPublicKey,
      );

      if (!prepared.miningTxHex) {
        throw new MintingError("Failed to build mining transaction");
      }

      // Sign mining TX
      onProgress?.("awaiting_mining_signature", {
        message: "Signing mining transaction...",
      });
      const signedMiningTx = await signerFn(prepared.miningTxHex);

      // Phase 2: Broadcast and wait
      const confirmationData = await this.broadcastAndWaitForConfirmation(
        signedMiningTx,
        onProgress,
      );

      // Phase 3: Generate spell and prove (use difficulty for BRO-style rewards)
      const spellPrepared = await this.generateSpellAndProve(
        minerAddress,
        confirmationData.miningTxid,
        signedMiningTx,
        miningData.difficulty, // Leading zeros determine reward amount
        confirmationData.merkleProofHex,
        onProgress,
      );

      if (!spellPrepared.commitTxHex || !spellPrepared.spellTxHex) {
        throw new MintingError("Failed to generate spell transactions");
      }

      // Sign spell TXs
      onProgress?.("awaiting_spell_signature", {
        message: "Signing spell transactions...",
      });
      const signedCommitTx = await signerFn(spellPrepared.commitTxHex);
      const signedSpellTx = await signerFn(spellPrepared.spellTxHex);

      // Phase 4: Broadcast
      const result = await this.broadcastSpellTransactions(
        signedCommitTx,
        signedSpellTx,
        onProgress,
      );

      return {
        ...result,
        miningTxid: confirmationData.miningTxid,
        blockHeight: confirmationData.blockHeight,
        mintedAmount: spellPrepared.estimatedReward,
      };
    } catch (error) {
      onProgress?.("failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if prover service is available
   */
  async isProverAvailable(): Promise<boolean> {
    return this.proverClient.healthCheck();
  }

  /**
   * Get prover service status
   */
  async getProverStatus(): Promise<{
    healthy: boolean;
    version?: string;
    queue?: number;
  }> {
    return this.proverClient.getStatus();
  }

  /**
   * Estimate minting reward for a given difficulty (BRO-style)
   *
   * @param leadingZeros - Difficulty level (default: minimum difficulty)
   * @returns Reward breakdown for the given difficulty
   */
  estimateReward(
    leadingZeros: number = BABTC_CONFIG.rewards.minDifficulty,
  ): MiningReward {
    return calculateMiningReward(leadingZeros);
  }

  /**
   * Get current fee estimates
   */
  async getFeeEstimates(): Promise<{
    fast: number;
    medium: number;
    slow: number;
  }> {
    const fees = await this.mempoolClient.getFeeEstimates();
    return {
      fast: fees.fastestFee,
      medium: fees.halfHourFee,
      slow: fees.economyFee,
    };
  }

  // ===========================================================================
  // V9 FLOW (PoW Direct - Recommended)
  // ===========================================================================

  /**
   * Generate V9 spell and submit to prover (simplified flow)
   *
   * This is the recommended flow for BABTC mining:
   * 1. Miner finds valid PoW
   * 2. This method creates spell and submits to prover
   * 3. Returns commit/spell TXs ready for signing
   *
   * No mining TX or Merkle proof needed!
   *
   * @param miningData - PoW data (challenge, nonce, difficulty)
   * @param minerAddress - Miner's Bitcoin address
   * @param inputUtxo - UTXO to consume for the spell
   * @param onProgress - Progress callback
   */
  async generateSpellV9AndProve(
    miningData: MiningData,
    minerAddress: string,
    inputUtxo: { txid: string; vout: number },
    onProgress?: MintingProgressCallback,
  ): Promise<PreparedSpellV9> {
    onProgress?.("building_spell", { message: "Building V9 mint spell..." });

    // Create V9 spell with PoW private_inputs
    const spell = createBABTCMintSpellV9({
      appId: BABTC_TESTNET4.appId,
      appVk: BABTC_TESTNET4.appVk,
      minerAddress,
      devAddress: BABTC_CONFIG.addresses.devFund,
      stakingAddress: BABTC_CONFIG.addresses.stakingPool,
      challenge: miningData.challenge,
      nonce: miningData.nonce,
      difficulty: miningData.difficulty,
      inputUtxo,
    });

    this.log("V9 Spell created", {
      apps: spell.apps,
      outsCount: spell.outs.length,
      privateInputs: spell.private_inputs,
    });

    onProgress?.("submitting_to_prover", {
      message: "Submitting to Prover API...",
    });

    // Submit to prover
    const proverResponse = await this.proverClient.provePoW(spell);

    this.log("Prover response received", {
      commitTxLength: proverResponse.commitTx.length,
      spellTxLength: proverResponse.spellTx.length,
    });

    const reward = calculateMiningReward(miningData.difficulty);

    return {
      spell,
      commitTxHex: proverResponse.commitTx,
      spellTxHex: proverResponse.spellTx,
      reward,
      inputUtxo,
    };
  }

  /**
   * Execute complete V9 minting flow
   *
   * Simplified flow that doesn't require mining TX or Merkle proofs.
   *
   * @param miningData - PoW data from mining
   * @param minerAddress - Miner's Bitcoin address
   * @param signerFn - Function to sign transactions
   * @param onProgress - Progress callback
   */
  async executeMintingFlowV9(
    miningData: MiningData,
    minerAddress: string,
    signerFn: (txHex: string) => Promise<string>,
    onProgress?: MintingProgressCallback,
  ): Promise<MintingResult> {
    try {
      // Get available UTXOs
      const utxos = await this.mempoolClient.getUTXOs(minerAddress);
      if (utxos.length === 0) {
        throw new MintingError("No UTXOs available for minting");
      }

      // Find a suitable UTXO (at least 2000 sats for fees)
      const validUtxos = utxos.filter((u) => u.value >= 2000);
      if (validUtxos.length === 0) {
        throw new MintingError("No UTXOs with at least 2000 sats available");
      }

      const inputUtxo = {
        txid: validUtxos[0].txid,
        vout: validUtxos[0].vout,
      };

      // Generate spell and prove
      const prepared = await this.generateSpellV9AndProve(
        miningData,
        minerAddress,
        inputUtxo,
        onProgress,
      );

      // Sign transactions
      onProgress?.("awaiting_spell_signature", {
        message: "Signing spell transactions...",
      });
      const signedCommitTx = await signerFn(prepared.commitTxHex);
      const signedSpellTx = await signerFn(prepared.spellTxHex);

      // Broadcast
      const result = await this.broadcastSpellTransactions(
        signedCommitTx,
        signedSpellTx,
        onProgress,
      );

      return {
        ...result,
        mintedAmount: prepared.reward.minerShare,
      };
    } catch (error) {
      onProgress?.("failed", {
        message: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get available UTXOs for minting
   */
  async getAvailableUtxos(
    address: string,
  ): Promise<Array<{ txid: string; vout: number; value: number }>> {
    const utxos = await this.mempoolClient.getUTXOs(address);
    return utxos
      .filter((u) => u.value >= 2000) // Min 2000 sats
      .map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
      }));
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  /**
   * Wait for transaction confirmation
   */
  private async waitForConfirmation(
    txid: string,
    onProgress?: MintingProgressCallback,
    timeoutMs: number = 600_000, // 10 minutes
    pollIntervalMs: number = 10_000, // 10 seconds
  ): Promise<{ confirmed: boolean; blockHeight?: number }> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const tx = await this.mempoolClient.getTransaction(txid);

        if (tx.status?.confirmed) {
          return {
            confirmed: true,
            blockHeight: tx.status.block_height,
          };
        }

        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        onProgress?.("waiting_confirmation", {
          message: `Waiting for confirmation... (${elapsed}s)`,
          txid,
          confirmations: 0,
        });

        await this.sleep(pollIntervalMs);
      } catch {
        // Transaction might not be visible yet
        await this.sleep(pollIntervalMs);
      }
    }

    throw new MintingError(
      `Transaction ${txid} not confirmed within ${timeoutMs}ms`,
    );
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Debug logging
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[MintingManager] ${message}`, data || "");
    }
  }
}

// =============================================================================
// ERRORS
// =============================================================================

/**
 * Minting-specific error
 */
export class MintingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MintingError";
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a Minting Manager instance
 */
export function createMintingManager(
  options?: MintingManagerOptions,
): MintingManager {
  return new MintingManager(options);
}
