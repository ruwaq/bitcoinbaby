/**
 * Genesis Spark NFT Sprite Types
 *
 * Type definitions for the NFT sprite generation system.
 *
 * Note: These types extend the canonical @bitcoinbaby/core types
 * for UI-specific visualization purposes.
 */

import type {
  Bloodline,
  BaseType as CoreBaseType,
  Heritage,
  RarityTier,
} from "@bitcoinbaby/core";

// Re-export canonical types
export type { Bloodline, Heritage, RarityTier };

/**
 * @deprecated Use RarityTier instead (same values, canonical naming)
 */
export type Rarity = RarityTier;

// =============================================================================
// EXTENDED BASE TYPES (UI-only visual variants)
// =============================================================================

/**
 * Extended BaseType for sprite visualization.
 * Includes canonical types + UI-only visual variants (shaman, elemental, dragon)
 * that are used for special sprite effects but not stored on-chain.
 */
export type BaseType = CoreBaseType | "shaman" | "elemental" | "dragon";

export type GenesisBabyState =
  | "idle"
  | "happy"
  | "sleeping"
  | "hungry"
  | "mining"
  | "learning"
  | "evolving"
  | "thriving"
  | "struggling";

/** @deprecated Use GenesisBabyState instead */
export type BabyState = GenesisBabyState;

// =============================================================================
// COLOR PALETTES
// =============================================================================

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  skin: string;
  skinShade: string;
  eyes: string;
  highlight: string;
  shadow: string;
}

export const BASE_TYPE_COLORS: Record<BaseType, ColorPalette> = {
  human: {
    primary: "#f7931a", // Bitcoin orange
    secondary: "#ffc107", // Gold
    accent: "#4fc3f7", // Cyan
    skin: "#ffcc99", // Skin tone
    skinShade: "#e6b380",
    eyes: "#1f2937",
    highlight: "#ffffff",
    shadow: "#e67e00",
  },
  animal: {
    primary: "#f97316", // Warm orange
    secondary: "#fbbf24", // Amber
    accent: "#84cc16", // Lime green
    skin: "#d4a574", // Fur tone
    skinShade: "#b8956c",
    eyes: "#1f2937", // Dark eyes
    highlight: "#fef3c7",
    shadow: "#c2410c",
  },
  shaman: {
    primary: "#059669", // Nature green
    secondary: "#34d399", // Light green
    accent: "#fbbf24", // Amber spirits
    skin: "#a67c52", // Earthy skin
    skinShade: "#8a6042",
    eyes: "#fbbf24", // Spirit eyes
    highlight: "#d1fae5",
    shadow: "#047857",
  },
  robot: {
    primary: "#64748b", // Steel gray
    secondary: "#94a3b8", // Light steel
    accent: "#22d3ee", // Cyan LED
    skin: "#cbd5e1", // Metal
    skinShade: "#94a3b8",
    eyes: "#22d3ee", // LED eyes
    highlight: "#f1f5f9",
    shadow: "#475569",
  },
  mystic: {
    primary: "#8b5cf6", // Purple magic
    secondary: "#a78bfa", // Light purple
    accent: "#f472b6", // Pink energy
    skin: "#ddd6fe", // Ethereal
    skinShade: "#c4b5fd",
    eyes: "#fbbf24", // Golden mystical
    highlight: "#ffffff",
    shadow: "#7c3aed",
  },
  alien: {
    primary: "#10b981", // Alien green
    secondary: "#34d399", // Light green
    accent: "#06b6d4", // Teal tech
    skin: "#a7f3d0", // Green skin
    skinShade: "#6ee7b7",
    eyes: "#000000", // Black alien eyes
    highlight: "#d1fae5",
    shadow: "#059669",
  },
  elemental: {
    primary: "#f97316", // Fire orange
    secondary: "#38bdf8", // Water blue
    accent: "#22c55e", // Earth green
    skin: "#fbbf24", // Energy yellow
    skinShade: "#f59e0b",
    eyes: "#1f2937", // Dark
    highlight: "#ffffff",
    shadow: "#c2410c",
  },
  dragon: {
    primary: "#dc2626", // Dragon red
    secondary: "#fbbf24", // Gold
    accent: "#8b5cf6", // Purple magic
    skin: "#ef4444", // Scales
    skinShade: "#b91c1c",
    eyes: "#fef08a", // Glowing eyes
    highlight: "#fef3c7",
    shadow: "#7f1d1d",
  },
};

// =============================================================================
// BLOODLINE ACCESSORIES
// =============================================================================

export interface BloodlineStyle {
  name: string;
  crownType: "none" | "small" | "medium" | "large";
  crownColor: string;
  accessoryType: "none" | "scar" | "mask" | "hood" | "aura";
  accessoryColor: string;
  bodyPattern: "none" | "stripes" | "dots" | "runes";
}

