"use client";

/**
 * LoadingSpinner - Pixel art loading indicator
 *
 * Uses the classic border-based spinner with configurable size and color.
 */

export interface LoadingSpinnerProps {
  /** Size of the spinner */
  size?: "sm" | "md" | "lg" | "xl";
  /** Color variant */
  variant?: "primary" | "secondary" | "success" | "warning" | "error" | "muted";
  /** Additional classes */
  className?: string;
  /** Optional label shown below spinner */
  label?: string;
}

const sizeClasses = {
  sm: "w-6 h-6 border-2",
  md: "w-10 h-10 border-4",
  lg: "w-12 h-12 border-4",
  xl: "w-16 h-16 border-4",
} as const;

const colorClasses = {
  primary: "border-pixel-primary",
  secondary: "border-pixel-secondary",
  success: "border-pixel-success",
  warning: "border-pixel-warning",
  error: "border-pixel-error",
  muted: "border-pixel-text-muted",
} as const;

export function LoadingSpinner({
  size = "md",
  variant = "primary",
  className,
  label,
}: LoadingSpinnerProps) {
  const containerClasses = ["flex flex-col items-center", className]
    .filter(Boolean)
    .join(" ");

  const spinnerClasses = [
    "animate-spin border-t-transparent",
    sizeClasses[size],
    colorClasses[variant],
  ].join(" ");

  return (
    <div className={containerClasses}>
      <div className={spinnerClasses} role="status" aria-label="Loading" />
      {label && (
        <span className="mt-2 font-pixel text-pixel-2xs text-pixel-text-muted">
          {label}
        </span>
      )}
    </div>
  );
}

export default LoadingSpinner;
