/**
 * NFT Types for UI Components
 *
 * Imports canonical types from @bitcoinbaby/core and extends them
 * for UI-specific visualization needs.
 */

// Import canonical on-chain types
import type {
  Bloodline as CoreBloodline,
  BaseType as CoreBaseType,
  RarityTier,
  HeritageSeed,
  SparkNFTState as CoreSparkNFTState,
} from "@bitcoinbaby/core";

// Re-export canonical types
export type { RarityTier, HeritageSeed };
export type { CoreSparkNFTState };

// =============================================================================
// EXTENDED UI TYPES
// These extend the on-chain types for visualization purposes only.
// =============================================================================

/**
 * Extended Bloodline for UI visualization
 */
export type Bloodline = CoreBloodline | "scholar" | "merchant";

/**
 * Extended BaseType for UI visualization
 */
export type BaseType = CoreBaseType | "shaman" | "elemental" | "dragon";

/**
 * UI-extended NFT state that supports both canonical and extended types
 */
export interface SparkNFTState {
  readonly dna: string;
  readonly bloodline: Bloodline;
  readonly baseType: BaseType;
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number;
  readonly heritage: number;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: bigint;
  narrativeRoot: string;
  worldStateRoot: string;
}

export interface SparkNFTInfo {
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
// CONSTANTS
// =============================================================================

export const MAX_LEVEL = 21;

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
  11: 48000,
  12: 64000,
  13: 96000,
  14: 128000,
  15: 192000,
  16: 256000,
  17: 384000,
  18: 512000,
  19: 768000,
  20: 1024000,
};

export const LEVEL_BOOSTS: Record<number, number> = {
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
// HELPERS
// =============================================================================

export function getMiningBoost(nft: SparkNFTState): number {
  return LEVEL_BOOSTS[nft.level] ?? 0;
}

export function canLevelUp(nft: SparkNFTState): boolean {
  if (nft.level >= MAX_LEVEL) return false;
  const required = XP_REQUIREMENTS[nft.level + 1];
  return nft.xp >= required;
}

export function getXpForNextLevel(level: number): number {
  return XP_REQUIREMENTS[level + 1] ?? 0;
}

// =============================================================================
// EVOLUTION STATUS TYPE
// =============================================================================

export interface EvolutionStatus {
  currentLevel: number;
  nextLevel: number;
  currentXp: number;
  xpRequired: number;
  xpProgress: number;
  canEvolve: boolean;
  currentBoost: number;
  nextBoost: number;
  boostGain: number;
}

export function getEvolutionStatus(nft: SparkNFTState): EvolutionStatus {
  const nextLevel = nft.level + 1;
  const canEvolveNft = canLevelUp(nft);
  const xpRequired = XP_REQUIREMENTS[nextLevel] || 0;
  const currentBoost = getMiningBoost(nft);
  const nextBoost = LEVEL_BOOSTS[nextLevel] || 0;

  return {
    currentLevel: nft.level,
    nextLevel: canEvolveNft ? nextLevel : nft.level,
    currentXp: nft.xp,
    xpRequired,
    xpProgress: xpRequired > 0 ? (nft.xp / xpRequired) * 100 : 100,
    canEvolve: canEvolveNft,
    currentBoost,
    nextBoost,
    boostGain: nextBoost - currentBoost,
  };
}
