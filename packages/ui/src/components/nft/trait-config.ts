/**
 * NFT Trait Configuration
 *
 * Data-driven visual configuration for Genesis Sparks traits.
 * Follows the same pattern as sprite-config.ts for levels.
 */

import type { Bloodline, BaseType, RarityTier } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface SpriteFeature {
  type: "rect" | "circle" | "polygon" | "path" | "ellipse";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  r?: number;
  cx?: number;
  cy?: number;
  rx?: number;
  ry?: number;
  points?: string;
  d?: string;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  transform?: string;
}

export interface ColorPalette {
  primary: string;
  secondary: string;
  accent: string;
  outline: string;
  background: string;
  glow?: string;
}

export interface EffectsConfig {
  aura: boolean;
  auraColor?: string;
  particles: boolean;
  particleColor?: string;
  glowIntensity: number;
  animate?: boolean;
}

export interface TraitVisualConfig {
  name: string;
  palette: ColorPalette;
  features: SpriteFeature[];
  effects: EffectsConfig;
  accessories?: SpriteFeature[];
}

// =============================================================================
// BASE TYPE CONFIGURATIONS
// Each base type has a distinct body shape and style
// =============================================================================

export const BASE_TYPE_CONFIGS: Record<BaseType, TraitVisualConfig> = {
  human: {
    name: "Human Spark",
    palette: {
      primary: "#ffcc99",
      secondary: "#ffb380",
      accent: "#ff9966",
      outline: "#8b5a2b",
      background: "#2a1810",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0,
    },
    features: [
      // Body - rounded rectangle
      {
        type: "rect",
        x: 4,
        y: 6,
        width: 8,
        height: 8,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head - circle
      {
        type: "circle",
        cx: 8,
        cy: 5,
        r: 4,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Eyes
      { type: "circle", cx: 6.5, cy: 4.5, r: 0.8, fill: "#1a1a2e" },
      { type: "circle", cx: 9.5, cy: 4.5, r: 0.8, fill: "#1a1a2e" },
      // Eye highlights
      { type: "circle", cx: 6.8, cy: 4.2, r: 0.3, fill: "#ffffff" },
      { type: "circle", cx: 9.8, cy: 4.2, r: 0.3, fill: "#ffffff" },
      // Mouth
      {
        type: "path",
        d: "M6.5 6.5 Q8 7.5 9.5 6.5",
        fill: "none",
        stroke: "#8b5a2b",
        strokeWidth: 0.4,
      },
      // Cheeks
      { type: "circle", cx: 5, cy: 5.5, r: 0.6, fill: "#ff9999", opacity: 0.5 },
      {
        type: "circle",
        cx: 11,
        cy: 5.5,
        r: 0.6,
        fill: "#ff9999",
        opacity: 0.5,
      },
    ],
  },

  animal: {
    name: "Animal Spark",
    palette: {
      primary: "#d4a574",
      secondary: "#c4956a",
      accent: "#e8c09a",
      outline: "#5c3d2e",
      background: "#1a1510",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0,
    },
    features: [
      // Body - more rounded
      {
        type: "circle",
        cx: 8,
        cy: 10,
        r: 4,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head
      {
        type: "circle",
        cx: 8,
        cy: 5,
        r: 4.5,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Ears (triangular)
      {
        type: "polygon",
        points: "3,2 5,5 1,5",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      {
        type: "polygon",
        points: "13,2 11,5 15,5",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Inner ears
      {
        type: "polygon",
        points: "3.5,3 4.5,5 2,5",
        fill: "accent",
        opacity: 0.6,
      },
      {
        type: "polygon",
        points: "12.5,3 11.5,5 14,5",
        fill: "accent",
        opacity: 0.6,
      },
      // Eyes (larger, more round)
      { type: "circle", cx: 6, cy: 4.5, r: 1.2, fill: "#1a1a2e" },
      { type: "circle", cx: 10, cy: 4.5, r: 1.2, fill: "#1a1a2e" },
      // Eye highlights
      { type: "circle", cx: 6.4, cy: 4, r: 0.4, fill: "#ffffff" },
      { type: "circle", cx: 10.4, cy: 4, r: 0.4, fill: "#ffffff" },
      // Nose
      { type: "polygon", points: "7.5,6.5 8.5,6.5 8,7.5", fill: "#5c3d2e" },
      // Whiskers
      {
        type: "path",
        d: "M4 6 L2 5.5",
        fill: "none",
        stroke: "outline",
        strokeWidth: 0.2,
      },
      {
        type: "path",
        d: "M4 6.5 L2 6.5",
        fill: "none",
        stroke: "outline",
        strokeWidth: 0.2,
      },
      {
        type: "path",
        d: "M12 6 L14 5.5",
        fill: "none",
        stroke: "outline",
        strokeWidth: 0.2,
      },
      {
        type: "path",
        d: "M12 6.5 L14 6.5",
        fill: "none",
        stroke: "outline",
        strokeWidth: 0.2,
      },
    ],
  },

  robot: {
    name: "Robot Spark",
    palette: {
      primary: "#7a8a9a",
      secondary: "#5a6a7a",
      accent: "#4fc3f7",
      outline: "#2a3a4a",
      background: "#0a1520",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0.3,
    },
    features: [
      // Body - boxy
      {
        type: "rect",
        x: 3,
        y: 7,
        width: 10,
        height: 7,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head - square
      {
        type: "rect",
        x: 4,
        y: 1,
        width: 8,
        height: 6,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Antenna
      { type: "rect", x: 7.5, y: -1, width: 1, height: 2, fill: "secondary" },
      { type: "circle", cx: 8, cy: -1.5, r: 0.8, fill: "accent" },
      // Screen/face
      {
        type: "rect",
        x: 5,
        y: 2.5,
        width: 6,
        height: 3,
        fill: "#1a2a3a",
        stroke: "accent",
        strokeWidth: 0.3,
      },
      // Eyes (LED)
      { type: "rect", x: 5.5, y: 3, width: 1.5, height: 1.5, fill: "accent" },
      { type: "rect", x: 9, y: 3, width: 1.5, height: 1.5, fill: "accent" },
      // Chest panel
      {
        type: "rect",
        x: 5,
        y: 8.5,
        width: 6,
        height: 4,
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Chest lights
      { type: "circle", cx: 6.5, cy: 10, r: 0.5, fill: "#ff5555" },
      { type: "circle", cx: 8, cy: 10, r: 0.5, fill: "#ffff55" },
      { type: "circle", cx: 9.5, cy: 10, r: 0.5, fill: "#55ff55" },
      // Bolts
      { type: "circle", cx: 4.5, cy: 8, r: 0.4, fill: "secondary" },
      { type: "circle", cx: 11.5, cy: 8, r: 0.4, fill: "secondary" },
    ],
  },

  mystic: {
    name: "Mystic Spark",
    palette: {
      primary: "#9966ff",
      secondary: "#7744dd",
      accent: "#ffcc00",
      outline: "#4422aa",
      background: "#100820",
      glow: "#9966ff",
    },
    effects: {
      aura: true,
      auraColor: "#9966ff",
      particles: true,
      particleColor: "#ffcc00",
      glowIntensity: 0.5,
    },
    features: [
      // Aura base (rendered first)
      { type: "circle", cx: 8, cy: 8, r: 7, fill: "primary", opacity: 0.15 },
      // Body - ethereal
      {
        type: "circle",
        cx: 8,
        cy: 10,
        r: 3.5,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head
      {
        type: "circle",
        cx: 8,
        cy: 5,
        r: 4,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Third eye (center)
      {
        type: "circle",
        cx: 8,
        cy: 2.5,
        r: 0.8,
        fill: "accent",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Main eyes (glowing)
      { type: "circle", cx: 6, cy: 5, r: 1, fill: "#ffffff" },
      { type: "circle", cx: 10, cy: 5, r: 1, fill: "#ffffff" },
      { type: "circle", cx: 6, cy: 5, r: 0.5, fill: "accent" },
      { type: "circle", cx: 10, cy: 5, r: 0.5, fill: "accent" },
      // Crown/horns
      {
        type: "polygon",
        points: "4,1 5,3 3,3",
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      {
        type: "polygon",
        points: "12,1 11,3 13,3",
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Runes on body
      {
        type: "path",
        d: "M7 10 L8 9 L9 10",
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.4,
      },
      {
        type: "path",
        d: "M8 10 L8 11.5",
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.4,
      },
    ],
  },

  alien: {
    name: "Alien Spark",
    palette: {
      primary: "#88ff88",
      secondary: "#55cc55",
      accent: "#ffff88",
      outline: "#228822",
      background: "#051005",
      glow: "#88ff88",
    },
    effects: {
      aura: true,
      auraColor: "#88ff88",
      particles: false,
      glowIntensity: 0.4,
    },
    features: [
      // Body - slim
      {
        type: "path",
        d: "M5 14 Q8 8 11 14 L8 14 Z",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head - large oval
      {
        type: "ellipse",
        x: 8,
        y: 4,
        width: 10,
        height: 7,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Eyes - large almond shaped
      {
        type: "ellipse",
        x: 5.5,
        y: 4,
        width: 3,
        height: 4,
        fill: "#1a1a1a",
        stroke: "outline",
        strokeWidth: 0.3,
        transform: "rotate(-15 5.5 4)",
      },
      {
        type: "ellipse",
        x: 10.5,
        y: 4,
        width: 3,
        height: 4,
        fill: "#1a1a1a",
        stroke: "outline",
        strokeWidth: 0.3,
        transform: "rotate(15 10.5 4)",
      },
      // Eye shine
      {
        type: "ellipse",
        x: 6,
        y: 3,
        width: 1,
        height: 1.5,
        fill: "#ffffff",
        opacity: 0.5,
        transform: "rotate(-15 6 3)",
      },
      {
        type: "ellipse",
        x: 10,
        y: 3,
        width: 1,
        height: 1.5,
        fill: "#ffffff",
        opacity: 0.5,
        transform: "rotate(15 10 3)",
      },
      // Mouth - simple line
      {
        type: "path",
        d: "M7 6.5 L9 6.5",
        fill: "none",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Antenna
      { type: "circle", cx: 6, cy: 0, r: 0.6, fill: "accent" },
      {
        type: "path",
        d: "M6 0.6 Q6 2 7 3",
        fill: "none",
        stroke: "secondary",
        strokeWidth: 0.4,
      },
      { type: "circle", cx: 10, cy: 0, r: 0.6, fill: "accent" },
      {
        type: "path",
        d: "M10 0.6 Q10 2 9 3",
        fill: "none",
        stroke: "secondary",
        strokeWidth: 0.4,
      },
    ],
  },
  // Elemental - uses mystic as base with fire colors
  elemental: {
    name: "Elemental Spark",
    palette: {
      primary: "#ff6b35",
      secondary: "#f7c59f",
      accent: "#ffd700",
      outline: "#c41e3a",
      background: "#1a0f0a",
      glow: "#ff6b35",
    },
    effects: {
      aura: true,
      auraColor: "#ff6b35",
      particles: true,
      particleColor: "#ffd700",
      glowIntensity: 0.5,
    },
    features: [
      {
        type: "ellipse",
        x: 8,
        y: 9,
        width: 8,
        height: 10,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      {
        type: "ellipse",
        x: 8,
        y: 5,
        width: 6,
        height: 5,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      { type: "circle", cx: 6, cy: 4, r: 1.2, fill: "accent" },
      { type: "circle", cx: 10, cy: 4, r: 1.2, fill: "accent" },
      { type: "circle", cx: 6, cy: 3.5, r: 0.4, fill: "#ffffff" },
      { type: "circle", cx: 10, cy: 3.5, r: 0.4, fill: "#ffffff" },
    ],
  },
  // Shaman - spiritual nature connection
  shaman: {
    name: "Shaman Spark",
    palette: {
      primary: "#059669",
      secondary: "#34d399",
      accent: "#fbbf24",
      outline: "#047857",
      background: "#0a1410",
      glow: "#34d399",
    },
    effects: {
      aura: true,
      auraColor: "#34d399",
      particles: true,
      particleColor: "#fbbf24",
      glowIntensity: 0.5,
    },
    features: [
      // Body - organic shape
      {
        type: "ellipse",
        x: 8,
        y: 9,
        width: 7,
        height: 8,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head
      {
        type: "circle",
        cx: 8,
        cy: 5,
        r: 4,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Spirit eyes (glowing)
      { type: "circle", cx: 6, cy: 4.5, r: 1, fill: "accent" },
      { type: "circle", cx: 10, cy: 4.5, r: 1, fill: "accent" },
      { type: "circle", cx: 6.3, cy: 4.2, r: 0.3, fill: "#ffffff" },
      { type: "circle", cx: 10.3, cy: 4.2, r: 0.3, fill: "#ffffff" },
      // Nature markings
      {
        type: "path",
        d: "M6 7 Q8 8 10 7",
        fill: "none",
        stroke: "secondary",
        strokeWidth: 0.4,
      },
    ],
  },

  // Dragon - powerful mythical creature
  dragon: {
    name: "Dragon Spark",
    palette: {
      primary: "#dc2626",
      secondary: "#ef4444",
      accent: "#fbbf24",
      outline: "#7f1d1d",
      background: "#1a0505",
      glow: "#ef4444",
    },
    effects: {
      aura: true,
      auraColor: "#ef4444",
      particles: true,
      particleColor: "#fbbf24",
      glowIntensity: 0.7,
    },
    features: [
      // Body - dragon scales
      {
        type: "ellipse",
        x: 8,
        y: 10,
        width: 8,
        height: 8,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Head
      {
        type: "circle",
        cx: 8,
        cy: 5,
        r: 4.5,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.5,
      },
      // Horns
      {
        type: "polygon",
        points: "4,2 5,4 3,4",
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      {
        type: "polygon",
        points: "12,2 11,4 13,4",
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Fierce eyes
      { type: "ellipse", x: 6, y: 4.5, width: 2, height: 1.5, fill: "accent" },
      { type: "ellipse", x: 10, y: 4.5, width: 2, height: 1.5, fill: "accent" },
      { type: "circle", cx: 6, cy: 4.5, r: 0.4, fill: "#1a1a1a" },
      { type: "circle", cx: 10, cy: 4.5, r: 0.4, fill: "#1a1a1a" },
      // Snout
      { type: "ellipse", x: 8, y: 7, width: 3, height: 2, fill: "secondary" },
      // Nostrils
      { type: "circle", cx: 7, cy: 7, r: 0.3, fill: "outline" },
      { type: "circle", cx: 9, cy: 7, r: 0.3, fill: "outline" },
    ],
  },
};

// =============================================================================
// BLOODLINE CONFIGURATIONS
// Bloodlines add accessories/overlays to the base type
// =============================================================================

export const BLOODLINE_CONFIGS: Record<Bloodline, TraitVisualConfig> = {
  royal: {
    name: "Royal Bloodline",
    palette: {
      primary: "#ffd700",
      secondary: "#ffaa00",
      accent: "#ffffff",
      outline: "#8b6914",
      background: "#1a1505",
    },
    effects: {
      aura: true,
      auraColor: "#ffd700",
      particles: true,
      particleColor: "#ffd700",
      glowIntensity: 0.3,
    },
    features: [],
    accessories: [
      // Crown
      {
        type: "polygon",
        points: "4,0 5,2 6,0 7,2 8,0 9,2 10,0 11,2 12,0 12,2 4,2",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      {
        type: "rect",
        x: 4,
        y: 1.5,
        width: 8,
        height: 1,
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.2,
      },
      // Crown jewels
      { type: "circle", cx: 6, cy: 0.8, r: 0.4, fill: "#ff0055" },
      { type: "circle", cx: 8, cy: 0.8, r: 0.5, fill: "#00aaff" },
      { type: "circle", cx: 10, cy: 0.8, r: 0.4, fill: "#55ff00" },
    ],
  },

  warrior: {
    name: "Warrior Bloodline",
    palette: {
      primary: "#cc3333",
      secondary: "#aa2222",
      accent: "#ff6666",
      outline: "#661111",
      background: "#150505",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0,
    },
    features: [],
    accessories: [
      // Helmet
      {
        type: "path",
        d: "M3 3 L3 -1 Q8 -3 13 -1 L13 3 Z",
        fill: "#666666",
        stroke: "#333333",
        strokeWidth: 0.5,
      },
      // Helmet ridge
      { type: "rect", x: 7, y: -2.5, width: 2, height: 5, fill: "primary" },
      // Face guard
      { type: "rect", x: 4, y: 3, width: 1, height: 3, fill: "#666666" },
      { type: "rect", x: 11, y: 3, width: 1, height: 3, fill: "#666666" },
      // Battle scar
      {
        type: "path",
        d: "M11 4 L13 6",
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.4,
      },
    ],
  },

  rogue: {
    name: "Rogue Bloodline",
    palette: {
      primary: "#333355",
      secondary: "#222244",
      accent: "#8888ff",
      outline: "#111122",
      background: "#050510",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0.1,
    },
    features: [],
    accessories: [
      // Hood
      {
        type: "path",
        d: "M2 5 Q2 -1 8 -2 Q14 -1 14 5 L12 4 Q8 1 4 4 Z",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.4,
      },
      // Hood shadow
      { type: "path", d: "M4 3 Q8 1 12 3", fill: "secondary", opacity: 0.5 },
      // Mask
      {
        type: "rect",
        x: 4,
        y: 4,
        width: 8,
        height: 2,
        fill: "secondary",
        stroke: "outline",
        strokeWidth: 0.3,
      },
      // Eye glint
      { type: "circle", cx: 6.5, cy: 5, r: 0.5, fill: "accent" },
      { type: "circle", cx: 9.5, cy: 5, r: 0.5, fill: "accent" },
    ],
  },

  mystic: {
    name: "Mystic Bloodline",
    palette: {
      primary: "#aa44ff",
      secondary: "#8822dd",
      accent: "#ffcc00",
      outline: "#551188",
      background: "#0a0515",
    },
    effects: {
      aura: true,
      auraColor: "#aa44ff",
      particles: true,
      particleColor: "#ffcc00",
      glowIntensity: 0.6,
    },
    features: [],
    accessories: [
      // Wizard hat
      {
        type: "polygon",
        points: "8,-4 3,3 13,3",
        fill: "primary",
        stroke: "outline",
        strokeWidth: 0.4,
      },
      // Hat band
      { type: "rect", x: 3, y: 2, width: 10, height: 1.5, fill: "secondary" },
      // Hat star
      {
        type: "polygon",
        points:
          "8,-2 8.5,-1 9.5,-1 8.7,-0.3 9,0.7 8,0 7,-0.7 7.3,-0.3 6.5,-1 7.5,-1",
        fill: "accent",
      },
      // Magic runes floating
      { type: "circle", cx: 2, cy: 6, r: 0.5, fill: "accent", opacity: 0.7 },
      { type: "circle", cx: 14, cy: 8, r: 0.4, fill: "accent", opacity: 0.6 },
      { type: "circle", cx: 1, cy: 10, r: 0.3, fill: "accent", opacity: 0.5 },
    ],
  },

  scholar: {
    name: "Scholar Bloodline",
    palette: {
      primary: "#6366f1",
      secondary: "#4f46e5",
      accent: "#a5b4fc",
      outline: "#312e81",
      background: "#0f0f23",
    },
    effects: {
      aura: true,
      auraColor: "#6366f1",
      particles: false,
      glowIntensity: 0.3,
    },
    features: [],
    accessories: [
      // Glasses
      {
        type: "circle",
        cx: 5.5,
        cy: 4,
        r: 1.5,
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.4,
      },
      {
        type: "circle",
        cx: 10.5,
        cy: 4,
        r: 1.5,
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.4,
      },
      {
        type: "path",
        d: "M7 4 L9 4",
        fill: "none",
        stroke: "accent",
        strokeWidth: 0.3,
      },
      // Book
      { type: "rect", x: 12, y: 8, width: 3, height: 4, fill: "primary" },
      { type: "rect", x: 12.5, y: 8.5, width: 2, height: 3, fill: "#fef3c7" },
    ],
  },

  merchant: {
    name: "Merchant Bloodline",
    palette: {
      primary: "#fbbf24",
      secondary: "#f59e0b",
      accent: "#fcd34d",
      outline: "#92400e",
      background: "#1a1505",
    },
    effects: {
      aura: false,
      particles: true,
      particleColor: "#fcd34d",
      glowIntensity: 0.2,
    },
    features: [],
    accessories: [
      // Coin bag
      { type: "ellipse", x: 13, y: 10, width: 3, height: 4, fill: "#78350f" },
      { type: "circle", cx: 13, cy: 9, r: 0.8, fill: "accent" },
      // Coins
      { type: "circle", cx: 2, cy: 12, r: 0.6, fill: "primary" },
      { type: "circle", cx: 3, cy: 11, r: 0.5, fill: "accent" },
    ],
  },
};

// =============================================================================
// RARITY CONFIGURATIONS
// Rarity adds visual effects and enhancements
// =============================================================================

export const RARITY_CONFIGS: Record<RarityTier, TraitVisualConfig> = {
  common: {
    name: "Common",
    palette: {
      primary: "#888888",
      secondary: "#666666",
      accent: "#aaaaaa",
      outline: "#444444",
      background: "#1a1a1a",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0,
    },
    features: [],
  },

  uncommon: {
    name: "Uncommon",
    palette: {
      primary: "#55bb55",
      secondary: "#449944",
      accent: "#88ff88",
      outline: "#226622",
      background: "#0a150a",
    },
    effects: {
      aura: false,
      particles: false,
      glowIntensity: 0.1,
    },
    features: [],
  },

  rare: {
    name: "Rare",
    palette: {
      primary: "#4488ff",
      secondary: "#3366dd",
      accent: "#88ccff",
      outline: "#224488",
      background: "#050a15",
    },
    effects: {
      aura: true,
      auraColor: "#4488ff",
      particles: false,
      glowIntensity: 0.2,
    },
    features: [],
  },

  epic: {
    name: "Epic",
    palette: {
      primary: "#aa44ff",
      secondary: "#8822dd",
      accent: "#cc88ff",
      outline: "#551188",
      background: "#0a0515",
    },
    effects: {
      aura: true,
      auraColor: "#aa44ff",
      particles: true,
      particleColor: "#cc88ff",
      glowIntensity: 0.4,
    },
    features: [],
  },

  legendary: {
    name: "Legendary",
    palette: {
      primary: "#ffaa00",
      secondary: "#dd8800",
      accent: "#ffcc55",
      outline: "#885500",
      background: "#150a00",
    },
    effects: {
      aura: true,
      auraColor: "#ffaa00",
      particles: true,
      particleColor: "#ffcc55",
      glowIntensity: 0.6,
      animate: true,
    },
    features: [],
  },

  mythic: {
    name: "Mythic",
    palette: {
      primary: "#ff55aa",
      secondary: "#dd3388",
      accent: "#ffffff",
      outline: "#882255",
      background: "#150510",
      glow: "#ff55aa",
    },
    effects: {
      aura: true,
      auraColor: "#ff55aa",
      particles: true,
      particleColor: "#ffffff",
      glowIntensity: 1.0,
      animate: true,
    },
    features: [],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get combined configuration for an NFT based on its traits
 */
export function getNFTVisualConfig(
  baseType: BaseType,
  bloodline: Bloodline,
  rarity: RarityTier,
): {
  baseConfig: TraitVisualConfig;
  bloodlineConfig: TraitVisualConfig;
  rarityConfig: TraitVisualConfig;
  combinedEffects: EffectsConfig;
} {
  const baseConfig = BASE_TYPE_CONFIGS[baseType];
  const bloodlineConfig = BLOODLINE_CONFIGS[bloodline];
  const rarityConfig = RARITY_CONFIGS[rarity];

  // Combine effects (higher rarity/bloodline effects take precedence)
  const combinedEffects: EffectsConfig = {
    aura:
      baseConfig.effects.aura ||
      bloodlineConfig.effects.aura ||
      rarityConfig.effects.aura,
    auraColor:
      rarityConfig.effects.auraColor ||
      bloodlineConfig.effects.auraColor ||
      baseConfig.effects.auraColor,
    particles:
      baseConfig.effects.particles ||
      bloodlineConfig.effects.particles ||
      rarityConfig.effects.particles,
    particleColor:
      rarityConfig.effects.particleColor ||
      bloodlineConfig.effects.particleColor ||
      baseConfig.effects.particleColor,
    glowIntensity: Math.max(
      baseConfig.effects.glowIntensity,
      bloodlineConfig.effects.glowIntensity,
      rarityConfig.effects.glowIntensity,
    ),
    animate: rarityConfig.effects.animate || bloodlineConfig.effects.animate,
  };

  return {
    baseConfig,
    bloodlineConfig,
    rarityConfig,
    combinedEffects,
  };
}

/**
 * Resolve palette color references to actual hex values
 */
export function resolvePaletteColor(
  color: string,
  palette: ColorPalette,
): string {
  const colorMap: Record<string, keyof ColorPalette> = {
    primary: "primary",
    secondary: "secondary",
    accent: "accent",
    outline: "outline",
    background: "background",
    glow: "glow",
  };

  if (color in colorMap) {
    return palette[colorMap[color]] || color;
  }

  return color;
}

/**
 * Get DNA-based color variation
 */
export function getDNAColorVariation(
  baseColor: string,
  dna: string,
  variationIndex: number,
): string {
  // Use DNA nibbles to create subtle color variations
  const nibble = parseInt(dna[variationIndex % dna.length], 16);
  const variation = (nibble - 8) * 3; // -24 to +21 variation

  // Parse hex color
  const hex = baseColor.replace("#", "");
  if (hex.length !== 6) return baseColor;

  const r = Math.max(
    0,
    Math.min(255, parseInt(hex.slice(0, 2), 16) + variation),
  );
  const g = Math.max(
    0,
    Math.min(255, parseInt(hex.slice(2, 4), 16) + variation),
  );
  const b = Math.max(
    0,
    Math.min(255, parseInt(hex.slice(4, 6), 16) + variation),
  );

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}
