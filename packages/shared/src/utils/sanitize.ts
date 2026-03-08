/**
 * @fileoverview Sanitization Utilities - Prevent XSS and data exposure
 *
 * Centralized sanitization for:
 * - HTML/SVG content
 * - URLs (remove credentials)
 * - Sensitive data in logs
 *
 * @module @bitcoinbaby/shared/utils/sanitize
 */

// ============================================================================
// HTML/SVG Sanitization
// ============================================================================

/**
 * List of allowed SVG elements for NFT rendering.
 */
const ALLOWED_SVG_ELEMENTS = new Set([
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "use",
  "symbol",
  "title",
  "desc",
  "animate",
  "animateTransform",
  "animateMotion",
  "set",
]);

/**
 * List of allowed SVG attributes.
 */
const ALLOWED_SVG_ATTRIBUTES = new Set([
  // Structure
  "id",
  "class",
  "style",
  "viewBox",
  "preserveAspectRatio",
  "xmlns",
  "xmlns:xlink",
  // Presentation
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "stroke-dashoffset",
  "opacity",
  "fill-opacity",
  "stroke-opacity",
  "transform",
  "clip-path",
  "mask",
  // Geometry
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "width",
  "height",
  "d",
  "points",
  // Text
  "font-family",
  "font-size",
  "font-weight",
  "text-anchor",
  "dominant-baseline",
  // Gradients
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientUnits",
  "gradientTransform",
  // Animation
  "dur",
  "repeatCount",
  "begin",
  "from",
  "to",
  "attributeName",
  "values",
  "keyTimes",
  "calcMode",
  // References
  "href",
  "xlink:href",
]);

/**
 * Dangerous patterns that should never appear in SVG.
 */
const DANGEROUS_PATTERNS = [
  /<script/i,
  /javascript:/i,
  /on\w+\s*=/i, // onclick, onload, etc
  /data:/i,
  /<iframe/i,
  /<object/i,
  /<embed/i,
  /<form/i,
  /expression\s*\(/i,
  /url\s*\(\s*['"]?\s*data:/i,
];

/**
 * Sanitize SVG content for safe rendering.
 *
 * @param svg - Raw SVG string
 * @returns Sanitized SVG string
 * @throws Error if SVG contains dangerous patterns
 */
export function sanitizeSVG(svg: string): string {
  // Check for dangerous patterns first
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(svg)) {
      throw new Error(
        `SVG contains dangerous pattern: ${pattern.source.slice(0, 20)}`,
      );
    }
  }

  // Parse and sanitize
  const parser = new DOMParser();
  const doc = parser.parseFromString(svg, "image/svg+xml");

  // Check for parse errors
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Invalid SVG: parse error");
  }

  const svgElement = doc.querySelector("svg");
  if (!svgElement) {
    throw new Error("Invalid SVG: no svg element found");
  }

  // Recursively sanitize elements
  sanitizeElement(svgElement);

  return svgElement.outerHTML;
}

function sanitizeElement(element: Element): void {
  // Remove disallowed elements
  const children = Array.from(element.children);
  for (const child of children) {
    if (!ALLOWED_SVG_ELEMENTS.has(child.tagName.toLowerCase())) {
      child.remove();
      continue;
    }
    sanitizeElement(child);
  }

  // Remove disallowed attributes
  const attributes = Array.from(element.attributes);
  for (const attr of attributes) {
    const attrName = attr.name.toLowerCase();

    // Remove if not in allowlist
    if (!ALLOWED_SVG_ATTRIBUTES.has(attrName)) {
      element.removeAttribute(attr.name);
      continue;
    }

    // Check attribute value for dangerous content
    const value = attr.value;
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(value)) {
        element.removeAttribute(attr.name);
        break;
      }
    }
  }
}

/**
 * Simple HTML escape for text content.
 */
export function escapeHTML(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Remove credentials from a URL.
 * Useful for sanitizing RPC URLs before persistence.
 *
 * @param url - URL that may contain credentials
 * @returns URL without username/password
 */
export function sanitizeURL(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);

    // Remove credentials
    parsed.username = "";
    parsed.password = "";

    return parsed.toString();
  } catch {
    // Invalid URL, return null
    return null;
  }
}

/**
 * Validate and sanitize an RPC URL.
 *
 * @param url - RPC URL to validate
 * @returns Sanitized URL or null if invalid
 */
export function sanitizeRPCUrl(url: string | null | undefined): string | null {
  const sanitized = sanitizeURL(url);
  if (!sanitized) return null;

  try {
    const parsed = new URL(sanitized);

    // Only allow http/https
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    // Block localhost in production
    if (
      process.env.NODE_ENV === "production" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    ) {
      console.warn("[sanitizeRPCUrl] Blocked localhost URL in production");
      return null;
    }

    return sanitized;
  } catch {
    return null;
  }
}

// ============================================================================
// Log Sanitization
// ============================================================================

/**
 * Sensitive keys that should be redacted in logs.
 */
const SENSITIVE_KEYS = new Set([
  "privatekey",
  "private_key",
  "privkey",
  "mnemonic",
  "seed",
  "secret",
  "password",
  "passwd",
  "pwd",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "auth",
  "credential",
  "wif",
]);

/**
 * Redact sensitive values from an object for safe logging.
 *
 * @param obj - Object that may contain sensitive data
 * @param depth - Max recursion depth (default: 10)
 * @returns Object with sensitive values redacted
 */
export function sanitizeForLog<T>(obj: T, depth = 10): T {
  if (depth <= 0) return "[MAX_DEPTH]" as T;
  if (obj === null || obj === undefined) return obj;

  // Handle primitives
  if (typeof obj !== "object") {
    return obj;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLog(item, depth - 1)) as T;
  }

  // Handle objects
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
      continue;
    }

    // Check if key contains sensitive word
    const containsSensitive = Array.from(SENSITIVE_KEYS).some((sensitive) =>
      lowerKey.includes(sensitive),
    );

    if (containsSensitive) {
      result[key] = "[REDACTED]";
      continue;
    }

    // Recursively sanitize nested objects
    result[key] = sanitizeForLog(value, depth - 1);
  }

  return result as T;
}

/**
 * Truncate a string for logging, showing first and last characters.
 *
 * @param str - String to truncate
 * @param showChars - Number of characters to show at start and end
 * @returns Truncated string
 */
export function truncateForLog(str: string, showChars = 4): string {
  if (str.length <= showChars * 2 + 3) {
    return str;
  }
  return `${str.slice(0, showChars)}...${str.slice(-showChars)}`;
}

/**
 * Mask a Bitcoin address for logging.
 *
 * @param address - Bitcoin address
 * @returns Masked address (e.g., "tb1q...xy8z")
 */
export function maskAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Mask a transaction ID for logging.
 *
 * @param txid - Transaction ID
 * @returns Masked txid (e.g., "abc1...f789")
 */
export function maskTxid(txid: string): string {
  if (txid.length < 12) return txid;
  return `${txid.slice(0, 4)}...${txid.slice(-4)}`;
}
