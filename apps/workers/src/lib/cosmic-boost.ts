/**
 * Cosmic Boost Calculation (Server-side)
 *
 * Calculates cosmic effects on mining based on:
 * - Moon phases
 * - Seasons
 * - Special cosmic events (solstices, equinoxes)
 *
 * These calculations use pure mathematics, no external APIs needed.
 * Range: 0.95x to 1.10x (-5% to +10%)
 */

// Cosmic calculations are pure math - no external dependencies needed

// =============================================================================
// CONSTANTS (must match client-side)
// =============================================================================

/** Moon phase effects by baby type (in percentage points) */
const MOON_PHASE_EFFECTS: Record<string, Record<string, number>> = {
  new: { mystic: 3, alien: 1, human: 0, animal: -1, robot: 0 },
  waxing_crescent: { mystic: 2, alien: 1, human: 0.5, animal: 0, robot: 0 },
  first_quarter: { mystic: 1, alien: 0.5, human: 1, animal: 1, robot: 0 },
  waxing_gibbous: { mystic: 0.5, alien: 0, human: 1, animal: 2, robot: 0.5 },
  full: { mystic: 3, alien: 2, human: 1, animal: 3, robot: -1 },
  waning_gibbous: { mystic: 1, alien: 1, human: 0.5, animal: 2, robot: 0 },
  last_quarter: { mystic: 0.5, alien: 0.5, human: 0, animal: 1, robot: 0.5 },
  waning_crescent: { mystic: 2, alien: 1, human: -0.5, animal: 0, robot: 1 },
};

/** Season effects by baby type (in percentage points) */
const SEASON_EFFECTS: Record<string, Record<string, number>> = {
  spring: { animal: 2, human: 1, mystic: 0.5, robot: 0, alien: -0.5 },
  summer: { human: 2, animal: 1, mystic: 0, robot: -1, alien: -1.5 },
  autumn: { mystic: 1.5, human: 0.5, animal: 0, robot: 1, alien: 0.5 },
  winter: { robot: 2, alien: 1, mystic: 0, human: -0.5, animal: -1 },
};

/** Special cosmic event effects */
const COSMIC_EVENT_EFFECTS: Record<string, Record<string, number>> = {
  solstice: { mystic: 2, human: 1, animal: 1, robot: 0, alien: 0 },
  equinox: { human: 2, alien: 1, mystic: 1, animal: 0, robot: 0 },
};

const MAX_BONUS = 10; // +10% max
const MAX_PENALTY = 5; // -5% max

// =============================================================================
// TYPES
// =============================================================================

export type MoonPhase =
  | "new"
  | "waxing_crescent"
  | "first_quarter"
  | "waxing_gibbous"
  | "full"
  | "waning_gibbous"
  | "last_quarter"
  | "waning_crescent";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface CosmicState {
  moonPhase: MoonPhase;
  moonIllumination: number; // 0-1
  season: Season;
  activeEvents: string[];
  timestamp: number;
}

export interface CosmicBoostData {
  totalBoostPercent: number;
  status: "thriving" | "normal" | "struggling" | "critical";
  breakdown: {
    moon: number;
    season: number;
    events: number;
  };
  state: CosmicState;
}

// =============================================================================
// ASTRONOMICAL CALCULATIONS
// =============================================================================

/**
 * Calculate moon phase using standard algorithm
 * Based on the synodic month (29.53059 days)
 */
