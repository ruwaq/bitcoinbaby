"use client";

/**
 * useTokenBalance Hook
 *
 * Tracks $BABY token balance using a hybrid approach:
 * - Queries confirmed balance from Scrolls API (Charms indexer)
 * - Tracks local pending rewards from mining
 * - Merges both for total display
 *
 * Tokens in Charms are embedded in UTXOs and indexed by Scrolls.
 */

import { useState, useEffect, useCallback, useRef } from "react";
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
  /** Cache duration in ms (default: 30000) */
  cacheDuration?: number;
}

// Cache configuration
const CACHE_MAX_SIZE = 50; // Maximum entries in cache
const CACHE_MAX_AGE = 5 * 60 * 1000; // 5 minutes max age for any entry

// Global cache for token balances to avoid excessive API calls
const balanceCache = new Map<
  string,
  {
    balance: TokenBalance | null;
    timestamp: number;
  }
>();

/**
 * Generate cache key for address + network + ticker
 */
function getCacheKey(
  address: string,
  network: ScrollsNetwork,
  ticker: string,
): string {
  return `${network}:${address}:${ticker}`;
}

/**
 * Clean up expired and excess cache entries (LRU-style)
 */
function cleanupCache(): void {
  const now = Date.now();

  // Remove expired entries
  for (const [key, value] of balanceCache.entries()) {
    if (now - value.timestamp > CACHE_MAX_AGE) {
      balanceCache.delete(key);
    }
  }

  // If still over max size, remove oldest entries
  if (balanceCache.size > CACHE_MAX_SIZE) {
    const entries = Array.from(balanceCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp,
    );

    const toRemove = entries.slice(0, balanceCache.size - CACHE_MAX_SIZE);
    for (const [key] of toRemove) {
      balanceCache.delete(key);
    }
  }
}

/**
 * useTokenBalance Hook
 *
 * Tracks $BABY token balance using hybrid local + on-chain approach.
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
 *
 * // Display balance
 * console.log(`Total: ${balance}, Confirmed: ${confirmedBalance}, Pending: ${pendingBalance}`);
 * ```
 */
