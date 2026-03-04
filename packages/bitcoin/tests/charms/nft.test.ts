/**
 * NFT Tests
 *
 * Tests for Genesis Babies NFT configuration, evolution system,
 * mining boosts, and spell generation.
 */

import { describe, it, expect } from "vitest";
import {
  GENESIS_BABIES_CONFIG,
  XP_REQUIREMENTS,
  EVOLUTION_COSTS,
  LEVEL_BOOSTS,
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
  calculateRarityScore,
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
  type BabyNFTState,
  type Bloodline,
  type RarityTier,
  type BaseType,
} from "../../src/charms/nft";

// ============================================
// Configuration Tests
// ============================================

describe("GENESIS_BABIES_CONFIG", () => {
  it("should have correct collection name", () => {
    expect(GENESIS_BABIES_CONFIG.name).toBe("Genesis Babies");
  });

  it("should have correct symbol", () => {
    expect(GENESIS_BABIES_CONFIG.symbol).toBe("GBABY");
  });

  it("should have max supply of 10,000", () => {
    expect(GENESIS_BABIES_CONFIG.maxSupply).toBe(10_000);
  });

  it("should have app type as NFT (n)", () => {
    expect(GENESIS_BABIES_CONFIG.appType).toBe("n");
  });

  it("should have max level of 10", () => {
    expect(GENESIS_BABIES_CONFIG.maxLevel).toBe(10);
  });

  it("should have 6 rarity tiers", () => {
    const tiers = Object.keys(GENESIS_BABIES_CONFIG.rarityTiers);
    expect(tiers).toHaveLength(6);
    expect(tiers).toEqual([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ]);
  });

  it("should have rarity weights that sum to 100", () => {
    const weights = Object.values(GENESIS_BABIES_CONFIG.rarityTiers).map(
      (t) => t.weight,
    );
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("should have increasing boosts for higher rarities", () => {
    const { common, uncommon, rare, epic, legendary, mythic } =
      GENESIS_BABIES_CONFIG.rarityTiers;

    expect(common.boost).toBeLessThan(uncommon.boost);
    expect(uncommon.boost).toBeLessThan(rare.boost);
    expect(rare.boost).toBeLessThan(epic.boost);
    expect(epic.boost).toBeLessThan(legendary.boost);
    expect(legendary.boost).toBeLessThan(mythic.boost);
  });

  it("should have 5 base types", () => {
    const types = Object.keys(GENESIS_BABIES_CONFIG.baseTypes);
    expect(types).toHaveLength(5);
    expect(types).toEqual(["human", "animal", "robot", "mystic", "alien"]);
  });

  it("should have base type weights that sum to 100", () => {
    const weights = Object.values(GENESIS_BABIES_CONFIG.baseTypes).map(
      (t) => t.weight,
    );
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("XP_REQUIREMENTS", () => {
  it("should have XP requirements for levels 2-10", () => {
    for (let level = 2; level <= 10; level++) {
      expect(XP_REQUIREMENTS[level]).toBeDefined();
      expect(XP_REQUIREMENTS[level]).toBeGreaterThan(0);
    }
  });

  it("should have increasing XP requirements", () => {
    for (let level = 3; level <= 10; level++) {
      expect(XP_REQUIREMENTS[level]).toBeGreaterThan(
        XP_REQUIREMENTS[level - 1],
      );
    }
  });

  it("should require 100 XP for level 2", () => {
    expect(XP_REQUIREMENTS[2]).toBe(100);
  });

  it("should require 32000 XP for level 10", () => {
    expect(XP_REQUIREMENTS[10]).toBe(32000);
  });
});

describe("EVOLUTION_COSTS", () => {
  it("should have costs for levels 2-10", () => {
    for (let level = 2; level <= 10; level++) {
      expect(EVOLUTION_COSTS[level]).toBeDefined();
      expect(EVOLUTION_COSTS[level]).toBeGreaterThan(0n);
    }
  });

  it("should have increasing costs", () => {
    for (let level = 3; level <= 10; level++) {
      expect(EVOLUTION_COSTS[level]).toBeGreaterThan(
        EVOLUTION_COSTS[level - 1],
      );
    }
  });

  it("should cost 100 BABTC for level 2", () => {
    expect(EVOLUTION_COSTS[2]).toBe(100n * 100_000_000n);
  });

  it("should cost 50000 BABTC for level 10", () => {
    expect(EVOLUTION_COSTS[10]).toBe(50000n * 100_000_000n);
  });
});

describe("LEVEL_BOOSTS", () => {
  it("should have boosts for levels 1-10", () => {
    for (let level = 1; level <= 10; level++) {
      expect(LEVEL_BOOSTS[level]).toBeDefined();
    }
  });

  it("should have 0% boost at level 1", () => {
    expect(LEVEL_BOOSTS[1]).toBe(0);
  });

  it("should have increasing boosts for higher levels", () => {
    for (let level = 2; level <= 10; level++) {
      expect(LEVEL_BOOSTS[level]).toBeGreaterThan(LEVEL_BOOSTS[level - 1]);
    }
  });

  it("should have 4% boost at level 10", () => {
    // Balanced values: max level boost is 4%
    expect(LEVEL_BOOSTS[10]).toBe(4);
  });
});

// ============================================
// Mining Boost Tests
// ============================================

describe("getMiningBoost", () => {
  const createMockNFT = (
    level: number,
    rarityTier: RarityTier,
  ): BabyNFTState => ({
    dna: "0".repeat(64),
    bloodline: "warrior",
    baseType: "human",
    genesisBlock: 1000,
    rarityTier,
    tokenId: 1,
    level,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: 1000,
    evolutionCount: 0,
    tokensEarned: 0n,
  });

  it("should return 0.5% for level 1 common NFT", () => {
    const nft = createMockNFT(1, "common");
    // Level 1 = 0%, Common = 0.5% (balanced values)
    expect(getMiningBoost(nft)).toBe(0.5);
  });

  it("should combine level and rarity boosts", () => {
    const nft = createMockNFT(5, "rare");
    // Level 5 = 1%, Rare = 2% (balanced values)
    expect(getMiningBoost(nft)).toBe(3);
  });

  it("should return maximum boost for level 10 mythic", () => {
    const nft = createMockNFT(10, "mythic");
    // Level 10 = 4%, Mythic = 8% (balanced values, max 12%)
    expect(getMiningBoost(nft)).toBe(12);
  });

  it("should handle all rarity tiers", () => {
    const tiers: RarityTier[] = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];

    for (const tier of tiers) {
      const nft = createMockNFT(1, tier);
      const boost = getMiningBoost(nft);
      expect(boost).toBe(GENESIS_BABIES_CONFIG.rarityTiers[tier].boost);
    }
  });

  it("should handle all levels", () => {
    for (let level = 1; level <= 10; level++) {
      const nft = createMockNFT(level, "common");
      const boost = getMiningBoost(nft);
      // Common = 0.5% (balanced values)
      expect(boost).toBe(LEVEL_BOOSTS[level] + 0.5);
    }
  });
});

// ============================================
// Level Up Tests
// ============================================

describe("canLevelUp", () => {
  const createMockNFT = (level: number, xp: number): BabyNFTState => ({
    dna: "0".repeat(64),
    bloodline: "warrior",
    baseType: "human",
    genesisBlock: 1000,
    rarityTier: "common",
    tokenId: 1,
    level,
    xp,
    totalXp: xp,
    workCount: 0,
    lastWorkBlock: 1000,
    evolutionCount: 0,
    tokensEarned: 0n,
  });

  it("should return false at max level", () => {
    const nft = createMockNFT(10, 999999);
    expect(canLevelUp(nft)).toBe(false);
  });

  it("should return false when XP is insufficient", () => {
    const nft = createMockNFT(1, 50); // Need 100 XP for level 2
    expect(canLevelUp(nft)).toBe(false);
  });

  it("should return true when XP equals requirement", () => {
    const nft = createMockNFT(1, 100); // Exactly 100 XP for level 2
    expect(canLevelUp(nft)).toBe(true);
  });

  it("should return true when XP exceeds requirement", () => {
    const nft = createMockNFT(1, 500); // More than 100 XP for level 2
    expect(canLevelUp(nft)).toBe(true);
  });

  it("should check correct XP requirement for each level", () => {
    for (let level = 1; level < 10; level++) {
      const requiredXp = XP_REQUIREMENTS[level + 1];

      const nftNotReady = createMockNFT(level, requiredXp - 1);
      expect(canLevelUp(nftNotReady)).toBe(false);

      const nftReady = createMockNFT(level, requiredXp);
      expect(canLevelUp(nftReady)).toBe(true);
    }
  });
});

// ============================================
// XP Gain Tests
// ============================================

describe("calculateXpGain", () => {
  const createMockNFT = (bloodline: Bloodline): BabyNFTState => ({
    dna: "0".repeat(64),
    bloodline,
    baseType: "human",
    genesisBlock: 1000,
    rarityTier: "common",
    tokenId: 1,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: 1000,
    evolutionCount: 0,
    tokensEarned: 0n,
  });

  it("should return 100 XP for rogue bloodline (1.0x multiplier)", () => {
    const nft = createMockNFT("rogue");
    expect(calculateXpGain(nft)).toBe(100);
  });

  it("should return 120 XP for warrior bloodline (1.2x multiplier)", () => {
    const nft = createMockNFT("warrior");
    expect(calculateXpGain(nft)).toBe(120);
  });

  it("should return 130 XP for mystic bloodline (1.3x multiplier)", () => {
    const nft = createMockNFT("mystic");
    expect(calculateXpGain(nft)).toBe(130);
  });

  it("should return 150 XP for royal bloodline (1.5x multiplier)", () => {
    const nft = createMockNFT("royal");
    expect(calculateXpGain(nft)).toBe(150);
  });

  it("should floor the XP value", () => {
    // All bloodlines should return integer XP
    const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
    for (const bloodline of bloodlines) {
      const nft = createMockNFT(bloodline);
      const xp = calculateXpGain(nft);
      expect(Number.isInteger(xp)).toBe(true);
    }
  });
});

// ============================================
// DNA & Traits Tests
// ============================================

describe("getTraitsFromDNA", () => {
  const validDNA = "0".repeat(64);

  it("should return all required trait categories", () => {
    const traits = getTraitsFromDNA(validDNA);

    expect(traits.background).toBeDefined();
    expect(traits.body).toBeDefined();
    expect(traits.eyes).toBeDefined();
    expect(traits.mouth).toBeDefined();
    expect(traits.accessories).toBeDefined();
    expect(traits.effects).toBeDefined();
  });

  it("should return deterministic traits for same DNA", () => {
    const traits1 = getTraitsFromDNA(validDNA);
    const traits2 = getTraitsFromDNA(validDNA);

    expect(traits1).toEqual(traits2);
  });

  it("should return different traits for different DNA", () => {
    const dna1 = "0".repeat(64);
    const dna2 = "f".repeat(64);

    const traits1 = getTraitsFromDNA(dna1);
    const traits2 = getTraitsFromDNA(dna2);

    expect(traits1).not.toEqual(traits2);
  });

  it("should return array for accessories", () => {
    const traits = getTraitsFromDNA(validDNA);
    expect(Array.isArray(traits.accessories)).toBe(true);
  });

  it("should return null or string for effects", () => {
    const traits = getTraitsFromDNA(validDNA);
    expect(traits.effects === null || typeof traits.effects === "string").toBe(
      true,
    );
  });
});

describe("calculateRarityScore", () => {
  it("should add 20 points per accessory", () => {
    const traitsWithOneAccessory = {
      background: "bg_0",
      body: "body_0",
      eyes: "eyes_0",
      mouth: "mouth_0",
      accessories: ["acc_0"],
      effects: null,
    };

    const traitsWithTwoAccessories = {
      ...traitsWithOneAccessory,
      accessories: ["acc_0", "acc_1"],
    };

    const score1 = calculateRarityScore(traitsWithOneAccessory);
    const score2 = calculateRarityScore(traitsWithTwoAccessories);

    expect(score2 - score1).toBe(20);
  });

  it("should add 50 points for effects", () => {
    const traitsWithoutEffect = {
      background: "bg_0",
      body: "body_0",
      eyes: "eyes_0",
      mouth: "mouth_0",
      accessories: [],
      effects: null,
    };

    const traitsWithEffect = {
      ...traitsWithoutEffect,
      effects: "effect_0",
    };

    const score1 = calculateRarityScore(traitsWithoutEffect);
    const score2 = calculateRarityScore(traitsWithEffect);

    expect(score2 - score1).toBe(50);
  });

  it("should add 100 points for alien body type", () => {
    const alienTraits = {
      background: "bg_0",
      body: "body_4", // Alien
      eyes: "eyes_0",
      mouth: "mouth_0",
      accessories: [],
      effects: null,
    };

    const humanTraits = {
      ...alienTraits,
      body: "body_0", // Human
    };

    const alienScore = calculateRarityScore(alienTraits);
    const humanScore = calculateRarityScore(humanTraits);

    expect(alienScore - humanScore).toBe(100);
  });

  it("should add 50 points for mystic body type", () => {
    const mysticTraits = {
      background: "bg_0",
      body: "body_3", // Mystic
      eyes: "eyes_0",
      mouth: "mouth_0",
      accessories: [],
      effects: null,
    };

    const score = calculateRarityScore(mysticTraits);
    expect(score).toBe(50);
  });

  it("should add 30 points for robot body type", () => {
    const robotTraits = {
      background: "bg_0",
      body: "body_2", // Robot
      eyes: "eyes_0",
      mouth: "mouth_0",
      accessories: [],
      effects: null,
    };

    const score = calculateRarityScore(robotTraits);
    expect(score).toBe(30);
  });
});

// ============================================
// Spell Generation Tests
// ============================================

describe("createNFTGenesisSpell", () => {
  const defaultParams = {
    appId: "test_nft_app",
    appVk: "test_vk",
    ownerAddress: "tb1qowner",
    tokenId: 42,
    dna: "a".repeat(64),
    bloodline: "warrior" as Bloodline,
    baseType: "human" as BaseType,
    rarityTier: "rare" as RarityTier,
    genesisBlock: 5000,
  };

  it("should create spell with version 2", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include NFT app reference in correct format", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.appId}/${defaultParams.appVk}`,
    );
  });

  it("should have empty inputs (mint from nothing)", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    expect(spell.ins).toHaveLength(0);
  });

  it("should have one output to owner", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    expect(spell.outs).toHaveLength(1);
    expect(spell.outs[0].address).toBe(defaultParams.ownerAddress);
  });

  it("should have dust limit for output", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    expect(spell.outs[0].sats).toBe(546);
  });

  it("should include initial NFT state with correct immutable fields", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    const state = spell.outs[0].charms.$00 as BabyNFTState;

    expect(state.dna).toBe(defaultParams.dna);
    expect(state.bloodline).toBe(defaultParams.bloodline);
    expect(state.baseType).toBe(defaultParams.baseType);
    expect(state.rarityTier).toBe(defaultParams.rarityTier);
    expect(state.genesisBlock).toBe(defaultParams.genesisBlock);
    expect(state.tokenId).toBe(defaultParams.tokenId);
  });

  it("should include initial NFT state with correct mutable defaults", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    const state = spell.outs[0].charms.$00 as BabyNFTState;

    expect(state.level).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.totalXp).toBe(0);
    expect(state.workCount).toBe(0);
    expect(state.lastWorkBlock).toBe(defaultParams.genesisBlock);
    expect(state.evolutionCount).toBe(0);
    expect(state.tokensEarned).toBe(0n);
  });
});

