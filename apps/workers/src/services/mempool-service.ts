/**
 * Mempool Service
 *
 * Verifies Bitcoin transactions on-chain via Mempool.space API.
 * Includes KV caching to reduce API calls and latency.
 */

import { claimLogger } from "../lib/logger";
import type { IMempoolService } from "../interfaces/services";
import type { BitcoinNetwork } from "../config/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export interface MempoolTxInfo {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
  fee: number;
  size: number;
  weight: number;
}

export interface TxVerificationResult {
  exists: boolean;
  confirmed: boolean;
  confirmations: number;
  blockHeight?: number;
  error?: string;
}

export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean; block_height?: number };
}

export interface FeeRates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

// =============================================================================
// CACHE CONFIG
// =============================================================================

const CACHE_TTL = {
  FEE_RATES: 120, // 2 minutes - fees change slowly
  UTXOS: 30, // 30 seconds - balance checks are frequent
  TX_PENDING: 60, // 1 minute for pending TXs
  TX_CONFIRMED: 600, // 10 minutes for confirmed TXs
  BLOCK_HEIGHT: 60, // 1 minute
};

const CACHE_PREFIX = "mempool:";

// =============================================================================
// CONSTANTS
// =============================================================================

const MEMPOOL_API_URLS = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// MEMPOOL SERVICE
// =============================================================================

export class MempoolService implements IMempoolService {
  private baseUrl: string;
  private _network: BitcoinNetwork;
  private kv: KVNamespace | null = null;

  get network(): BitcoinNetwork {
    return this._network;
  }

  // In-memory fallback cache
  private memCache: Map<string, { data: unknown; expiresAt: number }> =
    new Map();
  private readonly MEM_CACHE_MAX_SIZE = 100;

  constructor(network: BitcoinNetwork = "testnet4") {
    this.baseUrl = MEMPOOL_API_URLS[network];
    this._network = network;
  }

  /**
   * Set KV namespace for caching (optional)
   */
  setKV(kv: KVNamespace | null): void {
    this.kv = kv;
  }

  // ===========================================================================
  // CACHING HELPERS
  // ===========================================================================

  private cacheKey(type: string, id: string): string {
    return `${CACHE_PREFIX}${this.network}:${type}:${id}`;
  }

  private async getFromCache<T>(key: string): Promise<T | null> {
    // Try KV first
    if (this.kv) {
      try {
        const cached = await this.kv.get(key, "json");
        if (cached) return cached as T;
      } catch {
        // KV error, fall through to memory cache
      }
    }

    // Memory cache fallback
    const memCached = this.memCache.get(key);
    if (memCached && memCached.expiresAt > Date.now()) {
      return memCached.data as T;
    }

    return null;
  }

