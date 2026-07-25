/**
 * Boost Configuration
 *
 * Centralized configuration for all mining boost calculations.
 * These values must stay in sync with any client-side calculations.
 */

// =============================================================================
// COSMIC BOOST CONSTANTS
// =============================================================================

/**
 * Moon phase effects by baby type (in percentage points)
 */
export const MOON_PHASE_EFFECTS: Record<string, Record<string, number>> = {
  new: { mystic: 3, alien: 1, human: 0, animal: -1, robot: 0 },
  waxing_crescent: { mystic: 2, alien: 1, human: 0.5, animal: 0, robot: 0 },
  first_quarter: { mystic: 1, alien: 0.5, human: 1, animal: 1, robot: 0 },
  waxing_gibbous: { mystic: 0.5, alien: 0, human: 1, animal: 2, robot: 0.5 },
  full: { mystic: 3, alien: 2, human: 1, animal: 3, robot: -1 },
  waning_gibbous: { mystic: 1, alien: 1, human: 0.5, animal: 2, robot: 0 },
  last_quarter: { mystic: 0.5, alien: 0.5, human: 0, animal: 1, robot: 0.5 },
  waning_crescent: { mystic: 2, alien: 1, human: -0.5, animal: 0, robot: 1 },
};

/**
 * Season effects by baby type (in percentage points)
 */
export const SEASON_EFFECTS: Record<string, Record<string, number>> = {
  spring: { animal: 2, human: 1, mystic: 0.5, robot: 0, alien: -0.5 },
  summer: { human: 2, animal: 1, mystic: 0, robot: -1, alien: -1.5 },
  autumn: { mystic: 1.5, human: 0.5, animal: 0, robot: 1, alien: 0.5 },
  winter: { robot: 2, alien: 1, mystic: 0, human: -0.5, animal: -1 },
};

/**
 * Special cosmic event effects
 */
export const COSMIC_EVENT_EFFECTS: Record<string, Record<string, number>> = {
  solstice: { mystic: 2, human: 1, animal: 1, robot: 0, alien: 0 },
  equinox: { human: 2, alien: 1, mystic: 1, animal: 0, robot: 0 },
};

/**
 * Cosmic boost limits
 */
export const COSMIC_LIMITS = {
  /** Maximum cosmic bonus (+10%) */
  MAX_BONUS: 10,
  /** Maximum cosmic penalty (-5%) */
  MAX_PENALTY: 5,
} as const;

// =============================================================================
// ENGAGEMENT BOOST CONSTANTS
// =============================================================================

/**
 * Maximum engagement bonus percentage
 */
export const MAX_ENGAGEMENT_BONUS = 3;

/**
 * Baby care bonus thresholds
 */
export const BABY_CARE_THRESHOLDS = {
  excellent: { minHealth: 80, bonus: 1.5 }, // +1.5%
  good: { minHealth: 60, bonus: 1.0 }, // +1.0%
  average: { minHealth: 40, bonus: 0.5 }, // +0.5%
  poor: { minHealth: 0, bonus: 0 }, // +0%
} as const;

/**
 * Daily streak bonus configuration
 */
export const DAILY_STREAK_CONFIG = {
  /** Maximum daily streak bonus (+1%) */
  MAX_BONUS: 1,
  /** Days to reach maximum bonus */
  FULL_DAYS: 7,
} as const;

/**
 * Play time bonus configuration
 */
export const PLAY_TIME_CONFIG = {
  /** Maximum play time bonus (+0.5%) */
  MAX_BONUS: 0.5,
  /** Minutes to reach maximum bonus */
  FULL_MINUTES: 30,
} as const;

// =============================================================================
// NFT BOOST CONSTANTS
// =============================================================================

/**
 * NFT level boost percentages (fair 0→10% across 21 levels)
 */
export const NFT_LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.2,
  4: 0.3,
  5: 0.5,
  6: 1,
  7: 1.25,
  8: 1.5,
  9: 1.75,
  10: 2,
  11: 2.5,
  12: 3,
  13: 3.5,
  14: 4,
  15: 4.5,
  16: 5,
  17: 5.5,
  18: 6,
  19: 7,
  20: 8,
  21: 10,
};

// =============================================================================
// COMBINED BOOST LIMITS
// =============================================================================

/**
 * Overall boost limits to prevent excessive advantages
 */
export const BOOST_LIMITS = {
  /** Maximum total boost from all sources */
  MAX_TOTAL_BOOST: 100,
  /** Minimum multiplier (no negative mining) */
  MIN_MULTIPLIER: 0.5,
  /** Maximum multiplier */
  MAX_MULTIPLIER: 3.0,
} as const;
