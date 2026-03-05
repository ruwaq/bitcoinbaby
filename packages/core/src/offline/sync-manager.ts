/**
 * SyncManager - Background Sync for Mining Shares
 *
 * Production-ready sync manager with:
 * - Online/offline detection
 * - Exponential backoff retries
 * - Batch processing
 * - Health checks
 * - Event-driven architecture
 *
 * @see https://developer.chrome.com/docs/workbox/modules/workbox-background-sync
 */

import {
  queueShare,
  getPendingShares,
  markSyncing,
  markSynced,
  markFailed,
  markPermanentlyFailed,
  getQueueStats,
  cleanupSyncedShares,
  cleanupFailedShares,
  needsNonceMigration,
  migrateDecimalNoncesToHex,
  needsLowDifficultyCleanup,
  cleanupLowDifficultyShares,
  type QueuedShare,
  type QueueStats,
} from "./share-queue";
import { getApiClient } from "../api/client";
import { CIRCUIT_BREAKER_DELAYS } from "../constants/retry-config";
import { MIN_DIFFICULTY } from "../tokenomics/constants";
import { getMiningManager } from "../mining/mining-singleton";

// =============================================================================
// TYPES
// =============================================================================

export interface SyncManagerConfig {
  /** Sync interval in ms (default: 5000) */
  syncInterval: number;
  /** Health check interval in ms (default: 30000) */
  healthCheckInterval: number;
  /** Max concurrent syncs (default: 3) */
  maxConcurrent: number;
  /** Max retry attempts before permanent failure (default: 10) */
  maxRetries: number;
  /** Batch size for sync (default: 10) */
  batchSize: number;
  /** Callback when sync completes successfully (for balance refresh) */
  onSyncSuccess?: (data: { synced: number; totalReward: string }) => void;
}

export interface SyncEvent {
  type:
    | "sync_start"
    | "sync_complete"
    | "sync_error"
    | "online"
    | "offline"
    | "health_ok"
    | "health_fail";
  timestamp: number;
  data?: {
    synced?: number;
    failed?: number;
    pending?: number;
    error?: string;
    reward?: string;
  };
}

export type SyncEventHandler = (event: SyncEvent) => void;

// =============================================================================
// SYNC MANAGER
// =============================================================================

const DEFAULT_CONFIG: SyncManagerConfig = {
  syncInterval: 3000, // Faster sync for large queues
  healthCheckInterval: 30000,
  maxConcurrent: 5, // Increased parallelism
  maxRetries: 10,
  batchSize: 50, // Process more shares per cycle (50 × 5 parallel = 250/cycle)
};

class SyncManager {
  private config: SyncManagerConfig;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncPromise: Promise<void> | null = null; // Mutex for sync operations
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private healthTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private eventHandlers: Set<SyncEventHandler> = new Set();
  private address: string | null = null;
  private apiHealthy: boolean = true;
  // Circuit breaker for rate limiting (503 errors)
  private circuitBreakerUntil: number = 0;
  private consecutiveFailures: number = 0;
  // Throttle rejected share logs to reduce console spam
  private rejectedShareCount: number = 0;
  private lastRejectedLogTime: number = 0;
  // Event handler references for cleanup
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  constructor(config: Partial<SyncManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Setup online/offline detection
    if (typeof window !== "undefined") {
      this.isOnline = navigator.onLine;

      // Store handler references for cleanup
      this.onlineHandler = () => {
        this.isOnline = true;
        this.emit({ type: "online", timestamp: Date.now() });
        this.triggerSync();
      };

      this.offlineHandler = () => {
        this.isOnline = false;
        this.emit({ type: "offline", timestamp: Date.now() });
      };

      window.addEventListener("online", this.onlineHandler);
      window.addEventListener("offline", this.offlineHandler);
    }
  }

  /**
   * Start the sync manager
   */
  start(address: string): void {
    this.address = address;

    // Run migrations (one-time fixes)
    this.runMigrationIfNeeded();
    this.runLowDifficultyCleanupIfNeeded();

    // Start sync loop
    if (!this.syncTimer) {
      this.syncTimer = setInterval(() => {
        this.triggerSync();
      }, this.config.syncInterval);

      // Initial sync
      this.triggerSync();
    }

    // Start health check loop
    if (!this.healthTimer) {
      this.healthTimer = setInterval(() => {
        this.checkHealth();
      }, this.config.healthCheckInterval);

      // Initial health check
      this.checkHealth();
    }

    // Schedule cleanup of old synced shares
    this.scheduleCleanup();
  }

