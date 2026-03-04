"use client";

/**
 * useNFTSync Hook
 *
 * Professional NFT sync using TanStack Query + Server Indexer:
 * - Fetches NFTs from our indexed backend (not blockchain parsing)
 * - Auto-sync on mount when wallet connected
 * - Smart caching (stale-while-revalidate)
 * - Background refetch on window focus
 * - Optimistic updates after mint
 * - Automatic retry with exponential backoff
 *
 * Architecture follows industry standard:
 * - Blockchain is source of truth (txid verification)
 * - Server indexes NFTs for fast queries
 * - Similar to Magic Eden, OpenSea, etc.
 */

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useNFTStore,
  useWalletStore,
  usePendingTxStore,
  getApiClient,
  RETRY_DELAYS,
  type NFTRecord,
} from "@bitcoinbaby/core";
import { type BabyNFTState } from "@bitcoinbaby/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export interface UseNFTSyncReturn {
  /** NFTs from server index */
  nfts: BabyNFTState[];
  /** Is fetching from server */
  isLoading: boolean;
  /** Is refetching in background */
  isFetching: boolean;
  /** Error message if sync failed */
  error: string | null;
  /** Last successful sync timestamp */
  lastSynced: number | null;
  /** Trigger manual refresh */
  refresh: () => Promise<void>;
  /** Number of NFTs found */
  count: number;
  /** Is data stale (needs refresh) */
  isStale: boolean;
}

// =============================================================================
// QUERY KEY
// =============================================================================

const NFT_QUERY_KEY = "owned-nfts-indexed";

function getNFTQueryKey(address: string | undefined) {
  return [NFT_QUERY_KEY, address];
}

// =============================================================================
// CONVERSION
// =============================================================================

/**
 * Convert server NFTRecord to BabyNFTState for local use
 */
function convertToNFTState(record: NFTRecord): BabyNFTState {
  return {
    tokenId: record.tokenId,
    dna: record.dna,
    bloodline: record.bloodline as BabyNFTState["bloodline"],
    baseType: record.baseType as BabyNFTState["baseType"],
    genesisBlock: record.genesisBlock,
    rarityTier: record.rarityTier as BabyNFTState["rarityTier"],
    level: record.level,
    xp: record.xp,
    totalXp: record.totalXp,
    workCount: record.workCount,
    lastWorkBlock: record.lastWorkBlock,
    evolutionCount: record.evolutionCount,
    tokensEarned:
      typeof record.tokensEarned === "bigint"
        ? record.tokensEarned
        : BigInt(record.tokensEarned || 0),
  };
}

// =============================================================================
// FETCH FUNCTION
// =============================================================================

/**
 * Fetch owned NFTs from server index
 * Much faster than blockchain parsing - direct database query
 */
async function fetchOwnedNFTs(address: string): Promise<BabyNFTState[]> {
  const apiClient = getApiClient();
  const response = await apiClient.getOwnedNFTs(address);

  if (!response.success || !response.data) {
    throw new Error(response.error || "Failed to fetch NFTs");
  }

  // Convert server records to BabyNFTState
  return response.data.nfts.map(convertToNFTState);
}

// =============================================================================
// HOOK
// =============================================================================

