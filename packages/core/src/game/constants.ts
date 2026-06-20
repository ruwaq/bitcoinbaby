/**
 * Game Constants
 *
 * Configuration values for the Tamagotchi game mechanics.
 * 21 evolution stages with smooth progression.
 */

/**
 * Evolution stages (21 total)
 * Grouped into 7 visual forms with 3 variants each
 */
export type SparkStage =
  // Egg phase (Lvl 0)
  | 'egg'
  // Baby phase (Lvl 1-3)
  | 'baby_1' | 'baby_2' | 'baby_3'
  // Child phase (Lvl 4-6)
  | 'child_1' | 'child_2' | 'child_3'
  // Teen phase (Lvl 7-9)
  | 'teen_1' | 'teen_2' | 'teen_3'
  // Young Adult phase (Lvl 10-12)
  | 'young_1' | 'young_2' | 'young_3'
  // Adult phase (Lvl 13-17)
  | 'adult_1' | 'adult_2' | 'adult_3'
  // Master phase (Lvl 18-20)
  | 'master_1' | 'master_2' | 'master_3'
  // Legend (Lvl 21)
  | 'legend';

/**
 * Visual sprite form (simplified for rendering)
 */
export type SparkSpriteForm = 'egg' | 'baby' | 'child' | 'teen' | 'young' | 'adult' | 'master' | 'legend';

/**
 * Baby visual/behavioral states
 */
export type SparkVisualState =
  | 'idle'
  | 'happy'
  | 'sleeping'
  | 'hungry'
  | 'mining'
  | 'learning'
  | 'evolving'
  | 'critical'
  | 'dead'; // Level 0 - needs revival

/**
 * Player actions
 */
export type GameAction = 'feed' | 'play' | 'sleep' | 'wake' | 'learn' | 'mine';

/**
 * Game configuration
 */
export const GAME_CONFIG = {
  // Tick interval in milliseconds
  TICK_INTERVAL: 10_000, // 10 seconds

  // Auto-save interval
  SAVE_INTERVAL: 30_000, // 30 seconds

  // Stats range
  STAT_MIN: 0,
  STAT_MAX: 100,

  // Critical threshold
  CRITICAL_THRESHOLD: 20,

  // Max level
  MAX_LEVEL: 21,
} as const;

/**
 * XP requirements per level
 * - Levels 1-6: Very fast (motivation phase)
 * - Levels 7-12: Medium progression
 * - Levels 13-21: Gradually harder
 */
export const XP_PER_LEVEL: Record<number, number> = {
  1: 50,      // 50 total XP (instant gratification)
  2: 75,      // 125 total
  3: 100,     // 225 total
  4: 125,     // 350 total
  5: 150,     // 500 total
  6: 175,     // 675 total (still easy)
  7: 250,     // 925 total (difficulty starts)
  8: 350,     // 1,275 total
  9: 450,     // 1,725 total
  10: 600,    // 2,325 total
  11: 800,    // 3,125 total
  12: 1000,   // 4,125 total
  13: 1250,   // 5,375 total
  14: 1500,   // 6,875 total
  15: 1800,   // 8,675 total
  16: 2100,   // 10,775 total
  17: 2500,   // 13,275 total
  18: 3000,   // 16,275 total
  19: 3500,   // 19,775 total
  20: 4000,   // 23,775 total
  21: 5000,   // 28,775 total to max
};

/**
 * Get XP required for a level (with fallback)
 */
export function getXPForLevel(level: number): number {
  return XP_PER_LEVEL[level] ?? 5000;
}

/**
 * Stat decay rates per minute while awake
 */
export const DECAY_RATES = {
  energy: 1.0,
  happiness: 0.5,
  hunger: 1.0,
} as const;

/**
 * Stat recovery rates while sleeping
 */
export const SLEEP_RATES = {
  energy: 3.0,
  happiness: -0.2,
  hunger: 0.5,
} as const;

/**
 * Action effects on stats
 */
export const ACTION_EFFECTS: Record<GameAction, Partial<{
  energy: number;
  happiness: number;
  hunger: number;
  xp: number;
}>> = {
  feed: { hunger: -30, happiness: 5 },
  play: { happiness: 15, energy: -5 },
  sleep: {},
  wake: { happiness: 2 },
  learn: { xp: 15, energy: -10, happiness: -2 },
  mine: {},
} as const;

/**
 * Mining XP rewards
 */
export const MINING_REWARDS = {
  XP_PER_SHARE: 10,
  XP_PER_10K_HASHES: 1,
  ENERGY_DRAIN_PER_MINUTE: 2,
} as const;

/**
 * Stage evolution levels
 */
