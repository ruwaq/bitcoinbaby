/**
 * useClaimNFT Hook
 *
 * Allows users to claim NFTs that were minted before the indexing system.
 * Verifies the transaction on blockchain and registers the NFT in our index.
 */

"use client";

import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useWalletStore,
  getApiClient,
  type NFTRecord,
} from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface ClaimResult {
  success: boolean;
  nft?: NFTRecord;
  error?: string;
}

export interface UseClaimNFTReturn {
  /** Is currently claiming */
  isLoading: boolean;
  /** Error message if claim failed */
  error: string | null;
  /** Last claimed NFT */
  lastClaimed: NFTRecord | null;
  /** Claim an NFT by txid */
  claim: (txid: string) => Promise<ClaimResult>;
  /** Reset state */
  reset: () => void;
  /** Is wallet connected */
  isWalletConnected: boolean;
}

// =============================================================================
// TXID VALIDATION
// =============================================================================

/**
 * Validate and clean a transaction ID
 * Accepts full mempool URLs or raw txids
 */
function extractTxid(input: string): string | null {
  const trimmed = input.trim();

  // Check if it's a mempool.space URL
  const urlMatch = trimmed.match(
    /mempool\.space\/(?:testnet4\/)?tx\/([a-fA-F0-9]{64})/,
  );
  if (urlMatch) {
    return urlMatch[1].toLowerCase();
  }

  // Check if it's a raw txid (64 hex characters)
  const txidMatch = trimmed.match(/^[a-fA-F0-9]{64}$/);
  if (txidMatch) {
    return trimmed.toLowerCase();
  }

  return null;
}

// =============================================================================
// HOOK
// =============================================================================

export function useClaimNFT(): UseClaimNFTReturn {
  const queryClient = useQueryClient();

  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastClaimed, setLastClaimed] = useState<NFTRecord | null>(null);

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const isWalletConnected = Boolean(wallet?.address);

  /**
   * Claim an NFT by providing the mint transaction ID
   */
  const claim = useCallback(
    async (txidInput: string): Promise<ClaimResult> => {
      // Require wallet
      if (!wallet?.address) {
        return {
          success: false,
          error: "Please connect your wallet first",
        };
      }

      // Validate and extract txid
      const txid = extractTxid(txidInput);
      if (!txid) {
        return {
          success: false,
          error:
            "Invalid transaction ID. Enter a 64-character hex string or mempool.space URL",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        const apiClient = getApiClient();
        const result = await apiClient.claimNFT(txid, wallet.address);

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to claim NFT");
        }

        // Invalidate NFT cache to trigger refetch
        queryClient.invalidateQueries({
          queryKey: ["owned-nfts-indexed", wallet.address],
        });

        setLastClaimed(result.data);

        return { success: true, nft: result.data };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Claim failed";
        setError(message);
        return { success: false, error: message };
      } finally {
        setIsLoading(false);
      }
    },
    [wallet, queryClient],
  );

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastClaimed(null);
  }, []);

  return {
    isLoading,
    error,
    lastClaimed,
    claim,
    reset,
    isWalletConnected,
  };
}

export default useClaimNFT;