describe("createNFTWorkProofSpell", () => {
  const mockState: BabyNFTState = {
    dna: "b".repeat(64),
    bloodline: "royal",
    baseType: "mystic",
    genesisBlock: 1000,
    rarityTier: "epic",
    tokenId: 7,
    level: 3,
    xp: 200,
    totalXp: 500,
    workCount: 5,
    lastWorkBlock: 2000,
    evolutionCount: 2,
    tokensEarned: 1000n,
  };

  const defaultParams = {
    appId: "test_nft_app",
    appVk: "test_vk",
    nftUtxo: { txid: "abc123", vout: 1 },
    currentState: mockState,
    ownerAddress: "tb1qowner",
    workProofHash: "work_hash_123",
    currentBlock: 3000,
  };

  it("should create spell with version 2", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include app reference in correct format", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.appId}/${defaultParams.appVk}`,
    );
  });

  it("should reference input UTXO correctly", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
  });

  it("should include current state in input", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.ins[0].charms.$00).toEqual(mockState);
  });

  it("should include work proof hash in public inputs", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.public_inputs?.work_proof).toBe(defaultParams.workProofHash);
  });

  it("should include block height in public inputs", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.public_inputs?.block_height).toBe(defaultParams.currentBlock);
  });

  it("should update XP in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;
    const expectedXpGain = calculateXpGain(mockState); // Royal = 150 XP

    expect(newState.xp).toBe(mockState.xp + expectedXpGain);
    expect(newState.totalXp).toBe(mockState.totalXp + expectedXpGain);
  });

  it("should increment work count in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.workCount).toBe(mockState.workCount + 1);
  });

  it("should update lastWorkBlock in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.lastWorkBlock).toBe(defaultParams.currentBlock);
  });

  it("should preserve immutable fields in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.dna).toBe(mockState.dna);
    expect(newState.bloodline).toBe(mockState.bloodline);
    expect(newState.baseType).toBe(mockState.baseType);
    expect(newState.rarityTier).toBe(mockState.rarityTier);
    expect(newState.genesisBlock).toBe(mockState.genesisBlock);
    expect(newState.tokenId).toBe(mockState.tokenId);
  });
});

