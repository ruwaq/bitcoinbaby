/**
 * $BABY Tokenomics Constants
 *
 * HYBRID ARCHITECTURE (Professional & Secure)
 * ============================================
 *
 * Layer 1: Virtual Balance (Off-chain, Cloudflare Workers)
 * - Fast mining rewards (no BTC fees)
 * - Generous rewards for engagement
 * - Burns on actions (free)
 * - Rate-limited and validated
 * - Backed by total supply tracking
 *
 * Layer 2: Batch Withdrawals (Secure bridge to Bitcoin)
 * - Admin-processed in batches (lower fees)
 * - 5% burn on withdrawal (deflationary)
 * - Verified against virtual balance
 * - Creates real Bitcoin transactions
 *
 * Layer 3: On-chain Contract (Full validation)
 * - For direct on-chain mining (power users)
 * - Validates PoW, Merkle proofs, difficulty
 * - Distribution enforced: 90/5/5 (miner/dev/staking)
 *
 * SECURITY MODEL:
 * - Virtual balance = trusted system (rate-limited)
 * - Withdrawals = verified + burned
 * - On-chain = trustless validation
 */

// =============================================================================
// SUPPLY
// =============================================================================

/** Total supply: 21 Billion (like Bitcoin x1000) */
export const TOTAL_SUPPLY = BigInt(21_000_000_000);

/** Decimals (same as Bitcoin) */
export const DECIMALS = 8;

/** Base unit (satoshi equivalent) */
export const BASE_UNIT = BigInt(10 ** DECIMALS);

// =============================================================================
// MINING REWARDS (BALANCED FOR SUSTAINABILITY)
// =============================================================================

/**
 * Base reward per share at minimum difficulty
 *
 * BALANCING PHILOSOPHY:
 * - Target: MILES por dia, no cientos de miles
 * - If successful: Many miners sharing emission
 * - If few miners: Prevent instant whales
 *
 * 100 $BABY base = Very sustainable long-term
 */
export const BASE_REWARD_PER_SHARE = BigInt(100);

/**
 * Minimum mining difficulty
 * Increased to D22 for very sustainable emission rate
 *
 * D22 = ~10 shares/hour for GPU (vs 700 at D16)
 * Shares are hard to find = very valuable
 */
export const MIN_DIFFICULTY = 22;

/**
 * Maximum mining difficulty
 * Reasonable cap to prevent overflow and ensure shares remain findable
 *
 * D32 = 2^32 hashes expected per share
 * At 100 MH/s: ~43 seconds per share
 */
export const MAX_DIFFICULTY = 32;

/** Halving interval in Bitcoin blocks (~4 years) */
export const HALVING_BLOCKS = 210_000;

/**
 * Global daily emission cap (SOFT - just for monitoring)
 * The difficulty naturally limits emission, no hard cap needed
 *
 * This is just a reference number, not enforced
 */
export const GLOBAL_DAILY_EMISSION_CAP = BigInt(100_000_000); // 100M soft reference

/**
 * Calculate reward for a share
 *
 * FLAT REWARD (Natural Bitcoin-like System)
 * =========================================
 *
 * Every valid share earns the same reward regardless of difficulty.
 * This mirrors how real Bitcoin mining pools work:
 *
 * - Difficulty is ONLY for server load balancing (VarDiff)
 * - Difficulty does NOT affect reward per share
 * - Your HASHRATE naturally determines how many shares you find
 * - More powerful devices find more shares = earn more (natural)
 *
 * Example earnings (natural, based on hashrate):
 * | Device    | Hashrate | Shares/Hour | Tokens/Hour |
 * |-----------|----------|-------------|-------------|
 * | Phone     | 500 H/s  | 0.4         | 40          |
 * | Laptop    | 100 KH/s | 5           | 500         |
 * | Desktop   | 350 KH/s | 5           | 500         |
 * | GPU       | 70 MH/s  | 60          | 6,000       |
 *
 * Gap of ~150x reflects NATURAL power difference.
 * No artificial boost - pure hashrate determines earnings.
 *
 * Streak bonuses still apply (rewards dedication, not power).
 */
