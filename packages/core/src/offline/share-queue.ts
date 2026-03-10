/**
 * ShareQueue - Offline-First Share Storage
 *
 * Production-ready offline queue for mining shares using IndexedDB.
 * Based on 2025 best practices:
 * - Dexie.js for IndexedDB operations
 * - Persistent storage survives browser restart
 * - Deduplication by hash
 * - Queue ordering by timestamp
 *
 * @see https://blog.logrocket.com/offline-first-frontend-apps-2025-indexeddb-sqlite/
 * @see https://medium.com/@sohail_saifii/implementing-offline-first-with-indexeddb-and-sync
 */

import Dexie, { type Table } from "dexie";
import { RETRY_DELAYS } from "../constants/retry-config";

// =============================================================================
// TYPES
// =============================================================================

export interface QueuedShare {
  /** Unique ID (auto-generated) */
  id?: number;
  /** Mining proof hash (unique constraint) */
  hash: string;
  /** Nonce that solved the puzzle */
  nonce: number;
  /** Difficulty achieved */
  difficulty: number;
  /** Block data for verification */
  blockData: string;
  /** Calculated reward */
  reward: string;
  /** When share was found */
  timestamp: number;
  /** Wallet address */
  address: string;
  /** Sync status */
  status: "pending" | "syncing" | "synced" | "failed";
  /** Number of sync attempts */
  attempts: number;
  /** Last sync attempt timestamp */
  lastAttempt: number | null;
  /** Error message if failed */
  error: string | null;
  /** When to retry next (for backoff) */
  nextRetry: number | null;
}

export interface QueueStats {
  pending: number;
  syncing: number;
  synced: number;
  failed: number;
  total: number;
  oldestPending: number | null;
  totalReward: bigint;
}

export interface QueueError {
  type: "quota_exceeded" | "database_error" | "unknown";
  message: string;
  recoverable: boolean;
}

// =============================================================================
// DATABASE
// =============================================================================

class ShareQueueDB extends Dexie {
  shares!: Table<QueuedShare, number>;

  constructor() {
    super("BitcoinBabyShareQueue");

    // Version 1: Initial schema
    this.version(1).stores({
      shares: "++id, &hash, status, address, timestamp, nextRetry",
    });

    // Version 2: Add compound index [status+address] for efficient queries
    // Required by getPendingShares(address) and getPendingReward(address)
    this.version(2).stores({
      shares:
        "++id, &hash, status, address, [status+address], timestamp, nextRetry",
    });

    // Version 3: Add difficulty index for efficient low-difficulty cleanup
    // Required by cleanupLowDifficultyShares() to quickly find shares below MIN_DIFFICULTY
    this.version(3).stores({
      shares:
        "++id, &hash, status, address, [status+address], timestamp, nextRetry, difficulty",
    });
  }
}

// Singleton database instance
let db: ShareQueueDB | null = null;

function getDB(): ShareQueueDB {
  if (!db) {
    db = new ShareQueueDB();
  }
  return db;
}

// =============================================================================
// SHARE QUEUE API
// =============================================================================

/**
 * Check if an error is a quota exceeded error
 */
function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    // Standard quota exceeded error names
    return (
      error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED" || // Firefox
      error.code === 22 // Legacy code for quota exceeded
    );
  }
  // Dexie wraps errors, check message
  if (error instanceof Error) {
    return (
      error.message.includes("QuotaExceeded") ||
      error.message.includes("quota") ||
      error.message.includes("storage")
    );
  }
  return false;
}

/**
 * Check if an error is a constraint violation (duplicate key)
 * This handles race condition when two concurrent calls try to add same hash
 */
function isConstraintError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "ConstraintError";
  }
  // Dexie wraps errors, check message
  if (error instanceof Error) {
    return (
      error.message.includes("ConstraintError") ||
      error.message.includes("uniqueness") ||
      error.message.includes("unique constraint") ||
      error.message.includes("Key already exists")
    );
  }
  return false;
}

/**
 * Attempt to free up space by cleaning old synced shares
 * Returns true if space was freed
 */