export const BLOODLINE_STYLES: Record<Bloodline, BloodlineStyle> = {
  royal: {
    name: "Royal",
    crownType: "medium",
    crownColor: "#ffd700",
    accessoryType: "none",
    accessoryColor: "#ffd700",
    bodyPattern: "none",
  },
  warrior: {
    name: "Warrior",
    crownType: "none",
    crownColor: "#dc2626",
    accessoryType: "scar",
    accessoryColor: "#dc2626",
    bodyPattern: "stripes",
  },
  rogue: {
    name: "Rogue",
    crownType: "none",
    crownColor: "#1f2937",
    accessoryType: "mask",
    accessoryColor: "#1f2937",
    bodyPattern: "none",
  },
  mystic: {
    name: "Mystic",
    crownType: "small",
    crownColor: "#8b5cf6",
    accessoryType: "aura",
    accessoryColor: "#8b5cf6",
    bodyPattern: "runes",
  },
};

// =============================================================================
// HERITAGE ELEMENTS
// =============================================================================

export interface HeritageStyle {
  name: string;
  region: string;
  elementType: "feather" | "beads" | "symbol" | "pattern" | "jewel";
  elementColor: string;
  secondaryColor: string;
  pattern: string;
}

export const HERITAGE_STYLES: Record<Heritage, HeritageStyle> = {
  americas: {
    name: "Americas",
    region: "Americas",
    elementType: "feather",
    elementColor: "#dc2626", // Red feather
    secondaryColor: "#059669", // Green
    pattern: "aztec",
  },
  africa: {
    name: "Africa",
    region: "Africa",
    elementType: "beads",
    elementColor: "#f59e0b", // Gold beads
    secondaryColor: "#dc2626", // Red
    pattern: "kente",
  },
  asia: {
    name: "Asia",
    region: "Asia",
    elementType: "symbol",
    elementColor: "#dc2626", // Red
    secondaryColor: "#ffd700", // Gold
    pattern: "waves",
  },
  europa: {
    name: "Europa",
    region: "Europa",
    elementType: "jewel",
    elementColor: "#3b82f6", // Blue sapphire
    secondaryColor: "#ffd700", // Gold
    pattern: "celtic",
  },
  oceania: {
    name: "Oceania",
    region: "Oceania",
    elementType: "pattern",
    elementColor: "#0891b2", // Ocean blue
    secondaryColor: "#f97316", // Coral
    pattern: "tribal",
  },
};

// =============================================================================
// RARITY EFFECTS
// =============================================================================

export interface RarityEffect {
  name: string;
  glowColor: string;
  glowIntensity: number;
  particleType: "none" | "sparkle" | "stars" | "flames" | "cosmic" | "divine";
  particleColor: string;
  borderColor: string;
  backgroundEffect: "none" | "gradient" | "pattern" | "animated";
}

export const RARITY_EFFECTS: Record<Rarity, RarityEffect> = {
  common: {
    name: "Common",
    glowColor: "transparent",
    glowIntensity: 0,
    particleType: "none",
    particleColor: "transparent",
    borderColor: "#6b7280",
    backgroundEffect: "none",
  },
  uncommon: {
    name: "Uncommon",
    glowColor: "#22c55e",
    glowIntensity: 0.2,
    particleType: "none",
    particleColor: "#22c55e",
    borderColor: "#22c55e",
    backgroundEffect: "none",
  },
  rare: {
    name: "Rare",
    glowColor: "#3b82f6",
    glowIntensity: 0.3,
    particleType: "sparkle",
    particleColor: "#3b82f6",
    borderColor: "#3b82f6",
    backgroundEffect: "gradient",
  },
  epic: {
    name: "Epic",
    glowColor: "#8b5cf6",
    glowIntensity: 0.4,
    particleType: "stars",
    particleColor: "#8b5cf6",
    borderColor: "#8b5cf6",
    backgroundEffect: "gradient",
  },
  legendary: {
    name: "Legendary",
    glowColor: "#f59e0b",
    glowIntensity: 0.5,
    particleType: "flames",
    particleColor: "#f59e0b",
    borderColor: "#f59e0b",
    backgroundEffect: "animated",
  },
  mythic: {
    name: "Mythic",
    glowColor: "#ec4899",
    glowIntensity: 0.6,
    particleType: "divine",
    particleColor: "#ec4899",
    borderColor: "#ec4899",
    backgroundEffect: "animated",
  },
};

// =============================================================================
// SPRITE PROPS
// =============================================================================

