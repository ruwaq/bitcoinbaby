/**
 * Dead Letter Queue Store
 *
 * Zustand store for tracking failed mining proofs.
 * Integrates with the DeadLetterQueue class to provide
 * reactive state updates for the UI.
 */

import { create } from "zustand";
import {
  type DeadLetterQueueStats,
  type FailedProof,
  type DeadLetterQueueConfig,
  initDeadLetterQueue,
  getDeadLetterQueue,
} from "../mining/dead-letter-queue";
import type { MiningResult } from "../mining/types";

// =============================================================================
// TYPES
// =============================================================================

interface DeadLetterStore {
  /** Whether the DLQ is initialized */
  isInitialized: boolean;
  /** Current DLQ statistics */
  stats: DeadLetterQueueStats;
  /** List of all failed proofs (for display) */
  failedProofs: FailedProof[];
  /** Whether a retry is in progress */
  isRetrying: boolean;
  /** Last error message */
  lastError: string | null;
  /** Whether retry checks are running */
  isAutoRetryEnabled: boolean;

  // Actions
  /** Initialize the DLQ system */
  initialize: (config?: DeadLetterQueueConfig) => Promise<void>;
  /** Add a failed proof */
  addFailedProof: (
    proof: MiningResult,
    errorMessage: string,
    errorCode?: string,
    estimatedTokens?: number,
  ) => Promise<void>;
  /** Manually retry a specific proof */
  retryProof: (proofId: string) => Promise<boolean>;
  /** Retry all pending proofs */
  retryAllPending: () => Promise<void>;
  /** Clear processed proofs (recovered + exhausted) */
  clearProcessed: () => Promise<number>;
  /** Set the retry function */
  setRetryFunction: (
    fn: (proof: FailedProof) => Promise<string | null>,
  ) => void;
  /** Enable/disable automatic retry checks */
  setAutoRetry: (enabled: boolean) => void;
  /** Refresh stats and proofs from DLQ */
  refresh: () => Promise<void>;
}

const initialStats: DeadLetterQueueStats = {
  totalFailed: 0,
  pendingRetry: 0,
  exhausted: 0,
  recovered: 0,
  estimatedTokensAtRisk: 0,
};

// =============================================================================
// STORE
// =============================================================================

export const useDeadLetterStore = create<DeadLetterStore>((set, get) => ({
  isInitialized: false,
  stats: initialStats,
  failedProofs: [],
  isRetrying: false,
  lastError: null,
  isAutoRetryEnabled: false,

  initialize: async (config?: DeadLetterQueueConfig) => {
    if (get().isInitialized) return;

    try {
      const dlq = await initDeadLetterQueue(config);

      // Set up event handlers
      dlq.on("onStatsChange", (stats) => {
        set({ stats });
      });

      dlq.on("onProofAdded", async () => {
        const proofs = await dlq.getAllProofs();
        set({ failedProofs: proofs });
      });

      dlq.on("onProofRecovered", async () => {
        const proofs = await dlq.getAllProofs();
        const stats = await dlq.getStats();
        set({ failedProofs: proofs, stats });
      });

      dlq.on("onProofExhausted", async () => {
        const proofs = await dlq.getAllProofs();
        const stats = await dlq.getStats();
        set({ failedProofs: proofs, stats });
      });

      // Load initial state
      const proofs = await dlq.getAllProofs();
      const stats = await dlq.getStats();

      set({
        isInitialized: true,
        failedProofs: proofs,
        stats,
      });

      console.log(
        "[DeadLetterStore] Initialized with",
        proofs.length,
        "proofs",
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[DeadLetterStore] Initialization failed:", message);
      set({ lastError: message });
    }
  },

  addFailedProof: async (
    proof: MiningResult,
    errorMessage: string,
    errorCode?: string,
    estimatedTokens?: number,
  ) => {
    const dlq = getDeadLetterQueue();
    await dlq.addFailedProof(proof, errorMessage, errorCode, estimatedTokens);

    // Refresh state
    const proofs = await dlq.getAllProofs();
    const stats = await dlq.getStats();
    set({ failedProofs: proofs, stats });
  },

  retryProof: async (proofId: string) => {
    const dlq = getDeadLetterQueue();
    const proofs = await dlq.getAllProofs();
    const proof = proofs.find((p) => p.id === proofId);

    if (!proof) {
      console.warn("[DeadLetterStore] Proof not found:", proofId);
      return false;
    }

    set({ isRetrying: true, lastError: null });

    try {
      const success = await dlq.retryProof(proof);

      // Refresh state
      const updatedProofs = await dlq.getAllProofs();
      const stats = await dlq.getStats();
      set({ failedProofs: updatedProofs, stats, isRetrying: false });

      return success;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ isRetrying: false, lastError: message });
      return false;
    }
  },

  retryAllPending: async () => {
    const dlq = getDeadLetterQueue();
    set({ isRetrying: true, lastError: null });

    try {
      await dlq.processRetries();

      // Refresh state
      const proofs = await dlq.getAllProofs();
      const stats = await dlq.getStats();
      set({ failedProofs: proofs, stats, isRetrying: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      set({ isRetrying: false, lastError: message });
    }
  },

  clearProcessed: async () => {
    const dlq = getDeadLetterQueue();
    const count = await dlq.clearProcessed();

    // Refresh state
    const proofs = await dlq.getAllProofs();
    const stats = await dlq.getStats();
    set({ failedProofs: proofs, stats });

    return count;
  },

  setRetryFunction: (fn: (proof: FailedProof) => Promise<string | null>) => {
    const dlq = getDeadLetterQueue();
    dlq.setRetryFunction(fn);
  },

  setAutoRetry: (enabled: boolean) => {
    const dlq = getDeadLetterQueue();

    if (enabled) {
      dlq.startRetryChecks();
    } else {
      dlq.stopRetryChecks();
    }

    set({ isAutoRetryEnabled: enabled });
  },

  refresh: async () => {
    const dlq = getDeadLetterQueue();
    const proofs = await dlq.getAllProofs();
    const stats = await dlq.getStats();
    set({ failedProofs: proofs, stats });
  },
}));

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get count of proofs that can be retried
 */
export const selectRetryableCount = (state: DeadLetterStore): number =>
  state.failedProofs.filter(
    (p) => p.status === "pending" || p.status === "retrying",
  ).length;

/**
 * Get proofs that have exhausted all retries
 */
export const selectExhaustedProofs = (state: DeadLetterStore): FailedProof[] =>
  state.failedProofs.filter((p) => p.status === "exhausted");

/**
 * Check if there are any failed proofs needing attention
 */
export const selectHasFailedProofs = (state: DeadLetterStore): boolean =>
  state.stats.pendingRetry > 0 || state.stats.exhausted > 0;

/**
 * Get estimated tokens at risk
 */
export const selectTokensAtRisk = (state: DeadLetterStore): number =>
  state.stats.estimatedTokensAtRisk;
