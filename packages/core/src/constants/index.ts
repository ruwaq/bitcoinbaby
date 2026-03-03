/**
 * Core Constants
 *
 * Centralized configuration values used throughout the application.
 * Change values here to affect the entire codebase.
 */

// Re-export all constants
export * from "./retry-config";
export * from "./polling";
export * from "./app-ids";

// Re-export tokenomics constants (already centralized)
export {
  MIN_DIFFICULTY,
  BASE_REWARD_PER_SHARE,
  calculateShareReward,
  calculateRewardWithStreak,
  getStreakMultiplier,
  STREAK_BONUSES,
} from "../tokenomics/constants";
