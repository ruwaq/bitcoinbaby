/**
 * Engagement Mining System
 *
 * Philosophy:
 * ===========
 * Small bonuses for active engagement. Main rewards come from:
 * 1. Natural hashrate (flat 100 tokens/share)
 * 2. NFT collection (stacking with diminishing returns)
 * 3. Streak bonuses (server-side, up to 2x)
 *
 * Engagement provides a SMALL extra bonus (max 3%):
 * 1. Baby Care (1.5% bonus) - Keep your baby healthy
 * 2. Daily Streak (1% bonus) - Login every day
 * 3. Play Time (0.5% bonus) - Spend time in app
 *
 * Maximum engagement multiplier: 1.03x (3% bonus)
 * This is intentionally low - the main incentives are:
 * - Mining more shares (natural hashrate)
 * - Collecting NFTs (stacking system)
 * - Maintaining streaks (server-side bonus)
 */

// =============================================================================
// ENGAGEMENT CONFIGURATION
// =============================================================================

export interface EngagementConfig {
  /** Bonus for keeping baby healthy (stats > 50) */
  babyCareBonus: number;
  /** Bonus for consecutive daily logins */
  dailyStreakBonus: number;
  /** Bonus for active play time */
  playTimeBonus: number;
  /** Maximum total engagement multiplier */
  maxMultiplier: number;
}

export const DEFAULT_ENGAGEMENT_CONFIG: EngagementConfig = {
  babyCareBonus: 0.015, // +1.5%
  dailyStreakBonus: 0.01, // +1%
  playTimeBonus: 0.005, // +0.5%
  maxMultiplier: 1.03, // Cap at 1.03x (3% max)
};

// =============================================================================
// ENGAGEMENT STATE
// =============================================================================

export interface EngagementState {
  /** Timestamp of last interaction (milliseconds) */
  lastInteraction: number;
  /** Consecutive days logged in */
  dailyStreak: number;
  /** Last day logged in (YYYY-MM-DD) */
  lastLoginDay: string;
  /** Minutes played today */
  playTimeToday: number;
  /** Baby health score (0-100) */
  babyHealthScore: number;
  /** Total achievements unlocked */
  achievementsUnlocked: number;
}

export function createInitialEngagementState(): EngagementState {
  return {
    lastInteraction: Date.now(),
    dailyStreak: 0,
    lastLoginDay: "",
    playTimeToday: 0,
    babyHealthScore: 50,
    achievementsUnlocked: 0,
  };
}

// =============================================================================
// BABY CARE BONUS
// =============================================================================

/**
 * Calculate baby care bonus based on baby's health stats.
 *
 * Baby stats: Energy, Happiness, Hunger, Health (0-100 each)
 * Average >= 70: Full bonus (50%)
 * Average >= 50: Partial bonus (25%)
 * Average < 50: No bonus
 *
 * This encourages players to care for their baby, not just mine.
 */
/** Baby stats for engagement calculation (mirrors GameBaby stats) */
export interface EngagementBabyStats {
  energy: number;
  happiness: number;
  hunger: number;
  health: number;
}

export function calculateBabyCareBonus(
  stats: EngagementBabyStats | null,
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
): number {
  if (!stats) return 0;

  const average =
    (stats.energy + stats.happiness + stats.hunger + stats.health) / 4;

  if (average >= 70) {
    return config.babyCareBonus; // Full bonus: 50%
  } else if (average >= 50) {
    return config.babyCareBonus * 0.5; // Partial bonus: 25%
  }
  return 0; // No bonus for unhealthy baby
}

// =============================================================================
// DAILY STREAK BONUS
// =============================================================================

/**
 * Daily streak rewards consecutive daily logins.
 *
 * Streak 1-6: Building up (5% per day)
 * Streak 7+: Full bonus (30%)
 *
 * Streak resets if player misses a day.
 * This encourages daily engagement (Duolingo/Pi Network model).
 */
export function calculateDailyStreakBonus(
  streak: number,
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
): number {
  if (streak <= 0) return 0;
  if (streak >= 7) return config.dailyStreakBonus; // Full 30%

  // Linear ramp up: 5% per day until day 7
  return (streak / 7) * config.dailyStreakBonus;
}

/**
 * Update daily streak based on login.
 * Returns new streak count.
 */
export function updateDailyStreak(
  lastLoginDay: string,
  currentDay: string,
  currentStreak: number,
): number {
  if (!lastLoginDay) return 1; // First login

  const lastDate = new Date(lastLoginDay);
  const currentDate = new Date(currentDay);

  // Calculate day difference
  const diffTime = currentDate.getTime() - lastDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day, no change
    return currentStreak;
  } else if (diffDays === 1) {
    // Next day, increment streak
    return currentStreak + 1;
  } else {
    // Missed a day, reset streak
    return 1;
  }
}

// =============================================================================
// PLAY TIME BONUS
// =============================================================================

/**
 * Play time bonus rewards active time in the app.
 *
 * 0-10 minutes: 0%
 * 10-30 minutes: Linear ramp (0% → 20%)
 * 30+ minutes: Full bonus (20%)
 *
 * Resets daily. This encourages spending time with the baby,
 * not just starting mining and leaving.
 */
