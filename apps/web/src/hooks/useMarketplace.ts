/**
 * useMarketplace Hook
 *
 * Manages NFT marketplace listings, buying, and selling with PSBT-based atomic swaps.
 *
 * Architecture follows Magic Eden / OKX pattern:
 * - Seller signs with SIGHASH_SINGLE | ANYONECANPAY
 * - Buyer completes PSBT with payment UTXOs
 * - Single atomic transaction swaps NFT for BTC
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getApiClient,
  useWalletStore,
  type NFTListingWithNFT,
} from "@bitcoinbaby/core";
import {
  createListingService,
  createMempoolClient,
  getRoyaltyAddress,
  MARKETPLACE_CONFIG,
  Psbt,
} from "@bitcoinbaby/bitcoin";

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
  txid?: string;
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
  const signPsbt = useWalletStore((s) => s.signPsbt);
  const isWalletConnected = Boolean(wallet?.address);

  // Services
  const listingService = useMemo(
    () => createListingService({ network: "testnet4" }),
    [],
  );
  const mempoolClient = useMemo(
    () => createMempoolClient({ network: "testnet4" }),
    [],
  );

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
   * List an NFT for sale using PSBT
   *
   * Flow:
   * 1. Get NFT UTXO from blockchain (Charms extraction)
   * 2. Create listing PSBT using ListingService
   * 3. Sign with wallet (SIGHASH_SINGLE|ANYONECANPAY)
   * 4. Send signed PSBT to server for indexing
   */
  const listNFT = useCallback(
    async (tokenId: number, price: number): Promise<ListResult> => {
      if (!wallet?.address) {
        return { success: false, error: "Wallet not connected" };
      }

      if (!signPsbt) {
        return { success: false, error: "Wallet signing not available" };
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        // 1. Get NFT UTXO from server/blockchain
        // For now, we'll get it from the API client
        const apiClient = getApiClient();

        // Get the NFT's current UTXO location
        // TODO: This should query Scrolls/Charms for the actual UTXO
        const nftResponse = await apiClient.getNFT(tokenId);
        if (!nftResponse.success || !nftResponse.data) {
          throw new Error("Failed to get NFT data");
        }

        // Get UTXOs for the wallet to find the NFT
        const utxos = await mempoolClient.getUTXOs(wallet.address);
        if (utxos.length === 0) {
          throw new Error("No UTXOs found for wallet");
        }

        // For now, use a placeholder UTXO - in production, this would
        // query Scrolls API to find the specific Charm UTXO
        // TODO: Integrate with Scrolls API to get exact NFT UTXO
        const nftUtxo = {
          txid: utxos[0].txid,
          vout: utxos[0].vout,
          value: utxos[0].value,
        };

        // 2. Create listing PSBT
        const priceSats = BigInt(price);
        const listingResult = listingService.createListingPSBT({
          nftUtxo,
          sellerAddress: wallet.address,
          priceSats,
          royaltyAddress: getRoyaltyAddress(),
          royaltyPercent: MARKETPLACE_CONFIG.royaltyPercent,
        });

        if (!listingResult.success || !listingResult.psbt) {
          throw new Error(
            listingResult.error || "Failed to create listing PSBT",
          );
        }

        // 3. Sign with wallet (SIGHASH_SINGLE|ANYONECANPAY)
        const signedPsbt = await signPsbt(listingResult.psbt);
        if (!signedPsbt) {
          throw new Error("Failed to sign listing PSBT");
        }

        // 4. Send to server
        const result = await apiClient.listNFT(
          tokenId,
          price,
          wallet.address,
          signedPsbt,
          nftUtxo,
        );

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
    [wallet, signPsbt, queryClient, listingService, mempoolClient],
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
   * Buy a listed NFT using PSBT atomic swap
   *
   * Flow:
   * 1. Get listing with seller's signed PSBT from server
   * 2. Get buyer's UTXOs for payment
   * 3. Complete PSBT with ListingService
   * 4. Sign buyer's inputs
   * 5. Broadcast to network
   * 6. Notify server of purchase
   */
  const buyNFT = useCallback(
    async (tokenId: number): Promise<BuyResult> => {
      if (!wallet?.address) {
        return { success: false, error: "Wallet not connected" };
      }

      if (!signPsbt) {
        return { success: false, error: "Wallet signing not available" };
      }

      setIsProcessing(true);
      setProcessingError(null);

      try {
        // 1. Get listing with seller's PSBT
        const listing = listings.find((l) => l.tokenId === tokenId);
        if (!listing) {
          throw new Error("Listing not found");
        }

        // Check if listing has PSBT (new PSBT-based listing)
        if (!listing.sellerPsbt) {
          // Fallback to legacy server-based purchase
          const apiClient = getApiClient();
          const result = await apiClient.buyNFT(tokenId, wallet.address);
          if (!result.success) {
            throw new Error(result.error || "Failed to buy NFT");
          }
          // Invalidate queries
          queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
          queryClient.invalidateQueries({
            queryKey: ["owned-nfts-indexed", wallet.address],
          });
          return { success: true };
        }

        // 2. Get buyer's UTXOs
        const utxos = await mempoolClient.getUTXOs(wallet.address);
        if (utxos.length === 0) {
          throw new Error("No UTXOs found for payment");
        }

        // 3. Complete PSBT with buyer's payment
        const purchaseResult = listingService.completePurchasePSBT({
          listingPsbt: listing.sellerPsbt,
          buyerAddress: wallet.address,
          buyerUtxos: utxos,
          feeRate: 10, // TODO: Get dynamic fee rate
        });

        if (!purchaseResult.success || !purchaseResult.psbt) {
          throw new Error(
            purchaseResult.error || "Failed to complete purchase PSBT",
          );
        }

        // 4. Sign buyer's inputs
        const signedPsbt = await signPsbt(purchaseResult.psbt);
        if (!signedPsbt) {
          throw new Error("Failed to sign purchase PSBT");
        }

        // 5. Finalize and broadcast
        const psbt = Psbt.fromBase64(signedPsbt);
        psbt.finalizeAllInputs();
        const rawTxHex = psbt.extractTransaction().toHex();
        const txid = await mempoolClient.broadcastTransaction(rawTxHex);

        // 6. Notify server
        const apiClient = getApiClient();
        await apiClient.buyNFT(tokenId, wallet.address, txid);

        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: LISTINGS_QUERY_KEY });
        queryClient.invalidateQueries({
          queryKey: ["owned-nfts-indexed", wallet.address],
        });

        return { success: true, txid };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to buy";
        setProcessingError(message);
        return { success: false, error: message };
      } finally {
        setIsProcessing(false);
      }
    },
    [wallet, signPsbt, queryClient, listings, listingService, mempoolClient],
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
