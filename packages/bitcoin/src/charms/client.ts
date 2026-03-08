/**
 * Charms Client
 *
 * Unified client for interacting with Charms protocol.
 * Uses client-side validation (no central indexer needed).
 */

import type {
  CharmsNetwork,
  ExtractedCharm,
  ScrollsConfigResponse,
  ScrollsSignRequest,
} from "./types";
import { SCROLLS_URLS, MEMPOOL_URLS } from "./types";
import type { BabyNFTState } from "./nft";
// Reuse types from blockchain module (avoid duplication)
import type {
  UTXO,
  AddressBalance,
  TransactionInfo,
  FeeEstimates,
} from "../blockchain/types";
import { ApiError } from "../errors";
import { sha256 as cryptoSha256, hexToBytes } from "../crypto";
// charms-js SDK for real charm extraction
import {
  extractCharmsForWallet as charmsJsExtract,
  type CharmObj,
} from "charms-js";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("CharmsClient");

// =============================================================================
// CLIENT OPTIONS
// =============================================================================

export interface CharmsClientOptions {
  network?: CharmsNetwork;
  scrollsUrl?: string;
  mempoolUrl?: string;
}

// =============================================================================
// CHARMS CLIENT
// =============================================================================

export class CharmsClient {
  private readonly network: CharmsNetwork;
  private readonly scrollsUrl: string;
  private readonly mempoolUrl: string;
  private configCache: ScrollsConfigResponse | null = null;

  constructor(options: CharmsClientOptions = {}) {
    this.network = options.network || "testnet4";
    this.scrollsUrl = options.scrollsUrl || SCROLLS_URLS[this.network];
    this.mempoolUrl = options.mempoolUrl || MEMPOOL_URLS[this.network];
  }

  // ===========================================================================
  // SCROLLS API
  // ===========================================================================

  /**
   * Get Scrolls configuration (cached)
   */
  async getScrollsConfig(): Promise<ScrollsConfigResponse> {
    if (this.configCache) {
      return this.configCache;
    }

    const response = await fetch(`${this.scrollsUrl}/config`);
    if (!response.ok) {
      throw new CharmsError(
        `Failed to get Scrolls config: ${response.statusText}`,
      );
    }

    this.configCache = await response.json();
    return this.configCache!;
  }

  /**
   * Get fee address for current network
   */
  async getFeeAddress(): Promise<string> {
    const config = await this.getScrollsConfig();
    return config.fee_address[this.network];
  }

  /**
   * Calculate Scrolls fee for a transaction
   */
  async calculateScrollsFee(
    inputCount: number,
    totalSats: number,
  ): Promise<number> {
    const config = await this.getScrollsConfig();
    const { fixed_cost, fee_per_input, fee_basis_points } = config;

    return (
      fixed_cost +
      fee_per_input * inputCount +
      Math.floor((fee_basis_points / 10000) * totalSats)
    );
  }

  /**
   * Derive Scrolls address from nonce
   */
  async deriveScrollsAddress(nonce: bigint): Promise<string> {
    const response = await fetch(
      `${this.scrollsUrl}/${this.network}/address/${nonce}`,
    );

    if (!response.ok) {
      throw new CharmsError(`Failed to derive address: ${response.statusText}`);
    }

    return response.text();
  }

