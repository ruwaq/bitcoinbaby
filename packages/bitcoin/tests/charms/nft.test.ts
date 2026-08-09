/**
 * NFT Tests
 *
 * Tests for Genesis Sparks NFT configuration, evolution system,
 * mining boosts, and spell generation.
 */

import { describe, it, expect } from "vitest";
import {
  GENESIS_SPARKS_CONFIG,
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
  calculateRarityScore,
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTWorkSpell,
  createNFTLevelUpSpell,
  type SparkNFTState,
  type Bloodline,
  type RarityTier,
  type BaseType,
} from "../../src/charms/nft";

// ============================================
// Configuration Tests
// ============================================

describe("GENESIS_SPARKS_CONFIG", () => {
  it("should have correct collection name", () => {
    expect(GENESIS_SPARKS_CONFIG.name).toBe("Genesis Sparks");
  });

  it("should have correct symbol", () => {
    expect(GENESIS_SPARKS_CONFIG.symbol).toBe("GBABY");
  });

  it("should have max supply of 10,000", () => {
    expect(GENESIS_SPARKS_CONFIG.maxSupply).toBe(10_000);
  });

  it("should have app type as NFT (n)", () => {
    expect(GENESIS_SPARKS_CONFIG.appType).toBe("n");
  });

  it("should have max level of 21 (post-refactor: extended from 10)", () => {
    expect(GENESIS_SPARKS_CONFIG.maxLevel).toBe(21);
  });

  it("should have 6 rarity tiers", () => {
    const tiers = Object.keys(GENESIS_SPARKS_CONFIG.rarityTiers);
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
    const weights = Object.values(GENESIS_SPARKS_CONFIG.rarityTiers).map(
      (t) => t.weight,
    );
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("should have increasing boosts for higher rarities", () => {
    const { common, uncommon, rare, epic, legendary, mythic } =
      GENESIS_SPARKS_CONFIG.rarityTiers;

    expect(common.boost).toBeLessThan(uncommon.boost);
    expect(uncommon.boost).toBeLessThan(rare.boost);
    expect(rare.boost).toBeLessThan(epic.boost);
    expect(epic.boost).toBeLessThan(legendary.boost);
    expect(legendary.boost).toBeLessThan(mythic.boost);
  });

  it("should have 5 base types", () => {
    const types = Object.keys(GENESIS_SPARKS_CONFIG.baseTypes);
    expect(types).toHaveLength(5);
    expect(types).toEqual(["human", "animal", "robot", "mystic", "alien"]);
  });

  it("should have base type weights that sum to 100", () => {
    const weights = Object.values(GENESIS_SPARKS_CONFIG.baseTypes).map(
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

// EVOLUTION_COSTS tests removed: token-burn evolution was dropped in the
// post-refactor model. Level-up is now XP-only.

describe("LEVEL_BOOSTS", () => {
  it("should have boosts for levels 1..maxLevel", () => {
    for (let level = 1; level <= GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      expect(LEVEL_BOOSTS[level]).toBeDefined();
    }
  });

  it("should have 0% boost at level 1", () => {
    expect(LEVEL_BOOSTS[1]).toBe(0);
  });

  it("should cap at 10% at max level (post-rebalance)", () => {
    expect(LEVEL_BOOSTS[GENESIS_SPARKS_CONFIG.maxLevel]).toBe(10);
  });

  it("should have 2% boost at level 10 (post-rebalance)", () => {
    expect(LEVEL_BOOSTS[10]).toBe(2);
  });
});

// ============================================
// Mining Boost Tests
// ============================================

describe("getMiningBoost", () => {
  // Post-refactor: getMiningBoost is level-only. The rarityTiers.boost field
  // still exists on GENESIS_SPARKS_CONFIG but is no longer applied here.
  const createMockNFT = (
    level: number,
    rarityTier: RarityTier = "common",
  ): SparkNFTState => ({
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

  it("should return LEVEL_BOOSTS[1] (0%) for level 1 NFT", () => {
    const nft = createMockNFT(1, "common");
    expect(getMiningBoost(nft)).toBe(LEVEL_BOOSTS[1]); // 0
  });

  it("should return level-only boost for mid-level NFT (rarity ignored)", () => {
    const nft = createMockNFT(5, "rare");
    expect(getMiningBoost(nft)).toBe(LEVEL_BOOSTS[5]); // 0.5
  });

  it("should ignore rarity at high level (post-refactor)", () => {
    const nft = createMockNFT(10, "mythic");
    expect(getMiningBoost(nft)).toBe(LEVEL_BOOSTS[10]); // 2, not 12
  });

  it("should be invariant under rarity tier (same level, different rarities)", () => {
    const tiers: RarityTier[] = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];

    const boosts = tiers.map((t) => getMiningBoost(createMockNFT(5, t)));
    // All rarities at the same level yield the same boost.
    expect(new Set(boosts).size).toBe(1);
    expect(boosts[0]).toBe(LEVEL_BOOSTS[5]);
  });

  it("should equal LEVEL_BOOSTS[level] for every level 1..maxLevel", () => {
    for (let level = 1; level <= GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      const nft = createMockNFT(level, "common");
      expect(getMiningBoost(nft)).toBe(LEVEL_BOOSTS[level]);
    }
  });
});

// ============================================
// Level Up Tests
// ============================================

describe("canLevelUp", () => {
  const createMockNFT = (level: number, xp: number): SparkNFTState => ({
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
    const nft = createMockNFT(GENESIS_SPARKS_CONFIG.maxLevel, 999999);
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
    for (let level = 1; level < GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      const requiredXp = XP_REQUIREMENTS[level + 1];
      // XP_REQUIREMENTS[maxLevel+1] is intentionally undefined; skip.
      if (requiredXp === undefined) continue;

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
  const createMockNFT = (bloodline: Bloodline): SparkNFTState => ({
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
    const state = spell.outs[0].charms.$00 as SparkNFTState;

    expect(state.dna).toBe(defaultParams.dna);
    expect(state.bloodline).toBe(defaultParams.bloodline);
    expect(state.baseType).toBe(defaultParams.baseType);
    expect(state.rarityTier).toBe(defaultParams.rarityTier);
    expect(state.genesisBlock).toBe(defaultParams.genesisBlock);
    expect(state.tokenId).toBe(defaultParams.tokenId);
  });

  it("should include initial NFT state with correct mutable defaults", () => {
    const spell = createNFTGenesisSpell(defaultParams);
    const state = spell.outs[0].charms.$00 as SparkNFTState;

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
  const mockState: SparkNFTState = {
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
    const newState = spell.outs[0].charms.$00 as SparkNFTState;
    const expectedXpGain = calculateXpGain(mockState); // Royal = 150 XP

    expect(newState.xp).toBe(mockState.xp + expectedXpGain);
    expect(newState.totalXp).toBe(mockState.totalXp + expectedXpGain);
  });

  it("should increment work count in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.workCount).toBe(mockState.workCount + 1);
  });

  it("should update lastWorkBlock in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.lastWorkBlock).toBe(defaultParams.currentBlock);
  });

  it("should preserve immutable fields in output state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.dna).toBe(mockState.dna);
    expect(newState.bloodline).toBe(mockState.bloodline);
    expect(newState.baseType).toBe(mockState.baseType);
    expect(newState.rarityTier).toBe(mockState.rarityTier);
    expect(newState.genesisBlock).toBe(mockState.genesisBlock);
    expect(newState.tokenId).toBe(mockState.tokenId);
  });
});

describe("createNFTWorkSpell", () => {
  const baseState: SparkNFTState = {
    dna: "a".repeat(64),
    bloodline: "royal",
    baseType: "human",
    genesisBlock: 100,
    rarityTier: "common",
    tokenId: 1,
    heritage: 0,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: 100,
    evolutionCount: 0,
    tokensEarned: 0n,
    narrativeRoot: "",
    worldStateRoot: "",
    lastSettleBlock: 0,
    settleCount: 0,
  };

  const defaultParams = {
    appId: "deadbeef".repeat(8),
    appVk: "cafe".repeat(16),
    nftUtxo: { txid: "a".repeat(64), vout: 0 },
    currentState: baseState,
    ownerAddress: "tb1ptestaddress",
    challenge: "1:100",
    difficulty: 16,
    currentBlock: 150,
  };

  it("builds a spell with operation 'work' (PoW-verified, C3 closure)", () => {
    const spell = createNFTWorkSpell(defaultParams);
    expect(spell.version).toBe(2);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.appId}/${defaultParams.appVk}`,
    );
    expect(spell.apps.$00).toContain("deadbeef");
    // public_inputs must expose challenge + difficulty so the contract can
    // re-verify the PoW (not trust the witness).
    expect(spell.public_inputs).toHaveProperty("challenge");
    expect(spell.public_inputs).toHaveProperty("difficulty");
    expect(spell.public_inputs).toHaveProperty("block_height");
  });

  it("references the NFT input UTXO and includes current state", () => {
    const spell = createNFTWorkSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
    expect(spell.ins[0].charms.$00).toEqual(baseState);
  });

  it("emits one output to the owner at dust limit", () => {
    const spell = createNFTWorkSpell(defaultParams);
    expect(spell.outs).toHaveLength(1);
    expect(spell.outs[0].address).toBe(defaultParams.ownerAddress);
    expect(spell.outs[0].sats).toBe(546);
  });

  it("bumps workCount and lastWorkBlock; leaves xp derivation to the contract", () => {
    const spell = createNFTWorkSpell({
      ...defaultParams,
      currentBlock: 200,
    });
    const newState = spell.outs[0].charms.$00 as SparkNFTState;
    // workCount bumps; lastWorkBlock advances to currentBlock.
    expect(newState.workCount).toBe(1);
    expect(newState.lastWorkBlock).toBe(200);
    // XP/totalXp: this spell does NOT compute xp_gain (the contract derives it
    // on-chain via xp_from_difficulty). The builder leaves them unchanged —
    // the caller (buildWorkSpellRequest in Task 1.2) is responsible for bumping
    // xp/totalXp in the outState to match the contract's derived value.
    // Here we only assert the builder doesn't touch them.
    expect(newState.xp).toBe(baseState.xp);
    expect(newState.totalXp).toBe(baseState.totalXp);
  });

  it("preserves immutable identity traits (dna, bloodline, baseType, tokenId)", () => {
    const spell = createNFTWorkSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;
    expect(newState.dna).toBe(baseState.dna);
    expect(newState.bloodline).toBe(baseState.bloodline);
    expect(newState.baseType).toBe(baseState.baseType);
    expect(newState.tokenId).toBe(baseState.tokenId);
    expect(newState.rarityTier).toBe(baseState.rarityTier);
    expect(newState.genesisBlock).toBe(baseState.genesisBlock);
    // Settlement state must NOT advance via work (only via settle op).
    expect(newState.lastSettleBlock).toBe(baseState.lastSettleBlock);
    expect(newState.settleCount).toBe(baseState.settleCount);
  });

  it("exposes PoW inputs in public_inputs so the contract re-verifies on-chain", () => {
    const spell = createNFTWorkSpell(defaultParams);
    expect(spell.public_inputs?.challenge).toBe(defaultParams.challenge);
    expect(spell.public_inputs?.difficulty).toBe(defaultParams.difficulty);
    expect(spell.public_inputs?.block_height).toBe(defaultParams.currentBlock);
  });
});

describe("createNFTLevelUpSpell", () => {
  // Post-refactor: level-up is XP-only. No tokenUtxo, no tokenAmount, no burn.
  const mockState: SparkNFTState = {
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

  const defaultParams = {
    nftAppId: "nft_app",
    nftAppVk: "nft_vk",
    tokenAppId: "token_app",
    tokenAppVk: "token_vk",
    nftUtxo: { txid: "nft_txid", vout: 0 },
    currentState: mockState,
    ownerAddress: "tb1qowner",
  };

  it("should create spell with version 2", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include NFT app reference only (no token app post-refactor)", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.nftAppId}/${defaultParams.nftAppVk}`,
    );
    expect(spell.apps.$01).toBeUndefined();
  });

  it("should have a single NFT input (no token input post-refactor)", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
  });

  it("should reference NFT UTXO correctly", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
    expect(spell.ins[0].charms.$00).toEqual(mockState);
  });

  it("should increment level in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.level).toBe(mockState.level + 1);
  });

  it("should reset XP to 0 in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.xp).toBe(0);
  });

  it("should increment evolution count in output state", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.evolutionCount).toBe(mockState.evolutionCount + 1);
  });

  it("should have a single NFT output (no token change output)", () => {
    // Post-refactor: no token burn → exactly one output (the evolved NFT).
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.outs).toHaveLength(1);
  });

  it("should have dust limit for the NFT output", () => {
    const spell = createNFTLevelUpSpell(defaultParams);

    for (const out of spell.outs) {
      expect(out.sats).toBe(546);
    }
  });

  it("should throw when NFT is already at max level", () => {
    const maxLevelParams = {
      ...defaultParams,
      currentState: { ...mockState, level: GENESIS_SPARKS_CONFIG.maxLevel },
    };

    expect(() => createNFTLevelUpSpell(maxLevelParams)).toThrow(
      /already at max level/,
    );
  });
});
