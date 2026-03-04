/**
 * Offline-First Module
 *
 * Production-ready offline queue system for mining shares.
 * Uses IndexedDB for persistence and exponential backoff for retries.
 */

// Share Queue (IndexedDB storage)
export {
  queueShare,
  getPendingShares,
  markSyncing,
  markSynced,
  markFailed,
  markPermanentlyFailed,
  getQueueStats,
  cleanupSyncedShares,
  cleanupFailedShares,
  retryFailedShares,
  getPendingReward,
  isHashQueued,
  clearQueue,
  exportQueue,
  migrateDecimalNoncesToHex,
  needsNonceMigration,
  type QueuedShare,
  type QueueStats,
} from "./share-queue";

// Sync Manager
export {
  getSyncManager,
  resetSyncManager,
  type SyncManager,
  type SyncManagerConfig,
  type SyncEvent,
  type SyncEventHandler,
} from "./sync-manager";
