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

  // PLACEHOLDER: These are estimated sizes, not actual SVG data
  // TODO: Implement SVG extraction from React sprite components

  const componentDefs: Array<{ id: string; category: string; size: number }> = [
    // Base types
    { id: "base_human", category: "base", size: 800 },
    { id: "base_animal", category: "base", size: 750 },
    { id: "base_robot", category: "base", size: 900 },
    { id: "base_mystic", category: "base", size: 850 },
    { id: "base_alien", category: "base", size: 700 },
    { id: "base_shaman", category: "base", size: 820 },
    { id: "base_elemental", category: "base", size: 780 },
    { id: "base_dragon", category: "base", size: 950 },
    // Bloodlines
    { id: "bloodline_royal", category: "bloodline", size: 400 },
    { id: "bloodline_warrior", category: "bloodline", size: 450 },
    { id: "bloodline_rogue", category: "bloodline", size: 380 },
    { id: "bloodline_mystic", category: "bloodline", size: 420 },
    // Heritage
    { id: "heritage_americas", category: "heritage", size: 300 },
    { id: "heritage_africa", category: "heritage", size: 320 },
    { id: "heritage_asia", category: "heritage", size: 310 },
    { id: "heritage_europa", category: "heritage", size: 290 },
    { id: "heritage_oceania", category: "heritage", size: 280 },
    // Rarity effects
    { id: "rarity_common", category: "rarity", size: 100 },
    { id: "rarity_uncommon", category: "rarity", size: 150 },
    { id: "rarity_rare", category: "rarity", size: 200 },
    { id: "rarity_epic", category: "rarity", size: 250 },
    { id: "rarity_legendary", category: "rarity", size: 350 },
    { id: "rarity_mythic", category: "rarity", size: 500 },
  ];

  for (const comp of componentDefs) {
    // Placeholder SVG data
    const svg = `<g id="${comp.id}"><!-- ${comp.size} bytes --></g>`;
    components.set(comp.id, svg);
    totalSize += comp.size;

    if (comp.size > largest.size) {
      largest = { name: comp.id, size: comp.size };
    }
    if (comp.size < smallest.size) {
      smallest = { name: comp.id, size: comp.size };
    }
  }

  // Build library JSON
  const library = {
    ...GENESIS_BABIES_LIBRARY,
    components: componentDefs.map((c) => ({
      id: c.id,
      category: c.category,
      subtype: c.id.split("_")[1],
      zIndex: c.category === "base" ? 10 : c.category === "bloodline" ? 20 : 30,
      pathData: "", // Would contain actual path data
      fill: "primary",
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
