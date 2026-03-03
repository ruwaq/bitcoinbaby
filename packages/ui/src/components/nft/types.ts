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
  Heritage,
  BabyNFTState as CoreBabyNFTState,
} from "@bitcoinbaby/core";

// Re-export canonical types
export type { RarityTier, Heritage };
export type { CoreBabyNFTState };

// =============================================================================
// EXTENDED UI TYPES
// These extend the on-chain types for visualization purposes only.
// Note: "scholar" and "merchant" bloodlines, and "shaman", "elemental", "dragon"
// base types are UI-only extensions for special visual effects.
// =============================================================================

/**
 * Extended Bloodline for UI visualization
 * Includes canonical bloodlines + UI-only visual variants
 */
export type Bloodline = CoreBloodline | "scholar" | "merchant";

/**
 * Extended BaseType for UI visualization
 * Includes canonical base types + UI-only visual variants
 */
export type BaseType = CoreBaseType | "shaman" | "elemental" | "dragon";

/**
 * UI-extended NFT state that supports both canonical and extended types
 */
export interface BabyNFTState {
  readonly dna: string;
  readonly bloodline: Bloodline;
  readonly baseType: BaseType;
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: bigint;
}

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
// CONSTANTS
// =============================================================================

export const MAX_LEVEL = 10;

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

export const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 5,
  3: 10,
  4: 15,
  5: 25,
  6: 35,
  7: 50,
  8: 70,
  9: 90,
  10: 120,
};

export const RARITY_BOOSTS: Record<RarityTier, number> = {
  common: 10,
  uncommon: 15,
  rare: 25,
  epic: 35,
  legendary: 50,
  mythic: 100,
};

export const EVOLUTION_COSTS: Record<number, bigint> = {
  2: 100n * 100_000_000n,
  3: 250n * 100_000_000n,
  4: 500n * 100_000_000n,
  5: 1000n * 100_000_000n,
  6: 2500n * 100_000_000n,
  7: 5000n * 100_000_000n,
  8: 10000n * 100_000_000n,
  9: 25000n * 100_000_000n,
  10: 50000n * 100_000_000n,
};

// =============================================================================
// HELPERS
// =============================================================================

export function getMiningBoost(nft: BabyNFTState): number {
  return (LEVEL_BOOSTS[nft.level] ?? 0) + (RARITY_BOOSTS[nft.rarityTier] ?? 0);
}

export function canLevelUp(nft: BabyNFTState): boolean {
  if (nft.level >= MAX_LEVEL) return false;
  const required = XP_REQUIREMENTS[nft.level + 1];
  return nft.xp >= required;
}

export function getXpForNextLevel(level: number): number {
  return XP_REQUIREMENTS[level + 1] ?? 0;
}

export function getEvolutionCostDisplay(level: number): string {
  const cost = EVOLUTION_COSTS[level + 1];
  if (!cost) return "MAX";
  return `${(Number(cost) / 100_000_000).toLocaleString()} BABTC`;
}

// =============================================================================
// EVOLUTION STATUS TYPE
// =============================================================================

export interface EvolutionStatus {
  currentLevel: number;
  nextLevel: number;
  currentXp: number;
  xpRequired: number;
  xpProgress: number; // 0-100
  canEvolve: boolean;
  tokenCost: bigint;
  currentBoost: number;
  nextBoost: number;
  boostGain: number;
}

export function getEvolutionStatus(nft: BabyNFTState): EvolutionStatus {
  const nextLevel = nft.level + 1;
  const canEvolveNft = canLevelUp(nft);
  const xpRequired = XP_REQUIREMENTS[nextLevel] || 0;
  const tokenCost = EVOLUTION_COSTS[nextLevel] || 0n;
  const currentBoost = getMiningBoost(nft);
  const nextBoost =
    (LEVEL_BOOSTS[nextLevel] || 0) + (RARITY_BOOSTS[nft.rarityTier] || 0);

  return {
    currentLevel: nft.level,
    nextLevel: canEvolveNft ? nextLevel : nft.level,
    currentXp: nft.xp,
    xpRequired,
    xpProgress: xpRequired > 0 ? (nft.xp / xpRequired) * 100 : 100,
    canEvolve: canEvolveNft,
    tokenCost,
    currentBoost,
    nextBoost,
    boostGain: nextBoost - currentBoost,
  };
}
