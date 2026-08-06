/**
 * Game Mechanics
 *
 * Pure functions for calculating game state changes.
 */

import {
  GAME_CONFIG,
  DECAY_RATES,
  SLEEP_RATES,
  ACTION_EFFECTS,
  MINING_REWARDS,
  EVOLUTION_LEVELS,
  MINING_BONUS,
  STAGE_ORDER,
  LEVEL_DECAY,
  getXPForLevel,
  type SparkStage,
  type GameAction,
} from "./constants";
import type { SparkStats, GameSpark, SparkProgression } from "./types";

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp stats to valid range
 */
function clampStats(stats: SparkStats): SparkStats {
  return {
    energy: clamp(stats.energy, GAME_CONFIG.STAT_MIN, GAME_CONFIG.STAT_MAX),
    happiness: clamp(
      stats.happiness,
      GAME_CONFIG.STAT_MIN,
      GAME_CONFIG.STAT_MAX,
    ),
    hunger: clamp(stats.hunger, GAME_CONFIG.STAT_MIN, GAME_CONFIG.STAT_MAX),
    health: clamp(stats.health, GAME_CONFIG.STAT_MIN, GAME_CONFIG.STAT_MAX),
  };
}

/**
 * Calculate stat decay based on elapsed time
 */
export function calculateDecay(
  stats: SparkStats,
  deltaMs: number,
  isSleeping: boolean,
  isMining: boolean,
): SparkStats {
  const minutes = deltaMs / 60_000;
  const rates = isSleeping ? SLEEP_RATES : DECAY_RATES;

  let energy = stats.energy - rates.energy * minutes;
  const happiness = stats.happiness - rates.happiness * minutes;
  const hunger = stats.hunger + rates.hunger * minutes;

  // Extra energy drain while mining
  if (isMining && !isSleeping) {
    energy -= MINING_REWARDS.ENERGY_DRAIN_PER_MINUTE * minutes;
  }

  // Sleep recovers energy instead of draining it
  if (isSleeping) {
    energy = stats.energy + SLEEP_RATES.energy * minutes;
  }

  // Calculate health based on other stats
  let health = stats.health;
  const criticalStats = getCriticalStats({ energy, happiness, hunger, health });

  if (criticalStats.length > 0) {
    // Health decreases when stats are critical
    health -= criticalStats.length * 0.5 * minutes;
  } else if (health < GAME_CONFIG.STAT_MAX) {
    // Health slowly recovers when stats are good
    health += 0.2 * minutes;
  }

  return clampStats({ energy, happiness, hunger, health });
}

/**
 * Apply an action to stats
 */
export function applyAction(stats: SparkStats, action: GameAction): SparkStats {
  const effects = ACTION_EFFECTS[action];

  return clampStats({
    energy: stats.energy + (effects.energy || 0),
    happiness: stats.happiness + (effects.happiness || 0),
    hunger: stats.hunger + (effects.hunger || 0),
    health: stats.health,
  });
}

/**
 * Add XP and calculate level progression
 *
 * SECURITY: Validates all values to prevent runaway level-ups from corrupted data.
 */
export function addXP(
  progression: SparkProgression,
  xpToAdd: number,
): SparkProgression {
  // Validate inputs to prevent corruption
  let level = progression.level;
  if (typeof level !== "number" || level < 1 || level > GAME_CONFIG.MAX_LEVEL) {
    console.warn(`[addXP] Invalid level ${level}, resetting to 1`);
    level = 1;
  }

  // Ensure xpToNextLevel is valid (prevents infinite loop)
  let xpToNextLevel = progression.xpToNextLevel;
  const expectedXpToNext = getXPForLevel(level + 1);
  if (
    typeof xpToNextLevel !== "number" ||
    xpToNextLevel <= 0 ||
    xpToNextLevel !== expectedXpToNext
  ) {
    console.warn(
      `[addXP] Invalid xpToNextLevel ${xpToNextLevel}, correcting to ${expectedXpToNext}`,
    );
    xpToNextLevel = expectedXpToNext;
  }

  // Validate xpToAdd
  if (typeof xpToAdd !== "number" || xpToAdd < 0 || !isFinite(xpToAdd)) {
    console.warn(`[addXP] Invalid xpToAdd ${xpToAdd}, ignoring`);
    xpToAdd = 0;
  }

  // Cap xpToAdd to prevent exploits (max 10k XP per call)
  const maxXpPerCall = 10000;
  if (xpToAdd > maxXpPerCall) {
    console.warn(
      `[addXP] xpToAdd ${xpToAdd} exceeds max, capping to ${maxXpPerCall}`,
    );
    xpToAdd = maxXpPerCall;
  }

  let xp = (progression.xp || 0) + xpToAdd;

  // Level up while we have enough XP (with safety counter)
  let safetyCounter = 0;
  const maxLevelUps = GAME_CONFIG.MAX_LEVEL - level + 1;

  while (
    xp >= xpToNextLevel &&
    level < GAME_CONFIG.MAX_LEVEL &&
    safetyCounter < maxLevelUps
  ) {
    xp -= xpToNextLevel;
    level++;
    xpToNextLevel = getXPForLevel(level + 1);
    safetyCounter++;
  }

  // Check for stage evolution
  const stage = getStageForLevel(level);

  return {
    level,
    xp: Math.max(0, xp),
    xpToNextLevel,
    stage,
  };
}

