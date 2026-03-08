/**
 * @fileoverview Request Deduplication - Prevent duplicate API calls
 *
 * Centralizes request deduplication to prevent race conditions
 * and reduce unnecessary API calls.
 *
 * @module @bitcoinbaby/shared/utils/request-dedup
 */

export interface RequestEntry<T> {
  promise: Promise<T>;
  timestamp: number;
  requestId: number;
}

export interface RequestDeduplicatorOptions {
  /** Time in ms before a completed request can be re-executed (default: 0 = no cache) */
  cacheDuration?: number;
  /** Called when a duplicate request is deduplicated */
  onDedupe?: (key: string) => void;
}

/**
 * Request deduplicator to prevent concurrent duplicate requests.
 *
 * @example
 * ```typescript
 * const fetcher = new RequestDeduplicator<Balance>();
 *
 * // These will share the same request:
 * const balance1 = fetcher.execute('balance-abc123', () => api.getBalance('abc123'));
 * const balance2 = fetcher.execute('balance-abc123', () => api.getBalance('abc123'));
 *
 * balance1 === balance2 // true - same promise
 * ```
 */
export class RequestDeduplicator<T> {
  private pending = new Map<string, RequestEntry<T>>();
  private cache = new Map<string, { value: T; timestamp: number }>();
  private requestCounter = 0;
  private readonly cacheDuration: number;
  private readonly onDedupe?: (key: string) => void;

  constructor(options: RequestDeduplicatorOptions = {}) {
    this.cacheDuration = options.cacheDuration ?? 0;
    this.onDedupe = options.onDedupe;
  }

  /**
   * Execute a request, deduplicating if an identical request is in flight.
   *
   * @param key - Unique key for this request
   * @param fn - Function that returns a promise
   * @returns Promise that resolves with the request result
   */
  async execute(key: string, fn: () => Promise<T>): Promise<T> {
    // Check cache first
    if (this.cacheDuration > 0) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
        return cached.value;
      }
    }

    // Return existing in-flight request
    const existing = this.pending.get(key);
    if (existing) {
      this.onDedupe?.(key);
      return existing.promise;
    }

    // Create new request
    const requestId = ++this.requestCounter;
    const promise = fn()
      .then((result) => {
        // Cache result if caching is enabled
        if (this.cacheDuration > 0) {
          this.cache.set(key, { value: result, timestamp: Date.now() });
        }
        return result;
      })
      .finally(() => {
        // Only remove if this is still the current request
        const current = this.pending.get(key);
        if (current?.requestId === requestId) {
          this.pending.delete(key);
        }
      });

    this.pending.set(key, { promise, timestamp: Date.now(), requestId });
    return promise;
  }

  /**
   * Get the request ID for a given key.
   * Useful for detecting stale responses.
   */
  getRequestId(key: string): number | undefined {
    return this.pending.get(key)?.requestId;
  }

  /**
   * Check if this response is from the latest request.
   */
  isLatestRequest(key: string, requestId: number): boolean {
    const current = this.pending.get(key);
    return !current || current.requestId === requestId;
  }

  /**
   * Cancel a pending request (prevents callback execution).
   */
  cancel(key: string): void {
    this.pending.delete(key);
  }

  /**
   * Cancel all pending requests.
   */
  cancelAll(): void {
    this.pending.clear();
  }

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the number of pending requests.
   */
  get pendingCount(): number {
    return this.pending.size;
  }

  /**
   * Check if a request is pending.
   */
  isPending(key: string): boolean {
    return this.pending.has(key);
  }
}

/**
 * Create a request deduplicator instance.
 */
export function createRequestDeduplicator<T>(
  options?: RequestDeduplicatorOptions,
): RequestDeduplicator<T> {
  return new RequestDeduplicator<T>(options);
}

// ============================================================================
// Specialized Deduplicators for BitcoinBaby
// ============================================================================

/**
 * Deduplicator for balance fetches.
 * Caches for 5 seconds to reduce API spam.
 */
export function createBalanceDeduplicator() {
  return new RequestDeduplicator<{
    confirmed: number;
    unconfirmed: number;
    total: number;
  }>({
    cacheDuration: 5000,
    onDedupe: (key) => console.debug(`[BalanceFetcher] Deduplicated: ${key}`),
  });
}

/**
 * Deduplicator for UTXO fetches.
 * No caching as UTXOs can change rapidly.
 */
export function createUTXODeduplicator() {
  return new RequestDeduplicator<
    Array<{
      txid: string;
      vout: number;
      value: number;
      status?: { spent?: boolean };
    }>
  >({
    cacheDuration: 0,
    onDedupe: (key) => console.debug(`[UTXOFetcher] Deduplicated: ${key}`),
  });
}

/**
 * Deduplicator for NFT fetches.
 * Caches for 30 seconds as NFTs don't change often.
 */
export function createNFTDeduplicator() {
  return new RequestDeduplicator<
    Array<{
      id: string;
      name: string;
      rarity: string;
      boost: number;
    }>
  >({
    cacheDuration: 30000,
    onDedupe: (key) => console.debug(`[NFTFetcher] Deduplicated: ${key}`),
  });
}

/**
 * Deduplicator for fee estimates.
 * Caches for 60 seconds as fee rates update slowly.
 */
export function createFeeEstimateDeduplicator() {
  return new RequestDeduplicator<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
  }>({
    cacheDuration: 60000,
    onDedupe: (key) => console.debug(`[FeeEstimate] Deduplicated: ${key}`),
  });
}
