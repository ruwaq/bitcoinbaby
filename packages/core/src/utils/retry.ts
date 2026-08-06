/**
 * Retry Logic with Exponential Backoff
 *
 * Production-grade retry system for network operations.
 * Implements exponential backoff, jitter, and circuit breaker patterns.
 */

import { AppError, NetworkError, ErrorCode, wrapError } from "./errors";

// =============================================================================
// TYPES
// =============================================================================

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to delays (default: true) */
  jitter?: boolean;
  /** Timeout per attempt in ms (default: 30000) */
  timeout?: number;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: AppError) => boolean;
  /** Callback when retrying */
  onRetry?: (attempt: number, error: AppError, delay: number) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: AppError;
  attempts: number;
  totalTime: number;
}

// =============================================================================
// DEFAULT OPTIONS
// =============================================================================

const DEFAULT_RETRY_OPTIONS: Required<
  Omit<RetryOptions, "signal" | "onRetry" | "isRetryable">
> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeout: 30000,
};

// =============================================================================
// RETRY FUNCTION
// =============================================================================

/**
 * Execute a function with automatic retries and exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchData(),
 *   {
 *     maxRetries: 3,
 *     initialDelay: 1000,
 *     onRetry: (attempt, error, delay) => {
 *       console.log(`Retry ${attempt} in ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: AppError | undefined;
  let attempt = 0;

  while (attempt <= opts.maxRetries) {
    // Check for cancellation
    if (opts.signal?.aborted) {
      return {
        success: false,
        error: new NetworkError("Operation cancelled", {
          code: ErrorCode.NETWORK_ERROR,
        }),
        attempts: attempt,
        totalTime: Date.now() - startTime,
      };
    }

    try {
      // Execute with timeout
      const data = await withTimeout(fn(), opts.timeout, opts.signal);

      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = wrapError(error);
      attempt++;

      // Check if we should retry
      const shouldRetry = opts.isRetryable
        ? opts.isRetryable(lastError)
        : lastError.retryable;

      if (attempt > opts.maxRetries || !shouldRetry) {
        break;
      }

      // Calculate delay with exponential backoff
      const baseDelay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay,
      );

      // Add jitter (0.5x to 1.5x)
      const delay = opts.jitter
        ? Math.floor(baseDelay * (0.5 + Math.random()))
        : baseDelay;

      // Notify retry callback
      opts.onRetry?.(attempt, lastError, delay);

      // Wait before retrying
      await sleep(delay, opts.signal);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: attempt,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Execute with retry, throwing on failure
 */
export async function retryOrThrow<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const result = await retry(fn, options);

  if (!result.success) {
    throw result.error ?? new AppError(ErrorCode.UNKNOWN_ERROR, "Retry failed");
  }

  return result.data as T;
}

// =============================================================================
// CIRCUIT BREAKER
// =============================================================================

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms to wait before attempting to close circuit (default: 60000) */
  resetTimeout?: number;
  /** Time window for counting failures in ms (default: 60000) */
  failureWindow?: number;
}

type CircuitState = "closed" | "open" | "half-open";

interface CircuitBreakerState {
  state: CircuitState;
  failures: number[];
  lastFailure: number;
  lastStateChange: number;
}

/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures by temporarily stopping requests
 * to a failing service.
 *
 * @example
 * ```typescript
 * const breaker = createCircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 60000,
 * });
 *
 * try {
 *   const result = await breaker.execute(() => fetchData());
 * } catch (error) {
 *   if (error.code === 'CIRCUIT_OPEN') {
 *     // Service is temporarily unavailable
 *   }
 * }
 * ```
 */
