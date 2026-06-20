/**
 * Tokenomics System
 *
 * Inspired by eCash's developer reward model.
 * Implements a triple distribution system for $BABY tokens.
 *
 * IMPORTANT: Distribution percentages are defined in @bitcoinbaby/bitcoin
 * as the single source of truth. This file re-exports with game-specific naming.
 */

import type { BabyStage } from "./constants";
import { MINING_BONUS } from "./constants";
import { SPARK_CONFIG } from "@bitcoinbaby/bitcoin";

/**
 * Token distribution percentages
 * SOURCE OF TRUTH: @bitcoinbaby/bitcoin (SPARK_CONFIG.distribution)
 *
 * These are re-exported with game-specific naming for backwards compatibility.
 * miner → PLAYER_SHARE
 * dev → DEV_FUND_SHARE
 * staking → COMMUNITY_SHARE (staking pool funds community events)
 */
export const TOKEN_DISTRIBUTION = {
  // Percentage to player (miner) - from SPARK_CONFIG
  PLAYER_SHARE: SPARK_CONFIG.distribution.miner,

  // Percentage to dev fund (for game improvements) - from SPARK_CONFIG
  DEV_FUND_SHARE: SPARK_CONFIG.distribution.dev,

  // Percentage to community treasury (events, prizes) - from SPARK_CONFIG
  COMMUNITY_SHARE: SPARK_CONFIG.distribution.staking,
} as const;

/**
 * Staking tier configuration (numeric values)
 */
export const STAKING_TIERS = {
  bronze: { minAmount: 100, multiplier: 1.0, apy: 5 },
  silver: { minAmount: 1000, multiplier: 1.25, apy: 7 },
  gold: { minAmount: 10000, multiplier: 1.5, apy: 10 },
  diamond: { minAmount: 100000, multiplier: 2.0, apy: 15 },
} as const;

/**
 * Staking configuration
 */
export const STAKING_CONFIG = {
  // Minimum tokens to stake
  MIN_STAKE_AMOUNT: 100,

  // Maximum stake multiplier
  MAX_STAKE_MULTIPLIER: 2.0,

  // Base APY percentage (annual)
  BASE_APY: 5,

  // Bonus APY for active players (who also mine)
  ACTIVE_PLAYER_BONUS_APY: 3,

  // Staking tiers (reference)
  TIERS: STAKING_TIERS,
} as const;

/**
 * Contribution rewards (for community contributions)
 * Values in $BABY tokens (will be converted to BigInt when used)
 */
export const CONTRIBUTION_REWARDS = {
  // Bug report rewards
  BUG_REPORT: {
    minor: 10,
    major: 50,
    critical: 200,
  },

  // Feature suggestion implemented
  FEATURE_SUGGESTION: 100,

  // Community content (guides, tutorials)
  COMMUNITY_CONTENT: 25,

  // Referral bonus
  REFERRAL_BONUS: 15,
} as const;

/**
 * Staking tier type
 */
export type StakingTier = keyof typeof STAKING_CONFIG.TIERS;

/**
 * Staking state for a player
 */
export interface StakingState {
  // Amount currently staked
  stakedAmount: bigint;

  // Timestamp when staking started
  stakedAt: number;

  // Current tier
  tier: StakingTier;

  // Accumulated rewards (unclaimed)
  pendingRewards: bigint;

  // Last reward calculation timestamp
  lastRewardCalculation: number;

  // Is actively staking
  isActive: boolean;
}

/**
 * Token distribution result
 */
export interface TokenDistribution {
  playerAmount: bigint;
  devFundAmount: bigint;
  communityAmount: bigint;
  totalAmount: bigint;
}

/**
 * Calculate token distribution for mined amount
 *
 * IMPORTANT: Stage bonus is applied to player's share but does NOT increase
 * the total emission. The bonus comes from the community/dev funds proportionally.
 * This ensures totalAmount always equals the input totalTokens.
 *
 * For example, with 100 tokens and a 1.2x bonus:
 * - Base player share: 70 tokens
 * - Bonus amount: 70 * 0.2 = 14 tokens (taken from dev+community proportionally)
 * - Final player: 84 tokens, dev+community: 16 tokens
 * - Total: 100 tokens (unchanged)
 */