/**
 * Get the stage for a given level
 */
export function getStageForLevel(level: number): SparkStage {
  // Find the highest stage this level qualifies for
  let resultStage: SparkStage = "egg";

  for (const stage of STAGE_ORDER) {
    if (level >= EVOLUTION_LEVELS[stage]) {
      resultStage = stage;
    } else {
      break;
    }
  }

  return resultStage;
}

/**
 * Check if evolution is available
 */
export function checkEvolution(baby: GameSpark): SparkStage | null {
  const currentStage = baby.progression.stage;
  const newStage = getStageForLevel(baby.progression.level);

  if (newStage !== currentStage) {
    return newStage;
  }

  return null;
}

/**
 * Get stats that are in critical state
 */
export function getCriticalStats(stats: SparkStats): (keyof SparkStats)[] {
  const critical: (keyof SparkStats)[] = [];

  if (stats.energy <= GAME_CONFIG.CRITICAL_THRESHOLD) {
    critical.push("energy");
  }
  if (stats.happiness <= GAME_CONFIG.CRITICAL_THRESHOLD) {
    critical.push("happiness");
  }
  if (stats.hunger >= GAME_CONFIG.STAT_MAX - GAME_CONFIG.CRITICAL_THRESHOLD) {
    critical.push("hunger");
  }
  if (stats.health <= GAME_CONFIG.CRITICAL_THRESHOLD) {
    critical.push("health");
  }

  return critical;
}

/**
 * Calculate mining bonus based on stage
 */
export function calculateMiningBonus(stage: SparkStage): number {
  return MINING_BONUS[stage];
}

/**
 * Calculate XP reward for mining shares
 */
export function calculateMiningXP(shares: number, stage: SparkStage): number {
  const bonus = calculateMiningBonus(stage);
  return Math.floor(shares * MINING_REWARDS.XP_PER_SHARE * bonus);
}

/**
 * Determine the visual state based on baby status
 */
export function determineVisualState(
  baby: GameSpark,
): GameSpark["visualState"] {
  // Dead state takes absolute priority
  if (isBabyDead(baby)) {
    return "dead";
  }

  // Critical state takes priority
  const criticalStats = getCriticalStats(baby.stats);
  if (criticalStats.includes("health") || criticalStats.length >= 2) {
    return "critical";
  }

  // Current activity states
  if (baby.isSleeping) return "sleeping";
  if (baby.isMining) return "mining";

  // Stat-based states
  if (baby.stats.hunger >= 70) return "hungry";
  if (baby.stats.happiness >= 80) return "happy";

  return "idle";
}

/**
 * Create a new baby with default stats
 *
 * @param name - Baby name
 * @param miningSharesBaseline - Current mining shares count to use as baseline
 *   (prevents XP from pre-existing mining progress)
 */
export function createNewBaby(
  name: string,
  miningSharesBaseline = 0,
): GameSpark {
  const now = Date.now();

  return {
    id: crypto.randomUUID(),
    name,
    visualState: "idle",
    isSleeping: false,
    isMining: false,
    stats: {
      energy: 100,
      happiness: 100,
      hunger: 0,
      health: 100,
    },
    progression: {
      level: 1,
      xp: 0,
      xpToNextLevel: getXPForLevel(2), // XP needed for level 2
      stage: "baby_1",
    },
    createdAt: now,
    lastUpdated: now,
    lastFed: now,
    lastPlayed: now,
    lastMined: now, // Initialize to creation time
    miningSharesBaseline, // Baseline for XP calculation
    evolutionHistory: [],
    unlockedAchievements: [],
  };
}

/**
 * Calculate offline decay (simplified for returning players)
 */