  private async setInCache<T>(
    key: string,
    data: T,
    ttlSeconds: number,
  ): Promise<void> {
    // Set in KV
    if (this.kv) {
      try {
        await this.kv.put(key, JSON.stringify(data), {
          expirationTtl: ttlSeconds,
        });
      } catch {
        // KV error, continue with memory cache
      }
    }

    // Also set in memory cache
    if (this.memCache.size >= this.MEM_CACHE_MAX_SIZE) {
      // Evict oldest entries
      const oldestKey = this.memCache.keys().next().value;
      if (oldestKey) this.memCache.delete(oldestKey);
    }

    this.memCache.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  // ===========================================================================
  // PUBLIC API
  // ===========================================================================

  /**
   * Verify a transaction exists and get its status (cached)
   */
  async verifyTransaction(txid: string): Promise<TxVerificationResult> {
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return {
        exists: false,
        confirmed: false,
        confirmations: 0,
        error: "Invalid txid format",
      };
    }

    const cacheKey = this.cacheKey("tx", txid);

    // Check cache
    const cached = await this.getFromCache<TxVerificationResult>(cacheKey);
    if (cached) return cached;

    try {
      const txInfo = await this.fetchWithRetry<MempoolTxInfo>(`/tx/${txid}`);

      if (!txInfo) {
        const result: TxVerificationResult = {
          exists: false,
          confirmed: false,
          confirmations: 0,
        };
        // Don't cache "not found" - TX might still be propagating
        return result;
      }

      const currentHeight = await this.getCurrentBlockHeight();
      const confirmations =
        txInfo.status.confirmed && txInfo.status.block_height
          ? Math.max(0, currentHeight - txInfo.status.block_height + 1)
          : 0;

      const result: TxVerificationResult = {
        exists: true,
        confirmed: txInfo.status.confirmed,
        confirmations,
        blockHeight: txInfo.status.block_height,
      };

      // Cache based on confirmation status
      const ttl = txInfo.status.confirmed
        ? CACHE_TTL.TX_CONFIRMED
        : CACHE_TTL.TX_PENDING;
      await this.setInCache(cacheKey, result, ttl);

      return result;
    } catch (error) {
      claimLogger.error("Failed to verify transaction", { txid, error });
      return {
        exists: false,
        confirmed: false,
        confirmations: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Wait for a transaction to be confirmed
   */
  async waitForConfirmation(
    txid: string,
    requiredConfirmations: number = 1,
    timeoutMs: number = 600_000,
  ): Promise<TxVerificationResult> {
    const startTime = Date.now();
    const pollInterval = 30_000;

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.verifyTransaction(txid);

      if (result.confirmations >= requiredConfirmations) {
        return result;
      }

      if (!result.exists) {
        claimLogger.info("TX not found yet, waiting...", { txid });
      }

      await this.sleep(pollInterval);
    }

    return {
      exists: false,
      confirmed: false,
      confirmations: 0,
      error: `Timeout waiting for ${requiredConfirmations} confirmations`,
    };
  }

  /**
   * Get current block height (cached)
   */
  async getCurrentBlockHeight(): Promise<number> {
    const cacheKey = this.cacheKey("height", "current");

    const cached = await this.getFromCache<number>(cacheKey);
    if (cached !== null) return cached;

    try {
      const height = await this.fetchWithRetry<number>("/blocks/tip/height");
      if (height !== null) {
        await this.setInCache(cacheKey, height, CACHE_TTL.BLOCK_HEIGHT);
        return height;
      }
    } catch (error) {
      claimLogger.error("Failed to get block height", { error });
    }

    return 0;
  }

  /**
   * Get raw transaction hex (not cached - rarely used)
   */
  async getTransactionHex(txid: string): Promise<string | null> {
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      claimLogger.error("Invalid txid format", { txid });
      return null;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      const response = await fetch(`${this.baseUrl}/tx/${txid}/hex`, {
        headers: { Accept: "text/plain" },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      return await response.text();
    } catch (error) {
      claimLogger.error("Failed to get transaction hex", { txid, error });
      return null;
    }
  }

  /**
   * Get UTXOs for an address (cached)
   */
  async getAddressUtxos(address: string): Promise<UTXO[]> {
    const cacheKey = this.cacheKey("utxos", address);

    const cached = await this.getFromCache<UTXO[]>(cacheKey);
    if (cached) return cached;

    try {
      const utxos = await this.fetchWithRetry<UTXO[]>(
        `/address/${address}/utxo`,
      );
      const result = utxos ?? [];

      await this.setInCache(cacheKey, result, CACHE_TTL.UTXOS);
      return result;
    } catch (error) {
      claimLogger.error("Failed to get address UTXOs", { address, error });
      return [];
    }
  }

  /**
   * Invalidate UTXO cache for an address (call after TX broadcast)
   */
  async invalidateUtxoCache(address: string): Promise<void> {
    const cacheKey = this.cacheKey("utxos", address);
    this.memCache.delete(cacheKey);

    if (this.kv) {
      try {
        await this.kv.delete(cacheKey);
      } catch {
        // Ignore KV errors
      }
    }
  }

  /**
   * Get address balance (uses UTXO cache)
   */
  async getAddressBalance(address: string): Promise<{
    confirmed: number;
    unconfirmed: number;
  }> {
    try {
      const data = await this.fetchWithRetry<{
        address: string;
        chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
        mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
      }>(`/address/${address}`);

      if (!data) {
        return { confirmed: 0, unconfirmed: 0 };
      }

      return {
        confirmed:
          data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum,
        unconfirmed:
          data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
      };
    } catch (error) {
      claimLogger.error("Failed to get address balance", { address, error });
      return { confirmed: 0, unconfirmed: 0 };
    }
  }

  /**
   * Broadcast a raw transaction (invalidates UTXO cache)
   */
  async broadcastTransaction(
    txHex: string,
    senderAddress?: string,
  ): Promise<string> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT_MS,
      );

      const response = await fetch(`${this.baseUrl}/tx`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: txHex,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Broadcast failed: ${response.status} - ${errorText}`);
      }

      const txid = await response.text();
      claimLogger.info("Transaction broadcast", { txid });

      // Invalidate UTXO cache for sender
      if (senderAddress) {
        await this.invalidateUtxoCache(senderAddress);
      }

      return txid;
    } catch (error) {
      claimLogger.error("Failed to broadcast transaction", { error });
      throw error;
    }
  }

  /**
   * Get recommended fee rates (cached)
   */
  async getFeeEstimates(): Promise<FeeRates> {
    const cacheKey = this.cacheKey("fees", "recommended");

    const cached = await this.getFromCache<FeeRates>(cacheKey);
    if (cached) return cached;

    const defaultFees: FeeRates = {
      fastestFee: 10,
      halfHourFee: 5,
      hourFee: 3,
      economyFee: 2,
      minimumFee: 1,
    };

    try {
      const fees = await this.fetchWithRetry<FeeRates>("/v1/fees/recommended");
      const result = fees ?? defaultFees;

      await this.setInCache(cacheKey, result, CACHE_TTL.FEE_RATES);
      return result;
    } catch {
      return defaultFees;
    }
  }

  /**
   * Get cache stats (for monitoring)
   */
  getCacheStats(): { memorySize: number; network: string } {
    return {
      memorySize: this.memCache.size,
      network: this.network,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async fetchWithRetry<T>(endpoint: string): Promise<T | null> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          REQUEST_TIMEOUT_MS,
        );

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 404) return null;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < MAX_RETRIES) {
          await this.sleep(RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let mempoolServiceInstance: MempoolService | null = null;

/**
 * Get or create the mempool service instance
 */
export function getMempoolService(
  network: "mainnet" | "testnet" | "testnet4" = "testnet4",
): MempoolService {
  if (!mempoolServiceInstance) {
    mempoolServiceInstance = new MempoolService(network);
  }
  return mempoolServiceInstance;
}

/**
 * Initialize mempool service with KV caching
 */
export function initMempoolService(
  network: "mainnet" | "testnet" | "testnet4",
  kv: KVNamespace | null,
): IMempoolService {
  const service = getMempoolService(network);
  service.setKV(kv);
  return service;
}
