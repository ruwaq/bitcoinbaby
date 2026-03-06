/**
 * NFT Minting Service
 *
 * Handles the minting of Genesis Babies NFTs via Charms prover.
 * Builds V11 spells and submits to the prover API.
 *
 * Flow:
 * 1. Client reserves tokenId via /api/nft/reserve
 * 2. Client generates traits (DNA, bloodline, rarity)
 * 3. Client calls /api/nft/prove with NFT state + funding UTXO
 * 4. This service builds V11 spell and submits to prover
 * 5. Returns commit + spell TXs for signing
 * 6. Client signs both TXs and broadcasts
 * 7. Client confirms via /api/nft/confirm/:tokenId
 */

import { nftLogger } from "../lib/logger";

// =============================================================================
// TYPES
// =============================================================================

/**
 * NFT state stored on-chain
 */
export interface BabyNFTState {
  dna: string;
  bloodline: "royal" | "warrior" | "rogue" | "mystic";
  baseType: "human" | "animal" | "robot" | "mystic" | "alien";
  genesisBlock: number;
  rarityTier: "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic";
  tokenId: number;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: string;
}

/**
 * NFT mint request parameters
 */
export interface NFTMintRequest {
  /** Reserved token ID */
  tokenId: number;
  /** Owner's Bitcoin address */
  ownerAddress: string;
  /** NFT initial state */
  nftState: BabyNFTState;
  /** Funding UTXO to consume */
  fundingUtxo: {
    txid: string;
    vout: number;
    value: number;
  };
}

/**
 * Result from prover submission
 */
export interface NFTMintResult {
  success: boolean;
  /** Commit transaction hex (needs signing) */
  commitTxHex?: string;
  /** Spell transaction hex (needs signing) */
  spellTxHex?: string;
  /** Commit transaction ID */
  commitTxid?: string;
  /** Spell transaction ID (final NFT location) */
  spellTxid?: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Prover API response
 */
interface ProverResponse {
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

/** Max retries for prover submission */
const MAX_PROVER_RETRIES = 3;

/** Retry delay base (exponential backoff) */
const RETRY_DELAY_BASE_MS = 5000;

/** Zero appId indicates genesis mint - will calculate from funding UTXO */
const ZERO_APP_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

// =============================================================================
// NFT MINTING SERVICE
// =============================================================================

export class NFTMintingService {
  private proverUrl: string;
  private appId: string;
  private appVk: string;

  constructor(config: {
    proverUrl?: string;
    appId: string;
    appVk: string;
    network?: "mainnet" | "testnet" | "testnet4";
  }) {
    this.proverUrl = config.proverUrl || DEFAULT_CHARMS_PROVER_URL;
    this.appId = config.appId;
    this.appVk = config.appVk;
  }

