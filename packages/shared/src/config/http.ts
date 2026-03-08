/**
 * HTTP Client Configuration
 *
 * Centralized configuration for HTTP requests including
 * timeouts, retries, and backoff settings.
 */

// =============================================================================
// TIMEOUT DEFAULTS
// =============================================================================

/**
 * Standard HTTP request timeouts (in milliseconds)
 */
export const HTTP_TIMEOUTS = {
  /** Quick requests (balance checks, simple GETs) */
  SHORT: 5_000,
  /** Standard API calls */
  STANDARD: 10_000,
  /** Longer operations (file uploads, complex queries) */
  LONG: 30_000,
  /** Very long operations (mining proof submissions) */
  EXTENDED: 60_000,
  /** Maximum for prover operations */
  PROVER: 120_000,
  /** Transaction confirmation polling */
  CONFIRMATION: 600_000,
} as const;

// =============================================================================
// RETRY CONFIGURATION
// =============================================================================

/**
 * Retry configuration for HTTP requests
 */
export const RETRY_CONFIG = {
  /** Maximum number of retries for standard requests */
  MAX_RETRIES: 3,
  /** Maximum retries for critical operations */
  MAX_RETRIES_CRITICAL: 5,
  /** Base delay for exponential backoff (ms) */
  BASE_DELAY: 1_000,
  /** Maximum delay between retries (ms) */
  MAX_DELAY: 30_000,
  /** Backoff multiplier */
  BACKOFF_FACTOR: 2,
} as const;

/**
 * No-retry configuration for atomic/critical operations
 */
export const NO_RETRY = {
  MAX_RETRIES: 0,
  BASE_DELAY: 0,
  MAX_DELAY: 0,
  BACKOFF_FACTOR: 1,
} as const;

// =============================================================================
// RATE LIMITING
// =============================================================================

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT = {
  /** Maximum requests per second */
  MAX_RPS: 10,
  /** Burst allowance */
  BURST: 5,
  /** Delay between retries after rate limit (ms) */
  RETRY_DELAY: 1_000,
} as const;

// =============================================================================
// POLLING INTERVALS
// =============================================================================

/**
 * Standard polling intervals (in milliseconds)
 */
export const POLL_INTERVALS = {
  /** Fast polling (balance, hashrate) */
  FAST: 5_000,
  /** Standard polling (leaderboard, stats) */
  STANDARD: 30_000,
  /** Slow polling (transaction confirmations) */
  SLOW: 60_000,
  /** Very slow polling (background sync) */
  BACKGROUND: 300_000,
  /** Mining transaction confirmation */
  TX_CONFIRMATION: 10_000,
} as const;

// =============================================================================
// CACHE DURATIONS
// =============================================================================

/**
 * Cache TTL values (in milliseconds)
 */
export const CACHE_TTL = {
  /** Volatile data (real-time metrics) */
  VOLATILE: 5_000,
  /** Short-lived data (balance, recent txs) */
  SHORT: 15_000,
  /** Standard cache duration */
  STANDARD: 30_000,
  /** Medium duration (leaderboard) */
  MEDIUM: 60_000,
  /** Long duration (NFT metadata) */
  LONG: 300_000,
  /** Static data (rarely changes) */
  STATIC: 900_000,
} as const;

// =============================================================================
// DEFAULT HTTP CONFIG
// =============================================================================

/**
 * Default HTTP client configuration
 */
export const DEFAULT_HTTP_CONFIG = {
  timeout: HTTP_TIMEOUTS.STANDARD,
  maxRetries: RETRY_CONFIG.MAX_RETRIES,
  retryDelay: RETRY_CONFIG.BASE_DELAY,
  headers: {
    "Content-Type": "application/json",
  },
} as const;

/**
 * Configuration for atomic operations (no retries)
 */
export const ATOMIC_HTTP_CONFIG = {
  ...DEFAULT_HTTP_CONFIG,
  maxRetries: NO_RETRY.MAX_RETRIES,
} as const;

/**
 * Configuration for long-running operations
 */
export const LONG_HTTP_CONFIG = {
  ...DEFAULT_HTTP_CONFIG,
  timeout: HTTP_TIMEOUTS.EXTENDED,
  maxRetries: RETRY_CONFIG.MAX_RETRIES_CRITICAL,
} as const;
