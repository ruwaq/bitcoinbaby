/**
 * NFT Bonus Provider Tests
 *
 * Tests for NFT mining boost calculations including:
 * - Level boosts
 * - Rarity boosts
 * - Stacking with diminishing returns
 */

import { describe, it, expect } from "vitest";
import {
  NFTBonusProvider,
  createNFTProvider,
} from "../src/rewards/providers/nft-provider";
import type { BonusCalculationContext } from "../src/rewards/bonus-engine";

// =============================================================================
// TEST FIXTURES
// =============================================================================

interface MockNFT {
  level: number;
  rarityTier: string;
  boost?: number;
}

const createMockContext = (nfts: MockNFT[] = []): BonusCalculationContext => ({
  nfts: nfts.map((nft) => ({
    level: nft.level,
    rarityTier: nft.rarityTier,
    boost: nft.boost,
  })),
});

// Level boost values from provider
const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 0.25,
  3: 0.5,
  4: 0.75,
  5: 1,
  6: 1.5,
  7: 2,
  8: 2.5,
  9: 3,
  10: 4,
};

// Rarity boost values from provider
const RARITY_BOOSTS: Record<string, number> = {
  common: 0.5,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
  mythic: 8,
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
    expect(result.metadata?.description).toContain("Mint Genesis Babies");
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

    // Level 1: 0% + Common: 0.5% = 0.5%
    expect(result.percentage).toBe(0.5);
  });

  it("should return correct level boost for level 5", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 5, rarityTier: "common" }]);
    const result = provider.calculate(context);

    // Level 5: 1% + Common: 0.5% = 1.5%
    expect(result.percentage).toBe(1.5);
  });

  it("should return max level boost for level 10", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 10, rarityTier: "common" }]);
    const result = provider.calculate(context);

    // Level 10: 4% + Common: 0.5% = 4.5%
    expect(result.percentage).toBe(4.5);
  });

  it("should handle all level boost values correctly", () => {
    const provider = createNFTProvider();

    for (let level = 1; level <= 10; level++) {
      const context = createMockContext([{ level, rarityTier: "common" }]);
      const result = provider.calculate(context);
      const expectedBoost = LEVEL_BOOSTS[level] + RARITY_BOOSTS.common;

      expect(result.percentage).toBe(expectedBoost);
    }
  });
});

// =============================================================================
// RARITY BOOST TESTS
// =============================================================================

describe("NFTBonusProvider - Rarity Boosts", () => {
  it("should return 0.5% for common rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "common" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.common);
  });

  it("should return 1% for uncommon rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "uncommon" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.uncommon);
  });

  it("should return 2% for rare rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "rare" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.rare);
  });

  it("should return 3% for epic rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "epic" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.epic);
  });

  it("should return 5% for legendary rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "legendary" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.legendary);
  });

  it("should return 8% for mythic rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "mythic" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.mythic);
  });

  it("should handle unknown rarity tier", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "unknown" }]);
    const result = provider.calculate(context);

    // Unknown rarity = 0 boost, level 1 = 0 boost
    expect(result.percentage).toBe(0);
  });

  it("should be case insensitive for rarity", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "MYTHIC" }]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(RARITY_BOOSTS.mythic);
  });
});

// =============================================================================
// COMBINED BOOST TESTS
// =============================================================================

describe("NFTBonusProvider - Combined Boosts", () => {
  it("should combine level and rarity boosts additively", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 5, rarityTier: "rare" }]);
    const result = provider.calculate(context);

    // Level 5: 1% + Rare: 2% = 3%
    expect(result.percentage).toBe(3);
  });

  it("should calculate max boost for level 10 mythic", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 10, rarityTier: "mythic" }]);
    const result = provider.calculate(context);

    // Level 10: 4% + Mythic: 8% = 12%
    expect(result.percentage).toBe(12);
  });

  it("should use pre-calculated boost if provided", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common", boost: 10 },
    ]);
    const result = provider.calculate(context);

    expect(result.percentage).toBe(10);
  });
});

// =============================================================================
// STACKING TESTS
// =============================================================================

