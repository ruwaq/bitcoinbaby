/**
 * Mining Proof Validation
 *
 * SECURITY: Server-side validation of mining proofs.
 * Never trust client-provided data.
 */

// =============================================================================
// CONSTANTS (must match packages/core/src/tokenomics/constants.ts)
// =============================================================================

/** Minimum difficulty (D16 to match contract) */
export const MIN_DIFFICULTY = 16;

/** Maximum difficulty (reasonable cap to prevent overflow) */
export const MAX_DIFFICULTY = 32;

/** Base reward per share at minimum difficulty */
export const BASE_REWARD_PER_SHARE = BigInt(10);

/** Maximum shares per hour per address
 * Safety cap to prevent abuse. WebGPU miners can find many shares quickly.
 * This allows reasonable mining while preventing spam.
 *
 * IMPORTANT: Must be >= VarDiff target rate (1 share/3s = 1200/hr)
 * Set to 1500 to give 25% headroom for burst mining.
 */
export const MAX_SHARES_PER_HOUR = 1500;

import { Logger } from "./logger";
const proofLogger = new Logger("ProofValidation");

/** Minimum time between shares in ms */
export const MIN_SHARE_INTERVAL_MS = 1000;

/** Maximum proof age in ms (2 hours)
 * Extended to allow offline mining sync and network latency
 * Previous 5 minute limit was causing 400 errors for pending shares
 */
export const MAX_PROOF_AGE_MS = 2 * 60 * 60 * 1000;

/** Streak reset time (30 minutes) */
export const STREAK_RESET_MS = 30 * 60 * 1000;

// =============================================================================
// PROOF VALIDATION
// =============================================================================

export interface MiningProofInput {
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  timestamp?: number;
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  calculatedReward?: bigint;
}

/**
 * Validate mining proof cryptographically
 *
 * SECURITY: This is the core validation that prevents fake proofs
 */
export async function validateMiningProof(
  proof: MiningProofInput,
): Promise<ValidationResult> {
  // 1. Check required fields
  if (!proof.hash || typeof proof.nonce !== "number" || !proof.blockData) {
    return { valid: false, reason: "Missing required proof fields" };
  }

  // 2. Validate difficulty range
  if (proof.difficulty < MIN_DIFFICULTY) {
    return {
      valid: false,
      reason: `Difficulty too low. Minimum: ${MIN_DIFFICULTY}`,
    };
  }

  if (proof.difficulty > MAX_DIFFICULTY) {
    return {
      valid: false,
      reason: `Difficulty too high. Maximum: ${MAX_DIFFICULTY}`,
    };
  }

  // 3. Validate proof timestamp (if provided)
  if (proof.timestamp) {
    const age = Date.now() - proof.timestamp;
    if (age < 0 || age > MAX_PROOF_AGE_MS) {
      return { valid: false, reason: "Proof timestamp too old or in future" };
    }
  }

  // 4. SECURITY: Verify nonce in blockData matches proof.nonce
  // blockData format: "block:address:nonce" or "block:address:nonceHex"
  // This prevents reusing the same work with different nonce claims
  const blockDataParts = proof.blockData.split(":");
  if (blockDataParts.length < 3) {
    return { valid: false, reason: "Invalid blockData format" };
  }
  const embeddedNonceStr = blockDataParts[blockDataParts.length - 1];

  // Parse nonce from blockData - support both hex and decimal formats
  // SECURITY: To prevent same blockData validating with two different nonces,
  // we determine format based on content, not based on what "matches"
  let embeddedNonce: number;

  // Check for explicit hex prefix
  if (embeddedNonceStr.startsWith("0x")) {
    embeddedNonce = parseInt(embeddedNonceStr.slice(2), 16);
  } else {
    // If contains a-f characters, it's definitely hex
    const hasHexChars = /[a-fA-F]/.test(embeddedNonceStr);

    if (hasHexChars) {
      // Hex format (contains letters)
      embeddedNonce = parseInt(embeddedNonceStr, 16);
    } else {
      // Pure digits (0-9) - prefer hex interpretation since both miners now use hex
      // Fall back to decimal only if hex interpretation doesn't match
      const asHex = parseInt(embeddedNonceStr, 16);
      const asDecimal = parseInt(embeddedNonceStr, 10);

      // Prefer hex for consistency with current miners
      if (!isNaN(asHex) && asHex === proof.nonce) {
        embeddedNonce = asHex;
      } else if (!isNaN(asDecimal) && asDecimal === proof.nonce) {
        // Fallback for old shares (backwards compatibility)
        embeddedNonce = asDecimal;
      } else {
        return {
          valid: false,
          reason: `Nonce mismatch: blockData "${embeddedNonceStr}" (hex=${asHex}, dec=${asDecimal}) doesn't match proof.nonce=${proof.nonce}`,
        };
      }
    }
  }

  if (isNaN(embeddedNonce)) {
    return {
      valid: false,
      reason: `Invalid nonce format: "${embeddedNonceStr}"`,
    };
  }

  // 5. Recalculate hash = double SHA256(blockData)
  // The miner uses double SHA256 (Bitcoin standard hash256)
  const calculatedHash = await hash256Hex(proof.blockData);

  // 6. Verify hash matches (case-insensitive)
  if (calculatedHash.toLowerCase() !== proof.hash.toLowerCase()) {
    return {
      valid: false,
      reason: "Hash mismatch: proof does not match blockData + nonce",
    };
  }

  // 7. Verify hash meets difficulty (count leading zero bits)
  const leadingZeros = countLeadingZeroBits(calculatedHash);
  if (leadingZeros < proof.difficulty) {
    return {
      valid: false,
      reason: `Hash does not meet difficulty. Required: ${proof.difficulty}, Got: ${leadingZeros}`,
    };
  }

  // 8. Calculate reward server-side (NEVER trust client)
  const calculatedReward = calculateShareReward(proof.difficulty);

  return {
    valid: true,
    calculatedReward,
  };
}

