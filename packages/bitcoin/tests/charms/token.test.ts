/**
 * Token Tests
 *
 * Tests for $BABTC token configuration, reward calculation,
 * and spell generation.
 */

import { describe, it, expect } from "vitest";
import {
  BABTC_CONFIG,
  BABTC_METADATA,
  calculateBlockReward,
  calculateMiningReward,
  formatTokenAmount,
  parseTokenAmount,
  getCurrentEpoch,
  createTokenMintSpell,
  createTokenTransferSpell,
} from "../../src/charms/token";

// ============================================
// Configuration Tests
// ============================================

describe("BABTC_CONFIG", () => {
  it("should have correct ticker", () => {
    expect(BABTC_CONFIG.ticker).toBe("BABTC");
  });

  it("should have 8 decimals", () => {
    expect(BABTC_CONFIG.decimals).toBe(8);
  });

  it("should have max supply of 21 billion tokens", () => {
    const expectedMaxSupply = 21_000_000_000n * 100_000_000n;
    expect(BABTC_CONFIG.maxSupply).toBe(expectedMaxSupply);
  });

  it("should have app type as token (t)", () => {
    expect(BABTC_CONFIG.appType).toBe("t");
  });

  it("should have distribution percentages that sum to 100", () => {
    const { miner, dev, staking } = BABTC_CONFIG.distribution;
    expect(miner + dev + staking).toBe(100);
  });

  it("should have distribution of 90/5/5", () => {
    expect(BABTC_CONFIG.distribution.miner).toBe(90);
    expect(BABTC_CONFIG.distribution.dev).toBe(5);
    expect(BABTC_CONFIG.distribution.staking).toBe(5);
  });

  it("should have BRO-style reward configuration", () => {
    expect(BABTC_CONFIG.rewards).toBeDefined();
    expect(BABTC_CONFIG.rewards.baseReward).toBe(100_000_000n); // 1 BABTC
    expect(BABTC_CONFIG.rewards.minDifficulty).toBe(16);
    expect(BABTC_CONFIG.rewards.maxDifficulty).toBe(32);
    expect(BABTC_CONFIG.rewards.difficultyFactor).toBe(100n);
  });
});

describe("BABTC_METADATA", () => {
  it("should match config decimals", () => {
    expect(BABTC_METADATA.decimals).toBe(BABTC_CONFIG.decimals);
  });

  it("should match config ticker", () => {
    expect(BABTC_METADATA.ticker).toBe(BABTC_CONFIG.ticker);
  });

  it("should have supply limit of 21 billion", () => {
    expect(BABTC_METADATA.supply_limit).toBe(21_000_000_000);
  });
});

// ============================================
// Epoch & Reward Calculation Tests
// ============================================

describe("getCurrentEpoch (deprecated)", () => {
  // BRO-style has no epochs - this is kept for backwards compatibility
  it("should always return 0 (no epochs in BRO model)", () => {
    expect(getCurrentEpoch(0)).toBe(0);
    expect(getCurrentEpoch(209_999)).toBe(0);
    expect(getCurrentEpoch(210_000)).toBe(0);
    expect(getCurrentEpoch(2_100_000)).toBe(0);
  });
});

describe("calculateBlockReward (deprecated)", () => {
  // BRO-style uses difficulty-based rewards, not block height
  // This function is kept for backwards compatibility
  const baseReward = 100_000_000n; // 1 BABTC

  it("should return base reward (no halving in BRO model)", () => {
    expect(calculateBlockReward(0)).toBe(baseReward);
    expect(calculateBlockReward(209_999)).toBe(baseReward);
    expect(calculateBlockReward(210_000)).toBe(baseReward);
    expect(calculateBlockReward(2_100_000)).toBe(baseReward);
  });
});

