/**
 * NFT Minting Service - Simple Version
 *
 * Based on the original working implementation.
 * Spell is CBOR-encoded (required by current prover).
 */

import { nftLogger } from "../lib/logger";
import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../lib/nft-contract-binary";
import { MEMPOOL_API_URLS, type BitcoinNetwork } from "../config/bitcoin";
import {
  type SparkNFTState,
  addressToScriptPubkey,
  buildEmptyAppPublicInputs,
  encodeCborHex,
  utxoToBytes,
  SPELL_VERSION,
  NFT_DUST_SATS,
  DEFAULT_FEE_RATE,
} from "./nft-spell-utils";

// Re-export so existing callers can import SparkNFTState from this module.
export type { SparkNFTState };

export interface NFTMintRequest {
  tokenId: number;
  ownerAddress: string;
  nftState: {
    dna: string;
    bloodline: string;
    baseType: string;
    genesisBlock: number;
    rarityTier: string;
    tokenId: number;
    level: number;
    xp: number;
    totalXp: number;
    workCount: number;
    lastWorkBlock: number;
    evolutionCount: number;
    tokensEarned: string;
    heritage: number;
  };
  fundingUtxo: {
    txid: string;
    vout: number;
    value: number;
  };
}

export interface NFTMintResult {
  success: boolean;
  commitTxHex?: string;
  spellTxHex?: string;
  commitTxid?: string;
  spellTxid?: string;
  error?: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_PROVER_URL = "https://v15.charms.dev";
const PROVER_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

// =============================================================================
// SERVICE
// =============================================================================

// Prover response type
interface ProverResponseData {
  commitTx?: string;
  spellTx?: string;
  bitcoin?: string | string[];
}

export class NFTMintingServiceSimple {
  private proverUrl: string;
  private appId: string;
  private network: BitcoinNetwork;

  constructor(config: {
    proverUrl?: string;
    appId: string;
    appVk?: string;
    network?: BitcoinNetwork;
  }) {
    this.proverUrl = config.proverUrl || DEFAULT_PROVER_URL;
    this.appId = config.appId;
    this.network = config.network || "testnet4";
    // Note: appVk is accepted for compatibility but we use NFT_CONTRACT_VK directly
  }

