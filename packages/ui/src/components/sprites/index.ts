// BitcoinBaby Pixel Art Sprites

// Main Characters
export { BabySprite, type BabyState, type BabyStage } from "./BabySprite";
export { TeenSprite, type TeenState } from "./TeenSprite";
export { CodeEgg } from "./CodeEgg";

// Unified Game Sprite System
export { GameSprite, type SpriteForm, type SpriteState } from "./GameSprite";
export {
  LevelSprite,
  getLevelNFTMetadata,
  type LevelSpriteState,
} from "./LevelSprite";

// Sprite Configuration (for NFT metadata)
export {
  LEVEL_CONFIGS,
  getLevelConfig,
  getAllFeaturesForLevel,
  getPaletteForLevel,
  getViewBoxForLevel,
  type SpriteFeature,
  type LevelConfig,
} from "./sprite-config";

// NPCs & Companions
export { Oracle } from "./Oracle";
export { SatoBots, SatoBot } from "./SatoBots";
export { WhaleSprite } from "./WhaleSprite";

// Genesis Spark NFT Sprite System
export * from "./genesis";

// Pixel Art Icons (replaces emojis)
export {
  PixelIcon,
  STAT_ICONS,
  ACTION_ICONS,
  type IconName,
} from "./PixelIcon";
