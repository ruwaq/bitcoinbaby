/**
 * Genesis Babies NFT Types
 *
 * NFT configuration and types for the Genesis Babies collection.
 * Separate from token, provides mining boosts and evolution.
 */

import type { SpellV2, AppType } from "./types";

// =============================================================================
// NFT CONFIGURATION
// =============================================================================

/**
 * Genesis Babies NFT Configuration
 */
export const GENESIS_BABIES_CONFIG = {
  name: "Genesis Babies",
  symbol: "GBABY",
  maxSupply: 10_000,
  appType: "n" as AppType,

  // Rarity tiers
  // BALANCED: Low individual values, incentivizes collecting multiple NFTs
  rarityTiers: {
    common: { weight: 50, boost: 0.5 },
    uncommon: { weight: 25, boost: 1 },
    rare: { weight: 15, boost: 2 },
    epic: { weight: 7, boost: 3 },
    legendary: { weight: 2.5, boost: 5 },
    mythic: { weight: 0.5, boost: 8 },
  },

  // Base types
  baseTypes: {
    human: { weight: 70, name: "Human Baby" },
    animal: { weight: 15, name: "Animal Baby" },
    robot: { weight: 5, name: "Robot Baby" },
    mystic: { weight: 9, name: "Mystic Baby" },
    alien: { weight: 1, name: "Alien Baby" },
  },

  // Max level
  maxLevel: 10,
} as const;

// =============================================================================
// NFT STATE
// =============================================================================

/**
 * Bloodline types determine base multipliers
 */
export type Bloodline = "royal" | "warrior" | "rogue" | "mystic";

/**
 * Rarity tier
 */
export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Base type of the baby
 */
export type BaseType = "human" | "animal" | "robot" | "mystic" | "alien";

/**
 * Complete NFT state stored in Charm UTXO
 */
export interface BabyNFTState {
  // Immutable (set at genesis, never changes)
  readonly dna: string; // Deterministic hash for visuals
  readonly bloodline: Bloodline;
  readonly baseType: BaseType;
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number; // 1-10000

  // Mutable (evolves with gameplay)
  level: number; // 1-10
  xp: number; // 0-999 per level
  totalXp: number; // Accumulated lifetime XP
  workCount: number; // Total PoUW tasks completed
  lastWorkBlock: number; // Block of last work submission
  evolutionCount: number; // Times evolved
  tokensEarned: bigint; // Lifetime BABTC earned
}

/**
 * Simplified NFT info for display
 */
export interface BabyNFTInfo {
  tokenId: number;
  name: string;
  level: number;
  xp: number;
  rarityTier: RarityTier;
  baseType: BaseType;
  boost: number;
  imageUri: string;
}

// =============================================================================
// EVOLUTION SYSTEM
// =============================================================================

/**
 * XP required for each level
 */
export const XP_REQUIREMENTS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 8000,
  9: 16000,
  10: 32000,
};

/**
 * BABTC burn cost for evolution (in base units with 8 decimals)
 */
export const EVOLUTION_COSTS: Record<number, bigint> = {
  2: 100n * 100_000_000n, // 100 BABTC
  3: 250n * 100_000_000n,
  4: 500n * 100_000_000n,
  5: 1000n * 100_000_000n,
  6: 2500n * 100_000_000n,
  7: 5000n * 100_000_000n,
  8: 10000n * 100_000_000n,
  9: 25000n * 100_000_000n,
  10: 50000n * 100_000_000n,
};

/**
 * Mining boost percentage by level
 * BALANCED: Very gradual progression, max 4% at level 10
 * Leveling is expensive (burns tokens), so boost is modest
 */
