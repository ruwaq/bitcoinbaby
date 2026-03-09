/**
 * Claim Minting Service
 *
 * Handles the minting of tokens after a claim TX is confirmed.
 * Submits to the Charms prover and manages the minting lifecycle.
 */

import { claimLogger } from "../lib/logger";
import {
  type NormalizedSpell,
  type ProverRequest,
  buildProverRequest,
  addressToScriptPubkey,
  NFT_DUST_SATS,
} from "../lib/cbor-spell";
import type { ClaimStatus } from "../lib/types";
import { getMempoolService } from "./mempool-service";

// =============================================================================
// TYPES
// =============================================================================

export interface MintRequest {
  claimId: string;
  address: string;
  claimTxid: string;
  tokenAmount: string;
  totalWork: string;
  proofCount: number;
  merkleRoot: string;
  serverSignature: string;
  nonce: string;
  timestamp: number;
}

export interface MintResult {
  success: boolean;
  status: ClaimStatus;
  mintTxid?: string;
  commitTxid?: string;
  error?: string;
}

export interface ProverResponse {
  commitTx: string;
  spellTx: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Charms prover URL (v11) */
const DEFAULT_CHARMS_PROVER_URL = "https://v11.charms.dev";

/** Request timeout for prover (2 minutes for proof generation) */
const PROVER_TIMEOUT_MS = 120_000;

/** Required confirmations before minting */
const REQUIRED_CONFIRMATIONS = 1;

/** Max retries for prover submission */
const MAX_PROVER_RETRIES = 3;

/** Retry delay base (exponential backoff) */
const RETRY_DELAY_BASE_MS = 5000;

// =============================================================================
// CLAIM MINTING SERVICE
// =============================================================================

export class ClaimMintingService {
  private proverUrl: string;
  private appId: string;
  private appVk: string;
  private network: "mainnet" | "testnet" | "testnet4";

  constructor(config: {
    proverUrl?: string;
    appId: string;
    appVk: string;
    network?: "mainnet" | "testnet" | "testnet4";
  }) {
    this.proverUrl = config.proverUrl || DEFAULT_CHARMS_PROVER_URL;
    this.appId = config.appId;
    this.appVk = config.appVk;
    this.network = config.network || "testnet4";
  }

