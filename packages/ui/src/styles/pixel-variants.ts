/**
 * @fileoverview Pixel Art Design System - Semantic Style Variants
 *
 * Centralized style tokens for consistent pixel art aesthetic across BitcoinBaby.
 * Use these instead of hardcoding shadow/border values.
 *
 * @example
 * ```tsx
 * import { pixelShadows, pixelBorders, pixelCard } from "@bitcoinbaby/ui";
 *
 * // Using shadows
 * <div className={`bg-white ${pixelShadows.md}`}>Card with 4px shadow</div>
 *
 * // Using borders
 * <button className={pixelBorders.thick}>Button</button>
 *
 * // Using card presets
 * <div className={pixelCard.primary}>Primary card</div>
 * ```
 *
 * @see PIXEL_ART_DESIGN.md for full design system documentation
 */

// =============================================================================
// SHADOWS
// =============================================================================

/**
 * Pixel art shadow utilities using CSS box-shadow with black offset.
 *
 * @remarks
 * All shadows are solid black with no blur for authentic pixel art look.
 * Use active/hover variants for interactive states.
 *
 * @example
 * ```tsx
 * // Small shadow for badges
 * <span className={pixelShadows.sm}>Badge</span>
 *
 * // Medium shadow for buttons
 * <button className={`${pixelShadows.md} active:${pixelShadows.mdActive}`}>
 *   Click me
 * </button>
 *
 * // Large shadow for modals
 * <dialog className={pixelShadows.lg}>Modal content</dialog>
 * ```
 */
export const pixelShadows = {
  /**
   * Small shadow (2px offset).
   * Use for: badges, small icons, subtle depth.
   */
  sm: "shadow-[2px_2px_0_0_#000]",

  /**
   * Medium shadow (4px offset).
   * Use for: buttons, standard cards, interactive elements.
   */
  md: "shadow-[4px_4px_0_0_#000]",

  /**
   * Large shadow (8px offset).
   * Use for: modals, dialogs, featured cards, elevated content.
   */
  lg: "shadow-[8px_8px_0_0_#000]",

  /**
   * No shadow.
   * Use for: pressed states, flat elements.
   */
  none: "shadow-none",

  // -------------------------------------------------------------------------
  // Active/Pressed States
  // -------------------------------------------------------------------------

  /**
   * Active state for small shadow (1px offset).
   * Reduces shadow to simulate "pressed" effect.
   */
  smActive: "shadow-[1px_1px_0_0_#000]",

  /**
   * Active state for medium shadow (2px offset).
   * Use with active: pseudo-class on buttons.
   */
  mdActive: "shadow-[2px_2px_0_0_#000]",

  // -------------------------------------------------------------------------
  // Hover States
  // -------------------------------------------------------------------------

  /**
   * Hover reduction for small shadow.
   * Creates subtle "lift" effect on hover by reducing shadow.
   */
  smHover: "hover:shadow-[1px_1px_0_0_#000]",

  /**
   * Hover reduction for medium shadow.
   */
  mdHover: "hover:shadow-[2px_2px_0_0_#000]",
} as const;

/** Type for shadow variant keys */
export type PixelShadowVariant = keyof typeof pixelShadows;

// =============================================================================
// BORDERS
// =============================================================================

/**
 * Pixel art border utilities.
 *
 * @remarks
 * Borders use the design system colors and provide semantic variants
 * for different UI contexts.
 *
 * @example
 * ```tsx
 * // Standard card border
 * <div className={pixelBorders.medium}>Card</div>
 *
 * // Button border (black)
 * <button className={pixelBorders.thick}>Submit</button>
 *
 * // Highlighted element
 * <input className={`${pixelBorders.thin} focus:${pixelBorders.accent}`} />
 * ```
 */
export const pixelBorders = {
  /**
   * Thin border (2px).
   * Use for: subtle separators, secondary elements, nested cards.
   */
  thin: "border-2 border-pixel-border",

  /**
   * Medium border (4px).
   * Use for: standard cards, containers, primary content blocks.
   */
  medium: "border-4 border-pixel-border",

  /**
   * Thick border (4px black).
   * Use for: buttons, interactive elements, actionable items.
   */
  thick: "border-4 border-black",

  /**
   * Accent border (4px primary color).
   * Use for: highlighted elements, selected states, focus indicators.
   */
  accent: "border-4 border-pixel-primary",

  /**
   * Success border (4px green).
   * Use for: success states, confirmed actions, positive feedback.
   */
  success: "border-4 border-pixel-success",

  /**
   * Warning border (4px yellow).
   * Use for: warnings, pending states, attention-required elements.
   */
  warning: "border-4 border-pixel-warning",

  /**
   * Error border (4px red).
   * Use for: errors, invalid inputs, destructive actions.
   */
  error: "border-4 border-pixel-error",
} as const;

