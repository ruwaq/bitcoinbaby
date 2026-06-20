/**
 * Genesis Spark Sprite System
 *
 * Sistema completo de sprites para NFTs Genesis Sparks.
 *
 * Estructura de capas:
 * 1. Base Type Sprites (Human, Animal, Robot, Mystic, Alien)
 * 2. Bloodline Overlays (Royal, Warrior, Rogue, Mystic)
 * 3. Heritage Overlays (Americas, Africa, Asia, Europa, Oceania)
 * 4. Rarity Effects (Common → Mythic)
 *
 * Uso:
 * ```tsx
 * import { GenesisSparkSprite, generateRandomTraits } from '@bitcoinbaby/ui/sprites/genesis';
 *
 * const traits = generateRandomTraits();
 * <GenesisSparkSprite traits={traits} size={64} state="idle" />
 * ```
 */

// Types - Renamed with Genesis prefix to avoid conflicts
export {
  type BaseType as GenesisBaseType,
  type Bloodline as GenesisBloodline,
  type Heritage as GenesisHeritage,
  type Rarity as GenesisRarity,
  type GenesisBabyState,
  type BabyState, // Alias for backwards compat
  type ColorPalette as GenesisColorPalette,
  type DNATraits,
  type BloodlineStyle,
  type HeritageStyle,
  type RarityEffect,
  BASE_TYPE_COLORS,
  BLOODLINE_STYLES,
  HERITAGE_STYLES,
  RARITY_EFFECTS,
  parseDNA,
  applyColorVariant,
  getRarityGlowClass,
  getRarityGlowFilter,
} from "./types";

// Base Type Sprites (8 types: Human, Animal, Robot, Mystic, Alien, Shaman, Elemental, Dragon)
export { HumanSprite } from "./HumanSprite";
export { AnimalSprite } from "./AnimalSprite";
export { RobotSprite } from "./RobotSprite";
export { MysticSprite } from "./MysticSprite";
export { AlienSprite } from "./AlienSprite";
export { ShamanSprite } from "./ShamanSprite";
export { ElementalSprite } from "./ElementalSprite";
export { DragonSprite } from "./DragonSprite";

// Overlay Components
export { BloodlineOverlay, BloodlineAura } from "./BloodlineOverlay";
export { HeritageOverlay, HeritageBackground } from "./HeritageOverlay";
export { RarityEffects, RarityFrame, RarityBadge } from "./RarityEffects";

// Main Generator Component
export {
  GenesisSparkSprite,
  GenesisBabyPreview,
  generateRandomTraits,
  traitsFromHash,
  type GenesisBabyTraits,
} from "./GenesisSparkSprite";

// Default export
export { default } from "./GenesisSparkSprite";
