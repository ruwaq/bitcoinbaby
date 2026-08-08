/**
 * Production Utilities Tests
 *
 * Tests for error handling, retry logic, logging, and transaction tracking.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Errors
  AppError,
  NetworkError,
  WalletError,
  TransactionError,
  MiningError,
  ValidationError,
  ErrorCode,
  isAppError,
  wrapError,
  tryCatch,
  tryCatchSync,

  // Retry
  retry,
  retryOrThrow,
  createCircuitBreaker,
  createRateLimiter,
  withTimeout,
  debounce,
  throttle,

  // Logger
  Logger,
  createLogger,

  // Transaction Tracker
  TxTracker,
  createTxTracker,
} from "../src/utils";

// =============================================================================
// ERROR SYSTEM TESTS
// =============================================================================

describe("Error System", () => {
  describe("AppError", () => {
    it("should create error with code and message", () => {
      const error = new AppError(ErrorCode.NETWORK_ERROR, "Connection failed");

      expect(error.code).toBe(ErrorCode.NETWORK_ERROR);
      expect(error.message).toBe("Connection failed");
      expect(error.timestamp).toBeGreaterThan(0);
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(false);
    });

    it("should include context", () => {
      const error = new AppError(ErrorCode.API_ERROR, "API failed", {
        context: { endpoint: "/api/test", status: 500 },
      });

      expect(error.context).toEqual({ endpoint: "/api/test", status: 500 });
    });

    it("should chain cause", () => {
      const cause = new Error("Original error");
      const error = new AppError(ErrorCode.UNKNOWN_ERROR, "Wrapped", { cause });

      expect(error.cause).toBe(cause);
    });

    it("should serialize to JSON", () => {
      const error = new AppError(ErrorCode.VALIDATION_ERROR, "Invalid input");
      const json = error.toJSON();

      expect(json.code).toBe(ErrorCode.VALIDATION_ERROR);
      expect(json.message).toBe("Invalid input");
      expect(json.timestamp).toBeGreaterThan(0);
    });

    it("should generate user-friendly messages", () => {
      const error = new AppError(ErrorCode.WALLET_LOCKED, "Technical message");
      const userMessage = error.toUserMessage();

      expect(userMessage).toBe("Wallet is locked. Please unlock to continue.");
    });
  });

  describe("Specialized Errors", () => {
    it("NetworkError should be retryable", () => {
      const error = new NetworkError("Connection timeout");
      expect(error.retryable).toBe(true);
    });

    it("NetworkError should include status code", () => {
      const error = new NetworkError("Server error", {
        statusCode: 500,
        url: "https://api.example.com",
      });

      expect(error.statusCode).toBe(500);
      expect(error.url).toBe("https://api.example.com");
    });

    it("WalletError should not be retryable", () => {
      const error = new WalletError(
        ErrorCode.INSUFFICIENT_BALANCE,
        "Not enough funds",
      );
      expect(error.retryable).toBe(false);
    });

    it("TransactionError should include txid", () => {
      const error = new TransactionError(
        ErrorCode.TX_BUILD_FAILED,
        "Failed to build",
        { txid: "abc123" },
      );
      expect(error.txid).toBe("abc123");
    });

    it("MiningError should be recoverable", () => {
      const error = new MiningError(ErrorCode.WORKER_ERROR, "Worker crashed");
      expect(error.recoverable).toBe(true);
      expect(error.retryable).toBe(true);
    });

    it("ValidationError should include field", () => {
      const error = new ValidationError("Invalid address", {
        field: "address",
      });
      expect(error.field).toBe("address");
    });
  });

  describe("Error Utilities", () => {
    it("isAppError should correctly identify AppError", () => {
      const appError = new AppError(ErrorCode.UNKNOWN_ERROR, "Test");
      const normalError = new Error("Test");

      expect(isAppError(appError)).toBe(true);
      expect(isAppError(normalError)).toBe(false);
      expect(isAppError(null)).toBe(false);
      expect(isAppError("string")).toBe(false);
    });

    it("wrapError should wrap non-AppError", () => {
      const error = new Error("Original");
      const wrapped = wrapError(error);

      expect(isAppError(wrapped)).toBe(true);
      expect(wrapped.message).toBe("Original");
      expect(wrapped.cause).toBe(error);
    });

    it("wrapError should return AppError as-is", () => {
      const original = new AppError(ErrorCode.NETWORK_ERROR, "Network failed");
      const wrapped = wrapError(original);

      expect(wrapped).toBe(original);
    });

    it("tryCatch should return result on success", async () => {
      const [result, error] = await tryCatch(async () => "success");

      expect(result).toBe("success");
      expect(error).toBeNull();
    });

    it("tryCatch should return error on failure", async () => {
      const [result, error] = await tryCatch(async () => {
        throw new Error("Failed");
      });

      expect(result).toBeNull();
      expect(error).not.toBeNull();
      expect(isAppError(error!)).toBe(true);
    });

    it("tryCatchSync should work synchronously", () => {
      const [result1, error1] = tryCatchSync(() => 42);
      expect(result1).toBe(42);
      expect(error1).toBeNull();

      const [result2, error2] = tryCatchSync(() => {
        throw new Error("Sync error");
      });
      expect(result2).toBeNull();
      expect(isAppError(error2!)).toBe(true);
    });
  });
});

// =============================================================================
// RETRY LOGIC TESTS
// =============================================================================

describe("Retry Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("retry function", () => {
    it("should succeed on first try", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const resultPromise = retry(fn, { maxRetries: 3 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          new NetworkError("Fail 1", { code: ErrorCode.NETWORK_ERROR }),
        )
        .mockResolvedValue("success");

      const resultPromise = retry(fn, { maxRetries: 3, initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe("success");
      expect(result.attempts).toBe(2);
    });

    it("should respect maxRetries", async () => {
      const fn = vi
        .fn()
        .mockRejectedValue(
          new NetworkError("Always fail", { code: ErrorCode.NETWORK_ERROR }),
        );

      const resultPromise = retry(fn, { maxRetries: 2, initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
    });

    it("should call onRetry callback", async () => {
      const onRetry = vi.fn();
      const fn = vi
        .fn()
        .mockRejectedValueOnce(
          new NetworkError("Fail", { code: ErrorCode.NETWORK_ERROR }),
        )
        .mockResolvedValue("success");

      const resultPromise = retry(fn, {
        maxRetries: 3,
        initialDelay: 100,
        onRetry,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.any(Object),
        expect.any(Number),
      );
    });
  });

  describe("retryOrThrow", () => {
    it("should return data on success", async () => {
      const fn = vi.fn().mockResolvedValue("data");

      const resultPromise = retryOrThrow(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("data");
    });

    it("should throw on failure", async () => {
      vi.useRealTimers(); // Use real timers for this test to avoid unhandled rejection

      const fn = vi
        .fn()
        .mockRejectedValue(
          new AppError(ErrorCode.NETWORK_ERROR, "Fail", { retryable: true }),
        );

      await expect(retryOrThrow(fn, { maxRetries: 0 })).rejects.toThrow();

      vi.useFakeTimers(); // Restore fake timers
    });
  });

  describe("Circuit Breaker", () => {
    it("should allow requests when closed", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 });
      const fn = vi.fn().mockResolvedValue("success");

      const result = await breaker.execute(fn);

      expect(result).toBe("success");
      expect(breaker.getState()).toBe("closed");
    });

    it("should open after threshold failures", async () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 3,
        failureWindow: 60000,
      });
      const fn = vi.fn().mockRejectedValue(new Error("Fail"));

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn);
        } catch {
          // Expected rejection: trip the circuit breaker
        }
      }

      expect(breaker.getState()).toBe("open");
      expect(breaker.getFailureCount()).toBe(3);
    });

    it("should reject requests when open", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 1 });
      const fn = vi.fn().mockRejectedValue(new Error("Fail"));

      try {
        await breaker.execute(fn);
      } catch {
        // Expected rejection: open the circuit breaker
      }

      await expect(breaker.execute(fn)).rejects.toThrow(
        "Circuit breaker is open",
      );
    });

    it("should reset manually", async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 1 });
      const fn = vi.fn().mockRejectedValue(new Error("Fail"));

      try {
        await breaker.execute(fn);
      } catch {
        // Expected rejection: trip before manual reset
      }

      breaker.reset();
      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("Rate Limiter", () => {
    it("should allow requests within limit", () => {
      const limiter = createRateLimiter({ maxRequests: 5, windowMs: 1000 });

      for (let i = 0; i < 5; i++) {
        expect(limiter.canProceed()).toBe(true);
        limiter.record();
      }
    });

    it("should block requests over limit", () => {
      const limiter = createRateLimiter({ maxRequests: 2, windowMs: 1000 });

      limiter.record();
      limiter.record();

      expect(limiter.canProceed()).toBe(false);
      expect(limiter.getRemainingRequests()).toBe(0);
    });

    it("should calculate time until available", () => {
      const limiter = createRateLimiter({ maxRequests: 1, windowMs: 1000 });

      limiter.record();

      const waitTime = limiter.getTimeUntilAvailable();
      expect(waitTime).toBeGreaterThan(0);
      expect(waitTime).toBeLessThanOrEqual(1000);
    });
  });
});

// =============================================================================
// UTILITY FUNCTIONS TESTS
// =============================================================================

describe("Utility Functions", () => {
  describe("withTimeout", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should resolve if completes before timeout", async () => {
      const promise = Promise.resolve("fast");
      const resultPromise = withTimeout(promise, 1000);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toBe("fast");
    });

    it("should reject on timeout", async () => {
      const slowPromise = new Promise((resolve) =>
        setTimeout(() => resolve("slow"), 2000),
      );

      const resultPromise = withTimeout(slowPromise, 100);

      // Advance time past timeout but not to completion
      vi.advanceTimersByTime(150);

      await expect(resultPromise).rejects.toThrow("timed out");
    });
  });

  describe("debounce", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should debounce calls", () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);

      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe("throttle", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should throttle calls", () => {
      const fn = vi.fn();
      const throttled = throttle(fn, 100);

      throttled();
      throttled();
      throttled();

      expect(fn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);
      throttled();

      expect(fn).toHaveBeenCalledTimes(2);
    });
  });
});

// =============================================================================
// LOGGER TESTS
// =============================================================================

describe("Logger", () => {
  it("should create logger with context", () => {
    const logger = createLogger({ context: "TestService" });
    expect(logger).toBeInstanceOf(Logger);
  });

  it("should log at different levels", () => {
    const consoleSpy = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    const logger = createLogger({ context: "Test", minLevel: "debug" });

    logger.debug("Debug message");
    logger.info("Info message");
    logger.warn("Warn message");
    logger.error("Error message");

    expect(consoleSpy.debug).toHaveBeenCalled();
    expect(consoleSpy.info).toHaveBeenCalled();
    expect(consoleSpy.warn).toHaveBeenCalled();
    expect(consoleSpy.error).toHaveBeenCalled();

    Object.values(consoleSpy).forEach((spy) => spy.mockRestore());
  });

  it("should filter by log level", () => {
    const consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    const logger = createLogger({ context: "Test", minLevel: "info" });

    logger.debug("Should not appear");

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should store entries", () => {
    const logger = createLogger({ context: "Test", console: false });

    logger.info("Entry 1");
    logger.warn("Entry 2");

    const entries = logger.getEntries();
    expect(entries).toHaveLength(2);
    expect(entries[0].message).toBe("Entry 1");
    expect(entries[1].message).toBe("Entry 2");
  });

  it("should create child logger", () => {
    const parent = createLogger({ context: "Parent", console: false });
    const child = parent.child("Child");

    child.info("Child message");

    const entries = child.getEntries();
    expect(entries[0].context).toBe("Parent:Child");
  });

  it("should clear entries", () => {
    const logger = createLogger({ context: "Test", console: false });

    logger.info("Entry");
    expect(logger.getEntries()).toHaveLength(1);

    logger.clear();
    expect(logger.getEntries()).toHaveLength(0);
  });

  it("should export as JSON", () => {
    const logger = createLogger({ context: "Test", console: false });

    logger.info("Test entry", { foo: "bar" });

    const json = logger.export();
    const parsed = JSON.parse(json);

    expect(parsed).toHaveLength(1);
    expect(parsed[0].message).toBe("Test entry");
    expect(parsed[0].data).toEqual({ foo: "bar" });
  });
});

// =============================================================================
// TRANSACTION TRACKER TESTS
// =============================================================================

describe("Transaction Tracker", () => {
  it("should create tracker", () => {
    const tracker = createTxTracker();
    expect(tracker).toBeInstanceOf(TxTracker);
  });

  it("should track transaction", () => {
    const tracker = createTxTracker();

    const tx = tracker.track("txid123", { type: "mining" });

    expect(tx.txid).toBe("txid123");
    expect(tx.status).toBe("pending");
    expect(tx.confirmations).toBe(0);
    expect(tx.metadata).toEqual({ type: "mining" });
  });

  it("should get transaction by id", () => {
    const tracker = createTxTracker();

    tracker.track("txid123");

    const tx = tracker.get("txid123");
    expect(tx).toBeDefined();
    expect(tx?.txid).toBe("txid123");
  });

  it("should return undefined for unknown txid", () => {
    const tracker = createTxTracker();
    const tx = tracker.get("unknown");
    expect(tx).toBeUndefined();
  });

  it("should get all transactions", () => {
    const tracker = createTxTracker();

    tracker.track("tx1");
    tracker.track("tx2");
    tracker.track("tx3");

    const all = tracker.getAll();
    expect(all).toHaveLength(3);
  });

  it("should get transactions by status", () => {
    const tracker = createTxTracker();

    tracker.track("tx1");
    tracker.track("tx2");

    const pending = tracker.getByStatus("pending");
    expect(pending).toHaveLength(2);

    const confirmed = tracker.getByStatus("confirmed");
    expect(confirmed).toHaveLength(0);
  });

  it("should untrack transaction", () => {
    const tracker = createTxTracker();

    tracker.track("txid123");
    expect(tracker.get("txid123")).toBeDefined();

    tracker.untrack("txid123");
    expect(tracker.get("txid123")).toBeUndefined();
  });

  it("should get pending count", () => {
    const tracker = createTxTracker();

    tracker.track("tx1");
    tracker.track("tx2");

    expect(tracker.getPendingCount()).toBe(2);
  });

  it("should get stats", () => {
    const tracker = createTxTracker();

    tracker.track("tx1");
    tracker.track("tx2");

    const stats = tracker.getStats();
    expect(stats.total).toBe(2);
    expect(stats.pending).toBe(2);
    expect(stats.confirmed).toBe(0);
  });

  it("should not duplicate tracked transactions", () => {
    const tracker = createTxTracker();

    const tx1 = tracker.track("txid123");
    const tx2 = tracker.track("txid123");

    expect(tx1).toBe(tx2);
    expect(tracker.getAll()).toHaveLength(1);
  });
});
