"use client";

/**
 * EngagementBonusPanel
 *
 * Displays the user's engagement bonuses:
 * - Baby Care: +1.5%
 * - Daily Streak: +1%
 * - Play Time: +0.5%
 * - Max Total: +3%
 *
 * NOTE: Currently COMING SOON - tracked client-side but
 * not applied to rewards until server-side implementation.
 */

import { PixelCard } from "../card";
import { clsx } from "clsx";

// =============================================================================
// TYPES
// =============================================================================

export interface EngagementBonusPanelProps {
  /** Current engagement multiplier (1.0 - 1.03) */
  multiplier: number;
  /** Breakdown of individual bonuses */
  breakdown: {
    babyCare: number;
    dailyStreak: number;
    playTime: number;
  };
  /** Engagement tier status */
  status: "inactive" | "casual" | "engaged" | "dedicated";
  /** Daily streak count */
  streakDays: number;
  /** Play time in minutes today */
  playTimeMinutes: number;
  /** Baby health average (0-100) */
  babyHealth: number;
  /** Additional CSS classes */
  className?: string;
  /** Feature status - when false, shows as "Coming Soon" */
  isActive?: boolean;
}

// =============================================================================
// TIER STYLES
// =============================================================================

const TIER_STYLES = {
  inactive: {
    label: "Inactive",
    color: "text-pixel-text-muted",
    bgColor: "bg-pixel-bg-dark/50",
    borderColor: "border-pixel-border",
  },
  casual: {
    label: "Casual",
    color: "text-pixel-secondary",
    bgColor: "bg-pixel-secondary/10",
    borderColor: "border-pixel-secondary/50",
  },
  engaged: {
    label: "Engaged",
    color: "text-pixel-success",
    bgColor: "bg-pixel-success/10",
    borderColor: "border-pixel-success/50",
  },
  dedicated: {
    label: "Dedicated",
    color: "text-pixel-primary",
    bgColor: "bg-pixel-primary/10",
    borderColor: "border-pixel-primary/50",
  },
} as const;

// =============================================================================
// COMPONENT
// =============================================================================

export function EngagementBonusPanel({
  multiplier,
  breakdown,
  status,
  streakDays,
  playTimeMinutes,
  babyHealth,
  className,
  isActive = false, // Default to false (Coming Soon)
}: EngagementBonusPanelProps) {
  const tierStyle = isActive ? TIER_STYLES[status] : TIER_STYLES.inactive;
  const bonusPercent = ((multiplier - 1) * 100).toFixed(1);

  return (
    <PixelCard className={clsx("p-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm">🎮</span>
          <span className="font-pixel text-[8px] text-pixel-text uppercase">
            Engagement Bonus
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isActive && (
            <span className="font-pixel text-[8px] text-pixel-warning bg-pixel-warning/20 px-2 py-0.5 border border-pixel-warning">
              SOON
            </span>
          )}
          {isActive && (
            <div
              className={clsx(
                "px-2 py-0.5 rounded font-pixel text-[6px] uppercase",
                tierStyle.bgColor,
                tierStyle.color,
              )}
            >
              {tierStyle.label}
            </div>
          )}
        </div>
      </div>

      {/* Main Multiplier */}
      <div className="text-center mb-3">
        <div className="font-pixel text-2xl text-pixel-primary">
          {multiplier.toFixed(2)}x
        </div>
        <div className="font-pixel text-[8px] text-pixel-text-muted">
          +{bonusPercent}% bonus rewards
        </div>
      </div>

      {/* Bonus Breakdown */}
      <div className="space-y-2">
        {/* Baby Care */}
        <BonusRow
          icon="💚"
          label="Baby Care"
          value={breakdown.babyCare}
          maxValue={0.015}
          detail={`${Math.round(babyHealth)}% health`}
          tip={
            isActive && babyHealth < 70
              ? "Care for your baby for +1.5%"
              : undefined
          }
        />

        {/* Daily Streak */}
        <BonusRow
          icon="🔥"
          label="Daily Streak"
          value={breakdown.dailyStreak}
          maxValue={0.01}
          detail={`${streakDays} days`}
          tip={
            isActive && streakDays < 7
              ? `${7 - streakDays} more days for max`
              : undefined
          }
        />

        {/* Play Time */}
        <BonusRow
          icon="⏱️"
          label="Play Time"
          value={breakdown.playTime}
          maxValue={0.005}
          detail={`${playTimeMinutes} min today`}
          tip={
            isActive && playTimeMinutes < 30
              ? `${30 - playTimeMinutes} more min for max`
              : undefined
          }
        />
      </div>

      {/* Coming Soon / Tips */}
      {!isActive ? (
        <div className="mt-3 p-2 bg-pixel-warning/10 border border-pixel-warning/30 rounded">
          <p className="font-pixel text-[6px] text-pixel-warning text-center">
            Engagement rewards coming soon!
          </p>
          <p className="font-pixel-body text-[8px] text-pixel-text-muted text-center mt-1">
            Keep playing - bonuses will activate in a future update.
          </p>
        </div>
      ) : status === "inactive" ? (
        <div className="mt-3 p-2 bg-pixel-warning/10 border border-pixel-warning/30 rounded">
          <p className="font-pixel text-[6px] text-pixel-warning text-center">
            Care for your baby and play daily to earn up to +3% bonus!
          </p>
        </div>
      ) : status === "dedicated" ? (
        <div className="mt-3 p-2 bg-pixel-primary/10 border border-pixel-primary/30 rounded">
          <p className="font-pixel text-[6px] text-pixel-primary text-center">
            Maximum bonus active! Keep it up!
          </p>
        </div>
      ) : null}
    </PixelCard>
  );
}

// =============================================================================
// BONUS ROW COMPONENT
// =============================================================================

interface BonusRowProps {
  icon: string;
  label: string;
  value: number;
  maxValue: number;
  detail: string;
  tip?: string;
}

function BonusRow({
  icon,
  label,
  value,
  maxValue,
  detail,
  tip,
}: BonusRowProps) {
  const percent = Math.round((value / maxValue) * 100);
  const bonusPercent = Math.round(value * 100);
  const isMaxed = value >= maxValue;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xs">{icon}</span>
          <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[7px] text-pixel-text-muted">
            {detail}
          </span>
          <span
            className={clsx(
              "font-pixel text-[8px]",
              isMaxed ? "text-pixel-success" : "text-pixel-text",
            )}
          >
            +{bonusPercent}%
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1.5 bg-pixel-bg-dark rounded-sm overflow-hidden">
        <div
          className={clsx(
            "h-full transition-all duration-300",
            isMaxed ? "bg-pixel-success" : "bg-pixel-secondary",
          )}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>

      {/* Tip */}
      {tip && (
        <p className="font-pixel text-[5px] text-pixel-text-muted italic">
          {tip}
        </p>
      )}
    </div>
  );
}

export default EngagementBonusPanel;
