"use client";

/**
 * useWithdrawPool Hook
 *
 * Manages withdrawal requests from virtual balance to Bitcoin.
 * Supports batched withdrawals via weekly/monthly pools for lower fees.
 */

import { useState, useEffect, useCallback } from "react";
import { getApiClient } from "@bitcoinbaby/core";
import type {
  PoolType,
  PoolStatusResponse,
  WithdrawRequest,
} from "@bitcoinbaby/core";

/**
 * Pool info with extended data
 */
interface PoolInfo extends PoolStatusResponse {
  name: string;
  description: string;
}

/**
 * Withdrawal pool state
 */
interface WithdrawPoolState {
  /** All pool statuses */
  pools: Record<PoolType, PoolInfo | null>;
  /** User's pending withdrawal requests */
  requests: WithdrawRequest[];
  /** Loading state */
  isLoading: boolean;
  /** Submitting state */
  isSubmitting: boolean;
  /** Error message */
  error: string | null;
  /** Last update timestamp */
  lastUpdated: number | null;
}

/**
 * Withdrawal pool actions
 */
interface WithdrawPoolActions {
  /** Create a withdrawal request */
  createWithdrawRequest: (
    poolType: PoolType,
    toAddress: string,
    amount: bigint,
    maxFeeRate?: number,
  ) => Promise<{ success: boolean; requestId?: string; error?: string }>;
  /** Cancel a pending withdrawal request */
  cancelRequest: (
    poolType: PoolType,
    requestId: string,
  ) => Promise<{ success: boolean; released?: string; error?: string }>;
  /** Refresh pool statuses */
  refresh: () => Promise<void>;
  /** Get recommended pool based on amount and urgency */
  getRecommendedPool: (amount: bigint, urgent: boolean) => PoolType;
}

type UseWithdrawPoolReturn = WithdrawPoolState & WithdrawPoolActions;

/**
 * Options for useWithdrawPool
 */
interface UseWithdrawPoolOptions {
  /** User's wallet address */
  address?: string;
  /** Auto-refresh interval in ms (default: 120000 = 2 minutes) */
  refreshInterval?: number;
}

/**
 * Get API client - uses singleton from @bitcoinbaby/core
 * Environment is auto-detected by getApiClient()
 */
function getClient() {
  return getApiClient();
}

/**
 * useWithdrawPool Hook
 *
 * @example
 * ```tsx
 * const {
 *   pools,
 *   requests,
 *   createWithdrawRequest,
 *   cancelRequest,
 *   getRecommendedPool,
 * } = useWithdrawPool({ address: walletAddress });
 *
 * // Get recommended pool for amount
 * const poolType = getRecommendedPool(1000n, false);
 *
 * // Create withdrawal request
 * const result = await createWithdrawRequest(
 *   poolType,
 *   destinationAddress,
 *   1000n,
 * );
 * ```
 */
