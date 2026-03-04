/**
 * Dead Letter Queue for Failed Mining Proofs
 *
 * Captures mining proofs that fail to submit due to network errors,
 * API failures, or other transient issues. Provides automatic retry
 * with exponential backoff and persistence across browser sessions.
 *
 * Key features:
 * - Persist failed proofs in IndexedDB
 * - Automatic retry with exponential backoff
 * - Maximum retry attempts before giving up
 * - Detailed failure tracking for debugging
 * - Event-driven architecture for UI integration
 */

import type { MiningResult } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface FailedProof {
  /** Unique identifier for tracking */
  id: string;
  /** The mining result that failed to submit */
  proof: MiningResult;
  /** Why the submission failed */
  errorMessage: string;
  /** Error code if available */
  errorCode?: string;
  /** When the failure occurred */
  failedAt: number;
  /** Number of retry attempts */
  retryCount: number;
  /** When the next retry should happen (0 if max retries reached) */
  nextRetryAt: number;
  /** Status of this failed proof */
  status: "pending" | "retrying" | "exhausted" | "recovered";
  /** Estimated token value (for display) */
  estimatedTokens?: number;
}

export interface DeadLetterQueueStats {
  /** Total failed proofs in queue */
  totalFailed: number;
  /** Proofs pending retry */
  pendingRetry: number;
  /** Proofs that exhausted all retries */
  exhausted: number;
  /** Proofs successfully recovered */
  recovered: number;
  /** Estimated total tokens at risk */
  estimatedTokensAtRisk: number;
}

export interface DeadLetterQueueEvents {
  /** Called when a proof is added to DLQ */
  onProofAdded?: (proof: FailedProof) => void;
  /** Called when a proof is successfully recovered */
  onProofRecovered?: (proof: FailedProof, txid: string) => void;
  /** Called when a proof exhausts all retries */
  onProofExhausted?: (proof: FailedProof) => void;
  /** Called when stats change */
  onStatsChange?: (stats: DeadLetterQueueStats) => void;
}

export interface DeadLetterQueueConfig {
  /** Maximum number of retry attempts (default: 5) */
  maxRetries?: number;
  /** Base delay between retries in ms (default: 5000) */
  baseRetryDelayMs?: number;
  /** Maximum delay between retries in ms (default: 5 minutes) */
  maxRetryDelayMs?: number;
  /** How often to check for proofs needing retry (default: 30s) */
  retryCheckIntervalMs?: number;
  /** Maximum proofs to store in DLQ (oldest removed first) */
  maxQueueSize?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DB_NAME = "bitcoinbaby-dlq";
const DB_VERSION = 1;
const STORE_NAME = "failed-proofs";

const LS_FALLBACK_KEY = "bitcoinbaby-dlq-proofs";

const DEFAULT_CONFIG: Required<DeadLetterQueueConfig> = {
  maxRetries: 5,
  baseRetryDelayMs: 5_000,
  maxRetryDelayMs: 5 * 60 * 1000, // 5 minutes
  retryCheckIntervalMs: 30_000,
  maxQueueSize: 100,
};

// =============================================================================
// DEAD LETTER QUEUE CLASS
// =============================================================================

export class DeadLetterQueue {
  private db: IDBDatabase | null = null;
  private isOpen = false;
  private useLocalStorageFallback = false;
  private config: Required<DeadLetterQueueConfig>;
  private events: DeadLetterQueueEvents = {};
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private retryFn: ((proof: FailedProof) => Promise<string | null>) | null =
    null;

