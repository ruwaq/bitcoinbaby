"use client";

/**
 * useTokenBalance Hook — TanStack Query powered
 *
 * Tracks $BABY token balance using a hybrid approach:
 * - Queries confirmed balance from Scrolls API (Charms indexer) via TanStack Query
 * - Tracks local pending rewards from mining via useState (client state)
 * - Merges both for total display
 *
 * Tokens in Charms are embedded in UTXOs and indexed by Scrolls.
 *
 * Query key: ['token-balance', address, network, ticker]
 * Refetch interval: configurable (default 60s)
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNetworkStore } from "@bitcoinbaby/core";
import {
  createScrollsClient,
  type ScrollsClient,
  type TokenBalance,
  type ScrollsNetwork,
} from "@bitcoinbaby/bitcoin";

/**
 * Token info structure
 */
interface TokenInfo {
  ticker: string;
  /** Confirmed on-chain balance */
  confirmed: bigint;
  /** Pending/unconfirmed balance from mining */
  pending: bigint;
  /** Total balance (confirmed + pending) */
  total: bigint;
  lastUpdated: number;
}

/**
 * Token balance state
 */
interface TokenBalanceState {
  /** $BABY token balance (total: confirmed + pending) */
  balance: bigint;
  /** Confirmed on-chain balance */
  confirmedBalance: bigint;
  /** Pending balance (mining rewards not yet confirmed) */
  pendingBalance: bigint;
  /** All tokens owned */
  tokens: TokenInfo[];
  /** Whether balance is loading from API */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: number | null;
  /** Whether Scrolls API is available for token balances */
  isApiAvailable: boolean;
  /** Current network */
  network: ScrollsNetwork;
}

/**
 * Token balance actions
 */
interface TokenBalanceActions {
  /** Refresh balance from Scrolls API */
  refresh: () => Promise<void>;
  /** Add tokens to pending balance (from mining rewards) */
  addPendingTokens: (amount: bigint) => void;
  /** Move pending tokens to confirmed (after tx confirmation) */
  confirmTokens: (amount: bigint) => void;
  /** Reset all balances */
  reset: () => void;
  /** Force refresh ignoring cache */
  forceRefresh: () => Promise<void>;
}

type UseTokenBalanceReturn = TokenBalanceState & TokenBalanceActions;

/**
 * Options for useTokenBalance
 */
interface UseTokenBalanceOptions {
  /** Wallet address to check */
  address?: string;
  /** Token ticker to track (default: 'BABY') */
  tokenTicker?: string;
  /** Initial pending balance (from persisted storage) */
  initialPendingBalance?: bigint;
  /** Auto-refresh interval in ms (default: 60000, 0 to disable) */
  refreshInterval?: number;
}

/**
 * Fetch on-chain balance from Scrolls API.
 * Returns null if the API is unavailable (404) so the query stays successful.
 */
