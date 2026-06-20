/**
 * Alien Spark Sprite - SCI-FI EXTRATERRESTRIALS
 *
 * Seres de otros mundos con tecnología avanzada.
 * +15% a todo en eventos raros, impredecibles.
 *
 * 5 Variantes alienígenas:
 * - Grey: Clásico alienígena gris con ojos grandes negros
 * - Reptilian: Reptiliano con escamas y ojos de serpiente
 * - Insectoid: Insectoide con antenas y ojos compuestos
 * - Cephalopod: Cefalópodo con tentáculos y piel brillante
 * - Energy: Ser de energía pura, forma etérea luminosa
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette, BASE_TYPE_COLORS } from "./types";

interface AlienSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type AlienVariant =
  | "grey"
  | "reptilian"
  | "insectoid"
  | "cephalopod"
  | "energy";

interface AlienColors {
  skin: string;
  skinLight: string;
  skinDark: string;
  eyes: string;
  eyeShine: string;
  accent: string;
  tech: string;
}

const ALIEN_COLORS: Record<AlienVariant, AlienColors[]> = {
  grey: [
    {
      skin: "#9ca3af",
      skinLight: "#d1d5db",
      skinDark: "#6b7280",
      eyes: "#000000",
      eyeShine: "#374151",
      accent: "#22d3ee",
      tech: "#06b6d4",
    },
    {
      skin: "#a3a3a3",
      skinLight: "#d4d4d4",
      skinDark: "#737373",
      eyes: "#000000",
      eyeShine: "#404040",
      accent: "#4ade80",
      tech: "#22c55e",
    },
    {
      skin: "#a8a29e",
      skinLight: "#d6d3d1",
      skinDark: "#78716c",
      eyes: "#1f2937",
      eyeShine: "#4b5563",
      accent: "#c084fc",
      tech: "#a855f7",
    },
    {
      skin: "#94a3b8",
      skinLight: "#cbd5e1",
      skinDark: "#64748b",
      eyes: "#000000",
      eyeShine: "#1e293b",
      accent: "#f472b6",
      tech: "#ec4899",
    },
    {
      skin: "#a1a1aa",
      skinLight: "#d4d4d8",
      skinDark: "#71717a",
      eyes: "#18181b",
      eyeShine: "#3f3f46",
      accent: "#fbbf24",
      tech: "#f59e0b",
    },
  ],
  reptilian: [
    {
      skin: "#22c55e",
      skinLight: "#4ade80",
      skinDark: "#15803d",
      eyes: "#fbbf24",
      eyeShine: "#fcd34d",
      accent: "#dc2626",
      tech: "#991b1b",
    },
    {
      skin: "#16a34a",
      skinLight: "#22c55e",
      skinDark: "#166534",
      eyes: "#f59e0b",
      eyeShine: "#fbbf24",
      accent: "#7f1d1d",
      tech: "#450a0a",
    },
    {
      skin: "#84cc16",
      skinLight: "#a3e635",
      skinDark: "#65a30d",
      eyes: "#ef4444",
      eyeShine: "#f87171",
      accent: "#0f172a",
      tech: "#1e293b",
    },
    {
      skin: "#14b8a6",
      skinLight: "#2dd4bf",
      skinDark: "#0d9488",
      eyes: "#fcd34d",
      eyeShine: "#fef08a",
      accent: "#581c87",
      tech: "#7e22ce",
    },
    {
      skin: "#059669",
      skinLight: "#10b981",
      skinDark: "#047857",
      eyes: "#fb923c",
      eyeShine: "#fdba74",
      accent: "#0c4a6e",
      tech: "#0369a1",
    },
  ],
  insectoid: [
    {
      skin: "#78350f",
      skinLight: "#92400e",
      skinDark: "#451a03",
      eyes: "#dc2626",
      eyeShine: "#f87171",
      accent: "#fbbf24",
      tech: "#f59e0b",
    },
    {
      skin: "#365314",
      skinLight: "#3f6212",
      skinDark: "#1a2e05",
      eyes: "#22d3ee",
      eyeShine: "#67e8f9",
      accent: "#a855f7",
      tech: "#9333ea",
    },
    {
      skin: "#1e3a8a",
      skinLight: "#1d4ed8",
      skinDark: "#172554",
      eyes: "#fbbf24",
      eyeShine: "#fcd34d",
      accent: "#22c55e",
      tech: "#16a34a",
    },
    {
      skin: "#581c87",
      skinLight: "#7e22ce",
      skinDark: "#3b0764",
      eyes: "#4ade80",
      eyeShine: "#86efac",
      accent: "#f472b6",
      tech: "#ec4899",
    },
    {
      skin: "#0f172a",
      skinLight: "#1e293b",
      skinDark: "#020617",
      eyes: "#22d3ee",
      eyeShine: "#a5f3fc",
      accent: "#ef4444",
      tech: "#dc2626",
    },
  ],
  cephalopod: [
    {
      skin: "#7c3aed",
      skinLight: "#a78bfa",
      skinDark: "#5b21b6",
      eyes: "#fbbf24",
      eyeShine: "#fcd34d",
      accent: "#22d3ee",
      tech: "#06b6d4",
    },
    {
      skin: "#2563eb",
      skinLight: "#3b82f6",
      skinDark: "#1d4ed8",
      eyes: "#f472b6",
      eyeShine: "#f9a8d4",
      accent: "#4ade80",
      tech: "#22c55e",
    },
    {
      skin: "#db2777",
      skinLight: "#ec4899",
      skinDark: "#be185d",
      eyes: "#22d3ee",
      eyeShine: "#67e8f9",
      accent: "#fbbf24",
      tech: "#f59e0b",
    },
    {
      skin: "#0891b2",
      skinLight: "#06b6d4",
      skinDark: "#0e7490",
      eyes: "#f59e0b",
      eyeShine: "#fbbf24",
      accent: "#f472b6",
      tech: "#ec4899",
    },
    {
      skin: "#4f46e5",
      skinLight: "#6366f1",
      skinDark: "#4338ca",
      eyes: "#34d399",
      eyeShine: "#6ee7b7",
      accent: "#f87171",
      tech: "#ef4444",
    },
  ],
  energy: [
    {
      skin: "#22d3ee",
      skinLight: "#67e8f9",
      skinDark: "#06b6d4",
      eyes: "#ffffff",
      eyeShine: "#f0f9ff",
      accent: "#a855f7",
      tech: "#c084fc",
    },
    {
      skin: "#4ade80",
      skinLight: "#86efac",
      skinDark: "#22c55e",
      eyes: "#ffffff",
      eyeShine: "#f0fdf4",
      accent: "#3b82f6",
      tech: "#60a5fa",
    },
    {
      skin: "#f472b6",
      skinLight: "#f9a8d4",
      skinDark: "#ec4899",
      eyes: "#ffffff",
      eyeShine: "#fdf2f8",
      accent: "#fbbf24",
      tech: "#fcd34d",
    },
    {
      skin: "#fbbf24",
      skinLight: "#fcd34d",
      skinDark: "#f59e0b",
      eyes: "#ffffff",
      eyeShine: "#fffbeb",
      accent: "#ef4444",
      tech: "#f87171",
    },
    {
      skin: "#a78bfa",
      skinLight: "#c4b5fd",
      skinDark: "#8b5cf6",
      eyes: "#ffffff",
      eyeShine: "#faf5ff",
      accent: "#22d3ee",
      tech: "#67e8f9",
    },
  ],
};

const getAlienVariant = (dna: string): AlienVariant => {
  const variants: AlienVariant[] = [
    "grey",
    "reptilian",
    "insectoid",
    "cephalopod",
    "energy",
  ];
  const index = parseInt(dna[0] || "0", 16) % 5;
  return variants[index];
};

const getAlienColors = (variant: AlienVariant, dna: string): AlienColors => {
  const index = parseInt(dna[1] || "0", 16) % 5;
  return ALIEN_COLORS[variant][index];
};

export const AlienSprite: FC<AlienSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  className = "",
}) => {
  const variant = getAlienVariant(dna);
  const colors = getAlienColors(variant, dna);

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

  // Grey Alien - Classic big-headed alien
  const renderGrey = () => (
    <>
      {/* Large head */}
      <rect x="8" y="4" width="16" height="14" fill={colors.skin} />
      <rect x="6" y="6" width="2" height="10" fill={colors.skin} />
      <rect x="24" y="6" width="2" height="10" fill={colors.skin} />
      <rect x="10" y="3" width="12" height="2" fill={colors.skin} />

      {/* Head highlights */}
      <rect x="10" y="5" width="6" height="2" fill={colors.skinLight} />
      <rect x="9" y="7" width="3" height="1" fill={colors.skinLight} />

      {/* Head shadows */}
      <rect x="8" y="15" width="16" height="2" fill={colors.skinDark} />

      {/* Large almond eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="9" y="8" width="5" height="6" fill={colors.eyes} />
          <rect x="18" y="8" width="5" height="6" fill={colors.eyes} />
          <rect x="8" y="9" width="1" height="4" fill={colors.eyes} />
          <rect x="23" y="9" width="1" height="4" fill={colors.eyes} />
          {/* Eye shine */}
          <rect x="10" y="9" width="2" height="2" fill={colors.eyeShine} />
          <rect x="19" y="9" width="2" height="2" fill={colors.eyeShine} />
        </>
      ) : (
        <>
          <rect x="9" y="10" width="5" height="1" fill={colors.skinDark} />
          <rect x="18" y="10" width="5" height="1" fill={colors.skinDark} />
        </>
      )}

      {/* Small nose/mouth area */}
      <rect x="15" y="14" width="2" height="1" fill={colors.skinDark} />
      <rect
        x="14"
        y="15"
        width="4"
        height="1"
        fill={colors.skinDark}
        opacity="0.5"
      />

      {/* Thin neck */}
      <rect x="14" y="18" width="4" height="2" fill={colors.skin} />

      {/* Slim body */}
      <rect x="11" y="20" width="10" height="8" fill={colors.skin} />
      <rect x="13" y="20" width="6" height="3" fill={colors.skinLight} />

      {/* Tech suit lines */}
      <rect x="15" y="22" width="2" height="4" fill={colors.tech} />
      <rect x="12" y="24" width="8" height="1" fill={colors.accent} />

      {/* Thin arms */}
      <rect x="7" y="21" width="4" height="2" fill={colors.skin} />
      <rect x="5" y="22" width="3" height="5" fill={colors.skin} />
      <rect x="21" y="21" width="4" height="2" fill={colors.skin} />
      <rect x="24" y="22" width="3" height="5" fill={colors.skin} />

      {/* Long fingers */}
      <rect x="4" y="27" width="1" height="2" fill={colors.skinDark} />
      <rect x="6" y="27" width="1" height="2" fill={colors.skinDark} />
      <rect x="8" y="27" width="1" height="2" fill={colors.skinDark} />
      <rect x="23" y="27" width="1" height="2" fill={colors.skinDark} />
      <rect x="25" y="27" width="1" height="2" fill={colors.skinDark} />
      <rect x="27" y="27" width="1" height="2" fill={colors.skinDark} />

      {/* Legs */}
      <rect x="12" y="28" width="3" height="4" fill={colors.skin} />
      <rect x="17" y="28" width="3" height="4" fill={colors.skin} />
    </>
  );

  // Reptilian Alien - Scaled with slit eyes
  const renderReptilian = () => (
    <>
      {/* Elongated head */}
      <rect x="9" y="5" width="14" height="12" fill={colors.skin} />
      <rect x="8" y="7" width="1" height="8" fill={colors.skin} />
      <rect x="23" y="7" width="1" height="8" fill={colors.skin} />

      {/* Scale pattern */}
      <rect x="10" y="6" width="2" height="1" fill={colors.skinDark} />
      <rect x="14" y="6" width="2" height="1" fill={colors.skinDark} />
      <rect x="18" y="6" width="2" height="1" fill={colors.skinDark} />
      <rect x="11" y="8" width="2" height="1" fill={colors.skinDark} />
      <rect x="16" y="8" width="2" height="1" fill={colors.skinDark} />

      {/* Brow ridge */}
      <rect x="9" y="9" width="6" height="1" fill={colors.skinDark} />
      <rect x="17" y="9" width="6" height="1" fill={colors.skinDark} />

      {/* Slit eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="10" y="10" width="4" height="4" fill={colors.eyes} />
          <rect x="18" y="10" width="4" height="4" fill={colors.eyes} />
          {/* Vertical slit pupil */}
          <rect x="12" y="10" width="1" height="4" fill="#000000" />
          <rect x="19" y="10" width="1" height="4" fill="#000000" />
          {/* Shine */}
          <rect x="10" y="10" width="1" height="1" fill={colors.eyeShine} />
          <rect x="18" y="10" width="1" height="1" fill={colors.eyeShine} />
        </>
      ) : (
        <>
          <rect x="10" y="11" width="4" height="1" fill={colors.skinDark} />
          <rect x="18" y="11" width="4" height="1" fill={colors.skinDark} />
        </>
      )}

      {/* Snout */}
      <rect x="13" y="14" width="6" height="3" fill={colors.skinLight} />
      <rect x="14" y="15" width="1" height="1" fill={colors.skinDark} />
      <rect x="17" y="15" width="1" height="1" fill={colors.skinDark} />

      {/* Neck with scales */}
      <rect x="12" y="17" width="8" height="3" fill={colors.skin} />
      <rect x="14" y="17" width="1" height="1" fill={colors.skinDark} />
      <rect x="17" y="17" width="1" height="1" fill={colors.skinDark} />

      {/* Muscular body */}
      <rect x="9" y="20" width="14" height="8" fill={colors.skin} />
      <rect x="11" y="20" width="10" height="4" fill={colors.skinLight} />

      {/* Chest scales */}
      <rect x="12" y="21" width="2" height="1" fill={colors.skinDark} />
      <rect x="15" y="21" width="2" height="1" fill={colors.skinDark} />
      <rect x="18" y="21" width="2" height="1" fill={colors.skinDark} />

      {/* Arms */}
      <rect x="5" y="20" width="4" height="3" fill={colors.skin} />
      <rect x="4" y="22" width="3" height="5" fill={colors.skin} />
      <rect x="23" y="20" width="4" height="3" fill={colors.skin} />
      <rect x="25" y="22" width="3" height="5" fill={colors.skin} />

      {/* Clawed hands */}
      <rect x="3" y="27" width="2" height="2" fill={colors.accent} />
      <rect x="6" y="27" width="2" height="2" fill={colors.accent} />
      <rect x="24" y="27" width="2" height="2" fill={colors.accent} />
      <rect x="27" y="27" width="2" height="2" fill={colors.accent} />

      {/* Legs */}
      <rect x="10" y="28" width="4" height="4" fill={colors.skin} />
      <rect x="18" y="28" width="4" height="4" fill={colors.skin} />
    </>
  );

  // Insectoid Alien - Bug-like with compound eyes
  const renderInsectoid = () => (
    <>
      {/* Antennae */}
      <rect x="10" y="1" width="1" height="4" fill={colors.skinDark} />
      <rect x="9" y="0" width="2" height="2" fill={colors.accent} />
      <rect x="21" y="1" width="1" height="4" fill={colors.skinDark} />
      <rect x="20" y="0" width="2" height="2" fill={colors.accent} />

      {/* Triangular head */}
      <rect x="11" y="5" width="10" height="10" fill={colors.skin} />
      <rect x="9" y="7" width="2" height="6" fill={colors.skin} />
      <rect x="21" y="7" width="2" height="6" fill={colors.skin} />
      <rect x="13" y="4" width="6" height="2" fill={colors.skin} />

      {/* Compound eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="9" y="7" width="5" height="5" fill={colors.eyes} />
          <rect x="18" y="7" width="5" height="5" fill={colors.eyes} />
          {/* Eye facets */}
          <rect x="10" y="8" width="1" height="1" fill={colors.eyeShine} />
          <rect x="12" y="8" width="1" height="1" fill={colors.eyeShine} />
          <rect x="10" y="10" width="1" height="1" fill={colors.eyeShine} />
          <rect x="19" y="8" width="1" height="1" fill={colors.eyeShine} />
          <rect x="21" y="8" width="1" height="1" fill={colors.eyeShine} />
          <rect x="19" y="10" width="1" height="1" fill={colors.eyeShine} />
        </>
      ) : (
        <>
          <rect x="10" y="9" width="4" height="1" fill={colors.skinDark} />
          <rect x="18" y="9" width="4" height="1" fill={colors.skinDark} />
        </>
      )}

      {/* Mandibles */}
      <rect x="13" y="13" width="2" height="3" fill={colors.skinDark} />
      <rect x="17" y="13" width="2" height="3" fill={colors.skinDark} />
      <rect x="14" y="15" width="4" height="1" fill={colors.skinLight} />

      {/* Thorax */}
      <rect x="11" y="16" width="10" height="6" fill={colors.skin} />
      <rect x="13" y="16" width="6" height="2" fill={colors.skinLight} />

      {/* Segmented abdomen */}
      <rect x="10" y="22" width="12" height="8" fill={colors.skin} />
      <rect x="10" y="24" width="12" height="1" fill={colors.skinDark} />
      <rect x="10" y="27" width="12" height="1" fill={colors.skinDark} />

      {/* Upper arms */}
      <rect x="6" y="17" width="5" height="2" fill={colors.skin} />
      <rect x="21" y="17" width="5" height="2" fill={colors.skin} />
      <rect x="4" y="18" width="3" height="4" fill={colors.skin} />
      <rect x="25" y="18" width="3" height="4" fill={colors.skin} />

      {/* Middle arms */}
      <rect x="5" y="20" width="4" height="2" fill={colors.skin} />
      <rect x="23" y="20" width="4" height="2" fill={colors.skin} />
      <rect x="3" y="21" width="3" height="4" fill={colors.skinDark} />
      <rect x="26" y="21" width="3" height="4" fill={colors.skinDark} />

      {/* Legs */}
      <rect x="11" y="30" width="3" height="2" fill={colors.skinDark} />
      <rect x="18" y="30" width="3" height="2" fill={colors.skinDark} />
    </>
  );

  // Cephalopod Alien - Tentacled being
  const renderCephalopod = () => (
    <>
      {/* Bulbous head */}
      <rect x="8" y="3" width="16" height="14" fill={colors.skin} />
      <rect x="6" y="6" width="2" height="8" fill={colors.skin} />
      <rect x="24" y="6" width="2" height="8" fill={colors.skin} />
      <rect x="10" y="2" width="12" height="2" fill={colors.skin} />

      {/* Head texture - bioluminescent spots */}
      <rect x="10" y="4" width="2" height="2" fill={colors.skinLight} />
      <rect x="18" y="5" width="2" height="2" fill={colors.skinLight} />
      <rect x="14" y="3" width="2" height="2" fill={colors.skinLight} />

      {/* Large horizontal eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="8" y="9" width="6" height="4" fill={colors.eyes} />
          <rect x="18" y="9" width="6" height="4" fill={colors.eyes} />
          {/* Horizontal pupils */}
          <rect x="9" y="10" width="4" height="2" fill="#000000" />
          <rect x="19" y="10" width="4" height="2" fill="#000000" />
          {/* Shine */}
          <rect x="8" y="9" width="2" height="1" fill={colors.eyeShine} />
          <rect x="18" y="9" width="2" height="1" fill={colors.eyeShine} />
        </>
      ) : (
        <>
          <rect x="9" y="10" width="5" height="1" fill={colors.skinDark} />
          <rect x="18" y="10" width="5" height="1" fill={colors.skinDark} />
        </>
      )}

      {/* Beak-like mouth */}
      <rect x="14" y="14" width="4" height="3" fill={colors.skinDark} />
      <rect x="15" y="15" width="2" height="1" fill={colors.skinLight} />

      {/* Mantle/body */}
      <rect x="10" y="17" width="12" height="6" fill={colors.skin} />
      <rect x="12" y="17" width="8" height="3" fill={colors.skinLight} />

      {/* Tentacles */}
      {/* Left tentacles */}
      <rect x="4" y="20" width="6" height="2" fill={colors.skin} />
      <rect x="2" y="21" width="3" height="6" fill={colors.skin} />
      <rect x="1" y="26" width="2" height="3" fill={colors.skinLight} />
      <rect x="5" y="22" width="2" height="5" fill={colors.skin} />
      <rect x="4" y="26" width="2" height="3" fill={colors.skinLight} />

      {/* Right tentacles */}
      <rect x="22" y="20" width="6" height="2" fill={colors.skin} />
      <rect x="27" y="21" width="3" height="6" fill={colors.skin} />
      <rect x="29" y="26" width="2" height="3" fill={colors.skinLight} />
      <rect x="25" y="22" width="2" height="5" fill={colors.skin} />
      <rect x="26" y="26" width="2" height="3" fill={colors.skinLight} />

      {/* Bottom tentacles */}
      <rect x="10" y="23" width="3" height="6" fill={colors.skin} />
      <rect x="9" y="28" width="2" height="3" fill={colors.skinLight} />
      <rect x="13" y="24" width="2" height="5" fill={colors.skin} />
      <rect x="17" y="24" width="2" height="5" fill={colors.skin} />
      <rect x="19" y="23" width="3" height="6" fill={colors.skin} />
      <rect x="21" y="28" width="2" height="3" fill={colors.skinLight} />

      {/* Suckers on tentacles */}
      <rect x="10" y="25" width="1" height="1" fill={colors.accent} />
      <rect x="11" y="27" width="1" height="1" fill={colors.accent} />
      <rect x="20" y="25" width="1" height="1" fill={colors.accent} />
      <rect x="21" y="27" width="1" height="1" fill={colors.accent} />
    </>
  );

  // Energy Alien - Pure energy being
  const renderEnergy = () => (
    <>
      {/* Energy core glow (outer) */}
      <rect
        x="8"
        y="6"
        width="16"
        height="18"
        fill={colors.skinDark}
        opacity="0.5"
      />

      {/* Main energy form */}
      <rect x="10" y="8" width="12" height="14" fill={colors.skin} />
      <rect x="9" y="10" width="1" height="10" fill={colors.skin} />
      <rect x="22" y="10" width="1" height="10" fill={colors.skin} />
      <rect x="12" y="7" width="8" height="2" fill={colors.skin} />

      {/* Inner bright core */}
      <rect x="12" y="10" width="8" height="10" fill={colors.skinLight} />
      <rect x="14" y="12" width="4" height="6" fill="#ffffff" opacity="0.8" />

      {/* Eyes - pure white light */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="11" width="3" height="3" fill={colors.eyes} />
          <rect x="18" y="11" width="3" height="3" fill={colors.eyes} />
          <rect x="12" y="12" width="1" height="1" fill={colors.accent} />
          <rect x="19" y="12" width="1" height="1" fill={colors.accent} />
        </>
      ) : (
        <>
          <rect x="11" y="12" width="3" height="1" fill={colors.skinDark} />
          <rect x="18" y="12" width="3" height="1" fill={colors.skinDark} />
        </>
      )}

      {/* Energy mouth/expression */}
      <rect x="14" y="16" width="4" height="1" fill={colors.accent} />

      {/* Floating energy wisps - left */}
      <rect
        x="5"
        y="12"
        width="3"
        height="2"
        fill={colors.skin}
        opacity="0.7"
      />
      <rect
        x="3"
        y="14"
        width="2"
        height="3"
        fill={colors.skinLight}
        opacity="0.5"
      />
      <rect
        x="6"
        y="16"
        width="2"
        height="2"
        fill={colors.skin}
        opacity="0.6"
      />

      {/* Floating energy wisps - right */}
      <rect
        x="24"
        y="12"
        width="3"
        height="2"
        fill={colors.skin}
        opacity="0.7"
      />
      <rect
        x="27"
        y="14"
        width="2"
        height="3"
        fill={colors.skinLight}
        opacity="0.5"
      />
      <rect
        x="24"
        y="16"
        width="2"
        height="2"
        fill={colors.skin}
        opacity="0.6"
      />

      {/* Lower body energy trail */}
      <rect
        x="11"
        y="22"
        width="10"
        height="4"
        fill={colors.skin}
        opacity="0.8"
      />
      <rect
        x="12"
        y="26"
        width="8"
        height="3"
        fill={colors.skinLight}
        opacity="0.6"
      />
      <rect
        x="13"
        y="29"
        width="6"
        height="2"
        fill={colors.skin}
        opacity="0.4"
      />
      <rect
        x="14"
        y="31"
        width="4"
        height="1"
        fill={colors.skinLight}
        opacity="0.2"
      />

      {/* Spark particles */}
      <rect x="7" y="8" width="1" height="1" fill={colors.accent} />
      <rect x="24" y="9" width="1" height="1" fill={colors.accent} />
      <rect x="6" y="20" width="1" height="1" fill={colors.tech} />
      <rect x="25" y="18" width="1" height="1" fill={colors.tech} />
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case "grey":
        return renderGrey();
      case "reptilian":
        return renderReptilian();
      case "insectoid":
        return renderInsectoid();
      case "cephalopod":
        return renderCephalopod();
      case "energy":
        return renderEnergy();
      default:
        return renderGrey();
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

        {/* Mining state - tech scanning */}
        {state === "mining" && (
          <>
            <rect x="2" y="14" width="4" height="1" fill={colors.tech}>
              <animate
                attributeName="opacity"
                values="1;0.3;1"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </rect>
            <rect x="26" y="14" width="4" height="1" fill={colors.tech}>
              <animate
                attributeName="opacity"
                values="0.3;1;0.3"
                dur="0.5s"
                repeatCount="indefinite"
              />
            </rect>
          </>
        )}

        {/* Learning state - data stream */}
        {state === "learning" && (
          <>
            <rect
              x="2"
              y="4"
              width="3"
              height="2"
              fill={colors.accent}
              opacity="0.8"
            />
            <rect x="1" y="6" width="2" height="1" fill={colors.tech} />
          </>
        )}
      </svg>

      {/* Tech particles for thriving */}
      {state === "thriving" && (
        <>
          <div
            className="absolute w-1.5 h-1.5 rounded-sm animate-ping"
            style={{ top: "15%", left: "10%", backgroundColor: colors.accent }}
          />
          <div
            className="absolute w-1 h-1 rounded-sm animate-ping"
            style={{
              top: "20%",
              right: "15%",
              backgroundColor: colors.tech,
              animationDelay: "0.3s",
            }}
          />
        </>
      )}

      {/* Evolving sparkles */}
      {state === "evolving" && (
        <>
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{ top: "10%", left: "20%", backgroundColor: colors.accent }}
          />
          <div
            className="absolute w-2 h-2 rounded-full animate-ping"
            style={{
              top: "25%",
              right: "15%",
              backgroundColor: colors.tech,
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
            color: colors.accent,
          }}
        >
          Zzz
        </div>
      )}

      {/* Happy */}
      {state === "happy" && (
        <>
          <div
            className="absolute animate-bounce"
            style={{
              top: "-5%",
              left: "15%",
              fontSize: size / 10,
              color: colors.accent,
            }}
          >
            ✧
          </div>
          <div
            className="absolute animate-bounce"
            style={{
              top: "0%",
              right: "20%",
              fontSize: size / 12,
              color: colors.tech,
              animationDelay: "0.15s",
            }}
          >
            ✦
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
            backgroundColor: colors.skinDark,
          }}
        />
      )}
    </div>
  );
};

export default AlienSprite;
