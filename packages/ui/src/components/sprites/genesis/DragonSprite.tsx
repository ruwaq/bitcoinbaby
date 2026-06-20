/**
 * Dragon Spark Sprite - MYTHICAL CREATURES
 *
 * Bebés dragón con poderes elementales.
 * +30% poder en combate, colección de tesoros.
 *
 * 5 Variantes de dragón:
 * - Fire Dragon: Dragón rojo clásico con llamas
 * - Ice Dragon: Dragón de hielo azul/blanco
 * - Earth Dragon: Dragón de naturaleza verde/marrón
 * - Storm Dragon: Dragón de tormenta púrpura/amarillo
 * - Shadow Dragon: Dragón oscuro con ojos brillantes
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface DragonSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type DragonVariant = "fire" | "ice" | "earth" | "storm" | "shadow";

interface DragonColors {
  body: string;
  bodyLight: string;
  belly: string;
  wing: string;
  wingMembrane: string;
  horn: string;
  eyes: string;
  glow: string;
  claws: string;
}

const DRAGON_COLORS: Record<DragonVariant, DragonColors[]> = {
  fire: [
    {
      body: "#dc2626",
      bodyLight: "#ef4444",
      belly: "#fbbf24",
      wing: "#b91c1c",
      wingMembrane: "#f97316",
      horn: "#fef08a",
      eyes: "#fef08a",
      glow: "#f97316",
      claws: "#1f2937",
    },
    {
      body: "#ea580c",
      bodyLight: "#f97316",
      belly: "#fcd34d",
      wing: "#c2410c",
      wingMembrane: "#fb923c",
      horn: "#ffffff",
      eyes: "#fef08a",
      glow: "#fbbf24",
      claws: "#1f2937",
    },
    {
      body: "#9333ea",
      bodyLight: "#a855f7",
      belly: "#f472b6",
      wing: "#7e22ce",
      wingMembrane: "#c084fc",
      horn: "#fef08a",
      eyes: "#fef08a",
      glow: "#c084fc",
      claws: "#1f2937",
    },
    {
      body: "#b91c1c",
      bodyLight: "#dc2626",
      belly: "#fef3c7",
      wing: "#7f1d1d",
      wingMembrane: "#f87171",
      horn: "#fbbf24",
      eyes: "#22d3ee",
      glow: "#ef4444",
      claws: "#451a03",
    },
    {
      body: "#0f172a",
      bodyLight: "#1e293b",
      belly: "#f97316",
      wing: "#020617",
      wingMembrane: "#334155",
      horn: "#f97316",
      eyes: "#f97316",
      glow: "#fb923c",
      claws: "#1f2937",
    },
  ],
  ice: [
    {
      body: "#0ea5e9",
      bodyLight: "#38bdf8",
      belly: "#e0f2fe",
      wing: "#0284c7",
      wingMembrane: "#7dd3fc",
      horn: "#ffffff",
      eyes: "#ffffff",
      glow: "#67e8f9",
      claws: "#0c4a6e",
    },
    {
      body: "#06b6d4",
      bodyLight: "#22d3ee",
      belly: "#ecfeff",
      wing: "#0891b2",
      wingMembrane: "#67e8f9",
      horn: "#f0f9ff",
      eyes: "#f0f9ff",
      glow: "#a5f3fc",
      claws: "#164e63",
    },
    {
      body: "#8b5cf6",
      bodyLight: "#a78bfa",
      belly: "#ede9fe",
      wing: "#7c3aed",
      wingMembrane: "#c4b5fd",
      horn: "#ffffff",
      eyes: "#67e8f9",
      glow: "#c4b5fd",
      claws: "#4c1d95",
    },
    {
      body: "#e5e7eb",
      bodyLight: "#f3f4f6",
      belly: "#ffffff",
      wing: "#d1d5db",
      wingMembrane: "#f9fafb",
      horn: "#93c5fd",
      eyes: "#3b82f6",
      glow: "#bfdbfe",
      claws: "#6b7280",
    },
    {
      body: "#3b82f6",
      bodyLight: "#60a5fa",
      belly: "#dbeafe",
      wing: "#2563eb",
      wingMembrane: "#93c5fd",
      horn: "#ffffff",
      eyes: "#ffffff",
      glow: "#60a5fa",
      claws: "#1e3a8a",
    },
  ],
  earth: [
    {
      body: "#15803d",
      bodyLight: "#22c55e",
      belly: "#fef3c7",
      wing: "#166534",
      wingMembrane: "#4ade80",
      horn: "#78350f",
      eyes: "#fbbf24",
      glow: "#86efac",
      claws: "#451a03",
    },
    {
      body: "#78350f",
      bodyLight: "#a16207",
      belly: "#fde68a",
      wing: "#451a03",
      wingMembrane: "#ca8a04",
      horn: "#fef3c7",
      eyes: "#22c55e",
      glow: "#fcd34d",
      claws: "#1c1917",
    },
    {
      body: "#65a30d",
      bodyLight: "#84cc16",
      belly: "#ecfccb",
      wing: "#4d7c0f",
      wingMembrane: "#a3e635",
      horn: "#78350f",
      eyes: "#fbbf24",
      glow: "#bef264",
      claws: "#365314",
    },
    {
      body: "#0d9488",
      bodyLight: "#14b8a6",
      belly: "#ccfbf1",
      wing: "#0f766e",
      wingMembrane: "#2dd4bf",
      horn: "#fef3c7",
      eyes: "#fef08a",
      glow: "#5eead4",
      claws: "#134e4a",
    },
    {
      body: "#92400e",
      bodyLight: "#b45309",
      belly: "#fef3c7",
      wing: "#78350f",
      wingMembrane: "#d97706",
      horn: "#ecfccb",
      eyes: "#84cc16",
      glow: "#fbbf24",
      claws: "#451a03",
    },
  ],
  storm: [
    {
      body: "#7c3aed",
      bodyLight: "#8b5cf6",
      belly: "#fef08a",
      wing: "#6d28d9",
      wingMembrane: "#a78bfa",
      horn: "#facc15",
      eyes: "#facc15",
      glow: "#c4b5fd",
      claws: "#4c1d95",
    },
    {
      body: "#1e3a8a",
      bodyLight: "#1d4ed8",
      belly: "#fef9c3",
      wing: "#172554",
      wingMembrane: "#3b82f6",
      horn: "#fbbf24",
      eyes: "#fbbf24",
      glow: "#60a5fa",
      claws: "#0f172a",
    },
    {
      body: "#4f46e5",
      bodyLight: "#6366f1",
      belly: "#fef08a",
      wing: "#4338ca",
      wingMembrane: "#818cf8",
      horn: "#fcd34d",
      eyes: "#fde047",
      glow: "#a5b4fc",
      claws: "#312e81",
    },
    {
      body: "#0891b2",
      bodyLight: "#06b6d4",
      belly: "#fef3c7",
      wing: "#0e7490",
      wingMembrane: "#22d3ee",
      horn: "#fbbf24",
      eyes: "#facc15",
      glow: "#67e8f9",
      claws: "#164e63",
    },
    {
      body: "#db2777",
      bodyLight: "#ec4899",
      belly: "#fef08a",
      wing: "#be185d",
      wingMembrane: "#f472b6",
      horn: "#fcd34d",
      eyes: "#fde047",
      glow: "#f9a8d4",
      claws: "#9d174d",
    },
  ],
  shadow: [
    {
      body: "#1f2937",
      bodyLight: "#374151",
      belly: "#4b5563",
      wing: "#111827",
      wingMembrane: "#6b7280",
      horn: "#9ca3af",
      eyes: "#a855f7",
      glow: "#8b5cf6",
      claws: "#030712",
    },
    {
      body: "#0f172a",
      bodyLight: "#1e293b",
      belly: "#334155",
      wing: "#020617",
      wingMembrane: "#475569",
      horn: "#a5b4fc",
      eyes: "#c084fc",
      glow: "#a78bfa",
      claws: "#020617",
    },
    {
      body: "#18181b",
      bodyLight: "#27272a",
      belly: "#3f3f46",
      wing: "#09090b",
      wingMembrane: "#52525b",
      horn: "#fda4af",
      eyes: "#f43f5e",
      glow: "#fb7185",
      claws: "#09090b",
    },
    {
      body: "#1e1b4b",
      bodyLight: "#312e81",
      belly: "#4338ca",
      wing: "#0f172a",
      wingMembrane: "#4f46e5",
      horn: "#c4b5fd",
      eyes: "#e879f9",
      glow: "#d946ef",
      claws: "#0f0a1a",
    },
    {
      body: "#14532d",
      bodyLight: "#166534",
      belly: "#22c55e",
      wing: "#052e16",
      wingMembrane: "#15803d",
      horn: "#86efac",
      eyes: "#4ade80",
      glow: "#22c55e",
      claws: "#052e16",
    },
  ],
};

const getDragonVariant = (dna: string): DragonVariant => {
  const variants: DragonVariant[] = ["fire", "ice", "earth", "storm", "shadow"];
  const index = parseInt(dna[0] || "0", 16) % 5;
  return variants[index];
};

const getDragonColors = (variant: DragonVariant, dna: string): DragonColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return DRAGON_COLORS[variant][index];
};

export const DragonSprite: FC<DragonSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  className = "",
}) => {
  const variant = getDragonVariant(dna);
  const colors = getDragonColors(variant, dna);

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

  // Fire Dragon - Classic red with flames
  const renderFireDragon = () => (
    <>
      {/* Horns */}
      <rect x="9" y="2" width="2" height="4" fill={colors.horn} />
      <rect x="8" y="1" width="2" height="2" fill={colors.horn} />
      <rect x="21" y="2" width="2" height="4" fill={colors.horn} />
      <rect x="22" y="1" width="2" height="2" fill={colors.horn} />

      {/* Head spikes */}
      <rect x="14" y="0" width="4" height="3" fill={colors.body} />
      <rect x="15" y="0" width="2" height="1" fill={colors.horn} />

      {/* Head */}
      <rect x="10" y="4" width="12" height="10" fill={colors.body} />
      <rect x="9" y="6" width="1" height="6" fill={colors.body} />
      <rect x="22" y="6" width="1" height="6" fill={colors.body} />
      <rect x="12" y="5" width="8" height="7" fill={colors.bodyLight} />

      {/* Snout */}
      <rect x="8" y="10" width="3" height="3" fill={colors.body} />
      <rect x="7" y="11" width="2" height="2" fill={colors.bodyLight} />

      {/* Nostrils with smoke */}
      <rect
        x="7"
        y="11"
        width="1"
        height="1"
        fill={colors.glow}
        opacity="0.8"
      />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="18" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="13" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="19" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="14" y="8" width="1" height="1" fill="#ffffff" />
          <rect x="20" y="8" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="12" y="8" width="4" height="1" fill="#1f2937" />
          <rect x="18" y="8" width="4" height="1" fill="#1f2937" />
        </>
      )}

      {/* Mouth */}
      <rect x="10" y="12" width="6" height="1" fill="#1f2937" />
      <rect x="9" y="11" width="1" height="2" fill={colors.claws} />

      {/* Neck */}
      <rect x="12" y="14" width="8" height="3" fill={colors.body} />

      {/* Wings */}
      <rect x="2" y="10" width="6" height="8" fill={colors.wing} />
      <rect x="3" y="8" width="4" height="3" fill={colors.wing} />
      <rect x="4" y="6" width="3" height="3" fill={colors.wing} />
      <rect x="3" y="11" width="4" height="5" fill={colors.wingMembrane} />

      <rect x="24" y="10" width="6" height="8" fill={colors.wing} />
      <rect x="25" y="8" width="4" height="3" fill={colors.wing} />
      <rect x="25" y="6" width="3" height="3" fill={colors.wing} />
      <rect x="25" y="11" width="4" height="5" fill={colors.wingMembrane} />

      {/* Body */}
      <rect x="10" y="17" width="12" height="8" fill={colors.body} />
      <rect x="12" y="18" width="8" height="5" fill={colors.belly} />

      {/* Belly scales pattern */}
      <rect
        x="13"
        y="19"
        width="6"
        height="1"
        fill={colors.bodyLight}
        opacity="0.5"
      />
      <rect
        x="13"
        y="21"
        width="6"
        height="1"
        fill={colors.bodyLight}
        opacity="0.5"
      />

      {/* Arms */}
      <rect x="6" y="17" width="4" height="4" fill={colors.body} />
      <rect x="5" y="20" width="3" height="3" fill={colors.bodyLight} />
      <rect x="5" y="22" width="2" height="1" fill={colors.claws} />

      <rect x="22" y="17" width="4" height="4" fill={colors.body} />
      <rect x="24" y="20" width="3" height="3" fill={colors.bodyLight} />
      <rect x="25" y="22" width="2" height="1" fill={colors.claws} />

      {/* Legs */}
      <rect x="10" y="25" width="5" height="5" fill={colors.body} />
      <rect x="17" y="25" width="5" height="5" fill={colors.body} />
      <rect x="9" y="29" width="3" height="2" fill={colors.claws} />
      <rect x="20" y="29" width="3" height="2" fill={colors.claws} />

      {/* Tail */}
      <rect x="22" y="22" width="4" height="3" fill={colors.body} />
      <rect x="25" y="21" width="3" height="2" fill={colors.body} />
      <rect x="27" y="20" width="3" height="2" fill={colors.body} />
      <rect x="29" y="19" width="2" height="2" fill={colors.horn} />
    </>
  );

  // Ice Dragon - Blue/white frost
  const renderIceDragon = () => (
    <>
      {/* Crystal horns */}
      <rect x="9" y="1" width="2" height="5" fill={colors.horn} />
      <rect x="8" y="0" width="2" height="2" fill={colors.glow} opacity="0.7" />
      <rect x="21" y="1" width="2" height="5" fill={colors.horn} />
      <rect
        x="22"
        y="0"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.7"
      />

      {/* Head crest */}
      <rect x="13" y="0" width="6" height="3" fill={colors.body} />
      <rect
        x="14"
        y="0"
        width="4"
        height="1"
        fill={colors.glow}
        opacity="0.5"
      />

      {/* Head */}
      <rect x="10" y="3" width="12" height="11" fill={colors.body} />
      <rect x="9" y="5" width="1" height="7" fill={colors.body} />
      <rect x="22" y="5" width="1" height="7" fill={colors.body} />
      <rect x="12" y="4" width="8" height="8" fill={colors.bodyLight} />

      {/* Frost pattern on face */}
      <rect
        x="11"
        y="5"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.4"
      />
      <rect
        x="19"
        y="5"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.4"
      />

      {/* Snout */}
      <rect x="8" y="9" width="3" height="4" fill={colors.body} />
      <rect x="7" y="10" width="2" height="2" fill={colors.bodyLight} />

      {/* Frost breath */}
      <rect
        x="5"
        y="11"
        width="2"
        height="1"
        fill={colors.glow}
        opacity="0.5"
      />
      <rect
        x="4"
        y="10"
        width="1"
        height="1"
        fill={colors.glow}
        opacity="0.3"
      />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="7" width="4" height="3" fill="#0c4a6e" />
          <rect x="18" y="7" width="4" height="3" fill="#0c4a6e" />
          <rect x="13" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="19" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="14" y="8" width="1" height="1" fill={colors.glow} />
          <rect x="20" y="8" width="1" height="1" fill={colors.glow} />
        </>
      ) : (
        <>
          <rect x="12" y="8" width="4" height="1" fill="#0c4a6e" />
          <rect x="18" y="8" width="4" height="1" fill="#0c4a6e" />
        </>
      )}

      {/* Neck */}
      <rect x="12" y="14" width="8" height="3" fill={colors.body} />

      {/* Crystal wings */}
      <rect x="2" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="3" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="4" y="5" width="3" height="3" fill={colors.glow} opacity="0.6" />
      <rect x="3" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="4"
        y="11"
        width="2"
        height="3"
        fill={colors.glow}
        opacity="0.4"
      />

      <rect x="24" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="25" y="7" width="4" height="3" fill={colors.wing} />
      <rect
        x="25"
        y="5"
        width="3"
        height="3"
        fill={colors.glow}
        opacity="0.6"
      />
      <rect x="25" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="26"
        y="11"
        width="2"
        height="3"
        fill={colors.glow}
        opacity="0.4"
      />

      {/* Body */}
      <rect x="10" y="17" width="12" height="8" fill={colors.body} />
      <rect x="12" y="18" width="8" height="5" fill={colors.belly} />

      {/* Ice crystal on chest */}
      <rect x="14" y="19" width="4" height="3" fill={colors.glow} />
      <rect x="15" y="20" width="2" height="1" fill="#ffffff" />

      {/* Arms */}
      <rect x="6" y="17" width="4" height="4" fill={colors.body} />
      <rect x="5" y="20" width="3" height="3" fill={colors.bodyLight} />

      <rect x="22" y="17" width="4" height="4" fill={colors.body} />
      <rect x="24" y="20" width="3" height="3" fill={colors.bodyLight} />

      {/* Legs */}
      <rect x="10" y="25" width="5" height="5" fill={colors.body} />
      <rect x="17" y="25" width="5" height="5" fill={colors.body} />
      <rect x="9" y="29" width="3" height="2" fill={colors.claws} />
      <rect x="20" y="29" width="3" height="2" fill={colors.claws} />

      {/* Spiky tail */}
      <rect x="22" y="22" width="4" height="3" fill={colors.body} />
      <rect x="25" y="21" width="3" height="2" fill={colors.body} />
      <rect x="27" y="20" width="3" height="3" fill={colors.glow} />
      <rect x="29" y="19" width="2" height="2" fill={colors.horn} />
    </>
  );

  // Earth Dragon - Green nature dragon
  const renderEarthDragon = () => (
    <>
      {/* Wooden horns */}
      <rect x="8" y="2" width="3" height="4" fill={colors.horn} />
      <rect x="7" y="1" width="2" height="2" fill={colors.horn} />
      <rect x="21" y="2" width="3" height="4" fill={colors.horn} />
      <rect x="23" y="1" width="2" height="2" fill={colors.horn} />

      {/* Leaf crest */}
      <rect x="12" y="0" width="8" height="3" fill={colors.glow} />
      <rect x="14" y="0" width="4" height="1" fill={colors.bodyLight} />

      {/* Head */}
      <rect x="10" y="3" width="12" height="11" fill={colors.body} />
      <rect x="9" y="5" width="1" height="7" fill={colors.body} />
      <rect x="22" y="5" width="1" height="7" fill={colors.body} />
      <rect x="12" y="4" width="8" height="8" fill={colors.bodyLight} />

      {/* Moss patches */}
      <rect
        x="11"
        y="4"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.5"
      />
      <rect
        x="19"
        y="5"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.5"
      />

      {/* Snout */}
      <rect x="8" y="9" width="3" height="4" fill={colors.body} />
      <rect x="7" y="10" width="2" height="2" fill={colors.bodyLight} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="18" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="13" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="19" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="13" y="8" width="1" height="1" fill="#ffffff" />
          <rect x="19" y="8" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="12" y="8" width="4" height="1" fill="#1f2937" />
          <rect x="18" y="8" width="4" height="1" fill="#1f2937" />
        </>
      )}

      {/* Neck */}
      <rect x="12" y="14" width="8" height="3" fill={colors.body} />

      {/* Leaf wings */}
      <rect x="2" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="3" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="4" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="3" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="4"
        y="12"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.6"
      />

      <rect x="24" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="25" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="25" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="25" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="26"
        y="12"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.6"
      />

      {/* Body */}
      <rect x="10" y="17" width="12" height="8" fill={colors.body} />
      <rect x="12" y="18" width="8" height="5" fill={colors.belly} />

      {/* Flower on belly */}
      <rect x="15" y="19" width="2" height="2" fill={colors.glow} />
      <rect x="14" y="20" width="1" height="1" fill={colors.eyes} />
      <rect x="17" y="20" width="1" height="1" fill={colors.eyes} />

      {/* Arms */}
      <rect x="6" y="17" width="4" height="4" fill={colors.body} />
      <rect x="5" y="20" width="3" height="3" fill={colors.bodyLight} />
      <rect x="5" y="22" width="2" height="1" fill={colors.claws} />

      <rect x="22" y="17" width="4" height="4" fill={colors.body} />
      <rect x="24" y="20" width="3" height="3" fill={colors.bodyLight} />
      <rect x="25" y="22" width="2" height="1" fill={colors.claws} />

      {/* Legs */}
      <rect x="10" y="25" width="5" height="5" fill={colors.body} />
      <rect x="17" y="25" width="5" height="5" fill={colors.body} />
      <rect x="9" y="29" width="3" height="2" fill={colors.claws} />
      <rect x="20" y="29" width="3" height="2" fill={colors.claws} />

      {/* Leafy tail */}
      <rect x="22" y="22" width="4" height="3" fill={colors.body} />
      <rect x="25" y="21" width="3" height="2" fill={colors.body} />
      <rect x="27" y="20" width="3" height="2" fill={colors.body} />
      <rect x="29" y="18" width="3" height="4" fill={colors.glow} />
    </>
  );

  // Storm Dragon - Electric purple/yellow
  const renderStormDragon = () => (
    <>
      {/* Lightning horns */}
      <rect x="9" y="0" width="2" height="6" fill={colors.horn} />
      <rect x="8" y="2" width="1" height="2" fill={colors.glow} />
      <rect x="21" y="0" width="2" height="6" fill={colors.horn} />
      <rect x="23" y="2" width="1" height="2" fill={colors.glow} />

      {/* Electric crest */}
      <rect x="13" y="0" width="6" height="2" fill={colors.body} />
      <rect x="14" y="0" width="4" height="1" fill={colors.glow} />
      <rect x="15" y="0" width="2" height="1" fill="#ffffff" />

      {/* Head */}
      <rect x="10" y="3" width="12" height="11" fill={colors.body} />
      <rect x="9" y="5" width="1" height="7" fill={colors.body} />
      <rect x="22" y="5" width="1" height="7" fill={colors.body} />
      <rect x="12" y="4" width="8" height="8" fill={colors.bodyLight} />

      {/* Electric marks */}
      <rect x="10" y="6" width="1" height="3" fill={colors.glow} />
      <rect x="21" y="6" width="1" height="3" fill={colors.glow} />

      {/* Snout */}
      <rect x="8" y="9" width="3" height="4" fill={colors.body} />
      <rect x="7" y="10" width="2" height="2" fill={colors.bodyLight} />

      {/* Spark from nose */}
      <rect x="5" y="10" width="2" height="1" fill={colors.glow} />
      <rect x="4" y="11" width="1" height="1" fill={colors.horn} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="18" y="7" width="4" height="3" fill="#1f2937" />
          <rect x="13" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="19" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="14" y="8" width="1" height="1" fill="#ffffff" />
          <rect x="20" y="8" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="12" y="8" width="4" height="1" fill="#1f2937" />
          <rect x="18" y="8" width="4" height="1" fill="#1f2937" />
        </>
      )}

      {/* Neck */}
      <rect x="12" y="14" width="8" height="3" fill={colors.body} />

      {/* Storm wings */}
      <rect x="2" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="3" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="4" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="3" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="4"
        y="11"
        width="1"
        height="4"
        fill={colors.glow}
        opacity="0.5"
      />

      <rect x="24" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="25" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="25" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="25" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="27"
        y="11"
        width="1"
        height="4"
        fill={colors.glow}
        opacity="0.5"
      />

      {/* Body */}
      <rect x="10" y="17" width="12" height="8" fill={colors.body} />
      <rect x="12" y="18" width="8" height="5" fill={colors.belly} />

      {/* Lightning bolt on chest */}
      <rect x="15" y="18" width="2" height="2" fill={colors.horn} />
      <rect x="14" y="20" width="2" height="2" fill={colors.glow} />
      <rect x="15" y="22" width="2" height="1" fill={colors.horn} />

      {/* Arms */}
      <rect x="6" y="17" width="4" height="4" fill={colors.body} />
      <rect x="5" y="20" width="3" height="3" fill={colors.bodyLight} />

      <rect x="22" y="17" width="4" height="4" fill={colors.body} />
      <rect x="24" y="20" width="3" height="3" fill={colors.bodyLight} />

      {/* Legs */}
      <rect x="10" y="25" width="5" height="5" fill={colors.body} />
      <rect x="17" y="25" width="5" height="5" fill={colors.body} />
      <rect x="9" y="29" width="3" height="2" fill={colors.claws} />
      <rect x="20" y="29" width="3" height="2" fill={colors.claws} />

      {/* Electric tail */}
      <rect x="22" y="22" width="4" height="3" fill={colors.body} />
      <rect x="25" y="21" width="3" height="2" fill={colors.body} />
      <rect x="27" y="20" width="3" height="2" fill={colors.body} />
      <rect x="29" y="19" width="2" height="1" fill={colors.horn} />
      <rect x="30" y="18" width="1" height="1" fill={colors.glow} />
    </>
  );

  // Shadow Dragon - Dark with glowing eyes
  const renderShadowDragon = () => (
    <>
      {/* Smoky horns */}
      <rect x="9" y="1" width="2" height="5" fill={colors.horn} />
      <rect x="8" y="2" width="1" height="2" fill={colors.horn} opacity="0.7" />
      <rect x="21" y="1" width="2" height="5" fill={colors.horn} />
      <rect
        x="23"
        y="2"
        width="1"
        height="2"
        fill={colors.horn}
        opacity="0.7"
      />

      {/* Dark crest */}
      <rect x="13" y="0" width="6" height="3" fill={colors.body} />
      <rect x="14" y="1" width="4" height="1" fill={colors.bodyLight} />

      {/* Head */}
      <rect x="10" y="3" width="12" height="11" fill={colors.body} />
      <rect x="9" y="5" width="1" height="7" fill={colors.body} />
      <rect x="22" y="5" width="1" height="7" fill={colors.body} />
      <rect x="12" y="4" width="8" height="8" fill={colors.bodyLight} />

      {/* Shadow wisps */}
      <rect
        x="10"
        y="5"
        width="1"
        height="2"
        fill={colors.glow}
        opacity="0.3"
      />
      <rect
        x="21"
        y="5"
        width="1"
        height="2"
        fill={colors.glow}
        opacity="0.3"
      />

      {/* Snout */}
      <rect x="8" y="9" width="3" height="4" fill={colors.body} />
      <rect x="7" y="10" width="2" height="2" fill={colors.bodyLight} />

      {/* Smoke */}
      <rect
        x="5"
        y="10"
        width="2"
        height="1"
        fill={colors.bodyLight}
        opacity="0.4"
      />
      <rect
        x="4"
        y="9"
        width="1"
        height="1"
        fill={colors.bodyLight}
        opacity="0.2"
      />

      {/* Glowing eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="7" width="4" height="3" fill={colors.body} />
          <rect x="18" y="7" width="4" height="3" fill={colors.body} />
          <rect x="13" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="19" y="8" width="2" height="2" fill={colors.eyes} />
          <rect x="13" y="8" width="1" height="1" fill={colors.glow} />
          <rect x="19" y="8" width="1" height="1" fill={colors.glow} />
        </>
      ) : (
        <>
          <rect
            x="12"
            y="8"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.3"
          />
          <rect
            x="18"
            y="8"
            width="4"
            height="1"
            fill={colors.eyes}
            opacity="0.3"
          />
        </>
      )}

      {/* Neck */}
      <rect x="12" y="14" width="8" height="3" fill={colors.body} />

      {/* Shadow wings */}
      <rect x="2" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="3" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="4" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="3" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="4"
        y="12"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.2"
      />

      <rect x="24" y="9" width="6" height="9" fill={colors.wing} />
      <rect x="25" y="7" width="4" height="3" fill={colors.wing} />
      <rect x="25" y="5" width="3" height="3" fill={colors.wing} />
      <rect x="25" y="10" width="4" height="6" fill={colors.wingMembrane} />
      <rect
        x="26"
        y="12"
        width="2"
        height="2"
        fill={colors.glow}
        opacity="0.2"
      />

      {/* Body */}
      <rect x="10" y="17" width="12" height="8" fill={colors.body} />
      <rect x="12" y="18" width="8" height="5" fill={colors.belly} />

      {/* Soul core */}
      <rect x="14" y="19" width="4" height="3" fill={colors.wing} />
      <rect x="15" y="20" width="2" height="2" fill={colors.glow} />
      <rect x="15" y="20" width="1" height="1" fill={colors.eyes} />

      {/* Arms */}
      <rect x="6" y="17" width="4" height="4" fill={colors.body} />
      <rect x="5" y="20" width="3" height="3" fill={colors.bodyLight} />

      <rect x="22" y="17" width="4" height="4" fill={colors.body} />
      <rect x="24" y="20" width="3" height="3" fill={colors.bodyLight} />

      {/* Legs */}
      <rect x="10" y="25" width="5" height="5" fill={colors.body} />
      <rect x="17" y="25" width="5" height="5" fill={colors.body} />
      <rect x="9" y="29" width="3" height="2" fill={colors.claws} />
      <rect x="20" y="29" width="3" height="2" fill={colors.claws} />

      {/* Shadowy tail */}
      <rect x="22" y="22" width="4" height="3" fill={colors.body} />
      <rect x="25" y="21" width="3" height="2" fill={colors.body} />
      <rect
        x="27"
        y="20"
        width="3"
        height="3"
        fill={colors.bodyLight}
        opacity="0.7"
      />
      <rect
        x="29"
        y="19"
        width="2"
        height="2"
        fill={colors.bodyLight}
        opacity="0.4"
      />
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case "fire":
        return renderFireDragon();
      case "ice":
        return renderIceDragon();
      case "earth":
        return renderEarthDragon();
      case "storm":
        return renderStormDragon();
      case "shadow":
        return renderShadowDragon();
      default:
        return renderFireDragon();
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

        {/* Mining state - dragon fire */}
        {state === "mining" && (
          <>
            <rect x="3" y="12" width="2" height="2" fill={colors.glow}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="0.4s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="1" y="11" width="2" height="1" fill={colors.eyes}>
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="0.4s"
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}

        {/* Learning state - wisdom sparkle */}
        {state === "learning" && (
          <rect
            x="14"
            y="0"
            width="4"
            height="2"
            fill={colors.glow}
            opacity="0.8"
          />
        )}
      </svg>

      {/* Thriving - dragon aura */}
      {state === "thriving" && (
        <>
          <div
            className="absolute w-1.5 h-1.5 rounded-sm animate-ping"
            style={{ top: "5%", left: "10%", backgroundColor: colors.glow }}
          />
          <div
            className="absolute w-1 h-1 rounded-sm animate-ping"
            style={{
              top: "15%",
              right: "5%",
              backgroundColor: colors.eyes,
              animationDelay: "0.3s",
            }}
          />
        </>
      )}

      {/* Evolving - transformation */}
      {state === "evolving" && (
        <>
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{ top: "10%", left: "15%", backgroundColor: colors.glow }}
          />
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              top: "20%",
              right: "10%",
              backgroundColor: colors.eyes,
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
              top: "-10%",
              left: "20%",
              fontSize: size / 10,
              color: colors.glow,
            }}
          >
            ✦
          </div>
          <div
            className="absolute animate-bounce"
            style={{
              top: "-5%",
              right: "15%",
              fontSize: size / 12,
              color: colors.eyes,
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

export default DragonSprite;
