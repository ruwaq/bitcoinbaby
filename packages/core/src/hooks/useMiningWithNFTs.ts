/**
 * useMiningWithNFTs - Combined Mining + NFT Boost Hook
 *
 * Uses the global MiningManager singleton so mining persists
 * across page navigations. Automatically applies NFT boost
 * from user's Genesis Babies to mining hashrate.
 *
 * When mining finds a valid share, equipped NFTs gain XP automatically
 * through the work proof system.
 */

"use client";

import { useCallback } from "react";
import { useMiningBoost } from "./useCharms";
import { useWalletStore } from "../stores/wallet-store";
import { useNFTStore } from "../stores/nft-store";
import {
  useGlobalMining,
  type UseGlobalMiningOptions,
} from "./useGlobalMining";
import { DEFAULT_NFT_APP_ID } from "../constants/app-ids";
import { getApiClient } from "../api";

export interface UseMiningWithNFTsOptions extends Omit<
  UseGlobalMiningOptions,
  "nftBoost" | "onXPGained"
> {
  /** NFT app ID for Genesis Babies */
  nftAppId?: string;
  /** Disable automatic XP submission for equipped NFTs */
  disableAutoXP?: boolean;
}

export interface UseMiningWithNFTsReturn extends ReturnType<
  typeof useGlobalMining
> {
  /** Number of NFTs owned */
  nftCount: number;
  /** Whether boost data is loading */
  boostLoading: boolean;
  /** Boost as multiplier (1.0 = no boost) */
  boostMultiplier: number;
  /** Token ID of equipped NFT (if any) */
  equippedTokenId: number | null;
}

export function useMiningWithNFTs(
  options: UseMiningWithNFTsOptions = {},
): UseMiningWithNFTsReturn {
  const {
    nftAppId = DEFAULT_NFT_APP_ID,
    disableAutoXP = false,
    ...miningOptions
  } = options;

  // Get wallet address
  const address = useWalletStore((s) => s.wallet?.address ?? null);

  // Get equipped NFT token ID from NFTStore (selectedNFT is the "equipped" NFT)
  const equippedTokenId = useNFTStore((s) => s.selectedNFT?.tokenId ?? null);

  // Get NFT boost from owned Genesis Babies
  const {
    boost,
    nftCount,
    loading: boostLoading,
  } = useMiningBoost(address, nftAppId);

  // XP callback - submits work proof when share is found
  const handleXPGained = useCallback(
    async (event: {
      result: { hash: string; difficulty: number };
      baseXP: number;
      timestamp: number;
    }) => {
      // Skip if disabled, no wallet, or no equipped NFT
      if (disableAutoXP || !address || equippedTokenId === null) {
        return;
      }

      try {
        const apiClient = getApiClient();
        await apiClient.submitWorkProof(equippedTokenId, {
          ownerAddress: address,
          shareHash: event.result.hash,
          difficulty: event.result.difficulty,
          timestamp: event.timestamp,
        });
      } catch (err) {
        // Log but don't throw - XP submission shouldn't block mining
        console.warn("[useMiningWithNFTs] Failed to submit work proof:", err);
      }
    },
    [address, equippedTokenId, disableAutoXP],
  );

  // Use global mining (persists across navigation!)
  // Note: NFT boost is read directly from NFTStore by useGlobalMining
  const mining = useGlobalMining({
    ...miningOptions,
    onXPGained: handleXPGained,
  });

  return {
    // Mining state
    ...mining,

    // NFT boost info
    nftCount,
    boostLoading,
    equippedTokenId,

    // Computed
    boostMultiplier: 1 + boost / 100,
  };
}

export default useMiningWithNFTs;
