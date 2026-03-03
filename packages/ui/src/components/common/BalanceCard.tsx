"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { HelpTooltip } from "./HelpTooltip";

/**
 * BalanceCard - Standardized balance/stat display card
 *
 * Used for displaying wallet balances, token amounts, mining stats, etc.
 * Supports loading states, help tooltips, and refresh actions.
 */

interface BalanceCardProps {
  /** Label shown above the value */
  label: string;
  /** Main value to display */
  value: string | number;
  /** Optional sublabel (e.g., pending amount) */
  sublabel?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Help tooltip content */
  helpContent?: string;
  /** Help tooltip title */
  helpTitle?: string;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Color variant for the border */
  variant?: "default" | "success" | "warning" | "primary" | "secondary";
  /** Icon to show before label */
  icon?: ReactNode;
  /** Additional class names */
  className?: string;
}

const variantBorders = {
  default: "border-pixel-border",
  success: "border-pixel-success",
  warning: "border-pixel-warning",
  primary: "border-pixel-primary",
  secondary: "border-pixel-secondary",
};

export function BalanceCard({
  label,
  value,
  sublabel,
  isLoading,
  helpContent,
  helpTitle,
  onRefresh,
  isRefreshing,
  variant = "default",
  icon,
  className,
}: BalanceCardProps) {
  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium border-4 p-4",
        "shadow-[4px_4px_0_0_#000]",
        variantBorders[variant],
        className,
      )}
    >
      {/* Header with label and actions */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span className="text-sm">{icon}</span>}
          <span className="font-pixel text-[8px] text-pixel-text-muted uppercase">
            {label}
          </span>
          {helpContent && (
            <HelpTooltip content={helpContent} title={helpTitle} size="sm" />
          )}
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-primary transition-colors disabled:opacity-50"
          >
            {isRefreshing ? "..." : "↻"}
          </button>
        )}
      </div>

      {/* Value */}
      <div className="font-pixel text-lg text-pixel-text">
        {isLoading ? (
          <span className="animate-pulse text-pixel-text-muted">
            Loading...
          </span>
        ) : (
          value
        )}
      </div>

      {/* Sublabel */}
      {sublabel && (
        <p className="font-pixel text-[7px] text-pixel-text-muted mt-1">
          {sublabel}
        </p>
      )}
    </div>
  );
}

export default BalanceCard;
