"use client";

/**
 * NFTBoostPanel - NFT mining boost display
 *
 * Shows NFT boost information in various layouts.
 * Used in MiningSection for detailed boost info.
 */

import { clsx } from "clsx";

export interface NFTBoostPanelProps {
  /** Best single NFT boost percentage (e.g., 18 = 18%) */
  bestBoost: number;
  /** Stacked boost from all NFTs with diminishing returns (e.g., 25 = 25%) */
  stackedBoost: number;
  /** Total number of baby NFTs owned */
  totalNFTs: number;
  /** Display variant */
  variant?: "badge" | "panel" | "compact";
  /** Click handler (e.g., navigate to NFTs tab) */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Feature status - when false, shows as "Coming Soon" */
  isActive?: boolean;
}

/**
 * Format boost as percentage (input is already percentage, e.g., 18 = 18%)
 */
function formatBoost(boostPercent: number): string {
  if (boostPercent === 0) return "0%";
  // Handle decimal percentages like 0.5%
  if (boostPercent < 1) {
    return `+${boostPercent.toFixed(1)}%`;
  }
  return `+${boostPercent.toFixed(1)}%`;
}

/**
 * Get boost tier color (input is percentage, e.g., 18 = 18%)
 * Adjusted for new low values: max single NFT ~18%, max stacked ~35%
 */
function getBoostColor(boostPercent: number): string {
  if (boostPercent >= 15) return "text-pixel-warning"; // Legendary+
  if (boostPercent >= 10) return "text-purple-400"; // Epic
  if (boostPercent >= 5) return "text-pixel-secondary"; // Rare
  if (boostPercent >= 2) return "text-pixel-success"; // Uncommon
  if (boostPercent > 0) return "text-pixel-text"; // Common
  return "text-pixel-text-muted"; // None
}

/**
 * Get boost tier name (input is percentage)
 */
function getBoostTier(boostPercent: number): string {
  if (boostPercent >= 15) return "LEGENDARY";
  if (boostPercent >= 10) return "EPIC";
  if (boostPercent >= 5) return "RARE";
  if (boostPercent >= 2) return "UNCOMMON";
  if (boostPercent > 0) return "COMMON";
  return "NONE";
}

