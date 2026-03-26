/**
 * Claim Configuration
 *
 * Centralized configuration for the claim system.
 * All claim-related constants in one place.
 */

// =============================================================================
// TOKEN CONSTANTS
// =============================================================================

/**
 * Token denomination (8 decimals like Bitcoin)
 * 1 BABTC = 100,000,000 base units
 */
export const TOKEN_DENOMINATION = 100_000_000n;

/**
 * Work to token conversion factor
 * tokens = totalWork / WORK_DIVISOR
 */
export const WORK_DIVISOR = 100n;

/**
 * Minimum work required to claim (prevents dust claims)
 * ~10 shares at difficulty 10
 */
export const MIN_CLAIM_WORK = 1000n;

/**
 * Minimum tokens required to claim
 */
export const MIN_CLAIM_TOKENS = 10n;

/**
 * Dust amount for token outputs in satoshis
 */
export const TOKEN_DUST_SATS = 330;

// =============================================================================
// TIMING CONSTANTS
// =============================================================================

/**
 * Claim expiration time in milliseconds (24 hours)
 */
export const CLAIM_EXPIRATION_MS = 24 * 60 * 60 * 1000;

/**
 * Cache TTL for balance queries (1 minute)
 */
export const BALANCE_CACHE_TTL_MS = 60_000;

/**
 * Cleanup probability (1% chance on each request)
 */
export const CLEANUP_PROBABILITY = 0.01;

// =============================================================================
// CLAIM PROTOCOL
// =============================================================================

/**
 * OP_RETURN prefix for claim data identification
 */
export const CLAIM_PREFIX = "BABTC_CLAIM_V1";

/**
 * Claim status values
 */
export const CLAIM_STATUS = {
  PREPARED: "prepared",
  BROADCAST: "broadcast",
  CONFIRMED: "confirmed",
  MINTING: "minting",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
} as const;

export type ClaimStatusType = (typeof CLAIM_STATUS)[keyof typeof CLAIM_STATUS];

// =============================================================================
// PLATFORM FEES
// =============================================================================

/**
 * Default platform fee percentage
 */
export const DEFAULT_PLATFORM_FEE_PERCENT = 20;

/**
 * Minimum valid platform fee
 */
export const MIN_PLATFORM_FEE_PERCENT = 0;

/**
 * Maximum valid platform fee
 */
export const MAX_PLATFORM_FEE_PERCENT = 50;

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Minimum server secret key length
 */
export const MIN_SECRET_KEY_LENGTH = 32;

/**
 * Minimum entropy ratio for secret keys
 * At least 50% unique characters
 */
export const MIN_ENTROPY_RATIO = 0.5;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Calculate tokens from total work
 */
export function calculateTokensFromWork(totalWork: bigint): bigint {
  return (totalWork * TOKEN_DENOMINATION) / WORK_DIVISOR;
}

/**
 * Calculate work from difficulty (D²)
 */
export function calculateWorkFromDifficulty(difficulty: number): bigint {
  return BigInt(difficulty) * BigInt(difficulty);
}

/**
 * Validate platform fee percentage
 */
export function validatePlatformFeePercent(
  value: string | undefined,
): { valid: true; value: number } | { valid: false; error: string } {
  if (!value) {
    return { valid: true, value: DEFAULT_PLATFORM_FEE_PERCENT };
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    return {
      valid: false,
      error: `Invalid PLATFORM_FEE_PERCENT: "${value}" is not a number`,
    };
  }

  if (parsed < MIN_PLATFORM_FEE_PERCENT || parsed > MAX_PLATFORM_FEE_PERCENT) {
    return {
      valid: false,
      error: `Invalid PLATFORM_FEE_PERCENT: ${parsed}% (must be ${MIN_PLATFORM_FEE_PERCENT}-${MAX_PLATFORM_FEE_PERCENT})`,
    };
  }

  return { valid: true, value: parsed };
}

/**
 * Validate server secret key entropy
 */
export function validateSecretKey(
  key: string,
): { valid: true } | { valid: false; reason: string } {
  if (!key || key.length < MIN_SECRET_KEY_LENGTH) {
    return {
      valid: false,
      reason: `Key must be at least ${MIN_SECRET_KEY_LENGTH} characters`,
    };
  }

  // Check entropy: unique characters should be > 50% of length
  const uniqueChars = new Set(key.split("")).size;
  const minUniqueChars = Math.ceil(key.length * MIN_ENTROPY_RATIO);

  if (uniqueChars < minUniqueChars) {
    return {
      valid: false,
      reason: `Key has low entropy (${uniqueChars} unique chars, need ${minUniqueChars})`,
    };
  }

  // Check for repeating patterns (6+ repeated chars)
  const repeatingPattern = /(.)\1{5,}/.test(key);
  if (repeatingPattern) {
    return { valid: false, reason: "Key contains repeating patterns" };
  }

  return { valid: true };
}
