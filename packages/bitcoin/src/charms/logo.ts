/**
 * BitcoinBaby Logo Generator
 *
 * Generates pixel art logos for Charms metadata.
 * 32x32 pixels, optimized for on-chain storage.
 */

// =============================================================================
// SPARK TOKEN LOGO
// =============================================================================

/**
 * $SPARK Token Logo - 32x32 pixel art
 *
 * Design: Baby face with Bitcoin orange theme
 * - Orange background gradient
 * - Cute baby face
 * - "B" symbol overlay
 *
 * Generated as base64 PNG for Charms metadata.
 */
export const SPARK_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Background - Bitcoin Orange Circle -->
  <circle cx="16" cy="16" r="15" fill="#f7931a"/>
  <circle cx="16" cy="16" r="13" fill="#ffb84d"/>

  <!-- Baby Face -->
  <circle cx="16" cy="16" r="10" fill="#ffe4c4"/>

  <!-- Eyes -->
  <circle cx="12" cy="14" r="2" fill="#1a1a2e"/>
  <circle cx="20" cy="14" r="2" fill="#1a1a2e"/>
  <circle cx="11.5" cy="13.5" r="0.6" fill="#fff"/>
  <circle cx="19.5" cy="13.5" r="0.6" fill="#fff"/>

  <!-- Smile -->
  <path d="M12 19 Q16 22 20 19" fill="none" stroke="#8b5a2b" stroke-width="1" stroke-linecap="round"/>

  <!-- Cheeks -->
  <circle cx="9" cy="17" r="1.5" fill="#ffb6c1" opacity="0.5"/>
  <circle cx="23" cy="17" r="1.5" fill="#ffb6c1" opacity="0.5"/>

  <!-- Bitcoin B overlay (subtle) -->
  <text x="16" y="28" font-family="Arial" font-size="6" font-weight="bold" fill="#f7931a" text-anchor="middle">B</text>

  <!-- Border -->
  <circle cx="16" cy="16" r="15" fill="none" stroke="#c67307" stroke-width="1"/>
</svg>`;

/**
 * Genesis Sparks Collection Logo
 */
export const GENESIS_SPARKS_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <!-- Background - Dark space -->
  <rect width="32" height="32" fill="#0f0f1b"/>

  <!-- Stars -->
  <circle cx="5" cy="5" r="0.5" fill="#fff"/>
  <circle cx="27" cy="8" r="0.5" fill="#fff"/>
  <circle cx="10" cy="28" r="0.5" fill="#fff"/>
  <circle cx="25" cy="25" r="0.5" fill="#fff"/>

  <!-- Baby silhouette -->
  <circle cx="16" cy="14" r="8" fill="#f7931a"/>
  <circle cx="16" cy="14" r="6" fill="#ffcc99"/>

  <!-- Eyes -->
  <circle cx="13" cy="13" r="1.5" fill="#1a1a2e"/>
  <circle cx="19" cy="13" r="1.5" fill="#1a1a2e"/>
  <circle cx="12.7" cy="12.7" r="0.4" fill="#fff"/>
  <circle cx="18.7" cy="12.7" r="0.4" fill="#fff"/>

  <!-- Body -->
  <ellipse cx="16" cy="24" rx="6" ry="5" fill="#ffcc99"/>

  <!-- Crown (rare indicator) -->
  <polygon points="10,7 12,9 14,7 16,9 18,7 20,9 22,7 22,9 10,9" fill="#ffd700"/>

  <!-- Glow effect -->
  <circle cx="16" cy="16" r="14" fill="none" stroke="#f7931a" stroke-width="0.5" opacity="0.5"/>
</svg>`;

/**
 * Convert SVG to base64 data URI (browser environment)
 */
export function svgToBase64DataUri(svg: string): string {
  // Clean SVG and encode
  const cleaned = svg.replace(/\n\s*/g, "").trim();
  const encoded = btoa(unescape(encodeURIComponent(cleaned)));
  return `data:image/svg+xml;base64,${encoded}`;
}

/**
 * Get SPARK token logo as base64 data URI
 */
export function getSPARKLogoDataUri(): string {
  return svgToBase64DataUri(SPARK_LOGO_SVG);
}

/**
 * Get Genesis Sparks collection logo as base64 data URI
 */
export function getGenesisBabiesLogoDataUri(): string {
  return svgToBase64DataUri(GENESIS_SPARKS_LOGO_SVG);
}

// =============================================================================
// PRE-COMPUTED BASE64 (for environments without btoa)
// =============================================================================

/**
 * Pre-computed base64 of SPARK logo SVG
 * Use this for server-side/build-time embedding
 */
export const SPARK_LOGO_BASE64 =
  "PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiIgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNSIgZmlsbD0iI2Y3OTMxYSIvPjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjEzIiBmaWxsPSIjZmZiODRkIi8+PGNpcmNsZSBjeD0iMTYiIGN5PSIxNiIgcj0iMTAiIGZpbGw9IiNmZmU0YzQiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjE0IiByPSIyIiBmaWxsPSIjMWExYTJlIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSIxNCIgcj0iMiIgZmlsbD0iIzFhMWEyZSIvPjxjaXJjbGUgY3g9IjExLjUiIGN5PSIxMy41IiByPSIwLjYiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIxOS41IiBjeT0iMTMuNSIgcj0iMC42IiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTEyIDE5IFExNiAyMiAyMCAxOSIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjOGI1YTJiIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjxjaXJjbGUgY3g9IjkiIGN5PSIxNyIgcj0iMS41IiBmaWxsPSIjZmZiNmMxIiBvcGFjaXR5PSIwLjUiLz48Y2lyY2xlIGN4PSIyMyIgY3k9IjE3IiByPSIxLjUiIGZpbGw9IiNmZmI2YzEiIG9wYWNpdHk9IjAuNSIvPjx0ZXh0IHg9IjE2IiB5PSIyOCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjYiIGZvbnQtd2VpZ2h0PSJib2xkIiBmaWxsPSIjZjc5MzFhIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5CPC90ZXh0PjxjaXJjbGUgY3g9IjE2IiBjeT0iMTYiIHI9IjE1IiBmaWxsPSJub25lIiBzdHJva2U9IiNjNjczMDciIHN0cm9rZS13aWR0aD0iMSIvPjwvc3ZnPg==";

/**
 * Full data URI for SPARK logo (ready to use in metadata)
 */
export const SPARK_LOGO_DATA_URI = `data:image/svg+xml;base64,${SPARK_LOGO_BASE64}`;
