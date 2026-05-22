/**
 * Sprite Library Builder for On-Chain NFTs
 *
 * Builds a complete sprite library for Bitcoin inscription.
 * Following the OnChainMonkey approach:
 * - Inscribe component sprites once
 * - Each NFT stores only DNA (40 bytes)
 * - Renderer reconstructs image from DNA + library
 *
 * Cost estimate: ~$15-50 total for entire library
 */

import type { BaseType, Bloodline, RarityTier } from "../charms/nft";

// =============================================================================
// TYPES
// =============================================================================

export interface SpriteLibrary {
  version: number;
  name: string;
  description: string;
  /** Total number of unique components */
  totalComponents: number;
  /** Component categories */
  categories: SpriteCategory[];
  /** All sprite components */
  components: SpriteComponentDef[];
  /** Color palettes */
  palettes: ColorPaletteDef[];
  /** Layer composition rules */
  layerRules: LayerRule[];
}

export interface SpriteCategory {
  name: string;
  description: string;
  count: number;
  zIndexRange: [number, number];
}

export interface SpriteComponentDef {
  /** Unique ID (e.g., "base_human_idle", "bloodline_royal_crown") */
  id: string;
  /** Category */
  category:
    | "base"
    | "bloodline"
    | "heritage"
    | "rarity"
    | "accessory"
    | "effect";
  /** Sub-type within category */
  subtype: string;
  /** Layer order (higher = on top) */
  zIndex: number;
  /** SVG path data (compressed) */
  pathData: string;
  /** Default fill color (palette reference) */
  fill: string;
  /** Optional stroke */
  stroke?: string;
  /** Required DNA bits to show this component */
  dnaCondition?: string;
  /** Animation keyframes (optional) */
  animation?: AnimationDef;
}

