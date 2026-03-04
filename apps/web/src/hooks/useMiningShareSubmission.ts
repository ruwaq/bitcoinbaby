"use client";

/**
 * useMiningShareSubmission Hook
 *
 * Unified share submission logic that:
 * 1. Subscribes to useGlobalMining internally (singleton, no overhead)
 * 2. Credits shares to virtual balance via Workers API
 * 3. Optionally submits to blockchain if user has BTC
 * 4. Provides unified notification system
 * 5. Deduplicates shares by hash
 * 6. Persists shares to IndexedDB (offline-first)
 * 7. Background sync with exponential backoff
 *
 * This is the single source of truth for share submission.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGlobalMining,
  useWalletStore,
  calculateShareReward,
  getSyncManager,
  getQueueStats,
  type SyncEvent,
} from "@bitcoinbaby/core";
import { useMiningSubmitter } from "./useMiningSubmitter";

// =============================================================================
// TYPES
// =============================================================================

export type SubmissionStrategy = "virtual-first" | "blockchain-only";

export interface SubmissionNotification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  title: string;
  message: string;
  timestamp: number;
  reward?: bigint;
  txid?: string;
}

export interface SubmissionResult {
  success: boolean;
  credited?: bigint;
  txid?: string;
  error?: string;
}

export interface UseMiningShareSubmissionOptions {
  /** Submission strategy */
  strategy?: SubmissionStrategy;
  /** Notification callback */
  onNotification?: (notification: SubmissionNotification) => void;
}