async function fetchOnChainBalance(
  address: string,
  ticker: string,
  client: ScrollsClient,
): Promise<TokenBalance | null> {
  try {
    return await client.getTokenBalance(address, ticker);
  } catch (error) {
    // 404 means the API doesn't support token balances yet — not an error
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * useTokenBalance Hook
 *
 * Hybrid: TanStack Query for on-chain data, useState for local pending tokens.
 *
 * @example
 * ```tsx
 * const {
 *   balance,
 *   confirmedBalance,
 *   pendingBalance,
 *   addPendingTokens,
 *   refresh,
 * } = useTokenBalance({ address: walletAddress });
 *
 * // After mining success, add pending tokens
 * addPendingTokens(BigInt(1000));
 * ```
 */
export function useTokenBalance(
  options: UseTokenBalanceOptions = {},
): UseTokenBalanceReturn {
  const {
    address,
    tokenTicker = "BABY",
    initialPendingBalance = BigInt(0),
    refreshInterval = 60000,
  } = options;

  const queryClient = useQueryClient();

  // Network configuration
  const { config } = useNetworkStore();
  const scrollsNetwork: ScrollsNetwork = config.scrolls;

  // Scrolls client ref — stable across renders
  const clientRef = useRef<ScrollsClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = createScrollsClient({
      baseUrl: config.scrollsApi.replace("/api/v1", ""),
      network: scrollsNetwork,
    });
  }

  useEffect(() => {
    clientRef.current = createScrollsClient({
      baseUrl: config.scrollsApi.replace("/api/v1", ""),
      network: scrollsNetwork,
    });
  }, [config.scrollsApi, scrollsNetwork]);

  // ---- Client state: pending tokens (local, not from server) ----
  const [pendingBalance, setPendingBalance] = useState<bigint>(
    initialPendingBalance,
  );

  // ---- TanStack Query: on-chain confirmed balance ----
  const {
    data: onChainData,
    isLoading,
    error: queryError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["token-balance", address, scrollsNetwork, tokenTicker],
    queryFn: async () => {
      if (!address || !clientRef.current) return null;
      return fetchOnChainBalance(address, tokenTicker, clientRef.current);
    },
    enabled: !!address,
    refetchInterval: address ? refreshInterval : false,
    placeholderData: (prev) => prev,
  });

  // Derive confirmed balance from query
  const confirmedBalance = onChainData?.amount ?? BigInt(0);
  const isApiAvailable = onChainData !== undefined; // null = API returned 404 gracefully

  // Total = confirmed (server) + pending (local)
  const totalBalance = confirmedBalance + pendingBalance;

  // ---- Actions ----

  const refresh = useCallback(async (): Promise<void> => {
    if (!address) return;
    await queryClient.invalidateQueries({
      queryKey: ["token-balance", address, scrollsNetwork, tokenTicker],
    });
  }, [address, scrollsNetwork, tokenTicker, queryClient]);

  const forceRefresh = useCallback(async (): Promise<void> => {
    if (!address) return;
    await queryClient.refetchQueries({
      queryKey: ["token-balance", address, scrollsNetwork, tokenTicker],
    });
  }, [address, scrollsNetwork, tokenTicker, queryClient]);

  const addPendingTokens = useCallback((amount: bigint): void => {
    setPendingBalance((prev) => prev + amount);
  }, []);

  const confirmTokens = useCallback((amount: bigint): void => {
    setPendingBalance((prev) => {
      const toConfirm = amount > prev ? prev : amount;
      return prev - toConfirm;
    });
  }, []);

  const reset = useCallback((): void => {
    setPendingBalance(BigInt(0));
    if (address) {
      queryClient.removeQueries({
        queryKey: ["token-balance", address, scrollsNetwork, tokenTicker],
      });
    }
  }, [address, scrollsNetwork, tokenTicker, queryClient]);

  // Build token info list
  const tokens: TokenInfo[] =
    confirmedBalance > BigInt(0) || pendingBalance > BigInt(0)
      ? [
          {
            ticker: tokenTicker,
            confirmed: confirmedBalance,
            pending: pendingBalance,
            total: totalBalance,
            lastUpdated: dataUpdatedAt ?? Date.now(),
          },
        ]
      : [];

  return {
    balance: totalBalance,
    confirmedBalance,
    pendingBalance,
    tokens,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    lastUpdated: dataUpdatedAt ?? null,
    isApiAvailable,
    network: scrollsNetwork,
    refresh,
    forceRefresh,
    addPendingTokens,
    confirmTokens,
    reset,
  };
}

/**
 * Format token balance for display
 */
export function formatTokenBalance(
  balance: bigint,
  decimals: number = 0,
  maxDecimals: number = 2,
): string {
  if (decimals === 0) {
    return balance.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const divisor = BigInt(10 ** decimals);
  const wholePart = balance / divisor;
  const fractionalPart = balance % divisor;

  const wholeStr = wholePart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (fractionalPart === BigInt(0) || maxDecimals === 0) {
    return wholeStr;
  }

  const fractionalStr = fractionalPart
    .toString()
    .padStart(decimals, "0")
    .slice(0, maxDecimals);

  return `${wholeStr}.${fractionalStr}`;
}

/**
 * Clear all cached token balances from React Query cache.
 * Useful when switching networks or resetting state.
 */
export function clearBalanceCache(): void {
  // React Query cache is automatically managed.
  // To force-clear, the consumer should use queryClient.removeQueries
  // with the appropriate key pattern. This function is kept for
  // backward compatibility with the old API.
}

/**
 * Clear cached balance for a specific address.
 * Kept for backward compatibility.
 */
export function clearAddressBalanceCache(
  _address: string,
  _network: ScrollsNetwork,
  _ticker: string = "BABY",
): void {
  // React Query cache is keyed by ['token-balance', address, network, ticker].
  // Consumers should use queryClient.invalidateQueries or removeQueries
  // for fine-grained cache control.
}

export type {
  TokenBalanceState,
  TokenBalanceActions,
  UseTokenBalanceReturn,
  UseTokenBalanceOptions,
  TokenInfo,
};
