/**
 * Game Types
 *
 * Type definitions for the Tamagotchi game system.
 */

import type { SparkStage, SparkVisualState } from "./constants";

/**
 * Baby stats that change over time
 */
export interface SparkStats {
  energy: number; // 0-100, depletes with activity
  happiness: number; // 0-100, depletes over time
  hunger: number; // 0-100, increases over time (100 = starving)
  health: number; // 0-100, affected by other critical stats
}

/**
 * Baby progression data
 */
export interface SparkProgression {
  level: number;
  xp: number;
  xpToNextLevel: number;
  stage: SparkStage;
}

/**
 * Complete Baby entity for the game
 */
export interface GameSpark {
  // Identity
  id: string;
  name: string;

  // Current state
  visualState: SparkVisualState;
  isSleeping: boolean;
  isMining: boolean;

  // Stats
  stats: SparkStats;

  // Progression
  progression: SparkProgression;

  // Timestamps
  createdAt: number;
  lastUpdated: number;
  lastFed: number;
  lastPlayed: number;
  lastMined: number; // For level decay tracking

  // Mining baseline - shares count when baby was created
  // Used to prevent XP from pre-existing mining progress
  miningSharesBaseline: number;

  // Evolution history
  evolutionHistory: EvolutionRecord[];

  // Achievements
  unlockedAchievements: string[];
}

/**
 * Record of an evolution event
 */
export interface EvolutionRecord {
  fromStage: SparkStage;
  toStage: SparkStage;
  level: number;
  timestamp: number;
}

/**
 * Mining statistics tracked for achievements
 */
export interface GameMiningStats {
  totalHashes: number;
  totalShares: number;
  totalTokensEarned: bigint;
  sessionsCount: number;
  longestSession: number; // milliseconds
}

/**
 * Complete game state for persistence
 */
export interface GameState {
  // Version for migrations
  version: number;

  // Baby data
  baby: GameSpark | null;

  // Mining stats (cumulative)
  miningStats: GameMiningStats;

  // Settings
  settings: GameSettings;

  // Meta
  lastSaved: number;
  totalPlayTime: number;
}

/**
 * Game settings
 */
export interface GameSettings {
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  autoSaveEnabled: boolean;
}

/**
 * Achievement definition
 */
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: AchievementRequirement;
  reward: AchievementReward;
}

/**
 * Achievement requirement types
 */
export type AchievementRequirement =
  | { type: "hashes"; count: number }
  | { type: "shares"; count: number }
  | { type: "level"; level: number }
  | { type: "stage"; stage: SparkStage }
  | { type: "days_without_critical"; days: number }
  | { type: "mining_time"; hours: number }
  | { type: "all_achievements" };

/**
 * Achievement reward
 */
export interface AchievementReward {
  xp?: number;
  title?: string;
  badge?: string;
}

/**
 * Evolution event data
 */
export interface EvolutionEventData {
  fromStage: SparkStage;
  toStage: SparkStage;
  newLevel: number;
  stageName: string;
  miningBonus: number;
}

/**
 * Event emitted by game engine
 */
export type GameEvent =
  | { type: "tick"; stats: SparkStats }
  | { type: "level_up"; level: number }
  | { type: "evolution_ready"; nextStage: SparkStage }
  | { type: "evolved"; stage: SparkStage; data: EvolutionEventData }
  | { type: "achievement_unlocked"; achievement: Achievement }
  | { type: "critical_stat"; stat: keyof SparkStats }
  | { type: "stat_recovered"; stat: keyof SparkStats }
  | { type: "whale_appeared" }
  | { type: "saved" };

/**
 * Callback for game events
 */
export type GameEventHandler = (event: GameEvent) => void;

/**
 * Initial state for a new baby
 */
export const DEFAULT_SPARK_STATS: SparkStats = {
  energy: 100,
  happiness: 100,
  hunger: 0,
  health: 100,
};

/**
 * Initial game state
 */
export const DEFAULT_GAME_STATE: GameState = {
  version: 1,
  baby: null,
  miningStats: {
    totalHashes: 0,
    totalShares: 0,
    totalTokensEarned: BigInt(0),
    sessionsCount: 0,
    longestSession: 0,
  },
  settings: {
    soundEnabled: true,
    notificationsEnabled: true,
    autoSaveEnabled: true,
  },
  lastSaved: 0,
  totalPlayTime: 0,
};
