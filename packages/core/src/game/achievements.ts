/**
 * Achievement System
 *
 * Definitions and checking logic for game achievements.
 */

import type { Achievement, GameState } from "./types";
import { STAGE_ORDER } from "./constants";

/**
 * All available achievements
 */
export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "first_hash",
    name: "Primer Hash",
    description: "Mina tu primer hash",
    icon: "⛏️",
    requirement: { type: "hashes", count: 1 },
    reward: { xp: 10 },
  },
  {
    id: "miner_dedicated",
    name: "Minero Dedicado",
    description: "Mina 10,000 hashes",
    icon: "💎",
    requirement: { type: "hashes", count: 10_000 },
    reward: { xp: 100, badge: "satobot" },
  },
  {
    id: "first_share",
    name: "Primer Share",
    description: "Encuentra tu primer share",
    icon: "🎯",
    requirement: { type: "shares", count: 1 },
    reward: { xp: 50 },
  },
  {
    id: "share_hunter",
    name: "Cazador de Shares",
    description: "Encuentra 10 shares",
    icon: "🏹",
    requirement: { type: "shares", count: 10 },
    reward: { xp: 200 },
  },
  {
    id: "evolved_teen",
    name: "Evolucionado",
    description: "Evoluciona a Cypher-Joven",
    icon: "🦋",
    requirement: { type: "stage", stage: "teen_1" },
    reward: { xp: 150, badge: "evolved" },
  },
  {
    id: "evolved_master",
    name: "Maestro",
    description: "Alcanza el nivel Maestro Nodo",
    icon: "👑",
    requirement: { type: "stage", stage: "master_1" },
    reward: { xp: 500, badge: "master", title: "Maestro Nodo" },
  },
  {
    id: "legend",
    name: "Satoshi Legendario",
    description: "Alcanza el nivel máximo: Leyenda",
    icon: "⭐",
    requirement: { type: "stage", stage: "legend" },
    reward: { xp: 1000, badge: "legend", title: "Satoshi Legendario" },
  },
  {
    id: "level_10",
    name: "Nivel 10",
    description: "Alcanza el nivel 10",
    icon: "🔟",
    requirement: { type: "level", level: 10 },
    reward: { xp: 100 },
  },
  {
    id: "level_25",
    name: "Nivel 25",
    description: "Alcanza el nivel 25",
    icon: "🎖️",
    requirement: { type: "level", level: 25 },
    reward: { xp: 250 },
  },
  {
    id: "millionaire",
    name: "Millonario",
    description: "Mina 1 millón de hashes",
    icon: "💰",
    requirement: { type: "hashes", count: 1_000_000 },
    reward: { xp: 500, badge: "millionaire" },
  },
  {
    id: "completionist",
    name: "Completista",
    description: "Desbloquea todos los logros",
    icon: "🏆",
    requirement: { type: "all_achievements" },
    reward: { title: "Leyenda Blockchain" },
  },
];

/**
 * Check if an achievement requirement is met
 */
function checkRequirement(
  requirement: Achievement["requirement"],
  state: GameState,
  unlockedAchievements: string[],
): boolean {
  switch (requirement.type) {
    case "hashes":
      return state.miningStats.totalHashes >= requirement.count;

    case "shares":
      return state.miningStats.totalShares >= requirement.count;

    case "level":
      return (state.baby?.progression.level ?? 0) >= requirement.level;

    case "stage":
      return state.baby?.progression.stage === requirement.stage;

    case "days_without_critical":
      // This would need tracking - simplified for now
      return false;

    case "mining_time":
      // This would need session tracking - simplified for now
      return false;

    case "all_achievements": {
      // All achievements except completionist must be unlocked
      const otherAchievements = ACHIEVEMENTS.filter(
        (a) => a.id !== "completionist",
      );
      return otherAchievements.every((a) =>
        unlockedAchievements.includes(a.id),
      );
    }

    default:
      return false;
  }
}

/**
 * Check all achievements and return newly unlocked ones
 */
export function checkAchievements(state: GameState): Achievement[] {
  if (!state.baby) return [];

  const unlockedIds = state.baby.unlockedAchievements;
  const newlyUnlocked: Achievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    // Skip already unlocked
    if (unlockedIds.includes(achievement.id)) continue;

    // Check if requirement is met
    if (checkRequirement(achievement.requirement, state, unlockedIds)) {
      newlyUnlocked.push(achievement);
    }
  }

  return newlyUnlocked;
}

/**
 * Get achievement by ID
 */
export function getAchievement(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/**
 * Get progress towards an achievement (0-100)
 */
export function getAchievementProgress(
  achievement: Achievement,
  state: GameState,
): number {
  const req = achievement.requirement;

  switch (req.type) {
    case "hashes":
      return Math.min(100, (state.miningStats.totalHashes / req.count) * 100);

    case "shares":
      return Math.min(100, (state.miningStats.totalShares / req.count) * 100);

    case "level": {
      const level = state.baby?.progression.level ?? 0;
      return Math.min(100, (level / req.level) * 100);
    }

    case "stage": {
      const currentIdx = STAGE_ORDER.indexOf(
        state.baby?.progression.stage ?? "egg",
      );
      const targetIdx = STAGE_ORDER.indexOf(req.stage);
      return currentIdx >= targetIdx
        ? 100
        : (currentIdx / Math.max(1, targetIdx)) * 100;
    }

    case "all_achievements": {
      const total = ACHIEVEMENTS.length - 1; // Exclude completionist
      const unlocked = state.baby?.unlockedAchievements.length ?? 0;
      return Math.min(100, (unlocked / total) * 100);
    }

    default:
      return 0;
  }
}

/**
 * Calculate total XP reward from achievements
 */
export function calculateAchievementRewardXP(
  achievements: Achievement[],
): number {
  return achievements.reduce((total, a) => total + (a.reward.xp ?? 0), 0);
}
