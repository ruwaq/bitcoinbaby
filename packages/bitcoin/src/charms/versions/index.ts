/**
 * Charms Protocol Versions
 *
 * Centralized exports for all Charms spell versions.
 * V9 and V10 have been deprecated and removed.
 * V11 is the current recommended version.
 *
 * @example
 * // Import V11
 * import { v11, detectSpellVersion } from './versions';
 *
 * // Import specific version
 * import { createSpellFactory } from './versions';
 * const factory = createSpellFactory(11);
 */

// Shared utilities
export * from "./shared";

// Current version
export * as v11 from "./v11";

// Re-export spell types
export type {
  SpellV11,
  SpellV11Transaction,
  SpellV11Output,
  PoWPrivateInputsV11,
  ProverRequestV11,
} from "./v11";

// =============================================================================
// FACTORY
// =============================================================================

import type { SpellVersion } from "./shared";
import { detectSpellVersion } from "./shared";
import type { SpellV11 } from "./v11";

/** V11 is the only active spell version */
export type Spell = SpellV11;

export { detectSpellVersion };

/** Check if a spell is V11 format */
export function isSpellV11(spell: Spell): spell is SpellV11 {
  return detectSpellVersion(spell) === 11;
}

/** Get recommended version for new spells */
export function getRecommendedVersion(): SpellVersion {
  return 11;
}