export interface ColorPaletteDef {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export interface LayerRule {
  /** Layer name */
  name: string;
  /** Z-index for this layer */
  zIndex: number;
  /** Components that can appear in this layer */
  allowedCategories: string[];
  /** Blend mode */
  blendMode?: string;
}

export interface AnimationDef {
  name: string;
  duration: number;
  keyframes: Array<{
    offset: number;
    transform?: string;
    opacity?: number;
  }>;
}

// =============================================================================
// GENESIS BABIES SPRITE LIBRARY
// =============================================================================

/**
 * Complete Genesis Babies sprite library configuration
 */
export const GENESIS_BABIES_LIBRARY: SpriteLibrary = {
  version: 1,
  name: "Genesis Babies",
  description: "10,000 unique babies on Bitcoin",
  totalComponents: 150,
  categories: [
    {
      name: "base",
      description: "Base body types",
      count: 8,
      zIndexRange: [10, 19],
    },
    {
      name: "bloodline",
      description: "Bloodline overlays",
      count: 4,
      zIndexRange: [20, 29],
    },
    {
      name: "heritage",
      description: "Cultural elements",
      count: 5,
      zIndexRange: [30, 39],
    },
    {
      name: "rarity",
      description: "Rarity effects",
      count: 6,
      zIndexRange: [40, 49],
    },
    {
      name: "accessory",
      description: "Optional accessories",
      count: 40,
      zIndexRange: [50, 59],
    },
    {
      name: "effect",
      description: "Particle effects",
      count: 20,
      zIndexRange: [60, 69],
    },
  ],
  components: [], // Populated at build time
  palettes: [
    {
      id: "human",
      name: "Human Palette",
      colors: {
        skin: "#ffcc99",
        skinShade: "#e6b380",
        hair: "#4a3728",
        primary: "#f7931a",
        secondary: "#ffc107",
        accent: "#4fc3f7",
      },
    },
    {
      id: "animal",
      name: "Animal Palette",
      colors: {
        fur: "#d4a574",
        furShade: "#b48554",
        nose: "#1a1a1a",
        primary: "#f97316",
        secondary: "#fbbf24",
        accent: "#84cc16",
      },
    },
    {
      id: "robot",
      name: "Robot Palette",
      colors: {
        metal: "#7a8a9a",
        metalShade: "#5a6a7a",
        led: "#4fc3f7",
        primary: "#64748b",
        secondary: "#94a3b8",
        accent: "#22d3ee",
      },
    },
    {
      id: "mystic",
      name: "Mystic Palette",
      colors: {
        aura: "#9966ff",
        auraShade: "#7744dd",
        rune: "#ffcc00",
        primary: "#8b5cf6",
        secondary: "#a78bfa",
        accent: "#f472b6",
      },
    },
    {
      id: "alien",
      name: "Alien Palette",
      colors: {
        skin: "#88ff88",
        skinShade: "#55cc55",
        eye: "#1a1a1a",
        primary: "#10b981",
        secondary: "#34d399",
        accent: "#06b6d4",
      },
    },
    {
      id: "shaman",
      name: "Shaman Palette",
      colors: {
        skin: "#a67c52",
        skinShade: "#8a6042",
        spirit: "#fbbf24",
        primary: "#059669",
        secondary: "#34d399",
        accent: "#fbbf24",
      },
    },
    {
      id: "elemental",
      name: "Elemental Palette",
      colors: {
        fire: "#ff6b35",
        water: "#38bdf8",
        earth: "#22c55e",
        primary: "#f97316",
        secondary: "#f7c59f",
        accent: "#ffd700",
      },
    },
    {
      id: "dragon",
      name: "Dragon Palette",
      colors: {
        scales: "#dc2626",
        scalesShade: "#b91c1c",
        gold: "#fbbf24",
        primary: "#dc2626",
        secondary: "#ef4444",
        accent: "#8b5cf6",
      },
    },
    {
      id: "royal",
      name: "Royal Bloodline",
      colors: {
        gold: "#ffd700",
        goldShade: "#ffaa00",
        jewel: "#ff0055",
        primary: "#ffd700",
        secondary: "#ffaa00",
        accent: "#ffffff",
      },
    },
    {
      id: "warrior",
      name: "Warrior Bloodline",
      colors: {
        steel: "#666666",
        steelShade: "#333333",
        blood: "#cc3333",
        primary: "#cc3333",
        secondary: "#aa2222",
        accent: "#ff6666",
      },
    },
    {
      id: "rogue",
      name: "Rogue Bloodline",
      colors: {
        shadow: "#333355",
        shadowShade: "#222244",
        glint: "#8888ff",
        primary: "#333355",
        secondary: "#222244",
        accent: "#8888ff",
      },
    },
    {
      id: "mystic_blood",
      name: "Mystic Bloodline",
      colors: {
        magic: "#aa44ff",
        magicShade: "#8822dd",
        star: "#ffcc00",
        primary: "#aa44ff",
        secondary: "#8822dd",
        accent: "#ffcc00",
      },
    },
  ],
  layerRules: [
    { name: "background", zIndex: 0, allowedCategories: ["rarity"] },
    { name: "base", zIndex: 10, allowedCategories: ["base"] },
    { name: "bloodline", zIndex: 20, allowedCategories: ["bloodline"] },
    { name: "heritage", zIndex: 30, allowedCategories: ["heritage"] },
    { name: "accessory", zIndex: 50, allowedCategories: ["accessory"] },
    {
      name: "effect",
      zIndex: 60,
      allowedCategories: ["effect"],
      blendMode: "screen",
    },
  ],
};

// =============================================================================
// DNA MAPPING
// =============================================================================

/**
 * DNA structure for Genesis Babies (64 hex chars = 256 bits)
 *
 * Bits 0-3:   Base type (0-7 = human, animal, robot, mystic, alien, shaman, elemental, dragon)
 * Bits 4-5:   Bloodline (0-3 = royal, warrior, rogue, mystic)
 * Bits 6-8:   Heritage (0-4 = americas, africa, asia, europa, oceania)
 * Bits 9-12:  Rarity score (determines tier)
 * Bits 13-16: Skin/fur variant
 * Bits 17-20: Eye variant
 * Bits 21-24: Mouth variant
 * Bits 25-28: Accessory 1
 * Bits 29-32: Accessory 2
 * Bits 33-36: Special trait
 * Bits 37-64: Reserved for future traits
 */
export interface DNAMapping {
  baseType: number; // 0-7
  bloodline: number; // 0-3
  heritage: number; // 0-4
  rarityScore: number; // 0-15
  skinVariant: number; // 0-15
  eyeVariant: number; // 0-15
  mouthVariant: number; // 0-15
  accessory1: number; // 0-15
  accessory2: number; // 0-15
  specialTrait: number; // 0-15
}

/**
 * Parse DNA string to mapping
 */
export function parseDNA(dna: string): DNAMapping {
  const hex = dna.replace(/^0x/, "").padEnd(64, "0");

  return {
    baseType: parseInt(hex[0], 16) % 8,
    bloodline: parseInt(hex[1], 16) % 4,
    heritage: parseInt(hex[2], 16) % 5,
    rarityScore: parseInt(hex[3], 16),
    skinVariant: parseInt(hex[4], 16),
    eyeVariant: parseInt(hex[5], 16),
    mouthVariant: parseInt(hex[6], 16),
    accessory1: parseInt(hex[7], 16),
    accessory2: parseInt(hex[8], 16),
    specialTrait: parseInt(hex[9], 16),
  };
}

/**
 * Get rarity tier from score
 */
export function getRarityFromScore(score: number): RarityTier {
  if (score >= 15) return "mythic"; // 6.25%
  if (score >= 13) return "legendary"; // 12.5%
  if (score >= 10) return "epic"; // 18.75%
  if (score >= 7) return "rare"; // 18.75%
  if (score >= 4) return "uncommon"; // 18.75%
  return "common"; // 25%
}

/**
 * Get base type from index
 */
export function getBaseTypeFromIndex(index: number): BaseType {
  const types: BaseType[] = ["human", "animal", "robot", "mystic", "alien"];
  return types[index % types.length];
}

/**
 * Get bloodline from index
 */
export function getBloodlineFromIndex(index: number): Bloodline {
  const bloodlines: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
  return bloodlines[index % bloodlines.length];
}

// =============================================================================
// LIBRARY BUILDER
// =============================================================================

export interface BuildResult {
  /** Compressed library JSON */
  libraryJson: string;
  /** Library size in bytes */
  librarySize: number;
  /** Individual component SVGs */
  components: Map<string, string>;
  /** Total inscription cost estimate (sats) */
  estimatedCost: number;
  /** Build statistics */
  stats: BuildStats;
}

export interface BuildStats {
  totalComponents: number;
  totalPalettes: number;
  largestComponent: { name: string; size: number };
  smallestComponent: { name: string; size: number };
  averageComponentSize: number;
}

/**
 * Build the sprite library for inscription
 *
 * STATUS: PLACEHOLDER - Not production-ready
 *
 * This function creates placeholder entries for the sprite library
 * inscription system. Full implementation requires:
 *
 * 1. Extract actual SVG path data from React components
 *    (packages/ui/src/components/sprites/genesis/)
 * 2. Optimize SVG for on-chain storage
 * 3. Create recursive inscription structure
 *
 * The placeholder data is used for:
 * - Cost estimation
 * - Structure validation
 * - Development testing
 *
 * @see packages/ui/src/components/sprites/genesis/ for actual sprites
 */
export async function buildSpriteLibrary(): Promise<BuildResult> {
  const components = new Map<string, string>();
  let totalSize = 0;
  let largest = { name: "", size: 0 };
  let smallest = { name: "", size: Infinity };

  const componentDefs: Array<{
    id: string;
    category: "base" | "bloodline" | "heritage" | "rarity" | "accessory" | "effect";
    pathData: string;
    zIndex: number;
    fill: string;
  }> = [
    // Base types
    {
      id: "base_human",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_human"><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="12" y="25" width="8" height="3" fill="var(--shade)"/><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="9" y="8" width="2" height="3" fill="var(--skin)"/><rect x="21" y="8" width="2" height="3" fill="var(--skin)"/><rect x="12" y="9" width="2" height="2" fill="#ffffff"/><rect x="18" y="9" width="2" height="2" fill="#ffffff"/><rect x="12" y="9" width="1" height="2" fill="var(--eye)"/><rect x="18" y="9" width="1" height="2" fill="var(--eye)"/><rect x="14" y="12" width="4" height="1" fill="var(--shade)"/><rect x="10" y="3" width="12" height="3" fill="var(--pri)"/><rect x="12" y="2" width="8" height="1" fill="var(--sec)"/></g>`
    },
    {
      id: "base_animal",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_animal"><rect x="9" y="3" width="2" height="2" fill="var(--skin)"/><rect x="21" y="3" width="2" height="2" fill="var(--skin)"/><rect x="10" y="4" width="1" height="1" fill="#ffcccc"/><rect x="21" y="4" width="1" height="1" fill="#ffcccc"/><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="21" y="20" width="2" height="4" fill="var(--skin)"/><rect x="12" y="9" width="2" height="2" fill="var(--eye)"/><rect x="18" y="9" width="2" height="2" fill="var(--eye)"/><rect x="15" y="11" width="2" height="1" fill="var(--shade)"/><rect x="14" y="12" width="4" height="1" fill="var(--shade)"/></g>`
    },
    {
      id: "base_robot",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_robot"><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="15" y="2" width="2" height="3" fill="var(--shade)"/><rect x="15" y="1" width="2" height="1" fill="var(--acc)"/><rect x="12" y="8" width="8" height="3" fill="var(--shade2,#111)"/><rect x="13" y="9" width="6" height="1" fill="var(--eye)"/><rect x="13" y="19" width="2" height="2" fill="var(--shade)"/><rect x="17" y="19" width="2" height="2" fill="var(--acc)"/></g>`
    },
    {
      id: "base_mystic",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_mystic"><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="15" y="7" width="2" height="2" fill="var(--eye)"/><rect x="15.5" y="7.5" width="1" height="1" fill="#ffffff"/><rect x="13" y="11" width="1" height="2" fill="var(--acc)"/><rect x="18" y="11" width="1" height="2" fill="var(--acc)"/><rect x="14" y="20" width="4" height="1" fill="var(--acc)"/></g>`
    },
    {
      id: "base_alien",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_alien"><rect x="9" y="4" width="14" height="11" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="15" width="10" height="2" fill="var(--skin)"/><rect x="10" y="7" width="4" height="5" fill="var(--eye)"/><rect x="18" y="7" width="4" height="5" fill="var(--eye)"/><rect x="11" y="8" width="1" height="1" fill="#ffffff"/><rect x="19" y="8" width="1" height="1" fill="#ffffff"/><rect x="14" y="17" width="4" height="2" fill="var(--skin)"/><rect x="12" y="19" width="8" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/></g>`
    },
    {
      id: "base_shaman",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_shaman"><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="12" y="7" width="1" height="6" fill="var(--pri)"/><rect x="19" y="7" width="1" height="6" fill="var(--pri)"/><rect x="15" y="6" width="2" height="2" fill="var(--acc)"/><rect x="13" y="9" width="1" height="2" fill="var(--eye)"/><rect x="18" y="9" width="1" height="2" fill="var(--eye)"/><rect x="15" y="12" width="2" height="1" fill="var(--shade)"/></g>`
    },
    {
      id: "base_elemental",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_elemental"><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="13" y="2" width="6" height="3" fill="var(--pri)"/><rect x="14" y="1" width="4" height="1" fill="var(--sec)"/><rect x="15" y="0" width="2" height="1" fill="var(--acc)"/><rect x="12" y="9" width="2" height="2" fill="var(--eye)"/><rect x="18" y="9" width="2" height="2" fill="var(--eye)"/></g>`
    },
    {
      id: "base_dragon",
      category: "base",
      zIndex: 10,
      fill: "var(--skin)",
      pathData: `<g id="base_dragon"><rect x="9" y="2" width="2" height="3" fill="var(--acc)"/><rect x="21" y="2" width="2" height="3" fill="var(--acc)"/><rect x="11" y="5" width="10" height="10" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="11" y="17" width="10" height="8" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="13" y="19" width="2" height="1" fill="var(--pri)"/><rect x="17" y="21" width="2" height="1" fill="var(--pri)"/><rect x="21" y="20" width="3" height="3" fill="var(--skin)" stroke="var(--shade2,#111)" stroke-width="0.5"/></g>`
    },
    // Bloodlines
    {
      id: "bloodline_royal",
      category: "bloodline",
      zIndex: 20,
      fill: "var(--pri)",
      pathData: `<g id="bloodline_royal"><rect x="10" y="1" width="12" height="3" fill="#ffd700" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="10" y="0" width="2" height="1" fill="#ffd700"/><rect x="15" y="0" width="2" height="1" fill="#ffd700"/><rect x="20" y="0" width="2" height="1" fill="#ffd700"/><rect x="12" y="2" width="1" height="1" fill="#ef4444"/><rect x="19" y="2" width="1" height="1" fill="#3b82f6"/></g>`
    },
    {
      id: "bloodline_warrior",
      category: "bloodline",
      zIndex: 20,
      fill: "var(--pri)",
      pathData: `<g id="bloodline_warrior"><rect x="9" y="2" width="14" height="4" fill="#6b7280" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="15" y="0" width="2" height="2" fill="#ef4444"/><rect x="12" y="11" width="1" height="3" fill="#ef4444"/></g>`
    },
    {
      id: "bloodline_rogue",
      category: "bloodline",
      zIndex: 20,
      fill: "var(--pri)",
      pathData: `<g id="bloodline_rogue"><rect x="9" y="3" width="14" height="12" fill="#1f2937" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="10" y="17" width="12" height="9" fill="#1f2937" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="12" y="11" width="8" height="4" fill="#111827"/></g>`
    },
    {
      id: "bloodline_mystic",
      category: "bloodline",
      zIndex: 20,
      fill: "var(--pri)",
      pathData: `<g id="bloodline_mystic"><rect x="12" y="2" width="8" height="3" fill="#8b5cf6" stroke="var(--shade2,#111)" stroke-width="0.5"/><rect x="15" y="0" width="2" height="2" fill="#f472b6"/></g>`
    },
    // Heritage
    {
      id: "heritage_americas",
      category: "heritage",
      zIndex: 30,
      fill: "var(--acc)",
      pathData: `<g id="heritage_americas"><rect x="8" y="3" width="2" height="4" fill="#dc2626"/><rect x="8" y="2" width="1" height="1" fill="#ffffff"/><rect x="2" y="2" width="28" height="28" fill="#14b8a6" opacity="0.15" style="pointer-events:none;"/></g>`
    },
    {
      id: "heritage_africa",
      category: "heritage",
      zIndex: 30,
      fill: "var(--acc)",
      pathData: `<g id="heritage_africa"><rect x="11" y="16" width="10" height="2" fill="#fbbf24"/><rect x="13" y="17" width="6" height="1" fill="#dc2626"/><rect x="2" y="2" width="28" height="28" fill="#f59e0b" opacity="0.15" style="pointer-events:none;"/></g>`
    },
    {
      id: "heritage_asia",
      category: "heritage",
      zIndex: 30,
      fill: "var(--acc)",
      pathData: `<g id="heritage_asia"><rect x="15" y="16" width="2" height="2" fill="#10b981"/><rect x="2" y="2" width="28" height="28" fill="#dc2626" opacity="0.15" style="pointer-events:none;"/></g>`
    },
    {
      id: "heritage_europa",
      category: "heritage",
      zIndex: 30,
      fill: "var(--acc)",
      pathData: `<g id="heritage_europa"><rect x="10" y="4" width="12" height="1" fill="#22c55e"/><rect x="2" y="2" width="28" height="28" fill="#1e40af" opacity="0.15" style="pointer-events:none;"/></g>`
    },
    {
      id: "heritage_oceania",
      category: "heritage",
      zIndex: 30,
      fill: "var(--acc)",
      pathData: `<g id="heritage_oceania"><rect x="12" y="16" width="8" height="1" fill="#ffffff"/><rect x="2" y="2" width="28" height="28" fill="#0891b2" opacity="0.15" style="pointer-events:none;"/></g>`
    },
    // Rarity effects
    {
      id: "rarity_common",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_common"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#6b7280" stroke-width="0.5"/></g>`
    },
    {
      id: "rarity_uncommon",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_uncommon"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#22c55e" stroke-width="0.5"/><rect x="1" y="1" width="1" height="1" fill="#22c55e"/><rect x="30" y="1" width="1" height="1" fill="#22c55e"/></g>`
    },
    {
      id: "rarity_rare",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_rare"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#3b82f6" stroke-width="0.5"/><rect x="1" y="1" width="1" height="2" fill="#60a5fa"/><rect x="30" y="1" width="1" height="2" fill="#60a5fa"/></g>`
    },
    {
      id: "rarity_epic",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_epic"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#8b5cf6" stroke-width="0.5"/><rect x="1" y="1" width="2" height="2" fill="#c084fc"/><rect x="29" y="1" width="2" height="2" fill="#c084fc"/></g>`
    },
    {
      id: "rarity_legendary",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_legendary"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#fbbf24" stroke-width="0.5"/><rect x="1" y="1" width="2" height="2" fill="#ffffff"/><rect x="29" y="1" width="2" height="2" fill="#ffffff"/><circle cx="16" cy="16" r="14" fill="none" stroke="#fbbf24" stroke-width="0.5" stroke-dasharray="2,2"/></g>`
    },
    {
      id: "rarity_mythic",
      category: "rarity",
      zIndex: 0,
      fill: "transparent",
      pathData: `<g id="rarity_mythic"><rect x="0" y="0" width="32" height="32" fill="none" stroke="#ec4899" stroke-width="0.5"/><rect x="1" y="1" width="2" height="2" fill="#ffffff"/><rect x="29" y="1" width="2" height="2" fill="#ffffff"/><circle cx="16" cy="16" r="14" fill="none" stroke="#ec4899" stroke-width="0.5" stroke-dasharray="4,2"/></g>`
    }
  ];

  for (const comp of componentDefs) {
    const size = new TextEncoder().encode(comp.pathData).length;
    components.set(comp.id, comp.pathData);
    totalSize += size;

    if (size > largest.size) {
      largest = { name: comp.id, size };
    }
    if (size < smallest.size) {
      smallest = { name: comp.id, size };
    }
  }

  // Build library JSON
  const library = {
    ...GENESIS_BABIES_LIBRARY,
    components: componentDefs.map((c) => ({
      id: c.id,
      category: c.category,
      subtype: c.id.split("_")[1],
      zIndex: c.zIndex,
      pathData: c.pathData,
      fill: c.fill,
    })),
  };

  const libraryJson = JSON.stringify(library);

  // Estimate cost (10 sats/byte average)
  const estimatedCost = totalSize * 10;

  return {
    libraryJson,
    librarySize: libraryJson.length,
    components,
    estimatedCost,
    stats: {
      totalComponents: componentDefs.length,
      totalPalettes: GENESIS_BABIES_LIBRARY.palettes.length,
      largestComponent: largest,
      smallestComponent: smallest,
      averageComponentSize: totalSize / componentDefs.length,
    },
  };
}

/**
 * Generate inscription data for the sprite library
 */
export function generateLibraryInscription(library: SpriteLibrary): {
  contentType: string;
  content: string;
  size: number;
} {
  const content = JSON.stringify(library);

  return {
    contentType: "application/json",
    content,
    size: new TextEncoder().encode(content).length,
  };
}