export function calculatePlayTimeBonus(
  minutesToday: number,
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
): number {
  if (minutesToday < 10) return 0;
  if (minutesToday >= 30) return config.playTimeBonus; // Full 20%

  // Linear ramp from 10 to 30 minutes
  const progress = (minutesToday - 10) / 20;
  return progress * config.playTimeBonus;
}

// =============================================================================
// TOTAL ENGAGEMENT MULTIPLIER
// =============================================================================

export interface EngagementMultiplierResult {
  /** Total multiplier (1.0 = base, 2.0 = double) */
  multiplier: number;
  /** Individual bonuses for display */
  breakdown: {
    babyCare: number;
    dailyStreak: number;
    playTime: number;
  };
  /** Human-readable status */
  status: "inactive" | "casual" | "engaged" | "dedicated";
}

/**
 * Calculate total engagement multiplier.
 *
 * @param state - Current engagement state
 * @param babyStats - Baby's current stats
 * @param config - Configuration (optional)
 * @returns Engagement multiplier and breakdown
 */
export function calculateEngagementMultiplier(
  state: EngagementState,
  babyStats: EngagementBabyStats | null,
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
): EngagementMultiplierResult {
  const babyCare = calculateBabyCareBonus(babyStats, config);
  const dailyStreak = calculateDailyStreakBonus(state.dailyStreak, config);
  const playTime = calculatePlayTimeBonus(state.playTimeToday, config);

  const totalBonus = babyCare + dailyStreak + playTime;
  const multiplier = Math.min(1 + totalBonus, config.maxMultiplier);

  // Determine status based on multiplier (adjusted for 3% max)
  let status: EngagementMultiplierResult["status"];
  if (multiplier < 1.005) {
    status = "inactive";
  } else if (multiplier < 1.015) {
    status = "casual";
  } else if (multiplier < 1.025) {
    status = "engaged";
  } else {
    status = "dedicated";
  }

  return {
    multiplier,
    breakdown: {
      babyCare,
      dailyStreak,
      playTime,
    },
    status,
  };
}

// =============================================================================
// REWARD CALCULATION WITH ENGAGEMENT
// =============================================================================

import { calculateShareReward, BASE_REWARD_PER_SHARE } from "./constants";

/**
 * Calculate final reward including engagement bonuses.
 *
 * Formula: baseReward * engagementMultiplier
 *
 * Example scenarios:
 * - GPU miner (D32), no engagement:
 *   258 (base) * 1.0 = 258 $BABY
 *
 * - Phone user (D22), full engagement:
 *   100 (base) * 2.0 = 200 $BABY
 *
 * - Laptop user (D26), partial engagement:
 *   200 (base) * 1.5 = 300 $BABY
 */
export function calculateRewardWithEngagement(
  difficulty: number,
  engagementState: EngagementState,
  babyStats: EngagementBabyStats | null,
  config: EngagementConfig = DEFAULT_ENGAGEMENT_CONFIG,
): {
  baseReward: bigint;
  finalReward: bigint;
  engagement: EngagementMultiplierResult;
} {
  const baseReward = calculateShareReward(difficulty);
  const engagement = calculateEngagementMultiplier(
    engagementState,
    babyStats,
    config,
  );
  const finalReward = BigInt(
    Math.floor(Number(baseReward) * engagement.multiplier),
  );

  return {
    baseReward,
    finalReward,
    engagement,
  };
}

// =============================================================================
// ENGAGEMENT TIER THRESHOLDS
// =============================================================================

export const ENGAGEMENT_TIERS = {
  inactive: {
    minMultiplier: 1.0,
    maxMultiplier: 1.005,
    label: "Inactive",
    description: "Login and care for your baby to earn bonuses!",
    color: "gray",
  },
  casual: {
    minMultiplier: 1.005,
    maxMultiplier: 1.015,
    label: "Casual",
    description: "Good start! Keep playing for more bonuses.",
    color: "blue",
  },
  engaged: {
    minMultiplier: 1.015,
    maxMultiplier: 1.025,
    label: "Engaged",
    description: "Great engagement! Almost at max bonus.",
    color: "green",
  },
  dedicated: {
    minMultiplier: 1.025,
    maxMultiplier: 1.03,
    label: "Dedicated",
    description: "Maximum engagement bonus active! (+3%)",
    color: "gold",
  },
} as const;

// =============================================================================
// SERIALIZATION (for storage)
// =============================================================================

export function serializeEngagementState(state: EngagementState): string {
  return JSON.stringify({
    li: state.lastInteraction,
    ds: state.dailyStreak,
    ld: state.lastLoginDay,
    pt: state.playTimeToday,
    bh: state.babyHealthScore,
    au: state.achievementsUnlocked,
  });
}

export function deserializeEngagementState(
  json: string | null,
): EngagementState {
  if (!json) return createInitialEngagementState();

  try {
    const data = JSON.parse(json);
    return {
      lastInteraction: data.li ?? Date.now(),
      dailyStreak: data.ds ?? 0,
      lastLoginDay: data.ld ?? "",
      playTimeToday: data.pt ?? 0,
      babyHealthScore: data.bh ?? 50,
      achievementsUnlocked: data.au ?? 0,
    };
  } catch {
    return createInitialEngagementState();
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export type EngagementTier = keyof typeof ENGAGEMENT_TIERS;
