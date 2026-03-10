/**
 * Claim Minting Service
 *
 * Handles the minting of tokens after a claim TX is confirmed.
 * Submits to the Charms prover and manages the minting lifecycle.
 */

import { claimLogger } from "../lib/logger";
import * as cbor from "cbor2";
import type { ClaimStatus } from "../lib/types";
import { getMempoolService } from "./mempool-service";
import {
  BABTC_V2_CONTRACT_VK,
  BABTC_V2_CONTRACT_BINARY,
} from "../lib/babtc-v2-contract-binary";

/** Dust amount for token outputs */
const TOKEN_DUST_SATS = 330;

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

/** Prover request structure */
interface ClaimProverRequest {
  spell: string;
  funding_utxo: string;
  funding_utxo_value: number;
  change_address: string;
  chain: string;
  fee_rate: number;
  prev_txs: Array<{ bitcoin: string }>;
  binaries: Record<string, string>;
  app_private_inputs: Record<string, string>;
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
  private network: "mainnet" | "testnet" | "testnet4";

  constructor(config: {
    proverUrl?: string;
    appId: string;
    appVk?: string; // Deprecated: V2 uses BABTC_V2_CONTRACT_VK from binary
    network?: "mainnet" | "testnet" | "testnet4";
  }) {
    this.proverUrl = config.proverUrl || DEFAULT_CHARMS_PROVER_URL;
    this.appId = config.appId;
    // Note: appVk is ignored - we use BABTC_V2_CONTRACT_VK directly
    this.network = config.network || "testnet4";
  }

  /**
   * Process a mint request
   *
   * 1. Verify claim TX is confirmed on-chain
   * 2. Get prev_tx hex for prover
   * 3. Build mint spell with claim data
   * 4. Submit to Charms prover
   * 5. Return mint transaction IDs
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

      // Step 2: Get the claim TX hex for prev_txs (required by v11 prover)
      const mempool = getMempoolService(this.network);
      const claimTxHex = await mempool.getTransactionHex(request.claimTxid);
      if (!claimTxHex) {
        return {
          success: false,
          status: "failed",
          error: "Could not fetch claim transaction hex",
        };
      }

      // Step 3: Build the mint spell with prev_txs
      const spell = this.buildMintSpell(request, claimTxHex);

      // Step 4: Submit to prover with retries
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
      // Capture detailed error info
      const errorMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : JSON.stringify(error);

      claimLogger.error("Mint failed", {
        claimId: request.claimId,
        errorType: typeof error,
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        status: "failed",
        error: errorMessage || "Unknown minting error",
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
   * Following the same pattern as NFT minting (which works).
   * Spell is CBOR-encoded directly, not through buildProverRequest.
   *
   * @param request - The mint request data
   * @param claimTxHex - Raw hex of the claim transaction (for prev_txs)
   */
  private buildMintSpell(
    request: MintRequest,
    claimTxHex: string,
  ): {
    spell: string;
    funding_utxo: string;
    funding_utxo_value: number;
    change_address: string;
    chain: string;
    fee_rate: number;
    prev_txs: Array<{ bitcoin: string }>;
    binaries: Record<string, string>;
    app_private_inputs: Record<string, string>;
  } {
    const fundingUtxoStr = `${request.claimTxid}:0`;

    // Convert UTXO to bytes (36 bytes: 32 txid reversed + 4 index LE)
    const insBytes = [this.utxoToBytes(fundingUtxoStr)];

    // Output: Map with integer key 0 -> token amount
    const outsMap = new Map<number, number>();
    outsMap.set(0, parseInt(request.tokenAmount, 10));

    // App key as tuple [tag, identity_bytes, vk_bytes]
    // "t" = token, identity = appId, vk = contract verification key
    const appTuple: [string, Uint8Array, Uint8Array] = [
      "t",
      this.hexToBytes(this.appId),
      this.hexToBytes(BABTC_V2_CONTRACT_VK),
    ];

    // App public inputs: Map with tuple key -> null (like NFT)
    const appPublicInputs = new Map<unknown, unknown>();
    appPublicInputs.set(appTuple, null);

    // Convert owner address to script pubkey bytes
    const scriptPubkey = this.addressToScriptPubkey(request.address);

    // Build CBOR-compatible spell (same structure as working NFT)
    const spell = {
      version: 11,
      tx: {
        ins: insBytes,
        outs: [outsMap],
        coins: [
          {
            amount: TOKEN_DUST_SATS,
            dest: scriptPubkey,
          },
        ],
      },
      app_public_inputs: appPublicInputs,
    };

    // Encode spell to CBOR hex
    const cborBytes = cbor.encode(spell);
    const spellHex = this.bytesToHex(new Uint8Array(cborBytes));

    // App key for private inputs
    const appKey = `t/${this.appId}/${BABTC_V2_CONTRACT_VK}`;

    // Build app private inputs as OBJECT (prover encodes to CBOR internally)
    // ClaimWitness format for BABTC V2 contract
    const privateInputs = {
      address: request.address,
      total_work: parseInt(request.totalWork, 10),
      proof_count: request.proofCount,
      merkle_root: request.merkleRoot,
      token_amount: parseInt(request.tokenAmount, 10),
      timestamp: request.timestamp,
      nonce: request.nonce,
      server_signature: request.serverSignature,
    };

    // Encode private inputs to CBOR hex (required by v11 prover API)
    // The prover expects app_private_inputs values as CBOR-encoded hex strings
    const privateInputsCbor = cbor.encode(privateInputs);
    const privateInputsHex = this.bytesToHex(new Uint8Array(privateInputsCbor));

    // Funding UTXO value (prover will verify against actual tx)
    const fundingUtxoValue = 10000; // sats

    // Log private inputs for debugging
    claimLogger.info("Built claim spell", {
      appKey,
      privateInputsLength: privateInputsHex.length,
      spellLength: spellHex.length,
      fundingUtxo: fundingUtxoStr,
    });

    return {
      spell: spellHex,
      funding_utxo: fundingUtxoStr,
      funding_utxo_value: fundingUtxoValue,
      change_address: request.address,
      chain: "bitcoin",
      fee_rate: 2.0,
      prev_txs: [{ bitcoin: claimTxHex }],
      binaries: {
        [BABTC_V2_CONTRACT_VK]: BABTC_V2_CONTRACT_BINARY,
      },
      app_private_inputs: {
        [appKey]: privateInputsHex,
      },
    };
  }

