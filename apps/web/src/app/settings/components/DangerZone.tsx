"use client";

import { useState, useCallback } from "react";
import { pixelShadows } from "@bitcoinbaby/ui";
import { getApiClient } from "@bitcoinbaby/core";

interface DangerZoneProps {
  walletAddress: string | undefined;
  onResetSettings: () => void;
}

export function DangerZone({
  walletAddress,
  onResetSettings,
}: DangerZoneProps) {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetDataConfirm, setShowResetDataConfirm] = useState(false);

  const handleResetSettings = useCallback(() => {
    onResetSettings();
    setShowResetConfirm(false);
  }, [onResetSettings]);

  const handleResetAllData = useCallback(async () => {
    // 1. Reset backend balance if wallet is connected
    if (walletAddress) {
      try {
        const apiClient = getApiClient();
        await apiClient.resetBalance(walletAddress);
      } catch {
        // Continue with local reset even if backend fails
      }
    }

    // 2. Clear all BitcoinBaby localStorage keys
    const keysToRemove = [
      "bitcoinbaby-nft-store",
      "bitcoinbaby-mining-store",
      "bitcoinbaby-baby-store",
      "bitcoinbaby-wallet-store",
      "bitcoinbaby-network",
      "bitcoinbaby-settings",
      "bitcoinbaby-leaderboard",
      "bitcoinbaby-tutorial",
      "bitcoinbaby-game",
      "bitcoinbaby_game_state",
    ];
    keysToRemove.forEach((key) => localStorage.removeItem(key));

    // 3. Clear ALL IndexedDB databases
    const dbsToDelete = [
      "bitcoinbaby",
      "bitcoinbaby-secure",
      "bitcoinbaby-mining",
      "BitcoinBabyShareQueue",
    ];
    for (const dbName of dbsToDelete) {
      try {
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(dbName);
          request.onsuccess = () => resolve();
          request.onerror = () => resolve(); // Continue even on error
          request.onblocked = () => resolve(); // Continue even if blocked
        });
      } catch {
        // Continue with other databases even if one fails
      }
    }

    setShowResetDataConfirm(false);
    window.location.reload();
  }, [walletAddress]);

  return (
    <div
      className={`bg-pixel-bg-medium border-4 border-pixel-error p-6 ${pixelShadows.lg}`}
    >
      <h2 className="font-pixel text-sm text-pixel-error mb-4">DANGER ZONE</h2>

      {/* Reset Settings */}
      <div className="mb-6 pb-6 border-b-2 border-pixel-border">
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
          Reset all settings to their default values. This will not affect your
          wallet or mining progress.
        </p>
        {!showResetConfirm ? (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 font-pixel text-[10px] text-pixel-error border-4 border-pixel-error hover:bg-pixel-error hover:text-white transition-colors"
          >
            RESET SETTINGS
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
            >
              CANCEL
            </button>
            <button
              onClick={handleResetSettings}
              className={`px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black ${pixelShadows.md}`}
            >
              CONFIRM
            </button>
          </div>
        )}
      </div>

      {/* Reset ALL Data */}
      <div>
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-2">
          Delete ALL app data including wallet, NFTs, mining progress, and
          settings. Start completely fresh.
        </p>
        <p className="font-pixel text-[8px] text-pixel-error mb-4">
          WARNING: This cannot be undone! Make sure you have your recovery
          phrase backed up.
        </p>
        {!showResetDataConfirm ? (
          <button
            onClick={() => setShowResetDataConfirm(true)}
            className="px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black hover:bg-pixel-error/80 transition-colors"
          >
            RESET ALL DATA
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setShowResetDataConfirm(false)}
              className="px-4 py-2 font-pixel text-[10px] bg-pixel-bg-light text-pixel-text border-4 border-black"
            >
              CANCEL
            </button>
            <button
              onClick={handleResetAllData}
              className={`px-4 py-2 font-pixel text-[10px] bg-pixel-error text-white border-4 border-black ${pixelShadows.md} animate-pulse`}
            >
              DELETE EVERYTHING
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