export function NFTBoostPanel({
  bestBoost,
  stackedBoost,
  totalNFTs,
  variant = "panel",
  onClick,
  className,
  isActive = false, // Default to false (Coming Soon)
}: NFTBoostPanelProps) {
  const hasBoost = stackedBoost > 0;
  const boostColor = isActive
    ? getBoostColor(stackedBoost)
    : "text-pixel-text-muted";
  const boostTier = isActive ? getBoostTier(stackedBoost) : "COMING SOON";

  // Badge variant - minimal inline display
  if (variant === "badge") {
    return (
      <button
        onClick={onClick}
        disabled={!onClick}
        className={clsx(
          "inline-flex items-center gap-2",
          "px-2 py-1",
          "border-2 border-black",
          hasBoost ? "bg-pixel-primary/20" : "bg-pixel-bg-light",
          onClick && "cursor-pointer hover:bg-pixel-bg-medium",
          className,
        )}
        type="button"
      >
        <span className="font-pixel text-[8px] text-pixel-text-muted">
          NFT:
        </span>
        <span className={clsx("font-pixel text-[10px]", boostColor)}>
          {formatBoost(stackedBoost)}
        </span>
      </button>
    );
  }

  // Compact variant - one line display
  if (variant === "compact") {
    return (
      <div
        className={clsx("flex items-center justify-between gap-4", className)}
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[8px] text-pixel-text-muted uppercase">
            NFT Boost:
          </span>
          <span className={clsx("font-pixel text-[10px]", boostColor)}>
            {formatBoost(stackedBoost)}
          </span>
        </div>
        {totalNFTs > 0 && (
          <span className="font-pixel text-[8px] text-pixel-text-muted">
            {totalNFTs} NFT{totalNFTs !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    );
  }

  // Panel variant - full display
  return (
    <div
      className={clsx(
        "border-4 border-black",
        "bg-pixel-bg-dark",
        "shadow-[4px_4px_0_0_#000]",
        className,
      )}
      role="region"
      aria-label="NFT mining boost"
    >
      {/* Header */}
      <div
        className={clsx(
          "px-3 py-2",
          "border-b-2 border-black",
          isActive && hasBoost ? "bg-pixel-primary/30" : "bg-pixel-bg-light",
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-pixel text-[10px] text-pixel-text uppercase">
            NFT Mining Boost
          </h3>
          {!isActive && (
            <span className="font-pixel text-[8px] text-pixel-warning bg-pixel-warning/20 px-2 py-0.5 border border-pixel-warning">
              SOON
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Main boost display - shows stacked boost (actual applied value) */}
        <div className="text-center">
          <div
            className={clsx(
              "font-pixel text-2xl",
              hasBoost ? boostColor : "text-pixel-text-muted",
            )}
          >
            {formatBoost(stackedBoost)}
          </div>
          <div
            className={clsx(
              "font-pixel text-[8px] mt-1",
              hasBoost ? boostColor : "text-pixel-text-muted",
            )}
          >
            {boostTier} {totalNFTs > 1 && `(${totalNFTs} NFTs stacked)`}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2">
          {/* Best Single NFT */}
          <div
            className={clsx(
              "p-2",
              "border-2 border-black",
              "bg-pixel-bg-light",
            )}
          >
            <div className="font-pixel text-[6px] text-pixel-text-muted uppercase">
              Best NFT
            </div>
            <div
              className={clsx(
                "font-pixel text-[10px]",
                getBoostColor(bestBoost),
              )}
            >
              {formatBoost(bestBoost)}
            </div>
          </div>

          {/* Total NFTs */}
          <div
            className={clsx(
              "p-2",
              "border-2 border-black",
              "bg-pixel-bg-light",
            )}
          >
            <div className="font-pixel text-[6px] text-pixel-text-muted uppercase">
              Baby NFTs
            </div>
            <div className="font-pixel text-[10px] text-pixel-text">
              {totalNFTs}
            </div>
          </div>
        </div>

        {/* Coming Soon / No NFT hint */}
        {!isActive ? (
          <div
            className={clsx(
              "p-2",
              "border-2 border-dashed border-pixel-warning/50",
              "bg-pixel-warning/10",
              "text-center",
            )}
          >
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              NFT mining boosts coming soon!
            </span>
            <p className="font-pixel-body text-[10px] text-pixel-text-muted mt-1">
              Collect NFTs now - boosts activate later.
            </p>
          </div>
        ) : totalNFTs === 0 ? (
          <div
            className={clsx(
              "p-2",
              "border-2 border-dashed border-pixel-text-muted",
              "text-center",
            )}
          >
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              Mint Baby NFTs to boost mining!
            </span>
          </div>
        ) : null}

        {/* View NFTs button */}
        {onClick && (
          <button
            onClick={onClick}
            className={clsx(
              "w-full",
              "px-3 py-2",
              "border-2 border-black",
              "bg-pixel-secondary hover:bg-pixel-secondary-dark",
              "font-pixel text-[8px] text-pixel-text-dark uppercase",
              "transition-colors",
            )}
            type="button"
          >
            View NFTs
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * NFTBoostBadge - Minimal inline boost indicator
 */
export function NFTBoostBadge({
  boost,
  className,
}: {
  boost: number;
  className?: string;
}) {
  if (boost <= 1) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center",
        "px-1.5 py-0.5",
        "font-pixel text-[8px]",
        "border-2 border-black",
        "bg-pixel-primary text-pixel-text-dark",
        className,
      )}
    >
      {boost.toFixed(2)}x
    </span>
  );
}