export function calculateDistribution(
  totalTokens: bigint,
  stage: BabyStage,
): TokenDistribution {
  // Apply stage bonus using BigInt arithmetic (scaled by 1000 for precision)
  const stageBonus = MINING_BONUS[stage];
  const SCALE = BigInt(1000);
  const hundred = BigInt(100);

  // Scale bonus to integer: 1.2 -> 1200, 1.0 -> 1000
  const scaledBonus = BigInt(Math.round(stageBonus * 1000));

  // Calculate base shares as percentages of total
  const playerPercent = BigInt(TOKEN_DISTRIBUTION.PLAYER_SHARE);
  const devPercent = BigInt(TOKEN_DISTRIBUTION.DEV_FUND_SHARE);
  const communityPercent = BigInt(TOKEN_DISTRIBUTION.COMMUNITY_SHARE);

  // Calculate player amount with bonus (all in BigInt)
  // playerWithBonus = (totalTokens * playerPercent * scaledBonus) / (100 * 1000)
  const playerWithBonus =
    (totalTokens * playerPercent * scaledBonus) / (hundred * SCALE);

  // Clamp player share to not exceed totalTokens
  const clampedPlayer =
    playerWithBonus > totalTokens ? totalTokens : playerWithBonus;

  // Remaining tokens go to dev and community (proportionally)
  const remaining = totalTokens - clampedPlayer;
  const nonPlayerTotal = devPercent + communityPercent;

  // Distribute remaining proportionally to dev and community
  const devFund =
    nonPlayerTotal > BigInt(0)
      ? (remaining * devPercent) / nonPlayerTotal
      : BigInt(0);
  const community = remaining - devFund; // Rest goes to community to avoid rounding loss

  return {
    playerAmount: clampedPlayer,
    devFundAmount: devFund,
    communityAmount: community,
    totalAmount: totalTokens, // Always equals input - no phantom tokens
  };
}

/**
 * Get staking tier for amount
 * Uses BigInt comparison to avoid overflow with large amounts
 */
export function getStakingTier(amount: bigint): StakingTier {
  const tiers = STAKING_TIERS;

  // Compare using BigInt to avoid Number overflow
  if (amount >= BigInt(tiers.diamond.minAmount)) return "diamond";
  if (amount >= BigInt(tiers.gold.minAmount)) return "gold";
  if (amount >= BigInt(tiers.silver.minAmount)) return "silver";
  return "bronze";
}

/**
 * Calculate staking rewards
 *
 * Uses BigInt arithmetic throughout to avoid overflow with large staked amounts.
 * Precision is maintained using scaled integers:
 * - APY uses basis points (1/10000)
 * - Duration uses milliseconds scaled against year in ms
 * - Multiplier uses 1000x scale (1.25 -> 1250)
 */
export function calculateStakingRewards(
  stakedAmount: bigint,
  tier: StakingTier,
  durationMs: number,
  isActivePlayer: boolean,
): bigint {
  // Compare using BigInt to avoid overflow
  if (stakedAmount < BigInt(STAKING_CONFIG.MIN_STAKE_AMOUNT)) {
    return BigInt(0);
  }

  const tierConfig = STAKING_TIERS[tier];

  // Calculate base APY in basis points (100 bps = 1%)
  let apyBps = tierConfig.apy * 100; // 5% -> 500 bps
  if (isActivePlayer) {
    apyBps += STAKING_CONFIG.ACTIVE_PLAYER_BONUS_APY * 100;
  }

  // Constants for BigInt math
  const MS_PER_YEAR = BigInt(Math.floor(365.25 * 24 * 60 * 60 * 1000)); // ~31557600000
  const BPS_SCALE = BigInt(10000); // Basis points scale
  const MULTIPLIER_SCALE = BigInt(1000); // Multiplier scale (1.25 -> 1250)

  // Scale multiplier: 1.25 -> 1250
  const scaledMultiplier = BigInt(Math.round(tierConfig.multiplier * 1000));

  // Calculate rewards using BigInt arithmetic:
  // reward = stakedAmount * apyBps * durationMs * scaledMultiplier / (BPS_SCALE * MS_PER_YEAR * MULTIPLIER_SCALE)
  const durationBigInt = BigInt(Math.floor(durationMs));
  const apyBigInt = BigInt(apyBps);

  // Numerator: stakedAmount * apyBps * duration * multiplier
  const numerator =
    stakedAmount * apyBigInt * durationBigInt * scaledMultiplier;

  // Denominator: 10000 * MS_PER_YEAR * 1000
  const denominator = BPS_SCALE * MS_PER_YEAR * MULTIPLIER_SCALE;

  return numerator / denominator;
}

/**
 * Create initial staking state
 */
export function createStakingState(): StakingState {
  return {
    stakedAmount: BigInt(0),
    stakedAt: 0,
    tier: "bronze",
    pendingRewards: BigInt(0),
    lastRewardCalculation: Date.now(),
    isActive: false,
  };
}

/**
 * Stake tokens
 */