export function useTokenBalance(
  options: UseTokenBalanceOptions = {},
): UseTokenBalanceReturn {
  const {
    address,
    tokenTicker = "BABY",
    initialPendingBalance = BigInt(0),
    refreshInterval = 60000, // 1 minute default
    cacheDuration = 30000, // 30 seconds cache
  } = options;

  // Network configuration
  const { config } = useNetworkStore();
  const scrollsNetwork: ScrollsNetwork = config.scrolls;

  // Scrolls client ref (recreated on network change)
  const clientRef = useRef<ScrollsClient | null>(null);

  // Initialize client when network changes
  useEffect(() => {
    clientRef.current = createScrollsClient({
      baseUrl: config.scrollsApi.replace("/api/v1", ""), // Base URL without path
      network: scrollsNetwork,
    });
  }, [config.scrollsApi, scrollsNetwork]);

  // State
  const [state, setState] = useState<TokenBalanceState>({
    balance: initialPendingBalance,
    confirmedBalance: BigInt(0),
    pendingBalance: initialPendingBalance,
    tokens:
      initialPendingBalance > BigInt(0)
        ? [
            {
              ticker: tokenTicker,
              confirmed: BigInt(0),
              pending: initialPendingBalance,
              total: initialPendingBalance,
              lastUpdated: Date.now(),
            },
          ]
        : [],
    isLoading: false,
    error: null,
    lastUpdated: initialPendingBalance > BigInt(0) ? Date.now() : null,
    isApiAvailable: true, // Assume available until proven otherwise
    network: scrollsNetwork,
  });

  // Refresh interval ref
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  /**
   * Fetch balance from Scrolls API with caching
   */
  const fetchBalance = useCallback(
    async (ignoreCache = false): Promise<TokenBalance | null> => {
      if (!address || !clientRef.current) return null;

      const cacheKey = getCacheKey(address, scrollsNetwork, tokenTicker);

      // Check cache
      if (!ignoreCache) {
        const cached = balanceCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < cacheDuration) {
          return cached.balance;
        }
      }

      try {
        const balance = await clientRef.current.getTokenBalance(
          address,
          tokenTicker,
        );

        // Update cache and cleanup old entries
        balanceCache.set(cacheKey, {
          balance,
          timestamp: Date.now(),
        });
        cleanupCache();

        return balance;
      } catch (error) {
        // Clear cache on error
        balanceCache.delete(cacheKey);
        throw error;
      }
    },
    [address, scrollsNetwork, tokenTicker, cacheDuration],
  );

  /**
   * Refresh balance from Scrolls API
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!address) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const onChainBalance = await fetchBalance();

      const confirmedBalance = onChainBalance?.amount ?? BigInt(0);

      setState((prev) => {
        const total = confirmedBalance + prev.pendingBalance;
        return {
          ...prev,
          balance: total,
          confirmedBalance,
          tokens: [
            {
              ticker: tokenTicker,
              confirmed: confirmedBalance,
              pending: prev.pendingBalance,
              total,
              lastUpdated: Date.now(),
            },
          ],
          isLoading: false,
          isApiAvailable: true,
          lastUpdated: Date.now(),
          network: scrollsNetwork,
        };
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch balance";

      // Check if it's a 404 (API not available for token balances)
      const isNotFound =
        error instanceof Error && error.message.includes("404");

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: isNotFound ? null : errorMessage, // Don't show error for 404
        isApiAvailable: !isNotFound,
        lastUpdated: Date.now(),
      }));
    }
  }, [address, fetchBalance, tokenTicker, scrollsNetwork]);

  /**
   * Force refresh ignoring cache
   */
  const forceRefresh = useCallback(async (): Promise<void> => {
    if (!address) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const onChainBalance = await fetchBalance(true); // Ignore cache

      const confirmedBalance = onChainBalance?.amount ?? BigInt(0);

      setState((prev) => {
        const total = confirmedBalance + prev.pendingBalance;
        return {
          ...prev,
          balance: total,
          confirmedBalance,
          tokens: [
            {
              ticker: tokenTicker,
              confirmed: confirmedBalance,
              pending: prev.pendingBalance,
              total,
              lastUpdated: Date.now(),
            },
          ],
          isLoading: false,
          isApiAvailable: true,
          lastUpdated: Date.now(),
          network: scrollsNetwork,
        };
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch balance";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        lastUpdated: Date.now(),
      }));
    }
  }, [address, fetchBalance, tokenTicker, scrollsNetwork]);

  /**
   * Add tokens to pending balance (from mining rewards)
   */
  const addPendingTokens = useCallback(
    (amount: bigint): void => {
      setState((prev) => {
        const newPending = prev.pendingBalance + amount;
        const newTotal = prev.confirmedBalance + newPending;
        return {
          ...prev,
          balance: newTotal,
          pendingBalance: newPending,
          tokens: [
            {
              ticker: tokenTicker,
              confirmed: prev.confirmedBalance,
              pending: newPending,
              total: newTotal,
              lastUpdated: Date.now(),
            },
          ],
          lastUpdated: Date.now(),
        };
      });
    },
    [tokenTicker],
  );

  /**
   * Move pending tokens to confirmed (after tx confirmation)
   */
  const confirmTokens = useCallback(
    (amount: bigint): void => {
      setState((prev) => {
        // Don't confirm more than pending
        const toConfirm =
          amount > prev.pendingBalance ? prev.pendingBalance : amount;
        const newPending = prev.pendingBalance - toConfirm;
        const newConfirmed = prev.confirmedBalance + toConfirm;
        const newTotal = newConfirmed + newPending;

        return {
          ...prev,
          balance: newTotal,
          confirmedBalance: newConfirmed,
          pendingBalance: newPending,
          tokens: [
            {
              ticker: tokenTicker,
              confirmed: newConfirmed,
              pending: newPending,
              total: newTotal,
              lastUpdated: Date.now(),
            },
          ],
          lastUpdated: Date.now(),
        };
      });
    },
    [tokenTicker],
  );

  /**
   * Reset all balances
   */
  const reset = useCallback((): void => {
    // Clear cache for this address
    if (address) {
      const cacheKey = getCacheKey(address, scrollsNetwork, tokenTicker);
      balanceCache.delete(cacheKey);
    }

    setState({
      balance: BigInt(0),
      confirmedBalance: BigInt(0),
      pendingBalance: BigInt(0),
      tokens: [],
      isLoading: false,
      error: null,
      lastUpdated: Date.now(),
      isApiAvailable: true,
      network: scrollsNetwork,
    });
  }, [address, scrollsNetwork, tokenTicker]);

  /**
   * Reset and refresh when address or network changes
   */
  useEffect(() => {
    if (!address) {
      setState({
        balance: BigInt(0),
        confirmedBalance: BigInt(0),
        pendingBalance: BigInt(0),
        tokens: [],
        isLoading: false,
        error: null,
        lastUpdated: null,
        isApiAvailable: true,
        network: scrollsNetwork,
      });
      return;
    }

    // Refresh balance when address or network changes
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, scrollsNetwork]); // Don't include refresh to avoid loop

  /**
   * Set up auto-refresh interval
   */
  useEffect(() => {
    // Clear existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }

    // Set up new interval if enabled and address is set
    if (refreshInterval > 0 && address) {
      refreshIntervalRef.current = setInterval(() => {
        refresh();
      }, refreshInterval);
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    };
  }, [refreshInterval, address, refresh]);

  return {
    ...state,
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
 * Clear all cached balances
 */
export function clearBalanceCache(): void {
  balanceCache.clear();
}

/**
 * Clear cached balance for specific address
 */
export function clearAddressBalanceCache(
  address: string,
  network: ScrollsNetwork,
  ticker: string = "BABY",
): void {
  const cacheKey = getCacheKey(address, network, ticker);
  balanceCache.delete(cacheKey);
}

export type {
  TokenBalanceState,
  TokenBalanceActions,
  UseTokenBalanceReturn,
  UseTokenBalanceOptions,
  TokenInfo,
};