export function createCircuitBreaker(options: CircuitBreakerOptions = {}) {
  const {
    failureThreshold = 5,
    resetTimeout = 60000,
    failureWindow = 60000,
  } = options;

  const state: CircuitBreakerState = {
    state: "closed",
    failures: [],
    lastFailure: 0,
    lastStateChange: Date.now(),
  };

  function cleanOldFailures(): void {
    const cutoff = Date.now() - failureWindow;
    state.failures = state.failures.filter((t) => t > cutoff);
  }

  function recordFailure(): void {
    state.failures.push(Date.now());
    state.lastFailure = Date.now();
    cleanOldFailures();

    if (state.failures.length >= failureThreshold && state.state === "closed") {
      state.state = "open";
      state.lastStateChange = Date.now();
    }
  }

  function recordSuccess(): void {
    if (state.state === "half-open") {
      state.state = "closed";
      state.failures = [];
      state.lastStateChange = Date.now();
    }
  }

  function canAttempt(): boolean {
    if (state.state === "closed") {
      return true;
    }

    if (state.state === "open") {
      // Check if we should try half-open
      if (Date.now() - state.lastStateChange >= resetTimeout) {
        state.state = "half-open";
        state.lastStateChange = Date.now();
        return true;
      }
      return false;
    }

    // half-open: allow single attempt
    return true;
  }

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      if (!canAttempt()) {
        throw new NetworkError("Circuit breaker is open", {
          code: ErrorCode.RATE_LIMITED,
          context: {
            state: state.state,
            failureCount: state.failures.length,
            nextAttemptIn: resetTimeout - (Date.now() - state.lastStateChange),
          },
        });
      }

      try {
        const result = await fn();
        recordSuccess();
        return result;
      } catch (error) {
        recordFailure();
        throw error;
      }
    },

    getState(): CircuitState {
      return state.state;
    },

    getFailureCount(): number {
      cleanOldFailures();
      return state.failures.length;
    },

    reset(): void {
      state.state = "closed";
      state.failures = [];
      state.lastFailure = 0;
      state.lastStateChange = Date.now();
    },
  };
}

// =============================================================================
// RATE LIMITER
// =============================================================================

export interface RateLimiterOptions {
  /** Maximum requests per window (default: 10) */
  maxRequests?: number;
  /** Time window in ms (default: 1000) */
  windowMs?: number;
}

/**
 * Simple sliding window rate limiter
 *
 * @example
 * ```typescript
 * const limiter = createRateLimiter({
 *   maxRequests: 10,
 *   windowMs: 1000,
 * });
 *
 * if (limiter.canProceed()) {
 *   await fetchData();
 * } else {
 *   const waitTime = limiter.getTimeUntilAvailable();
 *   await sleep(waitTime);
 *   await fetchData();
 * }
 * ```
 */
export function createRateLimiter(options: RateLimiterOptions = {}) {
  const { maxRequests = 10, windowMs = 1000 } = options;
  const timestamps: number[] = [];

  function clean(): void {
    const cutoff = Date.now() - windowMs;
    while (timestamps.length > 0 && timestamps[0] < cutoff) {
      timestamps.shift();
    }
  }

  return {
    canProceed(): boolean {
      clean();
      return timestamps.length < maxRequests;
    },

    record(): void {
      timestamps.push(Date.now());
    },

    getTimeUntilAvailable(): number {
      clean();
      if (timestamps.length < maxRequests) {
        return 0;
      }
      return windowMs - (Date.now() - timestamps[0]);
    },

    async waitAndProceed(): Promise<void> {
      const waitTime = this.getTimeUntilAvailable();
      if (waitTime > 0) {
        await sleep(waitTime);
      }
      this.record();
    },

    getRemainingRequests(): number {
      clean();
      return Math.max(0, maxRequests - timestamps.length);
    },
  };
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Sleep with optional abort signal
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new NetworkError("Operation cancelled"));
      return;
    }

    const timeout = setTimeout(resolve, ms);

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new NetworkError("Operation cancelled"));
    });
  });
}

/**
 * Execute promise with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new NetworkError("Operation timed out", {
          code: ErrorCode.NETWORK_TIMEOUT,
          context: { timeout: timeoutMs },
        }),
      );
    }, timeoutMs);

    if (signal?.aborted) {
      clearTimeout(timeout);
      reject(new NetworkError("Operation cancelled"));
      return;
    }

    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new NetworkError("Operation cancelled"));
    });

    promise
      .then((result) => {
        clearTimeout(timeout);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeout);
        reject(error);
      });
  });
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let lastCall = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      fn(...args);
    }
  };
}