  constructor(config: DeadLetterQueueConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  /**
   * Open the IndexedDB database
   */
  async open(): Promise<void> {
    if (this.isOpen) return;

    if (typeof indexedDB === "undefined") {
      console.warn(
        "[DLQ] IndexedDB not available, using localStorage fallback",
      );
      this.useLocalStorageFallback = true;
      this.isOpen = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
            store.createIndex("status", "status", { unique: false });
            store.createIndex("nextRetryAt", "nextRetryAt", { unique: false });
            store.createIndex("failedAt", "failedAt", { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.isOpen = true;
          console.log("[DLQ] IndexedDB opened successfully");
          resolve();
        };

        request.onerror = () => {
          console.warn("[DLQ] IndexedDB failed, using localStorage fallback");
          this.useLocalStorageFallback = true;
          this.isOpen = true;
          resolve();
        };

        request.onblocked = () => {
          console.warn("[DLQ] IndexedDB blocked, using localStorage fallback");
          this.useLocalStorageFallback = true;
          this.isOpen = true;
          resolve();
        };
      } catch (err) {
        console.warn(
          "[DLQ] IndexedDB exception, using localStorage fallback:",
          err,
        );
        this.useLocalStorageFallback = true;
        this.isOpen = true;
        resolve();
      }
    });
  }

  /**
   * Close the database and stop retry checks
   */
  close(): void {
    this.stopRetryChecks();
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isOpen = false;
    }
  }

  // ===========================================================================
  // EVENT HANDLING
  // ===========================================================================

  /**
   * Register event handlers
   */
  on<K extends keyof DeadLetterQueueEvents>(
    event: K,
    handler: DeadLetterQueueEvents[K],
  ): void {
    this.events[event] = handler;
  }

  // ===========================================================================
  // QUEUE OPERATIONS
  // ===========================================================================

  /**
   * Add a failed proof to the dead letter queue
   */
  async addFailedProof(
    proof: MiningResult,
    errorMessage: string,
    errorCode?: string,
    estimatedTokens?: number,
  ): Promise<FailedProof> {
    const failedProof: FailedProof = {
      id: `${proof.hash}-${Date.now()}`,
      proof,
      errorMessage,
      errorCode,
      failedAt: Date.now(),
      retryCount: 0,
      nextRetryAt: Date.now() + this.config.baseRetryDelayMs,
      status: "pending",
      estimatedTokens,
    };

    await this.saveProof(failedProof);
    await this.enforceQueueSize();

    console.log(
      `[DLQ] Added failed proof: ${failedProof.id} (${errorMessage})`,
    );

    this.events.onProofAdded?.(failedProof);
    this.emitStatsChange();

    return failedProof;
  }

