/**
 * Construct Baby Sprite - MYSTICAL AUTOMATA DESIGN
 *
 * Seres construidos animados por magia ancestral.
 * En un mundo de realismo mágico, las "máquinas" son golems y autómatas místicos.
 *
 * Variantes:
 * - Golem: Criatura de piedra/arcilla animada con runas talladas
 * - Clockwork: Autómata steampunk de bronce con engranajes visibles
 * - Totem: Tótem de madera animado con rostros espirituales
 * - Forge: Guardián de la forja, obsidiana y fuego interior
 * - Vessel: Vasija de cerámica animada con espíritu interior
 *
 * +20% hashrate, -15% drops. Fuertes en luna nueva.
 */

import { type FC } from "react";
import { type BabyState, type ColorPalette } from "./types";

interface RobotSpriteProps {
  size?: number;
  state?: BabyState;
  dna?: string;
  colors?: Partial<ColorPalette>;
  className?: string;
}

type ConstructVariant = "golem" | "clockwork" | "totem" | "forge" | "vessel";

interface ConstructColors {
  body: string;
  bodyLight: string;
  bodyDark: string;
  accent: string;
  glow: string;
  detail: string;
}

// Color palettes for each variant
const CONSTRUCT_COLORS: Record<ConstructVariant, ConstructColors[]> = {
  golem: [
    // Stone gray
    {
      body: "#6b7280",
      bodyLight: "#9ca3af",
      bodyDark: "#4b5563",
      accent: "#22d3ee",
      glow: "#67e8f9",
      detail: "#374151",
    },
    // Red clay
    {
      body: "#a16207",
      bodyLight: "#ca8a04",
      bodyDark: "#78350f",
      accent: "#fbbf24",
      glow: "#fde68a",
      detail: "#92400e",
    },
    // Blue stone
    {
      body: "#475569",
      bodyLight: "#64748b",
      bodyDark: "#334155",
      accent: "#3b82f6",
      glow: "#93c5fd",
      detail: "#1e3a5f",
    },
    // Jade green
    {
      body: "#166534",
      bodyLight: "#22c55e",
      bodyDark: "#14532d",
      accent: "#4ade80",
      glow: "#bbf7d0",
      detail: "#15803d",
    },
    // Obsidian
    {
      body: "#1f2937",
      bodyLight: "#374151",
      bodyDark: "#111827",
      accent: "#a78bfa",
      glow: "#c4b5fd",
      detail: "#0f172a",
    },
  ],
  clockwork: [
    // Bronze
    {
      body: "#a16207",
      bodyLight: "#ca8a04",
      bodyDark: "#78350f",
      accent: "#fbbf24",
      glow: "#fef3c7",
      detail: "#92400e",
    },
    // Copper
    {
      body: "#c2410c",
      bodyLight: "#ea580c",
      bodyDark: "#9a3412",
      accent: "#fb923c",
      glow: "#fed7aa",
      detail: "#7c2d12",
    },
    // Brass
    {
      body: "#854d0e",
      bodyLight: "#a16207",
      bodyDark: "#713f12",
      accent: "#eab308",
      glow: "#fef08a",
      detail: "#78350f",
    },
    // Silver
    {
      body: "#6b7280",
      bodyLight: "#9ca3af",
      bodyDark: "#4b5563",
      accent: "#e5e7eb",
      glow: "#f3f4f6",
      detail: "#374151",
    },
    // Rust
    {
      body: "#78350f",
      bodyLight: "#a16207",
      bodyDark: "#451a03",
      accent: "#dc2626",
      glow: "#fca5a5",
      detail: "#7c2d12",
    },
  ],
  totem: [
    // Oak
    {
      body: "#78350f",
      bodyLight: "#a16207",
      bodyDark: "#451a03",
      accent: "#22c55e",
      glow: "#86efac",
      detail: "#92400e",
    },
    // Cedar red
    {
      body: "#7c2d12",
      bodyLight: "#9a3412",
      bodyDark: "#431407",
      accent: "#dc2626",
      glow: "#fca5a5",
      detail: "#b91c1c",
    },
    // Birch white
    {
      body: "#d6d3d1",
      bodyLight: "#e7e5e4",
      bodyDark: "#a8a29e",
      accent: "#1f2937",
      glow: "#6b7280",
      detail: "#78716c",
    },
    // Ebony
    {
      body: "#292524",
      bodyLight: "#44403c",
      bodyDark: "#1c1917",
      accent: "#fbbf24",
      glow: "#fde68a",
      detail: "#0c0a09",
    },
    // Painted
    {
      body: "#854d0e",
      bodyLight: "#a16207",
      bodyDark: "#713f12",
      accent: "#0ea5e9",
      glow: "#7dd3fc",
      detail: "#dc2626",
    },
  ],
  forge: [
    // Obsidian with fire
    {
      body: "#1c1917",
      bodyLight: "#292524",
      bodyDark: "#0c0a09",
      accent: "#f97316",
      glow: "#fb923c",
      detail: "#ea580c",
    },
    // Iron
    {
      body: "#374151",
      bodyLight: "#4b5563",
      bodyDark: "#1f2937",
      accent: "#ef4444",
      glow: "#fca5a5",
      detail: "#6b7280",
    },
    // Volcanic
    {
      body: "#292524",
      bodyLight: "#44403c",
      bodyDark: "#1c1917",
      accent: "#dc2626",
      glow: "#f87171",
      detail: "#7c2d12",
    },
    // Molten gold
    {
      body: "#1f2937",
      bodyLight: "#374151",
      bodyDark: "#111827",
      accent: "#fbbf24",
      glow: "#fde68a",
      detail: "#f59e0b",
    },
    // Ember
    {
      body: "#44403c",
      bodyLight: "#57534e",
      bodyDark: "#292524",
      accent: "#fb923c",
      glow: "#fed7aa",
      detail: "#ea580c",
    },
  ],
  vessel: [
    // Terracotta
    {
      body: "#c2410c",
      bodyLight: "#ea580c",
      bodyDark: "#9a3412",
      accent: "#0ea5e9",
      glow: "#7dd3fc",
      detail: "#1f2937",
    },
    // Porcelain
    {
      body: "#e7e5e4",
      bodyLight: "#fafaf9",
      bodyDark: "#d6d3d1",
      accent: "#3b82f6",
      glow: "#93c5fd",
      detail: "#1e40af",
    },
    // Jade ceramic
    {
      body: "#166534",
      bodyLight: "#22c55e",
      bodyDark: "#14532d",
      accent: "#fbbf24",
      glow: "#fde68a",
      detail: "#15803d",
    },
    // Black pottery
    {
      body: "#1c1917",
      bodyLight: "#292524",
      bodyDark: "#0c0a09",
      accent: "#f472b6",
      glow: "#f9a8d4",
      detail: "#44403c",
    },
    // Blue and white
    {
      body: "#f8fafc",
      bodyLight: "#ffffff",
      bodyDark: "#e2e8f0",
      accent: "#1d4ed8",
      glow: "#60a5fa",
      detail: "#1e40af",
    },
  ],
};