function calculateMoonPhase(date: Date): {
  phase: MoonPhase;
  illumination: number;
} {
  // Known new moon: January 6, 2000, 18:14 UTC
  const knownNewMoon = new Date("2000-01-06T18:14:00Z").getTime();
  const synodicMonth = 29.53058867; // days

  const daysSinceNew = (date.getTime() - knownNewMoon) / (24 * 60 * 60 * 1000);
  const moonAge = ((daysSinceNew % synodicMonth) + synodicMonth) % synodicMonth;

  // Calculate illumination (0 at new moon, 1 at full moon)
  const illumination =
    (1 - Math.cos((moonAge / synodicMonth) * 2 * Math.PI)) / 2;

  // Determine phase based on moon age
  const phaseIndex = Math.floor((moonAge / synodicMonth) * 8);
  const phases: MoonPhase[] = [
    "new",
    "waxing_crescent",
    "first_quarter",
    "waxing_gibbous",
    "full",
    "waning_gibbous",
    "last_quarter",
    "waning_crescent",
  ];

  return {
    phase: phases[phaseIndex % 8],
    illumination: Math.round(illumination * 100) / 100,
  };
}

/**
 * Calculate current season based on date and hemisphere
 * Default to Northern Hemisphere
 */
function calculateSeason(date: Date): Season {
  const month = date.getMonth(); // 0-11

  // Northern hemisphere seasons
  if (month >= 2 && month <= 4) return "spring"; // Mar-May
  if (month >= 5 && month <= 7) return "summer"; // Jun-Aug
  if (month >= 8 && month <= 10) return "autumn"; // Sep-Nov
  return "winter"; // Dec-Feb
}

/**
 * Check for special cosmic events
 */
function getActiveCosmicEvents(date: Date): string[] {
  const events: string[] = [];
  const month = date.getMonth(); // 0-11
  const day = date.getDate();

  // Solstices (around June 21 and December 21)
  if (
    (month === 5 && day >= 19 && day <= 23) ||
    (month === 11 && day >= 19 && day <= 23)
  ) {
    events.push("solstice");
  }

  // Equinoxes (around March 20 and September 22)
  if (
    (month === 2 && day >= 18 && day <= 22) ||
    (month === 8 && day >= 20 && day <= 24)
  ) {
    events.push("equinox");
  }

  return events;
}

// =============================================================================
// BOOST CALCULATIONS
// =============================================================================

/**
 * Get current cosmic state
 */
export function getCosmicState(date: Date = new Date()): CosmicState {
  const moon = calculateMoonPhase(date);
  const season = calculateSeason(date);
  const events = getActiveCosmicEvents(date);

  return {
    moonPhase: moon.phase,
    moonIllumination: moon.illumination,
    season,
    activeEvents: events,
    timestamp: date.getTime(),
  };
}

/**
 * Calculate cosmic boost for a baby type
 */
export function calculateCosmicBoost(
  state: CosmicState,
  babyType: string = "human",
): CosmicBoostData {
  const type = babyType.toLowerCase();

  // Calculate each effect
  const moonEffect = MOON_PHASE_EFFECTS[state.moonPhase]?.[type] ?? 0;
  const seasonEffect = SEASON_EFFECTS[state.season]?.[type] ?? 0;

  let eventEffect = 0;
  for (const event of state.activeEvents) {
    eventEffect += COSMIC_EVENT_EFFECTS[event]?.[type] ?? 0;
  }

  // Sum and clamp
  let totalEffect = moonEffect + seasonEffect + eventEffect;
  totalEffect = Math.max(-MAX_PENALTY, Math.min(MAX_BONUS, totalEffect));

  // Determine status
  let status: CosmicBoostData["status"];
  if (totalEffect >= 3) status = "thriving";
  else if (totalEffect >= 0) status = "normal";
  else if (totalEffect >= -2) status = "struggling";
  else status = "critical";

  return {
    totalBoostPercent: totalEffect,
    status,
    breakdown: {
      moon: moonEffect,
      season: seasonEffect,
      events: eventEffect,
    },
    state,
  };
}

/**
 * Get cosmic multiplier from boost percentage
 */
export function getCosmicMultiplier(boostPercent: number): number {
  return 1 + boostPercent / 100;
}

/**
 * Get cosmic boost data for a user/baby
 * The babyType should come from the user's NFT or baby state
 */
export function getCosmicBoostData(
  babyType: string = "human",
): CosmicBoostData {
  const state = getCosmicState();
  return calculateCosmicBoost(state, babyType);
}
