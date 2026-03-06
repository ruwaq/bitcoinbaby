/**
 * Pending Transactions Store
 *
 * Zustand store for tracking pending Bitcoin transactions.
 * Uses TxTracker under the hood for confirmation monitoring.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  createTxTracker,
  type TxTracker,
  type TrackedTransaction,
  type TxStatus,
} from "../utils/tx-tracker";
import { useNetworkStore } from "./network-store";

// =============================================================================
// TYPES
// =============================================================================

export type TransactionType =
  | "nft_mint"
  | "nft_purchase"
  | "nft_evolution"
  | "withdraw"
  | "other";

export interface PendingTransaction extends TrackedTransaction {
  /** Type of transaction */
  type: TransactionType;
  /** Human-readable description */
  description: string;
  /** Link to view on explorer */
  explorerUrl: string;
}

interface PendingTxState {
  /** All tracked transactions */
  transactions: PendingTransaction[];
  /** Is tracker running */
  isTracking: boolean;
  /** Last update timestamp */
  lastUpdated: number | null;
}

interface PendingTxActions {
  /** Add a transaction to track */
  addTransaction: (
    txid: string,
    type: TransactionType,
    description: string,
  ) => void;
  /** Remove a transaction from tracking */
  removeTransaction: (txid: string) => void;
  /** Start tracking (call on app init) */
  startTracking: () => void;
  /** Stop tracking */
  stopTracking: () => void;
  /** Get pending transactions (not yet confirmed) */
  getPending: () => PendingTransaction[];
  /** Get transactions by type */
  getByType: (type: TransactionType) => PendingTransaction[];
  /** Clear all confirmed/failed transactions */
  clearCompleted: () => void;
  /** Force refresh all */
  refresh: () => Promise<void>;
}

type PendingTxStore = PendingTxState & PendingTxActions;

// =============================================================================
// STORE
// =============================================================================

// Singleton tracker instance
let trackerInstance: TxTracker | null = null;

/**
 * Get explorer URL using current network configuration
 */
const getExplorerUrl = (txid: string): string => {
  const config = useNetworkStore.getState().config;
  return `${config.explorerUrl}/tx/${txid}`;
};

/**
 * Get mempool API endpoint using current network configuration
 */
const getMempoolApiEndpoint = (): string => {
  const config = useNetworkStore.getState().config;
  return config.mempoolApi;
};

export const usePendingTxStore = create<PendingTxStore>()(
  persist(
    (set, get) => ({
      // Initial state
      transactions: [],
      isTracking: false,
      lastUpdated: null,

      // Actions
      addTransaction: (txid, type, description) => {
        const existing = get().transactions.find((tx) => tx.txid === txid);
        if (existing) return;

        const newTx: PendingTransaction = {
          txid,
          type,
          description,
          status: "pending",
          confirmations: 0,
          submittedAt: Date.now(),
          explorerUrl: getExplorerUrl(txid),
        };

        set((state) => ({
          transactions: [newTx, ...state.transactions],
          lastUpdated: Date.now(),
        }));

        // Track with TxTracker
        if (trackerInstance) {
          trackerInstance.track(txid, { type, description });
        }
      },

      removeTransaction: (txid) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.txid !== txid),
          lastUpdated: Date.now(),
        }));

        if (trackerInstance) {
          trackerInstance.untrack(txid);
        }
      },

      startTracking: () => {
        if (trackerInstance || get().isTracking) return;

        trackerInstance = createTxTracker({
          pollInterval: 10000, // 10 seconds for responsive UX
          targetConfirmations: 1, // Consider confirmed after 1 confirmation for UX
          apiEndpoint: getMempoolApiEndpoint(),
          events: {
            onStatusChange: (tx) => {
              set((state) => ({
                transactions: state.transactions.map((t) =>
                  t.txid === tx.txid
                    ? {
                        ...t,
                        status: tx.status,
                        confirmations: tx.confirmations,
                        blockHeight: tx.blockHeight,
                        confirmedAt: tx.confirmedAt,
                        failedAt: tx.failedAt,
                        error: tx.error,
                      }
                    : t,
                ),
                lastUpdated: Date.now(),
              }));
            },
            onConfirmed: (tx) => {
              console.log(`[PendingTx] Transaction confirmed: ${tx.txid}`);
            },
            onFailed: (tx) => {
              console.warn(`[PendingTx] Transaction failed: ${tx.txid}`);
            },
          },
        });

        // Add existing pending transactions to tracker
        const pending = get().transactions.filter(
          (tx) =>
            tx.status === "pending" ||
            tx.status === "mempool" ||
            tx.status === "confirming",
        );
        for (const tx of pending) {
          trackerInstance.track(tx.txid, {
            type: tx.type,
            description: tx.description,
          });
        }

        trackerInstance.start();
        set({ isTracking: true });

        // Immediately refresh to get current status (don't wait for poll interval)
        if (pending.length > 0) {
          console.log(
            `[PendingTx] Starting tracker with ${pending.length} pending transactions`,
          );
          // Small delay to let tracker initialize, then refresh
          setTimeout(() => {
            trackerInstance?.refresh();
          }, 1000);
        }
      },

      stopTracking: () => {
        if (trackerInstance) {
          trackerInstance.stop();
          trackerInstance = null;
        }
        set({ isTracking: false });
      },

      getPending: () => {
        return get().transactions.filter(
          (tx) =>
            tx.status === "pending" ||
            tx.status === "mempool" ||
            tx.status === "confirming",
        );
      },

      getByType: (type) => {
        return get().transactions.filter((tx) => tx.type === type);
      },

      clearCompleted: () => {
        set((state) => ({
          transactions: state.transactions.filter(
            (tx) =>
              tx.status !== "confirmed" &&
              tx.status !== "failed" &&
              tx.status !== "replaced",
          ),
          lastUpdated: Date.now(),
        }));
      },

      refresh: async () => {
        if (trackerInstance) {
          await trackerInstance.refresh();
        }
      },
    }),
    {
      name: "bitcoinbaby-pending-tx",
      version: 1,
      partialize: (state: PendingTxStore) => ({
        transactions: state.transactions,
      }),
    },
  ),
);

// Export hook for getting pending count
export function usePendingTxCount(): number {
  return usePendingTxStore(
    (state) =>
      state.transactions.filter(
        (tx) =>
          tx.status === "pending" ||
          tx.status === "mempool" ||
          tx.status === "confirming",
      ).length,
  );
}

/**
 * Cleanup old stuck transactions
 * Call this periodically or on app init to remove zombie transactions
 * that have been pending for too long (likely dropped from mempool)
 */
export function cleanupStuckTransactions(maxAgeHours: number = 24): number {
  const store = usePendingTxStore.getState();
  const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

  const stuckTxs = store.transactions.filter(
    (tx) =>
      (tx.status === "pending" || tx.status === "mempool") &&
      tx.submittedAt < cutoff,
  );

  if (stuckTxs.length > 0) {
    console.log(
      `[PendingTx] Cleaning up ${stuckTxs.length} stuck transactions older than ${maxAgeHours}h`,
    );
    for (const tx of stuckTxs) {
      store.removeTransaction(tx.txid);
    }
  }

  return stuckTxs.length;
}