export const EVOLUTION_LEVELS: Record<SparkStage, number> = {
  egg: 0,
  baby_1: 1,
  baby_2: 2,
  baby_3: 3,
  child_1: 4,
  child_2: 5,
  child_3: 6,
  teen_1: 7,
  teen_2: 8,
  teen_3: 9,
  young_1: 10,
  young_2: 11,
  young_3: 12,
  adult_1: 13,
  adult_2: 14,
  adult_3: 15,
  master_1: 16,
  master_2: 17,
  master_3: 18,
  // Levels 19-20 stay at master_3, then legend at 21
  legend: 21,
} as const;

/**
 * All stages in order
 */
export const STAGE_ORDER: SparkStage[] = [
  'egg',
  'baby_1', 'baby_2', 'baby_3',
  'child_1', 'child_2', 'child_3',
  'teen_1', 'teen_2', 'teen_3',
  'young_1', 'young_2', 'young_3',
  'adult_1', 'adult_2', 'adult_3',
  'master_1', 'master_2', 'master_3',
  'legend',
];

/**
 * Mining bonus multipliers (smooth scaling)
 */
export const MINING_BONUS: Record<SparkStage, number> = {
  egg: 0,
  baby_1: 1.00,
  baby_2: 1.02,
  baby_3: 1.05,
  child_1: 1.08,
  child_2: 1.10,
  child_3: 1.12,
  teen_1: 1.15,
  teen_2: 1.18,
  teen_3: 1.20,
  young_1: 1.25,
  young_2: 1.28,
  young_3: 1.30,
  adult_1: 1.35,
  adult_2: 1.40,
  adult_3: 1.45,
  master_1: 1.50,
  master_2: 1.55,
  master_3: 1.60,
  legend: 2.00, // Legendary bonus
} as const;

/**
 * Stage display names (Spanish)
 */
export const STAGE_NAMES: Record<SparkStage, string> = {
  egg: 'Huevo de Código',
  baby_1: 'Bebe Nodo I',
  baby_2: 'Bebe Nodo II',
  baby_3: 'Bebe Nodo III',
  child_1: 'Niño Bloque I',
  child_2: 'Niño Bloque II',
  child_3: 'Niño Bloque III',
  teen_1: 'Cypher-Joven I',
  teen_2: 'Cypher-Joven II',
  teen_3: 'Cypher-Joven III',
  young_1: 'Hash Guerrero I',
  young_2: 'Hash Guerrero II',
  young_3: 'Hash Guerrero III',
  adult_1: 'Cadena Adulto I',
  adult_2: 'Cadena Adulto II',
  adult_3: 'Cadena Adulto III',
  master_1: 'Maestro Nodo I',
  master_2: 'Maestro Nodo II',
  master_3: 'Maestro Nodo III',
  legend: 'Satoshi Legendario',
} as const;

/**
 * Get sprite form for a stage
 */
export function getSpriteForm(stage: SparkStage): SparkSpriteForm {
  if (stage === 'egg') return 'egg';
  if (stage === 'legend') return 'legend';
  if (stage.startsWith('baby_')) return 'baby';
  if (stage.startsWith('child_')) return 'child';
  if (stage.startsWith('teen_')) return 'teen';
  if (stage.startsWith('young_')) return 'young';
  if (stage.startsWith('adult_')) return 'adult';
  if (stage.startsWith('master_')) return 'master';
  return 'baby';
}

/**
 * Get sub-variant number (1, 2, or 3)
 */
export function getStageVariant(stage: SparkStage): number {
  if (stage === 'egg' || stage === 'legend') return 1;
  const parts = stage.split('_');
  return parseInt(parts[1] || '1', 10);
}

/**
 * Egg incubation time
 */
export const EGG_INCUBATION_TIME = 15_000; // 15 seconds for demo

/**
 * Level decay configuration (for inactive players)
 *
 * If you don't mine for a long time, XP slowly drains.
 * Reaching level 0 = "dead" baby that needs revival.
 *
 * IMPORTANT: This ONLY affects the baby's level and mining bonus.
 * Mined $BABY tokens are NEVER lost or reduced.
 * Once tokens are mined, they belong to the user forever on the blockchain.
 */
export const LEVEL_DECAY = {
  // Time without mining before decay starts (7 days)
  GRACE_PERIOD_MS: 7 * 24 * 60 * 60 * 1000,

  // XP lost per day after grace period
  XP_DECAY_PER_DAY: 100,

  // Maximum days of decay (caps at 30 days of inactivity)
  MAX_DECAY_DAYS: 30,

  // XP cost to revive a dead baby
  REVIVAL_XP_COST: 500,

  // Stats after revival
  REVIVAL_STATS: {
    energy: 50,
    happiness: 30,
    hunger: 50,
    health: 50,
  },
} as const;
