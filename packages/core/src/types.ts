/**
 * Estados posibles del Spark
 */
export type SparkState =
  | "sleeping"
  | "hungry"
  | "happy"
  | "learning"
  | "evolving";

/**
 * Entidad Spark - El minero de BitcoinSparks
 * @deprecated Use Spark from spark-types.ts instead (unified type)
 */
export interface Spark {
  id: string;
  name: string;
  state: SparkState;
  level: number;
  experience: number;
  createdAt: Date;
  lastFed: Date;
}

/**
 * Full mining session statistics (extends mining module stats)
 */
export interface MiningSession {
  hashrate: number; // Hashes per second
  totalHashes: number; // Total hashes computed
  tokensEarned: number; // BABY tokens earned
  difficulty: number; // Current difficulty
  uptime: number; // Seconds mining
  isActive: boolean; // Mining active state
  minerType: "cpu" | "webgpu";
}

/**
 * Configuracion de mineria
 */
export interface MiningConfig {
  readonly difficulty: number;
  maxHashrate: number;
  useWebGPU: boolean;
  throttleOnBattery: boolean;
  throttleWhenHidden: boolean;
}

// Re-export canonical types from shared
export type { WalletInfo as WalletInfoBase } from "@bitcoinbaby/shared";

/**
 * Wallet info with balance (UI-specific extension)
 * Base type: @bitcoinbaby/shared WalletInfo
 */
export interface WalletInfo {
  address: string;
  publicKey: string;
  balance: bigint;
  sparkTokens: bigint;
}

// =============================================================================
// NFT CANONICAL TYPES (Re-exported from @bitcoinbaby/bitcoin)
// These are the canonical types stored on Bitcoin via Charms.
// Single source of truth: packages/bitcoin/src/charms/nft.ts
// =============================================================================

export {
  // Types
  type Bloodline,
  type RarityTier,
  type BaseType,
  type SparkNFTState,
  type SparkNFTInfo,
  // Constants
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  GENESIS_SPARKS_CONFIG,
  // Functions
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
} from "@bitcoinbaby/bitcoin";

// Heritage and MAX_LEVEL re-exported from shared (Single Source of Truth)
export {
  type HeritageSeed,
  MAX_LEVEL,
  HERITAGE_SEEDS,
} from "@bitcoinbaby/shared";

import { XP_REQUIREMENTS } from "@bitcoinbaby/bitcoin";

/**
 * Get XP required for next level
 */
export function getXpForNextLevel(level: number): number {
  return XP_REQUIREMENTS[level + 1] ?? 0;
}
