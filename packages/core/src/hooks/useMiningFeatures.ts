/**
 * useMiningFeatures Hook
 *
 * Integrates all advanced mining features:
 * - State persistence (resume after browser close)
 * - Tab coordination (one tab mines at a time)
 * - Wake lock (screen doesn't sleep)
 *
 * @example
 * ```tsx
 * function MiningPage() {
 *   const { features, lifetimeStats } = useMiningFeatures();
 *
 *   return (
 *     <div>
 *       <p>Wake Lock: {features.wakeLock ? 'Active' : 'Inactive'}</p>
 *       <p>Is Leader: {features.isLeader ? 'Yes' : 'No'}</p>
 *       <p>Total Hashes: {lifetimeStats.totalHashes}</p>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getMiningPersistence,
  type PersistedMiningState,
} from "../mining/persistence";
import {
  getTabCoordinator,
  MiningTabCoordinator,
} from "../mining/tab-coordinator";
import { getMiningWakeLock, MiningWakeLock } from "../mining/wake-lock";
import { MIN_DIFFICULTY } from "../tokenomics/constants";

// =============================================================================
// TYPES
// =============================================================================

export interface MiningFeatures {
  // Persistence
  canResume: boolean;
  lastSavedState: PersistedMiningState | null;

  // Tab Coordination
  isLeader: boolean;
  isWaitingForLeadership: boolean;
  activeTabCount: number;
  webLocksSupported: boolean;

  // Wake Lock
  wakeLockActive: boolean;
  wakeLockSupported: boolean;
}

export interface LifetimeStats {
  totalHashes: number;
  totalShares: number;
  totalDuration: number;
  sessionCount: number;
}

export interface UseMiningFeaturesOptions {
  /** Enable auto wake lock when mining starts */
  autoWakeLock?: boolean;
  /** Enable tab coordination */
  enableTabCoordination?: boolean;
  /** Enable state persistence */
  enablePersistence?: boolean;
}

export interface UseMiningFeaturesReturn {
  features: MiningFeatures;
  lifetimeStats: LifetimeStats;

  // Persistence actions
  saveState: (state: Partial<PersistedMiningState>) => Promise<void>;
  loadState: () => Promise<PersistedMiningState | null>;
  clearState: () => Promise<void>;
  startAutoSave: (getState: () => Partial<PersistedMiningState>) => void;
  stopAutoSave: () => void;

  // Tab coordination actions
  requestLeadership: () => Promise<void>;
  releaseLeadership: () => void;

  // Wake lock actions
  acquireWakeLock: () => Promise<boolean>;
  releaseWakeLock: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMiningFeatures(
  options: UseMiningFeaturesOptions = {},
): UseMiningFeaturesReturn {
  const {
    autoWakeLock = true,
    enableTabCoordination = true,
    enablePersistence = true,
  } = options;

  // Refs for singletons
  const persistenceRef = useRef<ReturnType<typeof getMiningPersistence> | null>(
    null,
  );
  const coordinatorRef = useRef<MiningTabCoordinator | null>(null);
  const wakeLockRef = useRef<MiningWakeLock | null>(null);

  // Feature state
  const [features, setFeatures] = useState<MiningFeatures>({
    canResume: false,
    lastSavedState: null,
    isLeader: false,
    isWaitingForLeadership: false,
    activeTabCount: 1,
    webLocksSupported: false,
    wakeLockActive: false,
    wakeLockSupported: false,
  });

  // Lifetime stats
  const [lifetimeStats, setLifetimeStats] = useState<LifetimeStats>({
    totalHashes: 0,
    totalShares: 0,
    totalDuration: 0,
    sessionCount: 0,
  });

  // Initialize features
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Initialize persistence
      if (enablePersistence) {
        const persistence = getMiningPersistence();
        persistenceRef.current = persistence;

        try {
          await persistence.open();
          const savedState = await persistence.loadState();
          const stats = await persistence.getLifetimeStats();

          if (mounted) {
            setFeatures((prev) => ({
              ...prev,
              canResume: savedState !== null,
              lastSavedState: savedState,
            }));
            setLifetimeStats(stats);
          }
        } catch (err) {
          console.warn("[useMiningFeatures] Persistence init failed:", err);
        }
      }

      // Initialize tab coordinator
      if (enableTabCoordination) {
        coordinatorRef.current = getTabCoordinator({
          onBecomeLeader: () => {
            if (mounted) {
              setFeatures((prev) => ({
                ...prev,
                isLeader: true,
                isWaitingForLeadership: false,
              }));
            }
          },
          onLostLeadership: () => {
            if (mounted) {
              setFeatures((prev) => ({
                ...prev,
                isLeader: false,
              }));
            }
          },
          onWaitingForLeadership: () => {
            if (mounted) {
              setFeatures((prev) => ({
                ...prev,
                isWaitingForLeadership: true,
              }));
            }
          },
        });

        if (mounted) {
          setFeatures((prev) => ({
            ...prev,
            webLocksSupported: MiningTabCoordinator.isSupported(),
          }));
        }
      }

      // Initialize wake lock
      wakeLockRef.current = getMiningWakeLock();
      if (mounted) {
        setFeatures((prev) => ({
          ...prev,
          wakeLockSupported: MiningWakeLock.isSupported(),
        }));
      }

      if (autoWakeLock) {
        wakeLockRef.current.enableAutoReacquire();
      }
    }

