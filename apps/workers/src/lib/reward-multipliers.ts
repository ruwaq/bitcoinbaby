/**
 * Modular Reward Multiplier System
 *
 * ARCHITECTURE:
 * =============
 * Final Reward = Base × Streak × NFT × Engagement
 *
 * Each multiplier is a separate module that can be:
 * - Enabled/disabled independently
 * - Implemented server-side when ready
 * - A/B tested
 *
 * CURRENT STATUS:
 * ===============
 * ✅ Base Reward: 100 tokens/share (ACTIVE)
 * ✅ Streak Bonus: 1.0x - 2.0x (ACTIVE, server-validated)
 * ⏳ NFT Boost: DISABLED (returns 1.0x) - Requires blockchain validation
 * ⏳ Engagement: DISABLED (returns 1.0x) - Requires server-side state
 *
 * ROADMAP:
 * ========
 * Phase 1 (NOW): Base + Streak only
 * Phase 2: Add NFT boost (requires Charms API integration)
 * Phase 3: Add Engagement (requires server-side state tracking)
 */

import { Logger } from "./logger";
const rewardLogger = new Logger("RewardMultipliers");

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface MultiplierConfig {
  /** Enable/disable each multiplier system */
  enabled: {
    streak: boolean;
    nft: boolean;
    engagement: boolean;
    cosmic: boolean;
  };
  /** Maximum total multiplier (safety cap) */
  maxTotalMultiplier: number;
}

/**
 * Current production configuration
 * NFT, Engagement, and Cosmic disabled until server-side implementation
 */
export const MULTIPLIER_CONFIG: MultiplierConfig = {
  enabled: {
    streak: true, // ✅ Works server-side
    nft: true, // ✅ Works server-side - queries Redis for NFT ownership
    engagement: true, // ✅ Works server-side - tracks daily login, play time, baby care
    cosmic: true, // ✅ Works server-side - pure math moon/season calculations
  },
  maxTotalMultiplier: 2.5, // Safety cap
};

// =============================================================================
// MULTIPLIER INTERFACES (for future implementation)
// =============================================================================

/**
 * NFT Boost Data (for future server-side validation)
 * Will be populated by querying Charms API
 */
export interface NFTBoostData {
  /** NFT token IDs owned by miner */
  tokenIds: number[];
  /** Pre-calculated stacked boost (validated server-side) */
  stackedBoostPercent: number;
}

/**
 * Engagement Data (for future server-side tracking)
 * Will be stored in Durable Object state
 */
export interface EngagementData {
  /** Baby health average (0-100) */
  babyHealthScore: number;
  /** Consecutive login days */
  dailyStreak: number;
  /** Minutes played today */
  playTimeToday: number;
}

/**
 * Cosmic Data (for future server-side calculation)
 * Will be calculated based on astronomical events
 */
export interface CosmicData {
  /** Baby type (human, animal, robot, mystic, alien) */
  babyType: string;
  /** Current moon phase bonus */
  moonBonus: number;
  /** Current season bonus */
  seasonBonus: number;
  /** Active event bonus (eclipse, meteor shower, etc.) */
  eventBonus: number;
  /** Total cosmic bonus percentage */
  totalBonus: number;
}

// =============================================================================
// MULTIPLIER CALCULATIONS
// =============================================================================

/**
 * Calculate NFT boost multiplier
 *
 * CURRENTLY DISABLED - Returns 1.0x
 * When enabled, will validate NFT ownership via Charms API
 *
 * @param data - NFT boost data (optional, unused when disabled)
 * @returns Multiplier (1.0 when disabled)
 */
export function calculateNFTMultiplier(data?: NFTBoostData): number {
  if (!MULTIPLIER_CONFIG.enabled.nft) {
    return 1.0; // Disabled
  }

  if (!data || data.stackedBoostPercent <= 0) {
    return 1.0;
  }

  // Convert percentage to multiplier (e.g., 15% -> 1.15x)
  const multiplier = 1 + data.stackedBoostPercent / 100;

  rewardLogger.debug(`NFT multiplier: ${multiplier.toFixed(3)}x`);
  return multiplier;
}

/**
 * Calculate engagement multiplier
 *
 * CURRENTLY DISABLED - Returns 1.0x
 * When enabled, will use server-tracked engagement state
 *
 * @param data - Engagement data (optional, unused when disabled)
 * @returns Multiplier (1.0 when disabled)
 */
export function calculateEngagementMultiplier(data?: EngagementData): number {
  if (!MULTIPLIER_CONFIG.enabled.engagement) {
    return 1.0; // Disabled
  }

  if (!data) {
    return 1.0;
  }

  let bonus = 0;

  // Baby care bonus (max 1.5%)
  if (data.babyHealthScore >= 70) {
    bonus += 0.015;
  } else if (data.babyHealthScore >= 50) {
    bonus += 0.0075;
  }

  // Daily streak bonus (max 1%)
  if (data.dailyStreak >= 7) {
    bonus += 0.01;
  } else if (data.dailyStreak > 0) {
    bonus += (data.dailyStreak / 7) * 0.01;
  }

  // Play time bonus (max 0.5%)
  if (data.playTimeToday >= 30) {
    bonus += 0.005;
  } else if (data.playTimeToday >= 10) {
    bonus += ((data.playTimeToday - 10) / 20) * 0.005;
  }

  const multiplier = 1 + Math.min(bonus, 0.03); // Cap at 3%

  rewardLogger.debug(`Engagement multiplier: ${multiplier.toFixed(3)}x`);
  return multiplier;
}

