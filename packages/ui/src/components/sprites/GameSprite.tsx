/**
 * Unified Game Sprite Component
 *
 * Renders any evolution stage of the BitcoinBaby character.
 * Supports 8 visual forms with 3 variants each.
 */

import { type FC } from "react";
import { PixelIcon } from "./PixelIcon";

export type SpriteForm =
  | "egg"
  | "baby"
  | "child"
  | "teen"
  | "young"
  | "adult"
  | "master"
  | "legend";
export type SpriteState =
  | "idle"
  | "happy"
  | "sleeping"
  | "hungry"
  | "mining"
  | "learning"
  | "evolving"
  | "critical";

interface GameSpriteProps {
  form: SpriteForm;
  variant?: 1 | 2 | 3;
  state?: SpriteState;
  size?: number;
  className?: string;
}

// Color palettes that evolve with the character
const PALETTES: Record<
  SpriteForm,
  { primary: string; secondary: string; accent: string }
> = {
  egg: { primary: "#9ca3af", secondary: "#f7931a", accent: "#4fc3f7" },
  baby: { primary: "#f7931a", secondary: "#ffc107", accent: "#4fc3f7" },
  child: { primary: "#f7931a", secondary: "#fb923c", accent: "#22d3ee" },
  teen: { primary: "#ea580c", secondary: "#f97316", accent: "#06b6d4" },
  young: { primary: "#dc2626", secondary: "#f43f5e", accent: "#8b5cf6" },
  adult: { primary: "#9333ea", secondary: "#a855f7", accent: "#fbbf24" },
  master: { primary: "#1d4ed8", secondary: "#3b82f6", accent: "#fbbf24" },
  legend: { primary: "#fbbf24", secondary: "#fcd34d", accent: "#ffffff" },
};

// Size multipliers per form
const SIZE_MULTIPLIERS: Record<SpriteForm, number> = {
  egg: 0.75,
  baby: 1.0,
  child: 1.1,
  teen: 1.2,
  young: 1.3,
  adult: 1.4,
  master: 1.5,
  legend: 1.6,
};

