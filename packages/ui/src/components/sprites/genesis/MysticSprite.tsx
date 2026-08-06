/**
 * Mystic Spark Sprite - DUAL NATURE: Traditional + Ethereal
 *
 * Seres mágicos que canalizan energía ancestral.
 * +30% XP, -20% hashrate. Fuertes en eclipses.
 *
 * 10 Variantes (5 Tradicionales + 5 Espirituales):
 *
 * TRADICIONALES (casters con forma física):
 * - Mage: Mago clásico con sombrero puntiagudo y estrellas
 * - Shaman: Chamán tribal con plumas y huesos
 * - Druid: Druida con corona de hojas y cuernos
 * - Oracle: Oráculo con tercer ojo y velo dorado
 * - Elementalist: Elementalista con llamas/hielo/rayos
 *
 * ESPIRITUALES (seres etéreos):
 * - Spirit: Espíritu ancestral con máscara tribal
 * - Wisp: Fuego fatuo, llama espiritual flotante
 * - Seer: Vidente ciego con tercer ojo brillante
 * - Astral: Ser de energía cósmica y estrellas
 * - Shade: Sombra ancestral benévola
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface MysticSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type MysticVariant =
  | "mage"
  | "shaman"
  | "druid"
  | "oracle"
  | "elementalist"
  | "spirit"
  | "wisp"
  | "seer"
  | "astral"
  | "shade";

// Magic colors for traditional variants
interface MagicColors {
  primary: string;
  secondary: string;
  glow: string;
  robe: string;
  robeAccent: string;
  skin: string;
  skinShade: string;
}

// Ethereal colors for spiritual variants
interface EtherealColors {
  core: string;
  glow: string;
  accent: string;
  outline: string;
  eyes: string;
}

// Traditional variant color schemes
const TRADITIONAL_COLORS: Record<string, MagicColors[]> = {
  mage: [
    {
      primary: "#8b5cf6",
      secondary: "#a78bfa",
      glow: "#c4b5fd",
      robe: "#1e1b4b",
      robeAccent: "#3730a3",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#3b82f6",
      secondary: "#60a5fa",
      glow: "#93c5fd",
      robe: "#172554",
      robeAccent: "#1e40af",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#dc2626",
      secondary: "#f87171",
      glow: "#fca5a5",
      robe: "#450a0a",
      robeAccent: "#7f1d1d",
      skin: "#d4a574",
      skinShade: "#b48554",
    },
    {
      primary: "#22c55e",
      secondary: "#4ade80",
      glow: "#86efac",
      robe: "#14532d",
      robeAccent: "#166534",
      skin: "#a67c52",
      skinShade: "#8a6042",
    },
    {
      primary: "#0f172a",
      secondary: "#334155",
      glow: "#64748b",
      robe: "#020617",
      robeAccent: "#1e293b",
      skin: "#6b4423",
      skinShade: "#4a2f18",
    },
  ],
  shaman: [
    {
      primary: "#059669",
      secondary: "#34d399",
      glow: "#6ee7b7",
      robe: "#78350f",
      robeAccent: "#a16207",
      skin: "#a67c52",
      skinShade: "#8a6042",
    },
    {
      primary: "#dc2626",
      secondary: "#f87171",
      glow: "#fca5a5",
      robe: "#1c1917",
      robeAccent: "#44403c",
      skin: "#6b4423",
      skinShade: "#4a2f18",
    },
    {
      primary: "#3b82f6",
      secondary: "#60a5fa",
      glow: "#93c5fd",
      robe: "#1e3a5f",
      robeAccent: "#2563eb",
      skin: "#d4a574",
      skinShade: "#b48554",
    },
    {
      primary: "#fbbf24",
      secondary: "#fcd34d",
      glow: "#fde68a",
      robe: "#451a03",
      robeAccent: "#78350f",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#8b5cf6",
      secondary: "#a78bfa",
      glow: "#c4b5fd",
      robe: "#3b0764",
      robeAccent: "#6b21a8",
      skin: "#e8c4a0",
      skinShade: "#c8a480",
    },
  ],
  druid: [
    {
      primary: "#65a30d",
      secondary: "#a3e635",
      glow: "#d9f99d",
      robe: "#14532d",
      robeAccent: "#166534",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#78350f",
      secondary: "#a16207",
      glow: "#fcd34d",
      robe: "#422006",
      robeAccent: "#713f12",
      skin: "#d4a574",
      skinShade: "#b48554",
    },
    {
      primary: "#fafafa",
      secondary: "#e5e7eb",
      glow: "#ffffff",
      robe: "#0c4a6e",
      robeAccent: "#0369a1",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#ec4899",
      secondary: "#f472b6",
      glow: "#f9a8d4",
      robe: "#14532d",
      robeAccent: "#22c55e",
      skin: "#e8c4a0",
      skinShade: "#c8a480",
    },
    {
      primary: "#84cc16",
      secondary: "#bef264",
      glow: "#ecfccb",
      robe: "#365314",
      robeAccent: "#4d7c0f",
      skin: "#a67c52",
      skinShade: "#8a6042",
    },
  ],
  oracle: [
    {
      primary: "#eab308",
      secondary: "#fde047",
      glow: "#fef9c3",
      robe: "#fef3c7",
      robeAccent: "#fcd34d",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#8b5cf6",
      secondary: "#a78bfa",
      glow: "#ddd6fe",
      robe: "#c4b5fd",
      robeAccent: "#a78bfa",
      skin: "#e8c4a0",
      skinShade: "#c8a480",
    },
    {
      primary: "#06b6d4",
      secondary: "#22d3ee",
      glow: "#a5f3fc",
      robe: "#ecfeff",
      robeAccent: "#67e8f9",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#f43f5e",
      secondary: "#fb7185",
      glow: "#fecdd3",
      robe: "#fff1f2",
      robeAccent: "#fda4af",
      skin: "#d4a574",
      skinShade: "#b48554",
    },
    {
      primary: "#1f2937",
      secondary: "#4b5563",
      glow: "#9ca3af",
      robe: "#111827",
      robeAccent: "#374151",
      skin: "#6b4423",
      skinShade: "#4a2f18",
    },
  ],
  elementalist: [
    {
      primary: "#dc2626",
      secondary: "#f97316",
      glow: "#fbbf24",
      robe: "#7f1d1d",
      robeAccent: "#b91c1c",
      skin: "#d4a574",
      skinShade: "#b48554",
    },
    {
      primary: "#3b82f6",
      secondary: "#06b6d4",
      glow: "#22d3ee",
      robe: "#1e3a8a",
      robeAccent: "#1d4ed8",
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
    },
    {
      primary: "#eab308",
      secondary: "#fbbf24",
      glow: "#fef08a",
      robe: "#713f12",
      robeAccent: "#a16207",
      skin: "#e8c4a0",
      skinShade: "#c8a480",
    },
    {
      primary: "#14b8a6",
      secondary: "#2dd4bf",
      glow: "#5eead4",
      robe: "#134e4a",
      robeAccent: "#0f766e",
      skin: "#a67c52",
      skinShade: "#8a6042",
    },
    {
      primary: "#78350f",
      secondary: "#a16207",
      glow: "#d97706",
      robe: "#451a03",
      robeAccent: "#78350f",
      skin: "#6b4423",
      skinShade: "#4a2f18",
    },
  ],
};

// Ethereal variant color schemes
const ETHEREAL_COLORS: Record<string, EtherealColors[]> = {
  spirit: [
    {
      core: "#a78bfa",
      glow: "#c4b5fd",
      accent: "#8b5cf6",
      outline: "#6d28d9",
      eyes: "#ffffff",
    },
    {
      core: "#67e8f9",
      glow: "#a5f3fc",
      accent: "#22d3ee",
      outline: "#0891b2",
      eyes: "#ffffff",
    },
    {
      core: "#86efac",
      glow: "#bbf7d0",
      accent: "#4ade80",
      outline: "#16a34a",
      eyes: "#ffffff",
    },
    {
      core: "#fcd34d",
      glow: "#fef08a",
      accent: "#fbbf24",
      outline: "#d97706",
      eyes: "#ffffff",
    },
    {
      core: "#fda4af",
      glow: "#fecdd3",
      accent: "#fb7185",
      outline: "#e11d48",
      eyes: "#ffffff",
    },
  ],
  wisp: [
    {
      core: "#3b82f6",
      glow: "#93c5fd",
      accent: "#1d4ed8",
      outline: "#1e40af",
      eyes: "#fef08a",
    },
    {
      core: "#22c55e",
      glow: "#86efac",
      accent: "#16a34a",
      outline: "#15803d",
      eyes: "#fef08a",
    },
    {
      core: "#f97316",
      glow: "#fdba74",
      accent: "#ea580c",
      outline: "#c2410c",
      eyes: "#fef08a",
    },
    {
      core: "#8b5cf6",
      glow: "#c4b5fd",
      accent: "#7c3aed",
      outline: "#6d28d9",
      eyes: "#fef08a",
    },
    {
      core: "#06b6d4",
      glow: "#67e8f9",
      accent: "#0891b2",
      outline: "#0e7490",
      eyes: "#fef08a",
    },
  ],
  seer: [
    {
      core: "#e5e7eb",
      glow: "#f3f4f6",
      accent: "#9ca3af",
      outline: "#6b7280",
      eyes: "#eab308",
    },
    {
      core: "#fcd34d",
      glow: "#fef08a",
      accent: "#f59e0b",
      outline: "#d97706",
      eyes: "#8b5cf6",
    },
    {
      core: "#a5b4fc",
      glow: "#c7d2fe",
      accent: "#818cf8",
      outline: "#6366f1",
      eyes: "#22c55e",
    },
    {
      core: "#f9a8d4",
      glow: "#fbcfe8",
      accent: "#ec4899",
      outline: "#db2777",
      eyes: "#3b82f6",
    },
    {
      core: "#5eead4",
      glow: "#99f6e4",
      accent: "#14b8a6",
      outline: "#0d9488",
      eyes: "#f97316",
    },
  ],
  astral: [
    {
      core: "#1e1b4b",
      glow: "#a78bfa",
      accent: "#4c1d95",
      outline: "#312e81",
      eyes: "#fef08a",
    },
    {
      core: "#0c4a6e",
      glow: "#38bdf8",
      accent: "#0369a1",
      outline: "#075985",
      eyes: "#fef08a",
    },
    {
      core: "#4c1d95",
      glow: "#e879f9",
      accent: "#7e22ce",
      outline: "#581c87",
      eyes: "#fef08a",
    },
    {
      core: "#134e4a",
      glow: "#2dd4bf",
      accent: "#0f766e",
      outline: "#115e59",
      eyes: "#fef08a",
    },
    {
      core: "#7f1d1d",
      glow: "#f87171",
      accent: "#991b1b",
      outline: "#450a0a",
      eyes: "#fef08a",
    },
  ],
  shade: [
    {
      core: "#1f2937",
      glow: "#4b5563",
      accent: "#374151",
      outline: "#111827",
      eyes: "#a78bfa",
    },
    {
      core: "#1e3a5f",
      glow: "#3b82f6",
      accent: "#1e40af",
      outline: "#172554",
      eyes: "#60a5fa",
    },
    {
      core: "#14532d",
      glow: "#22c55e",
      accent: "#166534",
      outline: "#052e16",
      eyes: "#4ade80",
    },
    {
      core: "#422006",
      glow: "#f97316",
      accent: "#78350f",
      outline: "#1c1917",
      eyes: "#fdba74",
    },
    {
      core: "#3b0764",
      glow: "#a855f7",
      accent: "#581c87",
      outline: "#1e1b4b",
      eyes: "#c084fc",
    },
  ],
};

const getMysticVariant = (dna: string): MysticVariant => {
  const variants: MysticVariant[] = [
    "mage",
    "shaman",
    "druid",
    "oracle",
    "elementalist",
    "spirit",
    "wisp",
    "seer",
    "astral",
    "shade",
  ];
  const index = parseInt(dna[0] || "0", 16) % 10;
  return variants[index];
};

const isTraditionalVariant = (v: MysticVariant): boolean => {
  return ["mage", "shaman", "druid", "oracle", "elementalist"].includes(v);
};

const getTraditionalColors = (
  variant: MysticVariant,
  dna: string,
): MagicColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return TRADITIONAL_COLORS[variant]?.[index] || TRADITIONAL_COLORS.mage[0];
};

const getEtherealColors = (
  variant: MysticVariant,
  dna: string,
): EtherealColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return ETHEREAL_COLORS[variant]?.[index] || ETHEREAL_COLORS.spirit[0];
};

export const MysticSprite: FC<MysticSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  colors: _customColors,
  className = "",
}) => {
  const variant = getMysticVariant(dna);
  const isTraditional = isTraditionalVariant(variant);
  const magic = isTraditional ? getTraditionalColors(variant, dna) : null;
  const ethereal = !isTraditional ? getEtherealColors(variant, dna) : null;

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

  // === TRADITIONAL VARIANTS ===

  const renderMage = () => {
    const m = magic!;
    return (
      <>
        {/* Wizard hat */}
        <rect x="15" y="0" width="2" height="2" fill={m.primary} />
        <rect x="14" y="2" width="4" height="2" fill={m.robe} />
        <rect x="13" y="4" width="6" height="2" fill={m.robe} />
        <rect x="11" y="6" width="10" height="2" fill={m.robe} />
        <rect x="8" y="8" width="16" height="2" fill={m.robe} />
        <rect x="6" y="9" width="20" height="1" fill={m.robeAccent} />

        {/* Hat decorations */}
        <rect x="15" y="1" width="1" height="1" fill={m.glow} />
        <rect x="13" y="3" width="1" height="1" fill={m.secondary} />
        <rect x="17" y="4" width="1" height="1" fill={m.secondary} />

        {/* Head */}
        <rect x="10" y="10" width="12" height="8" fill={m.skin} />
        <rect x="9" y="12" width="1" height="4" fill={m.skin} />
        <rect x="22" y="12" width="1" height="4" fill={m.skin} />

        {/* Eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="11" y="12" width="4" height="3" fill="#1f2937" />
            <rect x="17" y="12" width="4" height="3" fill="#1f2937" />
            <rect x="12" y="13" width="2" height="2" fill={m.primary} />
            <rect x="18" y="13" width="2" height="2" fill={m.primary} />
            <rect x="13" y="13" width="1" height="1" fill={m.glow} />
            <rect x="19" y="13" width="1" height="1" fill={m.glow} />
          </>
        ) : (
          <>
            <rect x="11" y="13" width="4" height="1" fill="#1f2937" />
            <rect x="17" y="13" width="4" height="1" fill="#1f2937" />
          </>
        )}

        {/* Beard */}
        <rect x="13" y="17" width="6" height="1" fill="#9ca3af" />
        <rect x="14" y="18" width="4" height="1" fill="#d1d5db" />

        {/* Robe body */}
        <rect x="8" y="18" width="16" height="10" fill={m.robe} />
        <rect x="10" y="18" width="12" height="2" fill={m.robeAccent} />
        <rect x="15" y="20" width="2" height="8" fill={m.robeAccent} />

        {/* Star on chest */}
        <rect x="14" y="21" width="4" height="3" fill={m.primary} />
        <rect x="15" y="22" width="2" height="1" fill={m.glow} />

        {/* Arms */}
        <rect x="4" y="19" width="4" height="8" fill={m.robe} />
        <rect x="24" y="19" width="4" height="8" fill={m.robe} />
        <rect x="3" y="27" width="3" height="3" fill={m.skin} />
        <rect x="26" y="27" width="3" height="3" fill={m.skin} />

        {/* Feet */}
        <rect x="10" y="28" width="5" height="2" fill={m.robe} />
        <rect x="17" y="28" width="5" height="2" fill={m.robe} />
        <rect x="10" y="30" width="4" height="2" fill={m.robeAccent} />
        <rect x="18" y="30" width="4" height="2" fill={m.robeAccent} />
      </>
    );
  };

  const renderShaman = () => {
    const m = magic!;
    return (
      <>
        {/* Feathered headdress */}
        <rect x="8" y="0" width="2" height="6" fill="#dc2626" />
        <rect x="12" y="0" width="2" height="7" fill={m.primary} />
        <rect x="16" y="0" width="2" height="7" fill="#fbbf24" />
        <rect x="20" y="0" width="2" height="6" fill="#dc2626" />

        {/* Headband */}
        <rect x="8" y="6" width="16" height="2" fill={m.robe} />
        <rect x="9" y="6" width="2" height="2" fill="#fbbf24" />
        <rect x="13" y="6" width="2" height="2" fill="#22d3ee" />
        <rect x="17" y="6" width="2" height="2" fill="#fbbf24" />

        {/* Skull decoration */}
        <rect x="14" y="7" width="4" height="2" fill="#fef3c7" />

        {/* Head */}
        <rect x="10" y="8" width="12" height="8" fill={m.skin} />
        <rect x="9" y="10" width="1" height="4" fill={m.skin} />
        <rect x="22" y="10" width="1" height="4" fill={m.skin} />

        {/* War paint */}
        <rect x="10" y="10" width="2" height="1" fill={m.primary} />
        <rect x="20" y="10" width="2" height="1" fill={m.primary} />

        {/* Eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="12" y="10" width="3" height="3" fill="#1f2937" />
            <rect x="17" y="10" width="3" height="3" fill="#1f2937" />
            <rect x="13" y="11" width="2" height="2" fill={m.primary} />
            <rect x="18" y="11" width="2" height="2" fill={m.primary} />
          </>
        ) : (
          <>
            <rect x="12" y="11" width="3" height="1" fill="#1f2937" />
            <rect x="17" y="11" width="3" height="1" fill="#1f2937" />
          </>
        )}

        {/* Nose piercing */}
        <rect x="15" y="12" width="2" height="1" fill="#fef3c7" />

        {/* Mouth */}
        <rect x="14" y="14" width="4" height="1" fill="#1f2937" />

        {/* Tribal wrap */}
        <rect x="8" y="16" width="16" height="12" fill={m.robe} />
        <rect x="10" y="17" width="12" height="1" fill={m.robeAccent} />

        {/* Bone necklace */}
        <rect x="12" y="18" width="2" height="2" fill="#fef3c7" />
        <rect x="15" y="18" width="2" height="2" fill="#fef3c7" />
        <rect x="18" y="18" width="2" height="2" fill="#fef3c7" />

        {/* Totem symbol */}
        <rect x="14" y="21" width="4" height="4" fill={m.primary} />
        <rect x="15" y="22" width="2" height="2" fill={m.glow} />

        {/* Arms */}
        <rect x="4" y="18" width="4" height="7" fill={m.robe} />
        <rect x="24" y="18" width="4" height="7" fill={m.robe} />
        <rect x="3" y="25" width="3" height="3" fill={m.skin} />
        <rect x="26" y="25" width="3" height="3" fill={m.skin} />

        {/* Feet */}
        <rect x="10" y="28" width="5" height="2" fill={m.robeAccent} />
        <rect x="17" y="28" width="5" height="2" fill={m.robeAccent} />
      </>
    );
  };

  const renderDruid = () => {
    const m = magic!;
    return (
      <>
        {/* Antler crown */}
        <rect x="6" y="2" width="2" height="4" fill="#78350f" />
        <rect x="4" y="0" width="2" height="3" fill="#78350f" />
        <rect x="24" y="2" width="2" height="4" fill="#78350f" />
        <rect x="26" y="0" width="2" height="3" fill="#78350f" />

        {/* Leaf crown */}
        <rect x="8" y="4" width="16" height="3" fill={m.primary} />
        <rect x="10" y="3" width="3" height="2" fill={m.secondary} />
        <rect x="15" y="2" width="2" height="2" fill={m.secondary} />
        <rect x="19" y="3" width="3" height="2" fill={m.secondary} />

        {/* Flowers */}
        <rect x="12" y="4" width="1" height="1" fill="#ec4899" />
        <rect x="19" y="4" width="1" height="1" fill="#ec4899" />

        {/* Head */}
        <rect x="10" y="7" width="12" height="9" fill={m.skin} />
        <rect x="9" y="9" width="1" height="5" fill={m.skin} />
        <rect x="22" y="9" width="1" height="5" fill={m.skin} />

        {/* Eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="11" y="10" width="4" height="3" fill="#1f2937" />
            <rect x="17" y="10" width="4" height="3" fill="#1f2937" />
            <rect x="12" y="11" width="2" height="2" fill={m.primary} />
            <rect x="18" y="11" width="2" height="2" fill={m.primary} />
          </>
        ) : (
          <>
            <rect x="11" y="11" width="4" height="1" fill="#1f2937" />
            <rect x="17" y="11" width="4" height="1" fill="#1f2937" />
          </>
        )}

        {/* Nose */}
        <rect x="15" y="12" width="2" height="2" fill={m.skinShade} />

        {/* Mouth */}
        <rect x="15" y="14" width="2" height="1" fill="#1f2937" />

        {/* Leaf robe */}
        <rect x="8" y="16" width="16" height="12" fill={m.robe} />
        <rect x="10" y="17" width="4" height="2" fill={m.primary} />
        <rect x="14" y="16" width="4" height="2" fill={m.secondary} />
        <rect x="18" y="17" width="4" height="2" fill={m.primary} />

        {/* Tree of life */}
        <rect x="14" y="20" width="4" height="5" fill={m.primary} />
        <rect x="15" y="19" width="2" height="1" fill={m.secondary} />
        <rect x="15" y="22" width="2" height="1" fill={m.glow} />

        {/* Arms */}
        <rect x="4" y="17" width="4" height="9" fill={m.robe} />
        <rect x="24" y="17" width="4" height="9" fill={m.robe} />
        <rect x="3" y="26" width="3" height="3" fill={m.skin} />
        <rect x="26" y="26" width="3" height="3" fill={m.skin} />

        {/* Root feet */}
        <rect x="10" y="28" width="5" height="2" fill={m.robe} />
        <rect x="17" y="28" width="5" height="2" fill={m.robe} />
        <rect x="10" y="30" width="4" height="2" fill="#78350f" />
        <rect x="18" y="30" width="4" height="2" fill="#78350f" />
      </>
    );
  };

  const renderOracle = () => {
    const m = magic!;
    return (
      <>
        {/* Crown */}
        <rect x="9" y="4" width="14" height="3" fill={m.robeAccent} />
        <rect x="12" y="2" width="8" height="2" fill={m.robeAccent} />
        <rect x="14" y="1" width="4" height="1" fill={m.primary} />

        {/* Third eye gem */}
        <rect x="14" y="2" width="4" height="3" fill={m.primary} />
        <rect x="15" y="3" width="2" height="2" fill={m.glow} />
        <rect x="15" y="3" width="1" height="1" fill="#ffffff" />

        {/* Jewels */}
        <rect x="10" y="4" width="2" height="2" fill="#dc2626" />
        <rect x="20" y="4" width="2" height="2" fill="#3b82f6" />

        {/* Head */}
        <rect x="10" y="7" width="12" height="9" fill={m.skin} />
        <rect x="9" y="9" width="1" height="5" fill={m.skin} />
        <rect x="22" y="9" width="1" height="5" fill={m.skin} />

        {/* Eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="11" y="10" width="4" height="4" fill="#1f2937" />
            <rect x="17" y="10" width="4" height="4" fill="#1f2937" />
            <rect x="12" y="11" width="3" height="3" fill={m.primary} />
            <rect x="18" y="11" width="3" height="3" fill={m.primary} />
            <rect x="12" y="11" width="1" height="1" fill={m.glow} />
            <rect x="18" y="11" width="1" height="1" fill={m.glow} />
          </>
        ) : (
          <>
            <rect x="11" y="12" width="4" height="1" fill="#1f2937" />
            <rect x="17" y="12" width="4" height="1" fill="#1f2937" />
          </>
        )}

        {/* Serene mouth */}
        <rect x="15" y="14" width="2" height="1" fill="#1f2937" />

        {/* Flowing robes */}
        <rect x="8" y="16" width="16" height="12" fill={m.robe} />
        <rect x="10" y="16" width="12" height="1" fill={m.robeAccent} />

        {/* Eye of providence */}
        <rect x="13" y="19" width="6" height="5" fill={m.primary} />
        <rect x="15" y="20" width="2" height="3" fill={m.glow} />
        <rect x="15" y="21" width="1" height="1" fill="#1f2937" />

        {/* Arms */}
        <rect x="4" y="17" width="4" height="8" fill={m.robe} />
        <rect x="24" y="17" width="4" height="8" fill={m.robe} />
        <rect x="3" y="25" width="3" height="3" fill={m.skin} />
        <rect x="26" y="25" width="3" height="3" fill={m.skin} />

        {/* Flowing skirt */}
        <rect x="9" y="28" width="6" height="3" fill={m.robe} />
        <rect x="17" y="28" width="6" height="3" fill={m.robe} />
      </>
    );
  };

  const renderElementalist = () => {
    const m = magic!;
    return (
      <>
        {/* Elemental crown */}
        <rect x="9" y="4" width="2" height="4" fill={m.primary} />
        <rect x="11" y="2" width="2" height="6" fill={m.secondary} />
        <rect x="13" y="1" width="2" height="7" fill={m.glow} />
        <rect x="15" y="0" width="2" height="8" fill={m.primary} />
        <rect x="17" y="1" width="2" height="7" fill={m.glow} />
        <rect x="19" y="2" width="2" height="6" fill={m.secondary} />
        <rect x="21" y="4" width="2" height="4" fill={m.primary} />

        {/* Crown base */}
        <rect x="8" y="7" width="16" height="2" fill={m.robe} />

        {/* Head */}
        <rect x="10" y="9" width="12" height="8" fill={m.skin} />
        <rect x="9" y="11" width="1" height="4" fill={m.skin} />
        <rect x="22" y="11" width="1" height="4" fill={m.skin} />

        {/* Glowing eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="11" y="11" width="4" height="3" fill="#1f2937" />
            <rect x="17" y="11" width="4" height="3" fill="#1f2937" />
            <rect x="12" y="12" width="2" height="2" fill={m.primary} />
            <rect x="18" y="12" width="2" height="2" fill={m.primary} />
            <rect x="12" y="12" width="1" height="1" fill={m.glow} />
            <rect x="18" y="12" width="1" height="1" fill={m.glow} />
          </>
        ) : (
          <>
            <rect x="11" y="12" width="4" height="1" fill="#1f2937" />
            <rect x="17" y="12" width="4" height="1" fill="#1f2937" />
          </>
        )}

        {/* Mouth */}
        <rect x="15" y="15" width="2" height="1" fill="#1f2937" />

        {/* Battle robe */}
        <rect x="8" y="17" width="16" height="11" fill={m.robe} />
        <rect x="7" y="17" width="4" height="2" fill={m.robeAccent} />
        <rect x="21" y="17" width="4" height="2" fill={m.robeAccent} />

        {/* Elemental core */}
        <rect x="13" y="20" width="6" height="5" fill="#0f172a" />
        <rect x="14" y="21" width="4" height="3" fill={m.primary} />
        <rect x="15" y="22" width="2" height="2" fill={m.glow} />

        {/* Arms */}
        <rect x="4" y="18" width="3" height="8" fill={m.robe} />
        <rect x="25" y="18" width="3" height="8" fill={m.robe} />
        <rect x="3" y="26" width="4" height="3" fill={m.robeAccent} />
        <rect x="25" y="26" width="4" height="3" fill={m.robeAccent} />

        {/* Battle boots */}
        <rect x="10" y="28" width="5" height="2" fill={m.robeAccent} />
        <rect x="17" y="28" width="5" height="2" fill={m.robeAccent} />
        <rect x="9" y="30" width="6" height="2" fill="#1f2937" />
        <rect x="17" y="30" width="6" height="2" fill="#1f2937" />
      </>
    );
  };

  // === ETHEREAL/SPIRITUAL VARIANTS ===

  const renderSpirit = () => {
    const e = ethereal!;
    return (
      <>
        {/* Translucent form */}
        <rect x="12" y="4" width="8" height="4" fill={e.glow} opacity="0.3" />
        <rect x="10" y="6" width="12" height="2" fill={e.glow} opacity="0.4" />

        {/* Tribal mask */}
        <rect x="9" y="8" width="14" height="10" fill={e.core} />
        <rect x="8" y="10" width="1" height="6" fill={e.core} />
        <rect x="23" y="10" width="1" height="6" fill={e.core} />
        <rect x="9" y="8" width="14" height="1" fill={e.outline} />
        <rect x="9" y="17" width="14" height="1" fill={e.outline} />

        {/* Mask patterns */}
        <rect x="10" y="9" width="2" height="1" fill={e.accent} />
        <rect x="20" y="9" width="2" height="1" fill={e.accent} />

        {/* Hollow eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="11" y="11" width="3" height="3" fill="#1f2937" />
            <rect x="18" y="11" width="3" height="3" fill="#1f2937" />
            <rect
              x="12"
              y="12"
              width="2"
              height="2"
              fill={e.eyes}
              opacity="0.9"
            />
            <rect
              x="19"
              y="12"
              width="2"
              height="2"
              fill={e.eyes}
              opacity="0.9"
            />
            <rect x="12" y="12" width="1" height="1" fill={e.glow} />
            <rect x="19" y="12" width="1" height="1" fill={e.glow} />
          </>
        ) : (
          <>
            <rect x="11" y="12" width="4" height="1" fill="#1f2937" />
            <rect x="17" y="12" width="4" height="1" fill="#1f2937" />
          </>
        )}

        {/* Mask mouth */}
        <rect x="13" y="15" width="6" height="2" fill="#1f2937" />
        <rect x="14" y="15" width="1" height="1" fill={e.accent} />
        <rect x="17" y="15" width="1" height="1" fill={e.accent} />

        {/* Ethereal body */}
        <rect x="10" y="18" width="12" height="6" fill={e.glow} opacity="0.5" />
        <rect x="11" y="24" width="10" height="4" fill={e.glow} opacity="0.4" />
        <rect x="12" y="28" width="8" height="3" fill={e.glow} opacity="0.3" />

        {/* Tendrils */}
        <rect x="8" y="20" width="2" height="5" fill={e.glow} opacity="0.4" />
        <rect x="22" y="20" width="2" height="5" fill={e.glow} opacity="0.4" />
        <rect x="6" y="22" width="2" height="4" fill={e.glow} opacity="0.3" />
        <rect x="24" y="22" width="2" height="4" fill={e.glow} opacity="0.3" />

        {/* Core energy */}
        <rect
          x="14"
          y="20"
          width="4"
          height="3"
          fill={e.accent}
          opacity="0.7"
        />
        <rect x="15" y="21" width="2" height="1" fill={e.eyes} />
      </>
    );
  };

  const renderWisp = () => {
    const e = ethereal!;
    return (
      <>
        {/* Flame tail */}
        <rect x="14" y="28" width="4" height="2" fill={e.glow} opacity="0.3" />
        <rect x="13" y="26" width="6" height="2" fill={e.glow} opacity="0.4" />
        <rect x="12" y="24" width="8" height="2" fill={e.glow} opacity="0.5" />

        {/* Main flame body */}
        <rect x="11" y="18" width="10" height="6" fill={e.core} />
        <rect x="10" y="14" width="12" height="4" fill={e.core} />
        <rect x="11" y="10" width="10" height="4" fill={e.core} />
        <rect x="12" y="6" width="8" height="4" fill={e.glow} />
        <rect x="13" y="3" width="6" height="3" fill={e.glow} />
        <rect x="14" y="1" width="4" height="2" fill={e.glow} opacity="0.7" />
        <rect x="15" y="0" width="2" height="1" fill={e.glow} opacity="0.5" />

        {/* Inner hot */}
        <rect x="14" y="8" width="4" height="6" fill={e.glow} />
        <rect x="15" y="6" width="2" height="2" fill="#ffffff" opacity="0.8" />

        {/* Flickering edges */}
        <rect x="9" y="16" width="1" height="3" fill={e.accent} opacity="0.6" />
        <rect
          x="22"
          y="16"
          width="1"
          height="3"
          fill={e.accent}
          opacity="0.6"
        />

        {/* Eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="12" y="12" width="3" height="2" fill="#1f2937" />
            <rect x="17" y="12" width="3" height="2" fill="#1f2937" />
            <rect x="13" y="12" width="1" height="1" fill={e.eyes} />
            <rect x="18" y="12" width="1" height="1" fill={e.eyes} />
          </>
        ) : (
          <>
            <rect
              x="12"
              y="13"
              width="3"
              height="1"
              fill="#1f2937"
              opacity="0.5"
            />
            <rect
              x="17"
              y="13"
              width="3"
              height="1"
              fill="#1f2937"
              opacity="0.5"
            />
          </>
        )}

        {/* Smile */}
        <rect x="14" y="16" width="4" height="1" fill="#1f2937" opacity="0.6" />
      </>
    );
  };

  const renderSeer = () => {
    const e = ethereal!;
    return (
      <>
        {/* Hood */}
        <rect x="8" y="4" width="16" height="6" fill={e.core} />
        <rect x="7" y="6" width="1" height="8" fill={e.core} />
        <rect x="24" y="6" width="1" height="8" fill={e.core} />
        <rect x="6" y="8" width="1" height="6" fill={e.core} />
        <rect x="25" y="8" width="1" height="6" fill={e.core} />

        {/* Third eye */}
        <rect x="14" y="5" width="4" height="3" fill={e.accent} />
        <rect x="15" y="6" width="2" height="2" fill={e.eyes} />
        <rect x="15" y="6" width="1" height="1" fill="#ffffff" />

        {/* Face in shadow */}
        <rect x="10" y="10" width="12" height="8" fill={e.glow} opacity="0.8" />
        <rect x="9" y="12" width="1" height="4" fill={e.glow} opacity="0.6" />
        <rect x="22" y="12" width="1" height="4" fill={e.glow} opacity="0.6" />

        {/* Blind eyes */}
        <rect x="11" y="12" width="4" height="2" fill={e.outline} />
        <rect x="17" y="12" width="4" height="2" fill={e.outline} />
        {state === "mining" && (
          <>
            <rect
              x="12"
              y="12"
              width="2"
              height="1"
              fill={e.eyes}
              opacity="0.5"
            />
            <rect
              x="18"
              y="12"
              width="2"
              height="1"
              fill={e.eyes}
              opacity="0.5"
            />
          </>
        )}

        {/* Mouth */}
        <rect
          x="14"
          y="16"
          width="4"
          height="1"
          fill={e.outline}
          opacity="0.6"
        />

        {/* Flowing robes */}
        <rect x="8" y="18" width="16" height="8" fill={e.core} />
        <rect x="7" y="20" width="1" height="6" fill={e.core} />
        <rect x="24" y="20" width="1" height="6" fill={e.core} />

        {/* Vision orb */}
        <rect x="14" y="23" width="4" height="4" fill={e.outline} />
        <rect x="15" y="24" width="2" height="2" fill={e.eyes} />
        <rect x="15" y="24" width="1" height="1" fill="#ffffff" opacity="0.6" />

        {/* Robe bottom */}
        <rect x="9" y="26" width="6" height="4" fill={e.core} />
        <rect x="17" y="26" width="6" height="4" fill={e.core} />
        <rect x="10" y="30" width="4" height="2" fill={e.glow} opacity="0.5" />
        <rect x="18" y="30" width="4" height="2" fill={e.glow} opacity="0.5" />
      </>
    );
  };

  const renderAstral = () => {
    const e = ethereal!;
    return (
      <>
        {/* Cosmic body */}
        <rect x="10" y="6" width="12" height="20" fill={e.core} />
        <rect x="8" y="10" width="2" height="12" fill={e.core} />
        <rect x="22" y="10" width="2" height="12" fill={e.core} />

        {/* Glow edge */}
        <rect x="10" y="6" width="1" height="20" fill={e.glow} opacity="0.3" />
        <rect x="21" y="6" width="1" height="20" fill={e.glow} opacity="0.3" />

        {/* Head area */}
        <rect x="11" y="5" width="10" height="2" fill={e.accent} />
        <rect x="13" y="3" width="6" height="2" fill={e.accent} />
        <rect x="14" y="2" width="4" height="1" fill={e.glow} opacity="0.6" />

        {/* Star eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="12" y="10" width="3" height="3" fill={e.glow} />
            <rect x="17" y="10" width="3" height="3" fill={e.glow} />
            <rect x="13" y="11" width="1" height="1" fill={e.eyes} />
            <rect x="18" y="11" width="1" height="1" fill={e.eyes} />
          </>
        ) : (
          <>
            <rect
              x="12"
              y="11"
              width="3"
              height="1"
              fill={e.glow}
              opacity="0.5"
            />
            <rect
              x="17"
              y="11"
              width="3"
              height="1"
              fill={e.glow}
              opacity="0.5"
            />
          </>
        )}

        {/* Constellation pattern */}
        <rect x="12" y="8" width="1" height="1" fill={e.eyes} />
        <rect x="19" y="9" width="1" height="1" fill={e.eyes} />
        <rect x="14" y="14" width="1" height="1" fill={e.eyes} />
        <rect x="17" y="15" width="1" height="1" fill={e.eyes} />
        <rect x="11" y="17" width="1" height="1" fill={e.eyes} />
        <rect x="20" y="18" width="1" height="1" fill={e.eyes} />
        <rect x="15" y="19" width="2" height="2" fill={e.eyes} />

        {/* Nebula center */}
        <rect
          x="14"
          y="16"
          width="4"
          height="4"
          fill={e.accent}
          opacity="0.5"
        />

        {/* Arms */}
        <rect x="5" y="12" width="3" height="2" fill={e.accent} />
        <rect x="3" y="13" width="2" height="2" fill={e.glow} opacity="0.6" />
        <rect x="24" y="12" width="3" height="2" fill={e.accent} />
        <rect x="27" y="13" width="2" height="2" fill={e.glow} opacity="0.6" />

        {/* Stardust below */}
        <rect
          x="12"
          y="26"
          width="8"
          height="2"
          fill={e.accent}
          opacity="0.5"
        />
        <rect x="13" y="28" width="6" height="2" fill={e.glow} opacity="0.4" />
        <rect x="14" y="30" width="4" height="2" fill={e.glow} opacity="0.3" />
      </>
    );
  };

  const renderShade = () => {
    const e = ethereal!;
    return (
      <>
        {/* Shadow mass */}
        <rect x="10" y="6" width="12" height="18" fill={e.core} />
        <rect x="9" y="8" width="1" height="14" fill={e.core} />
        <rect x="22" y="8" width="1" height="14" fill={e.core} />

        {/* Hooded head */}
        <rect x="8" y="4" width="16" height="6" fill={e.core} />
        <rect x="10" y="2" width="12" height="2" fill={e.outline} />
        <rect x="12" y="1" width="8" height="1" fill={e.outline} />

        {/* Inner darkness */}
        <rect x="11" y="5" width="10" height="4" fill={e.outline} />

        {/* Glowing eyes */}
        {state !== "sleeping" ? (
          <>
            <rect x="12" y="8" width="2" height="2" fill={e.eyes} />
            <rect x="18" y="8" width="2" height="2" fill={e.eyes} />
            <rect x="12" y="8" width="1" height="1" fill={e.glow} />
            <rect x="18" y="8" width="1" height="1" fill={e.glow} />
          </>
        ) : (
          <>
            <rect
              x="12"
              y="9"
              width="3"
              height="1"
              fill={e.eyes}
              opacity="0.3"
            />
            <rect
              x="17"
              y="9"
              width="3"
              height="1"
              fill={e.eyes}
              opacity="0.3"
            />
          </>
        )}

        {/* Cloak */}
        <rect x="8" y="14" width="16" height="10" fill={e.core} />
        <rect x="6" y="16" width="2" height="8" fill={e.core} />
        <rect x="24" y="16" width="2" height="8" fill={e.core} />

        {/* Edge highlights */}
        <rect x="8" y="14" width="1" height="10" fill={e.glow} opacity="0.2" />
        <rect x="23" y="14" width="1" height="10" fill={e.glow} opacity="0.2" />

        {/* Soul light */}
        <rect x="14" y="16" width="4" height="4" fill={e.glow} opacity="0.4" />
        <rect x="15" y="17" width="2" height="2" fill={e.eyes} opacity="0.6" />

        {/* Mystical runes */}
        <rect
          x="10"
          y="18"
          width="1"
          height="2"
          fill={e.accent}
          opacity="0.5"
        />
        <rect
          x="21"
          y="18"
          width="1"
          height="2"
          fill={e.accent}
          opacity="0.5"
        />

        {/* Shadowy arms */}
        <rect x="4" y="17" width="2" height="6" fill={e.core} />
        <rect
          x="2"
          y="19"
          width="2"
          height="4"
          fill={e.outline}
          opacity="0.7"
        />
        <rect x="26" y="17" width="2" height="6" fill={e.core} />
        <rect
          x="28"
          y="19"
          width="2"
          height="4"
          fill={e.outline}
          opacity="0.7"
        />

        {/* Wispy bottom */}
        <rect x="9" y="24" width="14" height="3" fill={e.core} />
        <rect
          x="10"
          y="27"
          width="12"
          height="2"
          fill={e.outline}
          opacity="0.7"
        />
        <rect
          x="12"
          y="29"
          width="8"
          height="2"
          fill={e.outline}
          opacity="0.5"
        />
        <rect
          x="14"
          y="31"
          width="4"
          height="1"
          fill={e.outline}
          opacity="0.3"
        />
      </>
    );
  };

  const renderVariant = () => {
    switch (variant) {
      case "mage":
        return renderMage();
      case "shaman":
        return renderShaman();
      case "druid":
        return renderDruid();
      case "oracle":
        return renderOracle();
      case "elementalist":
        return renderElementalist();
      case "spirit":
        return renderSpirit();
      case "wisp":
        return renderWisp();
      case "seer":
        return renderSeer();
      case "astral":
        return renderAstral();
      case "shade":
        return renderShade();
      default:
        return renderMage();
    }
  };

  // Get appropriate color for effects
  const effectColor = isTraditional ? magic!.glow : ethereal!.glow;
  const effectAccent = isTraditional ? magic!.primary : ethereal!.accent;

  return (
    <div className={`relative ${stateClasses[state]} ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        style={{ imageRendering: "pixelated" }}
      >
        {renderVariant()}
      </svg>

      {/* Mining particles */}
      {state === "mining" && (
        <>
          <div
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{
              top: "10%",
              left: "10%",
              backgroundColor: effectColor,
              opacity: 0.6,
            }}
          />
          <div
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{
              top: "20%",
              right: "15%",
              backgroundColor: effectAccent,
              opacity: 0.5,
              animationDelay: "0.3s",
            }}
          />
        </>
      )}

      {/* Evolving sparkles */}
      {state === "evolving" && (
        <>
          <div
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{ top: "15%", left: "20%", backgroundColor: effectColor }}
          />
          <div
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{
              top: "25%",
              right: "20%",
              backgroundColor: effectAccent,
              animationDelay: "0.2s",
            }}
          />
          <div
            className="absolute w-1 h-1 rounded-full animate-ping"
            style={{
              bottom: "25%",
              left: "15%",
              backgroundColor: effectColor,
              animationDelay: "0.4s",
            }}
          />
        </>
      )}

      {/* Happy sparkle */}
      {state === "happy" && (
        <div
          className="absolute w-1 h-1 rounded-full animate-bounce"
          style={{ top: "5%", right: "20%", backgroundColor: effectColor }}
        />
      )}

      {/* Sleeping glow */}
      {state === "sleeping" && (
        <div
          className="absolute w-1 h-1 rounded-full animate-pulse"
          style={{
            top: "10%",
            right: "10%",
            backgroundColor: effectColor,
            opacity: 0.4,
          }}
        />
      )}
    </div>
  );
};

export default MysticSprite;
