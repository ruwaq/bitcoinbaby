"use client";

/**
 * SyncStatusAlert - Visible alert for sync issues
 *
 * Shows prominent warnings when:
 * - Circuit breaker is active (rate limited)
 * - There are failed shares (dead letter queue)
 * - API is unhealthy
 *
 * This replaces the hidden debug panel approach with visible user feedback.
 */

import { useState, useEffect } from "react";
import { InfoBanner } from "@bitcoinbaby/ui";

interface SyncState {
  isOnline: boolean;
  apiHealthy: boolean;
  circuitBreakerActive: boolean;
  circuitBreakerUntil: number;
  consecutiveFailures: number;
}

interface SyncStatusAlertProps {
  getSyncState: () => SyncState;
  pendingShares: number;
  failedShares: number;
  onForceSync: () => void;
}

export function SyncStatusAlert({
  getSyncState,
  pendingShares,
  failedShares,
  onForceSync,
}: SyncStatusAlertProps) {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Update sync state periodically
  useEffect(() => {
    const update = () => {
      const state = getSyncState();
      setSyncState(state);
      if (state.circuitBreakerActive) {
        setCountdown(
          Math.ceil((state.circuitBreakerUntil - Date.now()) / 1000),
        );
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [getSyncState]);

  const handleForceSync = () => {
    setIsSyncing(true);
    onForceSync();
    setTimeout(() => setIsSyncing(false), 3000);
  };

  if (!syncState) return null;

  // Circuit Breaker Active - Most Critical
  if (syncState.circuitBreakerActive && countdown > 0) {
    return (
      <InfoBanner variant="error" icon="&#9889;" className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="font-pixel text-pixel-xs uppercase">
              Sync Paused - Rate Limited
            </p>
            <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
              Server is busy. Auto-retry in {countdown}s.
              {pendingShares > 0 && ` ${pendingShares} shares waiting.`}
            </p>
          </div>
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="font-pixel text-pixel-2xs px-3 py-2 bg-pixel-primary text-black border-2 border-black hover:bg-pixel-primary/80 disabled:opacity-50 cursor-pointer"
          >
            {isSyncing ? "SYNCING..." : "RETRY NOW"}
          </button>
        </div>
      </InfoBanner>
    );
  }

  // Failed Shares - Dead Letter Queue
  if (failedShares > 0) {
    return (
      <InfoBanner variant="warning" icon="&#9888;" className="mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="font-pixel text-pixel-xs uppercase">
              {failedShares} Shares Failed
            </p>
            <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
              Some shares couldn&apos;t sync. Try force sync to recover.
            </p>
          </div>
          <button
            onClick={handleForceSync}
            disabled={isSyncing}
            className="font-pixel text-pixel-2xs px-3 py-2 bg-pixel-warning text-black border-2 border-black hover:bg-pixel-warning/80 disabled:opacity-50 cursor-pointer"
          >
            {isSyncing ? "SYNCING..." : "FORCE SYNC"}
          </button>
        </div>
      </InfoBanner>
    );
  }

  // API Unhealthy
  if (!syncState.apiHealthy && syncState.isOnline) {
    return (
      <InfoBanner variant="warning" icon="&#128268;" className="mb-4">
        <p className="font-pixel text-pixel-xs uppercase">Server Unavailable</p>
        <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
          Mining continues locally. Shares will sync when server recovers.
        </p>
      </InfoBanner>
    );
  }

  // Offline
  if (!syncState.isOnline) {
    return (
      <InfoBanner variant="info" icon="&#128247;" className="mb-4">
        <p className="font-pixel text-pixel-xs uppercase">Offline Mode</p>
        <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
          Mining locally. {pendingShares} shares will sync when online.
        </p>
      </InfoBanner>
    );
  }

  // All good - no alert needed
  return null;
}

export default SyncStatusAlert;