describe("NFTBonusProvider - Stacking", () => {
  it("should apply 100% of first NFT boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 1, rarityTier: "rare" }]); // 2%
    const result = provider.calculate(context);

    // First NFT at 100%: 2% * 1.0 = 2%
    expect(result.percentage).toBe(2);
  });

  it("should apply 50% of second NFT boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "rare" }, // 2%
      { level: 1, rarityTier: "rare" }, // 2%
    ]);
    const result = provider.calculate(context);

    // First: 2% * 1.0 = 2%, Second: 2% * 0.5 = 1%, Total: 3%
    expect(result.percentage).toBe(3);
  });

  it("should apply 25% of third NFT boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "rare" }, // 2%
      { level: 1, rarityTier: "rare" }, // 2%
      { level: 1, rarityTier: "rare" }, // 2%
    ]);
    const result = provider.calculate(context);

    // 2% * 1.0 + 2% * 0.5 + 2% * 0.25 = 2 + 1 + 0.5 = 3.5%
    expect(result.percentage).toBe(3.5);
  });

  it("should apply 12.5% of fourth NFT boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
    ]);
    const result = provider.calculate(context);

    // 2 * 1.0 + 2 * 0.5 + 2 * 0.25 + 2 * 0.125 = 2 + 1 + 0.5 + 0.25 = 3.75%
    expect(result.percentage).toBe(3.75);
  });

  it("should apply 5% for fifth+ NFT boost", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
    ]);
    const result = provider.calculate(context);

    // 2*(1 + 0.5 + 0.25 + 0.125 + 0.05) = 2 * 1.925 = 3.85%
    expect(result.percentage).toBe(3.85);
  });

  it("should sort NFTs by boost (highest first) before stacking", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common" }, // 0.5%
      { level: 10, rarityTier: "mythic" }, // 12% (highest)
      { level: 1, rarityTier: "rare" }, // 2%
    ]);
    const result = provider.calculate(context);

    // Sorted: 12%, 2%, 0.5%
    // 12 * 1.0 + 2 * 0.5 + 0.5 * 0.25 = 12 + 1 + 0.125 = 13.125%
    expect(result.percentage).toBe(13.125);
  });
});

// =============================================================================
// MAX BOOST CAP TESTS
// =============================================================================

describe("NFTBonusProvider - Max Boost Cap", () => {
  it("should cap total boost at 50%", () => {
    const provider = createNFTProvider();

    // Create many high-boost NFTs that would exceed 50%
    const manyMythics = Array(10)
      .fill(null)
      .map(() => ({ level: 10, rarityTier: "mythic" })); // 12% each

    const context = createMockContext(manyMythics);
    const result = provider.calculate(context);

    expect(result.percentage).toBeLessThanOrEqual(50);
  });

  it("should cap multiplier at 1.5", () => {
    const provider = createNFTProvider();

    const manyMythics = Array(10)
      .fill(null)
      .map(() => ({ level: 10, rarityTier: "mythic" }));

    const context = createMockContext(manyMythics);
    const result = provider.calculate(context);

    expect(result.multiplier).toBeLessThanOrEqual(1.5);
  });

  it("should allow custom max boost", () => {
    const provider = createNFTProvider({ maxBoostPercent: 20 });
    const context = createMockContext([{ level: 10, rarityTier: "mythic" }]); // 12%

    const result = provider.calculate(context);

    // 12% is under 20% cap, should be allowed
    expect(result.percentage).toBe(12);
  });

  it("should apply custom max boost cap", () => {
    const provider = createNFTProvider({ maxBoostPercent: 10 });
    const context = createMockContext([{ level: 10, rarityTier: "mythic" }]); // 12%

    const result = provider.calculate(context);

    // 12% exceeds 10% cap, should be capped
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
      { level: 1, rarityTier: "common" }, // 0.5%
      { level: 5, rarityTier: "rare" }, // 3% (best)
    ]);
    const result = provider.calculate(context);

    expect(result.metadata?.details?.bestBoost).toBe(3);
  });

  it("should include stacked boost in metadata", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "rare" },
      { level: 1, rarityTier: "rare" },
    ]);
    const result = provider.calculate(context);

    expect(result.metadata?.details?.stackedBoost).toBe(result.percentage);
  });

  it("should include individual NFT boosts in metadata", () => {
    const provider = createNFTProvider();
    const context = createMockContext([
      { level: 1, rarityTier: "common" }, // 0.5%
      { level: 5, rarityTier: "rare" }, // 3%
    ]);
    const result = provider.calculate(context);

    const nfts = result.metadata?.details?.nfts as Array<{
      level: number;
      rarity: string;
      boost: number;
    }>;

    expect(nfts).toBeDefined();
    expect(nfts).toHaveLength(2);
  });

  it("should format label correctly", () => {
    const provider = createNFTProvider();
    const context = createMockContext([{ level: 5, rarityTier: "rare" }]);
    const result = provider.calculate(context);

    expect(result.metadata?.label).toBe("+3.0%");
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
    const context = createMockContext([{ level: 5, rarityTier: "rare" }]); // 3%

    const result = provider.calculate(context);

    // 3% boost = 1.03 multiplier
    expect(result.multiplier).toBe(1.03);
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

    // Single level 10 mythic = 12% boost, should be capped at 10%
    const context = createMockContext([{ level: 10, rarityTier: "mythic" }]);
    const result = provider.calculate(context);

    // Capped at 10%, so multiplier should be 1.1
    expect(result.multiplier).toBe(1.1);
  });
});
