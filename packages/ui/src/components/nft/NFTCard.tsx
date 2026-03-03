"use client";

/**
 * NFTCard - Genesis Baby NFT Display Card
 *
 * Pixel art card showing:
 * - Trait-based sprite from DNA
 * - Level and rarity badges
 * - XP progress bar
 * - Mining boost percentage
 * - Evolution button
 */

import { type FC, useState } from "react";
import { clsx } from "clsx";
import type { BabyNFTState, RarityTier, Bloodline, BaseType } from "./types";
import {
  getMiningBoost,
  canLevelUp,
  getXpForNextLevel,
  getEvolutionCostDisplay,
  MAX_LEVEL,
} from "./types";
import { NFTSprite } from "./NFTSprite";

// =============================================================================
// COLOR MAPS
// =============================================================================

const BLOODLINE_COLORS: Record<
  Bloodline,
  { bg: string; accent: string; label: string }
> = {
  royal: { bg: "#2d1b69", accent: "#a855f7", label: "Royal" },
  warrior: { bg: "#7c1d1d", accent: "#ef4444", label: "Warrior" },
  rogue: { bg: "#1a2e1a", accent: "#22c55e", label: "Rogue" },
  mystic: { bg: "#1a1a2e", accent: "#4fc3f7", label: "Mystic" },
  scholar: { bg: "#1a1a2e", accent: "#818cf8", label: "Scholar" },
  merchant: { bg: "#2e2a1a", accent: "#fbbf24", label: "Merchant" },
};

const RARITY_COLORS: Record<
  RarityTier,
  { border: string; badge: string; text: string; label: string }
> = {
  common: {
    border: "#6b7280",
    badge: "#374151",
    text: "#9ca3af",
    label: "Common",
  },
  uncommon: {
    border: "#22c55e",
    badge: "#14532d",
    text: "#4ade80",
    label: "Uncommon",
  },
  rare: { border: "#3b82f6", badge: "#1e3a8a", text: "#60a5fa", label: "Rare" },
  epic: { border: "#a855f7", badge: "#4c1d95", text: "#c084fc", label: "Epic" },
  legendary: {
    border: "#f59e0b",
    badge: "#78350f",
    text: "#fbbf24",
    label: "Legendary",
  },
  mythic: {
    border: "#ec4899",
    badge: "#831843",
    text: "#f472b6",
    label: "Mythic",
  },
};

const BASE_TYPE_COLORS: Record<BaseType, { body: string; label: string }> = {
  human: { body: "#fbbf24", label: "Human" },
  animal: { body: "#86efac", label: "Animal" },
  robot: { body: "#7dd3fc", label: "Robot" },
  mystic: { body: "#c4b5fd", label: "Mystic" },
  alien: { body: "#6ee7b7", label: "Alien" },
  shaman: { body: "#34d399", label: "Shaman" },
  elemental: { body: "#fb923c", label: "Elemental" },
  dragon: { body: "#ef4444", label: "Dragon" },
};

// =============================================================================
// NFT AVATAR
// =============================================================================