export const GameSprite: FC<GameSpriteProps> = ({
  form,
  variant = 1,
  state = "idle",
  size = 192,
  className = "",
}) => {
  const palette = PALETTES[form];
  const scale = SIZE_MULTIPLIERS[form];
  const scaledSize = size * scale;

  const stateClasses: Record<SpriteState, string> = {
    idle: "animate-pixel-float",
    happy: "animate-bounce",
    sleeping: "baby-sleeping",
    hungry: "animate-pixel-shake",
    mining: "animate-pixel-glow",
    learning: "",
    evolving: "baby-evolving",
    critical: "animate-pixel-shake",
  };

  // Render appropriate form
  switch (form) {
    case "egg":
      return (
        <EggSprite
          size={scaledSize}
          state={state}
          palette={palette}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "baby":
      return (
        <BabyFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "child":
      return (
        <ChildFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "teen":
      return (
        <TeenFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "young":
      return (
        <YoungFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "adult":
      return (
        <AdultFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "master":
      return (
        <MasterFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={variant}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    case "legend":
      return (
        <LegendFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          className={`${stateClasses[state]} ${className}`}
        />
      );
    default:
      return (
        <BabyFormSprite
          size={scaledSize}
          state={state}
          palette={palette}
          variant={1}
          className={`${stateClasses[state]} ${className}`}
        />
      );
  }
};

// ============================================
// INDIVIDUAL FORM SPRITES
// ============================================

interface FormSpriteProps {
  size: number;
  state: SpriteState;
  palette: { primary: string; secondary: string; accent: string };
  variant?: 1 | 2 | 3;
  className?: string;
}

// Egg Form
const EggSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Egg shell */}
      <ellipse cx="8" cy="9" rx="5" ry="6" fill={palette.primary} />
      <ellipse cx="8" cy="8" rx="4" ry="5" fill="#d1d5db" />

      {/* Circuit pattern */}
      <rect
        x="6"
        y="6"
        width="1"
        height="3"
        fill={palette.secondary}
        opacity="0.7"
      />
      <rect
        x="9"
        y="7"
        width="1"
        height="2"
        fill={palette.secondary}
        opacity="0.7"
      />
      <rect
        x="7"
        y="10"
        width="2"
        height="1"
        fill={palette.secondary}
        opacity="0.7"
      />

      {/* Crack if hatching */}
      {state === "evolving" && (
        <>
          <rect x="7" y="4" width="1" height="2" fill="#1f2937" />
          <rect x="8" y="5" width="1" height="2" fill="#1f2937" />
          <rect x="6" y="6" width="1" height="1" fill="#1f2937" />
        </>
      )}
    </svg>

    {state === "evolving" && (
      <PixelIcon
        name="sparkle"
        size={20}
        className="absolute top-0 left-1/2 -translate-x-1/2 animate-bounce text-pixel-primary"
      />
    )}
  </div>
);

// Baby Form (Level 1-3)
const BabyFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Antenna */}
      <rect x="7" y="0" width="2" height="2" fill={palette.accent} />

      {/* Head */}
      <rect x="4" y="2" width="8" height="6" fill={palette.secondary} />
      <rect x="3" y="3" width="1" height="4" fill={palette.secondary} />
      <rect x="12" y="3" width="1" height="4" fill={palette.secondary} />

      {/* Brain glow - increases with variant */}
      <rect
        x="5"
        y="3"
        width="6"
        height="3"
        fill={palette.accent}
        opacity={0.3 + variant * 0.1}
      />

      {/* Eyes */}
      {state !== "sleeping" ? (
        <>
          <rect x="5" y="5" width="2" height="2" fill="#1f2937" />
          <rect x="9" y="5" width="2" height="2" fill="#1f2937" />
          <rect x="5" y="5" width="1" height="1" fill="#ffffff" />
          <rect x="9" y="5" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="5" y="6" width="2" height="1" fill="#1f2937" />
          <rect x="9" y="6" width="2" height="1" fill="#1f2937" />
        </>
      )}

      {/* Mouth */}
      <rect x="7" y="7" width="2" height="1" fill="#1f2937" />

      {/* Body */}
      <rect x="5" y="8" width="6" height="5" fill={palette.primary} />
      <rect x="4" y="9" width="1" height="3" fill={palette.primary} />
      <rect x="11" y="9" width="1" height="3" fill={palette.primary} />

      {/* Bitcoin B */}
      <rect x="7" y="9" width="2" height="3" fill="#1f2937" />
      <rect x="6" y="10" width="1" height="1" fill="#1f2937" />
      <rect x="9" y="10" width="1" height="1" fill="#1f2937" />

      {/* Feet */}
      <rect x="5" y="13" width="2" height="1" fill="#e67e00" />
      <rect x="9" y="13" width="2" height="1" fill="#e67e00" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Child Form (Level 4-6) - Slightly bigger, more features
const ChildFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant: _variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Antenna with spark */}
      <rect x="8" y="0" width="2" height="3" fill={palette.accent} />
      <rect x="9" y="0" width="1" height="1" fill="#ffffff" />

      {/* Head - rounder */}
      <rect x="4" y="3" width="10" height="6" fill={palette.secondary} />
      <rect x="3" y="4" width="1" height="4" fill={palette.secondary} />
      <rect x="14" y="4" width="1" height="4" fill={palette.secondary} />

      {/* Eyes - bigger */}
      {state !== "sleeping" ? (
        <>
          <rect x="5" y="5" width="3" height="3" fill="#1f2937" />
          <rect x="10" y="5" width="3" height="3" fill="#1f2937" />
          <rect x="5" y="5" width="1" height="1" fill="#ffffff" />
          <rect x="10" y="5" width="1" height="1" fill="#ffffff" />
        </>
      ) : (
        <>
          <rect x="5" y="7" width="3" height="1" fill="#1f2937" />
          <rect x="10" y="7" width="3" height="1" fill="#1f2937" />
        </>
      )}

      {/* Smile */}
      <rect x="7" y="8" width="4" height="1" fill="#1f2937" />

      {/* Body */}
      <rect x="5" y="9" width="8" height="6" fill={palette.primary} />

      {/* Arms */}
      <rect x="3" y="10" width="2" height="3" fill={palette.primary} />
      <rect x="13" y="10" width="2" height="3" fill={palette.primary} />

      {/* Bitcoin symbol */}
      <rect x="8" y="10" width="2" height="4" fill="#1f2937" />
      <rect x="7" y="11" width="1" height="2" fill="#1f2937" />
      <rect x="10" y="11" width="1" height="2" fill="#1f2937" />

      {/* Feet */}
      <rect x="6" y="15" width="2" height="2" fill="#92400e" />
      <rect x="10" y="15" width="2" height="2" fill="#92400e" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Teen Form (Level 7-9) - With hoodie
const TeenFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant: _variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Antenna */}
      <rect x="9" y="0" width="2" height="2" fill={palette.accent} />

      {/* Hood */}
      <rect x="4" y="2" width="12" height="3" fill="#4338ca" />

      {/* Head */}
      <rect x="5" y="3" width="10" height="7" fill={palette.secondary} />

      {/* VR Goggles */}
      <rect x="5" y="5" width="10" height="3" fill="#1e1b4b" />
      <rect x="6" y="6" width="3" height="1" fill="#22c55e" />
      <rect x="11" y="6" width="3" height="1" fill="#22c55e" />

      {/* Mouth */}
      <rect x="8" y="9" width="4" height="1" fill="#1f2937" />

      {/* Body with hoodie */}
      <rect x="4" y="10" width="12" height="7" fill="#4338ca" />

      {/* Inner body */}
      <rect x="6" y="11" width="8" height="5" fill={palette.primary} />

      {/* Bitcoin symbol */}
      <rect x="9" y="12" width="2" height="3" fill="#1f2937" />

      {/* Arms */}
      <rect x="2" y="11" width="2" height="4" fill="#4338ca" />
      <rect x="16" y="11" width="2" height="4" fill="#4338ca" />

      {/* Feet */}
      <rect x="6" y="17" width="3" height="2" fill="#1f2937" />
      <rect x="11" y="17" width="3" height="2" fill="#1f2937" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Young Adult Form (Level 10-12) - Warrior look
const YoungFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant: _variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Crown/Helmet */}
      <rect x="8" y="0" width="6" height="2" fill={palette.accent} />
      <rect x="10" y="0" width="2" height="1" fill="#fbbf24" />

      {/* Head */}
      <rect x="6" y="2" width="10" height="8" fill={palette.secondary} />

      {/* Visor */}
      <rect x="6" y="4" width="10" height="3" fill="#1e1b4b" />
      <rect x="7" y="5" width="3" height="1" fill={palette.accent} />
      <rect x="12" y="5" width="3" height="1" fill={palette.accent} />

      {/* Mouth area */}
      <rect x="8" y="8" width="6" height="2" fill={palette.primary} />
      <rect x="9" y="9" width="4" height="1" fill="#1f2937" />

      {/* Armor body */}
      <rect x="5" y="10" width="12" height="8" fill={palette.primary} />
      <rect x="7" y="10" width="8" height="2" fill={palette.secondary} />

      {/* Bitcoin emblem */}
      <rect x="9" y="12" width="4" height="4" fill="#fbbf24" />
      <rect x="10" y="13" width="2" height="2" fill="#1f2937" />

      {/* Arms with gauntlets */}
      <rect x="2" y="11" width="3" height="5" fill={palette.primary} />
      <rect x="17" y="11" width="3" height="5" fill={palette.primary} />

      {/* Feet */}
      <rect x="7" y="18" width="3" height="3" fill="#78350f" />
      <rect x="12" y="18" width="3" height="3" fill="#78350f" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Adult Form (Level 13-15) - Sage/Mage look
const AdultFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant: _variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Wizard hat */}
      <polygon points="12,0 8,6 16,6" fill={palette.primary} />
      <rect x="9" y="5" width="6" height="2" fill={palette.secondary} />

      {/* Head */}
      <rect x="7" y="6" width="10" height="8" fill={palette.secondary} />

      {/* Glowing eyes */}
      <rect x="8" y="9" width="3" height="2" fill={palette.accent} />
      <rect x="13" y="9" width="3" height="2" fill={palette.accent} />
      <rect x="9" y="9" width="1" height="1" fill="#ffffff" />
      <rect x="14" y="9" width="1" height="1" fill="#ffffff" />

      {/* Beard */}
      <rect x="9" y="13" width="6" height="3" fill="#d1d5db" />
      <rect x="10" y="16" width="4" height="2" fill="#d1d5db" />

      {/* Robe body */}
      <rect x="5" y="14" width="14" height="8" fill={palette.primary} />

      {/* Inner robe */}
      <rect x="9" y="15" width="6" height="6" fill={palette.secondary} />

      {/* Staff */}
      <rect x="2" y="10" width="2" height="12" fill="#92400e" />
      <rect x="1" y="8" width="4" height="3" fill={palette.accent} />

      {/* Feet */}
      <rect x="8" y="22" width="3" height="1" fill="#581c87" />
      <rect x="13" y="22" width="3" height="1" fill="#581c87" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Master Form (Level 16-18) - Full Master look
const MasterFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  variant: _variant = 1,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 26 26"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Crown */}
      <rect x="9" y="0" width="8" height="3" fill="#fbbf24" />
      <rect x="11" y="0" width="1" height="1" fill="#f43f5e" />
      <rect x="14" y="0" width="1" height="1" fill="#22c55e" />

      {/* Head with aura */}
      <rect x="8" y="3" width="10" height="9" fill={palette.secondary} />

      {/* Wise eyes */}
      <rect x="9" y="6" width="3" height="3" fill="#1e1b4b" />
      <rect x="14" y="6" width="3" height="3" fill="#1e1b4b" />
      <rect x="10" y="7" width="1" height="1" fill={palette.accent} />
      <rect x="15" y="7" width="1" height="1" fill={palette.accent} />

      {/* Beard */}
      <rect x="10" y="11" width="6" height="4" fill="#e5e7eb" />
      <rect x="11" y="15" width="4" height="3" fill="#e5e7eb" />

      {/* Robes */}
      <rect x="4" y="12" width="18" height="11" fill={palette.primary} />
      <rect x="8" y="13" width="10" height="9" fill={palette.secondary} />

      {/* Bitcoin medallion */}
      <rect x="11" y="15" width="4" height="4" fill="#fbbf24" />
      <rect x="12" y="16" width="2" height="2" fill={palette.primary} />

      {/* Staff of power */}
      <rect x="1" y="8" width="3" height="16" fill="#78350f" />
      <rect x="0" y="6" width="5" height="4" fill={palette.accent} />
      <rect x="1" y="4" width="3" height="2" fill="#fbbf24" />

      {/* Feet */}
      <rect x="9" y="23" width="3" height="2" fill="#1e3a8a" />
      <rect x="14" y="23" width="3" height="2" fill="#1e3a8a" />
    </svg>

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// Legend Form (Level 21) - Ultimate golden form
const LegendFormSprite: FC<FormSpriteProps> = ({
  size,
  state,
  palette,
  className,
}) => (
  <div className={`relative ${className}`}>
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Divine aura rays */}
      <rect x="13" y="0" width="2" height="4" fill="#fef3c7" opacity="0.7" />
      <rect
        x="6"
        y="2"
        width="2"
        height="3"
        fill="#fef3c7"
        opacity="0.5"
        transform="rotate(-30 7 3.5)"
      />
      <rect
        x="20"
        y="2"
        width="2"
        height="3"
        fill="#fef3c7"
        opacity="0.5"
        transform="rotate(30 21 3.5)"
      />

      {/* Crown of Satoshi */}
      <rect x="9" y="2" width="10" height="4" fill="#fbbf24" />
      <rect x="11" y="0" width="2" height="2" fill="#fbbf24" />
      <rect x="15" y="0" width="2" height="2" fill="#fbbf24" />
      <rect x="12" y="1" width="1" height="1" fill="#ef4444" />
      <rect x="15" y="1" width="1" height="1" fill="#3b82f6" />

      {/* Head - Golden */}
      <rect x="8" y="5" width="12" height="10" fill={palette.secondary} />

      {/* Divine eyes */}
      <rect x="9" y="8" width="4" height="3" fill="#ffffff" />
      <rect x="15" y="8" width="4" height="3" fill="#ffffff" />
      <rect x="10" y="9" width="2" height="1" fill="#1e1b4b" />
      <rect x="16" y="9" width="2" height="1" fill="#1e1b4b" />

      {/* Wise smile */}
      <rect x="11" y="13" width="6" height="1" fill="#92400e" />

      {/* Divine robes */}
      <rect x="4" y="14" width="20" height="12" fill={palette.primary} />
      <rect x="6" y="15" width="16" height="10" fill={palette.secondary} />

      {/* Bitcoin symbol - Large and prominent */}
      <rect x="11" y="17" width="6" height="6" fill="#1f2937" />
      <rect x="12" y="18" width="4" height="4" fill={palette.primary} />
      <rect x="13" y="19" width="2" height="2" fill="#1f2937" />

      {/* Staff of Genesis */}
      <rect x="0" y="10" width="4" height="16" fill="#fbbf24" />
      <rect x="1" y="7" width="2" height="4" fill="#f43f5e" />
      <rect x="0" y="5" width="4" height="3" fill="#ffffff" />

      {/* Feet */}
      <rect x="9" y="26" width="4" height="1" fill="#92400e" />
      <rect x="15" y="26" width="4" height="1" fill="#92400e" />
    </svg>

    {/* Golden aura */}
    <div
      className="absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)",
        animation: "pulse 2s ease-in-out infinite",
      }}
    />

    {state === "mining" && <MiningSparkles />}
    {state === "sleeping" && <SleepingZzz />}
  </div>
);

// ============================================
// HELPER COMPONENTS
// ============================================

const MiningSparkles: FC = () => (
  <>
    <div className="absolute -top-2 -left-2 w-2 h-2 bg-pixel-primary animate-ping" />
    <div
      className="absolute -top-1 -right-3 w-2 h-2 bg-pixel-secondary animate-ping"
      style={{ animationDelay: "100ms" }}
    />
    <div
      className="absolute -bottom-2 left-4 w-2 h-2 bg-pixel-success animate-ping"
      style={{ animationDelay: "200ms" }}
    />
  </>
);

const SleepingZzz: FC = () => (
  <div className="absolute -top-4 right-0 font-pixel text-pixel-secondary text-xs animate-pixel-float">
    Zzz
  </div>
);

export default GameSprite;
