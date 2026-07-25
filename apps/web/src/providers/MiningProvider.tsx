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
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  getMiningManager,
  forceSaveMiningState,
  MIN_DIFFICULTY,
  type MiningManagerState,
} from "@bitcoinbaby/core";
// =============================================================================
// CONTEXT
// =============================================================================

interface MiningContextValue {
  isInitialized: boolean;
  state: MiningManagerState;
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
  const initializedRef = useRef(false);
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
    aiStatus: null,
    // Feature states
    isLeader: false,
    isWaitingForLeadership: false,
    wakeLockActive: false,
    canResume: false,
    lifetimeHashes: 0,
    lifetimeShares: 0,
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
      if (!initializedRef.current) {
        initializedRef.current = true;
        setIsInitialized(true);
      }
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

  return (
    <MiningContext.Provider value={{ isInitialized, state }}>
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