  /**
   * Convert UTXO string to 36-byte array (32 txid reversed + 4 index LE)
   */
  private utxoToBytes(utxoStr: string): Uint8Array {
    const [txidHex, indexStr] = utxoStr.split(":");
    const index = parseInt(indexStr, 10);

    const bytes = new Uint8Array(36);
    // Reverse txid bytes (Bitcoin display order -> internal order)
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(
        txidHex.substring((31 - i) * 2, (31 - i) * 2 + 2),
        16,
      );
    }
    // Index as little-endian u32
    bytes[32] = index & 0xff;
    bytes[33] = (index >> 8) & 0xff;
    bytes[34] = (index >> 16) & 0xff;
    bytes[35] = (index >> 24) & 0xff;

    return bytes;
  }

  /**
   * Convert bech32 address to script pubkey bytes
   */
  private addressToScriptPubkey(address: string): Uint8Array {
    const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    const pos = address.lastIndexOf("1");
    if (pos < 1) throw new Error(`Invalid bech32 address: ${address}`);

    const data: number[] = [];
    for (let i = pos + 1; i < address.length; i++) {
      const idx = BECH32_CHARSET.indexOf(address.charAt(i).toLowerCase());
      if (idx === -1) throw new Error(`Invalid bech32 character: ${address}`);
      data.push(idx);
    }

    // Remove checksum (last 6 chars)
    const payload = data.slice(0, -6);
    const version = payload[0];

    // Convert 5-bit groups to 8-bit bytes
    let acc = 0;
    let bits = 0;
    const result: number[] = [];
    for (const value of payload.slice(1)) {
      acc = (acc << 5) | value;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        result.push((acc >> bits) & 0xff);
      }
    }

    const program = new Uint8Array(result);

    // Build script pubkey: OP_VERSION + PUSH_LENGTH + PROGRAM
    const opVersion = version === 0 ? 0x00 : 0x50 + version;
    const scriptPubkey = new Uint8Array(2 + program.length);
    scriptPubkey[0] = opVersion;
    scriptPubkey[1] = program.length;
    scriptPubkey.set(program, 2);

    return scriptPubkey;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  /**
   * Submit spell to Charms prover with retry logic
   */
  private async submitToProver(proverRequest: ClaimProverRequest): Promise<{
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
    proverRequest: ClaimProverRequest,
  ): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVER_TIMEOUT_MS);

    try {
      const endpoint = this.proverUrl.includes("charms.dev")
        ? `${this.proverUrl}/spells/prove`
        : `${this.proverUrl}/prove`;

      // Log request details for debugging (without full binary)
      claimLogger.info("Submitting to prover", {
        endpoint,
        spellLength: proverRequest.spell.length,
        hasPrivateInputs: !!proverRequest.app_private_inputs,
        hasBinaries: !!proverRequest.binaries,
        hasPrevTxs: !!proverRequest.prev_txs,
        changeAddress: proverRequest.change_address,
        feeRate: proverRequest.fee_rate,
      });

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
        claimLogger.error("Prover API error response", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500), // Limit length
        });
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
  appVk?: string; // Deprecated: V2 uses BABTC_V2_CONTRACT_VK from binary
  network?: "mainnet" | "testnet" | "testnet4";
}): ClaimMintingService {
  if (!mintingServiceInstance) {
    mintingServiceInstance = new ClaimMintingService(config);
  }
  return mintingServiceInstance;
}