describe("calculateMiningReward (BRO-style)", () => {
  // BRO formula: BASE_REWARD * D² / DIFFICULTY_FACTOR
  // BASE_REWARD = 1 BABTC = 100_000_000
  // DIFFICULTY_FACTOR = 100
  // MIN_DIFFICULTY = 16, MAX_DIFFICULTY = 32

  it("should return correct total reward at D16 (minimum)", () => {
    const reward = calculateMiningReward(16);
    // D16: 1 * 16² / 100 = 256 / 100 = 2.56 BABTC
    const expectedTotal = (100_000_000n * 256n) / 100n;

    expect(reward.total).toBe(expectedTotal);
  });

  it("should return correct total reward at D20", () => {
    const reward = calculateMiningReward(20);
    // D20: 1 * 20² / 100 = 400 / 100 = 4.00 BABTC
    const expectedTotal = (100_000_000n * 400n) / 100n;

    expect(reward.total).toBe(expectedTotal);
  });

  it("should return correct total reward at D32 (maximum)", () => {
    const reward = calculateMiningReward(32);
    // D32: 1 * 32² / 100 = 1024 / 100 = 10.24 BABTC
    const expectedTotal = (100_000_000n * 1024n) / 100n;

    expect(reward.total).toBe(expectedTotal);
  });

  it("should clamp difficulty below minimum to D16", () => {
    const reward = calculateMiningReward(10);
    const rewardAtMin = calculateMiningReward(16);

    expect(reward.total).toBe(rewardAtMin.total);
    expect(reward.difficulty).toBe(16);
  });

  it("should clamp difficulty above maximum to D32", () => {
    const reward = calculateMiningReward(40);
    const rewardAtMax = calculateMiningReward(32);

    expect(reward.total).toBe(rewardAtMax.total);
    expect(reward.difficulty).toBe(32);
  });

  it("should distribute 90% to miner", () => {
    const reward = calculateMiningReward(16);
    const expectedMinerShare =
      (reward.total * BigInt(BABTC_CONFIG.distribution.miner)) / 100n;

    expect(reward.minerShare).toBe(expectedMinerShare);
  });

  it("should distribute 5% to dev fund", () => {
    const reward = calculateMiningReward(16);
    const expectedDevShare =
      (reward.total * BigInt(BABTC_CONFIG.distribution.dev)) / 100n;

    expect(reward.devShare).toBe(expectedDevShare);
  });

  it("should distribute 5% to staking pool", () => {
    const reward = calculateMiningReward(16);
    const expectedStakingShare =
      (reward.total * BigInt(BABTC_CONFIG.distribution.staking)) / 100n;

    expect(reward.stakingShare).toBe(expectedStakingShare);
  });

  it("should have shares that sum to total", () => {
    const reward = calculateMiningReward(16);
    const sharesSum = reward.minerShare + reward.devShare + reward.stakingShare;

    expect(sharesSum).toBe(reward.total);
  });

  it("should include correct leadingZeros field", () => {
    expect(calculateMiningReward(16).leadingZeros).toBe(16);
    expect(calculateMiningReward(20).leadingZeros).toBe(20);
    expect(calculateMiningReward(24).leadingZeros).toBe(24);
  });

  it("should include correct difficulty field", () => {
    expect(calculateMiningReward(16).difficulty).toBe(16);
    expect(calculateMiningReward(22).difficulty).toBe(22);
  });

  it("should increase reward quadratically with difficulty", () => {
    const rewardD16 = calculateMiningReward(16);
    const rewardD20 = calculateMiningReward(20);
    const rewardD24 = calculateMiningReward(24);

    // D20 > D16
    expect(rewardD20.total).toBeGreaterThan(rewardD16.total);
    // D24 > D20
    expect(rewardD24.total).toBeGreaterThan(rewardD20.total);

    // Verify quadratic relationship: reward ∝ D²
    // ratio should be (20/16)² = 1.5625 and (24/20)² = 1.44
    const ratio1 = Number(rewardD20.total) / Number(rewardD16.total);
    const ratio2 = Number(rewardD24.total) / Number(rewardD20.total);

    expect(ratio1).toBeCloseTo(400 / 256, 2); // 1.5625
    expect(ratio2).toBeCloseTo(576 / 400, 2); // 1.44
  });
});

// ============================================
// Token Amount Formatting Tests
// ============================================

describe("formatTokenAmount", () => {
  it("should format 1 BABTC correctly", () => {
    const oneToken = 100_000_000n;
    expect(formatTokenAmount(oneToken)).toBe("1.00");
  });

  it("should format 0.5 BABTC correctly", () => {
    const halfToken = 50_000_000n;
    expect(formatTokenAmount(halfToken)).toBe("0.50");
  });

  it("should format zero correctly", () => {
    expect(formatTokenAmount(0n)).toBe("0.00");
  });

  it("should format small amounts correctly", () => {
    const oneSat = 1n;
    expect(formatTokenAmount(oneSat)).toBe("0.00000001");
  });

  it("should format large amounts correctly", () => {
    const million = 1_000_000n * 100_000_000n;
    expect(formatTokenAmount(million)).toBe("1000000.00");
  });

  it("should remove trailing zeros but keep at least 2 decimal places", () => {
    const amount = 123_456_000n; // 1.23456 BABTC
    expect(formatTokenAmount(amount)).toBe("1.23456");
  });

  it("should handle custom decimals", () => {
    const amount = 1000n;
    expect(formatTokenAmount(amount, 2)).toBe("10.00");
  });
});