/** Type for border variant keys */
export type PixelBorderVariant = keyof typeof pixelBorders;

// =============================================================================
// BACKGROUNDS
// =============================================================================

/**
 * Pixel art background utilities.
 *
 * @remarks
 * Backgrounds follow a dark-to-light gradient for visual hierarchy.
 * Semantic colors are provided for status indicators.
 *
 * @example
 * ```tsx
 * // Page background
 * <main className={pixelBackgrounds.dark}>...</main>
 *
 * // Card background
 * <div className={pixelBackgrounds.medium}>...</div>
 *
 * // Hover state
 * <button className={`${pixelBackgrounds.medium} hover:${pixelBackgrounds.light}`}>
 *   Hover me
 * </button>
 * ```
 */
export const pixelBackgrounds = {
  /**
   * Dark background (#0f0f1b).
   * Use for: page background, modals, deepest layer.
   */
  dark: "bg-pixel-bg-dark",

  /**
   * Medium background (#1a1a2e).
   * Use for: cards, containers, elevated surfaces.
   */
  medium: "bg-pixel-bg-medium",

  /**
   * Light background (#2a2a3e).
   * Use for: hover states, nested elements, subtle elevation.
   */
  light: "bg-pixel-bg-light",

  /**
   * Transparent background.
   * Use for: ghost elements, overlays.
   */
  transparent: "bg-transparent",

  // -------------------------------------------------------------------------
  // Semantic Colors
  // -------------------------------------------------------------------------

  /** Primary/accent background (Bitcoin gold) */
  primary: "bg-pixel-primary",

  /** Secondary background (Baby blue) */
  secondary: "bg-pixel-secondary",

  /** Success background (green) */
  success: "bg-pixel-success",

  /** Warning background (yellow) */
  warning: "bg-pixel-warning",

  /** Error background (red) */
  error: "bg-pixel-error",

  // -------------------------------------------------------------------------
  // Muted/Semi-transparent Variants
  // -------------------------------------------------------------------------

  /** Primary at 20% opacity - subtle accent */
  primaryMuted: "bg-pixel-primary/20",

  /** Secondary at 20% opacity */
  secondaryMuted: "bg-pixel-secondary/20",

  /** Success at 20% opacity - for success banners */
  successMuted: "bg-pixel-success/20",

  /** Warning at 20% opacity - for warning banners */
  warningMuted: "bg-pixel-warning/20",

  /** Error at 20% opacity - for error banners */
  errorMuted: "bg-pixel-error/20",
} as const;

/** Type for background variant keys */
export type PixelBackgroundVariant = keyof typeof pixelBackgrounds;

// =============================================================================
// CARD PRESETS
// =============================================================================

/**
 * Pre-composed card styles combining background, border, and shadow.
 *
 * @remarks
 * Use these for consistent card styling across the application.
 * Each preset is a complete styling solution.
 *
 * @example
 * ```tsx
 * // Main content card
 * <div className={pixelCard.primary}>
 *   <h2>Title</h2>
 *   <p>Content</p>
 * </div>
 *
 * // Clickable card
 * <button className={pixelCard.interactive}>
 *   Click me
 * </button>
 * ```
 */
export const pixelCard = {
  /**
   * Primary card style.
   * Use for: main content containers, section cards, primary UI blocks.
   * Includes: medium bg, 4px border, 8px shadow.
   */
  primary: [
    "bg-pixel-bg-medium",
    "border-4 border-pixel-border",
    "shadow-[8px_8px_0_0_#000]",
  ].join(" "),

  /**
   * Secondary card style.
   * Use for: nested cards, less important content, sub-sections.
   * Includes: light bg, 2px border, 4px shadow.
   */
  secondary: [
    "bg-pixel-bg-light",
    "border-2 border-pixel-border",
    "shadow-[4px_4px_0_0_#000]",
  ].join(" "),

  /**
   * Flat card style (no shadow).
   * Use for: inline content, list items, minimal elevation.
   * Includes: medium bg, 4px border, no shadow.
   */
  flat: ["bg-pixel-bg-medium", "border-4 border-pixel-border"].join(" "),

  /**
   * Interactive card style.
   * Use for: clickable cards, selectable items, hover-enabled elements.
   * Includes: medium bg, 4px border, 4px shadow, hover border change.
   */
  interactive: [
    "bg-pixel-bg-medium",
    "border-4 border-pixel-border",
    "shadow-[4px_4px_0_0_#000]",
    "hover:border-pixel-primary",
    "transition-colors",
  ].join(" "),

  /**
   * Modal card style.
   * Use for: dialogs, modals, sheets, important overlays.
   * Includes: dark bg, primary border, 8px shadow with inset effects.
   */
  modal: [
    "bg-pixel-bg-dark",
    "border-4 border-pixel-primary",
    "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
  ].join(" "),
} as const;

