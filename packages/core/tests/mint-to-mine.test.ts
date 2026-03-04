/**
 * Mint-to-Mine Integration Tests
 *
 * Tests the complete flow from minting an NFT to applying mining boosts.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getMiningBoost,
  GENESIS_BABIES_CONFIG,
  LEVEL_BOOSTS,
  type BabyNFTState,
  type Bloodline,
  type BaseType,
  type RarityTier,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// MOCK NFT GENERATION (mirrors useMintNFT logic)
// =============================================================================

function generateDNA(): string {
  // Deterministic for testing
  return "0".repeat(64);
}

function createMockNFT(overrides: Partial<BabyNFTState> = {}): BabyNFTState {
  return {
    dna: generateDNA(),
    bloodline: "warrior",
    baseType: "human",
    rarityTier: "common",
    genesisBlock: 800000,
    tokenId: 1,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: 800000,
    evolutionCount: 0,
    tokensEarned: 0n,
    ...overrides,
  };
}

// =============================================================================
// MINING BOOST CALCULATION TESTS
// =============================================================================

describe("Mining Boost Calculation", () => {
  describe("Level-based boosts", () => {
    it("should return 0.5% boost at level 1 common", () => {
      const nft = createMockNFT({ level: 1, rarityTier: "common" });
      const boost = getMiningBoost(nft);
      // common rarity adds 0.5% (balanced values), level 1 adds 0%
      expect(boost).toBe(0.5);
    });

    it("should increase boost with higher levels", () => {
      const level1 = createMockNFT({ level: 1, rarityTier: "common" });
      const level5 = createMockNFT({ level: 5, rarityTier: "common" });
      const level10 = createMockNFT({ level: 10, rarityTier: "common" });

      const boost1 = getMiningBoost(level1);
      const boost5 = getMiningBoost(level5);
      const boost10 = getMiningBoost(level10);

      expect(boost5).toBeGreaterThan(boost1);
      expect(boost10).toBeGreaterThan(boost5);
    });

    it("should match LEVEL_BOOSTS configuration", () => {
      for (let level = 1; level <= 10; level++) {
        const nft = createMockNFT({ level, rarityTier: "common" });
        const boost = getMiningBoost(nft);
        // Common = 0.5% (balanced values)
        const expectedBoost = LEVEL_BOOSTS[level] + 0.5;
        expect(boost).toBe(expectedBoost);
      }
    });
  });

  describe("Rarity-based boosts", () => {
    const rarities: RarityTier[] = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];

    it("should increase boost with higher rarity", () => {
      const boosts = rarities.map((rarityTier) => {
        const nft = createMockNFT({ level: 1, rarityTier });
        return getMiningBoost(nft);
      });

      // Each rarity should have higher or equal boost than previous
      for (let i = 1; i < boosts.length; i++) {
        expect(boosts[i]).toBeGreaterThanOrEqual(boosts[i - 1]);
      }
    });

    it("should have highest boost for mythic rarity", () => {
      const common = createMockNFT({ level: 1, rarityTier: "common" });
      const mythic = createMockNFT({ level: 1, rarityTier: "mythic" });

      const commonBoost = getMiningBoost(common);
      const mythicBoost = getMiningBoost(mythic);

      expect(mythicBoost).toBeGreaterThan(commonBoost);
      // Mythic (8%) vs Common (0.5%) = 7.5% difference (balanced values)
      expect(mythicBoost - commonBoost).toBeGreaterThanOrEqual(7);
    });
  });

  describe("Combined level + rarity boosts", () => {
    it("should add level and rarity boosts together", () => {
      const level5Common = createMockNFT({ level: 5, rarityTier: "common" });
      const level5Legendary = createMockNFT({
        level: 5,
        rarityTier: "legendary",
      });

      const commonBoost = getMiningBoost(level5Common);
      const legendaryBoost = getMiningBoost(level5Legendary);

      // Both should have level 5 boost (25%), legendary should have more rarity boost
      expect(legendaryBoost).toBeGreaterThan(commonBoost);
    });

    it("should cap maximum boost reasonably", () => {
      const maxedNFT = createMockNFT({ level: 10, rarityTier: "mythic" });
      const maxBoost = getMiningBoost(maxedNFT);

      // Balanced values: level 10 (4%) + mythic rarity (8%) = 12%
      // This is intentionally conservative to prevent pay-to-win
      expect(maxBoost).toBeLessThanOrEqual(15); // Max reasonable for single NFT
      expect(maxBoost).toBeGreaterThan(10); // Should be meaningful
      expect(maxBoost).toBe(12); // Exact expected value
    });
  });
});

// =============================================================================
// NFT TRAIT VALIDATION TESTS
// =============================================================================

describe("NFT Trait Validation", () => {
  describe("Bloodline types", () => {
    const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];

    it("should accept all valid bloodlines", () => {
      bloodlines.forEach((bloodline) => {
        const nft = createMockNFT({ bloodline });
        expect(nft.bloodline).toBe(bloodline);
        // Should not throw when calculating boost
        expect(() => getMiningBoost(nft)).not.toThrow();
      });
    });
  });

  describe("Base types", () => {
    const baseTypes: BaseType[] = [
      "human",
      "animal",
      "robot",
      "mystic",
      "alien",
    ];

    it("should accept all valid base types", () => {
      baseTypes.forEach((baseType) => {
        const nft = createMockNFT({ baseType });
        expect(nft.baseType).toBe(baseType);
        expect(() => getMiningBoost(nft)).not.toThrow();
      });
    });
  });

  describe("DNA validation", () => {
    it("should handle 64-character hex DNA", () => {
      const validDNA = "a".repeat(64);
      const nft = createMockNFT({ dna: validDNA });
      expect(nft.dna).toBe(validDNA);
      expect(nft.dna.length).toBe(64);
    });

    it("should handle DNA with mixed hex characters", () => {
      const mixedDNA = "0123456789abcdef".repeat(4);
      const nft = createMockNFT({ dna: mixedDNA });
      expect(nft.dna.length).toBe(64);
    });
  });
});

// =============================================================================
// MINING STORE INTEGRATION TESTS
// =============================================================================

describe("Mining Store NFT Boost Integration", () => {
  // Mock mining store behavior
  interface MiningStoreState {
    hashrate: number;
    nftBoost: number;
    effectiveHashrate: number;
  }

  function createMockMiningStore() {
    let state: MiningStoreState = {
      hashrate: 0,
      nftBoost: 0,
      effectiveHashrate: 0,
    };

    return {
      getState: () => state,
      updateHashrate: (hashrate: number) => {
        state.hashrate = hashrate;
        state.effectiveHashrate = Math.floor(
          hashrate * (1 + state.nftBoost / 100),
        );
      },
      setNFTBoost: (boost: number) => {
        state.nftBoost = boost;
        state.effectiveHashrate = Math.floor(
          state.hashrate * (1 + boost / 100),
        );
      },
      reset: () => {
        state = { hashrate: 0, nftBoost: 0, effectiveHashrate: 0 };
      },
    };
  }

  it("should apply NFT boost to hashrate", () => {
    const store = createMockMiningStore();

    // Set base hashrate
    store.updateHashrate(1000);
    expect(store.getState().effectiveHashrate).toBe(1000);

    // Apply 50% NFT boost
    store.setNFTBoost(50);
    expect(store.getState().effectiveHashrate).toBe(1500);
  });

  it("should update effective hashrate when boost changes", () => {
    const store = createMockMiningStore();
    store.updateHashrate(1000);

    // No boost
    store.setNFTBoost(0);
    expect(store.getState().effectiveHashrate).toBe(1000);

    // 100% boost (2x)
    store.setNFTBoost(100);
    expect(store.getState().effectiveHashrate).toBe(2000);

    // 150% boost (2.5x)
    store.setNFTBoost(150);
    expect(store.getState().effectiveHashrate).toBe(2500);
  });

  it("should integrate with NFT mining boost", () => {
    const store = createMockMiningStore();
    store.updateHashrate(10000);

    // Create a level 5 legendary NFT
    const nft = createMockNFT({ level: 5, rarityTier: "legendary" });
    const boost = getMiningBoost(nft);

    store.setNFTBoost(boost);

    const state = store.getState();
    expect(state.nftBoost).toBe(boost);
    expect(state.effectiveHashrate).toBe(Math.floor(10000 * (1 + boost / 100)));
  });
});

// =============================================================================
// NFT COLLECTION BEST BOOST TESTS
// =============================================================================

describe("NFT Collection Best Boost", () => {
  function getBestBoost(nfts: BabyNFTState[]): number {
    if (nfts.length === 0) return 0;
    return Math.max(...nfts.map((n) => getMiningBoost(n)));
  }

  it("should return 0 for empty collection", () => {
    expect(getBestBoost([])).toBe(0);
  });

  it("should return single NFT boost for collection of one", () => {
    const nft = createMockNFT({ level: 3, rarityTier: "rare" });
    const boost = getMiningBoost(nft);
    expect(getBestBoost([nft])).toBe(boost);
  });

  it("should return highest boost from collection", () => {
    const nfts = [
      createMockNFT({ level: 1, rarityTier: "common", tokenId: 1 }),
      createMockNFT({ level: 5, rarityTier: "rare", tokenId: 2 }),
      createMockNFT({ level: 10, rarityTier: "legendary", tokenId: 3 }),
    ];

    const boosts = nfts.map((n) => getMiningBoost(n));
    const maxBoost = Math.max(...boosts);

    expect(getBestBoost(nfts)).toBe(maxBoost);
  });

  it("should update when higher boost NFT is added", () => {
    const collection = [
      createMockNFT({ level: 1, rarityTier: "common", tokenId: 1 }),
    ];

    const initialBest = getBestBoost(collection);

    // Add a better NFT
    const betterNFT = createMockNFT({
      level: 5,
      rarityTier: "epic",
      tokenId: 2,
    });
    collection.push(betterNFT);

    const newBest = getBestBoost(collection);
    expect(newBest).toBeGreaterThan(initialBest);
  });
});

// =============================================================================
// XP AND LEVEL UP TESTS
// =============================================================================

describe("XP and Level Up Flow", () => {
  it("should track XP accumulation", () => {
    const nft = createMockNFT({ level: 1, xp: 0 });

    // Simulate earning XP
    nft.xp += 100;
    expect(nft.xp).toBe(100);
  });

  it("should increase boost potential after level up", () => {
    const level1 = createMockNFT({ level: 1, rarityTier: "common" });
    const level2 = createMockNFT({ level: 2, rarityTier: "common" });

    const boost1 = getMiningBoost(level1);
    const boost2 = getMiningBoost(level2);

    expect(boost2).toBeGreaterThan(boost1);
  });

  it("should track evolution count", () => {
    const nft = createMockNFT({ level: 1, evolutionCount: 0 });

    // Simulate evolution
    nft.level += 1;
    nft.evolutionCount += 1;

    expect(nft.level).toBe(2);
    expect(nft.evolutionCount).toBe(1);
  });
});

// =============================================================================
// WORK COUNT AND TOKENS EARNED TESTS
// =============================================================================

describe("Work Count and Token Tracking", () => {
  it("should increment work count", () => {
    const nft = createMockNFT({ workCount: 0 });

    // Simulate work
    nft.workCount += 1;
    expect(nft.workCount).toBe(1);

    nft.workCount += 10;
    expect(nft.workCount).toBe(11);
  });

  it("should track tokens earned as bigint", () => {
    const nft = createMockNFT({ tokensEarned: 0n });

    // Simulate token earnings
    nft.tokensEarned += 1000n;
    expect(nft.tokensEarned).toBe(1000n);

    nft.tokensEarned += 999999999999n;
    expect(nft.tokensEarned).toBe(1000000000999n);
  });

  it("should update last work block", () => {
    const nft = createMockNFT({ lastWorkBlock: 800000 });

    // Simulate work at new block
    nft.lastWorkBlock = 850000;
    expect(nft.lastWorkBlock).toBe(850000);
  });
});
