"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

/**
 * TabButton - Pixel art styled tab button
 *
 * Used for sub-navigation within sections.
 * Supports active state with variant colors.
 */

interface TabButtonProps {
  /** Tab content (text or element) */
  children: ReactNode;
  /** Whether this tab is active */
  active?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Color variant when active */
  variant?: "primary" | "success" | "secondary" | "warning";
  /** Disabled state */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
}

const activeVariants = {
  primary:
    "bg-pixel-primary text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]",
  success:
    "bg-pixel-success text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]",
  secondary:
    "bg-pixel-secondary text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]",
  warning:
    "bg-pixel-warning text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]",
};

const hoverVariants = {
  primary: "hover:border-pixel-primary",
  success: "hover:border-pixel-success",
  secondary: "hover:border-pixel-secondary",
  warning: "hover:border-pixel-warning",
};

export function TabButton({
  children,
  active = false,
  onClick,
  variant = "primary",
  disabled = false,
  className,
}: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={clsx(
        "font-pixel text-[9px] uppercase px-4 py-2 border-4 transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        active
          ? activeVariants[variant]
          : clsx(
              "bg-pixel-bg-medium text-pixel-text border-pixel-border",
              hoverVariants[variant],
            ),
        className,
      )}
    >
      {children}
    </button>
  );
}

export default TabButton;
