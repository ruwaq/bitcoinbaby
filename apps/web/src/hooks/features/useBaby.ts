import { useState, useEffect, useCallback, useRef } from "react";
import {
  useGameLoop,
  useAchievements,
  useGlobalMining,
  MIN_DIFFICULTY,
  type GameEvent,
  type UseGameLoopReturn,
  type UseAchievementsReturn,
} from "@bitcoinbaby/core";
import { useBabyState, type BabyVisualState } from "@/hooks/useBabyState";

/**
 * useBaby - Unified hook for baby care and game state
 *
 * Combines:
 * - Game loop (baby state, actions, progression)
 * - Achievements tracking
 * - Mining XP integration
 * - Baby visual state derivation
 *
 * @example
 * const { baby, actions, achievements, mining, isLoading } = useBaby();
 */

export interface UseBabyOptions {
  /** Auto-start game loop */
  autoStart?: boolean;
  /** Callback for evolution events */
  onEvolution?: (data: EvolutionData) => void;
}

export interface EvolutionData {
  fromStage: string;
  toStage: string;
  newLevel: number;
  stageName: string;
  miningBonus: number;
}

export interface UseBabyReturn {
  // Baby state
  baby: UseGameLoopReturn["baby"];
  babyState: BabyVisualState | null;
  isLoading: boolean;
  isDead: boolean;
  daysUntilDecay: number | null;

  // Actions
  actions: {
    createBaby: (name: string, miningSharesBaseline?: number) => void;
    performAction: UseGameLoopReturn["performAction"];
    revive: UseGameLoopReturn["revive"];
  };

  // Achievements
  achievements: UseAchievementsReturn;

  // Mining integration
  mining: {
    isRunning: boolean;
    shares: number;
    hashrate: number;
    nftBoost: number;
  };

  // Evolution modal state
  evolutionData: EvolutionData | null;
  clearEvolution: () => void;
}

export function useBaby(options: UseBabyOptions = {}): UseBabyReturn {
  const { autoStart = true, onEvolution } = options;

  // Evolution modal state
  const [evolutionData, setEvolutionData] = useState<EvolutionData | null>(
    null,
  );

  // Game event handler
  const handleGameEvent = useCallback(
    (event: GameEvent) => {
      if (event.type === "evolved") {
        const data: EvolutionData = {
          fromStage: event.data.fromStage,
          toStage: event.data.toStage,
          newLevel: event.data.newLevel,
          stageName: event.data.stageName,
          miningBonus: event.data.miningBonus,
        };
        setEvolutionData(data);
        onEvolution?.(data);
      }
    },
    [onEvolution],
  );

  // Game loop
  const game = useGameLoop({
    autoStart,
    onEvent: handleGameEvent,
  });

  // Baby visual state
  const babyState = useBabyState(game.baby);

  // Achievements
  const achievements = useAchievements({
    gameState: game.state,
  });

  // Mining (for XP tracking)
  const mining = useGlobalMining({
    difficulty: MIN_DIFFICULTY,
    minerAddress: "baby-miner-001",
  });

  // Track mining progress for XP
  const lastProcessedSharesRef = useRef<number>(mining.shares);
  const lastProcessedHashesRef = useRef<number>(mining.totalHashes);
  const babyIdRef = useRef<string | null>(null);

  // Reset refs when baby changes
  useEffect(() => {
    const currentBabyId = game.baby?.id ?? null;
    if (currentBabyId !== babyIdRef.current) {
      const baseline = game.baby?.miningSharesBaseline ?? 0;
      lastProcessedSharesRef.current = Math.max(baseline, mining.shares);
      lastProcessedHashesRef.current = mining.totalHashes;
      babyIdRef.current = currentBabyId;
    }
  }, [
    game.baby?.id,
    game.baby?.miningSharesBaseline,
    mining.shares,
    mining.totalHashes,
  ]);

  // Sync mining state with game
  useEffect(() => {
    if (game.baby && !game.isDead) {
      game.setMining(mining.isRunning);
    }
  }, [mining.isRunning, game.baby, game.isDead, game.setMining]);

  // Record mining progress for XP
  useEffect(() => {
    if (!game.baby || game.isDead) return;

    const newShares = mining.shares - lastProcessedSharesRef.current;
    const newHashes = mining.totalHashes - lastProcessedHashesRef.current;

    if (newShares > 0 || newHashes > 0) {
      game.recordMiningProgress(
        newHashes > 0 ? newHashes : 0,
        newShares > 0 ? newShares : 0,
      );
      lastProcessedSharesRef.current = mining.shares;
      lastProcessedHashesRef.current = mining.totalHashes;
    }
  }, [
    mining.shares,
    mining.totalHashes,
    game.baby,
    game.isDead,
    game.recordMiningProgress,
  ]);

  const clearEvolution = useCallback(() => {
    setEvolutionData(null);
  }, []);

  return {
    // Baby state
    baby: game.baby,
    babyState,
    isLoading: game.isLoading,
    isDead: game.isDead,
    daysUntilDecay: game.daysUntilDecay,

    // Actions
    actions: {
      createBaby: game.createBaby,
      performAction: game.performAction,
      revive: game.revive,
    },

    // Achievements
    achievements,

    // Mining
    mining: {
      isRunning: mining.isRunning,
      shares: mining.shares,
      hashrate: mining.effectiveHashrate,
      nftBoost: mining.nftBoost,
    },

    // Evolution
    evolutionData,
    clearEvolution,
  };
}

export default useBaby;