export function calculateOfflineDecay(
  stats: SparkStats,
  offlineMs: number,
  wasSleeping: boolean,
): SparkStats {
  // Cap offline time to 24 hours
  const maxOfflineMs = 24 * 60 * 60 * 1000;
  const cappedOfflineMs = Math.min(offlineMs, maxOfflineMs);

  // Apply decay at reduced rate (50%) for offline time
  // This is more forgiving for players who can't check constantly
  const effectiveMs = cappedOfflineMs * 0.5;

  return calculateDecay(stats, effectiveMs, wasSleeping, false);
}

/**
 * Calculate level decay from inactivity
 *
 * If you don't mine for a long time, your baby slowly loses XP/levels.
 * After grace period: loses XP_DECAY_PER_DAY for each day without mining.
 * Level 0 = dead baby.
 *
 * NOTE: This only affects level/mining bonus - NOT tokens.
 * Mined $BABY tokens are PERMANENT and NEVER reduced.
 */
export function calculateLevelDecay(
  progression: SparkProgression,
  lastMinedAt: number,
  now: number = Date.now(),
): { progression: SparkProgression; isDead: boolean } {
  const inactiveMs = now - lastMinedAt;

  // No decay during grace period
  if (inactiveMs <= LEVEL_DECAY.GRACE_PERIOD_MS) {
    return { progression, isDead: false };
  }

  // Calculate decay days (after grace period)
  const decayMs = inactiveMs - LEVEL_DECAY.GRACE_PERIOD_MS;
  const decayDays = Math.min(
    decayMs / (24 * 60 * 60 * 1000),
    LEVEL_DECAY.MAX_DECAY_DAYS,
  );

  // Total XP to decay
  const xpToDecay = Math.floor(decayDays * LEVEL_DECAY.XP_DECAY_PER_DAY);

  if (xpToDecay <= 0) {
    return { progression, isDead: false };
  }

  // Apply XP decay
  const newProgression = removeXP(progression, xpToDecay);

  // Check if dead (level 0)
  const isDead = newProgression.level <= 0;

  return {
    progression: newProgression,
    isDead,
  };
}

/**
 * Remove XP from progression (can cause level down)
 *
 * FIX: When leveling down from N to N-1, we recover the XP that was
 * required to reach level N (i.e., getXPForLevel(N)), not getXPForLevel(N-1).
 */
export function removeXP(
  progression: SparkProgression,
  xpToRemove: number,
): SparkProgression {
  let xp = progression.xp - xpToRemove;
  let level = progression.level;

  // Level down while we have negative XP
  while (xp < 0 && level > 0) {
    // Get XP required to reach current level BEFORE decrementing
    // e.g., if level is 2, we need XP_PER_LEVEL[2] = 75 to recover
    const xpForCurrentLevel = getXPForLevel(level);
    level--;
    xp += xpForCurrentLevel;
  }

  // Clamp at level 0
  if (level <= 0) {
    level = 0;
    xp = 0;
  }

  // Get new stage
  const stage = level > 0 ? getStageForLevel(level) : "egg";
  const xpToNextLevel = level > 0 ? getXPForLevel(level + 1) : getXPForLevel(1);

  return {
    level: Math.max(0, level),
    xp: Math.max(0, xp),
    xpToNextLevel,
    stage,
  };
}

/**
 * Check if baby is dead (level 0)
 */
export function isBabyDead(baby: GameSpark): boolean {
  return baby.progression.level <= 0;
}

/**
 * Revive a dead baby
 * Costs mining shares to revive.
 */
export function reviveBaby(baby: GameSpark): GameSpark {
  if (!isBabyDead(baby)) {
    return baby;
  }

  const now = Date.now();

  return {
    ...baby,
    visualState: "idle",
    stats: {
      energy: LEVEL_DECAY.REVIVAL_STATS.energy,
      happiness: LEVEL_DECAY.REVIVAL_STATS.happiness,
      hunger: LEVEL_DECAY.REVIVAL_STATS.hunger,
      health: LEVEL_DECAY.REVIVAL_STATS.health,
    },
    progression: {
      level: 1,
      xp: 0,
      xpToNextLevel: getXPForLevel(2),
      stage: "baby_1",
    },
    lastUpdated: now,
    lastFed: now,
    lastPlayed: now,
  };
}

/**
 * Get days until level decay starts
 */
export function getDaysUntilDecay(
  lastMinedAt: number,
  now: number = Date.now(),
): number {
  const inactiveMs = now - lastMinedAt;
  const remainingGraceMs = LEVEL_DECAY.GRACE_PERIOD_MS - inactiveMs;

  if (remainingGraceMs <= 0) {
    return 0; // Already decaying
  }

  return remainingGraceMs / (24 * 60 * 60 * 1000);
}
