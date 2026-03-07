"use client";

/**
 * AppInitializer - Global app initialization
 *
 * Handles tasks that should run when the app loads:
 * - Wallet singleton sync to store (keeps wallet connected across tabs)
 * - NFT sync when wallet is connected
 * - Balance fetch on startup
 * - Any other global initialization
 *
 * This component renders nothing but runs hooks that initialize app state.
 */

import { useEffect, useCallback, useRef } from "react";
import {
  useWalletStore,
  useNFTStore,
  type WalletInfo,
} from "@bitcoinbaby/core";
import { useNFTSync } from "@/hooks/useNFTSync";
import {
  isWalletSingletonActive,
  getWalletSingletonInfo,
} from "@/hooks/useWallet";

/**
 * Convert wallet info to store format
 */
function toStoreWalletInfo(info: {
  address: string;
  publicKey: string;
}): WalletInfo {
  return {
    address: info.address,
    publicKey: info.publicKey,
    balance: BigInt(0),
    babyTokens: BigInt(0),
  };
}

export function AppInitializer() {
  // Get wallet state and actions
  const wallet = useWalletStore((s) => s.wallet);
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLocked = useWalletStore((s) => s.isLocked);
  const setWallet = useWalletStore((s) => s.setWallet);

  // Get NFT store state
  const totalNFTs = useNFTStore((s) => s.totalNFTs);

  // Sync NFTs when wallet is connected and unlocked
  // This hook fetches NFTs from the server and updates the store
  const { isLoading, refresh } = useNFTSync();

  // CRITICAL: Sync wallet singleton to store on mount and periodically
  // This ensures the wallet stays connected when navigating between tabs
  //
  // FIX: Use refs to avoid recreating callback on every state change
  const isConnectedRef = useRef(isConnected);

  // Keep ref in sync with state
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const syncWalletToStore = useCallback(() => {
    const singletonActive = isWalletSingletonActive();
    const singletonInfo = getWalletSingletonInfo();

    // Use refs for current values (avoids recreating callback)
    const currentIsConnected = isConnectedRef.current;

    // Debug logging (less verbose)
    if (singletonActive !== currentIsConnected) {
      console.log("[AppInitializer] Sync check:", {
        singletonActive,
        storeIsConnected: currentIsConnected,
      });
    }

    // Check if singleton has wallet but store doesn't
    if (singletonActive && !currentIsConnected && singletonInfo) {
      console.log(
        "[AppInitializer] Syncing wallet singleton to store:",
        singletonInfo.address.slice(0, 10) + "...",
      );
      setWallet(toStoreWalletInfo(singletonInfo));
    }
  }, [setWallet]); // Only depend on setWallet (stable function)

  // Initial sync on mount
  useEffect(() => {
    syncWalletToStore();
  }, [syncWalletToStore]);

  // Periodic sync to catch any desync issues (every 2 seconds)
  useEffect(() => {
    const interval = setInterval(syncWalletToStore, 2000);
    return () => clearInterval(interval);
  }, [syncWalletToStore]);

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
