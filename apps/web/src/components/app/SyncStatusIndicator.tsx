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

export function SyncStatusIndicator({ className }: SyncStatusIndicatorProps) {
  const wallet = useWalletStore((s) => s.wallet);
  const [status, setStatus] = useState<SyncStatus>("healthy");
  const [pendingCount, setPendingCount] = useState(0);
  const [tooltip, setTooltip] = useState("");

  useEffect(() => {
    if (!wallet?.address) {
      setStatus("healthy");
      setTooltip("Connect wallet to start mining");
      return;
    }

    const updateStatus = async () => {
      try {
        const syncManager = getSyncManager();
        const state = syncManager.getState();
        const stats = await getQueueStats(wallet.address);

        setPendingCount(stats.pending + stats.syncing);

        if (!state.isOnline) {
          setStatus("offline");
          setTooltip(`Offline - ${stats.pending} shares queued`);
        } else if (state.circuitBreakerActive) {
          const secondsLeft = Math.ceil(
            (state.circuitBreakerUntil - Date.now()) / 1000,
          );
          setStatus("error");
          setTooltip(`Rate limited - retry in ${secondsLeft}s`);
        } else if (!state.apiHealthy) {
          setStatus("error");
          setTooltip("Server unavailable");
        } else if (stats.failed > 0) {
          setStatus("error");
          setTooltip(`${stats.failed} shares failed`);
        } else if (stats.pending > 0 || stats.syncing > 0) {
          setStatus("pending");
          setTooltip(`Syncing ${stats.pending + stats.syncing} shares...`);
        } else {
          setStatus("healthy");
          setTooltip(`${stats.synced} shares synced`);
        }
      } catch {
        // SyncManager not initialized yet
        setStatus("healthy");
        setTooltip("Initializing...");
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, [wallet?.address]);

  // Don't show if no wallet
  if (!wallet) return null;

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