// =============================================================================
// RATE LIMITING
// =============================================================================

export interface RateLimitCheck {
  sharesThisHour: number;
  lastShareTime: number;
}

export function checkRateLimit(check: RateLimitCheck): ValidationResult {
  const now = Date.now();

  // Check max shares per hour
  if (check.sharesThisHour >= MAX_SHARES_PER_HOUR) {
    return {
      valid: false,
      reason: `Rate limit: max ${MAX_SHARES_PER_HOUR} shares per hour`,
    };
  }

  // Check minimum interval between shares
  if (now - check.lastShareTime < MIN_SHARE_INTERVAL_MS) {
    return {
      valid: false,
      reason: "Too fast: wait between submissions",
    };
  }

  return { valid: true };
}

// =============================================================================
// REWARD CALCULATION (Server-side only)
// =============================================================================

/**
 * Calculate reward for a share
 *
 * FLAT REWARD (Natural Bitcoin-like System)
 * =========================================
 *
 * Every valid share earns the same reward regardless of difficulty.
 * This is how real Bitcoin mining pools work:
 *
 * - Difficulty is ONLY for server load balancing (VarDiff)
 * - Difficulty does NOT affect reward per share
 * - Your HASHRATE naturally determines how many shares you find
 * - More powerful devices find more shares = earn more (natural)
 *
 * Why this is fair:
 * - GPU with 70 MH/s at D32 finds ~60 shares/hour = 6,000 tokens/hour
 * - Phone with 500 H/s at D22 finds ~0.4 shares/hour = 40 tokens/hour
 * - Gap of 150x reflects NATURAL power difference
 * - No artificial boost or penalty - pure hashrate determines earnings
 *
 * Streak bonuses still apply (rewards dedication, not power)
 */
export function calculateShareReward(_difficulty: number): bigint {
  // Flat reward for all valid shares
  // Difficulty is validated but doesn't affect reward
  return BASE_REWARD_PER_SHARE;
}

/**
 * Calculate streak multiplier
 *
 * 0-9 shares:    1.0x (base)
 * 10-49 shares:  1.2x (+20%)
 * 50-99 shares:  1.5x (+50%)
 * 100-249:       1.75x (+75%)
 * 250-499:       1.9x (+90%)
 * 500+:          2.0x (+100%) MAX
 */
