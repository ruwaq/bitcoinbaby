"use client";

/**
 * RewardsBreakdownPanel
 *
 * Shows a complete breakdown of how mining rewards are calculated.
 * Helps users understand what's active vs coming soon.
 */

import { PixelCard } from "../card";
import { clsx } from "clsx";

// =============================================================================
// TYPES
// =============================================================================

export type BonusProviderStatus = "active" | "coming_soon" | "disabled";

export interface RewardsBreakdownPanelProps {
  /** Base reward per share */
  baseReward: number;
  /** Current streak bonus multiplier (1.0 - 2.0) */
  streakMultiplier: number;
  /** Current streak count */
  streakCount: number;
  /** NFT stacked boost percentage */
  nftBoostPercent: number;
  /** Number of NFTs owned */
  nftCount: number;
  /** Engagement multiplier (1.0 - 1.03) */
  engagementMultiplier: number;
  /** Cosmic multiplier (0.95 - 1.10) */
  cosmicMultiplier: number;
  /** Cosmic status */
  cosmicStatus: "thriving" | "normal" | "struggling" | "critical";
  /** Provider statuses for dynamic active/coming_soon display */
  providerStatus?: {
    streak?: BonusProviderStatus;
    nft?: BonusProviderStatus;
    engagement?: BonusProviderStatus;
    cosmic?: BonusProviderStatus;
  };
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RewardsBreakdownPanel({
  baseReward,
  streakMultiplier,
  streakCount,
  nftBoostPercent,
  nftCount,
  engagementMultiplier,
  cosmicMultiplier,
  cosmicStatus,
  providerStatus,
  className,
}: RewardsBreakdownPanelProps) {
  // Determine status for each provider
  const getStatus = (
    provider: keyof NonNullable<typeof providerStatus>,
    defaultActive: boolean,
  ): "active" | "coming_soon" => {
    const status = providerStatus?.[provider];
    if (status === "active") return "active";
    if (status === "coming_soon" || status === "disabled") return "coming_soon";
    return defaultActive ? "active" : "coming_soon";
  };

  // Calculate effective reward dynamically based on active providers
  let currentMultiplier = 1;
  if (getStatus("streak", true) === "active") {
    currentMultiplier *= streakMultiplier;
  }
  if (getStatus("nft", false) === "active") {
    currentMultiplier *= 1 + nftBoostPercent / 100;
  }
  if (getStatus("engagement", false) === "active") {
    currentMultiplier *= engagementMultiplier;
  }
  if (getStatus("cosmic", false) === "active") {
    currentMultiplier *= cosmicMultiplier;
  }
  const effectiveReward = Math.floor(baseReward * currentMultiplier);

  // Calculate what it would be with ALL systems (for future reference)
  const futureMultiplier =
    streakMultiplier *
    (1 + nftBoostPercent / 100) *
    engagementMultiplier *
    cosmicMultiplier;
  const futureReward = Math.floor(baseReward * futureMultiplier);

  return (
    <PixelCard className={clsx("p-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h3 className="font-pixel text-[10px] text-pixel-text uppercase">
          Rewards Breakdown
        </h3>
      </div>

      {/* Current Reward */}
      <div className="text-center mb-4 p-3 bg-pixel-bg-light border-2 border-pixel-primary rounded">
        <div className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-1">
          Current Reward per Share
        </div>
        <div className="font-pixel text-2xl text-pixel-primary">
          {effectiveReward} BABY
        </div>
        <div className="font-pixel text-[8px] text-pixel-text-muted mt-1">
          {baseReward} base × {streakMultiplier.toFixed(2)}x streak
        </div>
      </div>

      {/* Multipliers List */}
      <div className="space-y-3">
        {/* Streak */}
        <MultiplierRow
          icon="🔥"
          name="Streak Bonus"
          status={getStatus("streak", true)}
          value={`${((streakMultiplier - 1) * 100).toFixed(0)}%`}
          detail={`${streakCount} shares in session`}
          description="Mine continuously to build streak (max 2.0x at 500+ shares)"
        />

        {/* NFT */}
        <MultiplierRow
          icon="🖼️"
          name="NFT Boost"
          status={getStatus("nft", false)}
          value={nftCount > 0 ? `+${nftBoostPercent.toFixed(1)}%` : "0%"}
          detail={
            nftCount > 0
              ? `${nftCount} NFT${nftCount > 1 ? "s" : ""} owned`
              : "No NFTs"
          }
          description="Collect NFTs for stacking boosts (diminishing returns)"
        />

        {/* Engagement */}
        <MultiplierRow
          icon="🎮"
          name="Engagement"
          status={getStatus("engagement", false)}
          value={`+${((engagementMultiplier - 1) * 100).toFixed(1)}%`}
          detail="Baby care + daily streak + play time"
          description="Care for your baby and play daily (max +3%)"
        />

        {/* Cosmic */}
        <MultiplierRow
          icon="🌙"
          name="Cosmic Energy"
          status={getStatus("cosmic", false)}
          value={
            cosmicMultiplier >= 1
              ? `+${((cosmicMultiplier - 1) * 100).toFixed(1)}%`
              : `${((cosmicMultiplier - 1) * 100).toFixed(1)}%`
          }
          detail={`Status: ${cosmicStatus}`}
          description="Moon phases, seasons, and cosmic events affect your baby"
        />
      </div>

      {/* Future Potential */}
      <div className="mt-4 p-2 bg-pixel-bg-dark border border-pixel-text-muted rounded">
        <div className="font-pixel text-[6px] text-pixel-text-muted uppercase text-center">
          When all systems active
        </div>
        <div className="font-pixel text-sm text-pixel-secondary text-center">
          ~{futureReward} BABY/share
        </div>
        <div className="font-pixel text-[6px] text-pixel-text-muted text-center mt-1">
          ({futureMultiplier.toFixed(2)}x total multiplier)
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex justify-center gap-4">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-pixel-success rounded-full" />
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            Active
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 bg-pixel-warning rounded-full" />
          <span className="font-pixel text-[6px] text-pixel-text-muted">
            Coming Soon
          </span>
        </div>
      </div>
    </PixelCard>
  );
}

// =============================================================================
// MULTIPLIER ROW
// =============================================================================

interface MultiplierRowProps {
  icon: string;
  name: string;
  status: "active" | "coming_soon";
  value: string;
  detail: string;
  description: string;
}

function MultiplierRow({
  icon,
  name,
  status,
  value,
  detail,
  description,
}: MultiplierRowProps) {
  const isActive = status === "active";

  return (
    <div
      className={clsx(
        "p-2 rounded border",
        isActive
          ? "bg-pixel-success/10 border-pixel-success/30"
          : "bg-pixel-bg-light border-pixel-border opacity-75",
      )}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-sm">{icon}</span>
          <span className="font-pixel text-[8px] text-pixel-text uppercase">
            {name}
          </span>
          {!isActive && (
            <span className="font-pixel text-[6px] text-pixel-warning bg-pixel-warning/20 px-1 py-0.5 rounded">
              SOON
            </span>
          )}
        </div>
        <span
          className={clsx(
            "font-pixel text-[10px]",
            isActive ? "text-pixel-success" : "text-pixel-text-muted",
          )}
        >
          {value}
        </span>
      </div>
      <div className="font-pixel text-[6px] text-pixel-text-muted">
        {detail}
      </div>
      <div className="font-pixel-body text-[8px] text-pixel-text-muted mt-1 italic">
        {description}
      </div>
    </div>
  );
}

export default RewardsBreakdownPanel;
