/**
 * useSparkState - Baby State Convenience Hook
 *
 * Provides derived spark state values and visual state calculations.
 */

"use client";

import { useMemo } from "react";
import {
  type GameSpark,
  STAGE_NAMES,
  MINING_BONUS,
  getSpriteForm,
  getStageVariant,
  type SparkSpriteForm,
  type SparkVisualState,
} from "@bitcoinbaby/core";

interface UseSparkStateReturn {
  // Identity
  name: string;
  id: string;

  // Visual
  spriteForm: SparkSpriteForm;
  spriteVariant: 1 | 2 | 3;
  visualState: SparkVisualState;
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
export type { UseSparkStateReturn as SparkVisualState };

export function useSparkState(spark: GameSpark | null): UseSparkStateReturn | null {
  return useMemo(() => {
    if (!spark) return null;

    const spriteForm = getSpriteForm(spark.progression.stage);
    const spriteVariant = getStageVariant(spark.progression.stage) as 1 | 2 | 3;
    const miningBonus = MINING_BONUS[spark.progression.stage];

    // Check if any stat is critical
    const isCritical =
      spark.stats.energy <= 20 ||
      spark.stats.happiness <= 20 ||
      spark.stats.hunger >= 80 ||
      spark.stats.health <= 20;

    // Check if spark needs attention (warning level)
    const needsAttention =
      spark.stats.energy <= 40 ||
      spark.stats.happiness <= 40 ||
      spark.stats.hunger >= 60 ||
      spark.stats.health <= 40;

    return {
      // Identity
      name: spark.name,
      id: spark.id,

      // Visual
      spriteForm,
      spriteVariant,
      visualState: spark.visualState,
      stageName: STAGE_NAMES[spark.progression.stage],

      // Stats
      energy: spark.stats.energy,
      happiness: spark.stats.happiness,
      hunger: spark.stats.hunger,
      health: spark.stats.health,

      // Progression
      level: spark.progression.level,
      xp: spark.progression.xp,
      xpToNextLevel: spark.progression.xpToNextLevel,
      xpPercentage:
        spark.progression.xpToNextLevel > 0
          ? (spark.progression.xp / spark.progression.xpToNextLevel) * 100
          : 0,

      // Mining
      miningBonus,
      miningBonusDisplay: `+${Math.round((miningBonus - 1) * 100)}%`,

      // Flags
      isSleeping: spark.isSleeping,
      isMining: spark.isMining,
      isCritical,
      needsAttention,
    };
  }, [spark]);
}

export default useSparkState;
