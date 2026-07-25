/**
 * E2E Full Flow Tests
 *
 * Complete integration tests for the BitcoinBaby ecosystem:
 * - Token minting with PoW
 * - NFT minting
 * - Mining → XP → Evolution cycle
 * - Mining boost application
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SPARK_CONFIG,
  calculateMiningReward,
  formatTokenAmount,
  createTokenMintSpell,
} from "../../src/charms/token";
import {
  GENESIS_SPARKS_CONFIG,
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  calculateXpGain,
  canLevelUp,
  getMiningBoost,
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
  type SparkNFTState,
  type Bloodline,
  type RarityTier,
} from "../../src/charms/nft";

// =============================================================================
// TEST FIXTURES
// =============================================================================

const createMockMiner = () => ({
  address: "tb1qminer_address",
  publicKey:
    "02abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
});

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

const mockAppConfig = {
  tokenAppId: "babtc_app_id",
  tokenAppVk: "babtc_vk",
  nftAppId: "genesis_app_id",
  nftAppVk: "genesis_vk",
};

// =============================================================================
// TOKEN MINTING FLOW
// =============================================================================

describe("E2E: Token Minting Flow", () => {
  const miner = createMockMiner();

  describe("PoW Mining Simulation", () => {
    it("should calculate correct reward for D16 (minimum)", () => {
      const difficulty = 16;
      const reward = calculateMiningReward(difficulty);

      // D16: 1 * 16² / 100 = 2.56 BABTC
      const expectedTotal = (100_000_000n * 256n) / 100n;
      expect(reward.total).toBe(expectedTotal);
    });

    it("should distribute rewards 90/5/5", () => {
      const reward = calculateMiningReward(16);

      const minerPercent = Number((reward.minerShare * 100n) / reward.total);
      const devPercent = Number((reward.devShare * 100n) / reward.total);
      const stakingPercent = Number(
        (reward.stakingShare * 100n) / reward.total,
      );

      expect(minerPercent).toBe(90);
      expect(devPercent).toBe(5);
      expect(stakingPercent).toBe(5);
    });

    it("should format miner share correctly", () => {
      const reward = calculateMiningReward(16);
      const formatted = formatTokenAmount(reward.minerShare);

      // 2.56 * 0.9 = 2.304 BABTC
      expect(formatted).toBe("2.304");
    });
  });

  describe("Mint Spell Generation", () => {
    it("should generate valid token mint spell", () => {
      const spell = createTokenMintSpell({
        appId: mockAppConfig.tokenAppId,
        appVk: mockAppConfig.tokenAppVk,
        minerAddress: miner.address,
        devAddress: SPARK_CONFIG.addresses.devFund,
        stakingAddress: SPARK_CONFIG.addresses.stakingPool,
        leadingZeros: 16,
        workProofHash: "abcdef123456",
      });

      expect(spell.version).toBe(2);
      expect(spell.apps.$00).toContain(mockAppConfig.tokenAppId);
      expect(spell.outs).toHaveLength(3);
    });

    it("should include correct amounts in spell outputs", () => {
      const reward = calculateMiningReward(16);
      const spell = createTokenMintSpell({
        appId: mockAppConfig.tokenAppId,
        appVk: mockAppConfig.tokenAppVk,
        minerAddress: miner.address,
        devAddress: SPARK_CONFIG.addresses.devFund,
        stakingAddress: SPARK_CONFIG.addresses.stakingPool,
        leadingZeros: 16,
        workProofHash: "abcdef123456",
      });

      expect(spell.outs[0].charms.$00).toBe(reward.minerShare);
      expect(spell.outs[1].charms.$00).toBe(reward.devShare);
      expect(spell.outs[2].charms.$00).toBe(reward.stakingShare);
    });
  });

  describe("Higher Difficulty Rewards", () => {
    it("should reward more for D20 than D16", () => {
      const rewardD16 = calculateMiningReward(16);
      const rewardD20 = calculateMiningReward(20);

      expect(rewardD20.total).toBeGreaterThan(rewardD16.total);
    });

    it("should follow quadratic scaling", () => {
      const rewardD16 = calculateMiningReward(16);
      const rewardD24 = calculateMiningReward(24);

      // D24 / D16 should be (24/16)² = 2.25
      const ratio = Number(rewardD24.total) / Number(rewardD16.total);
      expect(ratio).toBeCloseTo(2.25, 1);
    });
  });
});

// =============================================================================
// NFT MINTING FLOW
// =============================================================================

describe("E2E: NFT Minting Flow", () => {
  const miner = createMockMiner();

  describe("Genesis NFT Creation", () => {
    it("should generate valid genesis spell", () => {
      const spell = createNFTGenesisSpell({
        appId: mockAppConfig.nftAppId,
        appVk: mockAppConfig.nftAppVk,
        ownerAddress: miner.address,
        tokenId: 1,
        dna: "abc123def456",
        bloodline: "royal",
        baseType: "human",
        rarityTier: "rare",
        genesisBlock: 100000,
      });

      expect(spell.version).toBe(2);
      expect(spell.apps.$00).toContain(mockAppConfig.nftAppId);
      expect(spell.ins).toHaveLength(0); // Mint from nothing
      expect(spell.outs).toHaveLength(1);
    });

    it("should initialize NFT at level 1 with 0 XP", () => {
      const spell = createNFTGenesisSpell({
        appId: mockAppConfig.nftAppId,
        appVk: mockAppConfig.nftAppVk,
        ownerAddress: miner.address,
        tokenId: 1,
        dna: "abc123def456",
        bloodline: "royal",
        baseType: "human",
        rarityTier: "rare",
        genesisBlock: 100000,
      });

      const nftState = spell.outs[0].charms.$00 as SparkNFTState;
      expect(nftState.level).toBe(1);
      expect(nftState.xp).toBe(0);
      expect(nftState.totalXp).toBe(0);
      expect(nftState.workCount).toBe(0);
    });

    it("should set correct immutable fields", () => {
      const params = {
        appId: mockAppConfig.nftAppId,
        appVk: mockAppConfig.nftAppVk,
        ownerAddress: miner.address,
        tokenId: 42,
        dna: "uniquedna123",
        bloodline: "mystic" as Bloodline,
        baseType: "alien" as const,
        rarityTier: "legendary" as RarityTier,
        genesisBlock: 123456,
      };

      const spell = createNFTGenesisSpell(params);
      const nftState = spell.outs[0].charms.$00 as SparkNFTState;

      expect(nftState.dna).toBe(params.dna);
      expect(nftState.bloodline).toBe(params.bloodline);
      expect(nftState.baseType).toBe(params.baseType);
      expect(nftState.rarityTier).toBe(params.rarityTier);
      expect(nftState.tokenId).toBe(params.tokenId);
      expect(nftState.genesisBlock).toBe(params.genesisBlock);
    });
  });

  describe("Rarity Distribution", () => {
    // Post-refactor note: rarityTiers.weight is still consumed at mint time
    // to pick a rarity deterministically. rarityTiers.boost is still defined
    // as a structural invariant but is NOT applied to mining rewards anymore
    // (see getMiningBoost — level-only). These tests verify the config
    // structure; the behavioural effect of boost is tested in the
    // "Mining Boost Application" section below.

    it("should have correct rarity weights", () => {
      const { rarityTiers } = GENESIS_SPARKS_CONFIG;
      const totalWeight = Object.values(rarityTiers).reduce(
        (sum, tier) => sum + tier.weight,
        0,
      );

      expect(totalWeight).toBe(100);
    });

    it("should have increasing boosts for rarer tiers (structural invariant)", () => {
      const { rarityTiers } = GENESIS_SPARKS_CONFIG;
      const tiers: RarityTier[] = [
        "common",
        "uncommon",
        "rare",
        "epic",
        "legendary",
        "mythic",
      ];

      let prevBoost = 0;
      for (const tier of tiers) {
        expect(rarityTiers[tier].boost).toBeGreaterThan(prevBoost);
        prevBoost = rarityTiers[tier].boost;
      }
    });
  });
});

// =============================================================================
// MINING → XP → EVOLUTION CYCLE
// =============================================================================

describe("E2E: Mining → XP → Evolution Cycle", () => {
  describe("Work Proof Submission", () => {
    it("should add XP based on bloodline", () => {
      const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
      const expectedXp = {
        royal: 150, // 100 * 1.5
        warrior: 120, // 100 * 1.2
        rogue: 100, // 100 * 1.0
        mystic: 130, // 100 * 1.3
      };

      for (const bloodline of bloodlines) {
        const nft = createMockNFT({ bloodline });
        const xpGain = calculateXpGain(nft);
        expect(xpGain).toBe(expectedXp[bloodline]);
      }
    });

    it("should create work proof spell with updated state", () => {
      const nft = createMockNFT({ xp: 50, workCount: 5 });
      const spell = createNFTWorkProofSpell({
        appId: mockAppConfig.nftAppId,
        appVk: mockAppConfig.nftAppVk,
        nftUtxo: { txid: "abc", vout: 0 },
        currentState: nft,
        ownerAddress: "tb1qtest",
        workProofHash: "hash123",
        currentBlock: 100001,
      });

      const newState = spell.outs[0].charms.$00 as SparkNFTState;
      expect(newState.xp).toBeGreaterThan(nft.xp);
      expect(newState.workCount).toBe(nft.workCount + 1);
      expect(newState.lastWorkBlock).toBe(100001);
    });

    it("should accumulate totalXp across work proofs", () => {
      let nft = createMockNFT({ totalXp: 500 });

      // Simulate multiple work proofs
      for (let i = 0; i < 5; i++) {
        const xpGain = calculateXpGain(nft);
        nft = {
          ...nft,
          xp: nft.xp + xpGain,
          totalXp: nft.totalXp + xpGain,
          workCount: nft.workCount + 1,
        };
      }

      // Rogue gets 100 XP per work
      expect(nft.totalXp).toBe(500 + 500); // 500 initial + 5*100
      expect(nft.workCount).toBe(5);
    });
  });

  describe("Evolution Eligibility", () => {
    it("should not allow evolution without sufficient XP", () => {
      const nft = createMockNFT({ level: 1, xp: 50 });
      expect(canLevelUp(nft)).toBe(false);
    });

    it("should allow evolution when XP threshold met", () => {
      const nft = createMockNFT({ level: 1, xp: 100 });
      expect(canLevelUp(nft)).toBe(true);
    });

    it("should have increasing XP requirements per level", () => {
      for (let level = 2; level < 10; level++) {
        expect(XP_REQUIREMENTS[level + 1]).toBeGreaterThan(
          XP_REQUIREMENTS[level],
        );
      }
    });

    it("should not allow evolution at max level", () => {
      const nft = createMockNFT({
        level: GENESIS_SPARKS_CONFIG.maxLevel,
        xp: 100000,
      });
      expect(canLevelUp(nft)).toBe(false);
    });
  });

  describe("Level Up Execution", () => {
    it("should create level up spell with correct state changes", () => {
      const nft = createMockNFT({ level: 1, xp: 100, evolutionCount: 0 });
      const spell = createNFTLevelUpSpell({
        nftAppId: mockAppConfig.nftAppId,
        nftAppVk: mockAppConfig.nftAppVk,
        tokenAppId: mockAppConfig.tokenAppId,
        tokenAppVk: mockAppConfig.tokenAppVk,
        nftUtxo: { txid: "nft", vout: 0 },
        currentState: nft,
        ownerAddress: "tb1qtest",
      });

      const newState = spell.outs[0].charms.$00 as SparkNFTState;
      expect(newState.level).toBe(2);
      expect(newState.xp).toBe(0); // Reset
      expect(newState.evolutionCount).toBe(1);
    });

    // Post-refactor: 'should burn correct token amount for each level' and
    // 'should return excess tokens as change' were removed. Level-up is now
    // XP-only — there is no token burn and therefore no "excess as change"
    // path. The new state-transition coverage lives in the test above and in
    // packages/bitcoin/tests/charms/{nft,evolution}.test.ts.
  });
});

// =============================================================================
// MINING BOOST APPLICATION
// =============================================================================

describe("E2E: Mining Boost Application", () => {
  describe("Level-based Boosts", () => {
    it("should increase boost with level", () => {
      let prevBoost = 0;
      for (let level = 1; level <= GENESIS_SPARKS_CONFIG.maxLevel; level++) {
        const nft = createMockNFT({ level, rarityTier: "common" });
        const boost = getMiningBoost(nft);
        expect(boost).toBeGreaterThanOrEqual(prevBoost);
        prevBoost = boost;
      }
    });

    it("should be 2% at level 10 (post-rebalance)", () => {
      // Pre-refactor this was 'cap at 4% for level 10' — the level table
      // was rebalanced to scale 0% -> 10% over 21 levels instead of
      // 0% -> 4% over 10 levels. The cap (10%) is now reached only at
      // maxLevel (21).
      expect(LEVEL_BOOSTS[10]).toBe(2);
    });

    it("should cap at 10% at max level (21)", () => {
      expect(LEVEL_BOOSTS[GENESIS_SPARKS_CONFIG.maxLevel]).toBe(10);
    });
  });

  // Post-refactor: the entire 'Rarity-based Boosts' subsection was removed.
  // getMiningBoost is now level-only — rarity no longer contributes to
  // mining rewards. Coverage of "rarity does not affect boost" lives in
  // packages/bitcoin/tests/charms/{nft,evolution}.test.ts.

  describe("Boost Impact on Mining", () => {
    it("should increase effective mining reward with boost", () => {
      const baseReward = calculateMiningReward(16);
      const boost = LEVEL_BOOSTS[GENESIS_SPARKS_CONFIG.maxLevel]; // 10
      const boostMultiplier = 1 + boost / 100;

      const effectiveReward = BigInt(
        Math.floor(Number(baseReward.minerShare) * boostMultiplier),
      );

      expect(effectiveReward).toBeGreaterThan(baseReward.minerShare);
    });
  });
});

// =============================================================================
// FULL CYCLE TEST
// =============================================================================

describe("E2E: Complete Lifecycle", () => {
  it("should progress: mint → mine → level up → get more rewards", () => {
    const miner = createMockMiner();

    // Step 1: Mint initial tokens at D16
    const initialReward = calculateMiningReward(16);
    expect(initialReward.minerShare).toBeGreaterThan(0n);

    // Step 2: Mint NFT
    const nftSpell = createNFTGenesisSpell({
      appId: mockAppConfig.nftAppId,
      appVk: mockAppConfig.nftAppVk,
      ownerAddress: miner.address,
      tokenId: 1,
      dna: "abc123",
      bloodline: "royal",
      baseType: "human",
      rarityTier: "rare",
      genesisBlock: 100000,
    });
    let nft = nftSpell.outs[0].charms.$00 as SparkNFTState;

    // Verify initial state — level 1 boost is LEVEL_BOOSTS[1] = 0
    expect(nft.level).toBe(1);
    expect(getMiningBoost(nft)).toBe(LEVEL_BOOSTS[1]);

    // Step 3: Submit work proofs to gain XP
    const xpPerWork = calculateXpGain(nft); // 150 for Royal
    const worksNeeded = Math.ceil(XP_REQUIREMENTS[2] / xpPerWork);

    for (let i = 0; i < worksNeeded; i++) {
      nft = {
        ...nft,
        xp: nft.xp + xpPerWork,
        totalXp: nft.totalXp + xpPerWork,
        workCount: nft.workCount + 1,
      };
    }

    expect(canLevelUp(nft)).toBe(true);

    // Step 4: Level up is XP-only post-refactor (no token burn).

    // After level up (simulated)
    const upgradedNft = {
      ...nft,
      level: 2,
      xp: 0,
      evolutionCount: 1,
    };

    // Step 5: Verify improved boost
    const newBoost = getMiningBoost(upgradedNft);
    const oldBoost = getMiningBoost({ ...nft, level: 1 });
    expect(newBoost).toBeGreaterThan(oldBoost);

    // Step 6: New mining rewards are higher
    const effectiveReward = (reward: bigint, boost: number) =>
      BigInt(Math.floor(Number(reward) * (1 + boost / 100)));

    const rewardBefore = effectiveReward(initialReward.minerShare, oldBoost);
    const rewardAfter = effectiveReward(initialReward.minerShare, newBoost);

    expect(rewardAfter).toBeGreaterThan(rewardBefore);
  });
});

// =============================================================================
// TOKENOMICS VALIDATION
// =============================================================================

describe("E2E: Tokenomics Validation", () => {
  it("should validate max supply is 21B SPARK", () => {
    const maxSupply = SPARK_CONFIG.maxSupply;
    const expectedMaxSupply = 21_000_000_000n * 100_000_000n;

    expect(maxSupply).toBe(expectedMaxSupply);
  });

  it("should validate NFT max supply is 10,000", () => {
    expect(GENESIS_SPARKS_CONFIG.maxSupply).toBe(10_000);
  });

  // Post-refactor: 'should validate evolution creates token sink' was
  // removed. Token-burn evolution was dropped, so leveling up no longer
  // removes SPARK from circulation. There is currently no other built-in
  // SPARK sink in the model; if one is reintroduced (e.g. fee-burn,
  // cosmetic upgrades), this test should be revived against that path.

  it("should validate max level is 21 (post-refactor: extended from 10)", () => {
    expect(GENESIS_SPARKS_CONFIG.maxLevel).toBe(21);
  });
});
