"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";
import { SectionHeader } from "./SectionHeader";

/**
 * SectionWrapper - Container component for tab sections
 *
 * Provides consistent layout, padding, and styling for all sections.
 * Use this to wrap your section content for uniform appearance.
 *
 * @example
 * ```tsx
 * <SectionWrapper
 *   title="Mining"
 *   description="Earn tokens with Proof of Useful Work"
 *   icon="&#9935;"
 * >
 *   <MiningContent />
 * </SectionWrapper>
 * ```
 */

export interface SectionWrapperProps {
  /** Section title displayed in header */
  title: string;
  /** Optional description below title */
  description?: string;
  /** Optional icon or emoji before title */
  icon?: ReactNode;
  /** Optional action element (button, toggle) in header */
  headerAction?: ReactNode;
  /** Optional help tooltip in header */
  helpTooltip?: ReactNode;
  /** Section content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Inner content wrapper classes */
  contentClassName?: string;
  /** Header size variant */
  headerSize?: "sm" | "md" | "lg";
  /** Maximum width of content */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
  /** Disable safe area padding (for nested sections) */
  noSafeArea?: boolean;
  /** Disable padding (for custom layouts) */
  noPadding?: boolean;
  /** Optional header below main header (for banners/alerts) */
  subHeader?: ReactNode;
  /** Optional footer */
  footer?: ReactNode;
}

const maxWidthClasses = {
  sm: "max-w-xl",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
  full: "max-w-full",
} as const;

export function SectionWrapper({
  title,
  description,
  icon,
  headerAction,
  helpTooltip,
  children,
  className,
  contentClassName,
  headerSize = "lg",
  maxWidth = "lg",
  noSafeArea = false,
  noPadding = false,
  subHeader,
  footer,
}: SectionWrapperProps) {
  return (
    <div
      className={clsx(
        // Base styling
        "bg-pixel-bg-dark min-h-screen-safe",
        // Responsive padding
        !noPadding && "p-responsive",
        // Safe areas for mobile
        !noSafeArea && "safe-x",
        className,
      )}
    >
      <div className={clsx("mx-auto", maxWidthClasses[maxWidth])}>
        {/* Section Header */}
        <SectionHeader
          title={title}
          description={description}
          icon={icon}
          action={headerAction}
          helpTooltip={helpTooltip}
          size={headerSize}
        />

        {/* Sub-header area (banners, alerts, etc.) */}
        {subHeader && <div className="mb-4">{subHeader}</div>}

        {/* Main Content */}
        <div className={clsx("space-y-6", contentClassName)}>{children}</div>

        {/* Optional Footer */}
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * SectionCard - Card container within a section
 *
 * Use for grouping related content within a SectionWrapper.
 */
export interface SectionCardProps {
  /** Card title */
  title?: string;
  /** Card description */
  description?: string;
  /** Card content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Card variant */
  variant?: "default" | "highlighted" | "muted";
  /** Show loading state */
  loading?: boolean;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  variant = "default",
  loading = false,
}: SectionCardProps) {
  return (
    <div
      className={clsx(
        // Base card styling
        "p-4 border-4",
        // Variant styles
        variant === "default" && [
          "bg-pixel-bg-medium",
          "border-pixel-border",
          "shadow-[8px_8px_0_0_#000]",
        ],
        variant === "highlighted" && [
          "bg-pixel-primary/10",
          "border-pixel-primary/50",
          "shadow-[4px_4px_0_0_#000]",
        ],
        variant === "muted" && [
          "bg-pixel-bg-light",
          "border-pixel-border/50",
          "shadow-[2px_2px_0_0_#000]",
        ],
        // Loading state
        loading && "animate-pulse",
        className,
      )}
    >
      {(title || description) && (
        <div className="mb-3">
          {title && (
            <h3 className="font-pixel text-xs text-pixel-primary uppercase">
              {title}
            </h3>
          )}
          {description && (
            <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
}

export default SectionWrapper;