const getVariant = (dna: string): ConstructVariant => {
  const variants: ConstructVariant[] = [
    "golem",
    "clockwork",
    "totem",
    "forge",
    "vessel",
  ];
  return variants[parseInt(dna[0] || "0", 16) % 5];
};

const getColors = (variant: ConstructVariant, dna: string): ConstructColors => {
  const idx = parseInt(dna[1] || "0", 16) % 5;
  return CONSTRUCT_COLORS[variant][idx];
};

export const RobotSprite: FC<RobotSpriteProps> = ({
  size = 64,
  state = "idle",
  dna = "0000000000",
  className = "",
}) => {
  const variant = getVariant(dna);
  const c = getColors(variant, dna);

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

  // Glow color based on state
  const activeGlow =
    state === "mining"
      ? "#f7931a"
      : state === "thriving"
        ? "#22c55e"
        : state === "struggling"
          ? "#ef4444"
          : c.glow;

  // Render Stone Golem
  const renderGolem = () => (
    <>
      {/* ===== HEAD - ROUGH STONE ===== */}
      <rect x="9" y="4" width="14" height="12" fill={c.body} />
      <rect x="8" y="6" width="1" height="8" fill={c.bodyDark} />
      <rect x="23" y="6" width="1" height="8" fill={c.bodyDark} />
      {/* Stone texture - cracks */}
      <rect
        x="10"
        y="5"
        width="12"
        height="1"
        fill={c.bodyLight}
        opacity="0.5"
      />
      <rect x="11" y="7" width="1" height="3" fill={c.bodyDark} opacity="0.4" />
      <rect x="19" y="8" width="1" height="4" fill={c.bodyDark} opacity="0.4" />
      <rect
        x="14"
        y="12"
        width="4"
        height="1"
        fill={c.bodyDark}
        opacity="0.3"
      />

      {/* ===== CARVED RUNES ON FOREHEAD ===== */}
      <rect x="14" y="5" width="4" height="2" fill={c.accent} opacity="0.8" />
      <rect x="15" y="5" width="2" height="1" fill={activeGlow} />
      {state === "mining" && (
        <rect
          x="14"
          y="5"
          width="4"
          height="2"
          fill={activeGlow}
          className="animate-pulse"
          opacity="0.6"
        />
      )}

      {/* ===== GLOWING EYES ===== */}
      {state !== "sleeping" ? (
        <>
          {/* Eye sockets */}
          <rect x="11" y="8" width="4" height="3" fill={c.bodyDark} />
          <rect x="17" y="8" width="4" height="3" fill={c.bodyDark} />
          {/* Glowing cores */}
          <rect x="12" y="9" width="2" height="2" fill={c.accent} />
          <rect x="18" y="9" width="2" height="2" fill={c.accent} />
          <rect x="12" y="9" width="1" height="1" fill={activeGlow} />
          <rect x="18" y="9" width="1" height="1" fill={activeGlow} />
        </>
      ) : (
        <>
          <rect x="11" y="9" width="4" height="1" fill={c.bodyDark} />
          <rect x="17" y="9" width="4" height="1" fill={c.bodyDark} />
        </>
      )}

      {/* ===== MOUTH - CARVED LINE ===== */}
      <rect x="13" y="13" width="6" height="1" fill={c.bodyDark} />
      <rect x="14" y="13" width="4" height="1" fill={c.detail} />

      {/* ===== MASSIVE BODY ===== */}
      <rect x="7" y="16" width="18" height="12" fill={c.body} />
      <rect x="6" y="18" width="1" height="8" fill={c.bodyDark} />
      <rect x="25" y="18" width="1" height="8" fill={c.bodyDark} />
      {/* Body cracks/texture */}
      <rect
        x="8"
        y="17"
        width="16"
        height="1"
        fill={c.bodyLight}
        opacity="0.4"
      />
      <rect
        x="10"
        y="20"
        width="1"
        height="4"
        fill={c.bodyDark}
        opacity="0.3"
      />
      <rect
        x="20"
        y="19"
        width="1"
        height="5"
        fill={c.bodyDark}
        opacity="0.3"
      />

      {/* ===== RUNE CORE IN CHEST ===== */}
      <rect x="12" y="19" width="8" height="6" fill={c.bodyDark} />
      <rect x="13" y="20" width="6" height="4" fill={c.detail} />
      {/* Central rune */}
      <rect x="14" y="21" width="4" height="2" fill={c.accent} />
      <rect x="15" y="21" width="2" height="2" fill={activeGlow} />
      {/* Bitcoin rune symbol */}
      <rect x="15" y="21" width="1" height="2" fill="#f7931a" />
      <rect x="16" y="21" width="1" height="1" fill="#f7931a" />

      {/* ===== THICK ARMS ===== */}
      <rect x="3" y="17" width="4" height="4" fill={c.body} />
      <rect x="4" y="21" width="3" height="6" fill={c.bodyLight} />
      <rect x="3" y="27" width="4" height="3" fill={c.body} />
      {/* Arm runes */}
      <rect x="5" y="22" width="1" height="2" fill={c.accent} opacity="0.6" />

      <rect x="25" y="17" width="4" height="4" fill={c.body} />
      <rect x="25" y="21" width="3" height="6" fill={c.bodyLight} />
      <rect x="25" y="27" width="4" height="3" fill={c.body} />
      <rect x="26" y="22" width="1" height="2" fill={c.accent} opacity="0.6" />

      {/* ===== PILLAR LEGS ===== */}
      <rect x="9" y="28" width="5" height="4" fill={c.bodyDark} />
      <rect x="18" y="28" width="5" height="4" fill={c.bodyDark} />
      {/* Moss/earth */}
      <rect x="9" y="30" width="2" height="1" fill="#22c55e" opacity="0.4" />
      <rect x="21" y="31" width="2" height="1" fill="#22c55e" opacity="0.4" />
    </>
  );

  // Render Clockwork Automaton
  const renderClockwork = () => (
    <>
      {/* ===== HEAD - DOME SHAPE ===== */}
      <rect x="10" y="4" width="12" height="11" fill={c.body} />
      <rect x="9" y="6" width="1" height="7" fill={c.bodyDark} />
      <rect x="22" y="6" width="1" height="7" fill={c.bodyDark} />
      {/* Dome top */}
      <rect x="11" y="3" width="10" height="2" fill={c.bodyLight} />
      <rect x="12" y="2" width="8" height="1" fill={c.body} />

      {/* ===== WIND-UP KEY ===== */}
      <rect x="15" y="0" width="2" height="3" fill={c.bodyDark} />
      <rect x="13" y="0" width="6" height="1" fill={c.accent} />
      <rect x="14" y="0" width="1" height="2" fill={c.glow} opacity="0.5" />
      <rect x="17" y="0" width="1" height="2" fill={c.glow} opacity="0.5" />

      {/* ===== VISIBLE GEARS ON HEAD ===== */}
      <rect x="11" y="5" width="3" height="3" fill={c.bodyDark} />
      <rect x="12" y="6" width="1" height="1" fill={c.accent} />
      <rect x="18" y="5" width="3" height="3" fill={c.bodyDark} />
      <rect x="19" y="6" width="1" height="1" fill={c.accent} />

      {/* ===== EYES - CLOCK FACES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="9" width="4" height="4" fill={c.glow} />
          <rect x="17" y="9" width="4" height="4" fill={c.glow} />
          {/* Clock hands */}
          <rect x="12" y="10" width="2" height="1" fill={c.bodyDark} />
          <rect x="13" y="10" width="1" height="2" fill={c.bodyDark} />
          <rect x="18" y="10" width="2" height="1" fill={c.bodyDark} />
          <rect x="19" y="10" width="1" height="2" fill={c.bodyDark} />
          {/* Center pins */}
          <rect x="13" y="11" width="1" height="1" fill={c.accent} />
          <rect x="19" y="11" width="1" height="1" fill={c.accent} />
        </>
      ) : (
        <>
          <rect x="11" y="10" width="4" height="1" fill={c.bodyDark} />
          <rect x="17" y="10" width="4" height="1" fill={c.bodyDark} />
        </>
      )}

      {/* ===== MOUTH - VENT SLITS ===== */}
      <rect x="12" y="14" width="8" height="1" fill={c.bodyDark} />
      <rect x="13" y="14" width="2" height="1" fill={c.glow} opacity="0.3" />
      <rect x="17" y="14" width="2" height="1" fill={c.glow} opacity="0.3" />

      {/* ===== BODY - GEAR BOX ===== */}
      <rect x="9" y="15" width="14" height="12" fill={c.body} />
      <rect x="8" y="17" width="1" height="8" fill={c.bodyDark} />
      <rect x="23" y="17" width="1" height="8" fill={c.bodyDark} />

      {/* ===== VISIBLE GEARS IN CHEST ===== */}
      <rect x="11" y="17" width="10" height="8" fill={c.bodyDark} />
      {/* Large gear */}
      <rect x="13" y="18" width="6" height="6" fill={c.bodyLight} />
      <rect x="14" y="19" width="4" height="4" fill={c.body} />
      <rect x="15" y="20" width="2" height="2" fill={c.accent} />
      {/* Gear teeth */}
      <rect x="12" y="20" width="1" height="2" fill={c.bodyLight} />
      <rect x="19" y="20" width="1" height="2" fill={c.bodyLight} />
      <rect x="15" y="17" width="2" height="1" fill={c.bodyLight} />
      <rect x="15" y="24" width="2" height="1" fill={c.bodyLight} />
      {/* Bitcoin gear center */}
      <rect x="15" y="20" width="2" height="1" fill="#f7931a" />

      {/* ===== SPRING ARMS ===== */}
      <rect x="5" y="16" width="3" height="3" fill={c.bodyLight} />
      {/* Spring coil */}
      <rect x="5" y="19" width="2" height="1" fill={c.body} />
      <rect x="6" y="20" width="2" height="1" fill={c.bodyLight} />
      <rect x="5" y="21" width="2" height="1" fill={c.body} />
      <rect x="6" y="22" width="2" height="1" fill={c.bodyLight} />
      <rect x="5" y="23" width="2" height="1" fill={c.body} />
      {/* Hand */}
      <rect x="4" y="24" width="4" height="3" fill={c.bodyLight} />
      <rect x="4" y="27" width="1" height="1" fill={c.body} />
      <rect x="6" y="27" width="1" height="1" fill={c.body} />

      <rect x="24" y="16" width="3" height="3" fill={c.bodyLight} />
      <rect x="25" y="19" width="2" height="1" fill={c.body} />
      <rect x="24" y="20" width="2" height="1" fill={c.bodyLight} />
      <rect x="25" y="21" width="2" height="1" fill={c.body} />
      <rect x="24" y="22" width="2" height="1" fill={c.bodyLight} />
      <rect x="25" y="23" width="2" height="1" fill={c.body} />
      <rect x="24" y="24" width="4" height="3" fill={c.bodyLight} />
      <rect x="25" y="27" width="1" height="1" fill={c.body} />
      <rect x="27" y="27" width="1" height="1" fill={c.body} />

      {/* ===== LEGS - PISTON STYLE ===== */}
      <rect x="10" y="27" width="4" height="2" fill={c.bodyLight} />
      <rect x="18" y="27" width="4" height="2" fill={c.bodyLight} />
      <rect x="11" y="29" width="3" height="3" fill={c.body} />
      <rect x="18" y="29" width="3" height="3" fill={c.body} />
      {/* Rivets */}
      <rect x="12" y="30" width="1" height="1" fill={c.accent} />
      <rect x="19" y="30" width="1" height="1" fill={c.accent} />
    </>
  );

  // Render Animated Totem
  const renderTotem = () => (
    <>
      {/* ===== TOP FACE - EAGLE/BIRD ===== */}
      <rect x="11" y="2" width="10" height="8" fill={c.body} />
      <rect x="10" y="3" width="1" height="6" fill={c.bodyDark} />
      <rect x="21" y="3" width="1" height="6" fill={c.bodyDark} />
      {/* Carved feathers */}
      <rect x="8" y="3" width="3" height="2" fill={c.bodyLight} />
      <rect x="21" y="3" width="3" height="2" fill={c.bodyLight} />
      <rect x="7" y="4" width="2" height="1" fill={c.accent} />
      <rect x="23" y="4" width="2" height="1" fill={c.accent} />
      {/* Beak */}
      <rect x="14" y="7" width="4" height="3" fill={c.detail} />
      <rect x="15" y="8" width="2" height="1" fill={c.bodyDark} />

      {/* ===== SPIRIT EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="4" width="3" height="2" fill={c.bodyDark} />
          <rect x="17" y="4" width="3" height="2" fill={c.bodyDark} />
          <rect x="13" y="4" width="2" height="2" fill={c.accent} />
          <rect x="17" y="4" width="2" height="2" fill={c.accent} />
          <rect x="13" y="4" width="1" height="1" fill={activeGlow} />
          <rect x="18" y="4" width="1" height="1" fill={activeGlow} />
        </>
      ) : (
        <>
          <rect x="12" y="5" width="3" height="1" fill={c.bodyDark} />
          <rect x="17" y="5" width="3" height="1" fill={c.bodyDark} />
        </>
      )}

      {/* ===== MIDDLE FACE - BEAR/MAIN ===== */}
      <rect x="10" y="10" width="12" height="10" fill={c.bodyLight} />
      <rect x="9" y="11" width="1" height="8" fill={c.body} />
      <rect x="22" y="11" width="1" height="8" fill={c.body} />
      {/* Carved ears */}
      <rect x="8" y="11" width="2" height="3" fill={c.body} />
      <rect x="22" y="11" width="2" height="3" fill={c.body} />

      {/* ===== MAIN FACE CARVING ===== */}
      {/* Big eyes */}
      <rect x="11" y="12" width="4" height="3" fill={c.bodyDark} />
      <rect x="17" y="12" width="4" height="3" fill={c.bodyDark} />
      <rect x="12" y="12" width="2" height="2" fill={c.accent} />
      <rect x="18" y="12" width="2" height="2" fill={c.accent} />
      <rect x="12" y="12" width="1" height="1" fill={activeGlow} />
      <rect x="19" y="12" width="1" height="1" fill={activeGlow} />
      {/* Nose */}
      <rect x="15" y="14" width="2" height="2" fill={c.body} />
      {/* Mouth with teeth */}
      <rect x="12" y="17" width="8" height="2" fill={c.bodyDark} />
      <rect x="13" y="17" width="2" height="1" fill={c.glow} />
      <rect x="17" y="17" width="2" height="1" fill={c.glow} />

      {/* ===== LOWER SECTION - FISH/WHALE ===== */}
      <rect x="10" y="20" width="12" height="8" fill={c.body} />
      <rect x="9" y="21" width="1" height="6" fill={c.bodyDark} />
      <rect x="22" y="21" width="1" height="6" fill={c.bodyDark} />
      {/* Wings/fins */}
      <rect x="6" y="22" width="4" height="4" fill={c.bodyLight} />
      <rect x="22" y="22" width="4" height="4" fill={c.bodyLight} />
      {/* Carved patterns */}
      <rect x="12" y="21" width="8" height="1" fill={c.detail} />
      <rect x="13" y="23" width="2" height="2" fill={c.accent} />
      <rect x="17" y="23" width="2" height="2" fill={c.accent} />
      {/* Bitcoin symbol carving */}
      <rect x="15" y="24" width="2" height="3" fill="#f7931a" />
      <rect x="14" y="25" width="1" height="1" fill="#f7931a" />

      {/* ===== BASE ===== */}
      <rect x="9" y="28" width="14" height="4" fill={c.bodyDark} />
      <rect x="11" y="29" width="10" height="2" fill={c.body} />
      {/* Carved base pattern */}
      <rect x="12" y="30" width="8" height="1" fill={c.detail} />
    </>
  );

  // Render Forge Guardian
  const renderForge = () => (
    <>
      {/* ===== HEAD - VOLCANIC ROCK ===== */}
      <rect x="9" y="4" width="14" height="12" fill={c.body} />
      <rect x="8" y="6" width="1" height="8" fill={c.bodyDark} />
      <rect x="23" y="6" width="1" height="8" fill={c.bodyDark} />
      {/* Lava cracks */}
      <rect x="10" y="5" width="1" height="3" fill={c.accent} opacity="0.7" />
      <rect x="11" y="7" width="1" height="2" fill={c.glow} opacity="0.5" />
      <rect x="20" y="6" width="1" height="4" fill={c.accent} opacity="0.7" />
      <rect x="21" y="9" width="1" height="2" fill={c.glow} opacity="0.5" />

      {/* ===== MOLTEN EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="11" y="8" width="4" height="4" fill={c.bodyDark} />
          <rect x="17" y="8" width="4" height="4" fill={c.bodyDark} />
          {/* Molten core */}
          <rect x="12" y="9" width="2" height="2" fill={c.accent} />
          <rect x="18" y="9" width="2" height="2" fill={c.accent} />
          <rect x="12" y="9" width="1" height="1" fill={activeGlow} />
          <rect x="19" y="9" width="1" height="1" fill={activeGlow} />
          {/* Fire flicker */}
          {state === "mining" && (
            <>
              <rect
                x="11"
                y="7"
                width="1"
                height="1"
                fill={activeGlow}
                className="animate-pulse"
              />
              <rect
                x="20"
                y="7"
                width="1"
                height="1"
                fill={activeGlow}
                className="animate-pulse"
              />
            </>
          )}
        </>
      ) : (
        <>
          <rect x="11" y="9" width="4" height="2" fill={c.bodyDark} />
          <rect x="17" y="9" width="4" height="2" fill={c.bodyDark} />
          <rect
            x="12"
            y="10"
            width="2"
            height="1"
            fill={c.accent}
            opacity="0.3"
          />
          <rect
            x="18"
            y="10"
            width="2"
            height="1"
            fill={c.accent}
            opacity="0.3"
          />
        </>
      )}

      {/* ===== MOUTH - FORGE OPENING ===== */}
      <rect x="12" y="13" width="8" height="2" fill={c.bodyDark} />
      <rect x="13" y="13" width="6" height="1" fill={c.accent} />
      <rect x="14" y="13" width="4" height="1" fill={c.glow} />

      {/* ===== MASSIVE BODY ===== */}
      <rect x="6" y="16" width="20" height="12" fill={c.body} />
      <rect x="5" y="18" width="1" height="8" fill={c.bodyDark} />
      <rect x="26" y="18" width="1" height="8" fill={c.bodyDark} />
      {/* More lava cracks */}
      <rect x="8" y="18" width="1" height="5" fill={c.accent} opacity="0.6" />
      <rect x="23" y="17" width="1" height="6" fill={c.accent} opacity="0.6" />
      <rect x="15" y="26" width="2" height="2" fill={c.accent} opacity="0.5" />

      {/* ===== FORGE CORE ===== */}
      <rect x="11" y="18" width="10" height="8" fill={c.bodyDark} />
      <rect x="12" y="19" width="8" height="6" fill={c.detail} />
      {/* Molten core */}
      <rect x="13" y="20" width="6" height="4" fill={c.accent} />
      <rect x="14" y="21" width="4" height="2" fill={c.glow} />
      {/* Bitcoin in fire */}
      <rect x="15" y="21" width="2" height="2" fill="#f7931a" />
      {state === "mining" && (
        <rect
          x="13"
          y="20"
          width="6"
          height="4"
          fill={activeGlow}
          className="animate-pulse"
          opacity="0.4"
        />
      )}

      {/* ===== OBSIDIAN ARMS ===== */}
      <rect x="2" y="17" width="4" height="4" fill={c.bodyLight} />
      <rect x="3" y="21" width="3" height="6" fill={c.body} />
      <rect x="2" y="27" width="4" height="3" fill={c.bodyLight} />
      {/* Lava veins */}
      <rect x="4" y="22" width="1" height="3" fill={c.accent} opacity="0.5" />

      <rect x="26" y="17" width="4" height="4" fill={c.bodyLight} />
      <rect x="26" y="21" width="3" height="6" fill={c.body} />
      <rect x="26" y="27" width="4" height="3" fill={c.bodyLight} />
      <rect x="27" y="22" width="1" height="3" fill={c.accent} opacity="0.5" />

      {/* ===== HEAVY LEGS ===== */}
      <rect x="8" y="28" width="6" height="4" fill={c.bodyLight} />
      <rect x="18" y="28" width="6" height="4" fill={c.bodyLight} />
      {/* Molten footprints */}
      <rect x="9" y="31" width="4" height="1" fill={c.accent} opacity="0.3" />
      <rect x="19" y="31" width="4" height="1" fill={c.accent} opacity="0.3" />
    </>
  );

  // Render Spirit Vessel
  const renderVessel = () => (
    <>
      {/* ===== HEAD - POT/URN SHAPE ===== */}
      <rect x="11" y="3" width="10" height="3" fill={c.body} />
      <rect x="10" y="6" width="12" height="10" fill={c.bodyLight} />
      <rect x="9" y="8" width="1" height="6" fill={c.body} />
      <rect x="22" y="8" width="1" height="6" fill={c.body} />
      {/* Lid */}
      <rect x="12" y="2" width="8" height="2" fill={c.bodyDark} />
      <rect x="14" y="1" width="4" height="1" fill={c.body} />
      {/* Spirit escaping from top */}
      <rect x="15" y="0" width="2" height="1" fill={c.glow} opacity="0.6" />

      {/* ===== PAINTED DECORATIONS ===== */}
      <rect x="11" y="6" width="10" height="1" fill={c.detail} />
      <rect x="11" y="8" width="10" height="1" fill={c.accent} opacity="0.6" />
      <rect x="11" y="14" width="10" height="1" fill={c.detail} />
      {/* Wave pattern */}
      <rect x="12" y="10" width="2" height="1" fill={c.accent} />
      <rect x="14" y="11" width="2" height="1" fill={c.accent} />
      <rect x="16" y="10" width="2" height="1" fill={c.accent} />
      <rect x="18" y="11" width="2" height="1" fill={c.accent} />

      {/* ===== SPIRIT EYES ===== */}
      {state !== "sleeping" ? (
        <>
          <rect x="12" y="9" width="3" height="2" fill={c.accent} />
          <rect x="17" y="9" width="3" height="2" fill={c.accent} />
          <rect x="13" y="9" width="1" height="1" fill={activeGlow} />
          <rect x="18" y="9" width="1" height="1" fill={activeGlow} />
        </>
      ) : (
        <>
          <rect x="12" y="10" width="3" height="1" fill={c.detail} />
          <rect x="17" y="10" width="3" height="1" fill={c.detail} />
        </>
      )}

      {/* ===== MOUTH - PAINTED ===== */}
      <rect x="14" y="12" width="4" height="1" fill={c.detail} />

      {/* ===== BODY - LARGE POT ===== */}
      <rect x="8" y="16" width="16" height="10" fill={c.bodyLight} />
      <rect x="9" y="15" width="14" height="1" fill={c.body} />
      <rect x="7" y="18" width="1" height="6" fill={c.body} />
      <rect x="24" y="18" width="1" height="6" fill={c.body} />
      {/* Pot belly curve */}
      <rect x="6" y="19" width="1" height="4" fill={c.bodyLight} />
      <rect x="25" y="19" width="1" height="4" fill={c.bodyLight} />

      {/* ===== PAINTED PATTERNS ON BODY ===== */}
      <rect x="9" y="17" width="14" height="1" fill={c.detail} />
      <rect x="9" y="24" width="14" height="1" fill={c.detail} />
      {/* Central symbol */}
      <rect x="12" y="19" width="8" height="4" fill={c.accent} opacity="0.3" />
      <rect x="14" y="20" width="4" height="2" fill={c.accent} />
      <rect x="15" y="20" width="2" height="2" fill={activeGlow} />
      {/* Bitcoin symbol */}
      <rect x="15" y="20" width="1" height="2" fill="#f7931a" />

      {/* ===== HANDLES/ARMS ===== */}
      <rect x="4" y="17" width="3" height="2" fill={c.body} />
      <rect x="4" y="19" width="2" height="4" fill={c.bodyLight} />
      <rect x="3" y="23" width="3" height="3" fill={c.body} />
      {/* Painted handle */}
      <rect x="4" y="20" width="1" height="2" fill={c.accent} opacity="0.5" />

      <rect x="25" y="17" width="3" height="2" fill={c.body} />
      <rect x="26" y="19" width="2" height="4" fill={c.bodyLight} />
      <rect x="26" y="23" width="3" height="3" fill={c.body} />
      <rect x="27" y="20" width="1" height="2" fill={c.accent} opacity="0.5" />

      {/* ===== BASE/FEET ===== */}
      <rect x="9" y="26" width="14" height="2" fill={c.body} />
      <rect x="11" y="28" width="4" height="3" fill={c.bodyDark} />
      <rect x="17" y="28" width="4" height="3" fill={c.bodyDark} />
      {/* Painted feet */}
      <rect x="12" y="29" width="2" height="1" fill={c.accent} opacity="0.4" />
      <rect x="18" y="29" width="2" height="1" fill={c.accent} opacity="0.4" />

      {/* ===== SPIRIT PARTICLES ===== */}
      {(state === "thriving" || state === "mining") && (
        <>
          <rect x="7" y="10" width="1" height="1" fill={c.glow} opacity="0.5" />
          <rect x="24" y="8" width="1" height="1" fill={c.glow} opacity="0.4" />
          <rect x="5" y="16" width="1" height="1" fill={c.glow} opacity="0.3" />
          <rect
            x="26"
            y="14"
            width="1"
            height="1"
            fill={c.glow}
            opacity="0.4"
          />
        </>
      )}
    </>
  );

  const renderVariant = () => {
    switch (variant) {
      case "golem":
        return renderGolem();
      case "clockwork":
        return renderClockwork();
      case "totem":
        return renderTotem();
      case "forge":
        return renderForge();
      case "vessel":
        return renderVessel();
      default:
        return renderGolem();
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
      </svg>

      {/* ===== STATE EFFECTS ===== */}
      {state === "mining" && (
        <div
          className="absolute w-1 h-1 rounded-full animate-ping"
          style={{ top: "15%", right: "10%", backgroundColor: activeGlow }}
        />
      )}

      {state === "thriving" && (
        <div
          className="absolute inset-0 rounded animate-pulse"
          style={{
            boxShadow: `0 0 ${size / 4}px ${c.glow}`,
            opacity: 0.4,
          }}
        />
      )}

      {state === "sleeping" && (
        <div
          className="absolute font-pixel text-gray-400"
          style={{ top: "-10%", right: "5%", fontSize: size / 10 }}
        >
          ...
        </div>
      )}

      {state === "happy" && (
        <div
          className="absolute w-1 h-1 rounded-full animate-bounce"
          style={{ top: "5%", left: "20%", backgroundColor: c.accent }}
        />
      )}
    </div>
  );
};

export default RobotSprite;
