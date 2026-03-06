"use client";

/**
 * AppInitializer - Global app initialization
 *
 * Handles tasks that should run when the app loads:
 * - NFT sync when wallet is connected
 * - Balance fetch on startup
 * - Any other global initialization
 *
 * This component renders nothing but runs hooks that initialize app state.
 */

import { useEffect } from "react";
import { useWalletStore, useNFTStore } from "@bitcoinbaby/core";
import { useNFTSync } from "@/hooks/useNFTSync";

export function AppInitializer() {
  // Get wallet state
  const wallet = useWalletStore((s) => s.wallet);
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLocked = useWalletStore((s) => s.isLocked);

  // Get NFT store state
  const totalNFTs = useNFTStore((s) => s.totalNFTs);

  // Sync NFTs when wallet is connected and unlocked
  // This hook fetches NFTs from the server and updates the store
  const { isLoading, refresh } = useNFTSync();

  // Force refresh NFTs when wallet unlocks (if we have stale data)
  useEffect(() => {
    if (
      isConnected &&
      !isLocked &&
      wallet?.address &&
      totalNFTs === 0 &&
      !isLoading
    ) {
      // If store shows 0 NFTs but we're connected, try to fetch
      refresh();
    }
  }, [isConnected, isLocked, wallet?.address, totalNFTs, isLoading, refresh]);

  // This component doesn't render anything
  return null;
}

export default AppInitializer;
