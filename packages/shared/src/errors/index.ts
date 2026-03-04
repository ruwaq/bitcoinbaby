/**
 * Unified Error System
 *
 * @example
 * import { NetworkError, ValidationError, wrapError } from '@bitcoinbaby/shared/errors';
 *
 * try {
 *   await fetchData();
 * } catch (error) {
 *   const appError = wrapError(error);
 *   if (appError.isRetryable) {
 *     // Retry logic
 *   }
 * }
 */

// Base - import AppError as value for instanceof checks
import { AppError as AppErrorClass } from "./base";
export { AppError, UnknownError, wrapError, type ErrorContext } from "./base";

// Network
export {
  NetworkError,
  TimeoutError,
  RateLimitError,
  ApiError,
  ConnectionError,
} from "./network";

// Validation
export {
  ValidationError,
  FormatError,
  RequiredFieldError,
  RangeError,
} from "./validation";

// Wallet
export {
  WalletError,
  WalletNotFoundError,
  InvalidMnemonicError,
  InvalidAddressError,
  TransactionError,
  InsufficientFundsError,
  SigningError,
  BroadcastError,
} from "./wallet";

// Mining
export {
  MiningError,
  InvalidProofError,
  DuplicateProofError,
  MiningRateLimitError,
  MiningBackendError,
  WebGPUNotSupportedError,
} from "./mining";

// Type guard helpers
export function isAppError(
  error: unknown,
): error is InstanceType<typeof AppErrorClass> {
  return error instanceof AppErrorClass;
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppErrorClass) {
    return error.isRetryable;
  }
  return false;
}

export function getRetryDelay(error: unknown): number | undefined {
  if (error instanceof AppErrorClass) {
    return error.retryAfter;
  }
  return undefined;
}
