"use client";

/**
 * IconBox - Styled container for emoji/icon display
 *
 * Provides consistent sizing and styling for emoji icons.
 * Supports both emoji strings and HTML entity codes.
 *
 * SECURITY: Uses decodeHTMLEntities instead of dangerouslySetInnerHTML
 * to prevent XSS vulnerabilities while still supporting HTML entities.
 */

export interface IconBoxProps {
  /** The icon/emoji to display (emoji character or HTML entity like &#9935;) */
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

/**
 * Decode HTML numeric entities to their character equivalents.
 * Only supports numeric entities (&#NNN; or &#xHHH;) for safety.
 *
 * @example
 * decodeHTMLEntities("&#9935;") // "⛏" (pickaxe)
 * decodeHTMLEntities("&#128165;") // "💥" (explosion)
 * decodeHTMLEntities("🔥") // "🔥" (unchanged)
 */
function decodeHTMLEntities(text: string): string {
  // Match decimal entities like &#9935; or hex entities like &#x26CF;
  return text.replace(/&#(\d+);|&#x([0-9a-fA-F]+);/g, (_, dec, hex) => {
    const codePoint = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    // Only decode valid Unicode code points
    if (codePoint > 0 && codePoint <= 0x10ffff) {
      return String.fromCodePoint(codePoint);
    }
    return ""; // Invalid code point, return empty
  });
}

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

  // Decode HTML entities to actual characters (safe operation)
  const decodedIcon = decodeHTMLEntities(icon);

  return (
    <div className={classes} aria-hidden="true">
      {decodedIcon}
    </div>
  );
}

export default IconBox;
