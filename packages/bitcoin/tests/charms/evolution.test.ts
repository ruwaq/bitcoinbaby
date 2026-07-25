/**
 * Evolution Service Tests
 *
 * Tests for NFT evolution system: XP gain, level-up, and spell generation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EvolutionService,
  EvolutionError,
  createEvolutionService,
  type EvolutionServiceOptions,
} from "../../src/charms/evolution";
import {
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  GENESIS_SPARKS_CONFIG,
  calculateXpGain,
  canLevelUp,
  getMiningBoost,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
  type SparkNFTState,
  type Bloodline,
} from "../../src/charms/nft";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createMockNFT = (
  overrides: Partial<SparkNFTState> = {},
): SparkNFTState => ({
  dna: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  bloodline: "rogue",
  baseType: "human",
  genesisBlock: 100000,
  rarityTier: "common",
  tokenId: 1,
  level: 1,
  xp: 0,
  totalXp: 0,
  workCount: 0,
  lastWorkBlock: 100000,
  evolutionCount: 0,
  tokensEarned: 0n,
  ...overrides,
});

const mockCharmsClient = {
  getOwnedNFTs: vi.fn(),
  getBlockHeight: vi.fn(),
  getFeeEstimates: vi.fn(),
};

const defaultOptions: EvolutionServiceOptions = {
  nftAppId: "test_nft_app_id",
  nftAppVk: "test_nft_vk",
  tokenAppId: "test_token_app_id",
  tokenAppVk: "test_token_vk",
};

// =============================================================================
// XP REQUIREMENTS TESTS
// =============================================================================

describe("XP_REQUIREMENTS", () => {
  it("should have requirements for levels 2-10", () => {
    for (let level = 2; level <= 10; level++) {
      expect(XP_REQUIREMENTS[level]).toBeDefined();
      expect(XP_REQUIREMENTS[level]).toBeGreaterThan(0);
    }
  });

  it("should have increasing XP requirements", () => {
    let prevXp = 0;
    for (let level = 2; level <= 10; level++) {
      expect(XP_REQUIREMENTS[level]).toBeGreaterThan(prevXp);
      prevXp = XP_REQUIREMENTS[level];
    }
  });

  it("should have correct specific values", () => {
    expect(XP_REQUIREMENTS[2]).toBe(100);
    expect(XP_REQUIREMENTS[5]).toBe(1000);
    expect(XP_REQUIREMENTS[10]).toBe(32000);
  });
});

// =============================================================================
// EVOLUTION COSTS TESTS
// (removed: token-burn evolution was dropped in the post-refactor model;
//  level-up is now gated purely by XP — see EVOLUTION_COSTS removal in
//  packages/bitcoin/src/charms/{nft,evolution}.ts)
// =============================================================================

// =============================================================================
// LEVEL BOOSTS TESTS
// =============================================================================

describe("LEVEL_BOOSTS", () => {
  it("should have boosts for levels 1..maxLevel", () => {
    for (let level = 1; level <= GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      expect(LEVEL_BOOSTS[level]).toBeDefined();
    }
  });

  it("should start at 0% for level 1", () => {
    expect(LEVEL_BOOSTS[1]).toBe(0);
  });

  it("should cap at 10% at max level (21)", () => {
    expect(LEVEL_BOOSTS[GENESIS_SPARKS_CONFIG.maxLevel]).toBe(10);
  });

  it("should be 2% at level 10 (post-rebalance)", () => {
    expect(LEVEL_BOOSTS[10]).toBe(2);
  });

  it("should increase (weakly) with level", () => {
    let prevBoost = -1;
    for (let level = 1; level <= GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      expect(LEVEL_BOOSTS[level]).toBeGreaterThanOrEqual(prevBoost);
      prevBoost = LEVEL_BOOSTS[level];
    }
  });
});

// =============================================================================
// calculateXpGain TESTS
// =============================================================================

describe("calculateXpGain", () => {
  const baseXp = 100;

  it("should return base XP for rogue bloodline (1.0x)", () => {
    const nft = createMockNFT({ bloodline: "rogue" });
    expect(calculateXpGain(nft)).toBe(baseXp * 1.0);
  });

  it("should return 1.5x XP for royal bloodline", () => {
    const nft = createMockNFT({ bloodline: "royal" });
    expect(calculateXpGain(nft)).toBe(Math.floor(baseXp * 1.5));
  });

  it("should return 1.2x XP for warrior bloodline", () => {
    const nft = createMockNFT({ bloodline: "warrior" });
    expect(calculateXpGain(nft)).toBe(Math.floor(baseXp * 1.2));
  });

  it("should return 1.3x XP for mystic bloodline", () => {
    const nft = createMockNFT({ bloodline: "mystic" });
    expect(calculateXpGain(nft)).toBe(Math.floor(baseXp * 1.3));
  });

  it("should apply bloodline multipliers correctly", () => {
    const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
    const multipliers = { royal: 1.5, warrior: 1.2, rogue: 1.0, mystic: 1.3 };

    for (const bloodline of bloodlines) {
      const nft = createMockNFT({ bloodline });
      const expected = Math.floor(baseXp * multipliers[bloodline]);
      expect(calculateXpGain(nft)).toBe(expected);
    }
  });
});

// =============================================================================
// canLevelUp TESTS
// =============================================================================

describe("canLevelUp", () => {
  it("should return false for level 1 with 0 XP", () => {
    const nft = createMockNFT({ level: 1, xp: 0 });
    expect(canLevelUp(nft)).toBe(false);
  });

  it("should return false when XP is below threshold", () => {
    const nft = createMockNFT({ level: 1, xp: 99 });
    expect(canLevelUp(nft)).toBe(false);
  });

  it("should return true when XP meets threshold", () => {
    const nft = createMockNFT({ level: 1, xp: 100 });
    expect(canLevelUp(nft)).toBe(true);
  });

  it("should return true when XP exceeds threshold", () => {
    const nft = createMockNFT({ level: 1, xp: 150 });
    expect(canLevelUp(nft)).toBe(true);
  });

  it("should return false at max level", () => {
    const nft = createMockNFT({
      level: GENESIS_SPARKS_CONFIG.maxLevel,
      xp: 100000,
    });
    expect(canLevelUp(nft)).toBe(false);
  });

  it("should check correct threshold for each level", () => {
    // XP_REQUIREMENTS is defined for levels 2..maxLevel (i.e. the XP needed
    // to *reach* level N from N-1). So the last meaningful entry is
    // XP_REQUIREMENTS[maxLevel]; there is no XP_REQUIREMENTS[maxLevel+1]
    // because the NFT cannot level past maxLevel.
    for (let level = 1; level < GENESIS_SPARKS_CONFIG.maxLevel; level++) {
      const requiredXp = XP_REQUIREMENTS[level + 1];
      // Level 20 -> XP_REQUIREMENTS[21] is intentionally undefined
      // (no path beyond max); skip it.
      if (requiredXp === undefined) continue;

      const cannotLevelUp = createMockNFT({ level, xp: requiredXp - 1 });
      expect(canLevelUp(cannotLevelUp)).toBe(false);

      const canLevel = createMockNFT({ level, xp: requiredXp });
      expect(canLevelUp(canLevel)).toBe(true);
    }
  });
});

// =============================================================================
// getMiningBoost TESTS
// =============================================================================

describe("getMiningBoost", () => {
  // Post-refactor: getMiningBoost is level-only. Rarity tiers still exist on
  // GENESIS_SPARKS_CONFIG for mint-time weighting, but their `boost` field no
  // longer affects mining rewards.

  it("should return 0% for level 1 NFT (any rarity)", () => {
    const nft = createMockNFT({ level: 1, rarityTier: "common" });
    const boost = getMiningBoost(nft);
    expect(boost).toBe(LEVEL_BOOSTS[1]); // 0
  });

  it("should return level boost only for mid-level NFT", () => {
    const nft = createMockNFT({ level: 5, rarityTier: "rare" });
    const boost = getMiningBoost(nft);
    expect(boost).toBe(LEVEL_BOOSTS[5]); // 0.5
  });

  it("should return level boost for level 10 regardless of rarity", () => {
    const nft = createMockNFT({ level: 10, rarityTier: "mythic" });
    const boost = getMiningBoost(nft);
    expect(boost).toBe(LEVEL_BOOSTS[10]); // 2 (level-only now)
  });

  it("should ignore rarity tier entirely (post-refactor)", () => {
    // Same level, different rarities → same boost
    const common = createMockNFT({ level: 7, rarityTier: "common" });
    const mythic = createMockNFT({ level: 7, rarityTier: "mythic" });
    expect(getMiningBoost(common)).toBe(getMiningBoost(mythic));
    expect(getMiningBoost(common)).toBe(LEVEL_BOOSTS[7]);
  });
});

// =============================================================================
// createNFTWorkProofSpell TESTS
// =============================================================================

describe("createNFTWorkProofSpell", () => {
  const defaultParams = {
    appId: "test_app_id",
    appVk: "test_vk",
    nftUtxo: { txid: "abc123", vout: 0 },
    currentState: createMockNFT({ xp: 50, totalXp: 500, workCount: 5 }),
    ownerAddress: "tb1qowner",
    workProofHash: "deadbeef",
    currentBlock: 100100,
  };

  it("should create spell with version 2", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include NFT app reference", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.appId}/${defaultParams.appVk}`,
    );
  });

  it("should include work proof hash in public inputs", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.public_inputs?.work_proof).toBe(defaultParams.workProofHash);
  });

  it("should include block height in public inputs", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.public_inputs?.block_height).toBe(defaultParams.currentBlock);
  });

  it("should have one input with current state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
  });

  it("should have one output with updated state", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    expect(spell.outs).toHaveLength(1);
    expect(spell.outs[0].address).toBe(defaultParams.ownerAddress);
  });

  it("should add XP to state based on bloodline, capped at next level requirement", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const xpGain = calculateXpGain(defaultParams.currentState); // 100 for rogue
    const nextLevelReq = XP_REQUIREMENTS[defaultParams.currentState.level + 1]; // 100
    const rawNewXp = defaultParams.currentState.xp + xpGain; // 50 + 100 = 150
    const expectedXp = Math.min(rawNewXp, nextLevelReq); // min(150, 100) = 100
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    // XP is capped at the next level's requirement to prevent overflow
    expect(newState.xp).toBe(expectedXp); // 100 (capped)
    // totalXp always accumulates the real gain (no cap)
    expect(newState.totalXp).toBe(defaultParams.currentState.totalXp + xpGain);
  });

  it("should NOT cap XP when total stays below next level requirement", () => {
    // NFT with royal bloodline (1.5x) at xp=0: gains 150, cap is 100 → capped
    // Use xp=0, rogue (100 gain), but cap is 100 → still capped
    // For a test without cap: use xp=0, cap=100, gain=50 (impossible with current bloodlines)
    // Instead: NFT at level 1, xp=30, royal bloodline → gain=150, raw=180, cap=100 → capped
    // For no-cap test: use NFT at level 9 (cap=32000), xp=0, rogue → gain=100 → no cap
    const highCapState = createMockNFT({ level: 9, xp: 0, bloodline: "rogue" });
    const params = { ...defaultParams, currentState: highCapState };
    const spell = createNFTWorkProofSpell(params);
    const xpGain = calculateXpGain(highCapState); // 100
    const nextLevelReq = XP_REQUIREMENTS[10]; // 32000
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    // 0 + 100 = 100 < 32000, so no cap applied
    expect(newState.xp).toBe(xpGain); // 100, no cap
    expect(newState.totalXp).toBe(xpGain);
  });

  it("should increment work count", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.workCount).toBe(defaultParams.currentState.workCount + 1);
  });

  it("should update lastWorkBlock", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.lastWorkBlock).toBe(defaultParams.currentBlock);
  });

  it("should preserve immutable fields", () => {
    const spell = createNFTWorkProofSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.dna).toBe(defaultParams.currentState.dna);
    expect(newState.bloodline).toBe(defaultParams.currentState.bloodline);
    expect(newState.tokenId).toBe(defaultParams.currentState.tokenId);
    expect(newState.genesisBlock).toBe(defaultParams.currentState.genesisBlock);
  });
});

// =============================================================================
// createNFTLevelUpSpell TESTS
// =============================================================================

describe("createNFTLevelUpSpell", () => {
  const currentState = createMockNFT({
    level: 1,
    xp: 100,
    evolutionCount: 0,
  });

  const defaultParams = {
    nftAppId: "test_nft_app_id",
    nftAppVk: "test_nft_vk",
    tokenAppId: "test_token_app_id",
    tokenAppVk: "test_token_vk",
    nftUtxo: { txid: "nft123", vout: 0 },
    currentState,
    ownerAddress: "tb1qowner",
  };

  it("should create spell with version 2", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.version).toBe(2);
  });

  it("should include NFT app reference only (post-refactor: no token app)", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.apps.$00).toBe(
      `n/${defaultParams.nftAppId}/${defaultParams.nftAppVk}`,
    );
    // Post-refactor: level-up no longer burns tokens, so there is no
    // t/<tokenApp> reference in the spell apps.
    expect(spell.apps.$01).toBeUndefined();
  });

  it("should have a single NFT input (post-refactor: no token input)", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.ins).toHaveLength(1);
    expect(spell.ins[0].utxo_id).toBe(
      `${defaultParams.nftUtxo.txid}:${defaultParams.nftUtxo.vout}`,
    );
  });

  it("should increment level", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.level).toBe(currentState.level + 1);
  });

  it("should reset XP to 0", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.xp).toBe(0);
  });

  it("should increment evolutionCount", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.evolutionCount).toBe(currentState.evolutionCount + 1);
  });

  it("should have a single NFT output (no token change output)", () => {
    // Post-refactor: level-up is XP-only, no token transfer → exactly 1 output.
    const spell = createNFTLevelUpSpell(defaultParams);
    expect(spell.outs).toHaveLength(1);
    expect(spell.outs[0].charms.$00).toBeDefined();
    expect(spell.outs[0].charms.$01).toBeUndefined();
  });

  it("should preserve immutable fields", () => {
    const spell = createNFTLevelUpSpell(defaultParams);
    const newState = spell.outs[0].charms.$00 as SparkNFTState;

    expect(newState.dna).toBe(currentState.dna);
    expect(newState.bloodline).toBe(currentState.bloodline);
    expect(newState.tokenId).toBe(currentState.tokenId);
    expect(newState.rarityTier).toBe(currentState.rarityTier);
  });
});

// =============================================================================
// EvolutionService TESTS
// =============================================================================

describe("EvolutionService", () => {
  let service: EvolutionService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCharmsClient.getBlockHeight.mockResolvedValue(100000);
    mockCharmsClient.getFeeEstimates.mockResolvedValue({
      fastestFee: 20,
      halfHourFee: 10,
      hourFee: 5,
    });
    service = createEvolutionService(mockCharmsClient as any, defaultOptions);
  });

  describe("getEvolutionStatus", () => {
    it("should return correct status for level 1 NFT", () => {
      const nft = createMockNFT({ level: 1, xp: 50 });
      const status = service.getEvolutionStatus(nft);

      expect(status.currentLevel).toBe(1);
      expect(status.nextLevel).toBe(1); // Can't level up yet
      expect(status.currentXp).toBe(50);
      expect(status.xpRequired).toBe(XP_REQUIREMENTS[2]);
      expect(status.canEvolve).toBe(false);
    });

    it("should show canEvolve when XP threshold met", () => {
      const nft = createMockNFT({ level: 1, xp: 100 });
      const status = service.getEvolutionStatus(nft);

      expect(status.canEvolve).toBe(true);
      expect(status.nextLevel).toBe(2);
      // Post-refactor: no tokenCost field (XP-only gating)
      expect((status as any).tokenCost).toBeUndefined();
    });

    it("should calculate xpProgress correctly", () => {
      const nft = createMockNFT({ level: 1, xp: 50 });
      const status = service.getEvolutionStatus(nft);

      // 50 / 100 = 50%
      expect(status.xpProgress).toBe(50);
    });

    it("should show boost gain correctly (level-only, post-refactor)", () => {
      const nft = createMockNFT({ level: 1, xp: 100, rarityTier: "common" });
      const status = service.getEvolutionStatus(nft);

      // currentBoost = getMiningBoost(nft) = LEVEL_BOOSTS[1] = 0
      expect(status.currentBoost).toBe(LEVEL_BOOSTS[1]); // 0
      // nextBoost = LEVEL_BOOSTS[2] (rarity no longer contributes)
      expect(status.nextBoost).toBe(LEVEL_BOOSTS[2]);
      // boostGain = nextBoost - currentBoost
      expect(status.boostGain).toBe(LEVEL_BOOSTS[2] - LEVEL_BOOSTS[1]);
    });
  });

  describe("createWorkProofSpell", () => {
    it("should generate valid work proof spell", async () => {
      const nft = createMockNFT();
      const spell = await service.createWorkProofSpell({
        nftUtxo: { txid: "abc", vout: 0 },
        currentState: nft,
        ownerAddress: "tb1qtest",
        workProofHash: "hash123",
      });

      expect(spell.version).toBe(2);
      expect(spell.apps.$00).toContain(defaultOptions.nftAppId);
    });
  });

  describe("createLevelUpSpell", () => {
    it("should throw EvolutionError if insufficient XP", async () => {
      const nft = createMockNFT({ level: 1, xp: 50 });

      await expect(
        service.createLevelUpSpell({
          nftUtxo: { txid: "nft", vout: 0 },
          currentState: nft,
          ownerAddress: "tb1qtest",
        }),
      ).rejects.toThrow(EvolutionError);
    });

    // Post-refactor: 'insufficient tokens' test removed — level-up is XP-only,
    // there is no token-burn path to be insufficient.

    it("should generate valid level up spell when conditions met", async () => {
      const nft = createMockNFT({ level: 1, xp: 100 });
      const spell = await service.createLevelUpSpell({
        nftUtxo: { txid: "nft", vout: 0 },
        currentState: nft,
        ownerAddress: "tb1qtest",
      });

      expect(spell.version).toBe(2);
      expect(spell.apps.$00).toContain(defaultOptions.nftAppId);
      // Post-refactor: spell only references the NFT app.
      expect(spell.apps.$01).toBeUndefined();
    });
  });
});
