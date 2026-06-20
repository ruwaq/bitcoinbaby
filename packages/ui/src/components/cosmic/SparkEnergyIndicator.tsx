"use client";

/**
 * BabyEnergyIndicator - Shows Baby's cosmic energy status
 *
 * Displays the current energy multiplier, status, and active effects.
 * Visual feedback changes based on thriving/normal/struggling/critical states.
 */

import { type FC } from "react";
import { clsx } from "clsx";
import { Progress } from "../progress";
import type { EnergyStatus, BabyCosmicEnergy } from "@bitcoinbaby/core";

// Re-export types for consumers
export type { EnergyStatus, BabyCosmicEnergy };

// Extract multipliers type from BabyCosmicEnergy for local use
export type EnergyMultipliers = BabyCosmicEnergy["rawMultipliers"];

export interface BabyEnergyIndicatorProps {
  /** Calculated cosmic energy data */
  energy: BabyCosmicEnergy | null;
  /** Baby's name for display */
  babyName?: string;
  /** Whether to show detailed breakdown */
  showDetails?: boolean;
  /** Whether to show warnings */
  showWarnings?: boolean;
  /** Layout variant */
  variant?: "full" | "compact" | "badge";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Status configurations
 */
const STATUS_CONFIG: Record<
  EnergyStatus,
  {
    label: string;
    icon: string;
    bgClass: string;
    textClass: string;
    borderClass: string;
    description: string;
  }
> = {
  thriving: {
    label: "Thriving",
    icon: "sparkles",
    bgClass: "bg-pixel-success/20",
    textClass: "text-pixel-success",
    borderClass: "border-pixel-success",
    description: "Tu Baby esta en su momento de poder!",
  },
  normal: {
    label: "Normal",
    icon: "smile",
    bgClass: "bg-pixel-secondary/20",
    textClass: "text-pixel-secondary",
    borderClass: "border-pixel-secondary",
    description: "Tu Baby esta bien",
  },
  struggling: {
    label: "Struggling",
    icon: "frown",
    bgClass: "bg-pixel-warning/20",
    textClass: "text-pixel-warning",
    borderClass: "border-pixel-warning",
    description: "Tu Baby esta un poco debil",
  },
  critical: {
    label: "Critical",
    icon: "alert",
    bgClass: "bg-pixel-error/20",
    textClass: "text-pixel-error",
    borderClass: "border-pixel-error",
    description: "Tu Baby necesita atencion urgente!",
  },
};

/**
 * Status emoji mapping
 */
const STATUS_EMOJI: Record<EnergyStatus, string> = {
  thriving: "🤩",
  normal: "🙂",
  struggling: "😔",
  critical: "🤕",
};

/**
 * Format multiplier as percentage
 */
function formatMultiplier(value: number): string {
  const percent = (value - 1) * 100;
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(0)}%`;
}

/**
 * Format bonus as percentage
 */
function formatBonus(value: number): string {
  const percent = value * 100;
  const sign = percent >= 0 ? "+" : "";
  return `${sign}${percent.toFixed(0)}%`;
}

/**
 * Main multiplier display
 */
const MultiplierDisplay: FC<{
  multiplier: number;
  status: EnergyStatus;
}> = ({ multiplier, status }) => {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center",
        "px-4 py-3",
        "border-2 border-black",
        config.bgClass,
      )}
    >
      <span className="font-pixel text-[8px] text-pixel-text-muted uppercase">
        Energy Multiplier
      </span>
      <span className={clsx("font-pixel text-2xl", config.textClass)}>
        x{multiplier.toFixed(2)}
      </span>
      <span className={clsx("font-pixel text-xs", config.textClass)}>
        {formatMultiplier(multiplier)}
      </span>
    </div>
  );
};

/**
 * Status badge with icon
 */
const StatusBadge: FC<{
  status: EnergyStatus;
  showDescription?: boolean;
}> = ({ status, showDescription = false }) => {
  const config = STATUS_CONFIG[status];

  return (
    <div
      className={clsx(
        "flex items-center gap-2 px-3 py-2",
        "border-2",
        config.borderClass,
        config.bgClass,
      )}
    >
      <span className="text-xl">{STATUS_EMOJI[status]}</span>
      <div>
        <span className={clsx("font-pixel text-xs", config.textClass)}>
          {config.label}
        </span>
        {showDescription && (
          <div className="font-pixel text-[8px] text-pixel-text-muted">
            {config.description}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Multiplier breakdown table
 */
const MultiplierBreakdown: FC<{
  multipliers: EnergyMultipliers;
  catchUpBonus: number;
}> = ({ multipliers, catchUpBonus }) => {
  const items = [
    { label: "Type", value: multipliers.type, icon: "gem" },
    { label: "Bloodline", value: multipliers.bloodline, icon: "dna" },
    { label: "Heritage", value: multipliers.heritage, icon: "globe" },
    { label: "Cosmic", value: multipliers.cosmic, icon: "moon" },
    { label: "Items", value: multipliers.items, icon: "package" },
    { label: "Level", value: multipliers.level, icon: "trending-up" },
    { label: "Rarity", value: multipliers.rarity, icon: "award" },
  ];

  // Only show non-zero multipliers
  const activeItems = items.filter((item) => item.value !== 0);

  return (
    <div className="space-y-1">
      <div className="font-pixel text-[8px] text-pixel-text-muted uppercase">
        Multiplier Breakdown
      </div>
      <div className="grid grid-cols-2 gap-1">
        {activeItems.map((item) => (
          <div
            key={item.label}
            className={clsx(
              "flex items-center justify-between",
              "px-2 py-1",
              "border border-black",
              "bg-pixel-bg-light",
            )}
          >
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              {item.label}
            </span>
            <span
              className={clsx(
                "font-pixel text-[8px]",
                item.value > 0 ? "text-pixel-success" : "text-pixel-error",
              )}
            >
              {formatBonus(item.value)}
            </span>
          </div>
        ))}
        {catchUpBonus > 0 && (
          <div
            className={clsx(
              "flex items-center justify-between",
              "px-2 py-1",
              "border border-black",
              "bg-pixel-secondary/10",
            )}
          >
            <span className="font-pixel text-[8px] text-pixel-secondary">
              Catch-up
            </span>
            <span className="font-pixel text-[8px] text-pixel-secondary">
              {formatBonus(catchUpBonus)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Active effects list
 */
const ActiveEffectsList: FC<{ effects: string[] }> = ({ effects }) => {
  if (effects.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="font-pixel text-[8px] text-pixel-text-muted uppercase">
        Active Effects
      </div>
      <div className="flex flex-wrap gap-1">
        {effects.map((effect, index) => (
          <span
            key={index}
            className={clsx(
              "px-2 py-0.5",
              "border border-black",
              "bg-pixel-bg-light",
              "font-pixel text-[8px] text-pixel-text",
            )}
          >
            {effect}
          </span>
        ))}
      </div>
    </div>
  );
};

/**
 * Warning messages
 */
const WarningsList: FC<{ warnings: string[] }> = ({ warnings }) => {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-1">
      {warnings.map((warning, index) => (
        <div
          key={index}
          className={clsx(
            "px-3 py-2",
            "border-2 border-pixel-error",
            "bg-pixel-error/20",
            "font-pixel text-[8px] text-pixel-error",
          )}
        >
          {warning}
        </div>
      ))}
    </div>
  );
};

/**
 * Energy bar visualization
 */
const EnergyBar: FC<{
  baseEnergy: number;
  effectiveEnergy: number;
  status: EnergyStatus;
}> = ({ baseEnergy, effectiveEnergy, status }) => {
  const config = STATUS_CONFIG[status];
  const maxEnergy = 100;
  const basePercent = Math.min((baseEnergy / maxEnergy) * 100, 100);
  const effectivePercent = Math.min((effectiveEnergy / maxEnergy) * 100, 100);

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <span className="font-pixel text-[8px] text-pixel-text-muted">
          Energy
        </span>
        <span className="font-pixel text-[8px] text-pixel-text">
          {Math.round(effectiveEnergy)} / {maxEnergy}
        </span>
      </div>
      <div className="relative">
        {/* Base energy (faded) */}
        <Progress
          value={basePercent}
          variant="default"
          className="h-3 opacity-30"
        />
        {/* Effective energy (on top) */}
        <div className="absolute inset-0">
          <Progress
            value={effectivePercent}
            variant={
              status === "thriving"
                ? "success"
                : status === "critical"
                  ? "error"
                  : status === "struggling"
                    ? "warning"
                    : "default"
            }
            className="h-3"
          />
        </div>
      </div>
      {baseEnergy !== effectiveEnergy && (
        <div className="font-pixel text-[6px] text-pixel-text-muted text-right">
          Base: {Math.round(baseEnergy)} | Effective:{" "}
          {Math.round(effectiveEnergy)}
        </div>
      )}
    </div>
  );
};

/**
 * Main BabyEnergyIndicator Component
 */
export const BabyEnergyIndicator: FC<BabyEnergyIndicatorProps> = ({
  energy,
  babyName,
  showDetails = true,
  showWarnings = true,
  variant = "full",
  className,
}) => {
  if (!energy) {
    return (
      <div
        className={clsx(
          "border-4 border-black",
          "bg-pixel-bg-dark",
          "p-4",
          className,
        )}
      >
        <div className="font-pixel text-xs text-pixel-text-muted text-center">
          No energy data available
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[energy.status];

  // Badge variant - minimal inline display
  if (variant === "badge") {
    return (
      <div
        className={clsx(
          "inline-flex items-center gap-2 px-2 py-1",
          "border-2 border-black",
          config.bgClass,
          className,
        )}
      >
        <span className={clsx("font-pixel text-xs", config.textClass)}>
          x{energy.finalMultiplier.toFixed(2)}
        </span>
        <span className="text-sm">
          {energy.status === "thriving" && "star-struck"}
          {energy.status === "normal" && "slightly-smiling-face"}
          {energy.status === "struggling" && "pensive-face"}
          {energy.status === "critical" && "face-with-head-bandage"}
        </span>
      </div>
    );
  }

  // Compact variant - single row
  if (variant === "compact") {
    return (
      <div
        className={clsx(
          "flex items-center gap-3 px-3 py-2",
          "border-2 border-black",
          "bg-pixel-bg-dark",
          className,
        )}
      >
        <div className={clsx("font-pixel text-sm", config.textClass)}>
          x{energy.finalMultiplier.toFixed(2)}
        </div>
        <div className="flex-1 h-2">
          <Progress
            value={(energy.effectiveEnergy / 100) * 100}
            variant={
              energy.status === "thriving"
                ? "success"
                : energy.status === "critical"
                  ? "error"
                  : "default"
            }
            className="h-2"
          />
        </div>
        <span
          className={clsx("font-pixel text-[8px] uppercase", config.textClass)}
        >
          {energy.status}
        </span>
      </div>
    );
  }

  // Full variant - complete panel
  return (
    <div
      className={clsx(
        "border-4 border-black",
        "bg-pixel-bg-dark",
        "shadow-[4px_4px_0_0_#000]",
        className,
      )}
    >
      {/* Header */}
      <div
        className={clsx(
          "flex items-center justify-between",
          "px-3 py-2",
          "border-b-2 border-black",
          config.bgClass,
        )}
      >
        <h3 className="font-pixel text-[10px] text-pixel-text uppercase">
          {babyName ? `${babyName}'s Energy` : "Baby Energy"}
        </h3>
        <span
          className={clsx("font-pixel text-[8px] uppercase", config.textClass)}
        >
          {config.label}
        </span>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Warnings first */}
        {showWarnings && <WarningsList warnings={energy.warnings} />}

        {/* Main multiplier display */}
        <MultiplierDisplay
          multiplier={energy.finalMultiplier}
          status={energy.status}
        />

        {/* Energy bar */}
        <EnergyBar
          baseEnergy={energy.baseEnergy}
          effectiveEnergy={energy.effectiveEnergy}
          status={energy.status}
        />

        {/* Active effects */}
        {energy.activeEffects.length > 0 && (
          <ActiveEffectsList effects={energy.activeEffects} />
        )}

        {/* Detailed breakdown */}
        {showDetails && (
          <MultiplierBreakdown
            multipliers={energy.cappedMultipliers}
            catchUpBonus={energy.catchUpBonus}
          />
        )}

        {/* Status message */}
        <div
          className={clsx(
            "px-3 py-2",
            "border-2 border-black",
            config.bgClass,
            "text-center",
          )}
        >
          <span className={clsx("font-pixel text-[10px]", config.textClass)}>
            {config.description}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple multiplier badge for inline use
 */
export const EnergyMultiplierBadge: FC<{
  multiplier: number;
  status: EnergyStatus;
  className?: string;
}> = ({ multiplier, status, className }) => {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1",
        "px-2 py-0.5",
        "border-2 border-black",
        config.bgClass,
        "font-pixel text-[10px]",
        config.textClass,
        className,
      )}
    >
      x{multiplier.toFixed(2)}
    </span>
  );
};

export default BabyEnergyIndicator;
