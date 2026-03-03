/**
 * useBabyState - Baby State Convenience Hook
 *
 * Provides derived baby state values and visual state calculations.
 */

"use client";

import { useMemo } from "react";
import {
  type GameBaby,
  STAGE_NAMES,
  MINING_BONUS,
  getSpriteForm,
  getStageVariant,
  type BabySpriteForm,
  type BabyVisualState,
} from "@bitcoinbaby/core";

interface UseBabyStateReturn {
  // Identity
  name: string;
  id: string;

  // Visual
  spriteForm: BabySpriteForm;
  spriteVariant: 1 | 2 | 3;
  visualState: BabyVisualState;
  stageName: string;

  // Stats (normalized 0-100)
  energy: number;
  happiness: number;
  hunger: number;
  health: number;

  // Progression
  level: number;
  xp: number;
  xpToNextLevel: number;
  xpPercentage: number;

  // Mining
  miningBonus: number;
  miningBonusDisplay: string;

  // Flags
  isSleeping: boolean;
  isMining: boolean;
  isCritical: boolean;
  needsAttention: boolean;
}

// Re-export the type for external use
export type { UseBabyStateReturn as BabyVisualState };

export function useBabyState(baby: GameBaby | null): UseBabyStateReturn | null {
  return useMemo(() => {
    if (!baby) return null;

    const spriteForm = getSpriteForm(baby.progression.stage);
    const spriteVariant = getStageVariant(baby.progression.stage) as 1 | 2 | 3;
    const miningBonus = MINING_BONUS[baby.progression.stage];

    // Check if any stat is critical
    const isCritical =
      baby.stats.energy <= 20 ||
      baby.stats.happiness <= 20 ||
      baby.stats.hunger >= 80 ||
      baby.stats.health <= 20;

    // Check if baby needs attention (warning level)
    const needsAttention =
      baby.stats.energy <= 40 ||
      baby.stats.happiness <= 40 ||
      baby.stats.hunger >= 60 ||
      baby.stats.health <= 40;

    return {
      // Identity
      name: baby.name,
      id: baby.id,

      // Visual
      spriteForm,
      spriteVariant,
      visualState: baby.visualState,
      stageName: STAGE_NAMES[baby.progression.stage],

      // Stats
      energy: baby.stats.energy,
      happiness: baby.stats.happiness,
      hunger: baby.stats.hunger,
      health: baby.stats.health,

      // Progression
      level: baby.progression.level,
      xp: baby.progression.xp,
      xpToNextLevel: baby.progression.xpToNextLevel,
      xpPercentage:
        (baby.progression.xp / baby.progression.xpToNextLevel) * 100,

      // Mining
      miningBonus,
      miningBonusDisplay: `+${Math.round((miningBonus - 1) * 100)}%`,

      // Flags
      isSleeping: baby.isSleeping,
      isMining: baby.isMining,
      isCritical,
      needsAttention,
    };
  }, [baby]);
}

export default useBabyState;