export function calculateShareReward(_difficulty: number): bigint {
  // Flat reward for all valid shares
  // Difficulty is validated but doesn't affect reward
  return BASE_REWARD_PER_SHARE;
}

/**
 * NATURAL REWARD SYSTEM (All shares equal)
 *
 * | Difficulty | Reward/Share | Why Same? |
 * |------------|--------------|-----------|
 * | D22        | 100          | Flat rate |
 * | D24        | 100          | Flat rate |
 * | D26        | 100          | Flat rate |
 * | D28        | 100          | Flat rate |
 * | D32        | 100          | Flat rate |
 *
 * Earnings are determined by HASHRATE (how many shares you find),
 * not by difficulty. This is how Bitcoin mining pools work.
 */

// =============================================================================
// STREAK BONUS SYSTEM
// =============================================================================

/**
 * Streak bonus: The longer you mine continuously, the more you earn
 * Resets if you stop mining for 30 minutes
 *
 * This REWARDS dedication instead of punishing it
 */
export const STREAK_BONUSES = {
  /** Shares needed to reach each tier */
  tiers: [10, 50, 100, 250, 500] as const,
  /** Multiplier for each tier (1.0 = 100% = base reward) */
  multipliers: [1.0, 1.2, 1.5, 1.75, 1.9, 2.0] as const,
  /** Time in ms before streak resets (30 minutes) */
  resetTimeMs: 30 * 60 * 1000,
} as const;

/**
 * Calculate streak multiplier based on consecutive shares
 *
 * 0-9 shares:    1.0x (base)
 * 10-49 shares:  1.2x (+20%)
 * 50-99 shares:  1.5x (+50%)
 * 100-249:       1.75x (+75%)
 * 250-499:       1.9x (+90%)
 * 500+:          2.0x (+100%) MAX
 */
export function getStreakMultiplier(consecutiveShares: number): number {
  const { tiers, multipliers } = STREAK_BONUSES;

  for (let i = tiers.length - 1; i >= 0; i--) {
    if (consecutiveShares >= tiers[i]) {
      return multipliers[i + 1];
    }
  }
  return multipliers[0]; // Base multiplier
}

/**
 * Calculate reward with streak bonus
 */
export function calculateRewardWithStreak(
  difficulty: number,
  consecutiveShares: number,
): bigint {
  const baseReward = calculateShareReward(difficulty);
  const streakMultiplier = getStreakMultiplier(consecutiveShares);
  return BigInt(Math.floor(Number(baseReward) * streakMultiplier));
}

// =============================================================================
// ADAPTIVE EMISSION (Simple)
// =============================================================================

/**
 * Emission multipliers based on network activity
 * Applied OFF-CHAIN in Workers (no BTC fees)
 */
export const EMISSION_MULTIPLIERS = {
  /** Boost when many miners active (engagement reward) */
  highActivity: 1.5, // +50%
  /** Normal emission */
  normal: 1.0,
  /** Reduced when low activity (conservation) */
  lowActivity: 0.75, // -25%
} as const;

/** Thresholds for emission adjustment */
export const EMISSION_THRESHOLDS = {
  /** Active miners in last hour for "high activity" */
  highActivityMiners: 100,
  /** Active miners in last hour for "low activity" */
  lowActivityMiners: 10,
} as const;

/**
 * Calculate emission multiplier based on active miners
 */
export function getEmissionMultiplier(activeMiners: number): number {
  if (activeMiners >= EMISSION_THRESHOLDS.highActivityMiners) {
    return EMISSION_MULTIPLIERS.highActivity;
  }
  if (activeMiners <= EMISSION_THRESHOLDS.lowActivityMiners) {
    return EMISSION_MULTIPLIERS.lowActivity;
  }
  return EMISSION_MULTIPLIERS.normal;
}

/**
 * Calculate final reward with all multipliers
 */
