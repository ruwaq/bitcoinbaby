/**
 * Upstash Redis Client for Cloudflare Workers
 *
 * Provides leaderboard operations using Redis Sorted Sets (ZSET).
 * Optimized for edge computing with HTTP-based Redis.
 *
 * @see https://upstash.com/docs/redis/tutorials/edge_leaderboard
 */

import { Redis } from "@upstash/redis";
import type {
  Env,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardEntry,
  UserStats,
} from "./types";
import { redisLogger } from "./logger";

// =============================================================================
// CLIENT FACTORY
// =============================================================================

/**
 * Create Redis client instance
 *
 * Note: Creates a fresh client each time. In edge workers, singleton patterns
 * can cause issues as workers are short-lived and frequently restarted.
 * Upstash HTTP-based client is stateless, so this is safe and efficient.
 */
export function getRedis(env: Env): Redis {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis credentials not configured");
  }

  return new Redis({
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
  });
}

// =============================================================================
// KEY HELPERS
// =============================================================================

/**
 * Generate Redis key for a leaderboard (internal)
 */
function leaderboardKey(
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
): string {
  return `leaderboard:${category}:${period}`;
}

/**
 * Generate Redis key for user stats (internal)
 */
function userStatsKey(address: string): string {
  return `user:${address}:stats`;
}

/**
 * Generate current period identifier for daily/weekly reset (internal)
 */
function getCurrentPeriodId(period: LeaderboardPeriod): string {
  const now = new Date();

  if (period === "daily") {
    return now.toISOString().split("T")[0]; // "2025-03-01"
  }

  if (period === "weekly") {
    // ISO week number
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const days = Math.floor(
      (now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000),
    );
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }

  return "alltime";
}

// =============================================================================
// LEADERBOARD OPERATIONS
// =============================================================================

/**
 * Update user score in leaderboard
 *
 * Uses ZADD to add/update score in sorted set.
 * Automatically maintains rankings.
 */
export async function updateScore(
  redis: Redis,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  address: string,
  score: number,
): Promise<void> {
  const key = leaderboardKey(category, period);

  // ZADD updates the score if member exists, or adds new member
  await redis.zadd(key, { score, member: address });
}

/**
 * Update scores for all periods at once
 */
export async function updateAllPeriods(
  redis: Redis,
  category: LeaderboardCategory,
  address: string,
  score: number,
): Promise<void> {
  const periods: LeaderboardPeriod[] = ["daily", "weekly", "alltime"];

  // Use pipeline for efficiency
  const pipeline = redis.pipeline();

  for (const period of periods) {
    const key = leaderboardKey(category, period);
    pipeline.zadd(key, { score, member: address });
  }

  await pipeline.exec();
}

/**
 * Get leaderboard entries
 *
 * Returns top N entries sorted by score (descending).
 */
export async function getLeaderboard(
  redis: Redis,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  limit: number = 100,
  offset: number = 0,
): Promise<LeaderboardEntry[]> {
  const key = leaderboardKey(category, period);

  // ZRANGE with REV option returns descending order
  const results = await redis.zrange(key, offset, offset + limit - 1, {
    rev: true,
    withScores: true,
  });

  // Transform results to LeaderboardEntry format
  const entries: LeaderboardEntry[] = [];

  for (let i = 0; i < results.length; i += 2) {
    const address = results[i] as string;
    const score = results[i + 1] as number;

    entries.push({
      address,
      score,
      rank: offset + entries.length + 1,
    });
  }

  return entries;
}

/**
 * Get total number of entries in leaderboard
 */
export async function getLeaderboardCount(
  redis: Redis,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
): Promise<number> {
  const key = leaderboardKey(category, period);
  return (await redis.zcard(key)) || 0;
}

/**
 * Get user's rank in leaderboard
 *
 * Returns 1-based rank (1 = first place), or null if not in leaderboard.
 */
export async function getUserRank(
  redis: Redis,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  address: string,
): Promise<number | null> {
  const key = leaderboardKey(category, period);

  // ZREVRANK returns 0-based rank in descending order
  const rank = await redis.zrevrank(key, address);

  return rank !== null ? rank + 1 : null;
}

/**
 * Get user's score in leaderboard
 */
export async function getUserScore(
  redis: Redis,
  category: LeaderboardCategory,
  period: LeaderboardPeriod,
  address: string,
): Promise<number> {
  const key = leaderboardKey(category, period);
  const score = await redis.zscore(key, address);

  return score || 0;
}

// =============================================================================
// USER STATS
// =============================================================================

/**
 * Update user stats hash
 */
export async function updateUserStats(
  redis: Redis,
  stats: Partial<UserStats> & { address: string },
): Promise<void> {
  const key = userStatsKey(stats.address);

  const updates: Record<string, string | number> = {
    lastActive: Date.now(),
  };

  if (stats.totalHashes !== undefined) {
    updates.totalHashes = stats.totalHashes;
  }
  if (stats.totalTokens !== undefined) {
    updates.totalTokens = stats.totalTokens;
  }
  if (stats.babyLevel !== undefined) {
    updates.babyLevel = stats.babyLevel;
  }
  if (stats.cosmicBonus !== undefined) {
    updates.cosmicBonus = stats.cosmicBonus;
  }

  await redis.hset(key, updates);
}

/**
 * Get user stats
 */
export async function getUserStats(
  redis: Redis,
  address: string,
): Promise<UserStats | null> {
  const key = userStatsKey(address);
  const data = await redis.hgetall(key);

  if (!data || Object.keys(data).length === 0) {
    return null;
  }

  return {
    address,
    totalHashes: Number(data.totalHashes) || 0,
    totalTokens: Number(data.totalTokens) || 0,
    babyLevel: Number(data.babyLevel) || 1,
    cosmicBonus: Number(data.cosmicBonus) || 1,
    lastActive: Number(data.lastActive) || 0,
  };
}

// =============================================================================
// PERIOD RESET
// =============================================================================

/**
 * Reset daily leaderboard
 *
 * Called by cron job at midnight UTC.
 * Archives old data and clears the daily set.
 */
export async function resetDailyLeaderboard(redis: Redis): Promise<void> {
  const categories: LeaderboardCategory[] = ["miners", "babies", "earners"];

  for (const category of categories) {
    const key = leaderboardKey(category, "daily");

    // Check if key exists before archiving
    const exists = await redis.exists(key);
    if (!exists) {
      redisLogger.debug("Leaderboard key does not exist, skipping archive", {
        key,
      });
      continue;
    }

    // Archive with date suffix before clearing
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const archiveKey = `${key}:${yesterday.toISOString().split("T")[0]}`;

    // Rename current to archive (atomic)
    await redis.rename(key, archiveKey);

    // Set expiry on archive (keep for 30 days)
    await redis.expire(archiveKey, 30 * 24 * 60 * 60);
  }
}

/**
 * Reset weekly leaderboard
 *
 * Called by cron job on Sunday at midnight UTC.
 */
export async function resetWeeklyLeaderboard(redis: Redis): Promise<void> {
  const categories: LeaderboardCategory[] = ["miners", "babies", "earners"];

  for (const category of categories) {
    const key = leaderboardKey(category, "weekly");

    // Check if key exists before archiving
    const exists = await redis.exists(key);
    if (!exists) {
      redisLogger.debug("Leaderboard key does not exist, skipping archive", {
        key,
      });
      continue;
    }

    // Archive with week suffix
    const archiveKey = `${key}:${getCurrentPeriodId("weekly")}`;

    await redis.rename(key, archiveKey);
    await redis.expire(archiveKey, 90 * 24 * 60 * 60); // Keep 90 days
  }
}