  async processMint(request: NFTMintRequest): Promise<NFTMintResult> {
    nftLogger.info("Processing NFT mint (simple)", {
      tokenId: request.tokenId,
      owner: request.ownerAddress,
    });

    try {
      // Fetch previous transaction
      const prevTxHex = await this.fetchRawTransaction(
        request.fundingUtxo.txid,
      );
      nftLogger.info("Fetched prev tx", { length: prevTxHex.length });

      // Build spell request
      const spellData = this.buildMintSpell(request);

      // Witness for the contract's 4th arg `w`. Per the Charms v15 spike
      // (docs/superpowers/notes/charms-v15-witness-spike.md), this is a
      // TOP-LEVEL field of the prover request (sibling of spell/binaries/
      // prev_txs), keyed by the FULL app string "n/<app_id>/<app_vk>", with
      // value = hex-CBOR of { operation: "mint" }. Without it, `w` arrives
      // empty and the contract routes every op to the transfer branch.
      const appKey = `n/${this.appId}/${NFT_CONTRACT_VK}`;
      const app_private_inputs: Record<string, string> = {
        [appKey]: this.buildWitnessHex("mint"),
      };

      // Add app_private_inputs, prev_txs and binaries to request
      const proverRequest = {
        ...spellData,
        app_private_inputs,
        prev_txs: [{ bitcoin: prevTxHex }],
        binaries: {
          [NFT_CONTRACT_VK]: NFT_CONTRACT_BINARY,
        },
      };

      nftLogger.info("Prover request built", {
        hasSpell: !!proverRequest.spell,
        hasPrevTxs: !!proverRequest.prev_txs,
      });

      // Submit to prover
      const result = await this.submitToProver(proverRequest);
      return result;
    } catch (error) {
      nftLogger.error("NFT mint failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Fetch raw transaction hex from mempool API
   */
  private async fetchRawTransaction(txid: string): Promise<string> {
    if (
      txid ===
        "0000000000000000000000000000000000000000000000000000000000000001" ||
      txid ===
        "0000000000000000000000000000000000000000000000000000000000000002" ||
      this.network === "regtest"
    ) {
      return "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100f2052a010000000000000000";
    }
    const baseUrl = MEMPOOL_API_URLS[this.network];
    const response = await fetch(`${baseUrl}/tx/${txid}/hex`);
    if (!response.ok) {
      throw new Error(`Failed to fetch tx ${txid}: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Build V11 spell with CBOR encoding
   */
  private buildMintSpell(request: NFTMintRequest): {
    spell: string;
    funding_utxo: string;
    funding_utxo_value: number;
    change_address: string;
    chain: string;
    fee_rate: number;
  } {
    const fundingUtxoStr = `${request.fundingUtxo.txid}:${request.fundingUtxo.vout}`;

    // Convert to snake_case for contract
    const nftState: SparkNFTState = {
      dna: request.nftState.dna,
      bloodline: request.nftState.bloodline,
      base_type: request.nftState.baseType,
      genesis_block: request.nftState.genesisBlock,
      rarity_tier: request.nftState.rarityTier,
      token_id: request.nftState.tokenId,
      level: request.nftState.level,
      xp: request.nftState.xp,
      total_xp: request.nftState.totalXp,
      work_count: request.nftState.workCount,
      last_work_block: request.nftState.lastWorkBlock,
      evolution_count: request.nftState.evolutionCount,
      tokens_earned: request.nftState.tokensEarned,
      heritage: request.nftState.heritage,
    };

    // Build the CBOR spell via the shared util (byte-compatible with the
    // previous inline encoding). version 15, 330-sat coin output to the owner.
    const spellObject = {
      version: SPELL_VERSION,
      tx: {
        ins: [utxoToBytes(fundingUtxoStr)],
        outs: [new Map<number, unknown>([[0, nftState]])],
        coins: [
          {
            amount: NFT_DUST_SATS,
            dest: addressToScriptPubkey(request.ownerAddress),
          },
        ],
      },
      app_public_inputs: buildEmptyAppPublicInputs(this.appId),
    };
    const spellHex = encodeCborHex(spellObject);

    return {
      spell: spellHex,
      funding_utxo: fundingUtxoStr,
      funding_utxo_value: request.fundingUtxo.value,
      change_address: request.ownerAddress,
      chain: "bitcoin",
      fee_rate: DEFAULT_FEE_RATE,
    };
  }

  /**
   * Build the hex-CBOR witness for the contract's `w` argument.
   *
   * Matches `NFTWitness { operation: String }` in the genesis-babies contract.
   * For a mint, the contract's `match witness.operation.as_str()` routes to
   * `validate_mint`. Uses the same cbor2 encoder as the spell (via the shared
   * util).
   */
  private buildWitnessHex(operation: string): string {
    return encodeCborHex({ operation });
  }

  private async submitToProver(proverRequest: object): Promise<NFTMintResult> {
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await this.proveOnce(proverRequest);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        nftLogger.warn(`Prover attempt ${attempt} failed`, {
          error: lastError,
        });

        if (lastError.includes("400")) break;

        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
        }
      }
    }

    return {
      success: false,
      error: `Prover failed after ${MAX_RETRIES} attempts: ${lastError}`,
    };
  }

  private async proveOnce(proverRequest: object): Promise<NFTMintResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVER_TIMEOUT_MS);

    try {
      const endpoint = `${this.proverUrl}/spells/prove`;
      const body = JSON.stringify(proverRequest);

      nftLogger.info("Sending to prover", {
        endpoint,
        bodyLength: body.length,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/2.0",
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(`Prover API error: ${response.status} - ${errorText}`);
      }

      const rawData = await response.json();
      const data = rawData as ProverResponseData | Array<{ bitcoin?: string }>;

      // Log the raw response to understand the format
      nftLogger.info("Prover raw response", {
        type: typeof data,
        isArray: Array.isArray(data),
        keys:
          typeof data === "object" && data !== null ? Object.keys(data) : [],
        preview: JSON.stringify(data).slice(0, 500),
      });

      // Handle different response formats
      let commitTx: string | undefined;
      let spellTx: string | undefined;

      if (!Array.isArray(data) && data.commitTx && data.spellTx) {
        commitTx = data.commitTx;
        spellTx = data.spellTx;
      } else if (Array.isArray(data)) {
        const txs = data
          .filter((t) => t.bitcoin)
          .map((t) => t.bitcoin as string);
        if (txs.length >= 2) {
          commitTx = txs[0];
          spellTx = txs[1];
        } else if (txs.length === 1) {
          // Some responses only have one tx
          spellTx = txs[0];
        }
      }

      if (!spellTx) {
        throw new Error(
          `Invalid prover response: no transactions. Raw: ${JSON.stringify(data).slice(0, 200)}`,
        );
      }

      const commitTxid = commitTx
        ? await this.extractTxid(commitTx)
        : undefined;
      const spellTxid = await this.extractTxid(spellTx);

      nftLogger.info("NFT mint spell generated", { commitTxid, spellTxid });

      return {
        success: true,
        commitTxHex: commitTx,
        spellTxHex: spellTx,
        commitTxid,
        spellTxid,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Check if prover is available and responsive
   */
  async healthCheck(): Promise<{
    available: boolean;
    latencyMs: number;
    error?: string;
  }> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout for health check

    try {
      // Simple GET request to check if prover is responsive
      await fetch(this.proverUrl, {
        method: "GET",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      // Any response (even 404) means the server is up
      return {
        available: true,
        latencyMs,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      const message = error instanceof Error ? error.message : "Unknown error";

      nftLogger.warn("Prover health check failed", {
        error: message,
        latencyMs,
      });

      return {
        available: false,
        latencyMs,
        error: message,
      };
    }
  }

  private async extractTxid(txHex: string): Promise<string> {
    const bytes = new Uint8Array(txHex.length / 2);
    for (let i = 0; i < txHex.length; i += 2) {
      bytes[i / 2] = parseInt(txHex.substring(i, i + 2), 16);
    }
    const hash1 = await crypto.subtle.digest("SHA-256", bytes);
    const hash2 = await crypto.subtle.digest("SHA-256", hash1);
    const hashArray = new Uint8Array(hash2).reverse();
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Factory - creates new instance per request to support network switching
export function getNFTMintingServiceSimple(config: {
  proverUrl?: string;
  appId: string;
  appVk: string;
  network?: BitcoinNetwork;
}): NFTMintingServiceSimple {
  return new NFTMintingServiceSimple(config);
}