  /**
   * Run one-time migration for old shares with decimal nonces
   * This fixes shares created before the hex nonce fix (commit c774f7c)
   */
  private async runMigrationIfNeeded(): Promise<void> {
    try {
      const needs = await needsNonceMigration();
      if (!needs) {
        console.log("[SyncManager] No nonce migration needed");
        return;
      }

      console.log("[SyncManager] Running decimal→hex nonce migration...");
      const result = await migrateDecimalNoncesToHex();
      console.log(
        `[SyncManager] Migration complete: ${result.fixed} shares fixed`,
      );

      // Emit event so UI can show notification
      this.emit({
        type: "sync_complete",
        timestamp: Date.now(),
        data: {
          synced: 0,
          failed: 0,
          pending: result.fixed,
          reward: "0",
        },
      });

      // Trigger sync immediately after migration
      this.triggerSync();
    } catch (error) {
      console.error("[SyncManager] Migration failed:", error);
    }
  }

  /**
   * Clean up old shares below minimum difficulty
   *
   * Shares mined at D16-D21 will be rejected by the server (MIN_DIFFICULTY=22).
   * This cleanup removes them to prevent repeated sync failures.
   */
  private async runLowDifficultyCleanupIfNeeded(): Promise<void> {
    try {
      const needs = await needsLowDifficultyCleanup();
      if (!needs) {
        console.log("[SyncManager] No low-difficulty cleanup needed");
        return;
      }

      console.log("[SyncManager] Cleaning up low-difficulty shares...");
      const result = await cleanupLowDifficultyShares();
      console.log(
        `[SyncManager] Cleanup complete: ${result.deleted} shares deleted, ${result.remaining} remaining`,
      );
    } catch (error) {
      console.error("[SyncManager] Low-difficulty cleanup failed:", error);
    }
  }

