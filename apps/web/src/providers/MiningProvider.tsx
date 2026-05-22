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

  return (
    <MiningContext.Provider
      value={{ isInitialized, state, sharedWorkerSupported }}
    >
      {children}
    </MiningContext.Provider>
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