export function stakeTokens(
  currentState: StakingState,
  amount: bigint,
  availableBalance: bigint,
): { state: StakingState; success: boolean; error?: string } {
  // Use BigInt comparison to avoid overflow
  if (amount < BigInt(STAKING_CONFIG.MIN_STAKE_AMOUNT)) {
    return {
      state: currentState,
      success: false,
      error: `Minimum stake is ${STAKING_CONFIG.MIN_STAKE_AMOUNT} $BABY`,
    };
  }

  if (amount > availableBalance) {
    return {
      state: currentState,
      success: false,
      error: "Insufficient balance",
    };
  }

  const now = Date.now();
  const newStakedAmount = currentState.stakedAmount + amount;
  const newTier = getStakingTier(newStakedAmount);

  return {
    state: {
      ...currentState,
      stakedAmount: newStakedAmount,
      stakedAt: currentState.isActive ? currentState.stakedAt : now,
      tier: newTier,
      lastRewardCalculation: now,
      isActive: true,
    },
    success: true,
  };
}

/**
 * Unstake tokens
 */
export function unstakeTokens(
  currentState: StakingState,
  amount: bigint,
  isActivePlayer: boolean,
): { state: StakingState; rewards: bigint; success: boolean; error?: string } {
  if (amount > currentState.stakedAmount) {
    return {
      state: currentState,
      rewards: BigInt(0),
      success: false,
      error: "Cannot unstake more than staked amount",
    };
  }

  const now = Date.now();

  // Calculate pending rewards before unstaking
  const duration = now - currentState.lastRewardCalculation;
  const earnedRewards = calculateStakingRewards(
    currentState.stakedAmount,
    currentState.tier,
    duration,
    isActivePlayer,
  );

  const totalRewards = currentState.pendingRewards + earnedRewards;
  const newStakedAmount = currentState.stakedAmount - amount;
  const newTier = getStakingTier(newStakedAmount);
  // Use BigInt comparison to avoid overflow
  const isStillActive =
    newStakedAmount >= BigInt(STAKING_CONFIG.MIN_STAKE_AMOUNT);

  return {
    state: {
      ...currentState,
      stakedAmount: newStakedAmount,
      tier: newTier,
      pendingRewards: BigInt(0),
      lastRewardCalculation: now,
      isActive: isStillActive,
    },
    rewards: totalRewards,
    success: true,
  };
}

/**
 * Claim staking rewards without unstaking
 */
export function claimRewards(
  currentState: StakingState,
  isActivePlayer: boolean,
): { state: StakingState; rewards: bigint } {
  const now = Date.now();
  const duration = now - currentState.lastRewardCalculation;

  const earnedRewards = calculateStakingRewards(
    currentState.stakedAmount,
    currentState.tier,
    duration,
    isActivePlayer,
  );

  const totalRewards = currentState.pendingRewards + earnedRewards;

  return {
    state: {
      ...currentState,
      pendingRewards: BigInt(0),
      lastRewardCalculation: now,
    },
    rewards: totalRewards,
  };
}

/**
 * Get staking summary for display
 */
export function getStakingSummary(
  state: StakingState,
  isActivePlayer: boolean,
): {
  tier: StakingTier;
  tierName: string;
  stakedAmount: string;
  currentAPY: number;
  multiplier: number;
  pendingRewards: string;
  nextTier: StakingTier | null;
  toNextTier: string;
} {
  const tierConfig = STAKING_TIERS[state.tier];
  const currentAPY =
    tierConfig.apy +
    (isActivePlayer ? STAKING_CONFIG.ACTIVE_PLAYER_BONUS_APY : 0);

  // Calculate current pending rewards
  const now = Date.now();
  const duration = now - state.lastRewardCalculation;
  const earnedRewards = calculateStakingRewards(
    state.stakedAmount,
    state.tier,
    duration,
    isActivePlayer,
  );
  const totalPending = state.pendingRewards + earnedRewards;

  // Determine next tier
  const tierOrder: StakingTier[] = ["bronze", "silver", "gold", "diamond"];
  const currentIndex = tierOrder.indexOf(state.tier);
  const nextTier =
    currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null;
  const toNextTier = nextTier
    ? (
        BigInt(STAKING_TIERS[nextTier].minAmount) - state.stakedAmount
      ).toString()
    : "0";

  const tierNames: Record<StakingTier, string> = {
    bronze: "Bronce",
    silver: "Plata",
    gold: "Oro",
    diamond: "Diamante",
  };

  return {
    tier: state.tier,
    tierName: tierNames[state.tier],
    stakedAmount: state.stakedAmount.toString(),
    currentAPY,
    multiplier: tierConfig.multiplier,
    pendingRewards: totalPending.toString(),
    nextTier,
    toNextTier,
  };
}