/**
 * Calculate cosmic multiplier
 *
 * CURRENTLY DISABLED - Returns 1.0x
 * When enabled, will calculate based on astronomical events
 *
 * @param data - Cosmic data (optional, unused when disabled)
 * @returns Multiplier (1.0 when disabled)
 */
export function calculateCosmicMultiplier(data?: CosmicData): number {
  if (!MULTIPLIER_CONFIG.enabled.cosmic) {
    return 1.0; // Disabled
  }

  if (!data || data.totalBonus === 0) {
    return 1.0;
  }

  // Cosmic bonuses are small: max ±10%
  // Range: 0.95x to 1.10x
  const multiplier = Math.max(0.95, Math.min(1.1, 1 + data.totalBonus));

  rewardLogger.debug(`Cosmic multiplier: ${multiplier.toFixed(3)}x`);
  return multiplier;
}

// =============================================================================
// COMBINED REWARD CALCULATION
// =============================================================================

export interface RewardCalculationInput {
  /** Base reward (flat 100 tokens) */
  baseReward: bigint;
  /** Streak multiplier (server-calculated) */
  streakMultiplier: number;
  /** NFT data (optional, for future use) */
  nftData?: NFTBoostData;
  /** Engagement data (optional, for future use) */
  engagementData?: EngagementData;
  /** Cosmic data (optional, for future use) */
  cosmicData?: CosmicData;
}

export interface RewardCalculationResult {
  /** Final reward after all multipliers */
  finalReward: bigint;
  /** Breakdown of each multiplier */
  breakdown: {
    base: bigint;
    streak: number;
    nft: number;
    engagement: number;
    cosmic: number;
    total: number;
  };
  /** Which multipliers were active */
  activeMultipliers: string[];
}

/**
 * Calculate final reward with all applicable multipliers
 *
 * Formula: base × streak × nft × engagement × cosmic
 * With safety cap at maxTotalMultiplier
 */
export function calculateFinalReward(
  input: RewardCalculationInput,
): RewardCalculationResult {
  const { baseReward, streakMultiplier, nftData, engagementData, cosmicData } =
    input;

  // Calculate each multiplier
  const streak = MULTIPLIER_CONFIG.enabled.streak ? streakMultiplier : 1.0;
  const nft = calculateNFTMultiplier(nftData);
  const engagement = calculateEngagementMultiplier(engagementData);
  const cosmic = calculateCosmicMultiplier(cosmicData);

  // Combined multiplier with safety cap
  const totalMultiplier = Math.min(
    streak * nft * engagement * cosmic,
    MULTIPLIER_CONFIG.maxTotalMultiplier,
  );

  // Calculate final reward
  const finalReward = BigInt(Math.floor(Number(baseReward) * totalMultiplier));

  // Track which multipliers are active
  const activeMultipliers: string[] = ["base"];
  if (MULTIPLIER_CONFIG.enabled.streak && streak > 1.0) {
    activeMultipliers.push("streak");
  }
  if (MULTIPLIER_CONFIG.enabled.nft && nft > 1.0) {
    activeMultipliers.push("nft");
  }
  if (MULTIPLIER_CONFIG.enabled.engagement && engagement > 1.0) {
    activeMultipliers.push("engagement");
  }
  if (MULTIPLIER_CONFIG.enabled.cosmic && cosmic !== 1.0) {
    activeMultipliers.push("cosmic");
  }

  return {
    finalReward,
    breakdown: {
      base: baseReward,
      streak,
      nft,
      engagement,
      cosmic,
      total: totalMultiplier,
    },
    activeMultipliers,
  };
}

// =============================================================================
// FEATURE FLAGS (for gradual rollout)
// =============================================================================

/**
 * Check if a multiplier feature is enabled
 */
export function isMultiplierEnabled(
  feature: keyof MultiplierConfig["enabled"],
): boolean {
  return MULTIPLIER_CONFIG.enabled[feature];
}

/**
 * Get human-readable status of all multipliers
 */
export function getMultiplierStatus(): Record<string, string> {
  return {
    streak: MULTIPLIER_CONFIG.enabled.streak ? "ACTIVE" : "DISABLED",
    nft: MULTIPLIER_CONFIG.enabled.nft ? "ACTIVE" : "COMING_SOON",
    engagement: MULTIPLIER_CONFIG.enabled.engagement ? "ACTIVE" : "COMING_SOON",
    cosmic: MULTIPLIER_CONFIG.enabled.cosmic ? "ACTIVE" : "COMING_SOON",
  };
}
