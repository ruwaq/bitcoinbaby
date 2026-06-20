/**
 * Spark Types — Unified entity for BitcoinSparks
 *
 * Replaces: Baby (types.ts), GameSpark (game/types.ts), SparkNFTState (bitcoin/src/charms/nft.ts)
 * Principle: 1 Spark = 1 NFT. The NFT IS the spark.
 */

// Re-export canonical types from bitcoin package (single source of truth)
import type {
  Bloodline as _Bloodline,
  RarityTier as _RarityTier,
  BaseType as _BaseType,
  SparkNFTState,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// SPARK STATE (gameplay states)
// =============================================================================

export type SparkState =
  | "idle"
  | "mining"
  | "evolving"
  | "resting"
  | "sleeping"
  | "hungry"
  | "happy"
  | "learning";

// =============================================================================
// SPARK STATS (volatile off-chain)
// =============================================================================

export interface SparkStats {
  energy: number; // 0-100, depletes with activity
  happiness: number; // 0-100, depletes over time
  hunger: number; // 0-100, 100 = starving
  health: number; // 0-100, affected by critical stats
}

// =============================================================================
// ON-CHAIN TYPES (re-exported from bitcoin package)
// =============================================================================

export type Bloodline = _Bloodline; // "royal" | "warrior" | "rogue" | "mystic"
export type RarityTier = _RarityTier; // "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"
export type BaseType = _BaseType; // "human" | "animal" | "robot" | "mystic" | "alien"

// =============================================================================
// UNIFIED SPARK (canonical entity)
// =============================================================================

export interface Spark {
  // === Identity ===
  id: string;
  name: string;
  tokenId: number; // 1-10000, from NFT

  // === DNA (on-chain, immutable) ===
  dna: string;
  bloodline: Bloodline;
  baseType: BaseType;
  rarityTier: RarityTier;
  genesisBlock: number;

  // === Game State (off-chain volatile + on-chain mutable) ===
  state: SparkState;
  visualState: string; // from SparkVisualState
  level: number; // 1-21 (MAX_LEVEL from shared)
  xp: number;
  totalXp: number;
  stats: SparkStats;

  // === On-chain metrics ===
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: bigint;

  // === Mining ===
  isMining: boolean;
  miningSharesBaseline: number;

  // === Narrative settlement ===
  narrativeRoot: string;
  worldStateRoot: string;

  // === Timestamps ===
  createdAt: number;
  lastUpdated: number;
  lastFed: number;
  lastPlayed: number;
  lastMined: number;

  // === Evolution ===
  evolutionHistory: SparkEvolutionRecord[];
  unlockedAchievements: string[];

  // === Ownership ===
  owner: string; // Bitcoin address
}

export interface SparkEvolutionRecord {
  fromLevel: number;
  toLevel: number;
  timestamp: number;
}

// =============================================================================
// CONVERSION HELPERS (migrate from old types)
// =============================================================================

/**
 * Convert SparkNFTState (on-chain) to Spark
 */
export function fromNFTState(nft: SparkNFTState, owner: string): Partial<Spark> {
  return {
    tokenId: nft.tokenId,
    dna: nft.dna,
    bloodline: nft.bloodline,
    baseType: nft.baseType,
    rarityTier: nft.rarityTier,
    genesisBlock: nft.genesisBlock,
    level: nft.level,
    xp: nft.xp,
    totalXp: nft.totalXp,
    workCount: nft.workCount,
    lastWorkBlock: nft.lastWorkBlock,
    evolutionCount: nft.evolutionCount,
    tokensEarned: nft.tokensEarned,
    owner,
  };
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

export const DEFAULT_SPARK_STATS: SparkStats = {
  energy: 100,
  happiness: 100,
  hunger: 0,
  health: 100,
};

export const DEFAULT_SPARK: Partial<Spark> = {
  state: "idle",
  visualState: "idle",
  level: 1,
  xp: 0,
  totalXp: 0,
  stats: { ...DEFAULT_SPARK_STATS },
  workCount: 0,
  evolutionCount: 0,
  tokensEarned: 0n,
  isMining: false,
  miningSharesBaseline: 0,
  narrativeRoot: "",
  worldStateRoot: "",
  evolutionHistory: [],
  unlockedAchievements: [],
};