export interface UseMiningShareSubmissionReturn {
  /** Number of shares found this session (from miner) */
  sessionShares: number;
  /** Number of shares pending submission */
  pendingShares: number;
  /** Number of shares that permanently failed (dead letter queue) */
  failedShares: number;
  /** Total shares submitted (synced to API) */
  submittedShares: number;
  /** Whether currently submitting */
  isSubmitting: boolean;
  /** Last submission result */
  lastSubmission: SubmissionResult | null;
  /** Recent notifications */
  notifications: SubmissionNotification[];
  /** Manual submit trigger */
  submitPendingShares: () => Promise<void>;
  /** Clear notifications */
  clearNotifications: () => void;
  /** Current strategy */
  strategy: SubmissionStrategy;
  /** Whether blockchain submission is available */
  canSubmitToBlockchain: boolean;
  /** Get current sync manager state (for debugging) */
  getSyncState: () => {
    isOnline: boolean;
    isSyncing: boolean;
    apiHealthy: boolean;
    address: string | null;
    circuitBreakerActive: boolean;
    circuitBreakerUntil: number;
    consecutiveFailures: number;
  };
  /** Reset circuit breaker and force immediate sync */
  resetAndSync: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_NOTIFICATIONS = 10;

// =============================================================================
// HOOK
// =============================================================================

export function useMiningShareSubmission(
  options: UseMiningShareSubmissionOptions = {},
): UseMiningShareSubmissionReturn {
  const { strategy = "virtual-first", onNotification } = options;

  // Subscribe to global mining (singleton - no extra overhead)
  const mining = useGlobalMining();

  // Get wallet address from global store (shared across all components)
  const wallet = useWalletStore((s) => s.wallet);
  const address = wallet?.address;

  // Blockchain submitter (for future blockchain-only strategy)
  const { canMine: canSubmitToBlockchain } = useMiningSubmitter();

  // State
  const [pendingShares, setPendingShares] = useState(0);
  const [failedShares, setFailedShares] = useState(0);
  const [submittedShares, setSubmittedShares] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<SubmissionResult | null>(
    null,
  );
  const [notifications, setNotifications] = useState<SubmissionNotification[]>(
    [],
  );

  // Track processed shares to avoid duplicates (in-memory for instant feedback)
  const processedSharesRef = useRef<Set<string>>(new Set());

  // SyncManager reference
  const syncManagerRef = useRef(getSyncManager());

  // Initialize SyncManager and load persisted queue stats
  useEffect(() => {
    if (!address) {
      console.debug("[ShareSubmission] No address available, waiting...");
      return;
    }

    console.debug(
      "[ShareSubmission] Starting SyncManager for:",
      address.slice(0, 12),
    );
    const syncManager = syncManagerRef.current;
    syncManager.start(address);

    // Load initial stats from IndexedDB
    getQueueStats(address).then((stats) => {
      console.debug("[ShareSubmission] Queue stats:", stats);
      setPendingShares(stats.pending + stats.syncing);
      setFailedShares(stats.failed);
      setSubmittedShares(stats.synced);
    });

    // Subscribe to sync events
    const unsubscribe = syncManager.subscribe((event: SyncEvent) => {
      console.debug("[ShareSubmission] Sync event:", event.type, event.data);
      switch (event.type) {
        case "sync_start":
          setIsSubmitting(true);
          break;
        case "sync_complete":
          setIsSubmitting(false);
          if (event.data?.synced) {
            setSubmittedShares((prev) => prev + event.data!.synced!);
          }
          setPendingShares(event.data?.pending ?? 0);
          if (event.data?.synced && event.data.synced > 0) {
            setLastSubmission({
              success: true,
              credited: BigInt(event.data.reward ?? "0"),
            });
          }
          break;
        case "sync_error":
          console.error("[ShareSubmission] Sync error:", event.data?.error);
          setIsSubmitting(false);
          break;
        case "health_fail":
          console.warn(
            "[ShareSubmission] API health check failed:",
            event.data?.error,
          );
          break;
        case "health_ok":
          console.debug("[ShareSubmission] API health restored");
          break;
      }
    });

    return () => {
      unsubscribe();
      syncManager.stop();
    };
  }, [address]);

  /**
   * Add notification
   */
  const addNotification = useCallback(
    (notification: Omit<SubmissionNotification, "id" | "timestamp">) => {
      const fullNotification: SubmissionNotification = {
        ...notification,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
      };

      setNotifications((prev) => {
        const updated = [fullNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
        return updated;
      });

      onNotification?.(fullNotification);
    },
    [onNotification],
  );

  /**
   * Clear notifications
   */
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  /**
   * Submit all pending shares
   * Triggers the SyncManager to sync immediately (bypassing interval)
   */
  const submitPendingShares = useCallback(async () => {
    if (isSubmitting) return;

    // Force sync via SyncManager (handles all submission logic)
    syncManagerRef.current.forceSync();
  }, [isSubmitting]);

  /**
   * Watch for new shares from mining (uses real mining results)
   * Persists to IndexedDB via SyncManager for offline-first support
   */
  useEffect(() => {
    // Skip if no new share or not running
    if (!mining.lastShare || !mining.isRunning) return;

    const share = mining.lastShare;

    // Skip if already processed (deduplicate by hash)
    if (processedSharesRef.current.has(share.hash)) return;

    // Calculate reward based on actual difficulty from the share
    const reward = calculateShareReward(share.difficulty);

    // Validate share has required data for server validation
    if (!share.blockData) {
      console.warn(
        "[ShareSubmission] Share missing blockData, cannot submit:",
        share.hash.slice(0, 16),
      );
      // Notify user that share was rejected (deferred to avoid cascading renders)
      queueMicrotask(() =>
        addNotification({
          type: "warning",
          title: "Share Rejected",
          message:
            "Share missing required data - this may indicate a miner bug",
        }),
      );
      return;
    }

    // Mark as processed immediately (in-memory dedup)
    processedSharesRef.current.add(share.hash);

    // Add to SyncManager (persists to IndexedDB + auto-syncs when online)
    syncManagerRef.current
      .addShare({
        hash: share.hash,
        nonce: share.nonce,
        difficulty: share.difficulty,
        blockData: share.blockData,
        reward,
        timestamp: share.timestamp,
      })
      .then(({ queued, duplicate }) => {
        if (queued) {
          setPendingShares((prev) => prev + 1);
          // Notification for new share queued
          addNotification({
            type: "info",
            title: "Share Found",
            message: `D${share.difficulty} share queued (+${reward.toString()} $BABY)`,
            reward,
          });
        } else if (duplicate) {
          // Debug only - duplicates are expected during normal operation
          console.debug(
            "[ShareSubmission] Duplicate share ignored:",
            share.hash.slice(0, 8),
          );
        }
      })
      .catch((error) => {
        console.error("[ShareSubmission] Failed to queue share:", error);
      });
  }, [mining.lastShare, mining.isRunning, addNotification]);

  /**
   * Clean up old processed hashes (in-memory dedup set)
   * Note: IndexedDB cleanup is handled by SyncManager
   */
  useEffect(() => {
    const cleanup = setInterval(() => {
      // Clean up old processed hashes (keep last 1000)
      if (processedSharesRef.current.size > 1000) {
        const entries = Array.from(processedSharesRef.current);
        processedSharesRef.current = new Set(entries.slice(-500));
      }
    }, 60000);

    return () => clearInterval(cleanup);
  }, []);

  /**
   * Get current sync state for debugging
   */
  const getSyncState = () => {
    return syncManagerRef.current.getState();
  };

  /**
   * Reset circuit breaker and force sync
   */
  const resetAndSync = () => {
    syncManagerRef.current.resetCircuitBreaker();
  };

  return {
    sessionShares: mining.shares, // Shares found this session (from miner)
    pendingShares,
    failedShares,
    submittedShares,
    isSubmitting,
    lastSubmission,
    notifications,
    submitPendingShares,
    clearNotifications,
    strategy,
    canSubmitToBlockchain,
    /** Get current sync manager state (for debugging) */
    getSyncState,
    /** Reset circuit breaker and force immediate sync */
    resetAndSync,
  };
}