/** Type for card preset keys */
export type PixelCardVariant = keyof typeof pixelCard;

// =============================================================================
// BUTTON PRESETS
// =============================================================================

/**
 * Button style utilities for custom buttons.
 *
 * @remarks
 * Use these when not using the Button component.
 * Combine base with shadow variant for complete styling.
 *
 * @example
 * ```tsx
 * <button className={`${pixelButton.base} ${pixelButton.shadow.md} bg-pixel-primary`}>
 *   Custom Button
 * </button>
 * ```
 */
export const pixelButton = {
  /**
   * Base button styles.
   * Includes: pixel font, black border, active press effect.
   */
  base: [
    "font-pixel",
    "border-4 border-black",
    "transition-transform duration-100",
    "active:translate-x-[2px] active:translate-y-[2px]",
  ].join(" "),

  /**
   * Shadow variants for buttons.
   */
  shadow: {
    /** Small shadow with active removal */
    sm: "shadow-[2px_2px_0_0_#000] active:shadow-none",
    /** Medium shadow with active reduction */
    md: "shadow-[4px_4px_0_0_#000] active:shadow-[2px_2px_0_0_#000]",
  },
} as const;

// =============================================================================
// TEXT STYLES
// =============================================================================

/**
 * Text styling utilities for pixel art typography.
 *
 * @remarks
 * Uses Press Start 2P for headers and Pixelify Sans for body text.
 *
 * @example
 * ```tsx
 * <h1 className={`${pixelText.title} ${pixelText.xl} ${pixelText.primary}`}>
 *   Title
 * </h1>
 * <p className={`${pixelText.body} ${pixelText.md} ${pixelText.muted}`}>
 *   Body text
 * </p>
 * ```
 */
export const pixelText = {
  // -------------------------------------------------------------------------
  // Font Families
  // -------------------------------------------------------------------------

  /** Pixel font for titles (Press Start 2P) */
  title: "font-pixel",

  /** Body font (Pixelify Sans) */
  body: "font-pixel-body",

  // -------------------------------------------------------------------------
  // Sizes (using Tailwind text classes)
  // -------------------------------------------------------------------------

  /** Extra small (8px) */
  xs: "text-[8px]",

  /** Small (10px) */
  sm: "text-[10px]",

  /** Medium (12px) - maps to text-xs */
  md: "text-xs",

  /** Large (14px) - maps to text-sm */
  lg: "text-sm",

  /** Extra large (18px) - maps to text-lg */
  xl: "text-lg",

  // -------------------------------------------------------------------------
  // Colors
  // -------------------------------------------------------------------------

  /** Primary text color (Bitcoin gold) */
  primary: "text-pixel-primary",

  /** Secondary text color (Baby blue) */
  secondary: "text-pixel-secondary",

  /** Muted text color */
  muted: "text-pixel-text-muted",

  /** Dark text color (for light backgrounds) */
  dark: "text-pixel-text-dark",
} as const;

/** Type for text variant keys */
export type PixelTextVariant = keyof typeof pixelText;

// =============================================================================
// ANIMATION CLASSES
// =============================================================================

/**
 * Animation utilities for pixel art interactions.
 *
 * @example
 * ```tsx
 * // Loading state
 * <div className={pixelAnimations.pulse}>Loading...</div>
 *
 * // Button press
 * <button className={pixelAnimations.press}>Click</button>
 * ```
 */
export const pixelAnimations = {
  /** Subtle pulse for loading states */
  pulse: "animate-pulse",

  /** Bounce for attention */
  bounce: "animate-bounce",

  /** Button press effect (translate down-right) */
  press: "active:translate-x-[2px] active:translate-y-[2px]",

  /** Scale on click */
  click: "active:scale-95",
} as const;

/** Type for animation variant keys */
export type PixelAnimationVariant = keyof typeof pixelAnimations;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Combines multiple class strings, filtering out falsy values.
 *
 * @param classes - Class strings to combine (can include undefined/false)
 * @returns Combined class string
 *
 * @example
 * ```tsx
 * const className = px(
 *   pixelCard.primary,
 *   isActive && pixelBorders.accent,
 *   isMuted && "opacity-50"
 * );
 * ```
 */
export function px(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}