describe("createNFTLevelUpSpell", () => {
  const mockState: BabyNFTState = {
    dna: "c".repeat(64),
    bloodline: "warrior",
    baseType: "robot",
    genesisBlock: 1000,
    rarityTier: "legendary",
    tokenId: 99,
    level: 4,
    xp: 600, // Enough for level 5
    totalXp: 2000,
    workCount: 20,
    lastWorkBlock: 5000,
    evolutionCount: 3,
    tokensEarned: 5000n,
  };

  const tokenAmount = EVOLUTION_COSTS[5] + 1000n * 100_000_000n; // Cost + extra

  const defaultParams = {
    nftAppId: "nft_app",
    nftAppVk: "nft_vk",
    tokenAppId: "token_app",
    tokenAppVk: "token_vk",
    nftUtxo: { txid: "nft_txid", vout: 0 },
    tokenUtxo: { txid: "token_txid", vout: 1 },
    currentState: mockState,
    tokenAmount,
    ownerAddress: "tb1qowner",
  };

  it("should create spell with version 2", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include both NFT and token app references", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.nftAppId}/${defaultParams.nftAppVk}`,
    );
    expect(spell.apps.$01).toBe(
      `t/${defaultParams.tokenAppId}/${defaultParams.tokenAppVk}`,
    );
  });

  it("should have two inputs (NFT and tokens)", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins).toHaveLength(2);
  });

  it("should reference NFT UTXO correctly", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
    expect(spell.ins[0].charms.$00).toEqual(mockState);
  });

  it("should reference token UTXO correctly", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins[1].utxo_id).toBe(
      `${defaultParams.tokenUtxo.txid}:${defaultParams.tokenUtxo.vout}`,
    );
    expect(spell.ins[1].charms.$01).toBe(Number(tokenAmount));
  });

  it("should increment level in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.level).toBe(mockState.level + 1);
  });

  it("should reset XP to 0 in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.xp).toBe(0);
  });

  it("should increment evolution count in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as BabyNFTState;

    expect(newState.evolutionCount).toBe(mockState.evolutionCount + 1);
  });

  it("should output remaining tokens after burn", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const burnCost = EVOLUTION_COSTS[5];
    const expectedRemaining = tokenAmount - burnCost;

    expect(spell.outs).toHaveLength(2);
    expect(spell.outs[1].charms.$01).toBe(Number(expectedRemaining));
  });

  it("should not output remaining tokens when exact amount", () => {
    const exactParams = {
      ...defaultParams,
      tokenAmount: EVOLUTION_COSTS[5], // Exactly the cost
    };
    const spell = createNFTLevelUpSpell(exactParams);

    expect(spell.outs).toHaveLength(1);
  });

  it("should have dust limit for all outputs", () => {
    const spell = createNFTLevelUpSpell(defaultParams);

    for (const out of spell.outs) {
      expect(out.sats).toBe(546);
    }
  });
});
