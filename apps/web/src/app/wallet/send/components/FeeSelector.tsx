"use client";

/**
 * FeeSelector Component
 *
 * Fee rate selection with slow/medium/fast options.
 * Uses real-time fee estimates from mempool.
 */

import { useMemo } from "react";
import type { FeeEstimates } from "@bitcoinbaby/bitcoin";
import { satsToBtc, formatSats } from "@/utils/format";

export type FeeLevel = "slow" | "medium" | "fast";

/**
 * Static color class mapping for Tailwind CSS
 * Tailwind requires static class names at build time - dynamic interpolation doesn't work.
 */
const colorClasses: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  "pixel-success": {
    bg: "bg-pixel-success/20",
    border: "border-pixel-success",
    text: "text-pixel-success",
  },
  "pixel-secondary": {
    bg: "bg-pixel-secondary/20",
    border: "border-pixel-secondary",
    text: "text-pixel-secondary",
  },
  "pixel-primary": {
    bg: "bg-pixel-primary/20",
    border: "border-pixel-primary",
    text: "text-pixel-primary",
  },
};

interface FeeSelectorProps {
  feeEstimates: FeeEstimates | null;
  selectedLevel: FeeLevel;
  onSelect: (level: FeeLevel, feeRate: number) => void;
  vsize: number;
  disabled?: boolean;
  isLoading?: boolean;
}

interface FeeOption {
  level: FeeLevel;
  label: string;
  description: string;
  feeRate: number;
  color: string;
}

export function FeeSelector({
  feeEstimates,
  selectedLevel,
  onSelect,
  vsize,
  disabled = false,
  isLoading = false,
}: FeeSelectorProps) {
  // Build fee options from estimates
  const feeOptions = useMemo((): FeeOption[] => {
    if (!feeEstimates) {
      // Default fallback rates (sat/vB)
      return [
        {
          level: "slow",
          label: "SLOW",
          description: "~1 hour",
          feeRate: 5,
          color: "pixel-success",
        },
        {
          level: "medium",
          label: "MEDIUM",
          description: "~30 min",
          feeRate: 10,
          color: "pixel-secondary",
        },
        {
          level: "fast",
          label: "FAST",
          description: "~10 min",
          feeRate: 20,
          color: "pixel-primary",
        },
      ];
    }

    return [
      {
        level: "slow",
        label: "SLOW",
        description: "~1 hour",
        feeRate: feeEstimates.hourFee,
        color: "pixel-success",
      },
      {
        level: "medium",
        label: "MEDIUM",
        description: "~30 min",
        feeRate: feeEstimates.halfHourFee,
        color: "pixel-secondary",
      },
      {
        level: "fast",
        label: "FAST",
        description: "~10 min",
        feeRate: feeEstimates.fastestFee,
        color: "pixel-primary",
      },
    ];
  }, [feeEstimates]);

  // Calculate total fee for each option
  const calculateTotalFee = (feeRate: number): number => {
    return Math.ceil(vsize * feeRate);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <label className="font-pixel text-[10px] text-pixel-text-muted block">
          NETWORK FEE
        </label>
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 p-3 bg-pixel-bg-dark border-4 border-pixel-border animate-pulse"
            >
              <div className="h-4 bg-pixel-bg-light rounded mb-2" />
              <div className="h-3 bg-pixel-bg-light rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label
        id="fee-selector-label"
        className="font-pixel text-[10px] text-pixel-text-muted block"
      >
        NETWORK FEE
      </label>

      <div
        className="flex gap-2"
        role="radiogroup"
        aria-labelledby="fee-selector-label"
      >
        {feeOptions.map((option) => {
          const totalFee = calculateTotalFee(option.feeRate);
          const isSelected = selectedLevel === option.level;

          return (
            <button
              key={option.level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${option.label} fee: ${option.feeRate} satoshis per virtual byte, ${option.description}`}
              onClick={() => onSelect(option.level, option.feeRate)}
              disabled={disabled}
              className={`
                flex-1 p-3 text-left
                border-4 transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
                ${
                  isSelected
                    ? `${colorClasses[option.color].bg} ${colorClasses[option.color].border} shadow-[4px_4px_0_0_#000]`
                    : "bg-pixel-bg-dark border-pixel-border hover:border-pixel-text-muted"
                }
              `}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`font-pixel text-[10px] ${
                    isSelected
                      ? colorClasses[option.color].text
                      : "text-pixel-text"
                  }`}
                >
                  {option.label}
                </span>
                {isSelected && (
                  <span className="font-pixel text-[8px] text-pixel-success">
                    OK
                  </span>
                )}
              </div>

              <p className="font-pixel text-[8px] text-pixel-text-muted mb-2">
                {option.description}
              </p>

              <div className="space-y-1">
                <p className="font-pixel text-[8px] text-pixel-text">
                  {option.feeRate} sat/vB
                </p>
                <p className="font-pixel text-[6px] text-pixel-text-muted">
                  {formatSats(totalFee)} sats
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected fee summary */}
      {selectedLevel && (
        <div className="mt-3 p-2 bg-pixel-bg-light border-2 border-pixel-border">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              TOTAL FEE:
            </span>
            <span className="font-pixel text-xs text-pixel-text">
              {satsToBtc(
                calculateTotalFee(
                  feeOptions.find((o) => o.level === selectedLevel)?.feeRate ||
                    10,
                ),
              )}{" "}
              BTC
            </span>
          </div>
          <p className="font-pixel text-[6px] text-pixel-text-muted text-right">
            (
            {formatSats(
              calculateTotalFee(
                feeOptions.find((o) => o.level === selectedLevel)?.feeRate ||
                  10,
              ),
            )}{" "}
            satoshis)
          </p>
        </div>
      )}

      {/* Fee estimate warning - prominent display */}
      {!feeEstimates && (
        <div className="mt-3 p-3 bg-pixel-warning/20 border-2 border-pixel-warning animate-pulse">
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[10px] text-pixel-warning">⚠</span>
            <div>
              <p className="font-pixel text-[8px] text-pixel-warning">
                NETWORK FEES UNAVAILABLE
              </p>
              <p className="font-pixel text-[6px] text-pixel-text-muted mt-1">
                Using default rates. Actual fees may differ.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Get fee rate for a level from estimates
 */
export function getFeeRateForLevel(
  level: FeeLevel,
  estimates: FeeEstimates | null,
): number {
  if (!estimates) {
    switch (level) {
      case "slow":
        return 5;
      case "medium":
        return 10;
      case "fast":
        return 20;
    }
  }

  switch (level) {
    case "slow":
      return estimates.hourFee;
    case "medium":
      return estimates.halfHourFee;
    case "fast":
      return estimates.fastestFee;
  }
}
