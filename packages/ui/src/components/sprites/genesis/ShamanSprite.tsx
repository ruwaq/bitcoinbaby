/**
 * Shaman Spark Sprite - TRIBAL MAGIC CASTERS
 *
 * Chamanes y curanderos tribales conectados con la naturaleza.
 * +25% XP en misiones de exploración, +15% drops de hierbas.
 *
 * 5 Variantes tribales:
 * - Shaman: Chamán tribal con plumas y huesos
 * - Druid: Druida con corona de hojas y cuernos
 * - Witch: Brujo/bruja con caldero y hierbas
 * - Healer: Curandero con plantas medicinales
 * - Elder: Anciano sabio con bastón y runas
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface ShamanSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type ShamanVariant = "shaman" | "druid" | "witch" | "healer" | "elder";

interface ShamanColors {
  skin: string;
  skinShade: string;
  robe: string;
  robeAccent: string;
  accessory: string;
  magic: string;
  secondary: string;
}

const SHAMAN_COLORS: Record<ShamanVariant, ShamanColors[]> = {
  shaman: [
    {
      skin: "#d4a574",
      skinShade: "#b48554",
      robe: "#78350f",
      robeAccent: "#92400e",
      accessory: "#fef3c7",
      magic: "#22c55e",
      secondary: "#dc2626",
    },
    {
      skin: "#8b6443",
      skinShade: "#6b4423",
      robe: "#1f2937",
      robeAccent: "#374151",
      accessory: "#fbbf24",
      magic: "#8b5cf6",
      secondary: "#f97316",
    },
    {
      skin: "#c49c72",
      skinShade: "#a47c52",
      robe: "#365314",
      robeAccent: "#3f6212",
      accessory: "#e5e7eb",
      magic: "#06b6d4",
      secondary: "#ef4444",
    },
    {
      skin: "#a67c52",
      skinShade: "#8a6042",
      robe: "#7f1d1d",
      robeAccent: "#991b1b",
      accessory: "#fcd34d",
      magic: "#4ade80",
      secondary: "#3b82f6",
    },
    {
      skin: "#6b4423",
      skinShade: "#4a2f18",
      robe: "#581c87",
      robeAccent: "#7e22ce",
      accessory: "#ffffff",
      magic: "#f472b6",
      secondary: "#22d3ee",
    },
  ],
  druid: [
    {
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
      robe: "#15803d",
      robeAccent: "#22c55e",
      accessory: "#78350f",
      magic: "#4ade80",
      secondary: "#fbbf24",
    },
    {
      skin: "#d4a574",
      skinShade: "#b48554",
      robe: "#166534",
      robeAccent: "#16a34a",
      accessory: "#451a03",
      magic: "#86efac",
      secondary: "#f59e0b",
    },
    {
      skin: "#f5d0a9",
      skinShade: "#d4b089",
      robe: "#14532d",
      robeAccent: "#15803d",
      accessory: "#92400e",
      magic: "#22d3ee",
      secondary: "#dc2626",
    },
    {
      skin: "#e8c4a0",
      skinShade: "#c8a480",
      robe: "#365314",
      robeAccent: "#4d7c0f",
      accessory: "#78350f",
      magic: "#a78bfa",
      secondary: "#f97316",
    },
    {
      skin: "#c49c72",
      skinShade: "#a47c52",
      robe: "#064e3b",
      robeAccent: "#047857",
      accessory: "#1f2937",
      magic: "#34d399",
      secondary: "#8b5cf6",
    },
  ],
  witch: [
    {
      skin: "#ddd6fe",
      skinShade: "#c4b5fd",
      robe: "#1f2937",
      robeAccent: "#374151",
      accessory: "#8b5cf6",
      magic: "#a855f7",
      secondary: "#22c55e",
    },
    {
      skin: "#e8c4a0",
      skinShade: "#c8a480",
      robe: "#3b0764",
      robeAccent: "#581c87",
      accessory: "#fbbf24",
      magic: "#c084fc",
      secondary: "#ef4444",
    },
    {
      skin: "#fecaca",
      skinShade: "#fca5a5",
      robe: "#0f172a",
      robeAccent: "#1e293b",
      accessory: "#22d3ee",
      magic: "#f472b6",
      secondary: "#4ade80",
    },
    {
      skin: "#bbf7d0",
      skinShade: "#86efac",
      robe: "#14532d",
      robeAccent: "#166534",
      accessory: "#fcd34d",
      magic: "#4ade80",
      secondary: "#a855f7",
    },
    {
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
      robe: "#450a0a",
      robeAccent: "#7f1d1d",
      accessory: "#f97316",
      magic: "#ef4444",
      secondary: "#3b82f6",
    },
  ],
  healer: [
    {
      skin: "#ffe4c4",
      skinShade: "#dfc4a4",
      robe: "#fef3c7",
      robeAccent: "#fde68a",
      accessory: "#22c55e",
      magic: "#4ade80",
      secondary: "#f472b6",
    },
    {
      skin: "#d4a574",
      skinShade: "#b48554",
      robe: "#ecfdf5",
      robeAccent: "#d1fae5",
      accessory: "#059669",
      magic: "#34d399",
      secondary: "#fbbf24",
    },
    {
      skin: "#a67c52",
      skinShade: "#8a6042",
      robe: "#f0fdf4",
      robeAccent: "#dcfce7",
      accessory: "#16a34a",
      magic: "#86efac",
      secondary: "#06b6d4",
    },
    {
      skin: "#8b6443",
      skinShade: "#6b4423",
      robe: "#fffbeb",
      robeAccent: "#fef3c7",
      accessory: "#15803d",
      magic: "#22d3ee",
      secondary: "#ec4899",
    },
    {
      skin: "#f5d0a9",
      skinShade: "#d4b089",
      robe: "#fdf2f8",
      robeAccent: "#fce7f3",
      accessory: "#10b981",
      magic: "#f472b6",
      secondary: "#8b5cf6",
    },
  ],
  elder: [
    {
      skin: "#e5e7eb",
      skinShade: "#d1d5db",
      robe: "#78350f",
      robeAccent: "#92400e",
      accessory: "#fbbf24",
      magic: "#f59e0b",
      secondary: "#8b5cf6",
    },
    {
      skin: "#d1d5db",
      skinShade: "#9ca3af",
      robe: "#1e3a8a",
      robeAccent: "#1d4ed8",
      accessory: "#fcd34d",
      magic: "#3b82f6",
      secondary: "#22c55e",
    },
    {
      skin: "#fef3c7",
      skinShade: "#fde68a",
      robe: "#581c87",
      robeAccent: "#7e22ce",
      accessory: "#ffffff",
      magic: "#a855f7",
      secondary: "#f97316",
    },
    {
      skin: "#d4a574",
      skinShade: "#b48554",
      robe: "#0f172a",
      robeAccent: "#1e293b",
      accessory: "#f7931a",
      magic: "#fbbf24",
      secondary: "#ef4444",
    },
    {
      skin: "#a67c52",
      skinShade: "#8a6042",
      robe: "#14532d",
      robeAccent: "#166534",
      accessory: "#fef3c7",
      magic: "#4ade80",
      secondary: "#06b6d4",
    },
  ],
};

const getShamanVariant = (dna: string): ShamanVariant => {
  const variants: ShamanVariant[] = [
    "shaman",
    "druid",
    "witch",
    "healer",
    "elder",
  ];
  const index = parseInt(dna[0] || "0", 16) % 5;
  return variants[index];
};

const getShamanColors = (variant: ShamanVariant, dna: string): ShamanColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return SHAMAN_COLORS[variant][index];
};

export const ShamanSprite: FC<ShamanSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  className = "",
}) => {
  const variant = getShamanVariant(dna);
  const colors = getShamanColors(variant, dna);

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

  // Shaman - Tribal with feathers and bones
  const renderShaman = () => (
    <>
      {/* Feather headdress */}
      <rect x="8" y="2" width="2" height="5" fill={colors.secondary} />
      <rect x="7" y="1" width="2" height="2" fill={colors.accessory} />
      <rect x="12" y="1" width="2" height="6" fill={colors.magic} />
      <rect x="11" y="0" width="2" height="2" fill={colors.secondary} />
      <rect x="18" y="1" width="2" height="6" fill={colors.magic} />
      <rect x="19" y="0" width="2" height="2" fill={colors.secondary} />
      <rect x="22" y="2" width="2" height="5" fill={colors.secondary} />
      <rect x="23" y="1" width="2" height="2" fill={colors.accessory} />

      {/* Head */}
      <rect x="10" y="6" width="12" height="10" fill={colors.skin} />
      <rect x="9" y="8" width="1" height="6" fill={colors.skin} />
      <rect x="22" y="8" width="1" height="6" fill={colors.skin} />

      {/* Face paint stripes */}
      <rect x="10" y="10" width="2" height="1" fill={colors.secondary} />
      <rect x="20" y="10" width="2" height="1" fill={colors.secondary} />
      <rect x="11" y="12" width="1" height="2" fill={colors.secondary} />
      <rect x="20" y="12" width="1" height="2" fill={colors.secondary} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="10" width="3" height="3" fill="#1f2937" />
          <rect x="17" y="10" width="3" height="3" fill="#1f2937" />
          <rect x="13" y="11" width="1" height="1" fill="#ffffff" />
          <rect x="18" y="11" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="12" y="11" width="3" height="1" fill={colors.skinShade} />
          <rect x="17" y="11" width="3" height="1" fill={colors.skinShade} />
        </>
      )}

      {/* Nose and mouth */}
      <rect x="15" y="12" width="2" height="2" fill={colors.skinShade} />
      <rect x="14" y="14" width="4" height="1" fill={colors.skinShade} />

      {/* Bone necklace */}
      <rect x="11" y="16" width="10" height="2" fill={colors.accessory} />
      <rect x="12" y="15" width="2" height="1" fill={colors.accessory} />
      <rect x="18" y="15" width="2" height="1" fill={colors.accessory} />
      <rect x="15" y="17" width="2" height="2" fill={colors.accessory} />

      {/* Body/robe */}
      <rect x="9" y="18" width="14" height="10" fill={colors.robe} />
      <rect x="11" y="18" width="10" height="3" fill={colors.robeAccent} />

      {/* Tribal pattern on robe */}
      <rect x="12" y="22" width="2" height="2" fill={colors.magic} />
      <rect x="18" y="22" width="2" height="2" fill={colors.magic} />
      <rect x="15" y="24" width="2" height="2" fill={colors.secondary} />

      {/* Arms */}
      <rect x="5" y="19" width="4" height="3" fill={colors.skin} />
      <rect x="4" y="21" width="3" height="5" fill={colors.skin} />
      <rect x="23" y="19" width="4" height="3" fill={colors.skin} />
      <rect x="25" y="21" width="3" height="5" fill={colors.skin} />

      {/* Staff */}
      <rect x="3" y="14" width="2" height="14" fill="#78350f" />
      <rect x="2" y="12" width="4" height="3" fill={colors.magic} />
      <rect x="3" y="11" width="2" height="1" fill={colors.accessory} />

      {/* Legs */}
      <rect x="11" y="28" width="4" height="4" fill={colors.skinShade} />
      <rect x="17" y="28" width="4" height="4" fill={colors.skinShade} />
    </>
  );

  // Druid - Nature crown with antlers
  const renderDruid = () => (
    <>
      {/* Antlers */}
      <rect x="6" y="3" width="2" height="4" fill={colors.accessory} />
      <rect x="5" y="2" width="2" height="2" fill={colors.accessory} />
      <rect x="4" y="1" width="2" height="2" fill={colors.accessory} />
      <rect x="24" y="3" width="2" height="4" fill={colors.accessory} />
      <rect x="25" y="2" width="2" height="2" fill={colors.accessory} />
      <rect x="26" y="1" width="2" height="2" fill={colors.accessory} />

      {/* Leaf crown */}
      <rect x="10" y="4" width="12" height="3" fill={colors.magic} />
      <rect x="9" y="5" width="2" height="2" fill={colors.secondary} />
      <rect x="21" y="5" width="2" height="2" fill={colors.secondary} />
      <rect x="14" y="3" width="4" height="2" fill={colors.magic} />

      {/* Head */}
      <rect x="10" y="7" width="12" height="10" fill={colors.skin} />
      <rect x="9" y="9" width="1" height="6" fill={colors.skin} />
      <rect x="22" y="9" width="1" height="6" fill={colors.skin} />

      {/* Beard (moss-like) */}
      <rect
        x="12"
        y="14"
        width="8"
        height="3"
        fill={colors.magic}
        opacity="0.7"
      />
      <rect
        x="14"
        y="16"
        width="4"
        height="2"
        fill={colors.magic}
        opacity="0.5"
      />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="10" width="3" height="3" fill={colors.magic} />
          <rect x="17" y="10" width="3" height="3" fill={colors.magic} />
          <rect x="13" y="11" width="1" height="1" fill="#1f2937" />
          <rect x="18" y="11" width="1" height="1" fill="#1f2937" />
        </>
      ) : (
        <>
          <rect x="12" y="11" width="3" height="1" fill={colors.skinShade} />
          <rect x="17" y="11" width="3" height="1" fill={colors.skinShade} />
        </>
      )}

      {/* Body/robe */}
      <rect x="8" y="17" width="16" height="11" fill={colors.robe} />
      <rect x="10" y="17" width="12" height="4" fill={colors.robeAccent} />

      {/* Vine patterns */}
      <rect x="9" y="20" width="1" height="6" fill={colors.magic} />
      <rect x="10" y="22" width="1" height="1" fill={colors.secondary} />
      <rect x="22" y="20" width="1" height="6" fill={colors.magic} />
      <rect x="21" y="24" width="1" height="1" fill={colors.secondary} />

      {/* Central tree symbol */}
      <rect x="15" y="21" width="2" height="4" fill={colors.accessory} />
      <rect x="14" y="20" width="4" height="2" fill={colors.magic} />

      {/* Arms */}
      <rect x="4" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="3" y="20" width="3" height="5" fill={colors.skin} />
      <rect x="24" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="26" y="20" width="3" height="5" fill={colors.skin} />

      {/* Wooden staff */}
      <rect x="1" y="16" width="2" height="12" fill={colors.accessory} />
      <rect x="0" y="14" width="4" height="3" fill={colors.magic} />

      {/* Legs */}
      <rect x="11" y="28" width="4" height="4" fill={colors.robe} />
      <rect x="17" y="28" width="4" height="4" fill={colors.robe} />
    </>
  );

  // Witch - With pointed hat and cauldron
  const renderWitch = () => (
    <>
      {/* Pointed hat */}
      <rect x="15" y="0" width="2" height="2" fill={colors.robe} />
      <rect x="14" y="2" width="4" height="2" fill={colors.robe} />
      <rect x="13" y="4" width="6" height="2" fill={colors.robe} />
      <rect x="11" y="6" width="10" height="2" fill={colors.robe} />
      <rect x="9" y="7" width="14" height="1" fill={colors.robeAccent} />

      {/* Hat buckle */}
      <rect x="14" y="5" width="4" height="2" fill={colors.accessory} />

      {/* Head */}
      <rect x="11" y="8" width="10" height="9" fill={colors.skin} />
      <rect x="10" y="10" width="1" height="5" fill={colors.skin} />
      <rect x="21" y="10" width="1" height="5" fill={colors.skin} />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="11" width="3" height="3" fill={colors.magic} />
          <rect x="17" y="11" width="3" height="3" fill={colors.magic} />
          <rect x="13" y="12" width="1" height="1" fill="#1f2937" />
          <rect x="18" y="12" width="1" height="1" fill="#1f2937" />
        </>
      ) : (
        <>
          <rect x="12" y="12" width="3" height="1" fill={colors.skinShade} />
          <rect x="17" y="12" width="3" height="1" fill={colors.skinShade} />
        </>
      )}

      {/* Nose (hooked) */}
      <rect x="15" y="13" width="2" height="2" fill={colors.skinShade} />
      <rect x="14" y="14" width="1" height="1" fill={colors.skinShade} />

      {/* Mouth */}
      <rect x="14" y="15" width="4" height="1" fill="#1f2937" />

      {/* Body/cloak */}
      <rect x="9" y="17" width="14" height="11" fill={colors.robe} />
      <rect x="11" y="17" width="10" height="3" fill={colors.robeAccent} />

      {/* Mystic symbols on cloak */}
      <rect
        x="14"
        y="21"
        width="4"
        height="4"
        fill={colors.magic}
        opacity="0.7"
      />
      <rect x="15" y="22" width="2" height="2" fill={colors.accessory} />

      {/* Arms holding wand */}
      <rect x="5" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="4" y="20" width="3" height="5" fill={colors.skin} />
      <rect x="23" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="25" y="20" width="3" height="5" fill={colors.skin} />

      {/* Wand */}
      <rect x="2" y="18" width="2" height="8" fill={colors.accessory} />
      <rect x="1" y="16" width="4" height="3" fill={colors.magic} />
      <rect x="2" y="15" width="2" height="1" fill={colors.secondary} />

      {/* Cauldron (small, at feet) */}
      <rect x="24" y="26" width="6" height="4" fill="#374151" />
      <rect x="25" y="25" width="4" height="1" fill="#4b5563" />
      <rect
        x="26"
        y="27"
        width="2"
        height="2"
        fill={colors.magic}
        opacity="0.6"
      />

      {/* Legs */}
      <rect x="11" y="28" width="4" height="4" fill={colors.robe} />
      <rect x="17" y="28" width="4" height="4" fill={colors.robe} />
    </>
  );

  // Healer - White robes with herbs
  const renderHealer = () => (
    <>
      {/* Herb crown */}
      <rect x="10" y="4" width="12" height="3" fill={colors.accessory} />
      <rect x="11" y="3" width="3" height="2" fill={colors.magic} />
      <rect x="15" y="2" width="2" height="2" fill={colors.secondary} />
      <rect x="18" y="3" width="3" height="2" fill={colors.magic} />

      {/* Head */}
      <rect x="10" y="7" width="12" height="10" fill={colors.skin} />
      <rect x="9" y="9" width="1" height="6" fill={colors.skin} />
      <rect x="22" y="9" width="1" height="6" fill={colors.skin} />

      {/* Kind eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="10" width="3" height="3" fill={colors.magic} />
          <rect x="17" y="10" width="3" height="3" fill={colors.magic} />
          <rect x="13" y="11" width="1" height="1" fill="#1f2937" />
          <rect x="18" y="11" width="1" height="1" fill="#1f2937" />
          {/* Warm glow */}
          <rect
            x="12"
            y="10"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.5"
          />
          <rect
            x="17"
            y="10"
            width="1"
            height="1"
            fill="#ffffff"
            opacity="0.5"
          />
        </>
      ) : (
        <>
          <rect x="12" y="11" width="3" height="1" fill={colors.skinShade} />
          <rect x="17" y="11" width="3" height="1" fill={colors.skinShade} />
        </>
      )}

      {/* Gentle smile */}
      <rect x="14" y="14" width="4" height="1" fill={colors.skinShade} />
      <rect x="13" y="13" width="1" height="1" fill={colors.skinShade} />
      <rect x="18" y="13" width="1" height="1" fill={colors.skinShade} />

      {/* White healing robes */}
      <rect x="8" y="17" width="16" height="11" fill={colors.robe} />
      <rect x="10" y="17" width="12" height="3" fill={colors.robeAccent} />

      {/* Cross/healing symbol */}
      <rect x="15" y="20" width="2" height="6" fill={colors.accessory} />
      <rect x="13" y="22" width="6" height="2" fill={colors.accessory} />

      {/* Herb pouches */}
      <rect x="9" y="22" width="3" height="3" fill={colors.magic} />
      <rect x="10" y="21" width="1" height="1" fill={colors.secondary} />
      <rect x="20" y="22" width="3" height="3" fill={colors.magic} />
      <rect x="21" y="21" width="1" height="1" fill={colors.secondary} />

      {/* Arms */}
      <rect x="4" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="3" y="20" width="3" height="5" fill={colors.skin} />
      <rect x="24" y="18" width="4" height="3" fill={colors.robe} />
      <rect x="26" y="20" width="3" height="5" fill={colors.skin} />

      {/* Healing herb bundle */}
      <rect x="1" y="22" width="3" height="4" fill={colors.magic} />
      <rect x="0" y="21" width="2" height="2" fill={colors.secondary} />
      <rect x="2" y="20" width="2" height="2" fill={colors.secondary} />

      {/* Legs */}
      <rect x="11" y="28" width="4" height="4" fill={colors.robe} />
      <rect x="17" y="28" width="4" height="4" fill={colors.robe} />
    </>
  );

  // Elder - Wise with staff and runes
  const renderElder = () => (
    <>
      {/* Long white/gray hair */}
      <rect x="8" y="5" width="16" height="4" fill={colors.skin} />
      <rect x="7" y="7" width="2" height="8" fill={colors.skin} />
      <rect x="23" y="7" width="2" height="8" fill={colors.skin} />

      {/* Head */}
      <rect x="10" y="6" width="12" height="10" fill={colors.skinShade} />
      <rect x="9" y="8" width="1" height="6" fill={colors.skinShade} />
      <rect x="22" y="8" width="1" height="6" fill={colors.skinShade} />

      {/* Wise wrinkles */}
      <rect
        x="10"
        y="9"
        width="2"
        height="1"
        fill={colors.skin}
        opacity="0.5"
      />
      <rect
        x="20"
        y="9"
        width="2"
        height="1"
        fill={colors.skin}
        opacity="0.5"
      />

      {/* Deep eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="10" width="3" height="2" fill="#1f2937" />
          <rect x="17" y="10" width="3" height="2" fill="#1f2937" />
          <rect x="13" y="10" width="1" height="1" fill={colors.magic} />
          <rect x="18" y="10" width="1" height="1" fill={colors.magic} />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill="#1f2937" />
          <rect x="17" y="10" width="3" height="1" fill="#1f2937" />
        </>
      )}

      {/* Long beard */}
      <rect x="12" y="13" width="8" height="5" fill={colors.skin} />
      <rect x="14" y="18" width="4" height="3" fill={colors.skin} />
      <rect x="15" y="21" width="2" height="2" fill={colors.skin} />

      {/* Body/robe */}
      <rect x="8" y="16" width="16" height="12" fill={colors.robe} />
      <rect x="10" y="16" width="12" height="3" fill={colors.robeAccent} />

      {/* Rune symbols on robe */}
      <rect x="10" y="21" width="2" height="3" fill={colors.magic} />
      <rect x="11" y="20" width="1" height="1" fill={colors.accessory} />
      <rect x="20" y="21" width="2" height="3" fill={colors.magic} />
      <rect x="20" y="20" width="1" height="1" fill={colors.accessory} />
      <rect x="15" y="23" width="2" height="2" fill={colors.secondary} />

      {/* Arms */}
      <rect x="4" y="17" width="4" height="3" fill={colors.robe} />
      <rect x="3" y="19" width="3" height="5" fill={colors.skinShade} />
      <rect x="24" y="17" width="4" height="3" fill={colors.robe} />
      <rect x="26" y="19" width="3" height="5" fill={colors.skinShade} />

      {/* Elder staff with crystal */}
      <rect x="1" y="10" width="2" height="18" fill={colors.accessory} />
      <rect x="0" y="6" width="4" height="5" fill={colors.magic} />
      <rect x="1" y="5" width="2" height="1" fill={colors.secondary} />
      <rect x="1" y="7" width="2" height="2" fill="#ffffff" opacity="0.7" />

      {/* Legs */}
      <rect x="11" y="28" width="4" height="4" fill={colors.robe} />
      <rect x="17" y="28" width="4" height="4" fill={colors.robe} />
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case "shaman":
        return renderShaman();
      case "druid":
        return renderDruid();
      case "witch":
        return renderWitch();
      case "healer":
        return renderHealer();
      case "elder":
        return renderElder();
      default:
        return renderShaman();
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

        {/* Mining state - nature magic */}
        {state === "mining" && (
          <>
            <rect x="4" y="6" width="2" height="2" fill={colors.magic}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="26" y="8" width="2" height="2" fill={colors.magic}>
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="0.6s"
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}

        {/* Learning state - wisdom glow */}
        {state === "learning" && (
          <>
            <rect
              x="2"
              y="4"
              width="3"
              height="3"
              fill={colors.accessory}
              opacity="0.7"
            />
            <rect x="3" y="5" width="1" height="1" fill={colors.magic} />
          </>
        )}
      </svg>

      {/* Nature particles for thriving */}
      {state === "thriving" && (
        <>
          <div
            className="absolute w-1.5 h-1.5 rounded-sm animate-ping"
            style={{ top: "10%", left: "15%", backgroundColor: colors.magic }}
          />
          <div
            className="absolute w-1 h-1 rounded-sm animate-ping"
            style={{
              top: "20%",
              right: "10%",
              backgroundColor: colors.secondary,
              animationDelay: "0.3s",
            }}
          />
        </>
      )}

      {/* Evolving nature sparkles */}
      {state === "evolving" && (
        <>
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{ top: "10%", left: "20%", backgroundColor: colors.magic }}
          />
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              top: "25%",
              right: "15%",
              backgroundColor: colors.accessory,
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
            color: colors.magic,
          }}
        >
          Zzz
        </div>
      )}

      {/* Happy leaf/nature symbols */}
      {state === "happy" && (
        <>
          <div
            className="absolute animate-bounce"
            style={{
              top: "-5%",
              left: "15%",
              fontSize: size / 10,
              color: colors.magic,
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
              color: colors.secondary,
              animationDelay: "0.15s",
            }}
          >
            ✧
          </div>
        </>
      )}

      {/* Hungry */}
      {state === "hungry" && (
        <div
          className="absolute w-1 h-2 rounded-full animate-pulse"
          style={{
            bottom: "40%",
            right: "40%",
            backgroundColor: colors.skinShade,
          }}
        />
      )}
    </div>
  );
};

export default ShamanSprite;
