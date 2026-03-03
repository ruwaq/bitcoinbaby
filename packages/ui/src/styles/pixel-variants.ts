/**
 * Pixel Art Design System - Semantic Style Variants
 *
 * Centralized style tokens for consistent pixel art aesthetic.
 * Use these instead of hardcoding shadow/border values.
 */

// =============================================================================
// SHADOWS
// =============================================================================

export const pixelShadows = {
  /** 2px offset - small elements, badges */
  sm: "shadow-[2px_2px_0_0_#000]",
  /** 4px offset - buttons, cards */
  md: "shadow-[4px_4px_0_0_#000]",
  /** 8px offset - modals, featured cards */
  lg: "shadow-[8px_8px_0_0_#000]",
  /** No shadow */
  none: "shadow-none",

  // Active/pressed states
  smActive: "shadow-[1px_1px_0_0_#000]",
  mdActive: "shadow-[2px_2px_0_0_#000]",

  // Hover states (reduced)
  smHover: "hover:shadow-[1px_1px_0_0_#000]",
  mdHover: "hover:shadow-[2px_2px_0_0_#000]",
} as const;

// =============================================================================
// BORDERS
// =============================================================================

export const pixelBorders = {
  /** 2px - subtle, secondary elements */
  thin: "border-2 border-pixel-border",
  /** 4px - standard cards and containers */
  medium: "border-4 border-pixel-border",
  /** 4px black - buttons, interactive elements */
  thick: "border-4 border-black",
  /** 4px accent - highlighted/active elements */
  accent: "border-4 border-pixel-primary",
  /** 4px success */
  success: "border-4 border-pixel-success",
  /** 4px warning */
  warning: "border-4 border-pixel-warning",
  /** 4px error */
  error: "border-4 border-pixel-error",
} as const;

// =============================================================================
// BACKGROUNDS
// =============================================================================

export const pixelBackgrounds = {
  /** Darkest - page background */
  dark: "bg-pixel-bg-dark",
  /** Medium - card backgrounds */
  medium: "bg-pixel-bg-medium",
  /** Lightest - hover states, nested elements */
  light: "bg-pixel-bg-light",
  /** Transparent */
  transparent: "bg-transparent",

  // Semantic backgrounds
  primary: "bg-pixel-primary",
  secondary: "bg-pixel-secondary",
  success: "bg-pixel-success",
  warning: "bg-pixel-warning",
  error: "bg-pixel-error",

  // With opacity
  primaryMuted: "bg-pixel-primary/20",
  secondaryMuted: "bg-pixel-secondary/20",
  successMuted: "bg-pixel-success/20",
  warningMuted: "bg-pixel-warning/20",
  errorMuted: "bg-pixel-error/20",
} as const;

// =============================================================================
// CARD PRESETS
// =============================================================================

export const pixelCard = {
  /** Primary card - main content containers */
  primary: [
    "bg-pixel-bg-medium",
    "border-4 border-pixel-border",
    "shadow-[8px_8px_0_0_#000]",
  ].join(" "),

  /** Secondary card - nested/less important */
  secondary: [
    "bg-pixel-bg-light",
    "border-2 border-pixel-border",
    "shadow-[4px_4px_0_0_#000]",
  ].join(" "),

  /** Flat card - no shadow */
  flat: ["bg-pixel-bg-medium", "border-4 border-pixel-border"].join(" "),

  /** Interactive card - with hover effect */
  interactive: [
    "bg-pixel-bg-medium",
    "border-4 border-pixel-border",
    "shadow-[4px_4px_0_0_#000]",
    "hover:border-pixel-primary",
    "transition-colors",
  ].join(" "),

  /** Modal card - elevated */
  modal: [
    "bg-pixel-bg-dark",
    "border-4 border-pixel-primary",
    "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
  ].join(" "),
} as const;

// =============================================================================
// BUTTON PRESETS (for custom buttons not using Button component)
// =============================================================================

export const pixelButton = {
  base: [
    "font-pixel",
    "border-4 border-black",
    "transition-transform duration-100",
    "active:translate-x-[2px] active:translate-y-[2px]",
  ].join(" "),

  shadow: {
    sm: "shadow-[2px_2px_0_0_#000] active:shadow-none",
    md: "shadow-[4px_4px_0_0_#000] active:shadow-[2px_2px_0_0_#000]",
  },
} as const;

// =============================================================================
// TEXT STYLES
// =============================================================================

export const pixelText = {
  /** Titles and headers */
  title: "font-pixel",
  /** Body text */
  body: "font-pixel-body",

  // Sizes
  xs: "text-[8px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-lg",

  // Colors
  primary: "text-pixel-primary",
  secondary: "text-pixel-secondary",
  muted: "text-pixel-text-muted",
  dark: "text-pixel-text-dark",
} as const;

// =============================================================================
// ANIMATION CLASSES
// =============================================================================

export const pixelAnimations = {
  /** Subtle pulse for loading states */
  pulse: "animate-pulse",
  /** Bounce for attention */
  bounce: "animate-bounce",
  /** Button press effect */
  press: "active:translate-x-[2px] active:translate-y-[2px]",
  /** Scale on click */
  click: "active:scale-95",
} as const;

// =============================================================================
// UTILITY: Combine classes
// =============================================================================

export function px(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
