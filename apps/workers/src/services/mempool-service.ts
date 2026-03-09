/**
 * Mempool Service
 *
 * Verifies Bitcoin transactions on-chain via Mempool.space API.
 * Used to verify claim transactions before minting.
 */

import { claimLogger } from "../lib/logger";

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

// =============================================================================
// CONSTANTS
// =============================================================================

/** Mempool.space API base URLs */
const MEMPOOL_API_URLS = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
};

/** Request timeout */
const REQUEST_TIMEOUT_MS = 10_000;

/** Retry configuration */
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// MEMPOOL SERVICE
// =============================================================================

export class MempoolService {
  private baseUrl: string;
  private currentBlockHeight: number | null = null;
  private blockHeightCacheTime: number = 0;
  private readonly BLOCK_HEIGHT_CACHE_MS = 60_000; // 1 minute cache

  constructor(network: "mainnet" | "testnet" | "testnet4" = "testnet4") {
    this.baseUrl = MEMPOOL_API_URLS[network];
  }

  /**
   * Verify a transaction exists and get its status
   */
  async verifyTransaction(txid: string): Promise<TxVerificationResult> {
    // Validate txid format
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return {
        exists: false,
        confirmed: false,
        confirmations: 0,
        error: "Invalid txid format",
      };
    }

    try {
      const txInfo = await this.fetchWithRetry<MempoolTxInfo>(`/tx/${txid}`);

      if (!txInfo) {
        return {
          exists: false,
          confirmed: false,
          confirmations: 0,
        };
      }

      // Get current block height for confirmations
      const currentHeight = await this.getCurrentBlockHeight();
      const confirmations =
        txInfo.status.confirmed && txInfo.status.block_height
          ? Math.max(0, currentHeight - txInfo.status.block_height + 1)
          : 0;

      return {
        exists: true,
        confirmed: txInfo.status.confirmed,
        confirmations,
        blockHeight: txInfo.status.block_height,
      };
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
   * @param txid Transaction ID
   * @param requiredConfirmations Minimum confirmations (default: 1)
   * @param timeoutMs Maximum wait time (default: 10 minutes)
   */
  async waitForConfirmation(
    txid: string,
    requiredConfirmations: number = 1,
    timeoutMs: number = 600_000,
  ): Promise<TxVerificationResult> {
    const startTime = Date.now();
    const pollInterval = 30_000; // Poll every 30 seconds

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.verifyTransaction(txid);

      if (result.confirmations >= requiredConfirmations) {
        return result;
      }

      if (!result.exists) {
        // Transaction not found - might still be propagating
        claimLogger.info("TX not found yet, waiting...", { txid });
      }

      // Wait before next poll
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
    const now = Date.now();

    // Return cached value if fresh
    if (
      this.currentBlockHeight !== null &&
      now - this.blockHeightCacheTime < this.BLOCK_HEIGHT_CACHE_MS
    ) {
      return this.currentBlockHeight;
    }

    try {
      const height = await this.fetchWithRetry<number>("/blocks/tip/height");
      if (height !== null) {
        this.currentBlockHeight = height;
        this.blockHeightCacheTime = now;
        return height;
      }
    } catch (error) {
      claimLogger.error("Failed to get block height", { error });
    }

    // Return cached value even if stale, or 0 if no cache
    return this.currentBlockHeight ?? 0;
  }

  /**
   * Get raw transaction hex
   */
  async getTransactionHex(txid: string): Promise<string | null> {
    // Validate txid format
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

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.text();
    } catch (error) {
      claimLogger.error("Failed to get transaction hex", { txid, error });
      return null;
    }
  }

  /**
   * Get recommended fee rates
   */
  async getFeeRates(): Promise<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  }> {
    try {
      const fees = await this.fetchWithRetry<{
        fastestFee: number;
        halfHourFee: number;
        hourFee: number;
        economyFee: number;
        minimumFee: number;
      }>("/v1/fees/recommended");

      return (
        fees ?? {
          fastestFee: 10,
          halfHourFee: 5,
          hourFee: 3,
          economyFee: 2,
          minimumFee: 1,
        }
      );
    } catch {
      // Return defaults on error
      return {
        fastestFee: 10,
        halfHourFee: 5,
        hourFee: 3,
        economyFee: 2,
        minimumFee: 1,
      };
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Fetch with retry logic
   */
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

        if (response.status === 404) {
          return null;
        }

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
