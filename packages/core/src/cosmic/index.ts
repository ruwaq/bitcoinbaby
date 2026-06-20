/**
 * Cosmic System - Main Export
 *
 * This module provides:
 * - Real astronomical data (moon phases, seasons, eclipses)
 * - Balance system with caps, floors, and diminishing returns
 * - Energy calculations for Genesis Sparks
 */

// Types (BaseType, Bloodline, Heritage are canonical from ../types)
export type {
  MoonPhase,
  MoonData,
  SunData,
  Season,
  SeasonData,
  CosmicEventType,
  CosmicEvent,
  TypeMultipliers,
  BloodlineConfig,
  HeritageConfig,
  CosmicState,
  EnergyStatus,
  BabyCosmicEnergy,
  ICosmicProvider,
} from "./types";

// Constants
export { BALANCE_LIMITS } from "./types";

export {
  MOON_PHASE_EFFECTS,
  DAY_EFFECTS,
  NIGHT_EFFECTS,
  SEASON_EFFECTS,
  ECLIPSE_LUNAR_EFFECTS,
  ECLIPSE_SOLAR_EFFECTS,
  METEOR_SHOWER_EFFECTS,
  PLANETARY_ALIGNMENT_EFFECTS,
  SOLSTICE_SUMMER_EFFECTS,
  SOLSTICE_WINTER_EFFECTS,
  EQUINOX_EFFECTS,
  BLOODLINE_CONFIGS,
  HERITAGE_CONFIGS,
  RARITY_MULTIPLIERS,
  MOON_EMOJI,
  SEASON_EMOJI,
  BASE_TYPE_INFO,
} from "./constants";

export type { Rarity } from "./constants";

// Provider
export {
  AstronomyEngineProvider,
  getCosmicProvider,
  setCosmicProvider,
  type Hemisphere,
} from "./provider";

// Balance calculations
export {
  applyDiminishingReturns,
  getTypeBonus,
  getBloodlineBonus,
  getHeritageBonus,
  getLevelBonus,
  getRarityBonus,
  getCatchUpBonus,
  calculateCosmicEnergy,
  calculateCommunityTax,
  calculateFinalRewards,
} from "./balance";

// Bitcoin data
export {
  getBitcoinCosmicData,
  estimateTimeUntilHalving,
  getHalvingProgress,
  formatDifficulty,
  formatNetworkHashrate,
  clearBitcoinCache,
  type BitcoinCosmicData,
} from "./bitcoin";
