/**
 * Shared Utilities for Charms Spell Creation
 *
 * Constants and helper functions used across all Charms versions.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum dust limit for Bitcoin outputs */
export const DUST_LIMIT = 546;

/** Minimum sats for spell outputs */
export const MIN_SPELL_OUTPUT_SATS = 700;

/** Current Charms protocol version */
export const CHARMS_PROTOCOL_VERSION = 11;

// =============================================================================
// APP REFERENCE
// =============================================================================

/**
 * App type prefix
 * - "n/" = Non-fungible (NFT)
 * - "t/" = Token (fungible)
 */
export type AppType = "n" | "t";

export interface AppReference {
  type: AppType;
  appId: string;
  verificationKey: string;
}

/**
 * Create app reference string
 * @example createAppReference("t", "abc123", "def456") => "t/abc123/def456"
 */
export function createAppReference(
  type: AppType,
  appId: string,
  vk: string,
): string {
  return `${type}/${appId}/${vk}`;
}

/**
 * Parse app reference from string like "n/<app_id>/<vk>"
 */
export function parseAppReference(ref: string): AppReference {
  const parts = ref.split("/");
  if (parts.length !== 3) {
    throw new Error(`Invalid app reference: ${ref}`);
  }

  const type = parts[0] as AppType;
  if (type !== "n" && type !== "t") {
    throw new Error(`Invalid app type: ${type}`);
  }

  return {
    type,
    appId: parts[1],
    verificationKey: parts[2],
  };
}

// =============================================================================
// VERSION DETECTION
// =============================================================================

/**
 * Supported Charms spell versions
 */
export type SpellVersion = 9 | 10 | 11;

/**
 * Detect the version of a spell object
 */
export function detectSpellVersion(spell: unknown): SpellVersion | null {
  if (!spell || typeof spell !== "object") {
    return null;
  }

  const obj = spell as Record<string, unknown>;

  // V11 has version: 11 and tx field
  if (obj.version === 11 && "tx" in obj) {
    return 11;
  }

  // V10 has version: 10 field
  if (obj.version === 10) {
    return 10;
  }

  // V9 has no version field, but has apps/ins/outs
  if ("apps" in obj && "ins" in obj && "outs" in obj && !("version" in obj)) {
    return 9;
  }

  return null;
}