async function freeUpSpace(): Promise<boolean> {
  try {
    // First, try cleaning up very old synced shares (older than 1 day)
    const deletedRecent = await cleanupSyncedShares(1);
    if (deletedRecent > 0) {
      console.log(
        `[ShareQueue] Freed space by deleting ${deletedRecent} old synced shares`,
      );
      return true;
    }

    // If that didn't help, clean all synced shares
    const database = getDB();
    const syncedShares = await database.shares
      .where("status")
      .equals("synced")
      .toArray();

    if (syncedShares.length > 0) {
      const ids = syncedShares.map((s) => s.id!);
      await database.shares.bulkDelete(ids);
      console.log(
        `[ShareQueue] Emergency cleanup: deleted ${ids.length} synced shares`,
      );
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Add a share to the queue
 * Automatically deduplicates by hash
 * Handles quota exceeded errors by attempting to free space
 */
export async function queueShare(
  share: Omit<
    QueuedShare,
    "id" | "status" | "attempts" | "lastAttempt" | "error" | "nextRetry"
  >,
): Promise<{
  queued: boolean;
  duplicate: boolean;
  id?: number;
  error?: QueueError;
}> {
  const database = getDB();

  // Check for duplicate (same hash)
  try {
    const existing = await database.shares
      .where("hash")
      .equals(share.hash)
      .first();

    if (existing) {
      return { queued: false, duplicate: true, id: existing.id };
    }
  } catch (error) {
    console.error("[ShareQueue] Error checking duplicate:", error);
    // Continue to try adding anyway
  }

  // Try to add to queue
  const addShare = async (): Promise<number> => {
    return database.shares.add({
      ...share,
      status: "pending",
      attempts: 0,
      lastAttempt: null,
      error: null,
      nextRetry: null,
    });
  };

  try {
    const id = await addShare();
    return { queued: true, duplicate: false, id };
  } catch (error) {
    // FIX: Handle constraint error (race condition - duplicate was added concurrently)
    // The &hash unique constraint catches this even if the initial check passed
    if (isConstraintError(error)) {
      // Another concurrent call added the same hash - this is a duplicate
      const existing = await database.shares
        .where("hash")
        .equals(share.hash)
        .first();
      return { queued: false, duplicate: true, id: existing?.id };
    }

    // Handle quota exceeded error
    if (isQuotaExceededError(error)) {
      console.warn("[ShareQueue] Quota exceeded, attempting to free space...");

      // Try to free up space
      const freedSpace = await freeUpSpace();
      if (freedSpace) {
        // Retry adding the share
        try {
          const id = await addShare();
          console.log(
            "[ShareQueue] Successfully queued share after freeing space",
          );
          return { queued: true, duplicate: false, id };
        } catch (retryError) {
          // Still failed after freeing space
          console.error(
            "[ShareQueue] Still failed after freeing space:",
            retryError,
          );
          return {
            queued: false,
            duplicate: false,
            error: {
              type: "quota_exceeded",
              message:
                "Storage quota exceeded. Please sync pending shares or clear browser data.",
              recoverable: false,
            },
          };
        }
      }

      // Couldn't free space
      return {
        queued: false,
        duplicate: false,
        error: {
          type: "quota_exceeded",
          message: "Storage quota exceeded. Please sync pending shares.",
          recoverable: true, // User can trigger sync
        },
      };
    }

    // Other database errors
    console.error("[ShareQueue] Database error:", error);
    return {
      queued: false,
      duplicate: false,
      error: {
        type: "database_error",
        message:
          error instanceof Error ? error.message : "Unknown database error",
        recoverable: false,
      },
    };
  }
}

/**
 * Get all pending shares ready for sync
 * Returns shares that are pending and past their retry time
 */
export async function getPendingShares(
  address?: string,
  limit: number = 50,
): Promise<QueuedShare[]> {
  const database = getDB();
  const now = Date.now();

  let query = database.shares
    .where("status")
    .equals("pending")
    .filter((share) => !share.nextRetry || share.nextRetry <= now);

  if (address) {
    query = database.shares
      .where(["status", "address"])
      .equals(["pending", address])
      .filter((share) => !share.nextRetry || share.nextRetry <= now);
  }

  return query.limit(limit).sortBy("timestamp");
}

/**
 * Mark share as syncing (in progress)
 */
export async function markSyncing(id: number): Promise<void> {
  const database = getDB();
  await database.shares.update(id, {
    status: "syncing",
    lastAttempt: Date.now(),
  });
}

/**
 * Mark share as successfully synced
 */
export async function markSynced(id: number): Promise<void> {
  const database = getDB();
  await database.shares.update(id, {
    status: "synced",
    error: null,
  });
}

/**
 * Mark share as failed with exponential backoff
 * Backoff delays: 1s, 5s, 15s, 60s, 5min, 15min, 1hr
 */
export async function markFailed(
  id: number,
  error: string,
  currentAttempts: number,
): Promise<void> {
  const database = getDB();
  // Use centralized retry delays (rate limit backoff for aggressive retries)
  const delayIndex = Math.min(
    currentAttempts,
    RETRY_DELAYS.rateLimit.length - 1,
  );
  const delay = RETRY_DELAYS.rateLimit[delayIndex];

  await database.shares.update(id, {
    status: "pending", // Back to pending for retry
    attempts: currentAttempts + 1,
    error,
    nextRetry: Date.now() + delay,
  });
}

/**
 * Mark share as permanently failed (too many attempts)
 */
export async function markPermanentlyFailed(
  id: number,
  error: string,
): Promise<void> {
  const database = getDB();
  await database.shares.update(id, {
    status: "failed",
    error,
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(address?: string): Promise<QueueStats> {
  const database = getDB();

  let shares: QueuedShare[];
  if (address) {
    shares = await database.shares.where("address").equals(address).toArray();
  } else {
    shares = await database.shares.toArray();
  }

  const stats: QueueStats = {
    pending: 0,
    syncing: 0,
    synced: 0,
    failed: 0,
    total: shares.length,
    oldestPending: null,
    totalReward: 0n,
  };

  for (const share of shares) {
    stats[share.status]++;

    if (share.status === "pending" || share.status === "syncing") {
      stats.totalReward += BigInt(share.reward);
      if (!stats.oldestPending || share.timestamp < stats.oldestPending) {
        stats.oldestPending = share.timestamp;
      }
    }
  }

  return stats;
}

/**
 * Clean up old synced shares (keep last N days)
 */
export async function cleanupSyncedShares(
  daysToKeep: number = 7,
): Promise<number> {
  const database = getDB();
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const toDelete = await database.shares
    .where("status")
    .equals("synced")
    .filter((share) => share.timestamp < cutoff)
    .toArray();

  const ids = toDelete.map((s) => s.id!);
  await database.shares.bulkDelete(ids);

  return ids.length;
}

/**
 * Clean up old failed shares (dead letter queue)
 *
 * Failed shares are those that exceeded max retries or had permanent errors.
 * They should be cleaned up after a while since they can't be recovered.
 *
 * @param daysToKeep Number of days to keep failed shares (default: 3)
 * @returns Number of shares deleted
 */
export async function cleanupFailedShares(
  daysToKeep: number = 3,
): Promise<number> {
  const database = getDB();
  const cutoff = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  const toDelete = await database.shares
    .where("status")
    .equals("failed")
    .filter((share) => share.timestamp < cutoff)
    .toArray();

  const ids = toDelete.map((s) => s.id!);
  await database.shares.bulkDelete(ids);

  if (ids.length > 0) {
    console.log(
      `[ShareQueue] Cleaned up ${ids.length} old failed shares (dead letter queue)`,
    );
  }

  return ids.length;
}

/**
 * Retry failed shares (move back to pending)
 *
 * Useful when server issues are resolved and user wants to retry.
 * Resets attempts counter and status to pending.
 *
 * @returns Number of shares reset for retry
 */
export async function retryFailedShares(): Promise<number> {
  const database = getDB();

  const failed = await database.shares
    .where("status")
    .equals("failed")
    .toArray();

  if (failed.length === 0) return 0;

  // Reset each share
  await Promise.all(
    failed.map((share) =>
      database.shares.update(share.id!, {
        status: "pending",
        attempts: 0,
        error: null,
        nextRetry: null,
      }),
    ),
  );

  console.log(`[ShareQueue] Reset ${failed.length} failed shares for retry`);

  return failed.length;
}

/**
 * Get total pending reward (for UI display)
 */
export async function getPendingReward(address: string): Promise<bigint> {
  const database = getDB();
  const pending = await database.shares
    .where(["status", "address"])
    .anyOf([
      ["pending", address],
      ["syncing", address],
    ])
    .toArray();

  return pending.reduce((sum, share) => sum + BigInt(share.reward), 0n);
}

/**
 * Check if a hash already exists in queue
 */
export async function isHashQueued(hash: string): Promise<boolean> {
  const database = getDB();
  const existing = await database.shares.where("hash").equals(hash).first();
  return !!existing;
}

/**
 * Clear all data (for testing/reset)
 */
export async function clearQueue(): Promise<void> {
  const database = getDB();
  await database.shares.clear();
}

/**
 * Export queue for debugging
 */
export async function exportQueue(): Promise<QueuedShare[]> {
  const database = getDB();
  return database.shares.toArray();
}

/**
 * Clear all pending and failed shares
 *
 * Use this when shares are corrupted and cannot sync.
 * This is a "fresh start" that clears all unsynced shares.
 *
 * @returns Number of shares cleared
 */
export async function clearPendingShares(): Promise<number> {
  const database = getDB();

  const toDelete = await database.shares
    .where("status")
    .anyOf(["pending", "failed", "syncing"])
    .toArray();

  const ids = toDelete.map((s) => s.id!);
  await database.shares.bulkDelete(ids);

  console.log(
    `[ShareQueue] Cleared ${ids.length} pending/failed shares (fresh start)`,
  );

  return ids.length;
}

/**
 * MIGRATION: Fix old shares with decimal nonces in blockData
 *
 * Before the hex nonce fix (commit c774f7c), WebGPU computed hashes with hex nonces
 * but JavaScript stored decimal nonces in blockData. This caused server validation
 * to fail because SHA256d(challenge:6827) ≠ SHA256d(challenge:1a9b).
 *
 * This migration converts decimal nonces to hex in pending shares so they can sync.
 *
 * @returns Number of shares fixed
 */
export async function migrateDecimalNoncesToHex(): Promise<{
  fixed: number;
  skipped: number;
  errors: number;
}> {
  const database = getDB();
  const result = { fixed: 0, skipped: 0, errors: 0 };

  try {
    // Get all pending shares that might need fixing
    const pendingShares = await database.shares
      .where("status")
      .anyOf(["pending", "syncing", "failed"])
      .toArray();

    console.log(
      `[ShareQueue Migration] Checking ${pendingShares.length} shares for decimal nonces`,
    );

    for (const share of pendingShares) {
      try {
        // Parse blockData to get the nonce
        // Format: "challenge:nonce" or "address:timestamp:nonce"
        const parts = share.blockData.split(":");
        const nonceStr = parts[parts.length - 1];

        // Check if nonce is already hex (contains a-f or starts with 0x)
        const isAlreadyHex =
          nonceStr.startsWith("0x") || /[a-fA-F]/.test(nonceStr);

        if (isAlreadyHex) {
          // Already hex, skip
          result.skipped++;
          continue;
        }

        // Convert decimal to hex
        const decimalNonce = parseInt(nonceStr, 10);
        if (isNaN(decimalNonce)) {
          console.warn(
            `[ShareQueue Migration] Invalid nonce in share ${share.id}: ${nonceStr}`,
          );
          result.errors++;
          continue;
        }

        const hexNonce = decimalNonce.toString(16);

        // Reconstruct blockData with hex nonce
        parts[parts.length - 1] = hexNonce;
        const fixedBlockData = parts.join(":");

        // Update the share
        await database.shares.update(share.id!, {
          blockData: fixedBlockData,
          // Reset attempts to give it fresh tries
          attempts: 0,
          nextRetry: null,
          error: null,
          // If it was failed, put it back to pending
          status: "pending",
        });

        result.fixed++;

        // Log progress every 1000 shares
        if (result.fixed % 1000 === 0) {
          console.log(
            `[ShareQueue Migration] Progress: ${result.fixed} shares fixed`,
          );
        }
      } catch (error) {
        console.error(
          `[ShareQueue Migration] Error fixing share ${share.id}:`,
          error,
        );
        result.errors++;
      }
    }

    console.log(
      `[ShareQueue Migration] Complete: ${result.fixed} fixed, ${result.skipped} skipped, ${result.errors} errors`,
    );

    return result;
  } catch (error) {
    console.error("[ShareQueue Migration] Failed:", error);
    throw error;
  }
}

/**
 * Check if migration is needed (any pending shares with decimal nonces)
 */
export async function needsNonceMigration(): Promise<boolean> {
  const database = getDB();

  // Sample first 100 pending shares
  const sample = await database.shares
    .where("status")
    .anyOf(["pending", "syncing", "failed"])
    .limit(100)
    .toArray();

  for (const share of sample) {
    const parts = share.blockData.split(":");
    const nonceStr = parts[parts.length - 1];

    // If nonce is purely decimal (no hex chars), needs migration
    const isDecimal = /^\d+$/.test(nonceStr) && !nonceStr.startsWith("0x");
    const hasHexChars = /[a-fA-F]/.test(nonceStr);

    if (isDecimal && !hasHexChars) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// LOW DIFFICULTY CLEANUP
// =============================================================================

const MIN_DIFFICULTY_REQUIRED = 16;

/**
 * MIGRATION: Clean up shares below minimum difficulty
 *
 * Shares below D16 will be rejected by the server (MIN_DIFFICULTY=16).
 * This migration removes them from the queue to prevent repeated failed syncs.
 *
 * @returns Number of shares deleted
 */
export async function cleanupLowDifficultyShares(): Promise<{
  deleted: number;
  remaining: number;
}> {
  const database = getDB();

  try {
    // Get all shares below minimum difficulty
    const lowDiffShares = await database.shares
      .where("difficulty")
      .below(MIN_DIFFICULTY_REQUIRED)
      .toArray();

    if (lowDiffShares.length === 0) {
      console.log("[ShareQueue] No low-difficulty shares to clean up");
      return { deleted: 0, remaining: 0 };
    }

    console.log(
      `[ShareQueue] Found ${lowDiffShares.length} shares below D${MIN_DIFFICULTY_REQUIRED}, cleaning up...`,
    );

    // Delete them
    const ids = lowDiffShares.map((s) => s.id!);
    await database.shares.bulkDelete(ids);

    // Count remaining
    const remaining = await database.shares.count();

    console.log(
      `[ShareQueue] Deleted ${ids.length} low-difficulty shares, ${remaining} remaining`,
    );

    return { deleted: ids.length, remaining };
  } catch (error) {
    console.error("[ShareQueue] Low-difficulty cleanup failed:", error);
    throw error;
  }
}

/**
 * Check if low-difficulty cleanup is needed
 */
export async function needsLowDifficultyCleanup(): Promise<boolean> {
  const database = getDB();

  const count = await database.shares
    .where("difficulty")
    .below(MIN_DIFFICULTY_REQUIRED)
    .count();

  return count > 0;
}

// =============================================================================
// MIGRATION: Clean up shares without blockData
// =============================================================================

/**
 * MIGRATION: Clean up shares without blockData
 *
 * Shares without blockData will be rejected by the server (validation error).
 * This migration removes them from the queue to prevent repeated failed syncs.
 *
 * Note: blockData is not indexed, so we filter in memory.
 *
 * @returns Number of shares deleted
 */
export async function cleanupMissingBlockDataShares(): Promise<{
  deleted: number;
  remaining: number;
}> {
  const database = getDB();

  try {
    // Get all pending shares and filter for missing blockData
    const allShares = await database.shares.toArray();
    const invalidShares = allShares.filter(
      (s) => !s.blockData || s.blockData.trim() === "",
    );

    if (invalidShares.length === 0) {
      console.log("[ShareQueue] No shares with missing blockData to clean up");
      return { deleted: 0, remaining: allShares.length };
    }

    console.log(
      `[ShareQueue] Found ${invalidShares.length} shares without blockData, cleaning up...`,
    );

    // Delete them
    const ids = invalidShares.map((s) => s.id!);
    await database.shares.bulkDelete(ids);

    // Count remaining
    const remaining = await database.shares.count();

    console.log(
      `[ShareQueue] Deleted ${ids.length} shares without blockData, ${remaining} remaining`,
    );

    return { deleted: ids.length, remaining };
  } catch (error) {
    console.error("[ShareQueue] Missing blockData cleanup failed:", error);
    throw error;
  }
}

/**
 * Check if missing blockData cleanup is needed
 */
export async function needsMissingBlockDataCleanup(): Promise<boolean> {
  const database = getDB();

  const allShares = await database.shares.toArray();
  const invalidCount = allShares.filter(
    (s) => !s.blockData || s.blockData.trim() === "",
  ).length;

  return invalidCount > 0;
}
