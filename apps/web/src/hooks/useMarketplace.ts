/**
 * useMarketplace Hook
 *
 * Manages NFT marketplace listings, buying, and selling.
 */

"use client";

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getApiClient,
  useWalletStore,
  type NFTListingWithNFT,
} from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface UseMarketplaceReturn {
  /** All active listings */
  listings: NFTListingWithNFT[];
  /** Is loading listings */
  isLoading: boolean;
  /** Is refreshing in background */
  isFetching: boolean;
  /** Error message */
  error: string | null;
  /** Refresh listings */
  refresh: () => Promise<void>;
  /** List an NFT for sale */
  listNFT: (tokenId: number, price: number) => Promise<ListResult>;
  /** Remove an NFT listing */
  unlistNFT: (tokenId: number) => Promise<UnlistResult>;
  /** Buy a listed NFT */
  buyNFT: (tokenId: number) => Promise<BuyResult>;
  /** Is currently listing/unlisting/buying */
  isProcessing: boolean;
  /** Processing error */
  processingError: string | null;
  /** Is wallet connected */
  isWalletConnected: boolean;
}

export interface ListResult {
  success: boolean;
  error?: string;
}

export interface UnlistResult {
  success: boolean;
  error?: string;
}

export interface BuyResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// QUERY KEY
// =============================================================================

const LISTINGS_QUERY_KEY = ["nft-marketplace-listings"];

// =============================================================================
// FETCH FUNCTION
// =============================================================================

async function fetchListings(): Promise<NFTListingWithNFT[]> {
  const apiClient = getApiClient();
  const response = await apiClient.getListings();

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to fetch listings");
  }

  return response.data.listings;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMarketplace(): UseMarketplaceReturn {
  const queryClient = useQueryClient();

  // State
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const isWalletConnected = Boolean(wallet?.address);

  // Query for listings
  const {
    data: listings = [],
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: LISTINGS_QUERY_KEY,
    queryFn: fetchListings,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  });

  /**
   * Refresh listings
   */
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  /**
   * List an NFT for sale
   */
  const listNFT = useCallback(
    async (tokenId: number, price: number): Promise<ListResult> => {
      if (!wallet?.address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        const apiClient = getApiClient();
        const result = await apiClient.listNFT(tokenId, price, wallet.address);

        if (!result.success) {
          throw new Error(result.error || "Failed to list NFT");
        }

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
        queryClient.invalidateQueries({
          queryKey: ["owned-nfts-indexed", wallet.address],
        });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to list";
        setProcessingError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [wallet, queryClient],
  );

  /**
   * Remove an NFT listing
   */
  const unlistNFT = useCallback(
    async (tokenId: number): Promise<UnlistResult> => {
      if (!wallet?.address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        const apiClient = getApiClient();
        const result = await apiClient.unlistNFT(tokenId, wallet.address);

        if (!result.success) {
          throw new Error(result.error || "Failed to unlist NFT");
        }

        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to unlist";
        setProcessingError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [wallet, queryClient],
  );

  /**
   * Buy a listed NFT
   */
  const buyNFT = useCallback(
    async (tokenId: number): Promise<BuyResult> => {
      if (!wallet?.address) {
        return { success: false, error: "Wallet not connected" };
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        const apiClient = getApiClient();
        const result = await apiClient.buyNFT(tokenId, wallet.address);

        if (!result.success) {
          throw new Error(result.error || "Failed to buy NFT");
        }

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
        queryClient.invalidateQueries({
          queryKey: ["owned-nfts-indexed", wallet.address],
        });

        return { success: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to buy";
        setProcessingError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [wallet, queryClient],
  );

  return {
    listings,
    isLoading,
    isFetching,
    error: error ? (error as Error).message : null,
    refresh,
    listNFT,
    unlistNFT,
    buyNFT,
    isProcessing,
    processingError,
    isWalletConnected,
  };
}

export default useMarketplace;
