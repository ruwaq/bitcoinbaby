/**
 * useMiningCosmic - Integration hook for cosmic energy in mining
 *
 * Connects the cosmic energy system with the mining store,
 * automatically updating mining multipliers based on cosmic conditions.
 */

import { useEffect, useMemo } from "react";
import { useMiningStore } from "../stores/mining-store";
import { useCosmicEnergy, useCosmicState } from "./useCosmic";
import type { BaseType, Bloodline, HeritageSeed } from "../types";
import type { Rarity, BabyCosmicEnergy, CosmicState } from "../cosmic";

// =============================================================================
// TYPES
// =============================================================================

interface BabyForMining {
  baseType: BaseType;
  bloodline: Bloodline;
  heritage: HeritageSeed;
  level: number;
  rarity: Rarity;
  energy: number;
  equippedItemsBonus?: number;
}

interface UseMiningCosmicOptions {
  /** Latitude for sun calculations */
  latitude?: number;
  /** Longitude for sun calculations */
  longitude?: number;
  /** Server average level for catch-up bonus */
  serverAverageLevel?: number;
  /** Auto-update interval in ms (default: 60000 = 1 min) */
  updateInterval?: number;
  /** Whether to automatically sync to mining store */
  autoSync?: boolean;
}

interface MiningCosmicState {
  // Cosmic data
  cosmicState: CosmicState | null;
  cosmicEnergy: BabyCosmicEnergy | null;

  // Mining integration
  effectiveMultiplier: number;
  cosmicStatus: "thriving" | "normal" | "struggling" | "critical";
  activeEffects: string[];
  warnings: string[];

  // Mining store values
  baseHashrate: number;
  effectiveHashrate: number;
  nftBoost: number;

  // Combined multiplier breakdown
  totalMultiplier: number;
  multiplierBreakdown: {
    nft: number;
    cosmic: number;
    combined: number;
  };

  // Loading/error state
  isLoading: boolean;
  error: Error | null;

  // Actions
  refresh: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Hook that integrates cosmic energy with mining
 *
 * @param baby - The baby for cosmic calculations (null if no baby)
 * @param options - Configuration options
 * @returns Combined mining + cosmic state
 */
export function useMiningCosmic(
  baby: BabyForMining | null,
  options: UseMiningCosmicOptions = {},
): MiningCosmicState {
  const {
    latitude = 0,
    longitude = 0,
    serverAverageLevel = 25,
    updateInterval = 60000,
    autoSync = true,
  } = options;

  // Get cosmic energy for the baby
  const {
    energy: cosmicEnergy,
    cosmicState,
    isLoading,
    error,
  } = useCosmicEnergy(baby, {
    latitude,
    longitude,
    serverAverageLevel,
    updateInterval,
    context: "mining",
  });

  // Get cosmic state refresh function
  const { refresh } = useCosmicState({
    latitude,
    longitude,
    updateInterval,
  });

  // Get mining store state and actions
  const {
    stats,
    nftBoost,
    effectiveHashrate,
    cosmicMultiplier: storeCosmicMultiplier,
    cosmicStatus: storeCosmicStatus,
    setCosmicEnergy,
  } = useMiningStore();

  // Auto-sync cosmic energy to mining store
  useEffect(() => {
    if (!autoSync || !cosmicEnergy) return;

    // Only update if values actually changed to avoid unnecessary re-renders
    if (
      cosmicEnergy.finalMultiplier !== storeCosmicMultiplier ||
      cosmicEnergy.status !== storeCosmicStatus
    ) {
      setCosmicEnergy(
        cosmicEnergy.finalMultiplier,
        cosmicEnergy.status,
        cosmicEnergy.activeEffects,
      );
    }
  }, [
    autoSync,
    cosmicEnergy,
    storeCosmicMultiplier,
    storeCosmicStatus,
    setCosmicEnergy,
  ]);

  // Calculate combined multipliers
  const multiplierBreakdown = useMemo(() => {
    const nftMultiplier = 1 + nftBoost / 100;
    const cosmic = cosmicEnergy?.finalMultiplier ?? 1.0;
    const combined = nftMultiplier * cosmic;

    return {
      nft: nftMultiplier,
      cosmic,
      combined,
    };
  }, [nftBoost, cosmicEnergy]);

  // Build the return state
  return {
    // Cosmic data
    cosmicState,
    cosmicEnergy,

    // Mining integration
    effectiveMultiplier: cosmicEnergy?.finalMultiplier ?? 1.0,
    cosmicStatus: cosmicEnergy?.status ?? "normal",
    activeEffects: cosmicEnergy?.activeEffects ?? [],
    warnings: cosmicEnergy?.warnings ?? [],

    // Mining store values
    baseHashrate: stats.hashrate,
    effectiveHashrate,
    nftBoost,

    // Combined multiplier breakdown
    totalMultiplier: multiplierBreakdown.combined,
    multiplierBreakdown,

    // Loading/error state
    isLoading,
    error,

    // Actions
    refresh,
  };
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Simple hook to just get the current cosmic mining multiplier
 * Use this when you only need the multiplier value
 */
export function useCosmicMiningMultiplier(): {
  multiplier: number;
  status: "thriving" | "normal" | "struggling" | "critical";
  isLoading: boolean;
} {
  const { cosmicMultiplier, cosmicStatus } = useMiningStore();
  const { isLoading } = useCosmicState();

  return {
    multiplier: cosmicMultiplier,
    status: cosmicStatus,
    isLoading,
  };
}

/**
 * Hook to check if cosmic conditions are favorable for mining
 */
export function useCosmicMiningConditions(): {
  isFavorable: boolean;
  multiplier: number;
  status: "thriving" | "normal" | "struggling" | "critical";
  effects: string[];
  recommendations: string[];
} {
  const { cosmicMultiplier, cosmicStatus, activeCosmicEffects } =
    useMiningStore();

  const recommendations = useMemo(() => {
    const recs: string[] = [];

    if (cosmicStatus === "critical") {
      recs.push("Consider waiting for better cosmic conditions");
      recs.push("Your Baby is at a significant disadvantage right now");
    } else if (cosmicStatus === "struggling") {
      recs.push("Mining efficiency is reduced");
      recs.push("Check upcoming events for better timing");
    } else if (cosmicStatus === "thriving") {
      recs.push("Excellent time to mine!");
      recs.push("Your Baby is at peak performance");
    }

    return recs;
  }, [cosmicStatus]);

  return {
    isFavorable: cosmicMultiplier >= 1.0,
    multiplier: cosmicMultiplier,
    status: cosmicStatus,
    effects: activeCosmicEffects,
    recommendations,
  };
}

export default useMiningCosmic;
