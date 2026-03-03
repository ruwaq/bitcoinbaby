"use client";

/**
 * IconBox - Styled container for emoji/icon display
 *
 * Provides consistent sizing and styling for emoji icons.
 * Supports both emoji strings and HTML entity codes.
 */

export interface IconBoxProps {
  /** The icon/emoji to display */
  icon: string;
  /** Size variant */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  /** Optional animation */
  animate?: "float" | "bounce" | "pulse" | "spin" | "none";
  /** Additional classes */
  className?: string;
}

const sizeClasses = {
  xs: "text-lg",
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-4xl",
  xl: "text-5xl",
  "2xl": "text-6xl",
} as const;

const animationClasses = {
  float: "animate-pixel-float",
  bounce: "animate-bounce",
  pulse: "animate-pulse",
  spin: "animate-spin",
  none: "",
} as const;

export function IconBox({
  icon,
  size = "md",
  animate = "none",
  className,
}: IconBoxProps) {
  const classes = [
    "select-none",
    sizeClasses[size],
    animationClasses[animate],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      dangerouslySetInnerHTML={{ __html: icon }}
      aria-hidden="true"
    />
  );
}

export default IconBox;
