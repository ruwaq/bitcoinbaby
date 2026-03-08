/**
 * Utilities Module
 *
 * @example
 * import { sleep, retry, formatHashrate } from '@bitcoinbaby/shared/utils';
 */

// Timing
export { sleep, withTimeout, debounce, throttle, retry } from "./timing";

// JSON
export {
  safeJsonParse,
  parseJsonWithBigInt,
  safeParseJsonWithBigInt,
  stringifyWithBigInt,
  deepClone,
  isValidJson,
} from "./json";

// Formatting
export {
  formatNumber,
  formatHashrate,
  formatBytes,
  formatBtc,
  formatSatoshis,
  formatDuration,
  truncate,
  formatAddress,
  formatTxid,
  formatRelativeTime,
} from "./format";

// Hashing (Bitcoin standard double SHA-256)
export {
  hash256,
  countLeadingZeroBits,
  meetsDifficulty,
  HASH256_TEST_VECTORS,
  verifyHash256Implementation,
} from "./hash256";

// State Machine
export {
  createStateMachine,
  createWalletStateMachine,
  createTxStateMachine,
  createMiningStateMachine,
  WALLET_STATE_CONFIG,
  TX_STATE_CONFIG,
  MINING_STATE_CONFIG,
} from "./state-machine";
export type {
  StateConfig,
  StateMachineConfig,
  StateMachineInstance,
  WalletState,
  WalletEvent,
  TxState,
  TxEvent,
  MiningState,
  MiningEvent,
} from "./state-machine";

// Timeout Manager
export {
  TimeoutManager,
  createTimeoutManager,
  TIMEOUTS,
  getTimeout,
} from "./timeout-manager";
export type {
  TimeoutEntry,
  TimeoutManagerOptions,
  TimeoutKey,
} from "./timeout-manager";

// Request Deduplication
export {
  RequestDeduplicator,
  createRequestDeduplicator,
  createBalanceDeduplicator,
  createUTXODeduplicator,
  createNFTDeduplicator,
  createFeeEstimateDeduplicator,
} from "./request-dedup";
export type { RequestEntry, RequestDeduplicatorOptions } from "./request-dedup";

// Sanitization
export {
  sanitizeSVG,
  escapeHTML,
  sanitizeURL,
  sanitizeRPCUrl,
  sanitizeForLog,
  truncateForLog,
  maskAddress,
  maskTxid,
} from "./sanitize";
