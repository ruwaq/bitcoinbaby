/**
 * Leaderboard Routes
 *
 * Redis-backed leaderboard with edge caching.
 *
 * Routes:
 * - GET  /api/leaderboard           - Get leaderboard entries
 * - GET  /api/leaderboard/rank/:address - Get user rank
 * - POST /api/leaderboard/update    - Update user score (internal)
 * - GET  /api/leaderboard/stats/:address - Get user stats
 */

import { Hono } from "hono";
import type {
  Env,
  ApiResponse,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardResponse,
  UserRankResponse,
} from "../lib/types";
import {
  getRedis,
  getLeaderboard,
  getLeaderboardCount,
  getUserRank,
  getUserScore,
  updateAllPeriods,
  getUserStats,
} from "../lib/redis";
import {
  isValidBitcoinAddress,
  isValidLeaderboardCategory,
  isValidLeaderboardPeriod,
  errorResponse,
  cachedResponse,
} from "../lib/helpers";
import { leaderboardLogger } from "../lib/logger";

export const leaderboardRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/leaderboard - Get leaderboard entries
 *
 * Query params:
 * - category: miners | babies | earners (default: miners)
 * - period: daily | weekly | alltime (default: alltime)
 * - limit: number (default: 100, max: 500)
 * - offset: number (default: 0)
 */
leaderboardRouter.get("/", async (c) => {
  const category = c.req.query("category") || "miners";
  const period = c.req.query("period") || "alltime";
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);
  const offset = parseInt(c.req.query("offset") || "0");

  if (!isValidLeaderboardCategory(category)) {
    return errorResponse(c, "Invalid category", 400);
  }

  if (!isValidLeaderboardPeriod(period)) {
    return errorResponse(c, "Invalid period", 400);
  }

  // Edge caching
  const cacheKey = new Request(
    `https://cache.bitcoinbaby.app/leaderboard/${category}/${period}/${limit}/${offset}`,
  );
  const cache = caches.default;

  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) {
    const response = new Response(cachedResp.body, cachedResp);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  try {
    const redis = getRedis(c.env);

    const [entries, totalEntries] = await Promise.all([
      getLeaderboard(
        redis,
        category as LeaderboardCategory,
        period as LeaderboardPeriod,
        limit,
        offset,
      ),
      getLeaderboardCount(
        redis,
        category as LeaderboardCategory,
        period as LeaderboardPeriod,
      ),
    ]);

    const responseData: LeaderboardResponse = {
      category: category as LeaderboardCategory,
      period: period as LeaderboardPeriod,
      entries,
      totalEntries,
      lastUpdated: Date.now(),
    };

    const jsonResponse: ApiResponse<LeaderboardResponse> = {
      success: true,
      data: responseData,
      timestamp: Date.now(),
    };

    // Cache TTL based on period
    const cacheTTL = period === "daily" ? 60 : period === "weekly" ? 120 : 300;
    const response = cachedResponse(jsonResponse, cacheTTL);

    // Store in edge cache
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    leaderboardLogger.error("Failed to fetch leaderboard", error);
    return errorResponse(c, "Failed to fetch leaderboard", 500);
  }
});

/**
 * GET /api/leaderboard/rank/:address - Get user's rank
 */
leaderboardRouter.get("/rank/:address", async (c) => {
  const address = c.req.param("address");
  const category = c.req.query("category") || "miners";
  const period = c.req.query("period") || "alltime";

  if (!isValidBitcoinAddress(address)) {
    return errorResponse(c, "Invalid Bitcoin address", 400);
  }

  if (!isValidLeaderboardCategory(category)) {
    return errorResponse(c, "Invalid category", 400);
  }

  if (!isValidLeaderboardPeriod(period)) {
    return errorResponse(c, "Invalid period", 400);
  }

  // Edge cache (shorter TTL for ranks)
  const cacheKey = new Request(
    `https://cache.bitcoinbaby.app/rank/${category}/${period}/${address}`,
  );
  const cache = caches.default;

  const cachedResp = await cache.match(cacheKey);
  if (cachedResp) {
    const response = new Response(cachedResp.body, cachedResp);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  try {
    const redis = getRedis(c.env);

    const [rank, score] = await Promise.all([
      getUserRank(
        redis,
        category as LeaderboardCategory,
        period as LeaderboardPeriod,
        address,
      ),
      getUserScore(
        redis,
        category as LeaderboardCategory,
        period as LeaderboardPeriod,
        address,
      ),
    ]);

    const responseData: UserRankResponse = {
      address,
      category: category as LeaderboardCategory,
      period: period as LeaderboardPeriod,
      rank: rank !== null ? rank + 1 : null, // Convert 0-indexed to 1-indexed
      score,
    };

    const jsonResponse: ApiResponse<UserRankResponse> = {
      success: true,
      data: responseData,
      timestamp: Date.now(),
    };

    const response = cachedResponse(jsonResponse, 30);
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    leaderboardLogger.error("Failed to fetch rank", error);
    return errorResponse(c, "Failed to fetch rank", 500);
  }
});

/**
 * POST /api/leaderboard/update - Update user score (internal)
 */
leaderboardRouter.post("/update", async (c) => {
  const body = await c.req.json();

  if (!body.address || !isValidBitcoinAddress(body.address)) {
    return errorResponse(c, "Invalid Bitcoin address", 400);
  }

  if (!body.category || !isValidLeaderboardCategory(body.category)) {
    return errorResponse(c, "Invalid category", 400);
  }

  if (typeof body.score !== "number" || body.score < 0) {
    return errorResponse(c, "Invalid score", 400);
  }

  try {
    const redis = getRedis(c.env);

    await updateAllPeriods(
      redis,
      body.category as LeaderboardCategory,
      body.address,
      body.score,
    );

    return c.json<ApiResponse>({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    leaderboardLogger.error("Failed to update leaderboard", error);
    return errorResponse(c, "Failed to update leaderboard", 500);
  }
});

/**
 * GET /api/leaderboard/stats/:address - Get user stats
 */
leaderboardRouter.get("/stats/:address", async (c) => {
  const address = c.req.param("address");

  if (!isValidBitcoinAddress(address)) {
    return errorResponse(c, "Invalid Bitcoin address", 400);
  }

  try {
    const redis = getRedis(c.env);
    const stats = await getUserStats(redis, address);

    return c.json<ApiResponse<typeof stats>>({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    leaderboardLogger.error("Failed to fetch stats", error);
    return errorResponse(c, "Failed to fetch stats", 500);
  }
});