export const LEVEL_BOOSTS: Record<number, number> = {
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

/**
 * Get total mining boost for an NFT
 * Combines level boost + rarity boost
 */
export function getMiningBoost(nft: BabyNFTState): number {
  const levelBoost = LEVEL_BOOSTS[nft.level] || 0;
  const rarityBoost =
    GENESIS_BABIES_CONFIG.rarityTiers[nft.rarityTier]?.boost || 0;

  // Boosts are additive
  return levelBoost + rarityBoost;
}

/**
 * Check if NFT can level up
 */
export function canLevelUp(nft: BabyNFTState): boolean {
  if (nft.level >= GENESIS_BABIES_CONFIG.maxLevel) {
    return false;
  }

  const requiredXp = XP_REQUIREMENTS[nft.level + 1];
  return nft.xp >= requiredXp;
}

/**
 * Calculate XP gained from work
 * Base: 100 XP, modified by bloodline
 */
export function calculateXpGain(nft: BabyNFTState): number {
  const baseXp = 100;

  const bloodlineMultipliers: Record<Bloodline, number> = {
    royal: 1.5,
    warrior: 1.2,
    rogue: 1.0,
    mystic: 1.3,
  };

  return Math.floor(baseXp * bloodlineMultipliers[nft.bloodline]);
}

// =============================================================================
// DNA & TRAITS
// =============================================================================

/**
 * Trait categories for generation
 */
export interface TraitSet {
  background: string;
  body: string;
  eyes: string;
  mouth: string;
  accessories: string[];
  effects: string | null;
}

/**
 * Generate deterministic traits from DNA
 */
export function getTraitsFromDNA(dna: string): TraitSet {
  // DNA is a 64-char hex string
  // Each section determines a trait

  const sections = {
    background: dna.slice(0, 4),
    body: dna.slice(4, 8),
    eyes: dna.slice(8, 12),
    mouth: dna.slice(12, 16),
    accessory1: dna.slice(16, 20),
    accessory2: dna.slice(20, 24),
    effects: dna.slice(24, 28),
  };

  // Convert hex to trait indices (simplified)
  const toIndex = (hex: string, max: number) => parseInt(hex, 16) % max;

  return {
    background: `bg_${toIndex(sections.background, 25)}`,
    body: `body_${toIndex(sections.body, 5)}`, // 5 base types
    eyes: `eyes_${toIndex(sections.eyes, 20)}`,
    mouth: `mouth_${toIndex(sections.mouth, 15)}`,
    accessories: [
      `acc_${toIndex(sections.accessory1, 40)}`,
      toIndex(sections.accessory2, 100) < 30
        ? `acc_${toIndex(sections.accessory2, 40)}`
        : "", // 30% chance of second accessory
    ].filter(Boolean),
    effects:
      toIndex(sections.effects, 100) < 30
        ? `effect_${toIndex(sections.effects, 20)}`
        : null, // 30% chance of effect
  };
}

/**
 * Calculate rarity score from traits
 */
export function calculateRarityScore(traits: TraitSet): number {
  let score = 0;

  // More accessories = rarer
  score += traits.accessories.length * 20;

  // Effects are rare
  if (traits.effects) {
    score += 50;
  }

  // Certain trait indices are rarer
  const bodyIndex = parseInt(traits.body.split("_")[1]);
  if (bodyIndex === 4)
    score += 100; // Alien
  else if (bodyIndex === 3)
    score += 50; // Mystic
  else if (bodyIndex === 2) score += 30; // Robot

  return score;
}

// =============================================================================
// SPELL GENERATION
// =============================================================================

/**
 * NFT genesis (mint) spell parameters
 */
export interface NFTGenesisParams {
  appId: string;
  appVk: string;
  ownerAddress: string;
  tokenId: number;
  dna: string;
  bloodline: Bloodline;
  baseType: BaseType;
  rarityTier: RarityTier;
  genesisBlock: number;
}

/**
 * Generate NFT genesis spell
 */
export function createNFTGenesisSpell(params: NFTGenesisParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;

  const initialState: BabyNFTState = {
    dna: params.dna,
    bloodline: params.bloodline,
    baseType: params.baseType,
    genesisBlock: params.genesisBlock,
    rarityTier: params.rarityTier,
    tokenId: params.tokenId,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: params.genesisBlock,
    evolutionCount: 0,
    tokensEarned: 0n,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    ins: [], // Mint from nothing
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: initialState,
        },
        sats: 546,
      },
    ],
  };
}

/**
 * Work proof spell parameters (XP gain)
 */
export interface NFTWorkProofParams {
  appId: string;
  appVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: BabyNFTState;
  ownerAddress: string;
  workProofHash: string;
  currentBlock: number;
}

/**
 * Generate work proof spell (adds XP)
 */
export function createNFTWorkProofSpell(params: NFTWorkProofParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;
  const xpGain = calculateXpGain(params.currentState);

  const newState: BabyNFTState = {
    ...params.currentState,
    xp: params.currentState.xp + xpGain,
    totalXp: params.currentState.totalXp + xpGain,
    workCount: params.currentState.workCount + 1,
    lastWorkBlock: params.currentBlock,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    public_inputs: {
      work_proof: params.workProofHash,
      block_height: params.currentBlock,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}

/**
 * Level up spell parameters
 */
export interface NFTLevelUpParams {
  nftAppId: string;
  nftAppVk: string;
  tokenAppId: string;
  tokenAppVk: string;
  nftUtxo: { txid: string; vout: number };
  tokenUtxo: { txid: string; vout: number };
  currentState: BabyNFTState;
  tokenAmount: bigint;
  ownerAddress: string;
}

/**
 * Generate level up spell (burns tokens, increases level)
 */
export function createNFTLevelUpSpell(params: NFTLevelUpParams): SpellV2 {
  const nftAppRef = `n/${params.nftAppId}/${params.nftAppVk}`;
  const tokenAppRef = `t/${params.tokenAppId}/${params.tokenAppVk}`;

  const nextLevel = params.currentState.level + 1;
  const burnCost = EVOLUTION_COSTS[nextLevel];
  const remainingTokens = params.tokenAmount - burnCost;

  const newState: BabyNFTState = {
    ...params.currentState,
    level: nextLevel,
    xp: 0, // Reset XP
    evolutionCount: params.currentState.evolutionCount + 1,
  };

  const outs: SpellV2["outs"] = [
    {
      address: params.ownerAddress,
      charms: {
        $00: newState,
      },
      sats: 546,
    },
  ];

  // Add remaining tokens if any
  if (remainingTokens > 0n) {
    outs.push({
      address: params.ownerAddress,
      charms: {
        $01: Number(remainingTokens),
      },
      sats: 546,
    });
  }

  // Burned tokens don't appear in outputs (they're consumed)

  return {
    version: 2,
    apps: {
      $00: nftAppRef,
      $01: tokenAppRef,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
      {
        utxo_id: `${params.tokenUtxo.txid}:${params.tokenUtxo.vout}`,
        charms: {
          $01: Number(params.tokenAmount),
        },
      },
    ],
    outs,
  };
}
