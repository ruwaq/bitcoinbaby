/**
 * NFT UI Components
 *
 * Pixel art display components for Genesis Baby NFTs.
 */

// NFT types (local mirror of @bitcoinbaby/bitcoin/charms/nft types)
export type {
  BabyNFTState,
  BabyNFTInfo,
  Bloodline,
  RarityTier,
  BaseType,
  Heritage,
  EvolutionStatus,
} from "./types";

export {
  getMiningBoost,
  canLevelUp,
  getXpForNextLevel,
  getEvolutionCostDisplay,
  getEvolutionStatus,
  MAX_LEVEL,
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  RARITY_BOOSTS,
  EVOLUTION_COSTS,
} from "./types";

// Components
export { NFTCard, type NFTCardProps } from "./NFTCard";
export {
  NFTGrid,
  type NFTGridProps,
  type NFTGridFilters,
  type NFTSortKey,
  type NFTSortOrder,
} from "./NFTGrid";
export { NFTStats, type NFTStatsProps } from "./NFTStats";
export { NFTSprite } from "./NFTSprite";
export { NFTInfoPanel } from "./NFTInfoPanel";
export { PendingTransactions, type PendingTx } from "./PendingTransactions";
export {
  NFTEvolutionPanel,
  type NFTEvolutionPanelProps,
} from "./NFTEvolutionPanel";

// Trait Configuration
export {
  getNFTVisualConfig,
  resolvePaletteColor,
  getDNAColorVariation,
  BASE_TYPE_CONFIGS,
  BLOODLINE_CONFIGS,
  RARITY_CONFIGS,
  type TraitVisualConfig,
  type SpriteFeature,
  type ColorPalette,
  type EffectsConfig,
} from "./trait-config";

// Genesis Baby Sprite System (new pixel art sprites)
export {
  // Main component
  GenesisBabySprite,
  GenesisBabyPreview,
  generateRandomTraits,
  traitsFromHash,
  type GenesisBabyTraits,
  // Base type sprites
  HumanSprite,
  RobotSprite,
  MysticSprite,
  AlienSprite,
  ShamanSprite,
  ElementalSprite,
  DragonSprite,
  // Overlay components
  BloodlineOverlay,
  BloodlineAura,
  HeritageOverlay,
  HeritageBackground,
  RarityEffects,
  RarityFrame,
  RarityBadge,
  // Types from genesis system (renamed to avoid conflicts)
  type GenesisBabyState,
  type GenesisBaseType,
  type GenesisBloodline,
  type GenesisHeritage,
  type GenesisRarity,
  type DNATraits,
  // Constants
  BASE_TYPE_COLORS,
  BLOODLINE_STYLES,
  HERITAGE_STYLES,
  RARITY_EFFECTS,
  parseDNA,
} from "../sprites/genesis";
