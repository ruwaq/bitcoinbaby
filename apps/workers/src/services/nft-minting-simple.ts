/**
 * NFT Minting Service - Simple Version
 *
 * Based on the original working implementation.
 * Spell is CBOR-encoded (required by current prover).
 */

import { nftLogger } from "../lib/logger";
import * as cbor from "cbor2";
import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../lib/nft-contract-binary";

// =============================================================================
// TYPES
// =============================================================================

export interface BabyNFTState {
  dna: string;
  bloodline: string;
  base_type: string;
  genesis_block: number;
  rarity_tier: string;
  token_id: number;
  level: number;
  xp: number;
  total_xp: number;
  work_count: number;
  last_work_block: number;
  evolution_count: number;
  tokens_earned: string;
}

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

const DEFAULT_PROVER_URL = "https://v11.charms.dev";
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

  constructor(config: { proverUrl?: string; appId: string; appVk?: string }) {
    this.proverUrl = config.proverUrl || DEFAULT_PROVER_URL;
    this.appId = config.appId;
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

      // Add prev_txs and binaries to request
      const proverRequest = {
        ...spellData,
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
    const response = await fetch(
      `https://mempool.space/testnet4/api/tx/${txid}/hex`,
    );
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
    const nftState: BabyNFTState = {
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
    };

    // Convert UTXO string to bytes (36 bytes: 32 txid reversed + 4 index LE)
    const insBytes = [this.utxoToBytes(fundingUtxoStr)];

    // Convert outputs to Map with integer keys
    const outsMap = new Map<number, unknown>();
    outsMap.set(0, nftState);

    // Convert app key to tuple [tag, identity_bytes, vk_bytes]
    // Use the VK from our compiled binary
    const appTuple: [string, Uint8Array, Uint8Array] = [
      "n",
      this.hexToBytes(this.appId),
      this.hexToBytes(NFT_CONTRACT_VK),
    ];
    const appPublicInputs = new Map<unknown, unknown>();
    appPublicInputs.set(appTuple, null);

    // Convert owner address to script pubkey
    const scriptPubkey = this.addressToScriptPubkey(request.ownerAddress);

    // Build CBOR-compatible spell with coins
    const spell = {
      version: 11,
      tx: {
        ins: insBytes,
        outs: [outsMap],
        coins: [
          {
            amount: 330, // NFT dust amount
            dest: scriptPubkey,
          },
        ],
      },
      app_public_inputs: appPublicInputs,
    };

    // Encode to CBOR and convert to hex
    const cborBytes = cbor.encode(spell);
    const spellHex = this.bytesToHex(new Uint8Array(cborBytes));

    return {
      spell: spellHex,
      funding_utxo: fundingUtxoStr,
      funding_utxo_value: request.fundingUtxo.value,
      change_address: request.ownerAddress,
      chain: "bitcoin",
      fee_rate: 2.0,
    };
  }

  /**
   * Convert UTXO string to 36-byte array
   */
  private utxoToBytes(utxoStr: string): Uint8Array {
    const [txidHex, indexStr] = utxoStr.split(":");
    const index = parseInt(indexStr, 10);

    const bytes = new Uint8Array(36);
    // Reverse txid bytes (Bitcoin display order)
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

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
  }

  private bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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

    // Build script pubkey
    const opVersion = version === 0 ? 0x00 : 0x50 + version;
    const scriptPubkey = new Uint8Array(2 + program.length);
    scriptPubkey[0] = opVersion;
    scriptPubkey[1] = program.length;
    scriptPubkey.set(program, 2);

    return scriptPubkey;
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

// Factory
let serviceInstance: NFTMintingServiceSimple | null = null;

export function getNFTMintingServiceSimple(config: {
  proverUrl?: string;
  appId: string;
  appVk: string;
}): NFTMintingServiceSimple {
  if (!serviceInstance) {
    serviceInstance = new NFTMintingServiceSimple(config);
  }
  return serviceInstance;
}
