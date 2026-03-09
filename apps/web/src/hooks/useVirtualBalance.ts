"use client";

/**
 * useVirtualBalance Hook
 *
 * Integrates Workers API virtual balance with on-chain balance.
 * Provides unified view of all token balances:
 * - Virtual balance (accumulated in Workers, not yet withdrawn to Bitcoin)
 * - On-chain balance (confirmed on Bitcoin via Charms)
 * - Pending balance (local mining rewards not yet credited)
 *
 * This is the primary balance hook for production use.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getApiClient, useNetworkStore } from "@bitcoinbaby/core";
import type { BalanceResponse, ApiMiningProof } from "@bitcoinbaby/core";
import {
  createExplorerClient,
  type CharmsExplorerClient,
  type ExplorerNetwork,
} from "@bitcoinbaby/bitcoin";

/**
 * Unified balance state
 */
interface VirtualBalanceState {
  /** Total balance (virtual + on-chain) */
  totalBalance: bigint;
  /** Virtual balance stored in Workers */
  virtualBalance: bigint;
  /** Amount pending withdrawal */
  pendingWithdraw: bigint;
  /** Available to withdraw (virtual - pending) */
  availableToWithdraw: bigint;
  /** On-chain confirmed balance (from Charms Explorer) */
  onChainBalance: bigint;
  /** Total mined all-time (from Workers) */
  totalMined: bigint;
  /** Total withdrawn to Bitcoin */
  totalWithdrawn: bigint;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: number | null;
  /** Workers API connectivity */
  workersApiAvailable: boolean;
  /** Explorer API connectivity */
  explorerApiAvailable: boolean;
}

/**
 * Virtual balance actions
 */
interface VirtualBalanceActions {
  /** Credit mining reward to virtual balance */
  creditMining: (proof: {
    hash: string;
    nonce: number;
    difficulty: number;
    blockData: string;
    reward: bigint;
  }) => Promise<{ success: boolean; credited?: string; error?: string }>;
  /** Refresh all balances */
  refresh: () => Promise<void>;
  /** Force refresh ignoring cache */
  forceRefresh: () => Promise<void>;
}

type UseVirtualBalanceReturn = VirtualBalanceState & VirtualBalanceActions;

/**
 * Options for useVirtualBalance
 */
interface UseVirtualBalanceOptions {
  /** Wallet address */
  address?: string;
  /** Token ticker (default: 'BABY') */
  tokenTicker?: string;
  /** Auto-refresh interval in ms (default: 60000) */
  refreshInterval?: number;
}

/**
 * Get API client - uses the same singleton as SyncManager
 * Environment is auto-detected: production when not on localhost
 */
function getClient() {
  // getApiClient() from @bitcoinbaby/core returns a singleton
  // It defaults to "production" which is correct for deployed apps
  // For local development, the dev server should be running on localhost:8787
  return getApiClient();
}

/**
 * useVirtualBalance Hook
 *
 * @example
 * ```tsx
 * const {
 *   totalBalance,
 *   virtualBalance,
 *   onChainBalance,
 *   availableToWithdraw,
 *   creditMining,
 *   refresh,
 * } = useVirtualBalance({ address: walletAddress });
 *
 * // Credit mining reward
 * const result = await creditMining({
 *   hash: '0000abc...',
 *   nonce: 12345,
 *   difficulty: 18,
 *   blockData: '...',
 *   reward: 1000n,
 * });
 * ```
 */
