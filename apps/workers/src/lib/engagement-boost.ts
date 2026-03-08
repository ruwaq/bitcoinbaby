/**
 * Engagement Boost Calculation (Server-side)
 *
 * Tracks user engagement and calculates mining bonus based on:
 * - Baby health score (how well they care for their baby)
 * - Daily login streak
 * - Play time today
 *
 * Maximum bonus: +3%
 */

import type { Redis } from "@upstash/redis/cloudflare";
import { Logger } from "./logger";

const engagementLogger = new Logger("EngagementBoost");

// =============================================================================
// CONSTANTS (must match client-side)
// =============================================================================

/** Maximum engagement bonus percentage */
const MAX_ENGAGEMENT_BONUS = 3;

/** Baby care bonus thresholds */
const BABY_CARE_THRESHOLDS = {
  excellent: { minHealth: 80, bonus: 1.5 }, // +1.5%
  good: { minHealth: 60, bonus: 1.0 }, // +1.0%
  average: { minHealth: 40, bonus: 0.5 }, // +0.5%
  poor: { minHealth: 0, bonus: 0 }, // +0%
};

/** Daily streak bonus (max +1%) */
const DAILY_STREAK_MAX_BONUS = 1;
const DAILY_STREAK_FULL_DAYS = 7; // 7 days to reach max

/** Play time bonus (max +0.5%) */
const PLAY_TIME_MAX_BONUS = 0.5;
const PLAY_TIME_FULL_MINUTES = 30; // 30 minutes for max bonus

// =============================================================================
// TYPES
// =============================================================================

export interface EngagementState {
  /** Baby health score (0-100) */
  babyHealthScore: number;
  /** Consecutive days logged in */
  dailyStreak: number;
  /** Minutes played today */
  playTimeToday: number;
  /** Last activity timestamp */
  lastActivityAt: number;
  /** Last daily check timestamp */
  lastDailyCheckAt: number;
}

export interface EngagementBoostData {
  /** Total boost percentage (0-3) */
  totalBoostPercent: number;
  /** Breakdown of bonuses */
  breakdown: {
    babyCare: number;
    dailyStreak: number;
    playTime: number;
  };
  /** Current engagement state */
  state: EngagementState;
}

// =============================================================================
// REDIS KEYS
// =============================================================================

