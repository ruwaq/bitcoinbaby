"use client";

/**
 * useNFTExplorer Hook
 *
 * Fetches all minted NFTs with filtering, sorting, and pagination.
 * Used for the Explorer tab to browse the entire collection.
 */

import { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getApiClient,
  type NFTExplorerQuery,
  type NFTRecordWithListing,
} from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface NFTExplorerState {
  /** NFTs for current page */
  nfts: NFTRecordWithListing[];
  /** Total NFTs matching filters */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Total pages */
  totalPages: number;
  /** Statistics */
  stats?: {
    total: number;
    forSale: number;
    byRarity: Record<string, number>;
    byBloodline: Record<string, number>;
  };
  /** Is loading */
  isLoading: boolean;
  /** Is fetching (background refresh) */
  isFetching: boolean;
  /** Error message */
  error: string | null;
}

export interface NFTExplorerActions {
  /** Current filter state */
  filters: NFTExplorerQuery;
  /** Update filters */
  setFilters: (filters: NFTExplorerQuery) => void;
  /** Go to specific page */
  setPage: (page: number) => void;
  /** Refresh data */
  refresh: () => void;
}

export interface UseNFTExplorerReturn
  extends NFTExplorerState, NFTExplorerActions {}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_LIMIT = 20;
const STALE_TIME = 30_000; // 30 seconds
const GC_TIME = 5 * 60_000; // 5 minutes

// =============================================================================
// HOOK
// =============================================================================

export function useNFTExplorer(): UseNFTExplorerReturn {
  // Filter state
  const [filters, setFiltersState] = useState<NFTExplorerQuery>({
    page: 1,
    limit: DEFAULT_LIMIT,
    sort: "newest",
    bloodline: "all",
    rarity: "all",
    forSale: "all",
  });

  // API client
  const apiClient = useMemo(() => getApiClient(), []);

  // Query
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["nft-explorer", filters],
    queryFn: async () => {
      const response = await apiClient.getAllNFTs(filters);
      if (!response.success || !response.data) {
        throw new Error(response.error || "Failed to fetch NFTs");
      }
      return response.data;
    },
    staleTime: STALE_TIME,
    gcTime: GC_TIME,
    refetchOnWindowFocus: true,
  });

  // Actions
  const setFilters = useCallback((newFilters: NFTExplorerQuery) => {
    setFiltersState((prev: NFTExplorerQuery) => ({
      ...prev,
      ...newFilters,
    }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFiltersState((prev: NFTExplorerQuery) => ({
      ...prev,
      page,
    }));
  }, []);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    // State
    nfts: data?.nfts ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? DEFAULT_LIMIT,
    totalPages: data?.totalPages ?? 0,
    stats: data?.stats,
    isLoading,
    isFetching,
    error: error instanceof Error ? error.message : null,

    // Actions
    filters,
    setFilters,
    setPage,
    refresh,
  };
}

export default useNFTExplorer;
