/**
 * Rarity Effects Component - MINIMALIST VERSION
 *
 * Efectos sutiles que NO distraen del personaje principal.
 * Solo partículas pequeñas en los bordes, sin fondos ni auras.
 *
 * - Common: Nada (el personaje es suficiente)
 * - Uncommon: 2-3 chispas verdes sutiles
 * - Rare: 4-5 partículas azules
 * - Epic: Pequeñas runas flotando en esquinas
 * - Legendary: Partículas doradas en los bordes
 * - Mythic: Pequeñas estrellas arcoíris en esquinas
 *
 * Pixel Art 8-bit Style - 32x32 viewBox
 */

import { type FC } from "react";
import { type Rarity } from "./types";

interface RarityEffectsProps {
  rarity: Rarity;
  size?: number;
  animated?: boolean;
}

// Minimal color palettes - only what's needed for small particles
const RARITY_COLORS = {
  common: {
    particle: "#9ca3af",
  },
  uncommon: {
    particle: "#22c55e",
    glow: "#4ade80",
  },
  rare: {
    particle: "#3b82f6",
    glow: "#60a5fa",
    crystal: "#67e8f9",
  },
  epic: {
    particle: "#8b5cf6",
    glow: "#a78bfa",
    rune: "#c084fc",
  },
  legendary: {
    particle: "#fbbf24",
    glow: "#fcd34d",
    divine: "#ffffff",
  },
  mythic: {
    red: "#ef4444",
    orange: "#f97316",
    yellow: "#eab308",
    green: "#22c55e",
    blue: "#3b82f6",
    purple: "#8b5cf6",
    white: "#ffffff",
  },
};

// Type-specific color getters to avoid union type issues
const getUncommonColors = () => RARITY_COLORS.uncommon;
const getRareColors = () => RARITY_COLORS.rare;
const getEpicColors = () => RARITY_COLORS.epic;
const getLegendaryColors = () => RARITY_COLORS.legendary;
const getMythicColors = () => RARITY_COLORS.mythic;

