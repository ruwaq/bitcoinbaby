/**
 * Tokenomics Tests
 *
 * Tests for the BitcoinBaby token economics system:
 * - Reward calculation
 * - Distribution splits (player/dev/community)
 * - Staking tiers and rewards
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TOKEN_DISTRIBUTION,
  STAKING_CONFIG,
  STAKING_TIERS,
  calculateDistribution,
  getStakingTier,
  calculateStakingRewards,
  createStakingState,
  stakeTokens,
  unstakeTokens,
  claimRewards,
  getStakingSummary,
  type StakingState,
} from "../src/game";

// ============================================
// Token Distribution Tests
// ============================================

describe("TOKEN_DISTRIBUTION", () => {
  it("should have distribution percentages that sum to 100", () => {
    const total =
      TOKEN_DISTRIBUTION.PLAYER_SHARE +
      TOKEN_DISTRIBUTION.DEV_FUND_SHARE +
      TOKEN_DISTRIBUTION.COMMUNITY_SHARE;

    expect(total).toBe(100);
  });

  it("should have player share as the largest portion", () => {
    expect(TOKEN_DISTRIBUTION.PLAYER_SHARE).toBeGreaterThan(
      TOKEN_DISTRIBUTION.DEV_FUND_SHARE,
    );
    expect(TOKEN_DISTRIBUTION.PLAYER_SHARE).toBeGreaterThan(
      TOKEN_DISTRIBUTION.COMMUNITY_SHARE,
    );
  });
});

describe("calculateDistribution", () => {
  it("should distribute 100 tokens correctly with baby_1 stage", () => {
    const result = calculateDistribution(BigInt(100), "baby_1");

    // Player: 90% * 1.0 bonus = 90
    expect(result.playerAmount).toBe(BigInt(90));
    // Dev: 5%
    expect(result.devFundAmount).toBe(BigInt(5));
    // Community: 5%
    expect(result.communityAmount).toBe(BigInt(5));
  });

  it("should apply stage bonus to player share", () => {
    const babyResult = calculateDistribution(BigInt(1000), "baby_1");
    const adultResult = calculateDistribution(BigInt(1000), "adult_1");

    // Adult should get more due to higher mining bonus (1.35x vs 1.0x)
    expect(adultResult.playerAmount).toBeGreaterThan(babyResult.playerAmount);
    // Dev and community get LESS because player takes more from the fixed pool
    // Total always equals input, so more for player = less for others
    expect(adultResult.devFundAmount).toBeLessThan(babyResult.devFundAmount);
    expect(adultResult.communityAmount).toBeLessThan(
      babyResult.communityAmount,
    );
  });

  it("should handle large token amounts", () => {
    const largeAmount = BigInt(1_000_000_000);
    const result = calculateDistribution(largeAmount, "baby_1");

    // 90% of 1 billion = 900 million
    expect(result.playerAmount).toBe(BigInt(900_000_000));
    expect(result.devFundAmount).toBe(BigInt(50_000_000));
    expect(result.communityAmount).toBe(BigInt(50_000_000));
  });

  it("should return 0 for player amount with egg stage", () => {
    const result = calculateDistribution(BigInt(1000), "egg");

    // Egg stage has 0 mining bonus
    expect(result.playerAmount).toBe(BigInt(0));
    // All tokens go to dev and community proportionally (5:5 ratio = 1:1)
    // remaining = 1000, dev = 1000 * 5/10 = 500, community = 500
    expect(result.devFundAmount).toBe(BigInt(500));
    expect(result.communityAmount).toBe(BigInt(500));
    // Total still equals input
    expect(result.totalAmount).toBe(BigInt(1000));
  });

  it("should max player rewards for legend stage", () => {
    const babyResult = calculateDistribution(BigInt(1000), "baby_1");
    const legendResult = calculateDistribution(BigInt(1000), "legend");

    // Legend bonus is 2.0x vs baby 1.0x
    // baby: 1000 * 90% * 1.0 = 900
    // legend: 1000 * 90% * 2.0 = 1800, but CLAMPED to totalTokens (1000)
    expect(babyResult.playerAmount).toBe(BigInt(900));
    expect(legendResult.playerAmount).toBe(BigInt(1000)); // Clamped to max
    // Legend gets everything, dev and community get 0
    expect(legendResult.devFundAmount).toBe(BigInt(0));
    expect(legendResult.communityAmount).toBe(BigInt(0));
  });

  it("should calculate total amount correctly", () => {
    const result = calculateDistribution(BigInt(1000), "baby_1");

    expect(result.totalAmount).toBe(
      result.playerAmount + result.devFundAmount + result.communityAmount,
    );
  });
});

// ============================================
// Staking Tier Tests
// ============================================

describe("STAKING_TIERS", () => {
  it("should have bronze as the lowest tier", () => {
    expect(STAKING_TIERS.bronze.minAmount).toBe(100);
  });

  it("should have increasing min amounts for each tier", () => {
    expect(STAKING_TIERS.silver.minAmount).toBeGreaterThan(
      STAKING_TIERS.bronze.minAmount,
    );
    expect(STAKING_TIERS.gold.minAmount).toBeGreaterThan(
      STAKING_TIERS.silver.minAmount,
    );
    expect(STAKING_TIERS.diamond.minAmount).toBeGreaterThan(
      STAKING_TIERS.gold.minAmount,
    );
  });

  it("should have increasing APY for each tier", () => {
    expect(STAKING_TIERS.silver.apy).toBeGreaterThan(STAKING_TIERS.bronze.apy);
    expect(STAKING_TIERS.gold.apy).toBeGreaterThan(STAKING_TIERS.silver.apy);
    expect(STAKING_TIERS.diamond.apy).toBeGreaterThan(STAKING_TIERS.gold.apy);
  });

  it("should have increasing multipliers for each tier", () => {
    expect(STAKING_TIERS.silver.multiplier).toBeGreaterThan(
      STAKING_TIERS.bronze.multiplier,
    );
    expect(STAKING_TIERS.gold.multiplier).toBeGreaterThan(
      STAKING_TIERS.silver.multiplier,
    );
    expect(STAKING_TIERS.diamond.multiplier).toBeGreaterThan(
      STAKING_TIERS.gold.multiplier,
    );
  });
});

describe("getStakingTier", () => {
  it("should return bronze for amounts below silver threshold", () => {
    expect(getStakingTier(BigInt(100))).toBe("bronze");
    expect(getStakingTier(BigInt(500))).toBe("bronze");
    expect(getStakingTier(BigInt(999))).toBe("bronze");
  });

  it("should return silver for amounts at silver threshold", () => {
    expect(getStakingTier(BigInt(1000))).toBe("silver");
    expect(getStakingTier(BigInt(5000))).toBe("silver");
    expect(getStakingTier(BigInt(9999))).toBe("silver");
  });

  it("should return gold for amounts at gold threshold", () => {
    expect(getStakingTier(BigInt(10_000))).toBe("gold");
    expect(getStakingTier(BigInt(50_000))).toBe("gold");
    expect(getStakingTier(BigInt(99_999))).toBe("gold");
  });

  it("should return diamond for amounts at diamond threshold", () => {
    expect(getStakingTier(BigInt(100_000))).toBe("diamond");
    expect(getStakingTier(BigInt(1_000_000))).toBe("diamond");
  });

  it("should return bronze for amounts below minimum", () => {
    expect(getStakingTier(BigInt(0))).toBe("bronze");
    expect(getStakingTier(BigInt(50))).toBe("bronze");
  });
});

// ============================================
// Staking Rewards Tests
// ============================================

describe("calculateStakingRewards", () => {
  const oneYear = 365.25 * 24 * 60 * 60 * 1000; // milliseconds

  it("should return 0 for amounts below minimum stake", () => {
    const rewards = calculateStakingRewards(
      BigInt(50),
      "bronze",
      oneYear,
      false,
    );
    expect(rewards).toBe(BigInt(0));
  });

  it("should calculate correct rewards for bronze tier", () => {
    // 1000 tokens at 5% APY with 1.0 multiplier = 50 tokens/year
    const rewards = calculateStakingRewards(
      BigInt(1000),
      "bronze",
      oneYear,
      false,
    );

    // 5% of 1000 * 1.0 multiplier = 50
    expect(rewards).toBe(BigInt(50));
  });

  it("should apply tier multiplier to rewards", () => {
    const bronzeRewards = calculateStakingRewards(
      BigInt(10_000),
      "bronze",
      oneYear,
      false,
    );
    const goldRewards = calculateStakingRewards(
      BigInt(10_000),
      "gold",
      oneYear,
      false,
    );

    // Gold has higher APY and multiplier
    expect(goldRewards).toBeGreaterThan(bronzeRewards);
  });

  it("should add active player bonus to APY", () => {
    const passiveRewards = calculateStakingRewards(
      BigInt(10_000),
      "gold",
      oneYear,
      false,
    );
    const activeRewards = calculateStakingRewards(
      BigInt(10_000),
      "gold",
      oneYear,
      true,
    );

    // Active players get ACTIVE_PLAYER_BONUS_APY extra
    expect(activeRewards).toBeGreaterThan(passiveRewards);
  });

  it("should calculate proportional rewards for shorter durations", () => {
    const oneMonth = oneYear / 12;
    const yearRewards = calculateStakingRewards(
      BigInt(12_000),
      "bronze",
      oneYear,
      false,
    );
    const monthRewards = calculateStakingRewards(
      BigInt(12_000),
      "bronze",
      oneMonth,
      false,
    );

    // Monthly rewards should be approximately 1/12 of yearly
    expect(Number(monthRewards)).toBeCloseTo(Number(yearRewards) / 12, 0);
  });

  it("should handle very short durations", () => {
    const oneHour = 60 * 60 * 1000;
    const rewards = calculateStakingRewards(
      BigInt(100_000),
      "diamond",
      oneHour,
      false,
    );

    // Should still calculate some rewards
    expect(rewards).toBeGreaterThanOrEqual(BigInt(0));
  });
});

// ============================================
// Staking State Management Tests
// ============================================

describe("createStakingState", () => {
  it("should create state with zero staked amount", () => {
    const state = createStakingState();
    expect(state.stakedAmount).toBe(BigInt(0));
  });

  it("should create state with bronze tier", () => {
    const state = createStakingState();
    expect(state.tier).toBe("bronze");
  });

  it("should create inactive state", () => {
    const state = createStakingState();
    expect(state.isActive).toBe(false);
  });

  it("should have zero pending rewards", () => {
    const state = createStakingState();
    expect(state.pendingRewards).toBe(BigInt(0));
  });
});

describe("stakeTokens", () => {
  let initialState: StakingState;

  beforeEach(() => {
    initialState = createStakingState();
  });

  it("should fail when amount is below minimum", () => {
    const result = stakeTokens(initialState, BigInt(50), BigInt(1000));

    expect(result.success).toBe(false);
    expect(result.error).toContain("Minimum stake");
  });

  it("should fail when balance is insufficient", () => {
    const result = stakeTokens(initialState, BigInt(500), BigInt(100));

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient balance");
  });

  it("should successfully stake tokens", () => {
    const result = stakeTokens(initialState, BigInt(1000), BigInt(10_000));

    expect(result.success).toBe(true);
    expect(result.state.stakedAmount).toBe(BigInt(1000));
    expect(result.state.isActive).toBe(true);
  });

  it("should update tier when staking more", () => {
    // First stake to bronze
    const firstStake = stakeTokens(initialState, BigInt(500), BigInt(50_000));
    expect(firstStake.state.tier).toBe("bronze");

    // Second stake to reach silver
    const secondStake = stakeTokens(
      firstStake.state,
      BigInt(600),
      BigInt(50_000),
    );
    expect(secondStake.state.tier).toBe("silver");
    expect(secondStake.state.stakedAmount).toBe(BigInt(1100));
  });

  it("should accumulate staked amounts", () => {
    const first = stakeTokens(initialState, BigInt(200), BigInt(10_000));
    const second = stakeTokens(first.state, BigInt(300), BigInt(10_000));

    expect(second.state.stakedAmount).toBe(BigInt(500));
  });

  it("should set stakedAt timestamp on first stake", () => {
    const before = Date.now();
    const result = stakeTokens(initialState, BigInt(500), BigInt(10_000));
    const after = Date.now();

    expect(result.state.stakedAt).toBeGreaterThanOrEqual(before);
    expect(result.state.stakedAt).toBeLessThanOrEqual(after);
  });

  it("should not update stakedAt on subsequent stakes", () => {
    const first = stakeTokens(initialState, BigInt(500), BigInt(10_000));
    const originalStakedAt = first.state.stakedAt;

    // Wait a tiny bit
    const second = stakeTokens(first.state, BigInt(500), BigInt(10_000));

    expect(second.state.stakedAt).toBe(originalStakedAt);
  });
});

describe("unstakeTokens", () => {
  it("should fail when trying to unstake more than staked", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(500),
      isActive: true,
    };

    const result = unstakeTokens(state, BigInt(1000), false);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot unstake more");
  });

  it("should successfully unstake tokens", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(1000),
      isActive: true,
      lastRewardCalculation: Date.now() - 1000,
    };

    const result = unstakeTokens(state, BigInt(500), false);

    expect(result.success).toBe(true);
    expect(result.state.stakedAmount).toBe(BigInt(500));
  });

  it("should calculate and return pending rewards", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now() - oneDay,
    };

    const result = unstakeTokens(state, BigInt(5000), false);

    expect(result.success).toBe(true);
    expect(result.rewards).toBeGreaterThan(BigInt(0));
  });

  it("should update tier when unstaking reduces amount", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const result = unstakeTokens(state, BigInt(9500), false);

    expect(result.state.tier).toBe("bronze"); // Only 500 left
  });

  it("should set isActive to false when below minimum", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(200),
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const result = unstakeTokens(state, BigInt(150), false);

    // 50 remaining is below MIN_STAKE_AMOUNT (100)
    expect(result.state.isActive).toBe(false);
  });

  it("should clear pending rewards after unstaking", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(1000),
      pendingRewards: BigInt(100),
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const result = unstakeTokens(state, BigInt(500), false);

    expect(result.state.pendingRewards).toBe(BigInt(0));
  });
});

describe("claimRewards", () => {
  it("should calculate and return accumulated rewards", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now() - oneDay,
    };

    const result = claimRewards(state, false);

    expect(result.rewards).toBeGreaterThan(BigInt(0));
  });

  it("should add pending rewards to claimed amount", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      pendingRewards: BigInt(500),
      lastRewardCalculation: Date.now(), // No time elapsed
    };

    const result = claimRewards(state, false);

    expect(result.rewards).toBe(BigInt(500));
  });

  it("should clear pending rewards after claiming", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(1000),
      pendingRewards: BigInt(100),
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const result = claimRewards(state, false);

    expect(result.state.pendingRewards).toBe(BigInt(0));
  });

  it("should update lastRewardCalculation timestamp", () => {
    const oldTime = Date.now() - 60000;
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(1000),
      isActive: true,
      lastRewardCalculation: oldTime,
    };

    const before = Date.now();
    const result = claimRewards(state, false);
    const after = Date.now();

    expect(result.state.lastRewardCalculation).toBeGreaterThanOrEqual(before);
    expect(result.state.lastRewardCalculation).toBeLessThanOrEqual(after);
  });

  it("should include active player bonus in rewards", () => {
    const oneYear = 365.25 * 24 * 60 * 60 * 1000;
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now() - oneYear,
    };

    const passiveResult = claimRewards(state, false);
    const activeResult = claimRewards(state, true);

    expect(activeResult.rewards).toBeGreaterThan(passiveResult.rewards);
  });
});

// ============================================
// Staking Summary Tests
// ============================================

describe("getStakingSummary", () => {
  it("should return correct tier name in Spanish", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const summary = getStakingSummary(state, false);

    expect(summary.tierName).toBe("Oro");
  });

  it("should calculate current APY correctly", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const passiveSummary = getStakingSummary(state, false);
    const activeSummary = getStakingSummary(state, true);

    expect(passiveSummary.currentAPY).toBe(STAKING_TIERS.gold.apy);
    expect(activeSummary.currentAPY).toBe(
      STAKING_TIERS.gold.apy + STAKING_CONFIG.ACTIVE_PLAYER_BONUS_APY,
    );
  });

  it("should show correct multiplier for tier", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(100_000),
      tier: "diamond",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const summary = getStakingSummary(state, false);

    expect(summary.multiplier).toBe(STAKING_TIERS.diamond.multiplier);
  });

  it("should calculate amount to next tier", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(500),
      tier: "bronze",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const summary = getStakingSummary(state, false);

    // Silver requires 1000, we have 500
    expect(summary.toNextTier).toBe("500");
    expect(summary.nextTier).toBe("silver");
  });

  it("should return null nextTier for diamond", () => {
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(100_000),
      tier: "diamond",
      isActive: true,
      lastRewardCalculation: Date.now(),
    };

    const summary = getStakingSummary(state, false);

    expect(summary.nextTier).toBeNull();
    expect(summary.toNextTier).toBe("0");
  });

  it("should include pending rewards in summary", () => {
    const oneDay = 24 * 60 * 60 * 1000;
    const state: StakingState = {
      ...createStakingState(),
      stakedAmount: BigInt(10_000),
      tier: "gold",
      pendingRewards: BigInt(100),
      isActive: true,
      lastRewardCalculation: Date.now() - oneDay,
    };

    const summary = getStakingSummary(state, false);

    // Should include both stored pending rewards and newly calculated
    expect(BigInt(summary.pendingRewards)).toBeGreaterThan(BigInt(100));
  });
});