  /**
   * Get all failed proofs
   */
  async getAllProofs(): Promise<FailedProof[]> {
    if (this.useLocalStorageFallback) {
      return this.getProofsFromLocalStorage();
    }

    if (!this.db) {
      return this.getProofsFromLocalStorage();
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          console.warn("[DLQ] IndexedDB getAll failed, using localStorage");
          resolve(this.getProofsFromLocalStorage());
        };
      } catch (err) {
        console.warn("[DLQ] Exception getting proofs:", err);
        resolve(this.getProofsFromLocalStorage());
      }
    });
  }

  /**
   * Get proofs that need retry
   */
  async getProofsNeedingRetry(): Promise<FailedProof[]> {
    const now = Date.now();
    const allProofs = await this.getAllProofs();

    return allProofs.filter(
      (p) =>
        p.status === "pending" &&
        p.nextRetryAt <= now &&
        p.retryCount < this.config.maxRetries,
    );
  }

  /**
   * Get dead letter queue statistics
   */
  async getStats(): Promise<DeadLetterQueueStats> {
    const proofs = await this.getAllProofs();

    return {
      totalFailed: proofs.length,
      pendingRetry: proofs.filter((p) => p.status === "pending").length,
      exhausted: proofs.filter((p) => p.status === "exhausted").length,
      recovered: proofs.filter((p) => p.status === "recovered").length,
      estimatedTokensAtRisk: proofs
        .filter((p) => p.status === "pending" || p.status === "exhausted")
        .reduce((sum, p) => sum + (p.estimatedTokens || 0), 0),
    };
  }

  /**
   * Remove a proof from the queue
   */
  async removeProof(id: string): Promise<void> {
    if (this.useLocalStorageFallback) {
      const proofs = this.getProofsFromLocalStorage();
      const filtered = proofs.filter((p) => p.id !== id);
      this.saveProofsToLocalStorage(filtered);
      return;
    }

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Clear all recovered and exhausted proofs
   */
  async clearProcessed(): Promise<number> {
    const proofs = await this.getAllProofs();
    const toRemove = proofs.filter(
      (p) => p.status === "recovered" || p.status === "exhausted",
    );

    for (const proof of toRemove) {
      await this.removeProof(proof.id);
    }

    this.emitStatsChange();
    return toRemove.length;
  }

  // ===========================================================================
  // RETRY MECHANISM
  // ===========================================================================

  /**
   * Set the retry function that will be called to resubmit proofs
   */
  setRetryFunction(fn: (proof: FailedProof) => Promise<string | null>): void {
    this.retryFn = fn;
  }

  /**
   * Start automatic retry checks
   */
  startRetryChecks(): void {
    if (this.retryInterval) return;

    this.retryInterval = setInterval(
      () => this.processRetries(),
      this.config.retryCheckIntervalMs,
    );

    console.log(
      `[DLQ] Retry checks started (every ${this.config.retryCheckIntervalMs / 1000}s)`,
    );

    // Run immediately
    this.processRetries();
  }

  /**
   * Stop automatic retry checks
   */
  stopRetryChecks(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
      console.log("[DLQ] Retry checks stopped");
    }
  }

  /**
   * Process all proofs needing retry
   */
  async processRetries(): Promise<void> {
    if (!this.retryFn) {
      console.warn("[DLQ] No retry function set, skipping retry checks");
      return;
    }

    const needingRetry = await this.getProofsNeedingRetry();

    if (needingRetry.length === 0) return;

    console.log(`[DLQ] Processing ${needingRetry.length} proof(s) for retry`);

    for (const proof of needingRetry) {
      await this.retryProof(proof);
    }
  }

  /**
   * Manually retry a specific proof
   */
  async retryProof(proof: FailedProof): Promise<boolean> {
    if (!this.retryFn) {
      console.error("[DLQ] No retry function set");
      return false;
    }

    // Update status to retrying
    proof.status = "retrying";
    await this.saveProof(proof);

    try {
      const txid = await this.retryFn(proof);

      if (txid) {
        // Success! Mark as recovered
        proof.status = "recovered";
        await this.saveProof(proof);
        console.log(`[DLQ] Proof recovered: ${proof.id} -> ${txid}`);
        this.events.onProofRecovered?.(proof, txid);
        this.emitStatsChange();
        return true;
      } else {
        // Failed again
        return this.handleRetryFailure(proof, "Retry returned null");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return this.handleRetryFailure(proof, message);
    }
  }

  /**
   * Handle a failed retry attempt
   */
  private async handleRetryFailure(
    proof: FailedProof,
    errorMessage: string,
  ): Promise<boolean> {
    proof.retryCount++;
    proof.errorMessage = errorMessage;

    if (proof.retryCount >= this.config.maxRetries) {
      // Exhausted all retries
      proof.status = "exhausted";
      proof.nextRetryAt = 0;
      console.warn(`[DLQ] Proof exhausted all retries: ${proof.id}`);
      this.events.onProofExhausted?.(proof);
    } else {
      // Schedule next retry with exponential backoff
      proof.status = "pending";
      const delay = Math.min(
        this.config.baseRetryDelayMs * Math.pow(2, proof.retryCount),
        this.config.maxRetryDelayMs,
      );
      proof.nextRetryAt = Date.now() + delay;
      console.log(
        `[DLQ] Retry ${proof.retryCount}/${this.config.maxRetries} failed for ${proof.id}, next retry in ${delay / 1000}s`,
      );
    }

    await this.saveProof(proof);
    this.emitStatsChange();
    return false;
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private async saveProof(proof: FailedProof): Promise<void> {
    if (this.useLocalStorageFallback) {
      const proofs = this.getProofsFromLocalStorage();
      const index = proofs.findIndex((p) => p.id === proof.id);
      if (index >= 0) {
        proofs[index] = proof;
      } else {
        proofs.push(proof);
      }
      this.saveProofsToLocalStorage(proofs);
      return;
    }

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(proof);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          console.warn("[DLQ] IndexedDB save failed, trying localStorage");
          try {
            const proofs = this.getProofsFromLocalStorage();
            const index = proofs.findIndex((p) => p.id === proof.id);
            if (index >= 0) {
              proofs[index] = proof;
            } else {
              proofs.push(proof);
            }
            this.saveProofsToLocalStorage(proofs);
            resolve();
          } catch (lsErr) {
            reject(lsErr);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  private async enforceQueueSize(): Promise<void> {
    const proofs = await this.getAllProofs();

    if (proofs.length <= this.config.maxQueueSize) return;

    // Sort by failedAt and remove oldest non-pending proofs first
    const sorted = [...proofs].sort((a, b) => a.failedAt - b.failedAt);
    const toRemove = sorted
      .filter((p) => p.status !== "pending")
      .slice(0, proofs.length - this.config.maxQueueSize);

    // If not enough non-pending, remove oldest pending too
    if (toRemove.length < proofs.length - this.config.maxQueueSize) {
      const pendingSorted = sorted.filter((p) => p.status === "pending");
      const additionalToRemove = pendingSorted.slice(
        0,
        proofs.length - this.config.maxQueueSize - toRemove.length,
      );
      toRemove.push(...additionalToRemove);
    }

    for (const proof of toRemove) {
      await this.removeProof(proof.id);
      console.log(`[DLQ] Removed old proof to enforce queue size: ${proof.id}`);
    }
  }

  private getProofsFromLocalStorage(): FailedProof[] {
    try {
      const data = localStorage.getItem(LS_FALLBACK_KEY);
      if (data) {
        return JSON.parse(data) as FailedProof[];
      }
    } catch (err) {
      console.warn("[DLQ] localStorage load failed:", err);
    }
    return [];
  }

  private saveProofsToLocalStorage(proofs: FailedProof[]): void {
    try {
      // Keep only maxQueueSize proofs in localStorage
      const trimmed = proofs.slice(-this.config.maxQueueSize);
      localStorage.setItem(LS_FALLBACK_KEY, JSON.stringify(trimmed));
    } catch (err) {
      console.warn("[DLQ] localStorage save failed:", err);
    }
  }

  private async emitStatsChange(): Promise<void> {
    if (this.events.onStatsChange) {
      const stats = await this.getStats();
      this.events.onStatsChange(stats);
    }
  }

  // ===========================================================================
  // DIAGNOSTICS
  // ===========================================================================

  /**
   * Get storage backend being used
   */
  getStorageBackend(): "indexeddb" | "localstorage" | "none" {
    if (this.useLocalStorageFallback) {
      return typeof localStorage !== "undefined" ? "localstorage" : "none";
    }
    return this.db ? "indexeddb" : "none";
  }

  /**
   * Check if using fallback storage
   */
  isUsingFallback(): boolean {
    return this.useLocalStorageFallback;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let dlqInstance: DeadLetterQueue | null = null;

export function getDeadLetterQueue(): DeadLetterQueue {
  if (!dlqInstance) {
    dlqInstance = new DeadLetterQueue();
  }
  return dlqInstance;
}

export async function initDeadLetterQueue(
  config?: DeadLetterQueueConfig,
): Promise<DeadLetterQueue> {
  if (dlqInstance) {
    return dlqInstance;
  }

  dlqInstance = new DeadLetterQueue(config);
  await dlqInstance.open();
  return dlqInstance;
}
