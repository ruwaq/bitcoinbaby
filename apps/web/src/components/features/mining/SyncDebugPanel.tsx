"use client";

/**
 * SyncDebugPanel - Debug panel for share sync state
 *
 * Shows:
 * - Online status
 * - API health
 * - Circuit breaker status
 * - Failure count
 * - Force sync button
 */

import { useState, useEffect, useCallback } from "react";

interface SyncState {
  isOnline: boolean;
  apiHealthy: boolean;
  circuitBreakerActive: boolean;
  circuitBreakerUntil: number;
  consecutiveFailures: number;
}

interface SyncDebugPanelProps {
  getSyncState: () => SyncState;
  onForceSync: () => void;
}

export function SyncDebugPanel({
  getSyncState,
  onForceSync,
}: SyncDebugPanelProps) {
  const [syncState, setSyncState] = useState<SyncState | null>(null);
  const [forceSyncTriggered, setForceSyncTriggered] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Update sync state and current time periodically
  useEffect(() => {
    const update = () => {
      setSyncState(getSyncState());
      setNow(Date.now());
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [getSyncState]);

  // Handle force sync with visual feedback
  const handleForceSync = useCallback(() => {
    console.log("[SyncDebugPanel] Force Sync triggered");
    setForceSyncTriggered(true);
    onForceSync();
    // Update state immediately and reset button after delay
    setTimeout(() => setSyncState(getSyncState()), 300);
    setTimeout(() => setForceSyncTriggered(false), 2000);
  }, [onForceSync, getSyncState]);

  if (!syncState) return null;

  return (
    <div className="mt-3 p-2 bg-pixel-bg-dark/50 rounded font-pixel text-pixel-2xs space-y-1">
      <div className="flex justify-between">
        <span>Online:</span>
        <span
          className={syncState.isOnline ? "text-green-400" : "text-red-400"}
        >
          {syncState.isOnline ? "Yes" : "No"}
        </span>
      </div>
      <div className="flex justify-between">
        <span>API Health:</span>
        <span
          className={syncState.apiHealthy ? "text-green-400" : "text-red-400"}
        >
          {syncState.apiHealthy ? "OK" : "Down"}
        </span>
      </div>
      <div className="flex justify-between">
        <span>Circuit Breaker:</span>
        <span
          className={
            syncState.circuitBreakerActive ? "text-red-400" : "text-green-400"
          }
        >
          {syncState.circuitBreakerActive ? "ACTIVE" : "OK"}
        </span>
      </div>
      {syncState.circuitBreakerActive && (
        <div className="text-yellow-400">
          Resets in: {Math.ceil((syncState.circuitBreakerUntil - now) / 1000)}s
        </div>
      )}
      <div className="flex justify-between">
        <span>Failures:</span>
        <span>{syncState.consecutiveFailures}</span>
      </div>
      <button
        onClick={handleForceSync}
        disabled={forceSyncTriggered}
        className={`w-full mt-2 py-2 min-h-[36px] font-pixel text-pixel-xs rounded cursor-pointer border-2 transition-all active:scale-95 ${
          forceSyncTriggered
            ? "bg-green-500 border-green-400 text-white animate-pulse"
            : "bg-pixel-primary hover:bg-pixel-primary/80 text-black border-pixel-primary/50"
        }`}
      >
        {forceSyncTriggered ? "SYNCING..." : "FORCE SYNC"}
      </button>
    </div>
  );
}

export default SyncDebugPanel;