  /**
   * Calculate nonce from UTXO
   * nonce = first 8 bytes of SHA256(txid:vout) as u64 little-endian
   *
   * Uses real SHA-256 via WebCrypto for cryptographic correctness.
   */
  async calculateNonce(txid: string, vout: number): Promise<bigint> {
    const input = `${txid}:${vout}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(input);

    // Real SHA-256 hash
    const hashBytes = await cryptoSha256(data);
    const bytes = hashBytes.slice(0, 8);

    // Little-endian u64
    let nonce = 0n;
    for (let i = 0; i < 8; i++) {
      nonce |= BigInt(bytes[i]) << BigInt(i * 8);
    }

    return nonce;
  }

  /**
   * Sign transaction with Scrolls co-signer
   */
  async signWithScrolls(request: ScrollsSignRequest): Promise<string> {
    const response = await fetch(`${this.scrollsUrl}/${this.network}/sign`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sign_inputs: request.sign_inputs.map((si) => ({
          index: si.index,
          nonce: si.nonce.toString(),
        })),
        prev_txs: request.prev_txs,
        tx_to_sign: request.tx_to_sign,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new CharmsError(`Scrolls signing failed: ${error}`);
    }

    return response.text();
  }

  // ===========================================================================
  // MEMPOOL API
  // ===========================================================================

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    const response = await fetch(`${this.mempoolUrl}/address/${address}/utxo`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get UTXOs: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get address balance
   */
  async getBalance(address: string): Promise<AddressBalance> {
    const response = await fetch(`${this.mempoolUrl}/address/${address}`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get balance: ${response.statusText}`);
    }

    const data = await response.json();
    const confirmed =
      data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    const unconfirmed =
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;

    return {
      address,
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed,
      utxoCount: data.chain_stats.tx_count || 0,
    };
  }

  /**
   * Get raw transaction hex
   */
  async getRawTransaction(txid: string): Promise<string> {
    const response = await fetch(`${this.mempoolUrl}/tx/${txid}/hex`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get tx: ${response.statusText}`);
    }
    return response.text();
  }

  /**
   * Get transaction info
   */
  async getTransaction(txid: string): Promise<TransactionInfo> {
    const response = await fetch(`${this.mempoolUrl}/tx/${txid}`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get tx info: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get address transaction history with optional pagination
   * @param address - Bitcoin address
   * @param afterTxid - Optional txid to paginate after (for fetching more history)
   */
  async getAddressTransactions(
    address: string,
    afterTxid?: string,
  ): Promise<TransactionInfo[]> {
    const url = afterTxid
      ? `${this.mempoolUrl}/address/${address}/txs?after_txid=${afterTxid}`
      : `${this.mempoolUrl}/address/${address}/txs`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new CharmsError(`Failed to get txs: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get extended transaction history (up to 150 transactions)
   * Uses pagination to fetch more than the default 50 tx limit
   */
  async getExtendedTransactionHistory(
    address: string,
    maxTxs: number = 150,
  ): Promise<TransactionInfo[]> {
    const allTxs: TransactionInfo[] = [];

    // First batch (most recent 50)
    const firstBatch = await this.getAddressTransactions(address);
    allTxs.push(...firstBatch);

    // If we got 50 and need more, paginate
    if (firstBatch.length >= 50 && allTxs.length < maxTxs) {
      const lastTxid = firstBatch[firstBatch.length - 1].txid;
      const secondBatch = await this.getAddressTransactions(address, lastTxid);
      allTxs.push(...secondBatch);

      // Third batch if needed
      if (secondBatch.length >= 50 && allTxs.length < maxTxs) {
        const lastTxid2 = secondBatch[secondBatch.length - 1].txid;
        const thirdBatch = await this.getAddressTransactions(
          address,
          lastTxid2,
        );
        allTxs.push(...thirdBatch);
      }
    }

    return allTxs.slice(0, maxTxs);
  }

  /**
   * Broadcast transaction
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    const response = await fetch(`${this.mempoolUrl}/tx`, {
      method: "POST",
      body: txHex,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new CharmsError(`Broadcast failed: ${error}`);
    }

    return response.text(); // Returns txid
  }

  /**
   * Get fee estimates
   */
  async getFeeEstimates(): Promise<FeeEstimates> {
    const response = await fetch(`${this.mempoolUrl}/v1/fees/recommended`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get fees: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    const response = await fetch(`${this.mempoolUrl}/blocks/tip/height`);
    if (!response.ok) {
      throw new CharmsError(`Failed to get height: ${response.statusText}`);
    }
    return parseInt(await response.text(), 10);
  }

  // ===========================================================================
  // CHARM EXTRACTION (Using charms-js SDK)
  // ===========================================================================

  /**
   * Extract charms from transactions for a wallet
   *
   * Uses charms-js SDK for real charm extraction and verification.
   * Now uses extended transaction history (up to 150 txs) for better NFT discovery.
   */
  async extractCharmsForWallet(
    address: string,
    appId?: string,
  ): Promise<ExtractedCharm[]> {
    const utxos = await this.getUTXOs(address);
    const outpoints = new Set(utxos.map((u) => `${u.txid}:${u.vout}`));
    // Use extended history to find NFTs in older transactions
    const txHistory = await this.getExtendedTransactionHistory(address, 150);

    const charms: ExtractedCharm[] = [];
    const network = this.network === "main" ? "mainnet" : "testnet4";

    let processedCount = 0;
    let errorCount = 0;

    for (const txInfo of txHistory) {
      try {
        const txHex = await this.getRawTransaction(txInfo.txid);

        // Use charms-js SDK for extraction
        const extracted = await charmsJsExtract(
          txHex,
          txInfo.txid,
          outpoints,
          network,
        );

        processedCount++;

        // Convert CharmObj to ExtractedCharm
        for (const charm of extracted) {
          // Filter by appId if specified
          if (appId && charm.appId !== appId) {
            continue;
          }

          charms.push(this.convertCharmObjToExtracted(charm, txInfo.txid));
        }
      } catch (error) {
        errorCount++;
        // Log first few errors for debugging (not all to avoid spam)
        if (errorCount <= 3) {
          log.warn(
            `Failed to extract charm from tx ${txInfo.txid.slice(0, 8)}`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
        // Continue to next tx - this one may not contain charms
        continue;
      }
    }

    log.debug(`Extracted charms`, {
      count: charms.length,
      processed: processedCount,
      errors: errorCount,
    });

    return charms;
  }

  /**
   * Convert charms-js CharmObj to our ExtractedCharm type
   */
  private convertCharmObjToExtracted(
    charm: CharmObj,
    txid: string,
  ): ExtractedCharm {
    // Determine app type from metadata (token has ticker, NFT doesn't)
    const hasToken = !!charm.metadata?.ticker;
    const appType = hasToken ? "t" : "n";

    return {
      appId: charm.appId,
      appType: appType as "t" | "n",
      amount: BigInt(charm.amount || 0),
      txid,
      vout: charm.outputIndex,
      address: charm.address,
      ticker: charm.metadata?.ticker,
      name: charm.metadata?.name,
      // For NFTs, extract state from app data
      state:
        appType === "n" ? (charm.app as Record<string, unknown>) : undefined,
    };
  }

  /**
   * Get token balance for an address
   */
  async getTokenBalance(address: string, appId: string): Promise<bigint> {
    const charms = await this.extractCharmsForWallet(address, appId);

    return charms
      .filter((c) => c.appId === appId && c.appType === "t")
      .reduce((sum, c) => sum + c.amount, 0n);
  }

  /**
   * Get owned NFTs for an address
   */
  async getOwnedNFTs(address: string, appId: string): Promise<BabyNFTState[]> {
    const charms = await this.extractCharmsForWallet(address, appId);

    return charms
      .filter((c) => c.appId === appId && c.appType === "n" && c.state)
      .map((c) => c.state as unknown as BabyNFTState)
      .filter(
        (state): state is BabyNFTState => state !== null && state !== undefined,
      );
  }

  /**
   * Get best mining boost from owned NFTs
   */
  async getMiningBoost(address: string, nftAppId: string): Promise<number> {
    const nfts = await this.getOwnedNFTs(address, nftAppId);

    if (nfts.length === 0) {
      return 0;
    }

    // Import dynamically to avoid circular deps
    const { getMiningBoost } = await import("./nft");
    return Math.max(...nfts.map((nft) => getMiningBoost(nft)));
  }

  // NOTE: sha256 and hexToBytes are imported from '../crypto'
  // providing real cryptographic hashing for nonce calculation
}

// =============================================================================
// ERRORS (Extends shared ApiError)
// =============================================================================

export class CharmsError extends ApiError {
  constructor(message: string, endpoint: string = "charms") {
    super(endpoint, undefined, message);
    this.name = "CharmsError";
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createCharmsClient(
  options?: CharmsClientOptions,
): CharmsClient {
  return new CharmsClient(options);
}
