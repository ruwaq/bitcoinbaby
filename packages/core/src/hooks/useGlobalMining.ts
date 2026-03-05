/**
 * useGlobalMining Hook
 *
 * React hook that connects to the global MiningManager singleton.
 * Mining state persists across page navigations because the manager
 * lives outside of React's component lifecycle.
 *
 * @example
 * ```tsx
 * function MiningPage() {
 *   const { isRunning, hashrate, start, stop } = useGlobalMining();
 *
 *   return (
 *     <div>
 *       <p>Hashrate: {hashrate} H/s</p>
 *       <button onClick={isRunning ? stop : start}>
 *         {isRunning ? 'Stop' : 'Start'}
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  getMiningManager,
  type MiningManagerState,
  type MiningManagerConfig,
} from "../mining/mining-singleton";
import { useMiningStore } from "../stores/mining-store";
import { useNFTStore } from "../stores/nft-store";

// =============================================================================
// TYPES
// =============================================================================

export interface UseGlobalMiningOptions {
  /** Mining difficulty (leading zero bits) */
  difficulty?: number;
  /** Miner address for rewards */
  minerAddress?: string;
  /** Auto-start mining when hook mounts */
  autoStart?: boolean;
  /**
   * @deprecated NFT boost is now read from NFTStore.bestBoost automatically.
   * This option is ignored.
   */
  nftBoost?: number;
  /** Cosmic energy multiplier (0.5-2.0) */
  cosmicMultiplier?: number;
  /** Callback when work is found */
  onWorkFound?: MiningManagerConfig["onWorkFound"];
  /** Callback on error */
  onError?: MiningManagerConfig["onError"];
}

export interface UseGlobalMiningReturn extends MiningManagerState {
  /** Effective hashrate with all boosts applied */
  effectiveHashrate: number;
  /** NFT boost percentage */
  nftBoost: number;
  /** Cosmic energy multiplier */
  cosmicMultiplier: number;
  /** Session uptime in seconds */
  uptime: number;
  /** Start mining */
  start: (blockData?: string) => Promise<void>;
  /** Stop mining */
  stop: () => void;
  /** Pause mining */
  pause: () => void;
  /** Resume mining */
  resume: () => void;
  /** Toggle mining state */
  toggle: (blockData?: string) => Promise<void>;
  /** Set difficulty */
  setDifficulty: (difficulty: number) => void;
  /** Set NFT boost */
  setNFTBoost: (boost: number) => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useGlobalMining(
  options: UseGlobalMiningOptions = {},
): UseGlobalMiningReturn {
  const {
    difficulty = 16, // D16 minimum to match contract
    minerAddress,
    autoStart = false,
    // nftBoost is deprecated - read from NFTStore instead
    cosmicMultiplier: initialCosmicMultiplier = 1.0,
    onWorkFound,
    onError,
  } = options;

  // Get global manager
  const manager = useMemo(() => getMiningManager(), []);

  // Local state from manager
  const [managerState, setManagerState] = useState<MiningManagerState>(
    manager.getState(),
  );

  // Get Zustand stores
  const { cosmicMultiplier, updateStats } = useMiningStore();

  // Read NFT boost directly from NFTStore (single source of truth)
  const nftBoost = useNFTStore((s) => s.bestBoost);

  // Uptime counter
  const [uptime, setUptime] = useState(0);

  // Initialize manager on mount
  useEffect(() => {
    manager.initialize({
      initialDifficulty: difficulty,
      minerAddress,
      onWorkFound,
      onError,
    });

    // Subscribe to state changes
    const unsubscribe = manager.subscribe((state) => {
      setManagerState(state);

      // Sync with Zustand store
      updateStats({
        hashrate: state.hashrate,
        totalHashes: state.totalHashes,
        isActive: state.isRunning,
        minerType: state.minerType ?? "cpu",
        difficulty: state.difficulty,
      });
    });

    return () => {
      unsubscribe();
      // Note: We do NOT destroy the manager here!
      // The manager persists across navigation
    };
  }, [manager, difficulty, minerAddress, onWorkFound, onError, updateStats]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && !managerState.isRunning && manager.isInitialized()) {
      manager.start().catch(console.error);
    }
  }, [autoStart, manager, managerState.isRunning]);

  // Note: NFT boost is now read directly from NFTStore (populated by useNFTSync)
  // The initialNftBoost option is deprecated - boost comes from owned NFTs

  // Uptime timer
  useEffect(() => {
    if (!managerState.isRunning) {
      setUptime(0);
      return;
    }

    const interval = setInterval(() => {
      setUptime(manager.getUptime());
    }, 1000);

    return () => clearInterval(interval);
  }, [managerState.isRunning, manager]);

  // Calculate effective hashrate with boosts
  // NFT boost comes from NFTStore (single source of truth)
  const effectiveHashrate = useMemo(() => {
    const boostMultiplier = 1 + nftBoost / 100;
    const cosmic = cosmicMultiplier || initialCosmicMultiplier;
    return Math.floor(managerState.hashrate * boostMultiplier * cosmic);
  }, [
    managerState.hashrate,
    nftBoost,
    cosmicMultiplier,
    initialCosmicMultiplier,
  ]);

  // Actions
  const start = useCallback(
    async (blockData?: string) => {
      await manager.start(blockData);
    },
    [manager],
  );

  const stop = useCallback(() => {
    manager.stop();
  }, [manager]);

  const pause = useCallback(() => {
    manager.pause();
  }, [manager]);

  const resume = useCallback(() => {
    manager.resume();
  }, [manager]);

  const toggle = useCallback(
    async (blockData?: string) => {
      await manager.toggle(blockData);
    },
    [manager],
  );

  const setDifficulty = useCallback(
    (newDifficulty: number) => {
      manager.setDifficulty(newDifficulty);
    },
    [manager],
  );

  /**
   * @deprecated NFT boost is now read directly from NFTStore.
   * This function is a no-op. Use useNFTSync to populate NFT data.
   */
  const setNFTBoost = useCallback((_boost: number) => {
    console.warn(
      "[useGlobalMining] setNFTBoost() is deprecated. NFT boost is read from NFTStore automatically.",
    );
  }, []);

  return {
    ...managerState,
    effectiveHashrate,
    nftBoost,
    cosmicMultiplier: cosmicMultiplier || initialCosmicMultiplier,
    uptime,
    start,
    stop,
    pause,
    resume,
    toggle,
    setDifficulty,
    setNFTBoost,
  };
}
