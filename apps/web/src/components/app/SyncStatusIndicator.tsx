"use client";

/**
 * SyncStatusIndicator - Compact sync health indicator
 *
 * Shows a small colored dot in the header:
 * - Green: All synced, API healthy
 * - Yellow: Shares pending sync
 * - Red: Circuit breaker active or API down
 * - Gray: Offline
 */

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  getSyncManager,
  getQueueStats,
  useWalletStore,
} from "@bitcoinbaby/core";

interface SyncStatusIndicatorProps {
  className?: string;
}

type SyncStatus = "healthy" | "pending" | "error" | "offline";

interface StatusState {
  status: SyncStatus;
  pendingCount: number;
  tooltip: string;
}

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const wallet = useWalletStore((s) => s.wallet);
  const walletAddress = wallet?.address;
  const [syncState, setSyncState] = useState<StatusState>({
    status: "healthy",
    pendingCount: 0,
    tooltip: "Initializing...",
  });

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    let isCancelled = false;

    const fetchStatus = async () => {
      if (isCancelled) return;

      try {
        const syncManager = getSyncManager();
        const state = syncManager.getState();
        const stats = await getQueueStats(walletAddress);

        if (isCancelled) return;

        const pending = stats.pending + stats.syncing;

        if (!state.isOnline) {
          setSyncState({
            status: "offline",
            pendingCount: pending,
            tooltip: `Offline - ${stats.pending} shares queued`,
          });
        } else if (state.circuitBreakerActive) {
          const secondsLeft = Math.ceil(
            (state.circuitBreakerUntil - Date.now()) / 1000,
          );
          setSyncState({
            status: "error",
            pendingCount: pending,
            tooltip: `Rate limited - retry in ${secondsLeft}s`,
          });
        } else if (!state.apiHealthy) {
          setSyncState({
            status: "error",
            pendingCount: pending,
            tooltip: "Server unavailable",
          });
        } else if (stats.failed > 0) {
          setSyncState({
            status: "error",
            pendingCount: pending,
            tooltip: `${stats.failed} shares failed`,
          });
        } else if (stats.pending > 0 || stats.syncing > 0) {
          setSyncState({
            status: "pending",
            pendingCount: pending,
            tooltip: `Syncing ${stats.pending + stats.syncing} shares...`,
          });
        } else {
          setSyncState({
            status: "healthy",
            pendingCount: pending,
            tooltip: `${stats.synced} shares synced`,
          });
        }
      } catch {
        if (!isCancelled) {
          setSyncState({
            status: "healthy",
            pendingCount: 0,
            tooltip: "Initializing...",
          });
        }
      }
    };

    // Use setTimeout for initial fetch to ensure it runs asynchronously
    const initialTimeout = setTimeout(fetchStatus, 0);
    const interval = setInterval(fetchStatus, 2000);

    return () => {
      isCancelled = true;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [walletAddress]);

  // Don't show if no wallet
  if (!wallet) return null;

  const { status, pendingCount, tooltip } = syncState;

  return (
    <div className={clsx("relative group", className)} title={tooltip}>
      {/* Status dot */}
      <span
        className={clsx(
          "inline-block w-2 h-2 border border-black",
          status === "healthy" && "bg-pixel-success",
          status === "pending" && "bg-pixel-warning animate-pulse",
          status === "error" && "bg-pixel-error animate-pulse",
          status === "offline" && "bg-pixel-text-muted",
        )}
      />

      {/* Pending count badge */}
      {pendingCount > 0 && status !== "healthy" && (
        <span className="absolute -top-1 -right-1 min-w-[12px] h-[12px] flex items-center justify-center bg-pixel-warning text-black text-[6px] font-pixel border border-black">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}

      {/* Tooltip on hover */}
      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-pixel-bg-dark border border-pixel-border text-pixel-text font-pixel text-[7px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
        {tooltip}
      </div>
    </div>
  );
}

export default SyncStatusIndicator;
