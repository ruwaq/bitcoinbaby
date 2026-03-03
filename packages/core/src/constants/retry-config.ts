/**
 * Retry & Backoff Configuration
 *
 * Centralized retry delays for network operations.
 * All values in milliseconds.
 */

/**
 * Default retry delays for API calls
 * Used for NFT sync, balance refresh, etc.
 */
export const RETRY_DELAYS = {
  /** Quick retries for transient errors */
  quick: [1000, 2000, 5000] as const,

  /** Standard retries for most operations */
  standard: [2000, 5000, 10000, 20000] as const,

  /** Extended retries for critical operations */
  extended: [1000, 5000, 15000, 60000, 300000] as const, // Up to 5 min

  /** Aggressive backoff for rate-limited operations */
  rateLimit: [1000, 5000, 15000, 60000, 300000, 900000, 3600000] as const, // Up to 1 hr
} as const;

/**
 * Circuit breaker delays
 * Progressive cooldown when service is unhealthy
 */
export const CIRCUIT_BREAKER_DELAYS = [
  30_000, // 30 seconds
  60_000, // 1 minute
  120_000, // 2 minutes
  300_000, // 5 minutes
  600_000, // 10 minutes
] as const;

/**
 * Get delay for a specific retry attempt
 */
export function getRetryDelay(
  attempt: number,
  delays: readonly number[] = RETRY_DELAYS.standard,
): number {
  return delays[Math.min(attempt, delays.length - 1)];
}

/**
 * Calculate exponential backoff with jitter
 */
export function exponentialBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 60000,
): number {
  const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
  // Add 10-20% jitter to prevent thundering herd
  const jitter = delay * (0.1 + Math.random() * 0.1);
  return Math.floor(delay + jitter);
}