export function useVirtualBalance(
  options: UseVirtualBalanceOptions = {},
): UseVirtualBalanceReturn {
  const { address, tokenTicker = "BABY", refreshInterval = 60000 } = options;

  // Network config for Explorer
  const { config } = useNetworkStore();
  const explorerNetwork: ExplorerNetwork =
    config.scrolls === "main" ? "mainnet" : "testnet4";

  // Explorer client ref
  const explorerClientRef = useRef<CharmsExplorerClient | null>(null);

  // Debounce timer ref for sync events
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mounted flag to prevent setState on unmounted component
  const isMountedRef = useRef(true);

  // Track mounted state to prevent setState on unmounted component
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize Explorer client
  useEffect(() => {
    explorerClientRef.current = createExplorerClient({
      network: explorerNetwork,
    });
  }, [explorerNetwork]);

  // State
  const [state, setState] = useState<VirtualBalanceState>({
    totalBalance: 0n,
    virtualBalance: 0n,
    pendingWithdraw: 0n,
    availableToWithdraw: 0n,
    onChainBalance: 0n,
    totalMined: 0n,
    totalWithdrawn: 0n,
    isLoading: false,
    error: null,
    lastUpdated: null,
    workersApiAvailable: true,
    explorerApiAvailable: true,
  });

  /**
   * Fetch virtual balance from Workers API
   */
  const fetchVirtualBalance =
    useCallback(async (): Promise<BalanceResponse | null> => {
      if (!address) return null;

      try {
        const client = getClient();
        const response = await client.getBalance(address);

        if (response.success && response.data) {
          return response.data;
        }
        return null;
      } catch (error) {
        console.error("[VirtualBalance] Workers API error:", error);
        return null;
      }
    }, [address]);

  /**
   * Fetch on-chain balance from Charms Explorer API
   * Uses the Charms Explorer indexer for balance queries
   */
  const fetchOnChainBalance = useCallback(async (): Promise<bigint> => {
    if (!address || !explorerClientRef.current) return 0n;

    try {
      const balance = await explorerClientRef.current.getTokenBalance(
        address,
        tokenTicker,
      );
      return balance;
    } catch (error) {
      // Explorer API error - silently return 0
      console.warn("[VirtualBalance] Explorer API error:", error);
      return 0n;
    }
  }, [address, tokenTicker]);

  /**
   * Refresh all balances
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!address) return;

    // Check if still mounted before setState
    if (!isMountedRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Fetch both in parallel using allSettled for resilience
      const results = await Promise.allSettled([
        fetchVirtualBalance(),
        fetchOnChainBalance(),
      ]);

      // Check if still mounted after async operations
      if (!isMountedRef.current) return;

      // Extract results - use null/0n if fetch failed
      const virtualResult = results[0];
      const onChainResult = results[1];

      const virtualData =
        virtualResult.status === "fulfilled" ? virtualResult.value : null;
      const onChainBalance =
        onChainResult.status === "fulfilled" ? onChainResult.value : 0n;

      const virtualBalance = virtualData
        ? BigInt(virtualData.virtualBalance)
        : 0n;
      const pendingWithdraw = virtualData
        ? BigInt(virtualData.pendingWithdraw)
        : 0n;
      const totalMined = virtualData ? BigInt(virtualData.totalMined) : 0n;
      const totalWithdrawn = virtualData
        ? BigInt(virtualData.totalWithdrawn)
        : 0n;
      const availableToWithdraw = virtualData
        ? BigInt(virtualData.availableToWithdraw)
        : 0n;

      // Total = virtual (not yet on-chain) + on-chain confirmed
      const totalBalance = virtualBalance + onChainBalance;

      // Collect errors if any
      const errors: string[] = [];
      if (virtualResult.status === "rejected") {
        errors.push(`Workers: ${virtualResult.reason}`);
      }
      if (onChainResult.status === "rejected") {
        errors.push(`Explorer: ${onChainResult.reason}`);
      }

      setState({
        totalBalance,
        virtualBalance,
        pendingWithdraw,
        availableToWithdraw,
        onChainBalance,
        totalMined,
        totalWithdrawn,
        isLoading: false,
        error: errors.length > 0 ? errors.join("; ") : null,
        lastUpdated: Date.now(),
        workersApiAvailable: virtualData !== null,
        explorerApiAvailable: onChainResult.status === "fulfilled",
      });
    } catch (error) {
      // Check if still mounted after async operations
      if (!isMountedRef.current) return;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch balance",
        lastUpdated: Date.now(),
      }));
    }
  }, [address, fetchVirtualBalance, fetchOnChainBalance]);

  /**
   * Force refresh
   */
  const forceRefresh = useCallback(async (): Promise<void> => {
    await refresh();
  }, [refresh]);

  /**
   * Credit mining reward to virtual balance
   */
  const creditMining = useCallback(
    async (proof: {
      hash: string;
      nonce: number;
      difficulty: number;
      blockData: string;
      timestamp?: number;
    }): Promise<{ success: boolean; credited?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "No address" };
      }

      try {
        const client = getClient();
        const apiProof: ApiMiningProof = {
          hash: proof.hash,
          nonce: proof.nonce,
          difficulty: proof.difficulty,
          blockData: proof.blockData,
          timestamp: proof.timestamp,
        };

        const response = await client.creditMining(address, apiProof);

        // Check if still mounted after async operation
        if (!isMountedRef.current) {
          return { success: true, credited: response.data?.credited };
        }

        if (response.success && response.data) {
          // Update local state optimistically
          setState((prev) => ({
            ...prev,
            virtualBalance: BigInt(response.data!.newBalance),
            totalBalance:
              BigInt(response.data!.newBalance) + prev.onChainBalance,
            totalMined: prev.totalMined + BigInt(response.data!.credited),
            availableToWithdraw:
              BigInt(response.data!.newBalance) - prev.pendingWithdraw,
            lastUpdated: Date.now(),
          }));

          return {
            success: true,
            credited: response.data.credited,
          };
        }

        return {
          success: false,
          error: response.error ?? "Failed to credit",
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Credit failed",
        };
      }
    },
    [address],
  );

  // Initial fetch and auto-refresh
  useEffect(() => {
    if (!address) {
      setState({
        totalBalance: 0n,
        virtualBalance: 0n,
        pendingWithdraw: 0n,
        availableToWithdraw: 0n,
        onChainBalance: 0n,
        totalMined: 0n,
        totalWithdrawn: 0n,
        isLoading: false,
        error: null,
        lastUpdated: null,
        workersApiAvailable: true,
        explorerApiAvailable: true,
      });
      return;
    }

    refresh();

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [address, refresh, refreshInterval]);

  // Listen for mining sync success events to refresh balance immediately
  useEffect(() => {
    if (!address) return;

    const handleSyncSuccess = () => {
      // Clear any pending debounce to prevent multiple rapid refreshes
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      // Debounce multiple rapid syncs
      syncDebounceRef.current = setTimeout(() => {
        syncDebounceRef.current = null;
        refresh();
      }, 500);
    };

    window.addEventListener("mining:sync-success", handleSyncSuccess);
    return () => {
      window.removeEventListener("mining:sync-success", handleSyncSuccess);
      // Clear timeout on cleanup
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, [address, refresh]);

  return {
    ...state,
    creditMining,
    refresh,
    forceRefresh,
  };
}

export type {
  VirtualBalanceState,
  VirtualBalanceActions,
  UseVirtualBalanceReturn,
  UseVirtualBalanceOptions,
};
