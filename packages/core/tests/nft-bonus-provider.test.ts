/**
 * NFT Bonus Provider Tests
 *
 * Tests for NFT mining boost calculations including:
 * - Level boosts (level-only after refactor 4ad993b)
 * - Rarity is cosmetic (no longer affects boost)
 * - Best boost wins across multiple NFTs (no diminishing-returns stacking)
 * - Max boost cap
 */

import { describe, it, expect } from "vitest";
import { createNFTProvider } from "../src/rewards/providers/nft-provider";
import type { BonusCalculationContext } from "../src/rewards/bonus-engine";

// =============================================================================
// TEST FIXTURES
// =============================================================================

interface MockNFT {
  level: number;
  rarityTier?: string;
  boost?: number;
}

const createMockContext = (nfts: MockNFT[] = []): BonusCalculationContext => ({
  nfts: nfts.map((nft) => ({
    level: nft.level,
    rarityTier: nft.rarityTier,
    boost: nft.boost,
  })),
});

// Level boost values from the provider (level-only, rarity is cosmetic).
// 0% at level 1, 10% at level 21.
const LEVEL_BOOSTS: Record<number, number> = {
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
// PROVIDER CONFIGURATION TESTS
// =============================================================================

describe("NFTBonusProvider Configuration", () => {
  it("should have correct name", () => {
    const provider = createNFTProvider();
    expect(provider.name).toBe("nft");
  });

  it("should have priority 2", () => {
    const provider = createNFTProvider();
    expect(provider.priority).toBe(2);
  });

  it("should use additive combine mode", () => {
    const provider = createNFTProvider();
    expect(provider.combineMode).toBe("additive");
  });

  it("should have max multiplier of 1.5 (50% boost)", () => {
    const provider = createNFTProvider();
    expect(provider.maxMultiplier).toBe(1.5);
  });

  it("should have min multiplier of 1.0 (no boost)", () => {
    const provider = createNFTProvider();
    expect(provider.minMultiplier).toBe(1.0);
  });

  it("should be enabled by default", () => {
    const provider = createNFTProvider();
    expect(provider.isEnabled()).toBe(true);
  });

  it("should return active status when enabled", () => {
    const provider = createNFTProvider();
    expect(provider.getStatus()).toBe("active");
  });

  it("should return coming_soon status when disabled", () => {
    const provider = createNFTProvider({ enabled: false });
    expect(provider.getStatus()).toBe("coming_soon");
  });
});

// =============================================================================
// EMPTY NFT LIST TESTS
// =============================================================================

describe("NFTBonusProvider - No NFTs", () => {
  it("should return multiplier of 1.0 with no NFTs", () => {
    const provider = createNFTProvider();
    const context = createMockContext([]);
    const result = provider.calculate(context);

    expect(result.multiplier).toBe(1.0);
  });

  it("should return 0% percentage with no NFTs", () => {
    const provider = createNFTProvider();
    const context = createMockContext([]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(0);
  });

  it("should include helpful message for no NFTs", () => {
    const provider = createNFTProvider();
    const context = createMockContext([]);
    const result = provider.calculate(context);

    expect(result.metadata?.label).toBe("No NFTs");
    expect(result.metadata?.description).toContain("Mint Genesis Sparks");
  });

  it("should handle undefined nfts in context", () => {
    const provider = createNFTProvider();
    const context: BonusCalculationContext = {};
    const result = provider.calculate(context);

    expect(result.multiplier).toBe(1.0);
    expect(result.percentage).toBe(0);
  });
});

// =============================================================================
// LEVEL BOOST TESTS
// =============================================================================

describe("NFTBonusProvider - Level Boosts", () => {
  it("should return 0% level boost for level 1", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "common" }]);
    const result = provider.calculate(context);

    // Level 1 = 0% (rarity is cosmetic and adds nothing)
    expect(result.percentage).toBe(0);
  });

  it("should return correct level boost for level 5", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 5, rarityTier: "common" }]);
    const result = provider.calculate(context);

    // Level 5 = 0.5%
    expect(result.percentage).toBe(0.5);
  });

  it("should return correct level boost for level 10", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 10, rarityTier: "common" }]);
    const result = provider.calculate(context);

    // Level 10 = 2%
    expect(result.percentage).toBe(2);
  });

  it("should return max level boost for level 21", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 21, rarityTier: "mythic" }]);
    const result = provider.calculate(context);

    // Level 21 = 10% (maximum level boost)
    expect(result.percentage).toBe(10);
  });

  it("should handle all level boost values correctly", () => {
    const provider = createNFTProvider();

    for (let level = 1; level <= 21; level++) {
      const context = createMockContext([{ level, rarityTier: "common" }]);
      const result = provider.calculate(context);
      const expectedBoost = LEVEL_BOOSTS[level];

      expect(result.percentage).toBe(expectedBoost);
    }
  });

  it("should return 0% for an unknown level", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 99 }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(0);
  });
});

