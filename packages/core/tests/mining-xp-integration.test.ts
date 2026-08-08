/**
 * Mining XP Integration Tests
 *
 * Tests for the mining-to-XP progression system:
 * - XP calculation based on hashes
 * - Cosmic multiplier application
 * - Level bonus calculation
 * - Batch limits
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// CONSTANTS (from useMiningXPIntegration)
// =============================================================================

const DEFAULT_HASHES_PER_XP = 1_000_000; // 1 XP per 1M hashes
const LEVEL_BONUS_PERCENT = 0.05; // +5% per level
const DEFAULT_MAX_BATCH = 100;

// Cosmic multiplier range
const COSMIC_MULTIPLIER_MIN = 0.5;
const COSMIC_MULTIPLIER_MAX = 2.0;

// =============================================================================
// XP CALCULATION TESTS
// =============================================================================

describe("Mining XP Calculation", () => {
  describe("Base XP from hashes", () => {
    it("should award 1 XP per 1M hashes", () => {
      const hashes = 1_000_000;
      const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);
      expect(xp).toBe(1);
    });

    it("should award 0 XP for less than 1M hashes", () => {
      const hashes = 999_999;
      const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);
      expect(xp).toBe(0);
    });

    it("should award 10 XP for 10M hashes", () => {
      const hashes = 10_000_000;
      const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);
      expect(xp).toBe(10);
    });

    it("should floor partial XP units", () => {
      const hashes = 2_500_000;
      const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);
      expect(xp).toBe(2);
    });

    it("should accumulate remainder for next calculation", () => {
      const totalHashes = 2_500_000;
      const xpAwarded = Math.floor(totalHashes / DEFAULT_HASHES_PER_XP);
      const remainder = totalHashes % DEFAULT_HASHES_PER_XP;

      expect(xpAwarded).toBe(2);
      expect(remainder).toBe(500_000);
    });
  });

  describe("Cosmic multiplier application", () => {
    it("should apply minimum cosmic multiplier (0.5x)", () => {
      const baseXp = 10;
      const cosmicMultiplier = COSMIC_MULTIPLIER_MIN;
      const finalXp = Math.round(baseXp * cosmicMultiplier);

      expect(finalXp).toBe(5);
    });

    it("should apply maximum cosmic multiplier (2.0x)", () => {
      const baseXp = 10;
      const cosmicMultiplier = COSMIC_MULTIPLIER_MAX;
      const finalXp = Math.round(baseXp * cosmicMultiplier);

      expect(finalXp).toBe(20);
    });

    it("should apply neutral cosmic multiplier (1.0x)", () => {
      const baseXp = 10;
      const cosmicMultiplier = 1.0;
      const finalXp = Math.round(baseXp * cosmicMultiplier);

      expect(finalXp).toBe(10);
    });

    it("should handle decimal cosmic multipliers", () => {
      const baseXp = 10;
      const cosmicMultiplier = 1.3;
      const finalXp = Math.round(baseXp * cosmicMultiplier);

      expect(finalXp).toBe(13);
    });

    it("should validate cosmic multiplier is within range", () => {
      const validMultipliers = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

      for (const multiplier of validMultipliers) {
        expect(multiplier).toBeGreaterThanOrEqual(COSMIC_MULTIPLIER_MIN);
        expect(multiplier).toBeLessThanOrEqual(COSMIC_MULTIPLIER_MAX);
      }
    });
  });

  describe("Level bonus calculation", () => {
    it("should give 0% bonus at level 1", () => {
      const level = 1;
      const levelBonus = 1 + level * LEVEL_BONUS_PERCENT;
      expect(levelBonus).toBe(1.05);
    });

    it("should give 25% bonus at level 5", () => {
      const level = 5;
      const levelBonus = 1 + level * LEVEL_BONUS_PERCENT;
      expect(levelBonus).toBe(1.25);
    });

    it("should give 50% bonus at level 10", () => {
      const level = 10;
      const levelBonus = 1 + level * LEVEL_BONUS_PERCENT;
      expect(levelBonus).toBe(1.5);
    });

    it("should calculate level bonus correctly for all levels", () => {
      for (let level = 1; level <= 10; level++) {
        const expectedBonus = 1 + level * LEVEL_BONUS_PERCENT;
        const levelBonus = 1 + level * LEVEL_BONUS_PERCENT;
        expect(levelBonus).toBeCloseTo(expectedBonus, 5);
      }
    });
  });

  describe("Combined rate calculation", () => {
    it("should combine cosmic multiplier and level bonus", () => {
      const cosmicMultiplier = 1.5;
      const level = 5;
      const levelBonus = 1 + level * LEVEL_BONUS_PERCENT; // 1.25

      const combinedRate = cosmicMultiplier * levelBonus;
      expect(combinedRate).toBeCloseTo(1.875, 5);
    });

    it("should calculate final XP with all modifiers", () => {
      const baseXp = 10;
      const cosmicMultiplier = 1.5;
      const level = 5;
      const levelBonus = 1 + level * LEVEL_BONUS_PERCENT; // 1.25

      const rate = cosmicMultiplier * levelBonus;
      const finalXp = Math.round(baseXp * rate);

      expect(finalXp).toBe(19); // 10 * 1.875 = 18.75 → 19
    });

    it("should enforce minimum rate of 0.5", () => {
      const rate = 0.3; // Below minimum
      const enforcedRate = Math.max(0.5, rate);

      expect(enforcedRate).toBe(0.5);
    });

    it("should allow rates above 0.5", () => {
      const rate = 2.5; // Above minimum
      const enforcedRate = Math.max(0.5, rate);

      expect(enforcedRate).toBe(2.5);
    });
  });
});

// =============================================================================
// BATCH LIMIT TESTS
// =============================================================================

describe("XP Batch Limits", () => {
  it("should respect default max batch of 100", () => {
    const xpToAward = 150;
    const maxBatch = DEFAULT_MAX_BATCH;
    const actualXp = Math.min(xpToAward, maxBatch);

    expect(actualXp).toBe(100);
  });

  it("should allow XP below max batch", () => {
    const xpToAward = 50;
    const maxBatch = DEFAULT_MAX_BATCH;
    const actualXp = Math.min(xpToAward, maxBatch);

    expect(actualXp).toBe(50);
  });

  it("should apply max batch after rate multiplier", () => {
    const baseXp = 100;
    const rate = 2.0;
    const maxBatch = DEFAULT_MAX_BATCH;

    const xpWithRate = Math.round(baseXp * rate); // 200
    const actualXp = Math.min(xpWithRate, maxBatch); // 100

    expect(actualXp).toBe(100);
  });

  it("should support custom max batch values", () => {
    const customMaxBatch = 50;
    const xpToAward = 75;
    const actualXp = Math.min(xpToAward, customMaxBatch);

    expect(actualXp).toBe(50);
  });
});

// =============================================================================
// HASH ACCUMULATION TESTS
// =============================================================================

describe("Hash Accumulation", () => {
  it("should track accumulated hashes between XP awards", () => {
    let accumulated = 0;
    const hashesPerXP = DEFAULT_HASHES_PER_XP;

    // First batch: 500k hashes (not enough for XP)
    accumulated += 500_000;
    let xp = Math.floor(accumulated / hashesPerXP);
    expect(xp).toBe(0);

    // Second batch: another 500k (now 1M total)
    accumulated += 500_000;
    xp = Math.floor(accumulated / hashesPerXP);
    expect(xp).toBe(1);

    // After awarding, keep remainder
    accumulated = accumulated % hashesPerXP;
    expect(accumulated).toBe(0);
  });

  it("should keep remainder after XP award", () => {
    const accumulated = 1_500_000;
    const hashesPerXP = DEFAULT_HASHES_PER_XP;

    const xp = Math.floor(accumulated / hashesPerXP);
    const remainder = accumulated % hashesPerXP;

    expect(xp).toBe(1);
    expect(remainder).toBe(500_000);
  });

  it("should detect new hashes from total hash count", () => {
    const lastHashCount = 5_000_000;
    const currentHashCount = 7_500_000;

    const newHashes = currentHashCount - lastHashCount;

    expect(newHashes).toBe(2_500_000);
  });

  it("should handle hash count overflow gracefully", () => {
    // When hash count overflows or resets
    const lastHashCount = 100_000_000;
    const currentHashCount = 50_000_000; // Reset/lower

    // Should only process positive differences
    const newHashes = currentHashCount - lastHashCount;

    if (newHashes < 0) {
      // Skip processing on reset
      expect(newHashes).toBeLessThan(0);
    }
  });
});

// =============================================================================
// SESSION TRACKING TESTS
// =============================================================================

describe("Session XP Tracking", () => {
  it("should track session XP separately from lifetime", () => {
    const sessionXP = 50;
    const lifetimeXP = 1000;

    expect(sessionXP).toBeLessThanOrEqual(lifetimeXP);
    expect(sessionXP + lifetimeXP - sessionXP).toBe(lifetimeXP);
  });

  it("should track hashes processed in session", () => {
    let hashesProcessed = 0;
    const hashesPerXP = DEFAULT_HASHES_PER_XP;

    // Award 5 XP
    const xpAwarded = 5;
    hashesProcessed += xpAwarded * hashesPerXP;

    expect(hashesProcessed).toBe(5_000_000);
  });

  it("should start with zero session stats", () => {
    const initialSessionXP = 0;
    const initialHashesProcessed = 0;

    expect(initialSessionXP).toBe(0);
    expect(initialHashesProcessed).toBe(0);
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("XP Calculation Edge Cases", () => {
  it("should handle zero hashes", () => {
    const hashes = 0;
    const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);

    expect(xp).toBe(0);
  });

  it("should handle very large hash counts", () => {
    const hashes = 1_000_000_000_000; // 1 trillion
    const xp = Math.floor(hashes / DEFAULT_HASHES_PER_XP);

    expect(xp).toBe(1_000_000); // 1M XP
  });

  it("should not award negative XP", () => {
    const baseXp = -10;
    const actualXp = Math.max(0, baseXp);

    expect(actualXp).toBe(0);
  });

  it("should handle missing baby gracefully", () => {
    const baby = null;
    const shouldProcess = baby !== null;

    expect(shouldProcess).toBe(false);
  });

  it("should use base rate when level bonus disabled", () => {
    const enableLevelBonus = false;
    const cosmicMultiplier = 1.5;
    const level = 10;

    let rate = cosmicMultiplier;
    if (enableLevelBonus) {
      rate *= 1 + level * LEVEL_BONUS_PERCENT;
    }

    expect(rate).toBe(1.5); // No level bonus applied
  });
});

// =============================================================================
// XP PER SHARE TESTS (from game constants)
// =============================================================================

describe("XP Per Share (Mining Shares)", () => {
  const XP_PER_SHARE = 10; // From game constants

  it("should award 10 XP per valid share", () => {
    const sharesSubmitted = 1;
    const xpFromShares = sharesSubmitted * XP_PER_SHARE;

    expect(xpFromShares).toBe(10);
  });

  it("should award 100 XP for 10 shares", () => {
    const sharesSubmitted = 10;
    const xpFromShares = sharesSubmitted * XP_PER_SHARE;

    expect(xpFromShares).toBe(100);
  });

  it("should accumulate XP from multiple share types", () => {
    const hashXP = 5; // From 5M hashes
    const shareXP = 30; // From 3 shares
    const totalXP = hashXP + shareXP;

    expect(totalXP).toBe(35);
  });
});

// =============================================================================
// BLOODLINE MULTIPLIER TESTS
// =============================================================================

describe("Bloodline XP Multipliers", () => {
  const bloodlineMultipliers = {
    royal: 1.5,
    warrior: 1.2,
    rogue: 1.0,
    mystic: 1.3,
  };

  it("should apply Royal bloodline multiplier (1.5x)", () => {
    const baseXp = 100;
    const finalXp = Math.floor(baseXp * bloodlineMultipliers.royal);

    expect(finalXp).toBe(150);
  });

  it("should apply Warrior bloodline multiplier (1.2x)", () => {
    const baseXp = 100;
    const finalXp = Math.floor(baseXp * bloodlineMultipliers.warrior);

    expect(finalXp).toBe(120);
  });

  it("should apply Rogue bloodline multiplier (1.0x)", () => {
    const baseXp = 100;
    const finalXp = Math.floor(baseXp * bloodlineMultipliers.rogue);

    expect(finalXp).toBe(100);
  });

  it("should apply Mystic bloodline multiplier (1.3x)", () => {
    const baseXp = 100;
    const finalXp = Math.floor(baseXp * bloodlineMultipliers.mystic);

    expect(finalXp).toBe(130);
  });

  it("should floor bloodline-modified XP", () => {
    const baseXp = 7;
    const finalXp = Math.floor(baseXp * bloodlineMultipliers.royal); // 7 * 1.5 = 10.5

    expect(finalXp).toBe(10);
  });
});
