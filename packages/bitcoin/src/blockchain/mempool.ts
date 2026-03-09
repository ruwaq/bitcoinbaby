/**
 * Mempool.space API Client
 *
 * Client for interacting with Mempool.space blockchain API.
 * Supports mainnet, testnet, and testnet4.
 *
 * API Docs: https://mempool.space/docs/api
 */

import type { BitcoinNetwork } from "../types";
import type {
  BlockchainAPI,
  UTXO,
  AddressBalance,
  TransactionInfo,
  FeeEstimates,
} from "./types";
import {
  requireValidAddress,
  requireValidTxid,
  validateTxHex,
  assertValid,
} from "../validation";
import { ApiError } from "../errors";

// Mempool.space base URLs
const MEMPOOL_URLS: Record<BitcoinNetwork, string> = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
  regtest: "http://localhost:3000/api", // Local regtest
};

export interface MempoolClientOptions {
  network?: BitcoinNetwork;
  baseUrl?: string;
  timeout?: number;
}

/**
 * Mempool.space API Client
 */
export class MempoolClient implements BlockchainAPI {
  readonly network: BitcoinNetwork;
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: MempoolClientOptions = {}) {
    this.network = options.network ?? "testnet4";
    this.baseUrl = options.baseUrl ?? MEMPOOL_URLS[this.network];
    this.timeout = options.timeout ?? 30000;
  }

  /**
   * Make HTTP request to Mempool API
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        // Get error body for better error messages (especially for broadcast failures)
        const errorBody = await response.text().catch(() => "");
        const errorMessage =
          errorBody || `${response.status} ${response.statusText}`;
        throw new MempoolAPIError(
          `Mempool API error: ${errorMessage}`,
          response.status,
        );
      }

      const text = await response.text();
      // Handle empty responses or plain text
      if (!text) return {} as T;
      try {
        return JSON.parse(text) as T;
      } catch {
        return text as unknown as T;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get address balance
   */
  async getBalance(address: string): Promise<AddressBalance> {
    const validAddress = requireValidAddress(address, this.network);

    interface MempoolAddressResponse {
      address: string;
      chain_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
      };
      mempool_stats: {
        funded_txo_count: number;
        funded_txo_sum: number;
        spent_txo_count: number;
        spent_txo_sum: number;
        tx_count: number;
      };
    }

    const data = await this.fetch<MempoolAddressResponse>(
      `/address/${validAddress}`,
    );

    const confirmed =
      data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
    const unconfirmed =
      data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;

    return {
      address,
      confirmed,
      unconfirmed,
      total: confirmed + unconfirmed,
      utxoCount:
        data.chain_stats.funded_txo_count -
        data.chain_stats.spent_txo_count +
        data.mempool_stats.funded_txo_count -
        data.mempool_stats.spent_txo_count,
    };
  }

  /**
   * Get UTXOs for an address
   */
  async getUTXOs(address: string): Promise<UTXO[]> {
    const validAddress = requireValidAddress(address, this.network);
    return this.fetch<UTXO[]>(`/address/${validAddress}/utxo`);
  }

  /**
   * Get transaction info
   */
  async getTransaction(txid: string): Promise<TransactionInfo> {
    const validTxid = requireValidTxid(txid);
    return this.fetch<TransactionInfo>(`/tx/${validTxid}`);
  }

  /**
   * Broadcast a raw transaction
   */
  async broadcastTransaction(txHex: string): Promise<string> {
    assertValid(validateTxHex(txHex), "txHex", "INVALID_TX_HEX");

    const response = await this.fetch<string>("/tx", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: txHex,
    });

    // Validate response is a valid txid (64 lowercase hex chars)
    if (!/^[a-f0-9]{64}$/.test(response)) {
      throw new MempoolAPIError(`Broadcast failed: ${response}`, 400);
    }

    return response;
  }

  /**
   * Get fee estimates
   */
  async getFeeEstimates(): Promise<FeeEstimates> {
    return this.fetch<FeeEstimates>("/v1/fees/recommended");
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    return this.fetch<number>("/blocks/tip/height");
  }

  /**
   * Get address transaction history
   */
  async getAddressTransactions(
    address: string,
    afterTxid?: string,
  ): Promise<TransactionInfo[]> {
    const validAddress = requireValidAddress(address, this.network);
    const validAfterTxid = afterTxid ? requireValidTxid(afterTxid) : undefined;

    const path = validAfterTxid
      ? `/address/${validAddress}/txs/chain/${validAfterTxid}`
      : `/address/${validAddress}/txs`;
    return this.fetch<TransactionInfo[]>(path);
  }

  /**
   * Get block information
   */
  async getBlock(blockHash: string): Promise<BlockInfo> {
    return this.fetch<BlockInfo>(`/block/${blockHash}`);
  }

  /**
   * Get all transaction IDs in a block
   */
  async getBlockTxids(blockHash: string): Promise<string[]> {
    return this.fetch<string[]>(`/block/${blockHash}/txids`);
  }

  /**
   * Get raw transaction hex
   */
  async getTransactionHex(txid: string): Promise<string> {
    const validTxid = requireValidTxid(txid);
    return this.fetch<string>(`/tx/${validTxid}/hex`);
  }

  /**
   * Wait for transaction confirmation
   * Polls until transaction is confirmed or timeout
   */
  async waitForConfirmation(
    txid: string,
    options: {
      timeoutMs?: number;
      pollIntervalMs?: number;
    } = {},
  ): Promise<TransactionInfo> {
    const { timeoutMs = 600000, pollIntervalMs = 10000 } = options;
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const tx = await this.getTransaction(txid);
      if (tx.status.confirmed) {
        return tx;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    throw new MempoolAPIError(
      `Transaction ${txid} not confirmed within ${timeoutMs}ms`,
      408,
    );
  }
}

/**
 * Block information from Mempool API
 */
export interface BlockInfo {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

/**
 * Custom error for Mempool API errors
 * Extends shared ApiError for consistency
 */
export class MempoolAPIError extends ApiError {
  readonly statusCode: number;

  constructor(message: string, statusCode?: number) {
    super("mempool.space", statusCode, message);
    this.name = "MempoolAPIError";
    this.statusCode = statusCode ?? 0;
  }
}

/**
 * Create a Mempool client instance
 */
export function createMempoolClient(
  options?: MempoolClientOptions,
): MempoolClient {
  return new MempoolClient(options);
}
