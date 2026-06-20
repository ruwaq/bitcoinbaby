/**
 * Elemental Spark Sprite - NATURE'S FORCES
 *
 * Bebés elementales que encarnan las fuerzas de la naturaleza.
 * +20% poder en clima relacionado, resistencia elemental.
 *
 * 5 Variantes elementales:
 * - Fire: Llama viva con cuerpo de fuego
 * - Water: Gota animada con forma fluida
 * - Earth: Golem de cristal/roca pequeño
 * - Air: Espíritu de viento translúcido
 * - Lightning: Ser de energía eléctrica
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface ElementalSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type ElementalVariant = "fire" | "water" | "earth" | "air" | "lightning";

interface ElementalColors {
  core: string;
  glow: string;
  accent: string;
  highlight: string;
  eyes: string;
  outline: string;
}

const ELEMENTAL_COLORS: Record<ElementalVariant, ElementalColors[]> = {
  fire: [
    {
      core: "#dc2626",
      glow: "#f97316",
      accent: "#fbbf24",
      highlight: "#fef08a",
      eyes: "#1f2937",
      outline: "#991b1b",
    },
    {
      core: "#ea580c",
      glow: "#fb923c",
      accent: "#fcd34d",
      highlight: "#ffffff",
      eyes: "#1f2937",
      outline: "#c2410c",
    },
    {
      core: "#b91c1c",
      glow: "#dc2626",
      accent: "#f87171",
      highlight: "#fecaca",
      eyes: "#fef08a",
      outline: "#7f1d1d",
    },
    {
      core: "#9333ea",
      glow: "#c084fc",
      accent: "#f472b6",
      highlight: "#fdf4ff",
      eyes: "#1f2937",
      outline: "#6b21a8",
    },
    {
      core: "#0891b2",
      glow: "#22d3ee",
      accent: "#67e8f9",
      highlight: "#ecfeff",
      eyes: "#1f2937",
      outline: "#0e7490",
    },
  ],
  water: [
    {
      core: "#0284c7",
      glow: "#38bdf8",
      accent: "#7dd3fc",
      highlight: "#ffffff",
      eyes: "#1e3a8a",
      outline: "#0369a1",
    },
    {
      core: "#0891b2",
      glow: "#22d3ee",
      accent: "#67e8f9",
      highlight: "#ecfeff",
      eyes: "#164e63",
      outline: "#0e7490",
    },
    {
      core: "#0d9488",
      glow: "#2dd4bf",
      accent: "#5eead4",
      highlight: "#ccfbf1",
      eyes: "#134e4a",
      outline: "#0f766e",
    },
    {
      core: "#6366f1",
      glow: "#818cf8",
      accent: "#a5b4fc",
      highlight: "#e0e7ff",
      eyes: "#1e1b4b",
      outline: "#4f46e5",
    },
    {
      core: "#8b5cf6",
      glow: "#a78bfa",
      accent: "#c4b5fd",
      highlight: "#ede9fe",
      eyes: "#4c1d95",
      outline: "#7c3aed",
    },
  ],
  earth: [
    {
      core: "#78350f",
      glow: "#a16207",
      accent: "#ca8a04",
      highlight: "#fef08a",
      eyes: "#fbbf24",
      outline: "#451a03",
    },
    {
      core: "#166534",
      glow: "#22c55e",
      accent: "#4ade80",
      highlight: "#bbf7d0",
      eyes: "#fef08a",
      outline: "#14532d",
    },
    {
      core: "#6b7280",
      glow: "#9ca3af",
      accent: "#d1d5db",
      highlight: "#ffffff",
      eyes: "#3b82f6",
      outline: "#4b5563",
    },
    {
      core: "#be185d",
      glow: "#ec4899",
      accent: "#f472b6",
      highlight: "#fce7f3",
      eyes: "#fbbf24",
      outline: "#9d174d",
    },
    {
      core: "#0891b2",
      glow: "#06b6d4",
      accent: "#22d3ee",
      highlight: "#cffafe",
      eyes: "#fef08a",
      outline: "#0e7490",
    },
  ],
  air: [
    {
      core: "#e5e7eb",
      glow: "#f3f4f6",
      accent: "#ffffff",
      highlight: "#ffffff",
      eyes: "#3b82f6",
      outline: "#9ca3af",
    },
    {
      core: "#bfdbfe",
      glow: "#dbeafe",
      accent: "#eff6ff",
      highlight: "#ffffff",
      eyes: "#1e40af",
      outline: "#93c5fd",
    },
    {
      core: "#fce7f3",
      glow: "#fbcfe8",
      accent: "#fdf2f8",
      highlight: "#ffffff",
      eyes: "#be185d",
      outline: "#f9a8d4",
    },
    {
      core: "#d1fae5",
      glow: "#a7f3d0",
      accent: "#ecfdf5",
      highlight: "#ffffff",
      eyes: "#059669",
      outline: "#6ee7b7",
    },
    {
      core: "#fef3c7",
      glow: "#fde68a",
      accent: "#fffbeb",
      highlight: "#ffffff",
      eyes: "#d97706",
      outline: "#fcd34d",
    },
  ],
  lightning: [
    {
      core: "#eab308",
      glow: "#facc15",
      accent: "#fef08a",
      highlight: "#ffffff",
      eyes: "#1f2937",
      outline: "#ca8a04",
    },
    {
      core: "#8b5cf6",
      glow: "#a78bfa",
      accent: "#c4b5fd",
      highlight: "#ffffff",
      eyes: "#fef08a",
      outline: "#7c3aed",
    },
    {
      core: "#06b6d4",
      glow: "#22d3ee",
      accent: "#67e8f9",
      highlight: "#ffffff",
      eyes: "#1f2937",
      outline: "#0891b2",
    },
    {
      core: "#f43f5e",
      glow: "#fb7185",
      accent: "#fda4af",
      highlight: "#ffffff",
      eyes: "#1f2937",
      outline: "#e11d48",
    },
    {
      core: "#22c55e",
      glow: "#4ade80",
      accent: "#86efac",
      highlight: "#ffffff",
      eyes: "#1f2937",
      outline: "#16a34a",
    },
  ],
};

const getElementalVariant = (dna: string): ElementalVariant => {
  const variants: ElementalVariant[] = [
    "fire",
    "water",
    "earth",
    "air",
    "lightning",
  ];
  const index = parseInt(dna[0] || "0", 16) % 5;
  return variants[index];
};

const getElementalColors = (
  variant: ElementalVariant,
  dna: string,
): ElementalColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return ELEMENTAL_COLORS[variant][index];
};

export const ElementalSprite: FC<ElementalSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  className = "",
}) => {
  const variant = getElementalVariant(dna);
  const colors = getElementalColors(variant, dna);

  const stateClasses: Record<BabyState, string> = {
    idle: "animate-[float_3s_ease-in-out_infinite]",
    happy: "animate-bounce",
    sleeping: "",
    hungry: "animate-[shake_0.5s_ease-in-out_infinite]",
    mining: "animate-pulse",
    learning: "",
    evolving: "animate-spin",
    thriving: "animate-pulse",
    struggling: "animate-[shake_1s_ease-in-out_infinite]",
  };

  // Fire - Living flame baby
  const renderFire = () => (
    <>
      {/* Flame tip */}
      <rect
        x="15"
        y="0"
        width="2"
        height="2"
        fill={colors.highlight}
        opacity="0.8"
      />
      <rect x="14" y="2" width="4" height="2" fill={colors.accent} />
      <rect x="13" y="4" width="6" height="2" fill={colors.glow} />

      {/* Main flame head */}
      <rect x="11" y="6" width="10" height="8" fill={colors.core} />
      <rect x="10" y="8" width="1" height="4" fill={colors.core} />
      <rect x="21" y="8" width="1" height="4" fill={colors.core} />

      {/* Inner glow */}
      <rect x="13" y="7" width="6" height="5" fill={colors.glow} />
      <rect x="14" y="6" width="4" height="2" fill={colors.accent} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="9" width="3" height="3" fill={colors.eyes} />
          <rect x="17" y="9" width="3" height="3" fill={colors.eyes} />
          <rect x="13" y="10" width="1" height="1" fill={colors.highlight} />
          <rect x="18" y="10" width="1" height="1" fill={colors.highlight} />
        </>
      ) : (
        <>
          <rect
            x="12"
            y="10"
            width="3"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
          <rect
            x="17"
            y="10"
            width="3"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
        </>
      )}

      {/* Happy mouth */}
      <rect
        x="14"
        y="12"
        width="4"
        height="1"
        fill={colors.eyes}
        opacity="0.7"
      />

      {/* Flame body */}
      <rect x="10" y="14" width="12" height="8" fill={colors.core} />
      <rect x="12" y="14" width="8" height="6" fill={colors.glow} />
      <rect x="14" y="15" width="4" height="3" fill={colors.accent} />
      <rect x="15" y="16" width="2" height="1" fill={colors.highlight} />

      {/* Arms (flame wisps) */}
      <rect x="6" y="14" width="4" height="3" fill={colors.glow} />
      <rect x="5" y="13" width="2" height="2" fill={colors.accent} />
      <rect x="22" y="14" width="4" height="3" fill={colors.glow} />
      <rect x="25" y="13" width="2" height="2" fill={colors.accent} />

      {/* Flickering bottom */}
      <rect x="11" y="22" width="10" height="3" fill={colors.core} />
      <rect
        x="12"
        y="25"
        width="8"
        height="2"
        fill={colors.glow}
        opacity="0.8"
      />
      <rect
        x="13"
        y="27"
        width="6"
        height="2"
        fill={colors.glow}
        opacity="0.6"
      />
      <rect
        x="14"
        y="29"
        width="4"
        height="2"
        fill={colors.accent}
        opacity="0.4"
      />
      <rect
        x="15"
        y="31"
        width="2"
        height="1"
        fill={colors.accent}
        opacity="0.2"
      />
    </>
  );

  // Water - Animated water drop baby
  const renderWater = () => (
    <>
      {/* Drop top */}
      <rect x="15" y="2" width="2" height="2" fill={colors.accent} />
      <rect x="14" y="4" width="4" height="2" fill={colors.glow} />
      <rect x="13" y="6" width="6" height="2" fill={colors.core} />

      {/* Main body (rounded drop shape) */}
      <rect x="11" y="8" width="10" height="12" fill={colors.core} />
      <rect x="10" y="10" width="1" height="8" fill={colors.core} />
      <rect x="21" y="10" width="1" height="8" fill={colors.core} />
      <rect x="9" y="12" width="1" height="4" fill={colors.core} />
      <rect x="22" y="12" width="1" height="4" fill={colors.core} />

      {/* Inner shine */}
      <rect x="13" y="9" width="6" height="8" fill={colors.glow} />
      <rect x="14" y="8" width="4" height="2" fill={colors.accent} />

      {/* Highlight bubble */}
      <rect
        x="18"
        y="10"
        width="2"
        height="3"
        fill={colors.highlight}
        opacity="0.7"
      />
      <rect x="19" y="11" width="1" height="1" fill={colors.highlight} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="12" width="3" height="3" fill={colors.eyes} />
          <rect x="17" y="12" width="3" height="3" fill={colors.eyes} />
          <rect x="13" y="13" width="1" height="1" fill={colors.highlight} />
          <rect x="18" y="13" width="1" height="1" fill={colors.highlight} />
        </>
      ) : (
        <>
          <rect
            x="12"
            y="13"
            width="3"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
          <rect
            x="17"
            y="13"
            width="3"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
        </>
      )}

      {/* Cute mouth */}
      <rect
        x="14"
        y="16"
        width="4"
        height="1"
        fill={colors.eyes}
        opacity="0.5"
      />

      {/* Wave arms */}
      <rect
        x="6"
        y="13"
        width="3"
        height="4"
        fill={colors.glow}
        opacity="0.8"
      />
      <rect
        x="5"
        y="14"
        width="2"
        height="2"
        fill={colors.accent}
        opacity="0.6"
      />
      <rect
        x="23"
        y="13"
        width="3"
        height="4"
        fill={colors.glow}
        opacity="0.8"
      />
      <rect
        x="25"
        y="14"
        width="2"
        height="2"
        fill={colors.accent}
        opacity="0.6"
      />

      {/* Bottom ripples */}
      <rect x="12" y="20" width="8" height="2" fill={colors.core} />
      <rect
        x="11"
        y="22"
        width="10"
        height="2"
        fill={colors.glow}
        opacity="0.7"
      />
      <rect
        x="10"
        y="24"
        width="12"
        height="2"
        fill={colors.glow}
        opacity="0.5"
      />
      <rect
        x="9"
        y="26"
        width="14"
        height="2"
        fill={colors.accent}
        opacity="0.3"
      />
      <rect
        x="8"
        y="28"
        width="16"
        height="2"
        fill={colors.accent}
        opacity="0.2"
      />
    </>
  );

  // Earth - Crystal/rock golem baby
  const renderEarth = () => (
    <>
      {/* Crystal crown */}
      <rect x="12" y="2" width="2" height="4" fill={colors.accent} />
      <rect x="15" y="0" width="2" height="6" fill={colors.glow} />
      <rect x="18" y="2" width="2" height="4" fill={colors.accent} />

      {/* Head */}
      <rect x="10" y="6" width="12" height="10" fill={colors.core} />
      <rect x="9" y="8" width="1" height="6" fill={colors.core} />
      <rect x="22" y="8" width="1" height="6" fill={colors.core} />

      {/* Crystal facets */}
      <rect x="11" y="7" width="3" height="3" fill={colors.glow} />
      <rect x="18" y="7" width="3" height="3" fill={colors.glow} />
      <rect x="14" y="6" width="4" height="2" fill={colors.accent} />

      {/* Glowing eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="10" width="4" height="3" fill="#1f2937" />
          <rect x="17" y="10" width="4" height="3" fill="#1f2937" />
          <rect x="12" y="11" width="2" height="2" fill={colors.eyes} />
          <rect x="18" y="11" width="2" height="2" fill={colors.eyes} />
          <rect x="12" y="11" width="1" height="1" fill={colors.highlight} />
          <rect x="18" y="11" width="1" height="1" fill={colors.highlight} />
        </>
      ) : (
        <>
          <rect x="11" y="11" width="4" height="1" fill="#1f2937" />
          <rect x="17" y="11" width="4" height="1" fill="#1f2937" />
        </>
      )}

      {/* Mouth (crack) */}
      <rect x="14" y="14" width="4" height="1" fill={colors.outline} />

      {/* Rocky body */}
      <rect x="9" y="16" width="14" height="10" fill={colors.core} />
      <rect x="8" y="18" width="1" height="6" fill={colors.core} />
      <rect x="23" y="18" width="1" height="6" fill={colors.core} />

      {/* Crystal embedded in chest */}
      <rect x="13" y="18" width="6" height="5" fill={colors.outline} />
      <rect x="14" y="19" width="4" height="3" fill={colors.glow} />
      <rect x="15" y="20" width="2" height="2" fill={colors.eyes} />
      <rect x="15" y="20" width="1" height="1" fill={colors.highlight} />

      {/* Rock texture */}
      <rect
        x="10"
        y="17"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.5"
      />
      <rect
        x="20"
        y="19"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.5"
      />

      {/* Arms (rock chunks) */}
      <rect x="4" y="17" width="4" height="5" fill={colors.core} />
      <rect
        x="3"
        y="18"
        width="2"
        height="3"
        fill={colors.glow}
        opacity="0.6"
      />
      <rect x="24" y="17" width="4" height="5" fill={colors.core} />
      <rect
        x="27"
        y="18"
        width="2"
        height="3"
        fill={colors.glow}
        opacity="0.6"
      />

      {/* Sturdy legs */}
      <rect x="10" y="26" width="5" height="4" fill={colors.core} />
      <rect x="17" y="26" width="5" height="4" fill={colors.core} />
      <rect x="10" y="30" width="5" height="2" fill={colors.outline} />
      <rect x="17" y="30" width="5" height="2" fill={colors.outline} />
    </>
  );

  // Air - Wispy wind spirit baby
  const renderAir = () => (
    <>
      {/* Swirling top */}
      <rect
        x="14"
        y="2"
        width="4"
        height="2"
        fill={colors.core}
        opacity="0.5"
      />
      <rect
        x="12"
        y="4"
        width="8"
        height="2"
        fill={colors.core}
        opacity="0.6"
      />
      <rect
        x="16"
        y="3"
        width="4"
        height="2"
        fill={colors.accent}
        opacity="0.4"
      />

      {/* Head (translucent) */}
      <rect
        x="10"
        y="6"
        width="12"
        height="10"
        fill={colors.core}
        opacity="0.8"
      />
      <rect x="9" y="8" width="1" height="6" fill={colors.core} opacity="0.6" />
      <rect
        x="22"
        y="8"
        width="1"
        height="6"
        fill={colors.core}
        opacity="0.6"
      />

      {/* Inner glow */}
      <rect
        x="12"
        y="7"
        width="8"
        height="7"
        fill={colors.glow}
        opacity="0.5"
      />
      <rect
        x="14"
        y="6"
        width="4"
        height="2"
        fill={colors.accent}
        opacity="0.4"
      />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="9" width="4" height="3" fill={colors.eyes} />
          <rect x="17" y="9" width="4" height="3" fill={colors.eyes} />
          <rect x="12" y="10" width="2" height="2" fill={colors.highlight} />
          <rect x="18" y="10" width="2" height="2" fill={colors.highlight} />
        </>
      ) : (
        <>
          <rect
            x="11"
            y="10"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
          <rect
            x="17"
            y="10"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
        </>
      )}

      {/* Gentle smile */}
      <rect
        x="14"
        y="13"
        width="4"
        height="1"
        fill={colors.outline}
        opacity="0.4"
      />

      {/* Wispy body */}
      <rect
        x="11"
        y="16"
        width="10"
        height="6"
        fill={colors.core}
        opacity="0.7"
      />
      <rect
        x="12"
        y="22"
        width="8"
        height="3"
        fill={colors.core}
        opacity="0.5"
      />
      <rect
        x="13"
        y="25"
        width="6"
        height="2"
        fill={colors.glow}
        opacity="0.4"
      />
      <rect
        x="14"
        y="27"
        width="4"
        height="2"
        fill={colors.glow}
        opacity="0.3"
      />

      {/* Swirling arms */}
      <rect
        x="6"
        y="12"
        width="3"
        height="4"
        fill={colors.core}
        opacity="0.6"
      />
      <rect
        x="4"
        y="10"
        width="3"
        height="3"
        fill={colors.accent}
        opacity="0.4"
      />
      <rect
        x="3"
        y="8"
        width="2"
        height="2"
        fill={colors.accent}
        opacity="0.3"
      />
      <rect
        x="23"
        y="12"
        width="3"
        height="4"
        fill={colors.core}
        opacity="0.6"
      />
      <rect
        x="25"
        y="10"
        width="3"
        height="3"
        fill={colors.accent}
        opacity="0.4"
      />
      <rect
        x="27"
        y="8"
        width="2"
        height="2"
        fill={colors.accent}
        opacity="0.3"
      />

      {/* Floating particles */}
      <rect
        x="8"
        y="6"
        width="1"
        height="1"
        fill={colors.accent}
        opacity="0.5"
      />
      <rect
        x="23"
        y="5"
        width="1"
        height="1"
        fill={colors.accent}
        opacity="0.5"
      />
      <rect
        x="6"
        y="18"
        width="1"
        height="1"
        fill={colors.glow}
        opacity="0.4"
      />
      <rect
        x="25"
        y="20"
        width="1"
        height="1"
        fill={colors.glow}
        opacity="0.4"
      />
    </>
  );

  // Lightning - Electric energy baby
  const renderLightning = () => (
    <>
      {/* Electric crown/sparks */}
      <rect x="14" y="0" width="2" height="3" fill={colors.highlight} />
      <rect x="10" y="2" width="2" height="2" fill={colors.accent} />
      <rect x="20" y="2" width="2" height="2" fill={colors.accent} />
      <rect x="12" y="1" width="2" height="3" fill={colors.glow} />
      <rect x="18" y="1" width="2" height="3" fill={colors.glow} />

      {/* Head */}
      <rect x="10" y="4" width="12" height="10" fill={colors.core} />
      <rect x="9" y="6" width="1" height="6" fill={colors.core} />
      <rect x="22" y="6" width="1" height="6" fill={colors.core} />

      {/* Inner energy */}
      <rect x="12" y="5" width="8" height="7" fill={colors.glow} />
      <rect x="14" y="4" width="4" height="2" fill={colors.accent} />
      <rect x="15" y="4" width="2" height="1" fill={colors.highlight} />

      {/* Eyes (electric) */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="8" width="4" height="3" fill={colors.eyes} />
          <rect x="17" y="8" width="4" height="3" fill={colors.eyes} />
          <rect x="12" y="9" width="2" height="2" fill={colors.highlight} />
          <rect x="18" y="9" width="2" height="2" fill={colors.highlight} />
          <rect x="12" y="9" width="1" height="1" fill="#ffffff" />
          <rect x="18" y="9" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect
            x="11"
            y="9"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
          <rect
            x="17"
            y="9"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.5"
          />
        </>
      )}

      {/* Excited mouth */}
      <rect x="14" y="12" width="4" height="1" fill={colors.eyes} />

      {/* Charged body */}
      <rect x="10" y="14" width="12" height="10" fill={colors.core} />
      <rect x="12" y="15" width="8" height="6" fill={colors.glow} />

      {/* Lightning bolt on chest */}
      <rect x="15" y="16" width="2" height="2" fill={colors.highlight} />
      <rect x="14" y="18" width="2" height="2" fill={colors.accent} />
      <rect x="15" y="20" width="2" height="2" fill={colors.highlight} />
      <rect x="16" y="18" width="2" height="2" fill={colors.accent} />

      {/* Crackling arms */}
      <rect x="5" y="14" width="4" height="4" fill={colors.glow} />
      <rect x="4" y="12" width="2" height="3" fill={colors.accent} />
      <rect x="3" y="10" width="2" height="2" fill={colors.highlight} />
      <rect x="23" y="14" width="4" height="4" fill={colors.glow} />
      <rect x="26" y="12" width="2" height="3" fill={colors.accent} />
      <rect x="27" y="10" width="2" height="2" fill={colors.highlight} />

      {/* Sparking legs */}
      <rect x="11" y="24" width="4" height="4" fill={colors.core} />
      <rect x="17" y="24" width="4" height="4" fill={colors.core} />
      <rect x="10" y="28" width="5" height="2" fill={colors.glow} />
      <rect x="17" y="28" width="5" height="2" fill={colors.glow} />

      {/* Spark particles */}
      <rect x="7" y="6" width="1" height="1" fill={colors.highlight} />
      <rect x="24" y="8" width="1" height="1" fill={colors.highlight} />
      <rect x="5" y="20" width="1" height="1" fill={colors.accent} />
      <rect x="26" y="22" width="1" height="1" fill={colors.accent} />
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case "fire":
        return renderFire();
      case "water":
        return renderWater();
      case "earth":
        return renderEarth();
      case "air":
        return renderAir();
      case "lightning":
        return renderLightning();
      default:
        return renderFire();
    }
  };

  return (
    <div className={`relative ${stateClasses[state]} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ imageRendering: "pixelated" }}
      >
        {renderVariant()}

        {/* Mining state - elemental particles */}
        {state === "mining" && (
          <>
            <rect x="4" y="6" width="2" height="2" fill={colors.glow}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="26" y="8" width="2" height="2" fill={colors.accent}>
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}

        {/* Learning state - knowledge glow */}
        {state === "learning" && (
          <>
            <rect
              x="2"
              y="4"
              width="3"
              height="3"
              fill={colors.highlight}
              opacity="0.6"
            />
            <rect x="3" y="5" width="1" height="1" fill={colors.eyes} />
          </>
        )}
      </svg>

      {/* Elemental particles for thriving */}
      {state === "thriving" && (
        <>
          <div
            className="absolute w-1.5 h-1.5 rounded-sm animate-ping"
            style={{ top: "10%", left: "15%", backgroundColor: colors.glow }}
          />
          <div
            className="absolute w-1 h-1 rounded-sm animate-ping"
            style={{
              top: "20%",
              right: "10%",
              backgroundColor: colors.accent,
              animationDelay: "0.3s",
            }}
          />
        </>
      )}

      {/* Evolving energy */}
      {state === "evolving" && (
        <>
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{ top: "10%", left: "20%", backgroundColor: colors.glow }}
          />
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              top: "25%",
              right: "15%",
              backgroundColor: colors.accent,
              animationDelay: "0.2s",
            }}
          />
        </>
      )}

      {/* Sleeping */}
      {state === "sleeping" && (
        <div
          className="absolute font-pixel animate-bounce"
          style={{
            top: "-10%",
            right: "0",
            fontSize: size / 8,
            color: colors.glow,
          }}
        >
          Zzz
        </div>
      )}

      {/* Happy sparkles */}
      {state === "happy" && (
        <>
          <div
            className="absolute animate-bounce"
            style={{
              top: "-5%",
              left: "15%",
              fontSize: size / 10,
              color: colors.glow,
            }}
          >
            ✦
          </div>
          <div
            className="absolute animate-bounce"
            style={{
              top: "0%",
              right: "20%",
              fontSize: size / 12,
              color: colors.accent,
              animationDelay: "0.15s",
            }}
          >
            ✧
          </div>
        </>
      )}
    </div>
  );
};

export default ElementalSprite;