  /**
   * Calculate app ID from funding UTXO (for genesis mint)
   * appId = SHA256(txid:vout)
   */
  private async calculateAppId(fundingUtxo: {
    txid: string;
    vout: number;
  }): Promise<string> {
    const utxoStr = `${fundingUtxo.txid}:${fundingUtxo.vout}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(utxoStr);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    return Array.from(hashArray)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Get the effective app ID
   * If configured appId is all zeros, calculate from funding UTXO
   */
  private async getEffectiveAppId(fundingUtxo: {
    txid: string;
    vout: number;
  }): Promise<string> {
    if (this.appId === ZERO_APP_ID) {
      const calculatedId = await this.calculateAppId(fundingUtxo);
      nftLogger.info("Genesis mint - calculated appId from funding UTXO", {
        fundingUtxo: `${fundingUtxo.txid}:${fundingUtxo.vout}`,
        appId: calculatedId,
      });
      return calculatedId;
    }
    return this.appId;
  }

  /**
   * Process an NFT mint request
   *
   * 1. Calculate effective appId (from funding UTXO for genesis)
   * 2. Build V11 spell with NFT state
   * 3. Submit to Charms prover
   * 4. Return transactions for signing
   */
  async processMint(request: NFTMintRequest): Promise<NFTMintResult> {
    nftLogger.info("Processing NFT mint request", {
      tokenId: request.tokenId,
      owner: request.ownerAddress,
      rarity: request.nftState.rarityTier,
    });

    try {
      // Get effective appId (calculate from UTXO for genesis)
      const effectiveAppId = await this.getEffectiveAppId(request.fundingUtxo);

      // Build the mint spell with effective appId
      const proverRequest = this.buildMintSpell(request, effectiveAppId);

      // Submit to prover with retries
      const proverResult = await this.submitToProver(proverRequest);

      if (!proverResult.success) {
        return {
          success: false,
          error: proverResult.error,
        };
      }

      // Extract transaction IDs
      const commitTxid = await this.extractTxid(proverResult.commitTx!);
      const spellTxid = await this.extractTxid(proverResult.spellTx!);

      nftLogger.info("NFT mint spell generated", {
        tokenId: request.tokenId,
        commitTxid,
        spellTxid,
      });

      return {
        success: true,
        commitTxHex: proverResult.commitTx,
        spellTxHex: proverResult.spellTx,
        commitTxid,
        spellTxid,
      };
    } catch (error) {
      nftLogger.error("NFT mint failed", {
        tokenId: request.tokenId,
        error,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Build the V11 NFT genesis spell
   *
   * NFTs use "n/" prefix and store state objects instead of amounts.
   */
  private buildMintSpell(
    request: NFTMintRequest,
    effectiveAppId: string,
  ): object {
    // NFT app reference: n/<appId>/<appVk>
    const appKey = `n/${effectiveAppId}/${this.appVk}`;

    // V11 spell format for NFT genesis (mint)
    const spell = {
      version: 11,
      tx: {
        // Input: funding UTXO
        ins: [`${request.fundingUtxo.txid}:${request.fundingUtxo.vout}`],
        // Output: NFT state goes to owner
        outs: [
          {
            // App index "0" maps to first app in app_public_inputs
            "0": {
              // NFT state stored on-chain
              dna: request.nftState.dna,
              bloodline: request.nftState.bloodline,
              baseType: request.nftState.baseType,
              genesisBlock: request.nftState.genesisBlock,
              rarityTier: request.nftState.rarityTier,
              tokenId: request.nftState.tokenId,
              level: request.nftState.level,
              xp: request.nftState.xp,
              totalXp: request.nftState.totalXp,
              workCount: request.nftState.workCount,
              lastWorkBlock: request.nftState.lastWorkBlock,
              evolutionCount: request.nftState.evolutionCount,
              tokensEarned: request.nftState.tokensEarned,
            },
          },
        ],
      },
      app_public_inputs: {
        [appKey]: null, // Genesis mint has no public inputs
      },
    };

    // Full prover request with funding info
    return {
      spell,
      // No app_private_inputs needed for NFT genesis
      funding_utxo: `${request.fundingUtxo.txid}:${request.fundingUtxo.vout}`,
      funding_utxo_value: request.fundingUtxo.value,
      change_address: request.ownerAddress,
    };
  }

  /**
   * Submit spell to Charms prover with retry logic
   */
  private async submitToProver(proverRequest: object): Promise<{
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

        nftLogger.warn(`Prover attempt ${attempt} failed`, {
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
  private async proveOnce(proverRequest: object): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVER_TIMEOUT_MS);

    try {
      // V11 prover endpoint
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
      nftLogger.error("Failed to extract txid", { error });
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
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
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

let nftMintingServiceInstance: NFTMintingService | null = null;

/**
 * Get or create the NFT minting service instance
 */
export function getNFTMintingService(config: {
  proverUrl?: string;
  appId: string;
  appVk: string;
  network?: "mainnet" | "testnet" | "testnet4";
}): NFTMintingService {
  if (!nftMintingServiceInstance) {
    nftMintingServiceInstance = new NFTMintingService(config);
  }
  return nftMintingServiceInstance;
}
