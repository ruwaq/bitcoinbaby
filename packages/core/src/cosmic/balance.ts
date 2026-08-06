/**
 * Balance System
 * Ensures fair gameplay with caps, floors, and diminishing returns
 */

import type {
  BabyCosmicEnergy,
  BaseType,
  Bloodline,
  CosmicState,
  EnergyStatus,
  Heritage,
} from "./types";
import {
  BLOODLINE_CONFIGS,
  DAY_EFFECTS,
  HERITAGE_CONFIGS,
  MOON_PHASE_EFFECTS,
  NIGHT_EFFECTS,
  RARITY_MULTIPLIERS,
  SEASON_EFFECTS,
} from "./constants";
import type { Rarity } from "./constants";

// Re-export balance limits for use elsewhere
export { BALANCE_LIMITS } from "./types";

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply diminishing returns to a bonus
 * Formula: effective = 1 - e^(-raw * factor)
 * This makes high bonuses have less impact
 */
export function applyDiminishingReturns(rawBonus: number): number {
  if (rawBonus <= 0) {
    // Penalties apply fully (no diminishing)
    return Math.max(rawBonus, -0.5); // Floor of -50%
  }

  // Positive bonuses have diminishing returns
  const factor = 0.7;
  const effective = 1 - Math.exp(-rawBonus * factor);

  return Math.min(effective, 1.0); // Cap at +100%
}

// =============================================================================
// INDIVIDUAL BONUS CALCULATORS
// =============================================================================

/**
 * Get type bonus based on cosmic state
 */
export function getTypeBonus(
  baseType: BaseType,
  cosmicState: CosmicState,
): number {
  let bonus = 0;

  // Moon phase effect
  const moonEffect = MOON_PHASE_EFFECTS[cosmicState.moon.phase];
  bonus += moonEffect[baseType];

  // Day/night effect
  if (cosmicState.sun.isDay) {
    bonus += DAY_EFFECTS[baseType];
  } else {
    bonus += NIGHT_EFFECTS[baseType];
  }

  // Season effect
  const seasonEffect = SEASON_EFFECTS[cosmicState.season.current];
  bonus += seasonEffect[baseType];

  // Active event effect
  if (cosmicState.currentEvent) {
    bonus += cosmicState.currentEvent.multipliers[baseType];
  }

  return bonus;
}

/**
 * Get bloodline bonus (with trade-off)
 */
export function getBloodlineBonus(
  bloodline: Bloodline,
  context: "xp" | "mining" | "drops",
): number {
  const config = BLOODLINE_CONFIGS[bloodline];

  // Check if this context matches the bonus type
  if (
    (context === "xp" && config.bonusType === "xp") ||
    (context === "mining" && config.bonusType === "mining") ||
    (context === "drops" && config.bonusType === "drops_rare")
  ) {
    return config.bonus;
  }

  // Check if this context matches the trade-off type
  if (
    (context === "mining" && config.tradeoffType === "mining") ||
    (context === "xp" && config.tradeoffType === "xp")
  ) {
    return config.tradeoff; // Negative value
  }

  return 0;
}

/**
 * Get heritage bonus
 */
export function getHeritageBonus(
  heritage: Heritage,
  cosmicState: CosmicState,
): number {
  const config = HERITAGE_CONFIGS[heritage];
  let bonus = config.bonus;

  // Extra bonus during favorite event type
  if (
    cosmicState.currentEvent &&
    cosmicState.currentEvent.type === config.favoriteEvent
  ) {
    bonus += 0.05; // Extra +5% during favorite event
  }

  return bonus;
}

/**
 * Get level bonus (max +20%)
 */
export function getLevelBonus(level: number): number {
  return Math.min(level * 0.002, 0.2); // 0.2% per level, max 20%
}

/**
 * Get rarity bonus (max +15%)
 */
export function getRarityBonus(rarity: Rarity): number {
  return RARITY_MULTIPLIERS[rarity];
}

/**
 * Get catch-up bonus for new players
 */
export function getCatchUpBonus(
  playerLevel: number,
  serverAverageLevel: number,
): number {
  if (playerLevel >= serverAverageLevel) {
    return 0;
  }

  const levelsBehind = serverAverageLevel - playerLevel;
  return Math.min(levelsBehind * 0.05, 0.5); // +5% per level behind, max +50%
}

// =============================================================================
// MAIN ENERGY CALCULATOR
// =============================================================================

interface SparkStats {
  baseType: BaseType;
  bloodline: Bloodline;
  heritage: Heritage;
  level: number;
  rarity: Rarity;
  energy: number;
  equippedItemsBonus: number; // Pre-calculated item bonus
}

interface CalculateEnergyOptions {
  baby: SparkStats;
  cosmicState: CosmicState;
  serverAverageLevel?: number;
  context?: "xp" | "mining" | "drops";
}

/**
 * Calculate the final cosmic energy for a Baby
 * This is the main function that applies all balance rules
 */
