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
 *
 * Uses TanStack Query for caching and background refetch.
 * Replaces manual setInterval polling with stale-while-revalidate.
 */

import { useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  /** Auto-refresh interval in ms (default: 60000).
   * Now powered by TanStack Query refetchInterval */
  refreshInterval?: number;
}

/**
 * Get API client - uses the same singleton as SyncManager
 */
function getClient() {
  return getApiClient();
}

/**
 * Raw balance fetch — used by TanStack Query.
 * Returns null for virtual data when Workers API is unreachable
 * so the query stays in "success" state with stale data.
 */
async function fetchBalanceData(
  address: string,
  tokenTicker: string,
  explorerClient: CharmsExplorerClient,
): Promise<{
  virtualData: BalanceResponse | null;
  onChainBalance: bigint;
}> {
  const [virtualResult, onChainResult] = await Promise.allSettled([
    getClient()
      .getBalance(address)
      .then((r) => (r.success && r.data ? r.data : null)),
    explorerClient.getTokenBalance(address, tokenTicker),
  ]);

  return {
    virtualData:
      virtualResult.status === "fulfilled" ? virtualResult.value : null,
    onChainBalance:
      onChainResult.status === "fulfilled" ? onChainResult.value : 0n,
  };
}

/**
 * Derive the full VirtualBalanceState from raw fetched data.
 * Pure function — no side effects.
 */
function deriveBalanceState(raw: {
  virtualData: BalanceResponse | null;
  onChainBalance: bigint;
}): Omit<VirtualBalanceState, "isLoading" | "error" | "lastUpdated"> {
  const { virtualData, onChainBalance } = raw;

  const virtualBalance = virtualData ? BigInt(virtualData.virtualBalance) : 0n;
  const pendingWithdraw = virtualData
    ? BigInt(virtualData.pendingWithdraw)
    : 0n;
  const totalMined = virtualData ? BigInt(virtualData.totalMined) : 0n;
  const totalWithdrawn = virtualData ? BigInt(virtualData.totalWithdrawn) : 0n;
  const availableToWithdraw = virtualData
    ? BigInt(virtualData.availableToWithdraw)
    : 0n;

  return {
    totalBalance: virtualBalance + onChainBalance,
    virtualBalance,
    pendingWithdraw,
    availableToWithdraw,
    onChainBalance,
    totalMined,
    totalWithdrawn,
    workersApiAvailable: virtualData !== null,
    explorerApiAvailable: true,
  };
}

/** Empty state when no address is connected */
const EMPTY_STATE: VirtualBalanceState = {
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
};

/**
 * useVirtualBalance Hook — TanStack Query powered
 *
 * Query key: ['virtual-balance', address, tokenTicker]
 * Stale time: 30s (from QueryClient defaults)
 * Refetch interval: configurable (default 60s)
 *
 * Also listens for 'mining:sync-success' DOM events to invalidate
 * the query cache immediately after a mining sync completes.
 */
export function useVirtualBalance(
  options: UseVirtualBalanceOptions = {},
): UseVirtualBalanceReturn {
  const { address, tokenTicker = "BABY", refreshInterval = 60000 } = options;

  const queryClient = useQueryClient();

  // Network config for Explorer
  const { config } = useNetworkStore();
  const explorerNetwork: ExplorerNetwork =
    config.scrolls === "main" ? "mainnet" : "testnet4";

  // Explorer client ref — stable across renders
  const explorerClientRef = useRef<CharmsExplorerClient | null>(null);
  if (!explorerClientRef.current) {
    explorerClientRef.current = createExplorerClient({
      network: explorerNetwork,
    });
  }

  // Re-create explorer client if network changes
  useEffect(() => {
    explorerClientRef.current = createExplorerClient({
      network: explorerNetwork,
    });
  }, [explorerNetwork]);

  // Debounce timer ref for sync events
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- TanStack Query: Balance fetching ----
  const {
    data: balanceData,
    isLoading,
    error: queryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["virtual-balance", address, tokenTicker],
    queryFn: async () => {
      if (!address || !explorerClientRef.current) {
        return null;
      }
      return fetchBalanceData(address, tokenTicker, explorerClientRef.current);
    },
    enabled: !!address,
    refetchInterval: address ? refreshInterval : false,
    // Keep previous data while fetching to avoid UI flicker
    placeholderData: (prev) => prev,
  });

  // Derive balance state from query data
  const derived = balanceData ? deriveBalanceState(balanceData) : null;

  const balanceState: VirtualBalanceState = !address
    ? EMPTY_STATE
    : derived
      ? {
          ...derived,
          isLoading,
          error: queryError instanceof Error ? queryError.message : null,
          lastUpdated: dataUpdatedAt ?? null,
        }
      : {
          ...EMPTY_STATE,
          isLoading,
          error: queryError instanceof Error ? queryError.message : null,
          lastUpdated: dataUpdatedAt ?? null,
          workersApiAvailable: true,
          explorerApiAvailable: true,
        };

  // ---- Refresh actions ----
  const refresh = useCallback(async (): Promise<void> => {
    if (!address) return;
    await queryClient.invalidateQueries({
      queryKey: ["virtual-balance", address, tokenTicker],
    });
  }, [address, tokenTicker, queryClient]);

  const forceRefresh = useCallback(async (): Promise<void> => {
    if (!address) return;
    await queryClient.refetchQueries({
      queryKey: ["virtual-balance", address, tokenTicker],
    });
  }, [address, tokenTicker, queryClient]);

  // ---- Credit mining (mutation — keeps existing pattern for SyncManager compat) ----
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

        if (response.success && response.data) {
          // Invalidate the balance query to trigger a refetch with fresh data
          queryClient.invalidateQueries({
            queryKey: ["virtual-balance", address, tokenTicker],
          });

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
    [address, tokenTicker, queryClient],
  );

  // ---- Event-driven refresh on mining sync ----
  useEffect(() => {
    if (!address) return;

    const handleSyncSuccess = () => {
      // Debounce multiple rapid syncs to avoid thundering herd
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      syncDebounceRef.current = setTimeout(() => {
        syncDebounceRef.current = null;
        queryClient.invalidateQueries({
          queryKey: ["virtual-balance", address, tokenTicker],
        });
      }, 500);
    };

    window.addEventListener("mining:sync-success", handleSyncSuccess);
    return () => {
      window.removeEventListener("mining:sync-success", handleSyncSuccess);
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, [address, tokenTicker, queryClient]);

  return {
    ...balanceState,
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