function getEngagementKey(address: string): string {
  return `engagement:${address}`;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Get default engagement state for new users
 */
function getDefaultState(): EngagementState {
  return {
    babyHealthScore: 50, // Start at average
    dailyStreak: 0,
    playTimeToday: 0,
    lastActivityAt: 0,
    lastDailyCheckAt: 0,
  };
}

/**
 * Calculate baby care bonus based on health score
 */
function calculateBabyCareBonus(healthScore: number): number {
  if (healthScore >= BABY_CARE_THRESHOLDS.excellent.minHealth) {
    return BABY_CARE_THRESHOLDS.excellent.bonus;
  }
  if (healthScore >= BABY_CARE_THRESHOLDS.good.minHealth) {
    return BABY_CARE_THRESHOLDS.good.bonus;
  }
  if (healthScore >= BABY_CARE_THRESHOLDS.average.minHealth) {
    return BABY_CARE_THRESHOLDS.average.bonus;
  }
  return BABY_CARE_THRESHOLDS.poor.bonus;
}

/**
 * Calculate daily streak bonus
 */
function calculateDailyStreakBonus(streakDays: number): number {
  if (streakDays <= 0) return 0;
  const ratio = Math.min(streakDays / DAILY_STREAK_FULL_DAYS, 1);
  return ratio * DAILY_STREAK_MAX_BONUS;
}

/**
 * Calculate play time bonus
 */
function calculatePlayTimeBonus(minutes: number): number {
  if (minutes <= 0) return 0;
  const ratio = Math.min(minutes / PLAY_TIME_FULL_MINUTES, 1);
  return ratio * PLAY_TIME_MAX_BONUS;
}

/**
 * Get engagement state from Redis
 */
export async function getEngagementState(
  redis: Redis,
  address: string,
): Promise<EngagementState> {
  try {
    const key = getEngagementKey(address);
    const data = await redis.hgetall(key);

    if (!data || Object.keys(data).length === 0) {
      return getDefaultState();
    }

    return {
      babyHealthScore: parseInt(data.babyHealthScore as string, 10) || 50,
      dailyStreak: parseInt(data.dailyStreak as string, 10) || 0,
      playTimeToday: parseInt(data.playTimeToday as string, 10) || 0,
      lastActivityAt: parseInt(data.lastActivityAt as string, 10) || 0,
      lastDailyCheckAt: parseInt(data.lastDailyCheckAt as string, 10) || 0,
    };
  } catch (error) {
    engagementLogger.error("Failed to get engagement state", error);
    return getDefaultState();
  }
}

/**
 * Update engagement state in Redis
 */
export async function updateEngagementState(
  redis: Redis,
  address: string,
  updates: Partial<EngagementState>,
): Promise<void> {
  try {
    const key = getEngagementKey(address);
    const now = Date.now();

    // Get current state
    const current = await getEngagementState(redis, address);

    // Check if it's a new day (reset play time)
    const lastCheck = new Date(current.lastDailyCheckAt);
    const today = new Date(now);
    const isNewDay =
      lastCheck.toDateString() !== today.toDateString() &&
      current.lastDailyCheckAt > 0;

    // Build update object
    const updateData: Record<string, string> = {
      lastActivityAt: now.toString(),
    };

    if (updates.babyHealthScore !== undefined) {
      updateData.babyHealthScore = Math.max(
        0,
        Math.min(100, updates.babyHealthScore),
      ).toString();
    }

    if (updates.dailyStreak !== undefined) {
      updateData.dailyStreak = Math.max(0, updates.dailyStreak).toString();
    }

    if (updates.playTimeToday !== undefined) {
      // Reset if new day
      const baseTime = isNewDay ? 0 : current.playTimeToday;
      updateData.playTimeToday = (baseTime + updates.playTimeToday).toString();
    }

    // Update daily check timestamp
    if (isNewDay || current.lastDailyCheckAt === 0) {
      updateData.lastDailyCheckAt = now.toString();

      // If it's been more than 48 hours, reset streak
      const hoursSinceLastCheck =
        (now - current.lastDailyCheckAt) / (1000 * 60 * 60);
      if (hoursSinceLastCheck > 48 && current.lastDailyCheckAt > 0) {
        updateData.dailyStreak = "0";
      }
    }

    await redis.hset(key, updateData);

    engagementLogger.debug("Updated engagement state", {
      address: address.slice(0, 10),
      updates: Object.keys(updates),
    });
  } catch (error) {
    engagementLogger.error("Failed to update engagement state", error);
  }
}

/**
 * Record daily login (called when user opens app)
 */
export async function recordDailyLogin(
  redis: Redis,
  address: string,
): Promise<{ streakUpdated: boolean; newStreak: number }> {
  try {
    const key = getEngagementKey(address);
    const current = await getEngagementState(redis, address);
    const now = Date.now();

    // Check if this is a new day
    const lastCheck = new Date(current.lastDailyCheckAt);
    const today = new Date(now);
    const isNewDay =
      lastCheck.toDateString() !== today.toDateString() ||
      current.lastDailyCheckAt === 0;

    if (!isNewDay) {
      return { streakUpdated: false, newStreak: current.dailyStreak };
    }

    // Check if streak should continue or reset
    const hoursSinceLastCheck =
      (now - current.lastDailyCheckAt) / (1000 * 60 * 60);
    let newStreak: number;

    if (hoursSinceLastCheck > 48 && current.lastDailyCheckAt > 0) {
      // More than 2 days - reset streak
      newStreak = 1;
    } else {
      // Continue streak
      newStreak = current.dailyStreak + 1;
    }

    await redis.hset(key, {
      dailyStreak: newStreak.toString(),
      lastDailyCheckAt: now.toString(),
      lastActivityAt: now.toString(),
      // Reset play time for new day
      playTimeToday: "0",
    });

    engagementLogger.info("Daily login recorded", {
      address: address.slice(0, 10),
      newStreak,
      wasReset: hoursSinceLastCheck > 48,
    });

    return { streakUpdated: true, newStreak };
  } catch (error) {
    engagementLogger.error("Failed to record daily login", error);
    return { streakUpdated: false, newStreak: 0 };
  }
}

/**
 * Calculate engagement boost from state
 */
export function calculateEngagementBoost(
  state: EngagementState,
): EngagementBoostData {
  const babyCare = calculateBabyCareBonus(state.babyHealthScore);
  const dailyStreak = calculateDailyStreakBonus(state.dailyStreak);
  const playTime = calculatePlayTimeBonus(state.playTimeToday);

  const totalBoost = Math.min(
    babyCare + dailyStreak + playTime,
    MAX_ENGAGEMENT_BONUS,
  );

  return {
    totalBoostPercent: totalBoost,
    breakdown: {
      babyCare,
      dailyStreak,
      playTime,
    },
    state,
  };
}

/**
 * Get engagement boost data for reward calculation
 */
export async function getEngagementBoostData(
  redis: Redis,
  address: string,
): Promise<EngagementBoostData> {
  const state = await getEngagementState(redis, address);
  return calculateEngagementBoost(state);
}

/**
 * Get engagement multiplier from boost percentage
 */
export function getEngagementMultiplier(boostPercent: number): number {
  return 1 + boostPercent / 100;
}
