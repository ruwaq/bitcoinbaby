"use client";

/**
 * useFeeEstimate Hook
 *
 * Fetches current Bitcoin network fee estimates from mempool.space.
 * Uses TanStack Query for caching and automatic refetch.
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { createMempoolClient, type FeeEstimates } from "@bitcoinbaby/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export type FeePriority = "fastest" | "fast" | "medium" | "slow";

export interface UseFeeEstimateReturn {
  /** All fee estimates */
  fees: FeeEstimates | null;
  /** Get fee rate for a specific priority */
  getFeeRate: (priority: FeePriority) => number;
  /** Is loading */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh fees */
  refresh: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/** Default fallback fees if API fails */
const DEFAULT_FEES: FeeEstimates = {
  fastestFee: 20,
  halfHourFee: 15,
  hourFee: 10,
  economyFee: 5,
  minimumFee: 1,
};

// =============================================================================
// HOOK
// =============================================================================

export function useFeeEstimate(): UseFeeEstimateReturn {
  // Mempool client
  const mempoolClient = useMemo(
    () => createMempoolClient({ network: "testnet4" }),
    [],
  );

  // Query for fee estimates
  const {
    data: fees,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["fee-estimates"],
    queryFn: () => mempoolClient.getFeeEstimates(),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 60 * 1000, // 1 minute
    refetchInterval: 60 * 1000, // Auto-refresh every minute
    retry: 2,
  });

  /**
   * Get fee rate for a specific priority
   */
  const getFeeRate = (priority: FeePriority): number => {
    const feeData = fees || DEFAULT_FEES;

    switch (priority) {
      case "fastest":
        return feeData.fastestFee;
      case "fast":
        return feeData.halfHourFee;
      case "medium":
        return feeData.hourFee;
      case "slow":
        return feeData.economyFee;
      default:
        return feeData.hourFee;
    }
  };

  /**
   * Refresh fee estimates
   */
  const refresh = async () => {
    await refetch();
  };

  return {
    fees: fees || null,
    getFeeRate,
    isLoading,
    error:
      error instanceof Error ? error.message : error ? String(error) : null,
    refresh,
  };
}

export default useFeeEstimate;