export function useNFTSync(): UseNFTSyncReturn {
  // Stores
  const { setOwnedNFTs, ownedNFTs: localNFTs } = useNFTStore();
  const wallet = useWalletStore((s) => s.wallet);
  const pendingTransactions = usePendingTxStore((s) => s.transactions);

  // Track last confirmed tx to trigger refetch
  const lastConfirmedTxRef = useRef<string | null>(null);

  // Query for NFTs from server index
  const {
    data: indexedNFTs = [],
    isLoading,
    isFetching,
    error,
    dataUpdatedAt,
    isStale,
    refetch,
  } = useQuery({
    queryKey: getNFTQueryKey(wallet?.address),
    queryFn: () => fetchOwnedNFTs(wallet!.address),
    enabled: !!wallet?.address,
    staleTime: 30 * 1000, // 30 seconds - server data is fast
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  /**
   * Merge server NFTs with local store
   * Server is source of truth, but keep pending local mints
   */
  useEffect(() => {
    if (indexedNFTs.length > 0) {
      // Keep local NFTs that aren't on server yet (pending mints)
      const indexedIds = new Set(indexedNFTs.map((n) => n.tokenId));
      const pendingLocalNFTs = localNFTs.filter(
        (n) => !indexedIds.has(n.tokenId),
      );

      // Merge: server NFTs (indexed) + pending local (optimistic)
      const mergedNFTs = [...indexedNFTs, ...pendingLocalNFTs];

      // Only update if different (use safe comparison for BigInt values)
      const areEqual =
        mergedNFTs.length === localNFTs.length &&
        mergedNFTs.every((merged, i) => {
          const local = localNFTs[i];
          return (
            merged.tokenId === local?.tokenId &&
            merged.level === local?.level &&
            merged.xp === local?.xp
          );
        });

      if (!areEqual) {
        setOwnedNFTs(mergedNFTs);
      }
    } else if (indexedNFTs.length === 0 && !isLoading && !isFetching) {
      // If server returns empty and we have local NFTs, keep them
      // (optimistic updates from minting)
      // Don't clear local NFTs if server is empty - they might just be pending
    }
  }, [indexedNFTs, localNFTs, setOwnedNFTs, isLoading, isFetching]);

  /**
   * Refetch when NFT transactions confirm
   * Faster than blockchain indexing - our server confirms immediately
   */
  useEffect(() => {
    const confirmedNFTTx = pendingTransactions.find(
      (tx) =>
        (tx.type === "nft_mint" || tx.type === "nft_purchase") &&
        tx.status === "confirmed" &&
        tx.txid !== lastConfirmedTxRef.current,
    );

    if (confirmedNFTTx) {
      lastConfirmedTxRef.current = confirmedNFTTx.txid;

      // With server indexing, we can refetch much faster
      // Server confirms NFT at mint time, not when blockchain is indexed
      // Use centralized retry delays from @bitcoinbaby/core/constants
      const retryDelays = RETRY_DELAYS.standard;
      let attempt = 0;

      const attemptRefetch = async () => {
        console.log(
          `[NFTSync] Attempt ${attempt + 1}/${retryDelays.length} to fetch NFT after confirmation`,
        );

        try {
          const result = await refetch();
          const nfts = result.data || [];

          if (nfts.length > 0) {
            console.log(
              `[NFTSync] Found ${nfts.length} NFTs from server index`,
            );
            return; // Success - stop retrying
          }

          // No NFTs found yet, schedule next attempt
          attempt++;
          if (attempt < retryDelays.length) {
            console.log(
              `[NFTSync] No NFTs found, retrying in ${retryDelays[attempt] / 1000}s`,
            );
            setTimeout(attemptRefetch, retryDelays[attempt]);
          } else {
            console.warn(
              `[NFTSync] Failed to find NFT after ${retryDelays.length} attempts`,
            );
          }
        } catch (err) {
          console.error(`[NFTSync] Refetch failed:`, err);
          // Schedule retry on error
          attempt++;
          if (attempt < retryDelays.length) {
            setTimeout(attemptRefetch, retryDelays[attempt]);
          }
        }
      };

      // Start first attempt quickly - server should have the data already
      setTimeout(attemptRefetch, retryDelays[0]);
    }
  }, [pendingTransactions, refetch]);

  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Use local NFTs for display (includes pending mints)
  const displayNFTs = localNFTs;

  return {
    nfts: displayNFTs,
    isLoading,
    isFetching,
    error: error ? (error as Error).message : null,
    lastSynced: dataUpdatedAt || null,
    refresh,
    count: displayNFTs.length,
    isStale,
  };
}

/**
 * Hook to invalidate NFT cache (call after successful mint)
 */
export function useInvalidateNFTs() {
  const queryClient = useQueryClient();
  const walletAddress = useWalletStore((s) => s.wallet?.address);

  return useCallback(() => {
    if (walletAddress) {
      queryClient.invalidateQueries({
        queryKey: getNFTQueryKey(walletAddress),
      });
    }
  }, [queryClient, walletAddress]);
}

export default useNFTSync;