export function calculateFinalReward(
  difficulty: number,
  activeMiners: number,
  nftBoostPercent: number = 0,
): bigint {
  const baseReward = calculateShareReward(difficulty);
  const emissionMultiplier = getEmissionMultiplier(activeMiners);
  const nftMultiplier = 1 + nftBoostPercent / 100;
  const totalMultiplier = emissionMultiplier * nftMultiplier;

  return BigInt(Math.floor(Number(baseReward) * totalMultiplier));
}

// =============================================================================
// BURNS (Automatic, invisible to user)
// =============================================================================

/**
 * NO burn on withdrawals - users get 100% of their tokens
 * Burns happen on VALUE actions instead:
 * - NFT purchases
 * - Baby evolution
 * - Premium features (names, skins, boosts)
 */
export const WITHDRAW_BURN_RATE = 0; // No burn on withdraw

/** Calculate withdrawal (no burn) */
export function calculateWithdrawBurn(amount: bigint): {
  burnAmount: bigint;
  netAmount: bigint;
} {
  return { burnAmount: BigInt(0), netAmount: amount };
}

// =============================================================================
// DISTRIBUTION (Re-exported from @bitcoinbaby/bitcoin - single source of truth)
// =============================================================================

import { BABTC_CONFIG } from "@bitcoinbaby/bitcoin";

/**
 * Mining reward distribution for ON-CHAIN minting
 *
 * SOURCE OF TRUTH: @bitcoinbaby/bitcoin (BABTC_CONFIG.distribution)
 *
 * NOTE: This only applies when minting real tokens via Charms.
 * Virtual balance (what users see) shows 100% of their mined rewards.
 * The dev/staking distribution happens silently in the background.
 */
export const DISTRIBUTION = BABTC_CONFIG.distribution;

// =============================================================================
// NFT & EVOLUTION COSTS
// =============================================================================
// Note: EVOLUTION_COSTS is defined in ../types.ts (re-exported from nft-config)
// These are additional tokenomics-specific costs

/** NFT minting costs by rarity in $BABY (burned on mint) */
export const NFT_MINT_BURN_COSTS = {
  common: BigInt(1_000),
  uncommon: BigInt(5_000),
  rare: BigInt(25_000),
  epic: BigInt(100_000),
  legendary: BigInt(500_000),
  mythic: BigInt(2_500_000),
} as const;

// =============================================================================
// PREMIUM FEATURES (Burns that give VALUE)
// =============================================================================

/** Premium features - user pays, gets value, tokens burned */
export const PREMIUM_BURN_COSTS = {
  /** Custom name for Baby */
  customName: BigInt(5_000),
  /** Special skin/color */
  customSkin: BigInt(10_000),
  /** Mining boost +50% for 1 hour */
  miningBoost1h: BigInt(2_500),
  /** Mining boost +50% for 24 hours */
  miningBoost24h: BigInt(25_000),
  /** Revive dead Baby (skip penalty) */
  reviveBaby: BigInt(50_000),
  /** Reset Baby stats (respec) */
  resetStats: BigInt(15_000),
} as const;

export type PremiumFeature = keyof typeof PREMIUM_BURN_COSTS;

// =============================================================================
// SECURITY & RATE LIMITS (BALANCED)
// =============================================================================

/**
 * Maximum shares per hour per address
 * Safety cap to prevent abuse. Actual mining rate at D22:
 * - WebGPU at ~70 MH/s finds ~50 shares/second
 * - This limit allows reasonable mining while preventing spam
 * - Server-side validation is the real limiter
 */
export const MAX_SHARES_PER_HOUR = 1000;

/** Maximum reward per share (cap to prevent exploits) */
export const MAX_REWARD_PER_SHARE = BigInt(10_000); // 10K max (with all bonuses)

/** Minimum time between shares in ms (anti-spam) */
export const MIN_SHARE_INTERVAL_MS = 1000; // 1 second

/**
 * Maximum daily emission per address (NO HARD LIMIT)
 * La dificultad controla la emision naturalmente
 * Si quieren minar todo el dia, que sigan minando!
 *
 * Este valor es solo referencia, no se fuerza
 */
