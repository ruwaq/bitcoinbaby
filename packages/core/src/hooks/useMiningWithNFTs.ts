/**
 * useMiningWithNFTs - Combined Mining + NFT Boost Hook
 *
 * Uses the global MiningManager singleton so mining persists
 * across page navigations. Automatically applies NFT boost
 * from user's Genesis Babies to mining hashrate.
 */

"use client";

import { useMiningBoost } from "./useCharms";
import { useWalletStore } from "../stores/wallet-store";
import {
  useGlobalMining,
  type UseGlobalMiningOptions,
} from "./useGlobalMining";

export interface UseMiningWithNFTsOptions extends Omit<
  UseGlobalMiningOptions,
  "nftBoost"
> {
  /** NFT app ID for Genesis Babies */
  nftAppId?: string;
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
}

export function useMiningWithNFTs(
  options: UseMiningWithNFTsOptions = {},
): UseMiningWithNFTsReturn {
  const { nftAppId = "genesis-babies", ...miningOptions } = options;

  // Get wallet address
  const address = useWalletStore((s) => s.wallet?.address ?? null);

  // Get NFT boost from owned Genesis Babies
  const {
    boost,
    nftCount,
    loading: boostLoading,
  } = useMiningBoost(address, nftAppId);

  // Use global mining (persists across navigation!)
  // Note: NFT boost is read directly from NFTStore by useGlobalMining
  const mining = useGlobalMining(miningOptions);

  return {
    // Mining state
    ...mining,

    // NFT boost info
    nftCount,
    boostLoading,

    // Computed
    boostMultiplier: 1 + boost / 100,
  };
}

export default useMiningWithNFTs;