// =============================================================================
// RARITY IS COSMETIC TESTS
// (Post-4ad993b: rarity no longer affects mining boost — it is display-only.)
// =============================================================================

describe("NFTBonusProvider - Rarity Is Cosmetic", () => {
  it("should return the same boost for common and mythic at level 1", () => {
    const provider = createNFTProvider();

    const common = provider.calculate(
      createMockContext([{ level: 1, rarityTier: "common" }]),
    );
    const mythic = provider.calculate(
      createMockContext([{ level: 1, rarityTier: "mythic" }]),
    );

    // Both are level 1 = 0%, rarity adds nothing
    expect(common.percentage).toBe(0);
    expect(mythic.percentage).toBe(0);
    expect(common.percentage).toBe(mythic.percentage);
  });

  it("should return the same boost for every rarity at the same level", () => {
    const provider = createNFTProvider();
    const rarities = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];

    const boosts = rarities.map((rarityTier) =>
      provider
        .calculate(createMockContext([{ level: 10, rarityTier }]))
        .percentage.toFixed(4),
    );

    // Every rarity yields the level-10 boost (2%); rarity is ignored
    expect(boosts.every((b) => b === boosts[0])).toBe(true);
    expect(boosts[0]).toBe("2.0000");
  });

  it("should ignore unknown and mixed-case rarity tiers", () => {
    const provider = createNFTProvider();

    const unknown = provider.calculate(
      createMockContext([{ level: 5, rarityTier: "unknown" }]),
    );
    const mixedCase = provider.calculate(
      createMockContext([{ level: 5, rarityTier: "MYTHIC" }]),
    );

    // Both are level 5 = 0.5%, regardless of rarity string
    expect(unknown.percentage).toBe(0.5);
    expect(mixedCase.percentage).toBe(0.5);
  });
});

// =============================================================================
// BOOST OVERRIDE TESTS
// =============================================================================

describe("NFTBonusProvider - Boost Override", () => {
  it("should use pre-calculated boost if provided", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common", boost: 10 },
    ]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(10);
  });

  it("should let an explicit boost override the level boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 21, boost: 7 }]);
    const result = provider.calculate(context);

    // Level 21 would be 10%, but the explicit boost (7) wins
    expect(result.percentage).toBe(7);
  });

  it("should treat an explicit zero boost as zero", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 21, boost: 0 }]);
    const result = provider.calculate(context);

    // Explicit boost of 0 overrides the level-21 boost
    expect(result.percentage).toBe(0);
  });
});

// =============================================================================
// BEST BOOST WINS (MULTIPLE NFTS) TESTS
// (Post-4ad993b: multiple NFTs no longer stack with diminishing returns.
//  The single best boost is used.)
// =============================================================================

describe("NFTBonusProvider - Best Boost Wins", () => {
  it("should use the full boost of a single NFT", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 10 }]); // 2%
    const result = provider.calculate(context);

    expect(result.percentage).toBe(2);
  });

  it("should pick the highest boost among multiple NFTs", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 5 }, // 0.5%
      { level: 10 }, // 2%
      { level: 1 }, // 0%
    ]);
    const result = provider.calculate(context);

    // Best boost wins: max(0.5, 2, 0) = 2%
    expect(result.percentage).toBe(2);
  });

  it("should not sum boosts across NFTs", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 10 }, // 2%
      { level: 10 }, // 2%
      { level: 10 }, // 2%
    ]);
    const result = provider.calculate(context);

    // Best-wins, NOT additive stacking: 2%, not 6%
    expect(result.percentage).toBe(2);
  });

  it("should pick the best boost regardless of input order", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1 }, // 0%
      { level: 21 }, // 10% (highest)
      { level: 10 }, // 2%
    ]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(10);
  });

  it("should pick the best boost when explicit overrides are mixed in", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 21 }, // 10%
      { level: 1, boost: 15 }, // 15% (explicit override, highest)
      { level: 10 }, // 2%
    ]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(15);
  });
});

