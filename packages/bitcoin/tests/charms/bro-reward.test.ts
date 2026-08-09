/**
 * Canonical BRO reward formula tests.
 *
 * These tests pin the SINGLE source of truth for off-chain reward math:
 *   mined_amount_bro = DENOMINATION · clz² / 2^halvings
 *
 * merkle.ts's calculateMiningReward delegates here, and token.ts exposes a
 * canonical variant (calculateMiningRewardBro) that also delegates here.
 * The legacy token.ts calculateMiningReward (v1-contract-locked, /100, no
 * halving) is intentionally NOT tested here — see token.test.ts.
 */

import { describe, it, expect } from "vitest";
import {
  minedAmountBro,
  BRO_DENOMINATION,
  SPARK_START_TIME,
  BRO_HALVING_PERIOD_SECONDS,
} from "../../src/charms/bro-reward";
import { calculateMiningRewardBro, SPARK_CONFIG } from "../../src/charms/token";
import { calculateMiningReward as calculateMiningRewardMerkle } from "../../src/blockchain/merkle";

describe("minedAmountBro (canonical BRO reward)", () => {
  it("D16 @ period 0 = 256 BABTC (25_600_000_000 base units)", () => {
    // 1e8 * 16^2 / 2^0 = 100_000_000 * 256 = 25_600_000_000
    expect(minedAmountBro(16, SPARK_START_TIME)).toBe(25_600_000_000n);
  });

  it("halves after one halving period", () => {
    const period0 = minedAmountBro(16, SPARK_START_TIME);
    const period1 = minedAmountBro(
      16,
      SPARK_START_TIME + BRO_HALVING_PERIOD_SECONDS,
    );
    expect(period1).toBe(period0 / 2n);
    expect(period1).toBe(12_800_000_000n);
  });

  it("quarters after two halving periods", () => {
    const period0 = minedAmountBro(16, SPARK_START_TIME);
    const period2 = minedAmountBro(
      16,
      SPARK_START_TIME + 2 * BRO_HALVING_PERIOD_SECONDS,
    );
    expect(period2).toBe(period0 / 4n);
    expect(period2).toBe(6_400_000_000n);
  });

  it("clz=0 yields 0 reward", () => {
    expect(minedAmountBro(0, SPARK_START_TIME)).toBe(0n);
  });

  it("D32 @ period 0 = 1e8 * 1024 (clz^2 = 1024)", () => {
    expect(minedAmountBro(32, SPARK_START_TIME)).toBe(
      BRO_DENOMINATION * 1024n, // 102_400_000_000n
    );
  });

  it("scales quadratically with clz at the same period", () => {
    // reward(D20) / reward(D16) == (20/16)^2 == 400/256
    const r16 = minedAmountBro(16, SPARK_START_TIME);
    const r20 = minedAmountBro(20, SPARK_START_TIME);
    const ratio = Number(r20) / Number(r16);
    expect(ratio).toBeCloseTo(400 / 256, 5);
  });

  it("clamps blockTime below START_TIME to START_TIME (no negative halvings)", () => {
    const before = minedAmountBro(16, SPARK_START_TIME - 1_000_000);
    const atGenesis = minedAmountBro(16, SPARK_START_TIME);
    expect(before).toBe(atGenesis);
    expect(before).toBe(25_600_000_000n);
  });

  it("clamps negative clz to 0", () => {
    expect(minedAmountBro(-5, SPARK_START_TIME)).toBe(0n);
  });

  it("never throws on extreme inputs (overflow safety)", () => {
    // Absurdly large clz + far-future time must still return a finite bigint,
    // not throw. Periods are capped at MAX_HALVING_PERIODS (63) so 2^n never
    // overflows the bigint arithmetic meaningfully; the result is simply huge.
    const farFuture = SPARK_START_TIME + 1000 * BRO_HALVING_PERIOD_SECONDS;
    const huge = minedAmountBro(1_000_000, farFuture);
    expect(typeof huge).toBe("bigint");
    expect(huge > 0n).toBe(true);
  });

  it("saturates the halving factor at the cap (rewards stop halving past 63 periods)", () => {
    // At/above the cap the divisor no longer doubles, so reward stabilizes.
    const atCap = minedAmountBro(
      16,
      SPARK_START_TIME + 63 * BRO_HALVING_PERIOD_SECONDS,
    );
    const pastCap = minedAmountBro(
      16,
      SPARK_START_TIME + 100 * BRO_HALVING_PERIOD_SECONDS,
    );
    expect(atCap).toBe(pastCap);
  });
});