export function useWithdrawPool(
  options: UseWithdrawPoolOptions = {},
): UseWithdrawPoolReturn {
  const { address, refreshInterval = 120000 } = options;

  // State
  const [state, setState] = useState<WithdrawPoolState>({
    pools: {
      weekly: null,
      monthly: null,
      low_fee: null,
      immediate: null,
    },
    requests: [],
    isLoading: false,
    isSubmitting: false,
    error: null,
    lastUpdated: null,
  });

  /**
   * Fetch all pool statuses
   */
  const fetchPoolStatuses = useCallback(async (): Promise<void> => {
    try {
      const client = getClient();
      const poolTypes: PoolType[] = [
        "weekly",
        "monthly",
        "low_fee",
        "immediate",
      ];

      const results = await Promise.all(
        poolTypes.map(async (poolType) => {
          try {
            const response = await client.getPoolStatus(poolType);
            if (response.success && response.data) {
              return [poolType, response.data as PoolInfo] as const;
            }
            return [poolType, null] as const;
          } catch {
            return [poolType, null] as const;
          }
        }),
      );

      const pools = Object.fromEntries(results) as Record<
        PoolType,
        PoolInfo | null
      >;

      setState((prev) => ({
        ...prev,
        pools,
        lastUpdated: Date.now(),
      }));
    } catch (error) {
      console.error("[WithdrawPool] Failed to fetch pool statuses:", error);
    }
  }, []);

  /**
   * Fetch user's withdrawal requests
   */
  const fetchUserRequests = useCallback(async (): Promise<void> => {
    if (!address) return;

    try {
      const client = getClient();
      const poolTypes: PoolType[] = [
        "weekly",
        "monthly",
        "low_fee",
        "immediate",
      ];
      const allRequests: WithdrawRequest[] = [];

      for (const poolType of poolTypes) {
        try {
          const response = await client.getUserWithdrawRequests(
            poolType,
            address,
          );
          if (response.success && response.data) {
            allRequests.push(...response.data);
          }
        } catch {
          // Ignore individual pool errors
        }
      }

      // Sort by requestedAt descending
      allRequests.sort((a, b) => b.requestedAt - a.requestedAt);

      setState((prev) => ({
        ...prev,
        requests: allRequests,
      }));
    } catch (error) {
      console.error("[WithdrawPool] Failed to fetch user requests:", error);
    }
  }, [address]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (): Promise<void> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    await Promise.all([fetchPoolStatuses(), fetchUserRequests()]);

    setState((prev) => ({ ...prev, isLoading: false }));
  }, [fetchPoolStatuses, fetchUserRequests]);

  /**
   * Create withdrawal request
   */
  const createWithdrawRequest = useCallback(
    async (
      poolType: PoolType,
      toAddress: string,
      amount: bigint,
      maxFeeRate?: number,
    ): Promise<{ success: boolean; requestId?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "No wallet address" };
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        const client = getClient();
        const response = await client.createWithdrawRequest(
          poolType,
          address,
          toAddress,
          amount.toString(),
          maxFeeRate,
        );

        if (response.success && response.data) {
          // Refresh to get updated state
          await refresh();

          setState((prev) => ({ ...prev, isSubmitting: false }));

          return {
            success: true,
            requestId: response.data.requestId,
          };
        }

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: response.error ?? "Failed to create request",
        }));

        return {
          success: false,
          error: response.error ?? "Failed to create request",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Request failed";

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }));

        return { success: false, error: errorMessage };
      }
    },
    [address, refresh],
  );

  /**
   * Cancel withdrawal request
   */
  const cancelRequest = useCallback(
    async (
      poolType: PoolType,
      requestId: string,
    ): Promise<{ success: boolean; released?: string; error?: string }> => {
      if (!address) {
        return { success: false, error: "No wallet address" };
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        const client = getClient();
        const response = await client.cancelWithdrawRequest(
          poolType,
          requestId,
          address,
        );

        if (response.success && response.data) {
          // Refresh to get updated state
          await refresh();

          setState((prev) => ({ ...prev, isSubmitting: false }));

          return {
            success: true,
            released: response.data.released,
          };
        }

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: response.error ?? "Failed to cancel request",
        }));

        return {
          success: false,
          error: response.error ?? "Failed to cancel request",
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Cancel failed";

        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }));

        return { success: false, error: errorMessage };
      }
    },
    [address, refresh],
  );

  /**
   * Get recommended pool based on amount and urgency
   */
  const getRecommendedPool = useCallback(
    (amount: bigint, urgent: boolean): PoolType => {
      // If urgent, use immediate
      if (urgent) {
        return "immediate";
      }

      // Check low_fee pool if fees are currently low
      const lowFeePool = state.pools.low_fee;
      if (lowFeePool && lowFeePool.currentFeeRate <= 5) {
        return "low_fee";
      }

      // For larger amounts, weekly is better (more users = lower fee per user)
      const weeklyPool = state.pools.weekly;
      const monthlyPool = state.pools.monthly;

      // If weekly pool has more pending users, use it (better fee sharing)
      if (
        weeklyPool &&
        monthlyPool &&
        weeklyPool.pendingRequests > monthlyPool.pendingRequests
      ) {
        return "weekly";
      }

      // Default to monthly for maximum fee savings
      return "monthly";
    },
    [state.pools],
  );

  // Initial fetch and auto-refresh
  useEffect(() => {
    // Defer to avoid React compiler warning about setState in effect
    queueMicrotask(() => refresh());

    if (refreshInterval > 0) {
      const interval = setInterval(refresh, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refresh, refreshInterval]);

  return {
    ...state,
    createWithdrawRequest,
    cancelRequest,
    refresh,
    getRecommendedPool,
  };
}

/**
 * Format pool type for display
 */
export function formatPoolType(poolType: PoolType): string {
  switch (poolType) {
    case "weekly":
      return "Weekly Pool";
    case "monthly":
      return "Monthly Pool";
    case "low_fee":
      return "Low Fee Pool";
    case "immediate":
      return "Immediate";
    default:
      return poolType;
  }
}

/**
 * Get pool description
 */
export function getPoolDescription(poolType: PoolType): string {
  switch (poolType) {
    case "weekly":
      return "Processed every Sunday - Lowest fees";
    case "monthly":
      return "Processed on 1st of month - Lowest fees";
    case "low_fee":
      return "Processed when Bitcoin fees are low";
    case "immediate":
      return "Process ASAP - Higher fees";
    default:
      return "";
  }
}

export type {
  WithdrawPoolState,
  WithdrawPoolActions,
  UseWithdrawPoolReturn,
  UseWithdrawPoolOptions,
  PoolInfo,
};
