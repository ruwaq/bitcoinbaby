/**
 * API Response Cache
 *
 * LRU cache for API responses with TTL support.
 * Used to reduce redundant API calls for frequently accessed data.
 *
 * @example
 * const cache = new ApiCache({ maxSize: 100, defaultTTL: 30_000 });
 * cache.set('balance:bc1...', balanceResponse);
 * const cached = cache.get('balance:bc1...');
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CacheOptions {
  /** Maximum number of entries (default: 100) */
  maxSize?: number;
  /** Default TTL in milliseconds (default: 30 seconds) */
  defaultTTL?: number;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// =============================================================================
// LRU CACHE
// =============================================================================

export class ApiCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private readonly maxSize: number;
  private readonly defaultTTL: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 100;
    this.defaultTTL = options.defaultTTL ?? 30_000;
  }

  /**
   * Get cached value if exists and not expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set cached value with optional TTL
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    });
  }

  /**
   * Delete a cached entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear entries matching a pattern
   */
  invalidate(pattern: string | RegExp): number {
    let count = 0;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    return count;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  stats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  /**
   * Get or fetch pattern - cache miss will call fetcher
   */
  async getOrFetch<V extends T>(
    key: string,
    fetcher: () => Promise<V>,
    ttl?: number,
  ): Promise<V> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached as V;
    }

    const value = await fetcher();
    this.set(key, value, ttl);
    return value;
  }
}

// =============================================================================
// CACHE KEYS
// =============================================================================

/**
 * Standard cache key generators for consistency
 */
export const CacheKeys = {
  balance: (address: string) => `balance:${address}`,
  nftOwned: (address: string) => `nft:owned:${address}`,
  nftSingle: (tokenId: number) => `nft:${tokenId}`,
  nftStats: () => "nft:stats",
  leaderboard: (category: string, period: string) =>
    `leaderboard:${category}:${period}`,
  userRank: (address: string, category: string, period: string) =>
    `rank:${address}:${category}:${period}`,
  userStats: (address: string) => `stats:${address}`,
  listings: () => "marketplace:listings",
  explorer: (query: string) => `explorer:${query}`,
} as const;

// =============================================================================
// TTL PRESETS
// =============================================================================

/**
 * TTL presets for different data types
 */
export const CacheTTL = {
  /** Very short-lived data (5 seconds) */
  VOLATILE: 5_000,
  /** Short-lived data (15 seconds) */
  SHORT: 15_000,
  /** Standard cache (30 seconds) */
  STANDARD: 30_000,
  /** Longer cache (1 minute) */
  MEDIUM: 60_000,
  /** Long cache (5 minutes) */
  LONG: 300_000,
  /** Static data (15 minutes) */
  STATIC: 900_000,
} as const;

// =============================================================================
// SINGLETON
// =============================================================================

let globalCache: ApiCache | null = null;

/**
 * Get global API cache singleton
 */
export function getApiCache(): ApiCache {
  if (!globalCache) {
    globalCache = new ApiCache({
      maxSize: 200,
      defaultTTL: CacheTTL.STANDARD,
    });
  }
  return globalCache;
}