const NFTAvatar: FC<{ nft: BabyNFTState; size?: number }> = ({
  nft,
  size = 96,
}) => {
  const bloodline = BLOODLINE_COLORS[nft.bloodline];
  const rarity = RARITY_COLORS[nft.rarityTier];
  const baseType = BASE_TYPE_COLORS[nft.baseType];

  const dnaSlice = nft.dna.padEnd(32, "0").slice(0, 32);
  const nibbles = Array.from(dnaSlice, (c) => parseInt(c, 16));

  const grid: boolean[][] = Array.from({ length: 8 }, (_, row) => {
    const half = [
      nibbles[row * 4 + 0] > 7,
      nibbles[row * 4 + 1] > 7,
      nibbles[row * 4 + 2] > 7,
      nibbles[row * 4 + 3] > 7,
    ];
    return [...half, ...half.slice().reverse()];
  });

  const hasGlow = nft.rarityTier === "legendary" || nft.rarityTier === "mythic";

  return (
    <div
      className={clsx(
        "relative flex items-center justify-center border-4",
        hasGlow && "animate-pulse",
      )}
      style={{
        width: size,
        height: size,
        background: bloodline.bg,
        borderColor: rarity.border,
      }}
    >
      <svg
        width={size - 8}
        height={size - 8}
        viewBox="0 0 8 8"
        style={{ imageRendering: "pixelated" }}
      >
        <rect width="8" height="8" fill={bloodline.bg} />
        {grid.map((row, rowIdx) =>
          row.map((filled, colIdx) =>
            filled ? (
              <rect
                key={`${rowIdx}-${colIdx}`}
                x={colIdx}
                y={rowIdx}
                width={1}
                height={1}
                fill={baseType.body}
              />
            ) : null,
          ),
        )}
        <rect x={2} y={2} width={1} height={1} fill="#1f2937" />
        <rect x={5} y={2} width={1} height={1} fill="#1f2937" />
        <rect
          x={2}
          y={2}
          width={0.5}
          height={0.5}
          fill="#ffffff"
          opacity={0.9}
        />
        <rect
          x={5}
          y={2}
          width={0.5}
          height={0.5}
          fill="#ffffff"
          opacity={0.9}
        />
        {nft.level >= 5 ? (
          <>
            <rect x={2} y={5} width={1} height={0.5} fill="#1f2937" />
            <rect x={3} y={5.5} width={2} height={0.5} fill="#1f2937" />
            <rect x={5} y={5} width={1} height={0.5} fill="#1f2937" />
          </>
        ) : (
          <rect x={2.5} y={5} width={3} height={0.5} fill="#1f2937" />
        )}
        <rect
          x={3.5}
          y={0}
          width={1}
          height={0.5}
          fill={rarity.text}
          opacity={0.9}
        />
      </svg>
    </div>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const RarityBadge: FC<{ tier: RarityTier }> = ({ tier }) => {
  const colors = RARITY_COLORS[tier];
  return (
    <span
      className="font-pixel text-[7px] uppercase px-1.5 py-0.5 border-2 border-black"
      style={{ background: colors.badge, color: colors.text }}
    >
      {colors.label}
    </span>
  );
};

const LevelBadge: FC<{ level: number }> = ({ level }) => {
  const isMax = level >= MAX_LEVEL;
  return (
    <span
      className={clsx(
        "font-pixel text-[8px] uppercase px-2 py-0.5 border-2 border-black",
        isMax
          ? "bg-[#f59e0b] text-pixel-text-dark"
          : "bg-pixel-primary text-pixel-text-dark",
      )}
    >
      LV{level}
      {isMax ? " MAX" : ""}
    </span>
  );
};

const XPBar: FC<{ xp: number; level: number }> = ({ xp, level }) => {
  const isMax = level >= MAX_LEVEL;
  const required = getXpForNextLevel(level);
  const pct = isMax
    ? 100
    : required > 0
      ? Math.min(100, Math.floor((xp / required) * 100))
      : 100;

  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="font-pixel text-[7px] text-pixel-text-muted uppercase">
          XP
        </span>
        <span className="font-pixel-mono text-[14px] text-pixel-secondary leading-none">
          {isMax ? "MAX" : `${xp} / ${required}`}
        </span>
      </div>
      <div className="w-full h-4 bg-pixel-bg-dark border-4 border-pixel-border overflow-hidden">
        <div
          className={clsx(
            "h-full transition-[width] duration-300",
            "[transition-timing-function:steps(10)]",
            isMax ? "bg-[#f59e0b]" : "bg-pixel-secondary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
};

const MiningBoostDisplay: FC<{ boost: number }> = ({ boost }) => (
  <div className="flex items-center gap-1.5 px-2 py-1 border-2 border-black bg-[#78350f]">
    <span className="font-pixel text-[7px] text-[#fbbf24] uppercase">
      Boost
    </span>
    <span className="font-pixel-mono text-lg text-[#fbbf24] leading-none">
      +{boost}%
    </span>
  </div>
);

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export interface NFTCardProps {
  nft: BabyNFTState;
  onEvolve?: (nft: BabyNFTState) => void;
  onSelect?: (nft: BabyNFTState) => void;
  isEvolving?: boolean;
  isSelected?: boolean;
  showTokenId?: boolean;
  className?: string;
}

export const NFTCard: FC<NFTCardProps> = ({
  nft,
  onEvolve,
  onSelect,
  isEvolving = false,
  isSelected = false,
  showTokenId = true,
  className,
}) => {
  const boost = getMiningBoost(nft);
  const levelUpReady = canLevelUp(nft);
  const evolutionCost = getEvolutionCostDisplay(nft.level);
  const rarity = RARITY_COLORS[nft.rarityTier];
  const bloodline = BLOODLINE_COLORS[nft.bloodline];
  const baseType = BASE_TYPE_COLORS[nft.baseType];

  const isGlowing =
    nft.rarityTier === "legendary" || nft.rarityTier === "mythic";

  return (
    <div
      onClick={() => onSelect?.(nft)}
      className={clsx(
        "relative flex flex-col",
        "bg-pixel-bg-medium border-4",
        "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
        isGlowing && "animate-pulse",
        onSelect && "cursor-pointer hover:scale-[1.02] transition-transform",
        isSelected &&
          "ring-4 ring-pixel-primary ring-offset-2 ring-offset-pixel-bg-dark",
        className,
      )}
      style={{ borderColor: isSelected ? "#f7931a" : rarity.border }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b-2 border-black"
        style={{ background: `${bloodline.bg}dd` }}
      >
        {showTokenId && (
          <span className="font-pixel text-[8px] text-pixel-text-muted">
            #{nft.tokenId.toString().padStart(4, "0")}
          </span>
        )}
        <div className="flex items-center gap-1.5 ml-auto">
          <RarityBadge tier={nft.rarityTier} />
        </div>
      </div>

      {/* Avatar */}
      <div className="flex justify-center items-center py-5 px-4">
        <div className="relative">
          <NFTSprite
            baseType={nft.baseType}
            bloodline={nft.bloodline}
            rarityTier={nft.rarityTier}
            dna={nft.dna}
            size={96}
            animate={!isEvolving}
          />
          <div className="absolute -bottom-2 -right-2 z-10">
            <LevelBadge level={nft.level} />
          </div>
          {levelUpReady && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-[#ec4899] animate-pulse whitespace-nowrap">
              READY!
            </div>
          )}
        </div>
      </div>

      {/* Name */}
      <div className="px-3 pb-2 text-center">
        <p className="font-pixel text-[9px] text-pixel-text uppercase tracking-wide">
          {baseType.label} Baby
        </p>
        <p
          className="font-pixel text-[7px] mt-0.5"
          style={{ color: bloodline.accent }}
        >
          {bloodline.label} Bloodline
        </p>
      </div>

      {/* Stats */}
      <div className="px-3 pb-3 space-y-2.5 border-t-2 border-pixel-border pt-3">
        <XPBar xp={nft.xp} level={nft.level} />
        <div className="flex items-center justify-between gap-2">
          <MiningBoostDisplay boost={boost} />
          <div className="text-right">
            <p className="font-pixel text-[6px] text-pixel-text-muted uppercase">
              Tasks
            </p>
            <p className="font-pixel-mono text-lg text-pixel-text leading-none">
              {nft.workCount.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Evolution button */}
      {levelUpReady && onEvolve && (
        <div className="px-3 pb-3 border-t-2 border-pixel-border pt-3">
          <button
            onClick={() => onEvolve(nft)}
            disabled={isEvolving}
            className={clsx(
              "w-full font-pixel text-[9px] uppercase tracking-wide",
              "px-3 py-2.5 border-4 border-black",
              "cursor-pointer select-none",
              isEvolving
                ? "bg-pixel-border text-pixel-text-muted opacity-60 cursor-not-allowed"
                : [
                    "bg-[#ec4899] text-white",
                    "shadow-[4px_4px_0_0_#000,inset_-2px_-2px_0_0_#831843,inset_2px_2px_0_0_#f9a8d4]",
                    "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
                    "active:translate-x-[4px] active:translate-y-[4px] active:shadow-none",
                    "transition-transform duration-100",
                  ],
            )}
          >
            {isEvolving ? (
              <span className="animate-pulse">Evolving...</span>
            ) : (
              <>
                Evolve to LV{nft.level + 1}
                <span className="block font-pixel-mono text-[11px] text-[#fce7f3] mt-0.5">
                  {evolutionCost}
                </span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NFTCard;
