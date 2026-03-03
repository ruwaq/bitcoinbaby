/**
 * Mining Configuration Constants
 *
 * Centralized configuration for mining operations.
 * Change values here to affect all mining components.
 *
 * @see packages/core/src/mining/ for mining implementation
 */

/**
 * Throttle percentages for different power states
 * 100 = full power, 50 = half power, etc.
 */
export const THROTTLE_LEVELS = {
  /** Full power - when plugged in and visible */
  full: 100,

  /** Battery saver - when on battery */
  battery: 50,

  /** Low battery - when battery < 20% */
  lowBattery: 25,

  /** Background - when tab is hidden */
  hidden: 10,
} as const;

/**
 * WebGPU batch timing configuration
 */
export const BATCH_CONFIG = {
  /** Target milliseconds per batch (affects responsiveness) */
  targetBatchMs: 50,

  /** Minimum batch size */
  minBatchSize: 1024,

  /** Maximum batch size */
  maxBatchSize: 1024 * 1024,

  /** Batch size growth factor */
  growthFactor: 1.5,

  /** Batch size shrink factor */
  shrinkFactor: 0.75,
} as const;

/**
 * Mining recovery configuration
 */
export const RECOVERY_CONFIG = {
  /** Maximum recovery attempts before giving up */
  maxAttempts: 5,

  /** Base delay for exponential backoff (ms) */
  baseDelay: 1000,

  /** Maximum delay between recovery attempts (ms) */
  maxDelay: 30000,

  /** Calculate backoff delay for recovery attempt */
  getBackoffDelay: (attempt: number): number => {
    const delay = Math.min(
      RECOVERY_CONFIG.baseDelay * Math.pow(2, attempt),
      RECOVERY_CONFIG.maxDelay,
    );
    // Add 10% jitter
    return delay + delay * 0.1 * Math.random();
  },
} as const;

/**
 * Stats update configuration
 */
export const STATS_CONFIG = {
  /** Minimum hashes between stats updates */
  updateThreshold: 1000,

  /** Hashrate calculation window (ms) */
  hashrateWindow: 1000,

  /** Throttle interval for UI updates (ms) */
  uiThrottleHashrate: 500,

  /** Throttle interval for share count updates (ms) */
  uiThrottleShares: 1000,
} as const;

/**
 * Persistence configuration
 */
export const PERSISTENCE_CONFIG = {
  /** Maximum sessions to keep in localStorage */
  maxSessions: 100,

  /** Default limit for getRecentSessions */
  defaultSessionLimit: 1000,
} as const;

/**
 * Tab coordination configuration
 */
export const TAB_COORDINATION = {
  /** Heartbeat interval for leader election (ms) */
  heartbeatInterval: 5000,

  /** Leadership timeout - consider dead after this (ms) */
  leadershipTimeout: 10000,
} as const;
