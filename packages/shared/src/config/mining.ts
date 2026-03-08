/**
 * Mining Configuration Constants
 *
 * SINGLE SOURCE OF TRUTH for mining parameters used across
 * both client (packages/core) and server (apps/workers).
 *
 * These values MUST be consistent between client and server
 * for proper validation and rate limiting.
 */

// =============================================================================
// DIFFICULTY
// =============================================================================

/**
 * Minimum mining difficulty (D16 to match BABTC contract)
 *
 * D16 means the hash must have 16 leading zero bits.
 * Expected hashes to find share: 2^16 = 65,536
 */
export const MIN_DIFFICULTY = 16;

/**
 * Maximum mining difficulty
 *
 * D32 = 2^32 hashes expected per share
 * At 100 MH/s: ~43 seconds per share
 * Reasonable cap to prevent overflow and ensure shares remain findable.
 */
export const MAX_DIFFICULTY = 32;

// =============================================================================
// REWARDS
// =============================================================================

/**
 * Base reward per share (in $BABY tokens)
 *
 * Flat reward system - every valid share earns the same base amount.
 * Difficulty affects HOW OFTEN you find shares, not HOW MUCH per share.
 */
export const BASE_REWARD_PER_SHARE = BigInt(10);

/**
 * Maximum reward per share (with all bonuses)
 * Safety cap to prevent exploits.
 */
export const MAX_REWARD_PER_SHARE = BigInt(10_000);

// =============================================================================
// RATE LIMITS
// =============================================================================

/**
 * Maximum shares per hour per address
 *
 * IMPORTANT: Must be >= VarDiff target rate
 * VarDiff targets 1 share every 3 seconds = 1200 shares/hour
 * Set to 1500 to give 25% headroom for burst mining.
 *
 * This allows legitimate mining while preventing spam.
 */
export const MAX_SHARES_PER_HOUR = 1500;

/**
 * Minimum time between share submissions (ms)
 * Anti-spam protection.
 */
export const MIN_SHARE_INTERVAL_MS = 1000;

/**
 * Maximum proof age (ms) - 2 hours
 * Extended to allow offline mining sync and network latency.
 */
export const MAX_PROOF_AGE_MS = 2 * 60 * 60 * 1000;

// =============================================================================
// STREAK SYSTEM
// =============================================================================

/**
 * Time before mining streak resets (30 minutes)
 */
export const STREAK_RESET_MS = 30 * 60 * 1000;

/**
 * Streak tier thresholds (consecutive shares needed)
 */
export const STREAK_TIERS = [10, 50, 100, 250, 500] as const;

/**
 * Streak multipliers for each tier
 * Index 0 = base (no streak)
 * Index 1-5 = multiplier when reaching tiers[i-1]
 */
export const STREAK_MULTIPLIERS = [1.0, 1.2, 1.5, 1.75, 1.9, 2.0] as const;

/**
 * Get streak multiplier based on consecutive shares
 */
export function getStreakMultiplier(consecutiveShares: number): number {
  for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
    if (consecutiveShares >= STREAK_TIERS[i]) {
      return STREAK_MULTIPLIERS[i + 1];
    }
  }
  return STREAK_MULTIPLIERS[0];
}

// =============================================================================
// VARDIFF (Variable Difficulty)
// =============================================================================

/**
 * VarDiff configuration for server load balancing
 */
export const VARDIFF_CONFIG = {
  /** Target time between shares (seconds) */
  targetShareTime: 3,
  /** Number of shares to evaluate before adjusting */
  retargetShares: 10,
  /** Maximum difficulty change per adjustment */
  maxChange: 4,
  /** Variance threshold before adjusting (%) */
  variancePercent: 30,
} as const;