export const RarityEffects: FC<RarityEffectsProps> = ({
  rarity,
  size = 64,
  animated = true,
}) => {
  // Common - no effects, character speaks for itself
  const renderCommon = () => null;

  // Uncommon - subtle green sparkles at corners
  const renderUncommon = () => {
    const c = getUncommonColors();
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      >
        <rect
          x="2"
          y="2"
          width="1"
          height="1"
          fill={c.particle}
          opacity="0.6"
          className={animated ? "animate-nft-float" : ""}
        />
        <rect
          x="29"
          y="3"
          width="1"
          height="1"
          fill={c.glow}
          opacity="0.5"
          className={animated ? "animate-nft-float" : ""}
          style={{ animationDelay: "0.5s" }}
        />
        <rect
          x="3"
          y="28"
          width="1"
          height="1"
          fill={c.glow}
          opacity="0.4"
          className={animated ? "animate-nft-float" : ""}
          style={{ animationDelay: "1s" }}
        />
      </svg>
    );
  };

  // Rare - small blue crystals at edges
  const renderRare = () => {
    const c = getRareColors();
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Top left crystal */}
        <rect
          x="1"
          y="3"
          width="1"
          height="2"
          fill={c.particle}
          opacity="0.7"
          className={animated ? "animate-nft-shimmer" : ""}
          style={{ animationDelay: "0s" }}
        />
        <rect x="1" y="3" width="1" height="1" fill={c.crystal} opacity="0.8" />
        {/* Top right */}
        <rect
          x="29"
          y="2"
          width="1"
          height="2"
          fill={c.glow}
          opacity="0.6"
          className={animated ? "animate-nft-shimmer" : ""}
          style={{ animationDelay: "0.3s" }}
        />
        {/* Bottom left */}
        <rect
          x="2"
          y="27"
          width="1"
          height="2"
          fill={c.particle}
          opacity="0.5"
          className={animated ? "animate-nft-shimmer" : ""}
          style={{ animationDelay: "0.6s" }}
        />
        {/* Bottom right */}
        <rect
          x="28"
          y="28"
          width="1"
          height="2"
          fill={c.crystal}
          opacity="0.6"
          className={animated ? "animate-nft-shimmer" : ""}
          style={{ animationDelay: "0.9s" }}
        />
      </svg>
    );
  };

  // Epic - tiny runes at corners
  const renderEpic = () => {
    const c = getEpicColors();
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Top left rune */}
        <rect
          x="1"
          y="1"
          width="1"
          height="3"
          fill={c.rune}
          opacity="0.6"
          className={animated ? "animate-nft-rune" : ""}
        />
        <rect
          x="2"
          y="2"
          width="2"
          height="1"
          fill={c.particle}
          opacity="0.5"
          className={animated ? "animate-nft-rune" : ""}
        />
        {/* Top right rune */}
        <rect
          x="30"
          y="1"
          width="1"
          height="3"
          fill={c.rune}
          opacity="0.6"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.3s" }}
        />
        <rect
          x="28"
          y="2"
          width="2"
          height="1"
          fill={c.particle}
          opacity="0.5"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.3s" }}
        />
        {/* Bottom left rune */}
        <rect
          x="1"
          y="28"
          width="1"
          height="3"
          fill={c.glow}
          opacity="0.5"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.6s" }}
        />
        <rect
          x="2"
          y="29"
          width="2"
          height="1"
          fill={c.particle}
          opacity="0.4"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.6s" }}
        />
        {/* Bottom right rune */}
        <rect
          x="30"
          y="28"
          width="1"
          height="3"
          fill={c.glow}
          opacity="0.5"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.9s" }}
        />
        <rect
          x="28"
          y="29"
          width="2"
          height="1"
          fill={c.particle}
          opacity="0.4"
          className={animated ? "animate-nft-rune" : ""}
          style={{ animationDelay: "0.9s" }}
        />
      </svg>
    );
  };

  // Legendary - golden particles at edges
  const renderLegendary = () => {
    const c = getLegendaryColors();
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Top particles */}
        <rect
          x="2"
          y="1"
          width="1"
          height="1"
          fill={c.divine}
          opacity="0.8"
          className={animated ? "animate-nft-spark" : ""}
        />
        <rect
          x="15"
          y="0"
          width="2"
          height="1"
          fill={c.particle}
          opacity="0.7"
          className={animated ? "animate-nft-divine" : ""}
        />
        <rect
          x="29"
          y="1"
          width="1"
          height="1"
          fill={c.divine}
          opacity="0.8"
          className={animated ? "animate-nft-spark" : ""}
          style={{ animationDelay: "0.2s" }}
        />
        {/* Side particles */}
        <rect
          x="0"
          y="15"
          width="1"
          height="1"
          fill={c.glow}
          opacity="0.5"
          className={animated ? "animate-nft-divine" : ""}
          style={{ animationDelay: "0.4s" }}
        />
        <rect
          x="31"
          y="16"
          width="1"
          height="1"
          fill={c.glow}
          opacity="0.5"
          className={animated ? "animate-nft-divine" : ""}
          style={{ animationDelay: "0.6s" }}
        />
        {/* Bottom particles */}
        <rect
          x="3"
          y="30"
          width="1"
          height="1"
          fill={c.particle}
          opacity="0.6"
          className={animated ? "animate-nft-spark" : ""}
          style={{ animationDelay: "0.8s" }}
        />
        <rect
          x="28"
          y="30"
          width="1"
          height="1"
          fill={c.particle}
          opacity="0.6"
          className={animated ? "animate-nft-spark" : ""}
          style={{ animationDelay: "1s" }}
        />
      </svg>
    );
  };

  // Mythic - rainbow stars at corners (subtle)
  const renderMythic = () => {
    const c = getMythicColors();
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        className="absolute inset-0 pointer-events-none"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Top left - red/orange */}
        <rect
          x="1"
          y="1"
          width="2"
          height="1"
          fill={c.red}
          opacity="0.7"
          className={animated ? "animate-nft-twinkle" : ""}
        />
        <rect
          x="2"
          y="2"
          width="1"
          height="1"
          fill={c.orange}
          opacity="0.6"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "0.2s" }}
        />
        {/* Top right - yellow/green */}
        <rect
          x="29"
          y="1"
          width="2"
          height="1"
          fill={c.yellow}
          opacity="0.7"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "0.4s" }}
        />
        <rect
          x="29"
          y="2"
          width="1"
          height="1"
          fill={c.green}
          opacity="0.6"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "0.6s" }}
        />
        {/* Bottom left - blue */}
        <rect
          x="1"
          y="30"
          width="2"
          height="1"
          fill={c.blue}
          opacity="0.7"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "0.8s" }}
        />
        <rect
          x="2"
          y="29"
          width="1"
          height="1"
          fill={c.purple}
          opacity="0.6"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "1s" }}
        />
        {/* Bottom right - purple */}
        <rect
          x="29"
          y="30"
          width="2"
          height="1"
          fill={c.purple}
          opacity="0.7"
          className={animated ? "animate-nft-twinkle" : ""}
          style={{ animationDelay: "1.2s" }}
        />
        <rect
          x="29"
          y="29"
          width="1"
          height="1"
          fill={c.white}
          opacity="0.8"
          className={animated ? "animate-nft-spark" : ""}
          style={{ animationDelay: "1.4s" }}
        />
        {/* Center top star */}
        <rect
          x="15"
          y="0"
          width="2"
          height="1"
          fill={c.white}
          opacity="0.6"
          className={animated ? "animate-nft-spark" : ""}
          style={{ animationDelay: "1.6s" }}
        />
      </svg>
    );
  };

  // Select renderer based on rarity
  const renderRarity = () => {
    switch (rarity) {
      case "common":
        return renderCommon();
      case "uncommon":
        return renderUncommon();
      case "rare":
        return renderRare();
      case "epic":
        return renderEpic();
      case "legendary":
        return renderLegendary();
      case "mythic":
        return renderMythic();
      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {renderRarity()}
    </div>
  );
};

