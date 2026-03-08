/**
 * NFT Types - Single Source of Truth
 *
 * Core NFT types used across all packages.
 * Bloodline/RarityTier are canonical types stored on Bitcoin.
 * Heritage is a UI extension for visual diversity.
 *
 * @example
 * import { Bloodline, Heritage, RarityTier } from '@bitcoinbaby/shared';
 */

// =============================================================================
// CANONICAL TYPES (Stored on Bitcoin via Charms)
// =============================================================================

/**
 * Bloodline determines base multipliers and visual style.
 * Stored on-chain in Charm UTXO.
 */
export type Bloodline = "royal" | "warrior" | "rogue" | "mystic";

/**
 * Base type of the baby.
 * Stored on-chain in Charm UTXO.
 */
export type BaseType = "human" | "animal" | "robot" | "mystic" | "alien";

/**
 * Rarity tier affects mining boost and visual effects.
 * Stored on-chain in Charm UTXO.
 */
export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

// =============================================================================
// UI EXTENSIONS (Not stored on-chain)
// =============================================================================

/**
 * Heritage (cultural origin) for visual diversity.
 * Used for sprite selection, NOT stored on-chain.
 */
export type Heritage = "americas" | "africa" | "asia" | "europa" | "oceania";

/**
 * Extended bloodline for UI (includes scholar/merchant)
 * Base bloodline comes from blockchain, UI can extend
 */
export type ExtendedBloodline = Bloodline | "scholar" | "merchant";

// =============================================================================
// NFT BOOST CONFIGURATION
// =============================================================================

/**
 * Mining boost configuration per level
 */
export interface LevelBoostConfig {
  level: number;
  boost: number; // multiplier (e.g., 1.1 = 10% boost)
}

/**
 * Rarity boost configuration
 */
export interface RarityBoostConfig {
  rarity: RarityTier;
  boost: number;
}

/**
 * Bloodline boost configuration
 */
export interface BloodlineBoostConfig {
  bloodline: Bloodline;
  boost: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All valid bloodlines
 */
export const BLOODLINES: readonly Bloodline[] = [
  "royal",
  "warrior",
  "rogue",
  "mystic",
] as const;

/**
 * All valid heritages
 */
export const HERITAGES: readonly Heritage[] = [
  "americas",
  "africa",
  "asia",
  "europa",
  "oceania",
] as const;

/**
 * All valid rarity tiers (ordered by rarity)
 */
export const RARITY_TIERS: readonly RarityTier[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
] as const;

/**
 * Max level for NFTs
 */
export const MAX_LEVEL = 10;
