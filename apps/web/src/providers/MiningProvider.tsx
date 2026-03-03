"use client";

/**
 * MiningProvider
 *
 * Initializes the global MiningManager on app mount.
 * The manager persists across page navigations.
 *
 * Also monitors SharedWorker mining when available for
 * multi-tab mining support.
 *
 * Provides a global mining status indicator that shows
 * when mining is active, even when not on the /mine page.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getMiningManager,
  forceSaveMiningState,
  formatHashrate,
  formatTotal,
  MIN_DIFFICULTY,
  type MiningManagerState,
} from "@bitcoinbaby/core";
import { supportsSharedWorker } from "@/hooks/useSharedMining";

// =============================================================================
// CONTEXT
// =============================================================================

interface MiningContextValue {
  isInitialized: boolean;
  state: MiningManagerState;
  sharedWorkerSupported: boolean;
}

const MiningContext = createContext<MiningContextValue | null>(null);

// =============================================================================
// PROVIDER
// =============================================================================

interface MiningProviderProps {
  children: ReactNode;
}

export function MiningProvider({ children }: MiningProviderProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [sharedWorkerSupported] = useState(() => supportsSharedWorker());
  const [state, setState] = useState<MiningManagerState>({
    isRunning: false,
    isPaused: false,
    hashrate: 0,
    totalHashes: 0,
    shares: 0,
    difficulty: MIN_DIFFICULTY,
    minerType: null,
    capabilities: null,
    lastShare: null,
    error: null,
    sessionStartTime: null,
    // Feature states
    isLeader: true,
    isWaitingForLeadership: false,
    wakeLockActive: false,
    canResume: false,
    lifetimeHashes: 0,
    lifetimeShares: 0,
  });

  // SharedWorker state (for multi-tab mining)
  const [sharedWorkerState, setSharedWorkerState] = useState({
    isRunning: false,
    hashrate: 0,
    shares: 0,
  });

  // Initialize singleton mining manager
  useEffect(() => {
    const manager = getMiningManager();
    manager.initialize({
      preferWebGPU: true,
      fallbackToCPU: true,
      throttleOnBattery: true,
      throttleWhenHidden: true,
    });

    // Subscribe to state changes
    const unsubscribe = manager.subscribe((newState) => {
      setState(newState);
      // Mark as initialized in the callback (not synchronously)
      setIsInitialized(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Save mining state on page unload to prevent data loss
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Force save mining state synchronously (fire-and-forget)
      forceSaveMiningState();
    };

    // Also handle visibility change for mobile (where beforeunload may not fire)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        forceSaveMiningState();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Listen to SharedWorker state (if supported)
  useEffect(() => {
    if (!sharedWorkerSupported || typeof SharedWorker === "undefined") return;

    let worker: SharedWorker;
    try {
      worker = new SharedWorker("/workers/mining-shared-worker.js", {
        name: "bitcoinbaby-mining",
      });

      // Handle worker errors
      worker.onerror = (error) => {
        const errorMessage =
          error instanceof ErrorEvent
            ? error.message
            : "SharedWorker failed to load";
        console.error("[MiningProvider] SharedWorker error:", errorMessage);

        // Reset shared worker state on error
        setSharedWorkerState({
          isRunning: false,
          hashrate: 0,
          shares: 0,
        });
      };

      worker.port.onmessage = (event) => {
        const { type, data } = event.data;

        // Handle error messages from worker
        if (type === "error") {
          console.error("[MiningProvider] SharedWorker reported error:", data);
          return;
        }

        if (type === "state" || type === "stats") {
          setSharedWorkerState((prev) => ({
            isRunning: data.isRunning ?? prev.isRunning,
            hashrate: data.hashrate ?? 0,
            shares: data.shares ?? 0,
          }));
        } else if (type === "status") {
          setSharedWorkerState((prev) => ({
            ...prev,
            isRunning: data === "running",
          }));
        }
      };

      // Handle port errors
      worker.port.onmessageerror = (error) => {
        console.error(
          "[MiningProvider] SharedWorker port message error:",
          error,
        );
      };

      worker.port.start();
      worker.port.postMessage({ type: "getState" });

      // Log successful connection
      console.debug("[MiningProvider] SharedWorker connected successfully");
    } catch (error) {
      // SharedWorker not available - log the reason
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.warn(
        "[MiningProvider] SharedWorker initialization failed:",
        errorMessage,
      );
    }
  }, [sharedWorkerSupported]);

  // Combined mining active state
  const isMiningActive = state.isRunning || sharedWorkerState.isRunning;
  const combinedHashrate = state.hashrate + sharedWorkerState.hashrate;
  const combinedShares = state.shares + sharedWorkerState.shares;

  // Create combined state for indicator
  const indicatorState: MiningManagerState = {
    ...state,
    isRunning: isMiningActive,
    hashrate: combinedHashrate,
    shares: combinedShares,
  };

  return (
    <MiningContext.Provider
      value={{ isInitialized, state, sharedWorkerSupported }}
    >
      {children}
      {/* Global mining indicator - shows on all pages */}
      {isMiningActive && <GlobalMiningIndicator state={indicatorState} />}
    </MiningContext.Provider>
  );
}