export const MAX_DAILY_EMISSION_PER_ADDRESS = BigInt(1_000_000_000); // No real limit

/** Minimum withdrawal amount */
export const MIN_WITHDRAWAL = BigInt(10_000); // 10K minimum

/** Maximum withdrawal per transaction */
export const MAX_WITHDRAWAL = BigInt(10_000_000); // 10M max

/**
 * Validate share submission (security check)
 */
export function validateShareSubmission(params: {
  sharesThisHour: number;
  lastShareTime: number;
  difficulty: number;
}): { valid: boolean; reason?: string } {
  const now = Date.now();

  // Rate limit: max shares per hour
  if (params.sharesThisHour >= MAX_SHARES_PER_HOUR) {
    return { valid: false, reason: "Rate limit: max shares per hour exceeded" };
  }

  // Anti-spam: minimum interval
  if (now - params.lastShareTime < MIN_SHARE_INTERVAL_MS) {
    return { valid: false, reason: "Too fast: wait between submissions" };
  }

  // Difficulty check
  if (params.difficulty < MIN_DIFFICULTY) {
    return { valid: false, reason: "Difficulty too low" };
  }

  return { valid: true };
}

/**
 * Validate withdrawal request (security check)
 */
export function validateWithdrawal(params: {
  amount: bigint;
  balance: bigint;
}): { valid: boolean; reason?: string } {
  if (params.amount < MIN_WITHDRAWAL) {
    return { valid: false, reason: `Minimum withdrawal: ${MIN_WITHDRAWAL}` };
  }

  if (params.amount > MAX_WITHDRAWAL) {
    return { valid: false, reason: `Maximum withdrawal: ${MAX_WITHDRAWAL}` };
  }

  if (params.amount > params.balance) {
    return { valid: false, reason: "Insufficient balance" };
  }

  return { valid: true };
}

// =============================================================================
// SUMMARY
// =============================================================================

/**
 * NATURAL TOKENOMICS (Bitcoin-like System)
 *
 * FILOSOFIA:
 * - Sistema NATURAL como Bitcoin mining pools
 * - Tu HASHRATE determina tus ganancias (no dificultad)
 * - Cada share vale IGUAL (100 tokens)
 * - Dispositivos potentes ganan más porque encuentran más shares
 *
 * COMO FUNCIONA:
 * - VarDiff ajusta dificultad para balancear carga del servidor
 * - Dificultad NO afecta reward (solo controla tasa de shares)
 * - Tu hashrate natural determina cuántos shares encuentras
 *
 * EJEMPLO DE GANANCIAS NATURALES:
 * | Dispositivo | Hashrate  | Shares/Hora | Tokens/Hora |
 * |-------------|-----------|-------------|-------------|
 * | Phone       | 500 H/s   | 0.4         | 40          |
 * | Phone Mid   | 7.5 KH/s  | 6           | 600         |
 * | Laptop      | 100 KH/s  | 5           | 500         |
 * | Desktop     | 350 KH/s  | 5           | 500         |
 * | GPU Low     | 3 MH/s    | 10          | 1,000       |
 * | GPU High    | 70 MH/s   | 60          | 6,000       |
 *
 * STREAK SYSTEM (Rewards dedication, not power):
 * - 0-9 shares:    1.0x base
 * - 10-49 shares:  1.2x (+20%)
 * - 50-99 shares:  1.5x (+50%)
 * - 100-249:       1.75x (+75%)
 * - 250-499:       1.9x (+90%)
 * - 500+:          2.0x (+100%) MAX
 *
 * WHY THIS IS FAIR:
 * - GPU gana 150x más que phone = refleja 140,000x más hashrate
 * - No hay "handouts" artificiales
 * - El poder natural se recompensa naturalmente
 * - Streaks recompensan DEDICACIÓN (todos igual)
 *
 * BURNS (Give VALUE, not penalty):
 * - NFTs, Evolution, Premium features
 */