export function calculateCosmicEnergy(
  options: CalculateEnergyOptions,
): BabyCosmicEnergy {
  const {
    baby,
    cosmicState,
    serverAverageLevel = 25,
    context = "mining",
  } = options;

  const caps = {
    type: 0.3,
    bloodline: 0.15,
    heritage: 0.05,
    cosmic: 0.4,
    items: 0.25,
    level: 0.2,
    rarity: 0.15,
  };

  // Calculate raw multipliers
  const rawMultipliers = {
    type: getTypeBonus(baby.baseType, cosmicState),
    bloodline: getBloodlineBonus(baby.bloodline, context),
    heritage: getHeritageBonus(baby.heritage, cosmicState),
    cosmic: cosmicState.currentEvent?.multipliers[baby.baseType] || 0,
    items: baby.equippedItemsBonus,
    level: getLevelBonus(baby.level),
    rarity: getRarityBonus(baby.rarity),
  };

  // Apply caps to each category
  const cappedMultipliers = {
    type: clamp(rawMultipliers.type, -caps.type, caps.type),
    bloodline: clamp(rawMultipliers.bloodline, -caps.bloodline, caps.bloodline),
    heritage: clamp(rawMultipliers.heritage, 0, caps.heritage),
    cosmic: clamp(rawMultipliers.cosmic, -caps.cosmic, caps.cosmic),
    items: clamp(rawMultipliers.items, 0, caps.items),
    level: clamp(rawMultipliers.level, 0, caps.level),
    rarity: clamp(rawMultipliers.rarity, 0, caps.rarity),
  };

  // Sum all capped multipliers
  const rawTotalBonus =
    cappedMultipliers.type +
    cappedMultipliers.bloodline +
    cappedMultipliers.heritage +
    cappedMultipliers.cosmic +
    cappedMultipliers.items +
    cappedMultipliers.level +
    cappedMultipliers.rarity;

  // Apply diminishing returns
  const effectiveBonus = applyDiminishingReturns(rawTotalBonus);

  // Calculate final multiplier with global floor and cap
  const baseMultiplier = clamp(1 + effectiveBonus, 0.5, 2.0);

  // Apply catch-up bonus for new players
  const catchUpBonus = getCatchUpBonus(baby.level, serverAverageLevel);
  const finalMultiplier = baseMultiplier * (1 + catchUpBonus);

  // Calculate effective energy
  const effectiveEnergy = Math.max(0, baby.energy * finalMultiplier);

  // Determine status
  let status: EnergyStatus;
  if (effectiveBonus >= 0.3) {
    status = "thriving";
  } else if (effectiveBonus >= 0) {
    status = "normal";
  } else if (effectiveBonus >= -0.2) {
    status = "struggling";
  } else {
    status = "critical";
  }

  // Generate active effects list
  const activeEffects: string[] = [];
  const warnings: string[] = [];

  if (cappedMultipliers.type > 0) {
    activeEffects.push(
      `Tipo favorable: +${(cappedMultipliers.type * 100).toFixed(0)}%`,
    );
  } else if (cappedMultipliers.type < 0) {
    activeEffects.push(
      `Tipo desfavorable: ${(cappedMultipliers.type * 100).toFixed(0)}%`,
    );
  }

  if (cosmicState.currentEvent) {
    const eventBonus = cappedMultipliers.cosmic;
    if (eventBonus > 0) {
      activeEffects.push(
        `${cosmicState.currentEvent.name}: +${(eventBonus * 100).toFixed(0)}%`,
      );
    } else if (eventBonus < 0) {
      activeEffects.push(
        `${cosmicState.currentEvent.name}: ${(eventBonus * 100).toFixed(0)}%`,
      );
      if (eventBonus < -0.2) {
        warnings.push(
          `⚠️ ${cosmicState.currentEvent.name} afecta negativamente a tu Baby`,
        );
      }
    }
  }

  if (cappedMultipliers.bloodline !== 0) {
    const sign = cappedMultipliers.bloodline > 0 ? "+" : "";
    activeEffects.push(
      `Bloodline: ${sign}${(cappedMultipliers.bloodline * 100).toFixed(0)}%`,
    );
  }

  if (catchUpBonus > 0) {
    activeEffects.push(`Catch-up: +${(catchUpBonus * 100).toFixed(0)}%`);
  }

  if (status === "critical") {
    warnings.push("🚨 Tu Baby necesita cuidado urgente!");
  }

  return {
    baseEnergy: baby.energy,
    rawMultipliers,
    cappedMultipliers,
    rawTotalBonus,
    effectiveBonus,
    finalMultiplier,
    effectiveEnergy,
    status,
    activeEffects,
    warnings,
    catchUpBonus,
  };
}

// =============================================================================
// COMMUNITY TAX (for top players)
// =============================================================================

/**
 * Calculate community tax for top players
 * This redistributes some rewards from whales to the community
 */
export function calculateCommunityTax(
  earnings: number,
  playerRank: number,
  totalPlayers: number,
): number {
  if (totalPlayers === 0) return 0;

  const percentile = playerRank / totalPlayers;

  // Only top 10% pay tax
  if (percentile > 0.1) return 0;

  // Top 1%: 15% tax
  if (percentile <= 0.01) return earnings * 0.15;

  // Top 5%: 10% tax
  if (percentile <= 0.05) return earnings * 0.1;

  // Top 10%: 5% tax
  return earnings * 0.05;
}

/**
 * Calculate final rewards after all bonuses and taxes
 */
export function calculateFinalRewards(
  baseReward: number,
  cosmicEnergy: BabyCosmicEnergy,
  playerRank: number,
  totalPlayers: number,
): {
  gross: number;
  tax: number;
  net: number;
  multiplier: number;
} {
  const gross = baseReward * cosmicEnergy.finalMultiplier;
  const tax = calculateCommunityTax(gross, playerRank, totalPlayers);
  const net = gross - tax;

  return {
    gross,
    tax,
    net,
    multiplier: cosmicEnergy.finalMultiplier,
  };
}
