"use client";

/**
 * StreakBonusCard
 *
 * Shows streak bonus with visual progress bar and countdown timer.
 * Displays progress towards next tier and time remaining before streak resets.
 */

import { useState, useEffect } from "react";
import { PixelCard } from "../card";
import { clsx } from "clsx";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Streak tiers matching server-side configuration */
const STREAK_TIERS = [
  { shares: 0, multiplier: 1.0, label: "None" },
  { shares: 10, multiplier: 1.2, label: "Warm" },
  { shares: 50, multiplier: 1.5, label: "Hot" },
  { shares: 100, multiplier: 1.75, label: "Fire" },
  { shares: 250, multiplier: 1.9, label: "Blazing" },
  { shares: 500, multiplier: 2.0, label: "MAX" },
];

/** Streak reset time in ms (30 minutes) */
const STREAK_RESET_MS = 30 * 60 * 1000;

// =============================================================================
// TYPES
// =============================================================================

export interface StreakBonusCardProps {
  /** Current streak count (consecutive shares) */
  streakCount: number;
  /** Current multiplier (1.0 - 2.0) */
  multiplier: number;
  /** Timestamp of last mining activity */
  lastMiningAt?: number;
  /** Whether actively mining */
  isMining?: boolean;
  /** Callback when streak is about to reset */
  onStreakWarning?: () => void;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function StreakBonusCard({
  streakCount,
  multiplier,
  lastMiningAt,
  isMining = false,
  onStreakWarning,
  className,
}: StreakBonusCardProps) {
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [hasWarned, setHasWarned] = useState(false);

  // Calculate current and next tier
  const currentTier = STREAK_TIERS.reduce(
    (acc, tier, idx) => (streakCount >= tier.shares ? idx : acc),
    0,
  );
  const nextTier =
    currentTier < STREAK_TIERS.length - 1
      ? STREAK_TIERS[currentTier + 1]
      : null;
  const currentTierData = STREAK_TIERS[currentTier];

  // Calculate progress to next tier
  const progressToNext = nextTier
    ? Math.min(
        ((streakCount - currentTierData.shares) /
          (nextTier.shares - currentTierData.shares)) *
          100,
        100,
      )
    : 100;

  // Countdown timer effect
  useEffect(() => {
    if (!lastMiningAt || isMining) {
      setTimeRemaining(null);
      setHasWarned(false);
      return;
    }

    const updateTimer = () => {
      const elapsed = Date.now() - lastMiningAt;
      const remaining = Math.max(0, STREAK_RESET_MS - elapsed);
      setTimeRemaining(remaining);

      // Warning when 5 minutes remaining
      if (remaining < 5 * 60 * 1000 && remaining > 0 && !hasWarned) {
        setHasWarned(true);
        onStreakWarning?.();
      }

      // Reset warning flag if timer resets
      if (remaining > 5 * 60 * 1000) {
        setHasWarned(false);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [lastMiningAt, isMining, hasWarned, onStreakWarning]);

  // Format time remaining
  const formatTime = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Get fire emoji based on tier
  const getFireEmoji = (tier: number): string => {
    if (tier === 0) return "🔥";
    if (tier === 1) return "🔥";
    if (tier === 2) return "🔥🔥";
    if (tier === 3) return "🔥🔥🔥";
    if (tier === 4) return "🔥🔥🔥🔥";
    return "🔥🔥🔥🔥🔥";
  };

  // Timer warning state
  const isWarning =
    timeRemaining !== null &&
    timeRemaining > 0 &&
    timeRemaining < 5 * 60 * 1000;
  const isExpired = timeRemaining === 0 && !isMining;

  return (
    <PixelCard
      className={clsx(
        "p-4",
        isWarning && "ring-2 ring-pixel-warning animate-pulse",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getFireEmoji(currentTier)}</span>
          <div>
            <h3 className="font-pixel text-[10px] text-pixel-text uppercase">
              Streak Bonus
            </h3>
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              {currentTierData.label}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-xl text-pixel-primary">
            {multiplier.toFixed(2)}x
          </div>
          <div className="font-pixel text-[8px] text-pixel-success">
            +{((multiplier - 1) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Current Streak */}
      <div className="mb-3 p-2 bg-pixel-bg-light border border-pixel-border rounded">
        <div className="flex justify-between items-center">
          <span className="font-pixel text-[8px] text-pixel-text-muted">
            Current Streak
          </span>
          <span className="font-pixel text-sm text-pixel-text">
            {streakCount} shares
          </span>
        </div>
      </div>

      {/* Progress to Next Tier */}
      {nextTier && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="font-pixel text-[6px] text-pixel-text-muted">
              Next: {nextTier.label} ({nextTier.multiplier}x)
            </span>
            <span className="font-pixel text-[6px] text-pixel-text-muted">
              {nextTier.shares - streakCount} shares to go
            </span>
          </div>
          <div className="h-3 bg-pixel-bg-dark border border-pixel-border rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pixel-warning to-pixel-primary transition-all duration-300"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        </div>
      )}

      {/* Streak Timer */}
      {!isMining && lastMiningAt && timeRemaining !== null && (
        <div
          className={clsx(
            "p-2 rounded border",
            isExpired
              ? "bg-pixel-error/20 border-pixel-error"
              : isWarning
                ? "bg-pixel-warning/20 border-pixel-warning"
                : "bg-pixel-bg-light border-pixel-border",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              {isExpired ? "Streak Lost!" : "Streak expires in"}
            </span>
            {!isExpired && (
              <span
                className={clsx(
                  "font-pixel text-sm",
                  isWarning ? "text-pixel-warning" : "text-pixel-text",
                )}
              >
                {formatTime(timeRemaining)}
              </span>
            )}
          </div>
          {isWarning && !isExpired && (
            <div className="font-pixel text-[6px] text-pixel-warning mt-1">
              Start mining to keep your streak!
            </div>
          )}
          {isExpired && (
            <div className="font-pixel text-[6px] text-pixel-error mt-1">
              Start mining again to rebuild your streak
            </div>
          )}
        </div>
      )}

      {/* Active Mining Indicator */}
      {isMining && (
        <div className="p-2 bg-pixel-success/20 border border-pixel-success rounded">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-pixel-success rounded-full animate-pulse" />
            <span className="font-pixel text-[8px] text-pixel-success">
              Building streak...
            </span>
          </div>
        </div>
      )}

      {/* Tier Roadmap */}
      <div className="mt-3 pt-3 border-t border-pixel-border">
        <div className="font-pixel text-[6px] text-pixel-text-muted mb-2 uppercase">
          Streak Tiers
        </div>
        <div className="flex justify-between">
          {STREAK_TIERS.slice(1).map((tier, idx) => (
            <div
              key={tier.shares}
              className={clsx(
                "text-center",
                currentTier > idx
                  ? "text-pixel-success"
                  : currentTier === idx + 1
                    ? "text-pixel-primary"
                    : "text-pixel-text-muted",
              )}
            >
              <div className="font-pixel text-[10px]">{tier.multiplier}x</div>
              <div className="font-pixel text-[5px]">{tier.shares}+</div>
            </div>
          ))}
        </div>
      </div>
    </PixelCard>
  );
}

export default StreakBonusCard;