  /**
   * Stop the sync manager
   */
  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Remove event listeners to prevent memory leaks
    if (typeof window !== "undefined") {
      if (this.onlineHandler) {
        window.removeEventListener("online", this.onlineHandler);
        this.onlineHandler = null;
      }
      if (this.offlineHandler) {
        window.removeEventListener("offline", this.offlineHandler);
        this.offlineHandler = null;
      }
    }
  }

  /**
   * Add a share to queue (called when mining finds a share)
   */
  async addShare(share: {
    hash: string;
    nonce: number;
    difficulty: number;
    blockData: string;
    reward: bigint;
    timestamp: number;
  }): Promise<{ queued: boolean; duplicate: boolean }> {
    if (!this.address) {
      return { queued: false, duplicate: false };
    }

    // Reject shares below minimum difficulty (server will reject anyway)
    if (share.difficulty < MIN_DIFFICULTY) {
      // Throttle logging to reduce console spam (log every 10 rejections or every 5 seconds)
      this.rejectedShareCount++;
      const now = Date.now();
      if (
        this.rejectedShareCount === 1 ||
        this.rejectedShareCount % 10 === 0 ||
        now - this.lastRejectedLogTime > 5000
      ) {
        console.warn(
          `[SyncManager] ${this.rejectedShareCount} share(s) rejected: D${share.difficulty} < MIN_DIFFICULTY (${MIN_DIFFICULTY}). Increase miner difficulty!`,
        );
        this.lastRejectedLogTime = now;
      }
      return { queued: false, duplicate: false };
    }

    const result = await queueShare({
      ...share,
      reward: share.reward.toString(),
      address: this.address,
    });

    // Trigger immediate sync if online
    if (result.queued && this.isOnline && this.apiHealthy) {
      this.triggerSync();
    }

    return result;
  }

  /**
   * Get current queue stats
   */
  async getStats(): Promise<QueueStats> {
    return getQueueStats(this.address || undefined);
  }

  /**
   * Subscribe to sync events
   */
  subscribe(handler: SyncEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Check if API is healthy
   */
  async checkHealth(): Promise<boolean> {
    try {
      const client = getApiClient();
      // Use the same API URL as the client for health check
      const baseUrl =
        typeof window !== "undefined" &&
        window.location.hostname !== "localhost"
          ? "https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev"
          : "http://localhost:8787";
      const response = await fetch(`${baseUrl}/health`, { method: "GET" });

      const wasHealthy = this.apiHealthy;
      this.apiHealthy = response.ok;

      if (!wasHealthy && this.apiHealthy) {
        this.emit({ type: "health_ok", timestamp: Date.now() });
        this.triggerSync(); // Sync immediately when API becomes healthy
      } else if (wasHealthy && !this.apiHealthy) {
        this.emit({
          type: "health_fail",
          timestamp: Date.now(),
          data: { error: "API unavailable" },
        });
      }

      return this.apiHealthy;
    } catch {
      this.apiHealthy = false;
      this.emit({
        type: "health_fail",
        timestamp: Date.now(),
        data: { error: "Health check failed" },
      });
      return false;
    }
  }

  /**
   * Trigger a sync cycle
   * Uses Promise mutex to prevent race conditions
   */
  private async triggerSync(): Promise<void> {
    // RACE CONDITION FIX: Use syncPromise as mutex
    // Multiple calls will reuse the same pending sync instead of racing
    if (this.syncPromise) {
      return this.syncPromise;
    }

    // Skip if offline or no address
    if (!this.isOnline || !this.address) {
      return;
    }

    // Check circuit breaker (rate limit protection)
    if (Date.now() < this.circuitBreakerUntil) {
      return;
    }

    // If API was marked unhealthy, do a quick health check before skipping
    // This prevents being stuck in unhealthy state for 30+ seconds
    if (!this.apiHealthy) {
      const isHealthy = await this.checkHealth();
      if (!isHealthy) {
        return;
      }
    }

    // Create sync promise as mutex - cleared in finally block
    this.syncPromise = this.doSync();

    try {
      await this.syncPromise;
    } finally {
      this.syncPromise = null;
    }
  }

  /**
   * Internal sync implementation
   */
  private async doSync(): Promise<void> {
    this.isSyncing = true;

    try {
      const pending = await getPendingShares(
        this.address ?? undefined,
        this.config.batchSize,
      );

      if (pending.length === 0) {
        this.isSyncing = false;
        return;
      }

      this.emit({
        type: "sync_start",
        timestamp: Date.now(),
        data: { pending: pending.length },
      });

      let synced = 0;
      let failed = 0;
      let totalReward = 0n;

      // Process in batches with concurrency limit
      const results = await this.processBatch(pending);

      for (const result of results) {
        if (result.success) {
          synced++;
          totalReward += BigInt(result.reward);
        } else {
          failed++;
        }
      }

      // Reset circuit breaker on successful syncs
      if (synced > 0) {
        this.consecutiveFailures = 0;
        this.circuitBreakerUntil = 0;

        // Mark API as healthy since sync succeeded
        this.apiHealthy = true;

        // Call success callback for balance refresh
        this.config.onSyncSuccess?.({
          synced,
          totalReward: totalReward.toString(),
        });

        // Dispatch custom event for balance refresh (useVirtualBalance listens to this)
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("mining:sync-success", {
              detail: { synced, totalReward: totalReward.toString() },
            }),
          );
        }
      }

      this.emit({
        type: "sync_complete",
        timestamp: Date.now(),
        data: {
          synced,
          failed,
          pending: pending.length - synced,
          reward: totalReward.toString(),
        },
      });
    } catch (error) {
      this.emit({
        type: "sync_error",
        timestamp: Date.now(),
        data: { error: error instanceof Error ? error.message : "Sync failed" },
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process a batch of shares with concurrency limit
   */
  private async processBatch(
    shares: QueuedShare[],
  ): Promise<Array<{ success: boolean; reward: string }>> {
    const results: Array<{ success: boolean; reward: string }> = [];
    const client = getApiClient();

    // Process with concurrency limit
    for (let i = 0; i < shares.length; i += this.config.maxConcurrent) {
      const batch = shares.slice(i, i + this.config.maxConcurrent);
      const batchResults = await Promise.all(
        batch.map((share) => this.syncShare(share, client)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Sync a single share to the API
   */
  private async syncShare(
    share: QueuedShare,
    client: ReturnType<typeof getApiClient>,
  ): Promise<{ success: boolean; reward: string }> {
    try {
      // Mark as syncing
      await markSyncing(share.id!);

      // Send to API
      const response = await client.creditMining(share.address, {
        hash: share.hash,
        nonce: share.nonce,
        difficulty: share.difficulty,
        blockData: share.blockData,
        timestamp: share.timestamp,
      });

      if (response.success) {
        await markSynced(share.id!);

        // Update leaderboard (non-blocking - fire and forget)
        // This should not fail the mining flow if leaderboard update fails
        this.updateLeaderboardNonBlocking(
          share.address,
          share.difficulty,
          share.reward,
        );

        // Apply VarDiff adjustment if server suggested a new difficulty
        if (
          response.data?.varDiff?.difficultyChanged &&
          typeof response.data.varDiff.suggestedDifficulty === "number" &&
          response.data.varDiff.suggestedDifficulty > 0
        ) {
          this.applyVarDiffAdjustment(
            response.data.varDiff.suggestedDifficulty,
          );
        }

        return { success: true, reward: share.reward };
      } else {
        // Check if it's a duplicate (already synced)
        if (response.error?.includes("already")) {
          await markSynced(share.id!);
          return { success: true, reward: share.reward };
        }

        // Check for rate limiting (trigger circuit breaker)
        // Note: Case-insensitive check for "rate limit" variations
        const errorLower = response.error?.toLowerCase() ?? "";
        if (
          response.error?.includes("503") ||
          errorLower.includes("rate limit") ||
          response.error?.includes("free tier") ||
          response.error?.includes("Exceeded")
        ) {
          this.consecutiveFailures++;
          // Exponential backoff with jitter (best practice to prevent thundering herd)
          // Use centralized circuit breaker delays
          const delayIndex = Math.min(
            this.consecutiveFailures - 1,
            CIRCUIT_BREAKER_DELAYS.length - 1,
          );
          // Add ±20% jitter to prevent synchronized retries
          const baseDelay = CIRCUIT_BREAKER_DELAYS[delayIndex];
          const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1); // ±20%
          const delay = Math.round(baseDelay + jitter);
          this.circuitBreakerUntil = Date.now() + delay;
          console.log(
            `[SyncManager] Circuit breaker activated for ${Math.round(delay / 1000)}s`,
          );
          await markFailed(share.id!, "API rate limited - will retry later", 0);
          return { success: false, reward: "0" };
        }

        // Check if max retries exceeded
        if (share.attempts >= this.config.maxRetries) {
          await markPermanentlyFailed(
            share.id!,
            response.error || "Max retries exceeded",
          );
        } else {
          await markFailed(
            share.id!,
            response.error || "Unknown error",
            share.attempts,
          );
        }

        return { success: false, reward: "0" };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Network error";

      // Check for rate limiting (trigger circuit breaker)
      // Note: Case-insensitive check for "rate limit" variations
      const errorMsgLower = errorMsg.toLowerCase();
      if (
        errorMsg.includes("503") ||
        errorMsgLower.includes("rate limit") ||
        errorMsg.includes("free tier") ||
        errorMsg.includes("Exceeded")
      ) {
        this.consecutiveFailures++;
        // Exponential backoff with jitter (best practice to prevent thundering herd)
        // Use centralized circuit breaker delays
        const delayIndex = Math.min(
          this.consecutiveFailures - 1,
          CIRCUIT_BREAKER_DELAYS.length - 1,
        );
        // Add ±20% jitter
        const baseDelay = CIRCUIT_BREAKER_DELAYS[delayIndex];
        const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
        const delay = Math.round(baseDelay + jitter);
        this.circuitBreakerUntil = Date.now() + delay;
        console.log(
          `[SyncManager] Circuit breaker activated for ${Math.round(delay / 1000)}s`,
        );
        // Don't increment share attempts for rate limiting
        await markFailed(share.id!, "API rate limited - will retry later", 0);
        return { success: false, reward: "0" };
      }

      // Check for permanent failures (validation errors won't be fixed by retry)
      if (
        errorMsg.includes("Invalid proof") ||
        errorMsg.includes("Hash mismatch")
      ) {
        await markPermanentlyFailed(share.id!, errorMsg);
      } else if (share.attempts >= this.config.maxRetries) {
        await markPermanentlyFailed(share.id!, errorMsg);
      } else {
        await markFailed(share.id!, errorMsg, share.attempts);
      }

      return { success: false, reward: "0" };
    }
  }

  /**
   * Schedule cleanup of old synced and failed shares
   */
  private scheduleCleanup(): void {
    // Prevent duplicate cleanups
    if (this.cleanupTimer) return;

    // Run cleanup once per hour
    this.cleanupTimer = setInterval(
      async () => {
        try {
          // Clean up old synced shares (keep 7 days)
          const deletedSynced = await cleanupSyncedShares(7);
          if (deletedSynced > 0) {
            console.log(
              `[SyncManager] Cleaned up ${deletedSynced} old synced shares`,
            );
          }

          // Clean up old failed shares (dead letter queue - keep 3 days)
          const deletedFailed = await cleanupFailedShares(3);
          if (deletedFailed > 0) {
            console.log(
              `[SyncManager] Cleaned up ${deletedFailed} old failed shares (dead letter queue)`,
            );
          }
        } catch (error) {
          console.error("[SyncManager] Cleanup error:", error);
        }
      },
      60 * 60 * 1000,
    );
  }

  /**
   * Emit event to all subscribers
   */
  private emit(event: SyncEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("[SyncManager] Event handler error:", error);
      }
    }
  }

  /**
   * Get current state
   */
  getState(): {
    isOnline: boolean;
    isSyncing: boolean;
    apiHealthy: boolean;
    address: string | null;
    circuitBreakerActive: boolean;
    circuitBreakerUntil: number;
    consecutiveFailures: number;
  } {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      apiHealthy: this.apiHealthy,
      address: this.address,
      circuitBreakerActive: Date.now() < this.circuitBreakerUntil,
      circuitBreakerUntil: this.circuitBreakerUntil,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  /**
   * Reset the circuit breaker and force sync
   * Use this when the API is known to be healthy again
   */
  resetCircuitBreaker(): void {
    console.log("[SyncManager] Circuit breaker reset manually");
    this.circuitBreakerUntil = 0;
    this.consecutiveFailures = 0;
    this.apiHealthy = true;
    this.triggerSync();
  }

  /**
   * Set callback for when sync succeeds (for triggering balance refresh)
   * Can be called after initialization to set/update the callback
   */
  setOnSyncSuccess(
    callback: (data: { synced: number; totalReward: string }) => void,
  ): void {
    this.config.onSyncSuccess = callback;
  }

  /**
   * Force immediate sync
   */
  forceSync(): void {
    this.triggerSync();
  }

  /**
   * Update leaderboard in a non-blocking way
   * This is fire-and-forget - errors are logged but don't affect mining
   *
   * @param address - User's Bitcoin address
   * @param hashesIncrement - Number of hashes to add (difficulty represents hash count)
   * @param tokensEarned - Tokens earned from this share (as string)
   */
  private updateLeaderboardNonBlocking(
    address: string,
    hashesIncrement: number,
    tokensEarned: string,
  ): void {
    // Use the same API URL as the main API client
    const apiUrl =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? "https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev"
        : "http://localhost:8787";

    // Fire and forget - wrap in try-catch and don't await
    Promise.all([
      // Update miners leaderboard (total hashes)
      fetch(`${apiUrl}/api/leaderboard/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          category: "miners",
          score: hashesIncrement,
        }),
      }).catch((err) => {
        console.warn("[SyncManager] Failed to update miners leaderboard:", err);
      }),

      // Update earners leaderboard (tokens earned)
      fetch(`${apiUrl}/api/leaderboard/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          category: "earners",
          score: Number(tokensEarned),
        }),
      }).catch((err) => {
        console.warn(
          "[SyncManager] Failed to update earners leaderboard:",
          err,
        );
      }),
    ]).catch((err) => {
      // This should never happen since individual promises catch their errors
      console.warn("[SyncManager] Leaderboard update failed:", err);
    });
  }

  /**
   * Apply VarDiff adjustment to the mining manager
   *
   * Called when server returns a new suggested difficulty.
   * This ensures miners gradually adjust to their optimal difficulty.
   *
   * @param newDifficulty - New difficulty suggested by server
   */
  private applyVarDiffAdjustment(newDifficulty: number): void {
    try {
      const manager = getMiningManager();
      if (manager.isInitialized()) {
        const changed = manager.updateDifficultyFromVarDiff(newDifficulty);
        if (changed) {
          this.emit({
            type: "sync_complete",
            timestamp: Date.now(),
            data: {
              synced: 0,
              failed: 0,
              pending: 0,
              reward: "0",
            },
          });
        }
      }
    } catch (err) {
      console.warn("[SyncManager] Failed to apply VarDiff adjustment:", err);
    }
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let syncManagerInstance: SyncManager | null = null;

/**
 * Get the sync manager singleton
 */
export function getSyncManager(
  config?: Partial<SyncManagerConfig>,
): SyncManager {
  if (!syncManagerInstance) {
    syncManagerInstance = new SyncManager(config);
  }
  return syncManagerInstance;
}

/**
 * Reset sync manager (for testing)
 */
export function resetSyncManager(): void {
  if (syncManagerInstance) {
    syncManagerInstance.stop();
    syncManagerInstance = null;
  }
}

export type { SyncManager };