/**
 * Rarity Frame Component - MINIMALIST
 * Solo un borde sutil, sin decoraciones excesivas
 */
interface RarityFrameProps {
  rarity: Rarity;
  size?: number;
}

export const RarityFrame: FC<RarityFrameProps> = ({ rarity, size = 64 }) => {
  const frameColors: Record<Rarity, { primary: string; corner: string }> = {
    common: { primary: "#4b5563", corner: "#6b7280" },
    uncommon: { primary: "#15803d", corner: "#22c55e" },
    rare: { primary: "#1d4ed8", corner: "#3b82f6" },
    epic: { primary: "#6d28d9", corner: "#8b5cf6" },
    legendary: { primary: "#d97706", corner: "#fbbf24" },
    mythic: { primary: "#db2777", corner: "#ec4899" },
  };

  const c = frameColors[rarity];

  // Common has no frame
  if (rarity === "common") return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="absolute inset-0 pointer-events-none"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Simple corner marks only */}
      {/* Top-left */}
      <rect x="0" y="0" width="3" height="1" fill={c.primary} opacity="0.7" />
      <rect x="0" y="0" width="1" height="3" fill={c.primary} opacity="0.7" />
      <rect x="0" y="0" width="1" height="1" fill={c.corner} />
      {/* Top-right */}
      <rect x="29" y="0" width="3" height="1" fill={c.primary} opacity="0.7" />
      <rect x="31" y="0" width="1" height="3" fill={c.primary} opacity="0.7" />
      <rect x="31" y="0" width="1" height="1" fill={c.corner} />
      {/* Bottom-left */}
      <rect x="0" y="31" width="3" height="1" fill={c.primary} opacity="0.7" />
      <rect x="0" y="29" width="1" height="3" fill={c.primary} opacity="0.7" />
      <rect x="0" y="31" width="1" height="1" fill={c.corner} />
      {/* Bottom-right */}
      <rect x="29" y="31" width="3" height="1" fill={c.primary} opacity="0.7" />
      <rect x="31" y="29" width="1" height="3" fill={c.primary} opacity="0.7" />
      <rect x="31" y="31" width="1" height="1" fill={c.corner} />
    </svg>
  );
};

/**
 * Rarity Badge Component - MINIMALIST
 * Pequeña marca discreta en una esquina
 */
interface RarityBadgeProps {
  rarity: Rarity;
  size?: number;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export const RarityBadge: FC<RarityBadgeProps> = ({
  rarity,
  size = 64,
  position = "top-right",
}) => {
  const badgeColors: Record<Rarity, string> = {
    common: "#6b7280",
    uncommon: "#22c55e",
    rare: "#3b82f6",
    epic: "#8b5cf6",
    legendary: "#fbbf24",
    mythic: "#ec4899",
  };

  const positionClasses: Record<string, string> = {
    "top-left": "top-0 left-0",
    "top-right": "top-0 right-0",
    "bottom-left": "bottom-0 left-0",
    "bottom-right": "bottom-0 right-0",
  };

  const badgeSize = Math.max(size / 6, 8);

  return (
    <div
      className={`absolute ${positionClasses[position]} pointer-events-none`}
      style={{
        width: badgeSize,
        height: badgeSize,
      }}
    >
      <svg
        width={badgeSize}
        height={badgeSize}
        viewBox="0 0 8 8"
        style={{ imageRendering: "pixelated" }}
      >
        {/* Simple dot indicator */}
        <rect x="1" y="1" width="6" height="6" fill={badgeColors[rarity]} />
        <rect x="2" y="2" width="2" height="2" fill="#ffffff" opacity="0.4" />
      </svg>
    </div>
  );
};

export default RarityEffects;
