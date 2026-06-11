/**
 * useGameLoop - Game Engine Hook
 *
 * Manages the game engine lifecycle and provides
 * access to game state and actions.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getGameEngine,
  type GameState,
  type GameBaby,
  type GameEvent,
  type GameAction,
  STAGE_NAMES,
  MINING_BONUS,
  calculateLevelDecay,
  getDaysUntilDecay,
  reviveBaby,
  isBabyDead,
} from "../game";

export interface UseGameLoopOptions {
  autoStart?: boolean;
  onEvent?: (event: GameEvent) => void;
}

export interface UseGameLoopReturn {
  // State
  baby: GameBaby | null;
  state: GameState | null;
  isLoading: boolean;
  isDead: boolean;

  // Derived values
  stageName: string;
  miningBonus: number;
  daysUntilDecay: number | null;

  // Actions
  createBaby: (name: string, miningSharesBaseline?: number) => void;
  performAction: (action: GameAction) => void;
  setMining: (isMining: boolean) => void;
  recordMiningProgress: (hashes: number, shares: number) => void;
  revive: () => void;
  save: () => Promise<void>;
  reset: () => Promise<void>;

  // Engine control
  start: () => void;
  stop: () => void;
}

export function useGameLoop(
  options: UseGameLoopOptions = {},
): UseGameLoopReturn {
  const { autoStart = true, onEvent } = options;

  const [state, setState] = useState<GameState | null>(null);
  const [baby, setBaby] = useState<GameBaby | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDead, setIsDead] = useState(false);

  const engineRef = useRef(getGameEngine());
  const engine = engineRef.current;

  // Initialize engine
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await engine.initialize();

      if (!mounted) return;

      setState(engine.getState());
      setBaby(engine.getBaby());

      // Check for dead baby
      const currentBaby = engine.getBaby();
      if (currentBaby) {
        const { isDead: dead } = calculateLevelDecay(
          currentBaby.progression,
          currentBaby.lastMined,
        );
        setIsDead(dead || isBabyDead(currentBaby));
      }

      setIsLoading(false);

      if (autoStart) {
        engine.start();
      }
    };

    init();

    return () => {
      mounted = false;
      engine.stop();
    };
  }, [engine, autoStart]);

  // Subscribe to events
  useEffect(() => {
    const unsubscribe = engine.on((event) => {
      // Update local state
      setState(engine.getState());
      setBaby(engine.getBaby());

      // Check for death on tick
      if (event.type === "tick") {
        const currentBaby = engine.getBaby();
        if (currentBaby) {
          setIsDead(isBabyDead(currentBaby));
        }
      }

      // Forward to consumer
      onEvent?.(event);
    });

    return unsubscribe;
  }, [engine, onEvent]);

  // Derived values
  const stageName = baby ? STAGE_NAMES[baby.progression.stage] : "";
  const miningBonus = baby ? MINING_BONUS[baby.progression.stage] : 1;
  const daysUntilDecay = baby ? getDaysUntilDecay(baby.lastMined) : null;

  // Actions
  const createBaby = useCallback(
    (name: string, miningSharesBaseline = 0) => {
      engine.createBaby(name, miningSharesBaseline);
      setBaby(engine.getBaby());
      setState(engine.getState());
      setIsDead(false);
    },
    [engine],
  );

  const performAction = useCallback(
    (action: GameAction) => {
      if (isDead) return;
      engine.performAction(action);
      // Spread to create a new reference so React detects the state change
      const baby = engine.getBaby();
      setBaby(baby ? { ...baby } : null);
    },
    [engine, isDead],
  );

  const setMining = useCallback(
    (isMining: boolean) => {
      if (isDead) return;
      engine.setMining(isMining);
      // Don't spread here — setMining is called from effects and would cause loops.
      // The UI will pick up changes on next action/performed event.
    },
    [engine, isDead],
  );

  const recordMiningProgress = useCallback(
    (hashes: number, shares: number) => {
      if (isDead) return;
      engine.recordMiningProgress(hashes, shares);
      // Don't spread here — called from effects, would cause loops.
    },
    [engine, isDead],
  );

  const revive = useCallback(() => {
    const currentBaby = engine.getBaby();
    if (currentBaby && isBabyDead(currentBaby)) {
      reviveBaby(currentBaby);
      engine.createBaby(currentBaby.name);
      setBaby(engine.getBaby());
      setState(engine.getState());
      setIsDead(false);
    }
  }, [engine]);

  const save = useCallback(async () => {
    await engine.save();
  }, [engine]);

  const reset = useCallback(async () => {
    await engine.reset();
    setBaby(null);
    setState(engine.getState());
    setIsDead(false);
  }, [engine]);

  const start = useCallback(() => {
    engine.start();
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
  }, [engine]);

  return {
    baby,
    state,
    isLoading,
    isDead,
    stageName,
    miningBonus,
    daysUntilDecay,
    createBaby,
    performAction,
    setMining,
    recordMiningProgress,
    revive,
    save,
    reset,
    start,
    stop,
  };
}

export default useGameLoop;
