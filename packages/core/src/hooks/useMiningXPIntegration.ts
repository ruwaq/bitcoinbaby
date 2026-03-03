/**
 * useMiningXPIntegration - Award XP to baby when mining is active
 *
 * This hook connects the mining system with the baby progression system,
 * awarding XP based on mining activity with cosmic multiplier applied.
 *
 * XP Calculation:
 * - Base XP: 1 per 1M hashes mined
 * - Cosmic multiplier: 0.5x to 2.0x based on cosmic conditions
 * - Level bonus: +5% per baby level
 */

"use client";

import { useEffect, useRef } from "react";
import { useBabyStore } from "../stores/baby-store";
import { useMiningStore } from "../stores/mining-store";

// =============================================================================
// TYPES
// =============================================================================

interface UseMiningXPOptions {
  /** Hashes per XP point (default: 1_000_000) */
  hashesPerXP?: number;
  /** Enable level-based XP bonus (default: true) */
  enableLevelBonus?: boolean;
  /** Maximum XP per update batch to prevent UI lag (default: 100) */
  maxXpPerBatch?: number;
}

interface UseMiningXPReturn {
  /** Total XP earned in current session */
  sessionXP: number;
  /** Current cosmic multiplier being applied */
  cosmicMultiplier: number;
  /** Current effective XP rate */
  xpRate: number;
  /** Total hashes processed for XP */
  hashesProcessed: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_HASHES_PER_XP = 1_000_000; // 1 XP per 1M hashes
const DEFAULT_MAX_BATCH = 100;
const LEVEL_BONUS_PERCENT = 0.05; // +5% per level

// =============================================================================
// HOOK
// =============================================================================

export function useMiningXPIntegration(
  options: UseMiningXPOptions = {},
): UseMiningXPReturn {
  const {
    hashesPerXP = DEFAULT_HASHES_PER_XP,
    enableLevelBonus = true,
    maxXpPerBatch = DEFAULT_MAX_BATCH,
  } = options;

  // Stores
  const baby = useBabyStore((s) => s.baby);
  const addExperience = useBabyStore((s) => s.addExperience);
  const stats = useMiningStore((s) => s.stats);
  const persistedStats = useMiningStore((s) => s.persistedStats);
  const cosmicMultiplier = useMiningStore((s) => s.cosmicMultiplier);

  // Track hashes to detect mining progress
  const lastHashCountRef = useRef(0);
  const sessionXPRef = useRef(0);
  const hashesProcessedRef = useRef(0);
  const accumulatedHashesRef = useRef(0);

  // Calculate XP rate with all multipliers
  const xpRate = (() => {
    let rate = 1; // Base rate: 1 XP per hashesPerXP

    // Apply cosmic multiplier (0.5 - 2.0)
    rate *= cosmicMultiplier;

    // Apply level bonus if enabled and baby exists
    if (enableLevelBonus && baby) {
      const levelBonus = 1 + baby.level * LEVEL_BONUS_PERCENT;
      rate *= levelBonus;
    }

    return Math.max(0.5, rate);
  })();

  // Watch for mining progress and award XP
  useEffect(() => {
    if (!baby) return;

    // Use current session hashes + lifetime hashes
    const totalHashes = stats.totalHashes + persistedStats.lifetimeHashes;
    const previousHashes = lastHashCountRef.current;

    // Only process if we have new hashes
    if (totalHashes > previousHashes) {
      const newHashes = totalHashes - previousHashes;

      // Accumulate hashes until we reach the threshold
      accumulatedHashesRef.current += newHashes;

      // Calculate XP to award
      const xpUnits = Math.floor(accumulatedHashesRef.current / hashesPerXP);

      if (xpUnits > 0) {
        // Apply rate multiplier
        const xpToAward = Math.min(Math.round(xpUnits * xpRate), maxXpPerBatch);

        if (xpToAward > 0) {
          addExperience(xpToAward);

          // Update tracking
          sessionXPRef.current += xpToAward;
          hashesProcessedRef.current += xpUnits * hashesPerXP;
        }

        // Keep remainder for next accumulation
        accumulatedHashesRef.current =
          accumulatedHashesRef.current % hashesPerXP;
      }
    }

    // Update last hash count
    lastHashCountRef.current = totalHashes;
  }, [
    baby,
    stats.totalHashes,
    persistedStats.lifetimeHashes,
    hashesPerXP,
    xpRate,
    maxXpPerBatch,
    addExperience,
  ]);

  return {
    sessionXP: sessionXPRef.current,
    cosmicMultiplier,
    xpRate,
    hashesProcessed: hashesProcessedRef.current,
  };
}

export default useMiningXPIntegration;
