/**
 * Polling & Interval Configuration
 *
 * Centralized timing values for background operations.
 * All values in milliseconds.
 */

/**
 * Sync intervals for mining operations
 */
export const SYNC_INTERVALS = {
  /** Share sync to server */
  shareSync: 3_000, // 3 seconds

  /** Health check for connections */
  healthCheck: 30_000, // 30 seconds

  /** Balance refresh */
  balanceRefresh: 60_000, // 1 minute

  /** Pool status refresh */
  poolRefresh: 120_000, // 2 minutes

  /** NFT data refresh */
  nftRefresh: 120_000, // 2 minutes

  /** Fee estimates refresh */
  feeRefresh: 30_000, // 30 seconds

  /** Block height refresh */
  blockHeightRefresh: 60_000, // 1 minute
} as const;

/**
 * UI timing values
 */
export const UI_TIMING = {
  /** Toast/notification display time */
  toastDuration: 5_000, // 5 seconds

  /** Copy confirmation feedback */
  copyFeedback: 2_000, // 2 seconds

  /** Debounce for rapid events */
  debounce: 500, // 500ms

  /** Animation transitions */
  transition: 150, // 150ms

  /** Loading state minimum display */
  loadingMinDisplay: 300, // 300ms
} as const;

/**
 * Network timeouts
 */
export const TIMEOUTS = {
  /** API request timeout */
  apiRequest: 30_000, // 30 seconds

  /** Transaction broadcast timeout */
  txBroadcast: 30_000, // 30 seconds

  /** WebSocket connection timeout */
  wsConnect: 10_000, // 10 seconds

  /** Wallet operation timeout */
  walletOp: 60_000, // 1 minute
} as const;