    init();

    return () => {
      mounted = false;
      // Cleanup: stop auto-save if it was started
      persistenceRef.current?.stopAutoSave();
      // Cleanup: disable auto-reacquire if it was enabled
      if (autoWakeLock) {
        wakeLockRef.current?.disableAutoReacquire();
      }
      // Note: We don't destroy the singletons here as they are global
      // and may be used by other components
    };
  }, [enablePersistence, enableTabCoordination, autoWakeLock]);

  // Persistence actions
  const saveState = useCallback(
    async (state: Partial<PersistedMiningState>) => {
      if (!persistenceRef.current) return;
      const currentState =
        (await persistenceRef.current.loadState()) || getDefaultState();
      await persistenceRef.current.saveState({ ...currentState, ...state });
    },
    [],
  );

  const loadState = useCallback(async () => {
    if (!persistenceRef.current) return null;
    return persistenceRef.current.loadState();
  }, []);

  const clearState = useCallback(async () => {
    if (!persistenceRef.current) return;
    await persistenceRef.current.clearState();
    setFeatures((prev) => ({
      ...prev,
      canResume: false,
      lastSavedState: null,
    }));
  }, []);

  const startAutoSave = useCallback(
    (getState: () => Partial<PersistedMiningState>) => {
      persistenceRef.current?.startAutoSave(getState);
    },
    [],
  );

  const stopAutoSave = useCallback(() => {
    persistenceRef.current?.stopAutoSave();
  }, []);

  // Tab coordination actions
  const requestLeadership = useCallback(async () => {
    await coordinatorRef.current?.requestLeadership();
  }, []);

  const releaseLeadership = useCallback(() => {
    coordinatorRef.current?.releaseLeadership();
  }, []);

  // Wake lock actions
  const acquireWakeLock = useCallback(async () => {
    const acquired = (await wakeLockRef.current?.acquire()) ?? false;
    setFeatures((prev) => ({ ...prev, wakeLockActive: acquired }));
    return acquired;
  }, []);

  const releaseWakeLock = useCallback(async () => {
    await wakeLockRef.current?.release();
    setFeatures((prev) => ({ ...prev, wakeLockActive: false }));
  }, []);

  // Update tab count periodically
  useEffect(() => {
    if (!enableTabCoordination) return;

    const interval = setInterval(() => {
      const info = coordinatorRef.current?.getInfo();
      if (info) {
        setFeatures((prev) => ({
          ...prev,
          activeTabCount: info.activeTabCount,
          isLeader: info.isLeader,
        }));
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [enableTabCoordination]);

  return {
    features,
    lifetimeStats,
    saveState,
    loadState,
    clearState,
    startAutoSave,
    stopAutoSave,
    requestLeadership,
    releaseLeadership,
    acquireWakeLock,
    releaseWakeLock,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function getDefaultState(): PersistedMiningState {
  return {
    lastNonce: 0,
    totalHashes: 0,
    totalShares: 0,
    difficulty: MIN_DIFFICULTY,
    lastBlockData: "",
    lastSavedAt: Date.now(),
    sessionUptime: 0,
    tokensEarned: 0,
  };
}
