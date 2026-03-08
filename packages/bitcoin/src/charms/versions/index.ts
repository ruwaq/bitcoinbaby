/**
 * Charms Protocol Versions
 *
 * Centralized exports for all Charms spell versions.
 * Import specific versions or use the factory for version detection.
 *
 * @example
 * // Import specific version
 * import { createPoWMintSpellV9 } from './versions/v9';
 *
 * // Import all versions
 * import { v9, v10, v11, detectSpellVersion } from './versions';
 *
 * // Use factory
 * import { createSpellFactory } from './versions';
 * const factory = createSpellFactory(11);
 */

// Shared utilities
export * from "./shared";

// Version-specific modules
export * as v9 from "./v9";
export * as v10 from "./v10";
export * as v11 from "./v11";

// Re-export commonly used types
export type {
  SpellV9,
  SpellV9Input,
  SpellV9Output,
  PoWPrivateInputs,
  PoWMintSpellParams,
} from "./v9";
export type {
  SpellV10,
  SpellV10Input,
  SpellV10Output,
  MiningMintSpellParams,
  MiningPrivateInputs,
} from "./v10";
export type {
  SpellV11,
  SpellV11Transaction,
  SpellV11Output,
  PoWPrivateInputsV11,
  ProverRequestV11,
} from "./v11";

// Re-export spell creation functions
export { createPoWMintSpellV9 } from "./v9";
export {
  createMiningMintSpellV10,
  createTokenTransferSpellV10,
  createBatchTransferSpellV10,
} from "./v10";

// =============================================================================
// FACTORY
// =============================================================================

import type { SpellVersion } from "./shared";
import { detectSpellVersion } from "./shared";

/**
 * Union type for all spell versions
 */
import type { SpellV9 } from "./v9";
import type { SpellV10 } from "./v10";
import type { SpellV11 } from "./v11";

export type Spell = SpellV9 | SpellV10 | SpellV11;

/**
 * Get the version of any spell
 */
export { detectSpellVersion };

/**
 * Check if a spell is V9 format
 */
export function isSpellV9(spell: Spell): spell is SpellV9 {
  return detectSpellVersion(spell) === 9;
}

/**
 * Check if a spell is V10 format
 */
export function isSpellV10(spell: Spell): spell is SpellV10 {
  return detectSpellVersion(spell) === 10;
}

/**
 * Check if a spell is V11 format
 */
export function isSpellV11(spell: Spell): spell is SpellV11 {
  return detectSpellVersion(spell) === 11;
}

/**
 * Get recommended version for new spells
 */
export function getRecommendedVersion(): SpellVersion {
  return 11; // V11 is current
}