export interface GenesisBabySpriteProps {
  /** Base type of the baby */
  baseType: BaseType;
  /** Bloodline for accessories */
  bloodline?: Bloodline;
  /** Heritage for cultural elements */
  heritage?: Heritage;
  /** Rarity for visual effects */
  rarity?: Rarity;
  /** Current state/animation */
  state?: BabyState;
  /** Size in pixels */
  size?: number;
  /** Level (1-100) affects visual complexity */
  level?: number;
  /** DNA seed for deterministic variations */
  dna?: string;
  /** Additional CSS classes */
  className?: string;
  /** Show rarity glow effect */
  showGlow?: boolean;
  /** Show particles */
  showParticles?: boolean;
  /** Animation enabled */
  animated?: boolean;
}

// =============================================================================
// DNA TRAITS (for deterministic generation)
// =============================================================================

export interface DNATraits {
  eyeShape: number; // 0-3
  mouthShape: number; // 0-3
  bodyShape: number; // 0-2
  accessorySlot1: number; // 0-5
  accessorySlot2: number; // 0-5
  colorVariant: number; // 0-4 (slight color shifts)
  patternVariant: number; // 0-3
  specialTrait: number; // 0-9 (rare special features)
}

/**
 * Parse DNA string into traits
 */
export function parseDNA(dna: string): DNATraits {
  // Use DNA hash to generate deterministic traits
  const hash = dna || "0000000000000000";

  return {
    eyeShape: parseInt(hash[0], 16) % 4,
    mouthShape: parseInt(hash[1], 16) % 4,
    bodyShape: parseInt(hash[2], 16) % 3,
    accessorySlot1: parseInt(hash[3], 16) % 6,
    accessorySlot2: parseInt(hash[4], 16) % 6,
    colorVariant: parseInt(hash[5], 16) % 5,
    patternVariant: parseInt(hash[6], 16) % 4,
    specialTrait: parseInt(hash[7], 16) % 10,
  };
}

/**
 * Convert hex color to HSL
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 0, s: 0, l: 0 };

  const r = parseInt(result[1], 16) / 255;
  const g = parseInt(result[2], 16) / 255;
  const b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number): string => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Apply hue-shift to a color based on pixel art best practices:
 * - Darker shades shift toward blue (cooler)
 * - Lighter shades shift toward yellow (warmer)
 */
function applyHueShift(hex: string, variant: number): string {
  const hsl = hexToHSL(hex);

  // Variant determines the intensity of the shift
  const shiftIntensity = [0, 8, -8, 15, -15][variant] || 0;

  // Apply lightness-based hue shift (pixel art technique)
  // Lighter colors shift warm (+), darker colors shift cool (-)
  const lightnessShift = (hsl.l - 50) / 50; // -1 to 1
  const hueShift = shiftIntensity + lightnessShift * 5;

  // Apply saturation boost for mid-tones
  const saturationBoost = hsl.l > 30 && hsl.l < 70 ? Math.abs(variant) * 2 : 0;

  const newH = (hsl.h + hueShift + 360) % 360;
  const newS = Math.min(100, Math.max(0, hsl.s + saturationBoost));

  return hslToHex(newH, newS, hsl.l);
}

/**
 * Apply color variant to palette using hue-shifting
 */
export function applyColorVariant(
  palette: ColorPalette,
  variant: number,
): ColorPalette {
  if (variant === 0) return palette;

  return {
    primary: applyHueShift(palette.primary, variant),
    secondary: applyHueShift(palette.secondary, variant),
    accent: applyHueShift(palette.accent, variant),
    skin: applyHueShift(palette.skin, variant),
    skinShade: applyHueShift(palette.skinShade, variant),
    eyes: palette.eyes, // Keep eyes unchanged for recognizability
    highlight: palette.highlight, // Keep highlight white
    shadow: applyHueShift(palette.shadow, variant),
  };
}

/**
 * Get CSS glow class based on rarity
 */
export function getRarityGlowClass(rarity: Rarity): string {
  const glowClasses: Record<Rarity, string> = {
    common: "",
    uncommon: "nft-glow-uncommon",
    rare: "nft-glow-rare",
    epic: "nft-glow-epic",
    legendary: "nft-glow-legendary",
    mythic: "nft-glow-mythic",
  };
  return glowClasses[rarity];
}

/**
 * Get CSS filter for rarity glow (inline style fallback)
 */
export function getRarityGlowFilter(rarity: Rarity): string {
  const filters: Record<Rarity, string> = {
    common: "none",
    uncommon: "drop-shadow(0 0 2px #22c55e)",
    rare: "drop-shadow(0 0 3px #3b82f6) drop-shadow(0 0 6px #60a5fa)",
    epic: "drop-shadow(0 0 4px #8b5cf6) drop-shadow(0 0 8px #a78bfa)",
    legendary:
      "drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 8px #fcd34d) drop-shadow(0 0 12px #fef3c7)",
    mythic:
      "drop-shadow(0 0 3px #ef4444) drop-shadow(0 0 6px #f97316) drop-shadow(0 0 9px #eab308)",
  };
  return filters[rarity];
}