export function getStreakMultiplier(consecutiveShares: number): number {
  const tiers = [10, 50, 100, 250, 500];
  const multipliers = [1.0, 1.2, 1.5, 1.75, 1.9, 2.0];

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (consecutiveShares >= tiers[i]) {
      return multipliers[i + 1];
    }
  }
  return multipliers[0];
}

/**
 * Calculate final reward with streak bonus
 */
export function calculateRewardWithStreak(
  difficulty: number,
  consecutiveShares: number,
): bigint {
  const baseReward = calculateShareReward(difficulty);
  const multiplier = getStreakMultiplier(consecutiveShares);
  return BigInt(Math.floor(Number(baseReward) * multiplier));
}

// =============================================================================
// CRYPTO HELPERS
// =============================================================================

/**
 * Calculate SHA256 hash and return as Uint8Array
 */
async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Double SHA256 (Bitcoin standard hash256)
 * hash256(data) = SHA256(SHA256(data))
 *
 * CRITICAL: The second SHA256 must be on the 32 BYTES of the first hash,
 * NOT on the 64-character hex string representation!
 */
async function hash256Hex(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // First SHA256 -> 32 bytes
  const firstHash = await sha256Bytes(dataBuffer);

  // Second SHA256 on the 32 BYTES (not hex string!)
  const secondHash = await sha256Bytes(firstHash);

  return bytesToHex(secondHash);
}

/**
 * Count leading zero bits in a hex string
 *
 * Each hex character represents 4 bits:
 * 0 = 0000 (4 zeros)
 * 1 = 0001 (3 zeros)
 * 2-3 = 001x (2 zeros)
 * 4-7 = 01xx (1 zero)
 * 8-f = 1xxx (0 zeros)
 */
function countLeadingZeroBits(hexString: string): number {
  let zeroBits = 0;

  for (const char of hexString.toLowerCase()) {
    const nibble = parseInt(char, 16);

    if (nibble === 0) {
      zeroBits += 4;
    } else if (nibble === 1) {
      zeroBits += 3;
      break;
    } else if (nibble <= 3) {
      zeroBits += 2;
      break;
    } else if (nibble <= 7) {
      zeroBits += 1;
      break;
    } else {
      break;
    }
  }

  return zeroBits;
}

// =============================================================================
// GLOBAL PROOF REGISTRY (prevents cross-address duplicate submission)
// =============================================================================

// Track if we've already logged the KV warning (avoid spam)
let kvWarningLogged = false;

/**
 * Check if a proof hash has been used globally
 * This prevents the same proof from being submitted to multiple addresses
 *
 * SECURITY: In production, KV MUST be configured for proper deduplication
 *
 * @returns Object with used flag and error if KV unavailable in production
 */
export async function isProofUsedGlobally(
  hash: string,
  kv: KVNamespace | null,
  environment?: string,
): Promise<{ used: boolean; error?: string }> {
  if (!kv) {
    // CRITICAL: In production, reject if KV not available
    if (environment === "production") {
      if (!kvWarningLogged) {
        proofLogger.error(
          "CRITICAL: KV namespace not configured in production! " +
            "Rejecting proof submissions until KV is configured.",
        );
        kvWarningLogged = true;
      }
      return {
        used: false,
        error: "Service temporarily unavailable. Please try again later.",
      };
    }
    // In development/staging, allow without KV (local UNIQUE constraint still works)
    return { used: false };
  }

  try {
    const key = `proof:${hash}`;
    const existing = await kv.get(key);
    return { used: existing !== null };
  } catch (error) {
    // KV error - log and reject in production
    proofLogger.error("KV read error:", error);
    if (environment === "production") {
      return {
        used: false,
        error: "Service temporarily unavailable. Please try again later.",
      };
    }
    return { used: false };
  }
}

/**
 * Mark a proof as used globally
 *
 * NOTE: Proofs expire after 24 hours to prevent unbounded storage growth
 */
export async function markProofUsedGlobally(
  hash: string,
  address: string,
  kv: KVNamespace | null,
): Promise<void> {
  if (!kv) return;

  const key = `proof:${hash}`;
  const value = JSON.stringify({
    address,
    timestamp: Date.now(),
  });

  // Expire after 24 hours
  await kv.put(key, value, { expirationTtl: 86400 });
}