// =============================================================================
// MAX BOOST CAP TESTS
// =============================================================================

describe("NFTBonusProvider - Max Boost Cap", () => {
  it("should cap total boost at 50%", () => {
    const provider = createNFTProvider();

    // Explicit boost exceeds the default 50% cap
    const context = createMockContext([{ level: 1, boost: 75 }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(50);
  });

  it("should cap multiplier at 1.5", () => {
    const provider = createNFTProvider();

    const context = createMockContext([{ level: 1, boost: 75 }]);
    const result = provider.calculate(context);

    expect(result.multiplier).toBe(1.5);
  });

  it("should allow boost under a custom max boost cap", () => {
    const provider = createNFTProvider({ maxBoostPercent: 20 });
    const context = createMockContext([{ level: 21 }]); // 10%

    const result = provider.calculate(context);

    // 10% is under the 20% cap, should be allowed
    expect(result.percentage).toBe(10);
  });

  it("should apply custom max boost cap", () => {
    const provider = createNFTProvider({ maxBoostPercent: 10 });
    const context = createMockContext([{ level: 1, boost: 25 }]); // 25%

    const result = provider.calculate(context);

    // 25% exceeds the 10% cap, should be capped
    expect(result.percentage).toBe(10);
  });
});

// =============================================================================
// METADATA TESTS
// =============================================================================

describe("NFTBonusProvider - Metadata", () => {
  it("should include total NFT count in metadata", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common" },
      { level: 2, rarityTier: "rare" },
    ]);
    const result = provider.calculate(context);

    expect(result.metadata?.details?.totalNFTs).toBe(2);
  });

  it("should include best boost in metadata", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common" }, // 0%
      { level: 21, rarityTier: "rare" }, // 10% (best)
    ]);
    const result = provider.calculate(context);

    expect(result.metadata?.details?.bestBoost).toBe(10);
  });

  it("should reflect the capped boost in bestBoost metadata", () => {
    const provider = createNFTProvider({ maxBoostPercent: 5 });
    const context = createMockContext([{ level: 21 }]); // 10% -> capped to 5%
    const result = provider.calculate(context);

    expect(result.percentage).toBe(5);
    expect(result.metadata?.details?.bestBoost).toBe(5);
  });

  it("should format label correctly", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 21, rarityTier: "rare" }]);
    const result = provider.calculate(context);

    expect(result.metadata?.label).toBe("+10.0%");
  });

  it("should include NFT count in description", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common" },
      { level: 1, rarityTier: "common" },
    ]);
    const result = provider.calculate(context);

    expect(result.metadata?.description).toBe("2 NFTs equipped");
  });

  it("should use singular for single NFT", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "common" }]);
    const result = provider.calculate(context);

    expect(result.metadata?.description).toBe("1 NFT equipped");
  });
});

// =============================================================================
// MULTIPLIER CALCULATION TESTS
// =============================================================================

describe("NFTBonusProvider - Multiplier", () => {
  it("should convert percentage to multiplier correctly", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 21, rarityTier: "rare" }]); // 10%

    const result = provider.calculate(context);

    // 10% boost = 1.1 multiplier
    expect(result.multiplier).toBe(1.1);
  });

  it("should have multiplier of 1.0 for no boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([]);

    const result = provider.calculate(context);

    expect(result.multiplier).toBe(1.0);
  });

  it("should cap multiplier at max when boost exceeds cap", () => {
    // Create provider with lower cap to test capping behavior
    const provider = createNFTProvider({ maxBoostPercent: 10 });

    // Explicit 25% boost, should be capped at 10%
    const context = createMockContext([{ level: 1, boost: 25 }]);
    const result = provider.calculate(context);

    // Capped at 10%, so multiplier should be 1.1
    expect(result.multiplier).toBe(1.1);
  });
});
