/**
 * @fileoverview Timeout Manager - Centralized timeout handling for BitcoinBaby
 *
 * Prevents zombie states by enforcing timeouts on async operations.
 * All timeouts are tracked and can be cleaned up on component unmount.
 *
 * @module @bitcoinbaby/shared/utils/timeout-manager
 */

export interface TimeoutEntry {
  id: ReturnType<typeof setTimeout>;
  key: string;
  createdAt: number;
  duration: number;
  callback: () => void;
}

export interface TimeoutManagerOptions {
  /** Prefix for all timeout keys (useful for debugging) */
  prefix?: string;
  /** Called when any timeout fires */
  onTimeout?: (key: string) => void;
  /** Called when a timeout is cleared before firing */
  onClear?: (key: string) => void;
}

export class TimeoutManager {
  private timeouts = new Map<string, TimeoutEntry>();
  private readonly prefix: string;
  private readonly onTimeout?: (key: string) => void;
  private readonly onClear?: (key: string) => void;

  constructor(options: TimeoutManagerOptions = {}) {
    this.prefix = options.prefix ?? "";
    this.onTimeout = options.onTimeout;
    this.onClear = options.onClear;
  }

  private getFullKey(key: string): string {
    return this.prefix ? `${this.prefix}:${key}` : key;
  }

  /**
   * Set a timeout that will fire the callback after the specified duration.
   * If a timeout with the same key already exists, it will be replaced.
   */
  set(key: string, callback: () => void, duration: number): void {
    const fullKey = this.getFullKey(key);

    // Clear existing timeout with same key
    this.clear(key);

    const entry: TimeoutEntry = {
      id: setTimeout(() => {
        this.timeouts.delete(fullKey);
        this.onTimeout?.(fullKey);
        callback();
      }, duration),
      key: fullKey,
      createdAt: Date.now(),
      duration,
      callback,
    };

    this.timeouts.set(fullKey, entry);
  }

  /**
   * Set a timeout that rejects a promise after the specified duration.
   * Useful for wrapping async operations with a timeout.
   */
  setWithPromise<T>(
    key: string,
    promise: Promise<T>,
    duration: number,
    timeoutError?: Error,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutCallback = () => {
        reject(
          timeoutError ?? new Error(`Operation timed out after ${duration}ms`),
        );
      };

      this.set(key, timeoutCallback, duration);

      promise
        .then((result) => {
          this.clear(key);
          resolve(result);
        })
        .catch((error) => {
          this.clear(key);
          reject(error);
        });
    });
  }

  /**
   * Clear a specific timeout by key.
   */
  clear(key: string): boolean {
    const fullKey = this.getFullKey(key);
    const entry = this.timeouts.get(fullKey);

    if (entry) {
      clearTimeout(entry.id);
      this.timeouts.delete(fullKey);
      this.onClear?.(fullKey);
      return true;
    }

    return false;
  }

  /**
   * Clear all active timeouts.
   */
  clearAll(): number {
    const count = this.timeouts.size;

    this.timeouts.forEach((entry) => {
      clearTimeout(entry.id);
      this.onClear?.(entry.key);
    });

    this.timeouts.clear();
    return count;
  }

  /**
   * Check if a timeout exists for the given key.
   */
  has(key: string): boolean {
    return this.timeouts.has(this.getFullKey(key));
  }

  /**
   * Get remaining time for a timeout in milliseconds.
   * Returns -1 if timeout doesn't exist.
   */
  getRemaining(key: string): number {
    const entry = this.timeouts.get(this.getFullKey(key));

    if (!entry) {
      return -1;
    }

    const elapsed = Date.now() - entry.createdAt;
    return Math.max(0, entry.duration - elapsed);
  }

  /**
   * Get all active timeout keys.
   */
  getActiveKeys(): string[] {
    return Array.from(this.timeouts.keys());
  }

  /**
   * Get the number of active timeouts.
   */
  get size(): number {
    return this.timeouts.size;
  }

  /**
   * Destroy the timeout manager and clear all timeouts.
   */
  destroy(): void {
    this.clearAll();
  }
}

/**
 * Create a timeout manager instance.
 * Use this in hooks/components that need timeout management.
 */
export function createTimeoutManager(
  options?: TimeoutManagerOptions,
): TimeoutManager {
  return new TimeoutManager(options);
}

// ============================================================================
// Pre-configured Timeout Values for BitcoinBaby
// ============================================================================

export const TIMEOUTS = {
  // Wallet operations
  WALLET_CONNECT: 30_000, // 30 seconds
  WALLET_UNLOCK: 30_000,
  WALLET_DISCONNECT: 5_000,

  // Transaction operations
  TX_BUILD: 30_000,
  TX_SIGN: 120_000, // 2 minutes for user to approve
  TX_BROADCAST: 30_000,
  TX_MEMPOOL: 600_000, // 10 minutes to reach mempool

  // Mining operations
  MINING_INIT: 30_000,
  MINING_SUBMIT: 60_000,
  MINING_STOP: 5_000,

  // Network operations
  API_REQUEST: 30_000,
  PROVER_REQUEST: 120_000, // Prover can be slow

  // UI operations
  TOAST_DISMISS: 5_000,
  MODAL_AUTO_CLOSE: 300_000, // 5 minutes
} as const;

export type TimeoutKey = keyof typeof TIMEOUTS;

/**
 * Get a timeout value by key with optional multiplier.
 */
export function getTimeout(key: TimeoutKey, multiplier = 1): number {
  return TIMEOUTS[key] * multiplier;
}