describe("merkle.ts calculateMiningReward delegates to canonical", () => {
  // The legacy 4-arg signature passes startTime through, so feeding
  // SPARK_START_TIME must reproduce minedAmountBro exactly.
  it("matches minedAmountBro when startTime == SPARK_START_TIME", () => {
    const viaMerkle = calculateMiningRewardMerkle(
      16,
      SPARK_START_TIME,
      SPARK_START_TIME,
      BRO_HALVING_PERIOD_SECONDS,
    );
    expect(viaMerkle).toBe(minedAmountBro(16, SPARK_START_TIME));
    expect(viaMerkle).toBe(25_600_000_000n);
  });

  it("honors a custom startTime (backwards-compat with merkle.test.ts)", () => {
    // merkle.test.ts uses BASE_TIME = 1700000000; delegation must preserve that.
    const BASE_TIME = 1_700_000_000;
    const r0 = calculateMiningRewardMerkle(
      16,
      BASE_TIME,
      BASE_TIME,
      BRO_HALVING_PERIOD_SECONDS,
    );
    const r1 = calculateMiningRewardMerkle(
      16,
      BASE_TIME + BRO_HALVING_PERIOD_SECONDS,
      BASE_TIME,
      BRO_HALVING_PERIOD_SECONDS,
    );
    expect(r0).toBe(25_600_000_000n);
    expect(r1).toBe(r0 / 2n);
  });
});

describe("token.ts calculateMiningRewardBro (canonical variant)", () => {
  it("uses canonical BRO total (NOT the legacy /100 value)", () => {
    // Sanity: canonical D16 @ genesis = 256 BABTC, vs legacy = 2.56 BABTC.
    const canonical = calculateMiningRewardBro(16, SPARK_START_TIME);
    expect(canonical.total).toBe(25_600_000_000n);
    expect(canonical.total).toBe(BRO_DENOMINATION * 256n);
  });

  it("clamps difficulty to the SPARK range (D16..D32)", () => {
    const below = calculateMiningRewardBro(5, SPARK_START_TIME);
    const above = calculateMiningRewardBro(99, SPARK_START_TIME);
    expect(below.difficulty).toBe(SPARK_CONFIG.rewards.minDifficulty);
    expect(above.difficulty).toBe(SPARK_CONFIG.rewards.maxDifficulty);
    expect(below.total).toBe(
      calculateMiningRewardBro(
        SPARK_CONFIG.rewards.minDifficulty,
        SPARK_START_TIME,
      ).total,
    );
  });

  it("applies the 90/5/5 distribution and sums to total", () => {
    const r = calculateMiningRewardBro(20, SPARK_START_TIME);
    expect(r.minerShare + r.devShare + r.stakingShare).toBe(r.total);
    expect(r.minerShare).toBe((r.total * 90n) / 100n);
    expect(r.devShare).toBe((r.total * 5n) / 100n);
    expect(r.stakingShare).toBe((r.total * 5n) / 100n);
  });

  it("halves the total after one period", () => {
    const p0 = calculateMiningRewardBro(16, SPARK_START_TIME).total;
    const p1 = calculateMiningRewardBro(
      16,
      SPARK_START_TIME + BRO_HALVING_PERIOD_SECONDS,
    ).total;
    expect(p1).toBe(p0 / 2n);
  });
});