// =============================================================================
// GLOBAL MINING INDICATOR
// =============================================================================

interface GlobalMiningIndicatorProps {
  state: MiningManagerState;
}

function GlobalMiningIndicator({ state }: GlobalMiningIndicatorProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center bg-pixel-primary border-2 border-black shadow-[2px_2px_0_0_#000] animate-pulse"
        aria-label="Expand mining status"
      >
        <span className="text-lg">⛏️</span>
      </button>
    );
  }

  return (
    <div className="fixed top-4 right-4 z-50 bg-pixel-bg-dark border-2 border-pixel-primary p-2 shadow-[4px_4px_0_0_#000] min-w-[150px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1">
          <span className="text-sm animate-bounce">⛏️</span>
          <span className="font-pixel text-[8px] text-pixel-primary uppercase">
            Mining
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          className="text-pixel-text-muted hover:text-pixel-text text-xs"
          aria-label="Minimize mining status"
        >
          ─
        </button>
      </div>

      {/* Stats */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            RATE
          </span>
          <span className="font-pixel text-[8px] text-pixel-success">
            {formatHashrate(state.hashrate)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            TYPE
          </span>
          <span className="font-pixel text-[8px] text-pixel-secondary uppercase">
            {state.minerType || "---"}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            SHARES
          </span>
          <span className="font-pixel text-[8px] text-pixel-text">
            {state.shares}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            TOTAL
          </span>
          <span className="font-pixel text-[8px] text-pixel-text">
            {formatTotal(state.lifetimeHashes + state.totalHashes)}
          </span>
        </div>
      </div>

      {/* Feature indicators */}
      <div className="mt-1 flex items-center gap-2">
        {/* Status */}
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-pixel-success animate-pulse" />
          <span className="font-pixel text-[6px] text-pixel-success uppercase">
            {state.isPaused ? "Paused" : "Active"}
          </span>
        </div>

        {/* Wake Lock indicator */}
        {state.wakeLockActive && (
          <span
            className="font-pixel text-[6px] text-pixel-secondary"
            title="Screen stays on"
          >
            ☀️
          </span>
        )}

        {/* Leader indicator */}
        {state.isLeader && (
          <span
            className="font-pixel text-[6px] text-pixel-primary"
            title="This tab is mining"
          >
            👑
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// HOOK
// =============================================================================

export function useMiningContext(): MiningContextValue {
  const context = useContext(MiningContext);
  if (!context) {
    throw new Error("useMiningContext must be used within MiningProvider");
  }
  return context;
}

export default MiningProvider;