describe("parseTokenAmount", () => {
  it("should parse 1 BABTC correctly", () => {
    expect(parseTokenAmount("1")).toBe(100_000_000n);
  });

  it("should parse decimal amounts correctly", () => {
    expect(parseTokenAmount("1.5")).toBe(150_000_000n);
  });

  it("should parse small amounts correctly", () => {
    expect(parseTokenAmount("0.00000001")).toBe(1n);
  });

  it("should parse zero correctly", () => {
    expect(parseTokenAmount("0")).toBe(0n);
  });

  it("should handle partial decimals", () => {
    expect(parseTokenAmount("1.5")).toBe(150_000_000n);
    expect(parseTokenAmount("1.05")).toBe(105_000_000n);
  });

  it("should truncate extra decimals", () => {
    // More than 8 decimal places should truncate
    expect(parseTokenAmount("1.123456789")).toBe(112_345_678n);
  });

  it("should handle custom decimals", () => {
    expect(parseTokenAmount("10", 2)).toBe(1000n);
  });

  it("should roundtrip with formatTokenAmount", () => {
    const original = 12345678n;
    const formatted = formatTokenAmount(original);
    const parsed = parseTokenAmount(formatted);

    // Should be close (may differ due to trailing zero handling)
    expect(parsed).toBe(original);
  });
});

// ============================================
// Spell Generation Tests
// ============================================

describe("createTokenMintSpell", () => {
  const defaultParams = {
    appId: "test_app_id",
    appVk: "test_vk",
    minerAddress: "tb1qminer_address",
    devAddress: "tb1qdev_address",
    stakingAddress: "tb1qstaking_address",
    leadingZeros: 16, // D16 minimum difficulty
    workProofHash: "abc123hash",
  };

  it("should create spell with version 2", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include app reference in correct format", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `t/${defaultParams.appId}/${defaultParams.appVk}`,
    );
  });

  it("should have empty inputs (mint from nothing)", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.ins).toHaveLength(0);
  });

  it("should have three outputs (miner, dev, staking)", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.outs).toHaveLength(3);
  });

  it("should have correct addresses in outputs", () => {
    const spell = createTokenMintSpell(defaultParams);

    expect(spell.outs[0].address).toBe(defaultParams.minerAddress);
    expect(spell.outs[1].address).toBe(defaultParams.devAddress);
    expect(spell.outs[2].address).toBe(defaultParams.stakingAddress);
  });

  it("should have dust limit (546 sats) for each output", () => {
    const spell = createTokenMintSpell(defaultParams);

    for (const out of spell.outs) {
      expect(out.sats).toBe(546);
    }
  });

  it("should include work proof hash in public inputs", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.public_inputs?.work_proof).toBe(defaultParams.workProofHash);
  });

  it("should include difficulty in public inputs", () => {
    const spell = createTokenMintSpell(defaultParams);
    expect(spell.public_inputs?.difficulty).toBe(defaultParams.leadingZeros);
  });

  it("should distribute tokens according to config percentages", () => {
    const spell = createTokenMintSpell(defaultParams);
    const reward = calculateMiningReward(defaultParams.leadingZeros);

    expect(spell.outs[0].charms.$00).toBe(Number(reward.minerShare));
    expect(spell.outs[1].charms.$00).toBe(Number(reward.devShare));
    expect(spell.outs[2].charms.$00).toBe(Number(reward.stakingShare));
  });
});

describe("createTokenTransferSpell", () => {
  const defaultParams = {
    appId: "test_app_id",
    appVk: "test_vk",
    fromUtxo: { txid: "abc123", vout: 0 },
    fromAmount: 1000n,
    toAddress: "tb1qrecipient",
    toAmount: 600n,
    changeAddress: "tb1qchange",
  };

  it("should create spell with version 2", () => {
    const spell = createTokenTransferSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include app reference in correct format", () => {
    const spell = createTokenTransferSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `t/${defaultParams.appId}/${defaultParams.appVk}`,
    );
  });

  it("should have one input referencing the UTXO", () => {
    const spell = createTokenTransferSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.fromUtxo.txid}:${defaultParams.fromUtxo.vout}`,
    );
  });

  it("should include input charm amount", () => {
    const spell = createTokenTransferSpell(defaultParams);
    expect(spell.ins[0].charms.$00).toBe(Number(defaultParams.fromAmount));
  });

  it("should create recipient output with correct amount", () => {
    const spell = createTokenTransferSpell(defaultParams);
    expect(spell.outs[0].address).toBe(defaultParams.toAddress);
    expect(spell.outs[0].charms.$00).toBe(Number(defaultParams.toAmount));
  });

  it("should create change output when there is change", () => {
    const spell = createTokenTransferSpell(defaultParams);
    const expectedChange = defaultParams.fromAmount - defaultParams.toAmount;

    expect(spell.outs).toHaveLength(2);
    expect(spell.outs[1].address).toBe(defaultParams.changeAddress);
    expect(spell.outs[1].charms.$00).toBe(Number(expectedChange));
  });

  it("should not create change output when exact amount", () => {
    const exactParams = {
      ...defaultParams,
      toAmount: defaultParams.fromAmount, // Send all
    };
    const spell = createTokenTransferSpell(exactParams);

    expect(spell.outs).toHaveLength(1);
    expect(spell.outs[0].address).toBe(exactParams.toAddress);
  });

  it("should have dust limit for all outputs", () => {
    const spell = createTokenTransferSpell(defaultParams);

    for (const out of spell.outs) {
      expect(out.sats).toBe(546);
    }
  });
});
