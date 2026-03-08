/**
 * Core Utilities
 *
 * Production-grade utilities for error handling, retry logic,
 * logging, and transaction tracking.
 */

// Error System
export {
  ErrorCode,
  AppError,
  NetworkError,
  WalletError,
  TransactionError,
  MiningError,
  ValidationError,
  isAppError,
  wrapError,
  createNetworkError,
  tryCatch,
  tryCatchSync,
  type ErrorCodeType,
  type ErrorDetails,
} from "./errors";

// Retry & Rate Limiting
export {
  retry,
  retryOrThrow,
  createCircuitBreaker,
  createRateLimiter,
  sleep,
  withTimeout,
  debounce,
  throttle,
  type RetryOptions,
  type RetryResult,
  type CircuitBreakerOptions,
  type RateLimiterOptions,
} from "./retry";

// Logger
export {
  Logger,
  createLogger,
  getLogger,
  configureLogger,
  logDebug,
  logInfo,
  logWarn,
  logError,
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
} from "./logger";

// Transaction Tracker
export {
  TxTracker,
  createTxTracker,
  type TxStatus,
  type TrackedTransaction,
  type TxTrackerEvents,
  type TxTrackerOptions,
  type TxApiResponse,
} from "./tx-tracker";

// Formatting Utilities
export {
  formatHashrate,
  formatTotal,
  formatDuration,
  formatTime,
  formatBytes,
} from "./format";

// Wallet Guards
export {
  canRead,
  canSign,
  canTransact,
  createWalletGuard,
  assertCanSign,
  assertCanTransact,
  type WalletState as WalletGuardState,
  type WalletGuardResult,
} from "./wallet-guards";