  /**
   * Process a mint request
   *
   * 1. Verify claim TX is confirmed on-chain
   * 2. Build mint spell with claim data
   * 3. Submit to Charms prover
   * 4. Return mint transaction IDs
   */
  async processMint(request: MintRequest): Promise<MintResult> {
    claimLogger.info("Processing mint request", {
      claimId: request.claimId,
      address: request.address,
      tokenAmount: request.tokenAmount,
    });

    try {
      // Step 1: Verify claim TX is confirmed
      const txVerification = await this.verifyClaimTx(request.claimTxid);
      if (!txVerification.success) {
        return {
          success: false,
          status: "broadcast",
          error: txVerification.error,
        };
      }

      // Step 2: Build the mint spell
      const spell = this.buildMintSpell(request);

      // Step 3: Submit to prover with retries
      const proverResult = await this.submitToProver(spell);
      if (!proverResult.success) {
        return {
          success: false,
          status: "failed",
          error: proverResult.error,
        };
      }

      // Step 4: Extract transaction IDs from prover response
      const commitTxid = await this.extractTxid(proverResult.commitTx!);
      const mintTxid = await this.extractTxid(proverResult.spellTx!);

      claimLogger.info("Mint successful", {
        claimId: request.claimId,
        commitTxid,
        mintTxid,
      });

      return {
        success: true,
        status: "completed",
        commitTxid,
        mintTxid,
      };
    } catch (error) {
      claimLogger.error("Mint failed", {
        claimId: request.claimId,
        error,
      });

      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Verify the claim TX exists and is confirmed
   */
  private async verifyClaimTx(
    txid: string,
  ): Promise<{ success: boolean; error?: string }> {
    const mempool = getMempoolService(this.network);
    const result = await mempool.verifyTransaction(txid);

    if (!result.exists) {
      return {
        success: false,
        error: "Claim transaction not found on-chain",
      };
    }

    if (result.confirmations < REQUIRED_CONFIRMATIONS) {
      return {
        success: false,
        error: `Transaction needs ${REQUIRED_CONFIRMATIONS} confirmations, has ${result.confirmations}`,
      };
    }

    return { success: true };
  }

  /**
   * Build the mint spell for the Charms prover
   *
   * For V2 claims, we use server-signed aggregate proofs.
   * The spell validates the signature and mints tokens.
   * Spell is CBOR-encoded as hex string for the v11 prover.
   */
  private buildMintSpell(request: MintRequest): ProverRequest {
    const appKey = `t/${this.appId}/${this.appVk}`;

    // Convert address to script pubkey for coins
    const userScriptPubkey = addressToScriptPubkey(request.address);

    // V11 spell format for server-signed claims
    const spell: NormalizedSpell = {
      version: 11,
      tx: {
        // Input: reference the claim TX (proves user paid fees)
        ins: [`${request.claimTxid}:0`],
        // Output: all tokens go to the user
        outs: [
          {
            0: parseInt(request.tokenAmount, 10),
          },
        ],
        // Native coin amounts for outputs
        // Token output gets dust amount, prover handles change
        coins: [
          {
            amount: NFT_DUST_SATS,
            dest: userScriptPubkey,
          },
        ],
      },
      app_public_inputs: {
        [appKey]: {}, // Empty public inputs
      },
    };

    // Build prover request with CBOR-encoded spell
    return buildProverRequest(spell, {
      changeAddress: request.address,
      feeRate: 2.0,
      chain: "bitcoin",
      appPrivateInputs: {
        [appKey]: {
          // Server-signed claim data
          claim_type: "aggregated",
          address: request.address,
          total_work: request.totalWork,
          proof_count: request.proofCount,
          merkle_root: request.merkleRoot,
          token_amount: request.tokenAmount,
          timestamp: request.timestamp,
          nonce: request.nonce,
          server_signature: request.serverSignature,
        },
      },
    });
  }

  /**
   * Submit spell to Charms prover with retry logic
   */
  private async submitToProver(proverRequest: ProverRequest): Promise<{
    success: boolean;
    commitTx?: string;
    spellTx?: string;
    error?: string;
  }> {
    let lastError: string | undefined;

    for (let attempt = 1; attempt <= MAX_PROVER_RETRIES; attempt++) {
      try {
        const result = await this.proveOnce(proverRequest);
        return {
          success: true,
          commitTx: result.commitTx,
          spellTx: result.spellTx,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        claimLogger.warn(`Prover attempt ${attempt} failed`, {
          error: lastError,
        });

        // Don't retry on client errors (4xx)
        if (lastError.includes("400") || lastError.includes("4")) {
          break;
        }

        if (attempt < MAX_PROVER_RETRIES) {
          const delay = RETRY_DELAY_BASE_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Prover failed after ${MAX_PROVER_RETRIES} attempts: ${lastError}`,
    };
  }

  /**
   * Single prover request
   */
  private async proveOnce(
    proverRequest: ProverRequest,
  ): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVER_TIMEOUT_MS);

    try {
      const endpoint = this.proverUrl.includes("charms.dev")
        ? `${this.proverUrl}/spells/prove`
        : `${this.proverUrl}/prove`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/2.0",
        },
        body: JSON.stringify(proverRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Prover API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ProverResponse;

      if (!data.commitTx || !data.spellTx) {
        throw new Error("Invalid prover response: missing transactions");
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(`Prover request timeout after ${PROVER_TIMEOUT_MS}ms`);
      }

      throw error;
    }
  }

  /**
   * Extract txid from raw transaction hex
   * The txid is the double SHA256 of the serialized tx, reversed
   */
  private async extractTxid(txHex: string): Promise<string> {
    try {
      // Convert hex to bytes
      const txBytes = this.hexToBytes(txHex);

      // Double SHA256
      const hash1 = await crypto.subtle.digest("SHA-256", txBytes);
      const hash2 = await crypto.subtle.digest("SHA-256", hash1);

      // Reverse bytes (Bitcoin txid is little-endian)
      const hashArray = new Uint8Array(hash2);
      const reversed = hashArray.reverse();

      // Convert to hex
      return Array.from(reversed)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch (error) {
      claimLogger.error("Failed to extract txid", { error });
      // Fallback: use first 64 chars of tx hex as identifier
      return txHex.slice(0, 64);
    }
  }

  /**
   * Convert hex string to Uint8Array
   */
  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let mintingServiceInstance: ClaimMintingService | null = null;

/**
 * Get or create the claim minting service instance
 */
export function getClaimMintingService(config: {
  proverUrl?: string;
  appId: string;
  appVk: string;
  network?: "mainnet" | "testnet" | "testnet4";
}): ClaimMintingService {
  if (!mintingServiceInstance) {
    mintingServiceInstance = new ClaimMintingService(config);
  }
  return mintingServiceInstance;
}
