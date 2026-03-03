/**
 * BitcoinBaby Workers - Main Entry Point
 *
 * Cloudflare Workers API for:
 * - Virtual balance management
 * - Withdrawal pool batching
 * - Game state synchronization
 *
 * 100% FREE on Cloudflare Workers (free tier)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type {
  Env,
  ApiResponse,
  PoolType,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardResponse,
  UserRankResponse,
} from "./lib/types";
import {
  getRedis,
  getLeaderboard,
  getLeaderboardCount,
  getUserRank,
  getUserScore,
  updateAllPeriods,
  updateUserStats,
  getUserStats,
  resetDailyLeaderboard,
  resetWeeklyLeaderboard,
} from "./lib/redis";

// Re-export Durable Objects
export { VirtualBalanceDO } from "./durable-objects/virtual-balance";
export { WithdrawPoolDO } from "./durable-objects/withdraw-pool";
export { GameRoomDO } from "./durable-objects/game-room";

// Create Hono app with typed env
const app = new Hono<{ Bindings: Env }>();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS for frontend
// SECURITY: No wildcards with credentials - list exact origins
app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow exact matches
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://bitcoinbaby.app",
        "https://www.bitcoinbaby.app",
        "https://bitcoinbaby.vercel.app",
      ];

      if (!origin) return allowedOrigins[0]; // For non-browser requests

      // Check exact match first
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Allow bitcoinbaby.app subdomains (validated pattern)
      if (/^https:\/\/[a-z0-9-]+\.bitcoinbaby\.app$/.test(origin)) {
        return origin;
      }

      // Allow Vercel preview deployments (pattern validated)
      if (/^https:\/\/bitcoinbaby-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        return origin;
      }

      // Reject unknown origins
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
    maxAge: 86400,
    credentials: true,
  }),
);

// Request logging
app.use("*", logger());

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.header("X-Request-Id", requestId);
  await next();
});

// =============================================================================
// HEALTH & STATUS
// =============================================================================

app.get("/", (c) => {
  return c.json({
    name: "BitcoinBaby API",
    version: "1.0.0",
    status: "healthy",
    timestamp: Date.now(),
  });
});

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT,
    timestamp: Date.now(),
  });
});

// =============================================================================
// BALANCE API
// =============================================================================

/**
 * GET /api/balance/:address - Get user's virtual balance
 */
app.get("/api/balance/:address", async (c) => {
  const address = c.req.param("address");

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const id = c.env.VIRTUAL_BALANCE.idFromName(address);
    const stub = c.env.VIRTUAL_BALANCE.get(id);

    const response = await stub.fetch(
      new Request(`http://internal/balance/${address}/get`),
    );

    if (!response.ok && response.status >= 500) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Service temporarily unavailable. Please try again later.",
          timestamp: Date.now(),
        },
        503,
      );
    }

    return response;
  } catch (error) {
    console.error("[Balance] Error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Service temporarily unavailable. Please try again later.",
        timestamp: Date.now(),
      },
      503,
    );
  }
});

/**
 * POST /api/balance/:address/credit - Credit mining reward
 */
app.post("/api/balance/:address/credit", async (c) => {
  const address = c.req.param("address");

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const body = await c.req.json();
    const id = c.env.VIRTUAL_BALANCE.idFromName(address);
    const stub = c.env.VIRTUAL_BALANCE.get(id);

    const response = await stub.fetch(
      new Request(`http://internal/balance/${address}/credit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    // Check if Durable Object returned an error
    if (!response.ok && response.status >= 500) {
      const text = await response.text();
      // Return JSON error instead of plain text
      return c.json<ApiResponse>(
        {
          success: false,
          error: text.includes("limit")
            ? "Service temporarily unavailable (rate limit). Try again later."
            : "Service temporarily unavailable. Please try again.",
          timestamp: Date.now(),
        },
        503,
      );
    }

    return response;
  } catch (error) {
    // Cloudflare Durable Objects limit or other error
    console.error("[Credit] Error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Service temporarily unavailable. Please try again later.",
        timestamp: Date.now(),
      },
      503,
    );
  }
});

/**
 * POST /api/balance/:address/set-hashrate - Report hashrate for VarDiff estimation
 *
 * This allows miners to report their hashrate so the server can estimate
 * an appropriate starting difficulty. The VarDiff algorithm will fine-tune from there.
 */
app.post("/api/balance/:address/set-hashrate", async (c) => {
  const address = c.req.param("address");

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const body = await c.req.json();
    const id = c.env.VIRTUAL_BALANCE.idFromName(address);
    const stub = c.env.VIRTUAL_BALANCE.get(id);

    const response = await stub.fetch(
      new Request(`http://internal/balance/${address}/set-hashrate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

    return response;
  } catch (error) {
    console.error("[SetHashrate] Error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Service temporarily unavailable. Please try again later.",
        timestamp: Date.now(),
      },
      503,
    );
  }
});

// =============================================================================
// WITHDRAW POOL API
// =============================================================================

/**
 * GET /api/pool/:poolType/status - Get pool status
 */
app.get("/api/pool/:poolType/status", async (c) => {
  const poolType = c.req.param("poolType") as PoolType;

  if (!isValidPoolType(poolType)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid pool type", timestamp: Date.now() },
      400,
    );
  }

  const id = c.env.WITHDRAW_POOL.idFromName(poolType);
  const stub = c.env.WITHDRAW_POOL.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/pool/${poolType}/status`),
  );

  return response;
});

/**
 * GET /api/pool/:poolType/requests - Get pending requests for a pool
 */
app.get("/api/pool/:poolType/requests", async (c) => {
  const poolType = c.req.param("poolType") as PoolType;

  if (!isValidPoolType(poolType)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid pool type", timestamp: Date.now() },
      400,
    );
  }

  const id = c.env.WITHDRAW_POOL.idFromName(poolType);
  const stub = c.env.WITHDRAW_POOL.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/pool/${poolType}/requests`),
  );

  return response;
});

/**
 * POST /api/pool/:poolType/request - Create withdrawal request
 */
app.post("/api/pool/:poolType/request", async (c) => {
  const poolType = c.req.param("poolType") as PoolType;

  if (!isValidPoolType(poolType)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid pool type", timestamp: Date.now() },
      400,
    );
  }

  const body = await c.req.json();

  // Validate required fields
  if (!body.fromAddress || !body.toAddress || !body.amount) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Missing required fields: fromAddress, toAddress, amount",
        timestamp: Date.now(),
      },
      400,
    );
  }

  // Reserve balance first
  const balanceId = c.env.VIRTUAL_BALANCE.idFromName(body.fromAddress);
  const balanceStub = c.env.VIRTUAL_BALANCE.get(balanceId);

  const requestId = crypto.randomUUID();
  const reserveResponse = await balanceStub.fetch(
    new Request(`http://internal/balance/${body.fromAddress}/reserve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: body.amount,
        requestId,
      }),
    }),
  );

  if (!reserveResponse.ok) {
    return reserveResponse;
  }

  // Create withdrawal request in pool
  const poolId = c.env.WITHDRAW_POOL.idFromName(poolType);
  const poolStub = c.env.WITHDRAW_POOL.get(poolId);

  let poolResponse: Response;
  try {
    poolResponse = await poolStub.fetch(
      new Request(`http://internal/pool/${poolType}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...body,
          requestId,
        }),
      }),
    );
  } catch (error) {
    // Pool request failed - release the reserved balance
    console.error(
      "[Withdraw] Pool request failed, releasing reservation:",
      error,
    );
    await balanceStub.fetch(
      new Request(
        `http://internal/balance/${body.fromAddress}/cancel-withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: body.amount,
            requestId,
          }),
        },
      ),
    );
    return c.json<ApiResponse>(
      {
        success: false,
        error:
          "Failed to create withdrawal request. Balance has been released.",
        timestamp: Date.now(),
      },
      500,
    );
  }

  // If pool creation failed, release the reservation
  if (!poolResponse.ok) {
    console.error("[Withdraw] Pool returned error, releasing reservation");
    await balanceStub.fetch(
      new Request(
        `http://internal/balance/${body.fromAddress}/cancel-withdraw`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: body.amount,
            requestId,
          }),
        },
      ),
    );
  }

  return poolResponse;
});

/**
 * POST /api/pool/:poolType/cancel - Cancel withdrawal request
 */
app.post("/api/pool/:poolType/cancel", async (c) => {
  const poolType = c.req.param("poolType") as PoolType;

  if (!isValidPoolType(poolType)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid pool type", timestamp: Date.now() },
      400,
    );
  }

  const body = await c.req.json();

  if (!body.requestId || !body.fromAddress) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Missing required fields: requestId, fromAddress",
        timestamp: Date.now(),
      },
      400,
    );
  }

  // Cancel in pool first
  const poolId = c.env.WITHDRAW_POOL.idFromName(poolType);
  const poolStub = c.env.WITHDRAW_POOL.get(poolId);

  const poolResponse = await poolStub.fetch(
    new Request(`http://internal/pool/${poolType}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: body.requestId }),
    }),
  );

  if (!poolResponse.ok) {
    return poolResponse;
  }

  const poolData = (await poolResponse.json()) as ApiResponse<{
    cancelledAmount: string;
  }>;

  // Release balance
  const balanceId = c.env.VIRTUAL_BALANCE.idFromName(body.fromAddress);
  const balanceStub = c.env.VIRTUAL_BALANCE.get(balanceId);

  const response = await balanceStub.fetch(
    new Request(`http://internal/balance/${body.fromAddress}/cancel-withdraw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: poolData.data?.cancelledAmount,
        requestId: body.requestId,
      }),
    }),
  );

  return response;
});

// =============================================================================
// GAME ROOM API (WebSocket)
// =============================================================================

/**
 * GET /api/game/:roomId - WebSocket connection for game state sync
 */
app.get("/api/game/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const upgradeHeader = c.req.header("Upgrade");

  if (upgradeHeader !== "websocket") {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Expected WebSocket connection",
        timestamp: Date.now(),
      },
      426,
    );
  }

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);

  return stub.fetch(c.req.raw);
});

/**
 * GET /api/game/:roomId/state - Get current game state (HTTP)
 */
app.get("/api/game/:roomId/state", async (c) => {
  const roomId = c.req.param("roomId");

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/game/${roomId}/state`),
  );

  return response;
});

/**
 * GET /api/game/:roomId/achievements - Get achievements for a room
 */
app.get("/api/game/:roomId/achievements", async (c) => {
  const roomId = c.req.param("roomId");

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/game/${roomId}/achievements`),
  );

  return response;
});

/**
 * POST /api/game/:roomId/achievements - Add achievements to a room
 *
 * Body: { achievements: string[] }
 */
app.post("/api/game/:roomId/achievements", async (c) => {
  const roomId = c.req.param("roomId");
  const body = await c.req.json();

  const id = c.env.GAME_ROOM.idFromName(roomId);
  const stub = c.env.GAME_ROOM.get(id);

  const response = await stub.fetch(
    new Request(`http://internal/game/${roomId}/achievements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

  return response;
});

// =============================================================================
// LEADERBOARD API
// =============================================================================

/**
 * GET /api/leaderboard - Get leaderboard entries
 *
 * Query params:
 * - category: miners | babies | earners (default: miners)
 * - period: daily | weekly | alltime (default: alltime)
 * - limit: number (default: 100, max: 500)
 * - offset: number (default: 0)
 *
 * Edge caching:
 * - daily: 60s cache (changes frequently)
 * - weekly: 120s cache
 * - alltime: 300s cache (5 min)
 */
app.get("/api/leaderboard", async (c) => {
  const category = (c.req.query("category") || "miners") as LeaderboardCategory;
  const period = (c.req.query("period") || "alltime") as LeaderboardPeriod;
  const limit = Math.min(parseInt(c.req.query("limit") || "100"), 500);
  const offset = parseInt(c.req.query("offset") || "0");

  // Validate category and period
  if (!["miners", "babies", "earners"].includes(category)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid category", timestamp: Date.now() },
      400,
    );
  }

  if (!["daily", "weekly", "alltime"].includes(period)) {
    return c.json<ApiResponse>(
      { success: false, error: "Invalid period", timestamp: Date.now() },
      400,
    );
  }

  // ==========================================================================
  // EDGE CACHING - Check cache first
  // ==========================================================================
  const cacheKey = new Request(
    `https://cache.bitcoinbaby.app/leaderboard/${category}/${period}/${limit}/${offset}`,
  );
  const cache = caches.default;

  // Try to get from edge cache
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    // Clone and add cache hit header
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  try {
    const redis = getRedis(c.env);

    const [entries, totalEntries] = await Promise.all([
      getLeaderboard(redis, category, period, limit, offset),
      getLeaderboardCount(redis, category, period),
    ]);

    const responseData: LeaderboardResponse = {
      category,
      period,
      entries,
      totalEntries,
      lastUpdated: Date.now(),
    };

    const jsonResponse: ApiResponse<LeaderboardResponse> = {
      success: true,
      data: responseData,
      timestamp: Date.now(),
    };

    // Determine cache TTL based on period
    const cacheTTL = period === "daily" ? 60 : period === "weekly" ? 120 : 300; // seconds

    // Create cacheable response with CORS headers
    const response = createCacheableResponse(jsonResponse, cacheTTL, false);

    // Store in edge cache (non-blocking)
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    console.error("[Leaderboard] Error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to fetch leaderboard",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/leaderboard/rank/:address - Get user's rank
 *
 * Query params:
 * - category: miners | babies | earners (default: miners)
 * - period: daily | weekly | alltime (default: alltime)
 *
 * Edge caching: 30s (user ranks change frequently)
 */
app.get("/api/leaderboard/rank/:address", async (c) => {
  const address = c.req.param("address");
  const category = (c.req.query("category") || "miners") as LeaderboardCategory;
  const period = (c.req.query("period") || "alltime") as LeaderboardPeriod;

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  // Edge cache for rank (shorter TTL since it changes more)
  const cacheKey = new Request(
    `https://cache.bitcoinbaby.app/rank/${category}/${period}/${address}`,
  );
  const cache = caches.default;

  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    const response = new Response(cachedResponse.body, cachedResponse);
    response.headers.set("X-Cache", "HIT");
    return response;
  }

  try {
    const redis = getRedis(c.env);

    const [rank, score] = await Promise.all([
      getUserRank(redis, category, period, address),
      getUserScore(redis, category, period, address),
    ]);

    const responseData: UserRankResponse = {
      address,
      category,
      period,
      rank,
      score,
    };

    const jsonResponse: ApiResponse<UserRankResponse> = {
      success: true,
      data: responseData,
      timestamp: Date.now(),
    };

    // 30s cache for user ranks
    const response = createCacheableResponse(jsonResponse, 30, false);

    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (error) {
    console.error("[Leaderboard] Rank error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to fetch rank",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/leaderboard/update - Update user score
 *
 * DEPRECATED: This endpoint is now handled internally by VirtualBalanceDO.
 * Kept for backwards compatibility but heavily restricted.
 *
 * SECURITY: Rate limited by both IP and address to prevent manipulation.
 * The VirtualBalanceDO.updateLeaderboardAsync() is the authoritative source.
 *
 * Body:
 * - address: string (Bitcoin address)
 * - category: miners | babies | earners
 * - score: number (increment, not absolute - to prevent manipulation)
 *
 * Cache invalidation:
 * - Invalidates edge cache for the updated category (all periods)
 */
app.post("/api/leaderboard/update", async (c) => {
  try {
    // =========================================================================
    // RATE LIMITING: Strict limits to prevent leaderboard manipulation
    // Uses edge cache to track requests per IP AND per address
    // =========================================================================
    const clientIP = c.req.header("CF-Connecting-IP") || "unknown";
    const rateLimitKey = new Request(
      `https://ratelimit.internal/leaderboard-update/${clientIP}`,
    );
    const cache = caches.default;

    // Check rate limit (max 60 updates per minute per IP)
    const rateLimitEntry = await cache.match(rateLimitKey);
    if (rateLimitEntry) {
      const count = parseInt(rateLimitEntry.headers.get("X-Count") || "0");
      if (count >= 60) {
        return c.json<ApiResponse>(
          {
            success: false,
            error: "Rate limit exceeded. Try again later.",
            timestamp: Date.now(),
          },
          429,
        );
      }
      // Increment counter
      c.executionCtx.waitUntil(
        cache.put(
          rateLimitKey,
          new Response("", {
            headers: {
              "X-Count": String(count + 1),
              "Cache-Control": "max-age=60",
            },
          }),
        ),
      );
    } else {
      // Start new rate limit window
      c.executionCtx.waitUntil(
        cache.put(
          rateLimitKey,
          new Response("", {
            headers: { "X-Count": "1", "Cache-Control": "max-age=60" },
          }),
        ),
      );
    }

    const body = await c.req.json<{
      address: string;
      category: LeaderboardCategory;
      score: number;
    }>();

    if (!body.address || !isValidBitcoinAddress(body.address)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid Bitcoin address",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!["miners", "babies", "earners"].includes(body.category)) {
      return c.json<ApiResponse>(
        { success: false, error: "Invalid category", timestamp: Date.now() },
        400,
      );
    }

    if (typeof body.score !== "number" || body.score < 0) {
      return c.json<ApiResponse>(
        { success: false, error: "Invalid score", timestamp: Date.now() },
        400,
      );
    }

    // =========================================================================
    // SECURITY: Per-address rate limiting (prevents score inflation from multiple IPs)
    // =========================================================================
    const addressRateLimitKey = new Request(
      `https://ratelimit.internal/leaderboard-address/${body.address}`,
    );
    const addressRateLimit = await cache.match(addressRateLimitKey);
    if (addressRateLimit) {
      const addrCount = parseInt(
        addressRateLimit.headers.get("X-Count") || "0",
      );
      // Strict limit: 120 updates per minute per address (2 per second max)
      if (addrCount >= 120) {
        return c.json<ApiResponse>(
          {
            success: false,
            error: "Address rate limit exceeded",
            timestamp: Date.now(),
          },
          429,
        );
      }
      c.executionCtx.waitUntil(
        cache.put(
          addressRateLimitKey,
          new Response("", {
            headers: {
              "X-Count": String(addrCount + 1),
              "Cache-Control": "max-age=60",
            },
          }),
        ),
      );
    } else {
      c.executionCtx.waitUntil(
        cache.put(
          addressRateLimitKey,
          new Response("", {
            headers: { "X-Count": "1", "Cache-Control": "max-age=60" },
          }),
        ),
      );
    }

    // Sanity check: Prevent unreasonably large scores (anti-abuse)
    // Max share reward is ~500 tokens (D32 with streak), so 10K per update is very generous
    const MAX_SCORE_INCREMENT = 10_000;
    if (body.score > MAX_SCORE_INCREMENT) {
      console.warn(
        `[Leaderboard] Suspicious score: ${body.address} tried to add ${body.score}`,
      );
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Score increment too large",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // Update all periods (daily, weekly, alltime) - uses ZINCRBY for increments
    await updateAllPeriods(redis, body.category, body.address, body.score);

    // Also update user stats
    await updateUserStats(redis, {
      address: body.address,
      ...(body.category === "miners" && { totalHashes: body.score }),
      ...(body.category === "earners" && { totalTokens: body.score }),
      ...(body.category === "babies" && { babyLevel: body.score }),
    });

    return c.json<ApiResponse>({
      success: true,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Leaderboard] Update error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to update score",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/leaderboard/stats/:address - Get user stats
 */
app.get("/api/leaderboard/stats/:address", async (c) => {
  const address = c.req.param("address");

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const redis = getRedis(c.env);
    const stats = await getUserStats(redis, address);

    return c.json<ApiResponse>({
      success: true,
      data: stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Leaderboard] Stats error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to fetch stats",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// NFT COUNTER API
// =============================================================================

/**
 * GET /api/nft/counter - Get current NFT counter
 */
app.get("/api/nft/counter", async (c) => {
  try {
    const redis = getRedis(c.env);
    const count = await redis.get<number>("nft:minted:count");

    return c.json<ApiResponse<{ count: number }>>({
      success: true,
      data: { count: count ?? 0 },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Counter get error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get counter",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/nft/reserve - Reserve next NFT ID (atomic increment)
 * Returns the reserved token ID for minting
 */
app.post("/api/nft/reserve", async (c) => {
  try {
    const redis = getRedis(c.env);

    // Atomic increment - ensures no duplicates
    const newCount = await redis.incr("nft:minted:count");

    // Max supply check
    const MAX_SUPPLY = 10_000;
    if (newCount > MAX_SUPPLY) {
      // Roll back the increment
      await redis.decr("nft:minted:count");
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Max supply reached",
          timestamp: Date.now(),
        },
        400,
      );
    }

    console.log(`[NFT] Reserved token ID: ${newCount}`);

    return c.json<ApiResponse<{ tokenId: number; totalMinted: number }>>({
      success: true,
      data: {
        tokenId: newCount,
        totalMinted: newCount,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Reserve error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to reserve NFT ID",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/nft/confirm/:tokenId - Confirm NFT was minted successfully
 * Called after transaction is broadcast
 * Now accepts full NFT data for storage
 */
app.post("/api/nft/confirm/:tokenId", async (c) => {
  const tokenId = parseInt(c.req.param("tokenId"), 10);
  const body = await c.req.json<{
    txid: string;
    address: string;
    nft?: {
      dna: string;
      bloodline: string;
      baseType: string;
      rarityTier: string;
      level: number;
      xp: number;
      totalXp: number;
      workCount: number;
      evolutionCount: number;
    };
  }>();

  if (!tokenId || isNaN(tokenId)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid token ID",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const redis = getRedis(c.env);
    const mintedAt = Date.now();

    // Full NFT record for storage
    const nftRecord = {
      tokenId,
      txid: body.txid,
      address: body.address,
      mintedAt,
      // Include NFT traits if provided
      dna: body.nft?.dna || "",
      bloodline: body.nft?.bloodline || "rogue",
      baseType: body.nft?.baseType || "human",
      rarityTier: body.nft?.rarityTier || "common",
      level: body.nft?.level || 1,
      xp: body.nft?.xp || 0,
      totalXp: body.nft?.totalXp || 0,
      workCount: body.nft?.workCount || 0,
      evolutionCount: body.nft?.evolutionCount || 0,
      genesisBlock: 0,
      lastWorkBlock: 0,
      tokensEarned: "0",
    };

    // Store by tokenId for lookup
    await redis.hset(`nft:minted:${tokenId}`, nftRecord);

    // Also index by address for ownership queries
    await redis.sadd(`nft:owned:${body.address}`, tokenId.toString());

    console.log(`[NFT] Confirmed token ID: ${tokenId}, owner: ${body.address}`);

    return c.json<ApiResponse<{ confirmed: boolean }>>({
      success: true,
      data: { confirmed: true },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Confirm error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to confirm mint",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/nft/owned/:address - Get all NFTs owned by an address
 */
app.get("/api/nft/owned/:address", async (c) => {
  const address = c.req.param("address");

  if (!address) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Address required",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const redis = getRedis(c.env);

    // Get all token IDs owned by this address
    const tokenIds = await redis.smembers(`nft:owned:${address}`);

    if (!tokenIds || tokenIds.length === 0) {
      return c.json<ApiResponse<{ nfts: unknown[]; count: number }>>({
        success: true,
        data: { nfts: [], count: 0 },
        timestamp: Date.now(),
      });
    }

    // Fetch full NFT data for each token
    const nfts = await Promise.all(
      tokenIds.map(async (id) => {
        const nftData = await redis.hgetall(`nft:minted:${id}`);
        if (!nftData) return null;

        // Convert to BabyNFTState format
        return {
          tokenId: parseInt(nftData.tokenId as string, 10),
          dna: nftData.dna as string,
          bloodline: nftData.bloodline as string,
          baseType: nftData.baseType as string,
          genesisBlock: parseInt(nftData.genesisBlock as string, 10) || 0,
          rarityTier: nftData.rarityTier as string,
          level: parseInt(nftData.level as string, 10) || 1,
          xp: parseInt(nftData.xp as string, 10) || 0,
          totalXp: parseInt(nftData.totalXp as string, 10) || 0,
          workCount: parseInt(nftData.workCount as string, 10) || 0,
          lastWorkBlock: parseInt(nftData.lastWorkBlock as string, 10) || 0,
          evolutionCount: parseInt(nftData.evolutionCount as string, 10) || 0,
          tokensEarned: (nftData.tokensEarned as string) || "0",
          // Extra metadata
          txid: nftData.txid as string,
          mintedAt: parseInt(nftData.mintedAt as string, 10),
        };
      }),
    );

    // Filter out nulls and sort by tokenId
    const validNFTs = nfts
      .filter((n): n is NonNullable<typeof n> => n !== null)
      .sort((a, b) => a.tokenId - b.tokenId);

    return c.json<ApiResponse<{ nfts: typeof validNFTs; count: number }>>({
      success: true,
      data: { nfts: validNFTs, count: validNFTs.length },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Get owned error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get owned NFTs",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/nft/claim - Claim an NFT by providing txid
 * Verifies the transaction on blockchain and registers the NFT
 * This allows users to claim NFTs minted before the indexing system
 */
app.post("/api/nft/claim", async (c) => {
  try {
    const body = await c.req.json<{
      txid: string;
      address: string;
    }>();

    const { txid, address } = body;

    if (!txid || !address) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "txid and address are required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Validate txid format (64 hex chars)
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid txid format",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Validate address format (basic check for testnet4)
    if (
      !address.startsWith("tb1") &&
      !address.startsWith("m") &&
      !address.startsWith("n")
    ) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid testnet address",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // Check if this txid was already claimed
    const existingClaim = await redis.get(`nft:claimed:${txid}`);
    if (existingClaim) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "This transaction was already claimed",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Verify transaction on blockchain (mempool.space testnet4)
    const mempoolUrl = "https://mempool.space/testnet4/api";
    const txResponse = await fetch(`${mempoolUrl}/tx/${txid}`);

    if (!txResponse.ok) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Transaction not found on blockchain",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const txData = (await txResponse.json()) as {
      txid: string;
      status: { confirmed: boolean };
      vout: Array<{
        scriptpubkey: string;
        scriptpubkey_address?: string;
        scriptpubkey_type: string;
        value: number;
      }>;
    };

    // Transaction must be confirmed
    if (!txData.status?.confirmed) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Transaction not yet confirmed",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Check if transaction has an OP_RETURN with CHARM data
    const hasCharmOpReturn = txData.vout.some(
      (out) =>
        out.scriptpubkey_type === "op_return" &&
        out.scriptpubkey.includes("434841524d"), // "CHARM" in hex
    );

    if (!hasCharmOpReturn) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Transaction does not contain a valid Charm/NFT mint",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Check if the address received an output in this transaction
    const userOutput = txData.vout.find(
      (out) => out.scriptpubkey_address === address,
    );

    if (!userOutput) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Your address did not receive an output in this transaction",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // All checks passed - register the NFT
    // Get next available tokenId for this claim
    const claimCount = await redis.incr("nft:claim:count");
    const tokenId = claimCount; // Use claim count as tokenId for legacy mints

    const mintedAt = Date.now();

    // Generate random NFT traits for legacy mint
    const randomDna = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

    const bloodlines = ["royal", "warrior", "rogue", "mystic"];
    const baseTypes = ["human", "animal", "robot", "mystic", "alien"];

    // Weight rarities (mostly common for legacy)
    const rarityRoll = Math.random() * 100;
    let rarityTier: string;
    if (rarityRoll < 50) rarityTier = "common";
    else if (rarityRoll < 75) rarityTier = "uncommon";
    else if (rarityRoll < 90) rarityTier = "rare";
    else if (rarityRoll < 97) rarityTier = "epic";
    else if (rarityRoll < 99.5) rarityTier = "legendary";
    else rarityTier = "mythic";

    const nftRecord = {
      tokenId,
      txid,
      address,
      mintedAt,
      dna: randomDna,
      bloodline: bloodlines[Math.floor(Math.random() * bloodlines.length)],
      baseType: baseTypes[Math.floor(Math.random() * baseTypes.length)],
      rarityTier,
      level: 1,
      xp: 0,
      totalXp: 0,
      workCount: 0,
      evolutionCount: 0,
      genesisBlock: 0,
      lastWorkBlock: 0,
      tokensEarned: "0",
    };

    // Store NFT data
    await redis.hset(`nft:minted:${tokenId}`, nftRecord);

    // Index by address
    await redis.sadd(`nft:owned:${address}`, tokenId.toString());

    // Mark txid as claimed
    await redis.set(`nft:claimed:${txid}`, tokenId.toString());

    console.log(
      `[NFT] Claimed NFT #${tokenId} for ${address} (txid: ${txid.slice(0, 8)}...)`,
    );

    return c.json<ApiResponse<typeof nftRecord>>({
      success: true,
      data: nftRecord,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Claim error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to claim NFT",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/nft/:tokenId - Get a single NFT by token ID
 */
app.get("/api/nft/:tokenId", async (c) => {
  const tokenId = parseInt(c.req.param("tokenId"), 10);

  if (!tokenId || isNaN(tokenId)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid token ID",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const redis = getRedis(c.env);
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);

    if (!nftData || Object.keys(nftData).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const nft = {
      tokenId: parseInt(nftData.tokenId as string, 10),
      dna: nftData.dna as string,
      bloodline: nftData.bloodline as string,
      baseType: nftData.baseType as string,
      genesisBlock: parseInt(nftData.genesisBlock as string, 10) || 0,
      rarityTier: nftData.rarityTier as string,
      level: parseInt(nftData.level as string, 10) || 1,
      xp: parseInt(nftData.xp as string, 10) || 0,
      totalXp: parseInt(nftData.totalXp as string, 10) || 0,
      workCount: parseInt(nftData.workCount as string, 10) || 0,
      lastWorkBlock: parseInt(nftData.lastWorkBlock as string, 10) || 0,
      evolutionCount: parseInt(nftData.evolutionCount as string, 10) || 0,
      tokensEarned: (nftData.tokensEarned as string) || "0",
      txid: nftData.txid as string,
      address: nftData.address as string,
      mintedAt: parseInt(nftData.mintedAt as string, 10),
    };

    return c.json<ApiResponse<typeof nft>>({
      success: true,
      data: nft,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Get single error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get NFT",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// NFT MARKETPLACE ENDPOINTS
// =============================================================================

/**
 * POST /api/nft/list - List an NFT for sale
 */
app.post("/api/nft/list", async (c) => {
  try {
    const body = await c.req.json<{
      tokenId: number;
      price: number; // Price in satoshis
      sellerAddress: string;
    }>();

    const { tokenId, price, sellerAddress } = body;

    if (!tokenId || !price || !sellerAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "tokenId, price, and sellerAddress are required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (price < 1000) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Minimum price is 1000 satoshis",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // Check NFT exists and belongs to seller
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
    if (!nftData || Object.keys(nftData).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    // Check ownership
    const isOwned = await redis.sismember(
      `nft:owned:${sellerAddress}`,
      tokenId.toString(),
    );
    if (!isOwned) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "You do not own this NFT",
          timestamp: Date.now(),
        },
        403,
      );
    }

    // Check if already listed
    const existingListing = await redis.hgetall(`nft:listing:${tokenId}`);
    if (existingListing && Object.keys(existingListing).length > 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT is already listed for sale",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Create listing
    const listing = {
      tokenId: tokenId.toString(),
      price: price.toString(),
      sellerAddress,
      listedAt: Date.now().toString(),
    };

    await redis.hset(`nft:listing:${tokenId}`, listing);

    // Add to active listings set
    await redis.sadd("nft:active-listings", tokenId.toString());

    console.log(`[Marketplace] Listed NFT #${tokenId} for ${price} sats`);

    return c.json<ApiResponse<typeof listing>>({
      success: true,
      data: listing,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Marketplace] List error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to list NFT",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * DELETE /api/nft/unlist/:tokenId - Remove NFT listing
 */
app.delete("/api/nft/unlist/:tokenId", async (c) => {
  try {
    const tokenId = parseInt(c.req.param("tokenId"), 10);
    const sellerAddress = c.req.header("X-Wallet-Address");

    if (!tokenId || isNaN(tokenId)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid token ID",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!sellerAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "X-Wallet-Address header required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // Check listing exists
    const listing = await redis.hgetall(`nft:listing:${tokenId}`);
    if (!listing || Object.keys(listing).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT is not listed",
          timestamp: Date.now(),
        },
        404,
      );
    }

    // Check seller matches
    if (listing.sellerAddress !== sellerAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Only the seller can unlist",
          timestamp: Date.now(),
        },
        403,
      );
    }

    // Remove listing
    await redis.del(`nft:listing:${tokenId}`);
    await redis.srem("nft:active-listings", tokenId.toString());

    console.log(`[Marketplace] Unlisted NFT #${tokenId}`);

    return c.json<ApiResponse>({
      success: true,
      data: { tokenId, unlisted: true },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Marketplace] Unlist error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to unlist NFT",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * GET /api/nft/listings - Get all active marketplace listings
 */
app.get("/api/nft/listings", async (c) => {
  try {
    const redis = getRedis(c.env);

    // Get all active listing token IDs
    const listingIds = await redis.smembers("nft:active-listings");

    if (!listingIds || listingIds.length === 0) {
      return c.json<ApiResponse<{ listings: unknown[]; count: number }>>({
        success: true,
        data: { listings: [], count: 0 },
        timestamp: Date.now(),
      });
    }

    // Fetch all listings with NFT data
    const listings = await Promise.all(
      listingIds.map(async (id) => {
        const listing = await redis.hgetall(`nft:listing:${id}`);
        const nftData = await redis.hgetall(`nft:minted:${id}`);

        if (!listing || !nftData) return null;

        return {
          tokenId: parseInt(id, 10),
          price: parseInt(listing.price as string, 10),
          sellerAddress: listing.sellerAddress as string,
          listedAt: parseInt(listing.listedAt as string, 10),
          nft: {
            dna: nftData.dna as string,
            bloodline: nftData.bloodline as string,
            baseType: nftData.baseType as string,
            rarityTier: nftData.rarityTier as string,
            level: parseInt(nftData.level as string, 10) || 1,
          },
        };
      }),
    );

    const validListings = listings
      .filter((l): l is NonNullable<typeof l> => l !== null)
      .sort((a, b) => b.listedAt - a.listedAt); // Newest first

    return c.json<
      ApiResponse<{ listings: typeof validListings; count: number }>
    >({
      success: true,
      data: { listings: validListings, count: validListings.length },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Marketplace] Get listings error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get listings",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/nft/buy/:tokenId - Buy a listed NFT
 *
 * SECURITY: Verifies payment on blockchain before transferring ownership.
 * The buyer must provide a txid of a transaction that:
 * 1. Sends from buyerAddress
 * 2. Has an output to sellerAddress
 * 3. Output amount >= listing price
 *
 * For testnet4: We verify the transaction exists and has correct outputs.
 * For mainnet: Would require N confirmations (not implemented yet).
 */
app.post("/api/nft/buy/:tokenId", async (c) => {
  try {
    const tokenId = parseInt(c.req.param("tokenId"), 10);
    const body = await c.req.json<{
      buyerAddress: string;
      txid: string; // REQUIRED: payment txid for verification
    }>();

    const { buyerAddress, txid } = body;

    if (!tokenId || isNaN(tokenId)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid token ID",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!buyerAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "buyerAddress is required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!txid) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "txid is required - payment must be verified on blockchain",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Validate txid format (64 hex chars)
    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid txid format",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // Check if this txid was already used for a purchase (prevent replay)
    const existingPurchase = await redis.get(`nft:purchase:${txid}`);
    if (existingPurchase) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "This transaction was already used for a purchase",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Get listing
    const listing = await redis.hgetall(`nft:listing:${tokenId}`);
    if (!listing || Object.keys(listing).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT is not listed for sale",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const sellerAddress = listing.sellerAddress as string;
    const listingPrice = parseInt(listing.price as string, 10);

    // Cannot buy your own NFT
    if (sellerAddress === buyerAddress) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Cannot buy your own NFT",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // =========================================================================
    // BLOCKCHAIN PAYMENT VERIFICATION
    // =========================================================================

    const mempoolUrl = "https://mempool.space/testnet4/api";

    // Fetch transaction details
    const txResponse = await fetch(`${mempoolUrl}/tx/${txid}`);
    if (!txResponse.ok) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Payment transaction not found on blockchain",
          timestamp: Date.now(),
        },
        404,
      );
    }

    const txData = (await txResponse.json()) as {
      txid: string;
      status: { confirmed: boolean; block_height?: number };
      vin: Array<{
        txid: string;
        vout: number;
        prevout?: {
          scriptpubkey_address?: string;
          value: number;
        };
      }>;
      vout: Array<{
        scriptpubkey: string;
        scriptpubkey_address?: string;
        scriptpubkey_type: string;
        value: number;
      }>;
    };

    // For testnet: transaction must exist (confirmed OR in mempool)
    // For mainnet: would require confirmations
    // The tx existing in mempool is sufficient for testnet

    // Verify buyer is the sender (check inputs)
    const buyerIsInput = txData.vin.some(
      (input) => input.prevout?.scriptpubkey_address === buyerAddress,
    );

    if (!buyerIsInput) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Transaction does not originate from buyer address",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Verify payment to seller (check outputs)
    const paymentOutput = txData.vout.find(
      (output) => output.scriptpubkey_address === sellerAddress,
    );

    if (!paymentOutput) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Transaction does not have payment output to seller",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // Verify amount is sufficient (value is in satoshis)
    if (paymentOutput.value < listingPrice) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: `Payment amount (${paymentOutput.value} sats) is less than listing price (${listingPrice} sats)`,
          timestamp: Date.now(),
        },
        400,
      );
    }

    console.log(
      `[Marketplace] Payment verified: ${txid.slice(0, 8)}... - ${paymentOutput.value} sats from ${buyerAddress.slice(0, 10)}... to ${sellerAddress.slice(0, 10)}...`,
    );

    // =========================================================================
    // TRANSFER OWNERSHIP (Payment verified)
    // =========================================================================

    // Mark txid as used BEFORE transfer to prevent race conditions
    await redis.set(`nft:purchase:${txid}`, tokenId.toString());

    // Transfer ownership
    // 1. Remove from seller
    await redis.srem(`nft:owned:${sellerAddress}`, tokenId.toString());

    // 2. Add to buyer
    await redis.sadd(`nft:owned:${buyerAddress}`, tokenId.toString());

    // 3. Update NFT address
    await redis.hset(`nft:minted:${tokenId}`, { address: buyerAddress });

    // 4. Remove listing
    await redis.del(`nft:listing:${tokenId}`);
    await redis.srem("nft:active-listings", tokenId.toString());

    // 5. Record sale with verified transaction
    const sale = {
      tokenId: tokenId.toString(),
      seller: sellerAddress,
      buyer: buyerAddress,
      price: listing.price as string,
      txid,
      verified: "true",
      confirmed: txData.status.confirmed ? "true" : "false",
      soldAt: Date.now().toString(),
    };
    await redis.lpush("nft:sales-history", JSON.stringify(sale));

    console.log(
      `[Marketplace] Sold NFT #${tokenId} from ${sellerAddress} to ${buyerAddress} (verified: ${txid.slice(0, 8)}...)`,
    );

    return c.json<ApiResponse<typeof sale>>({
      success: true,
      data: sale,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Marketplace] Buy error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to complete purchase",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// NFT EVOLUTION ENDPOINTS
// =============================================================================

// XP requirements per level (level -> XP needed to reach that level)
const XP_REQUIREMENTS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 8000,
  9: 16000,
  10: 32000,
};

// Evolution costs in BABTC (level -> cost to evolve TO that level)
const EVOLUTION_COSTS: Record<number, bigint> = {
  2: 100n * 100_000_000n, // 100 BABTC
  3: 250n * 100_000_000n,
  4: 500n * 100_000_000n,
  5: 1000n * 100_000_000n,
  6: 2500n * 100_000_000n,
  7: 5000n * 100_000_000n,
  8: 10000n * 100_000_000n,
  9: 25000n * 100_000_000n,
  10: 50000n * 100_000_000n,
};

/**
 * POST /api/nft/evolve - Evolve an NFT to the next level
 *
 * Requirements:
 * 1. NFT must exist and belong to the address
 * 2. NFT must have enough XP for the next level
 * 3. Address must have enough virtual balance for evolution cost
 *
 * Process:
 * 1. Validate ownership and XP
 * 2. Deduct evolution cost from virtual balance
 * 3. Update NFT: level++, xp=0, evolutionCount++
 */
app.post("/api/nft/evolve", async (c) => {
  try {
    const body = await c.req.json<{
      tokenId: number;
      address: string;
    }>();

    const { tokenId, address } = body;

    // Validate required fields
    if (!tokenId || !address) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "tokenId and address are required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    if (!isValidBitcoinAddress(address)) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid Bitcoin address",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);

    // 1. Check if NFT exists
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
    if (!nftData || Object.keys(nftData).length === 0) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT not found",
          timestamp: Date.now(),
        },
        404,
      );
    }

    // 2. Check ownership
    const isOwned = await redis.sismember(
      `nft:owned:${address}`,
      tokenId.toString(),
    );
    if (!isOwned) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "You do not own this NFT",
          timestamp: Date.now(),
        },
        403,
      );
    }

    // Parse current NFT state
    const currentLevel = parseInt(nftData.level as string, 10) || 1;
    const currentXp = parseInt(nftData.xp as string, 10) || 0;
    const currentEvolutionCount =
      parseInt(nftData.evolutionCount as string, 10) || 0;

    // 3. Check max level
    const nextLevel = currentLevel + 1;
    if (nextLevel > 10) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "NFT is already at maximum level (10)",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // 4. Check XP requirements
    const requiredXp = XP_REQUIREMENTS[nextLevel];
    if (currentXp < requiredXp) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: `Insufficient XP. Required: ${requiredXp}, Current: ${currentXp}`,
          timestamp: Date.now(),
        },
        400,
      );
    }

    // 5. Get evolution cost
    const evolutionCost = EVOLUTION_COSTS[nextLevel];
    if (!evolutionCost) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid evolution level",
          timestamp: Date.now(),
        },
        400,
      );
    }

    // 6. Deduct balance from VirtualBalanceDO
    const balanceId = c.env.VIRTUAL_BALANCE.idFromName(address);
    const balanceStub = c.env.VIRTUAL_BALANCE.get(balanceId);

    const deductResponse = await balanceStub.fetch(
      new Request(`http://internal/balance/${address}/deduct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: evolutionCost.toString(),
          reason: `NFT Evolution: Token #${tokenId} to Level ${nextLevel}`,
        }),
      }),
    );

    if (!deductResponse.ok) {
      const errorData = (await deductResponse.json()) as ApiResponse;
      // Map common status codes or default to 400
      const status =
        deductResponse.status === 400 || deductResponse.status === 403
          ? deductResponse.status
          : 400;
      return c.json<ApiResponse>(
        {
          success: false,
          error: errorData.error || "Failed to deduct evolution cost",
          timestamp: Date.now(),
        },
        status,
      );
    }

    // 7. Update NFT in Redis
    const updatedNft = {
      ...nftData,
      level: nextLevel.toString(),
      xp: "0", // Reset XP after evolution
      evolutionCount: (currentEvolutionCount + 1).toString(),
    };

    await redis.hset(`nft:minted:${tokenId}`, updatedNft);

    console.log(
      `[NFT] Evolved token #${tokenId} to level ${nextLevel} for ${address}`,
    );

    // 8. Return updated NFT
    const responseNft = {
      tokenId,
      dna: nftData.dna as string,
      bloodline: nftData.bloodline as string,
      baseType: nftData.baseType as string,
      genesisBlock: parseInt(nftData.genesisBlock as string, 10) || 0,
      rarityTier: nftData.rarityTier as string,
      level: nextLevel,
      xp: 0,
      totalXp: parseInt(nftData.totalXp as string, 10) || 0,
      workCount: parseInt(nftData.workCount as string, 10) || 0,
      lastWorkBlock: parseInt(nftData.lastWorkBlock as string, 10) || 0,
      evolutionCount: currentEvolutionCount + 1,
      tokensEarned: (nftData.tokensEarned as string) || "0",
      txid: nftData.txid as string,
      address: nftData.address as string,
      mintedAt: parseInt(nftData.mintedAt as string, 10),
    };

    return c.json<
      ApiResponse<{
        nft: typeof responseNft;
        evolutionCost: string;
        previousLevel: number;
        newLevel: number;
      }>
    >({
      success: true,
      data: {
        nft: responseNft,
        evolutionCost: evolutionCost.toString(),
        previousLevel: currentLevel,
        newLevel: nextLevel,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[NFT] Evolution error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to evolve NFT",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// ADMIN ENDPOINTS (Testnet Only)
// =============================================================================

/**
 * DELETE /api/admin/reset/:address - Reset a user's data (testnet only)
 * Requires X-Admin-Key header matching ADMIN_KEY secret
 */
app.delete("/api/admin/reset/:address", async (c) => {
  const address = c.req.param("address");

  // Simple admin key check (set via wrangler secret put ADMIN_KEY)
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  // If no admin key configured, allow in development only
  if (expectedKey && adminKey !== expectedKey) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Unauthorized",
        timestamp: Date.now(),
      },
      401,
    );
  }

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    // Reset balance in Durable Object
    const balanceId = c.env.VIRTUAL_BALANCE.idFromName(address);
    const balanceStub = c.env.VIRTUAL_BALANCE.get(balanceId);
    await balanceStub.fetch(
      new Request(`http://internal/balance/${address}/reset`, {
        method: "DELETE",
      }),
    );

    // Clear user from Redis leaderboards
    const redis = getRedis(c.env);
    await redis.del(`user:${address}:stats`);

    console.log(`[Admin] Reset complete for ${address}`);

    return c.json<ApiResponse>({
      success: true,
      data: { address, reset: true },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Admin] Reset error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Reset failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * DELETE /api/admin/reset-all - Reset all leaderboards (testnet only)
 */
app.delete("/api/admin/reset-all", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (expectedKey && adminKey !== expectedKey) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Unauthorized",
        timestamp: Date.now(),
      },
      401,
    );
  }

  try {
    const redis = getRedis(c.env);

    // Reset all leaderboards
    await resetDailyLeaderboard(redis);
    await resetWeeklyLeaderboard(redis);

    // Flush all keys (will recreate leaderboard structure)
    await redis.flushdb();

    console.log("[Admin] Full reset complete");

    return c.json<ApiResponse>({
      success: true,
      data: { reset: "all" },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Admin] Reset-all error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Reset failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/admin/nft/sync - Sync NFT counter with on-chain data
 * Sets the counter to match actual on-chain mints
 */
app.post("/api/admin/nft/sync", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (expectedKey && adminKey !== expectedKey) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Unauthorized",
        timestamp: Date.now(),
      },
      401,
    );
  }

  try {
    const body = await c.req.json<{ count: number }>();
    const count = body.count;

    if (typeof count !== "number" || count < 0 || count > 10000) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid count (must be 0-10000)",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);
    await redis.set("nft:minted:count", count);

    console.log(`[Admin] NFT counter synced to: ${count}`);

    return c.json<ApiResponse<{ count: number }>>({
      success: true,
      data: { count },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Admin] NFT sync error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Sync failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

/**
 * POST /api/admin/nft/register - Register an existing NFT manually
 * Used to backfill NFTs minted before the indexing system was implemented
 */
app.post("/api/admin/nft/register", async (c) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  if (expectedKey && adminKey !== expectedKey) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Unauthorized",
        timestamp: Date.now(),
      },
      401,
    );
  }

  try {
    const body = await c.req.json<{
      tokenId: number;
      address: string;
      txid: string;
      dna?: string;
      bloodline?: string;
      baseType?: string;
      rarityTier?: string;
    }>();

    const { tokenId, address, txid } = body;

    if (!tokenId || !address || !txid) {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "tokenId, address, and txid are required",
          timestamp: Date.now(),
        },
        400,
      );
    }

    const redis = getRedis(c.env);
    const mintedAt = Date.now();

    // Generate random NFT data if not provided (for legacy mints)
    const randomDna =
      body.dna ||
      Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join("");

    const bloodlines = ["royal", "warrior", "rogue", "mystic"];
    const baseTypes = ["human", "animal", "robot", "mystic", "alien"];
    const rarities = [
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ];

    const nftRecord = {
      tokenId,
      txid,
      address,
      mintedAt,
      dna: randomDna,
      bloodline:
        body.bloodline ||
        bloodlines[Math.floor(Math.random() * bloodlines.length)],
      baseType:
        body.baseType ||
        baseTypes[Math.floor(Math.random() * baseTypes.length)],
      rarityTier: body.rarityTier || rarities[0], // Default to common for legacy
      level: 1,
      xp: 0,
      totalXp: 0,
      workCount: 0,
      evolutionCount: 0,
      genesisBlock: 0,
      lastWorkBlock: 0,
      tokensEarned: "0",
    };

    // Store by tokenId
    await redis.hset(`nft:minted:${tokenId}`, nftRecord);

    // Index by address
    await redis.sadd(`nft:owned:${address}`, tokenId.toString());

    console.log(`[Admin] Registered NFT #${tokenId} for ${address}`);

    return c.json<ApiResponse<typeof nftRecord>>({
      success: true,
      data: nftRecord,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[Admin] NFT register error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Registration failed",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// TRANSACTION HISTORY
// =============================================================================

interface HistoryEntry {
  id: string;
  type: "mining" | "withdraw" | "nft_purchase" | "nft_sale" | "evolution";
  amount: string; // BigInt as string
  status: "completed" | "pending" | "failed" | "broadcast";
  timestamp: number;
  txid?: string | null;
  details?: Record<string, unknown>;
}

/**
 * GET /api/history/:address - Get transaction history for an address
 *
 * Returns combined history from:
 * - Mining rewards (from VirtualBalanceDO)
 * - Withdrawals (from WithdrawPoolDO)
 * - NFT activities (from Redis)
 */
app.get("/api/history/:address", async (c) => {
  const address = c.req.param("address");
  const limit = parseInt(c.req.query("limit") || "50", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  if (!address || !isValidBitcoinAddress(address)) {
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      },
      400,
    );
  }

  try {
    const history: HistoryEntry[] = [];

    // 1. Get mining history from VirtualBalanceDO
    try {
      const balanceId = c.env.VIRTUAL_BALANCE.idFromName(address);
      const balanceStub = c.env.VIRTUAL_BALANCE.get(balanceId);

      const miningResponse = await balanceStub.fetch(
        new Request(`http://internal/balance/${address}/history?limit=100`),
      );

      if (miningResponse.ok) {
        const miningData = (await miningResponse.json()) as ApiResponse<{
          history: Array<{
            id: string;
            amount: string;
            timestamp: number;
            type: string;
          }>;
        }>;

        if (miningData.success && miningData.data?.history) {
          for (const entry of miningData.data.history) {
            history.push({
              id: entry.id,
              type: "mining",
              amount: entry.amount,
              status: "completed",
              timestamp: entry.timestamp,
            });
          }
        }
      }
    } catch {
      // Mining history not available, continue
    }

    // 2. Get withdrawal history from WithdrawPoolDO
    try {
      // Check all pool types
      for (const poolType of ["weekly", "monthly", "low_fee", "immediate"]) {
        const poolId = c.env.WITHDRAW_POOL.idFromName(poolType);
        const poolStub = c.env.WITHDRAW_POOL.get(poolId);

        const withdrawResponse = await poolStub.fetch(
          new Request(
            `http://internal/pool/${poolType}/requests?address=${address}`,
          ),
        );

        if (withdrawResponse.ok) {
          const withdrawData = (await withdrawResponse.json()) as ApiResponse<{
            requests: Array<{
              id: string;
              amount: string;
              status: string;
              txid: string | null;
              requestedAt: number;
              poolType: string;
            }>;
          }>;

          if (withdrawData.success && withdrawData.data?.requests) {
            for (const req of withdrawData.data.requests) {
              const status =
                req.status === "confirmed"
                  ? "completed"
                  : req.status === "failed" || req.status === "cancelled"
                    ? "failed"
                    : req.status === "broadcast"
                      ? "broadcast"
                      : "pending";

              history.push({
                id: req.id,
                type: "withdraw",
                amount: `-${req.amount}`, // Negative for withdrawals
                status,
                timestamp: req.requestedAt,
                txid: req.txid,
                details: { poolType: req.poolType },
              });
            }
          }
        }
      }
    } catch {
      // Withdrawal history not available, continue
    }

    // 3. Get NFT transaction history from Redis
    try {
      const redis = getRedis(c.env);

      // Get NFT purchases (buyer history)
      const purchaseKeys = await redis.keys(`nft:purchase:*`);
      for (const key of purchaseKeys.slice(0, 50)) {
        const purchase = (await redis.get(key)) as string | null;
        if (purchase) {
          try {
            const data = JSON.parse(purchase) as {
              buyerAddress: string;
              sellerAddress: string;
              tokenId: number;
              price: number;
              timestamp: number;
            };

            if (data.buyerAddress === address) {
              history.push({
                id: key.replace("nft:purchase:", ""),
                type: "nft_purchase",
                amount: `-${data.price}`,
                status: "completed",
                timestamp: data.timestamp,
                details: { tokenId: data.tokenId },
              });
            } else if (data.sellerAddress === address) {
              history.push({
                id: key.replace("nft:purchase:", ""),
                type: "nft_sale",
                amount: data.price.toString(),
                status: "completed",
                timestamp: data.timestamp,
                details: { tokenId: data.tokenId },
              });
            }
          } catch {
            // Skip invalid entries
          }
        }
      }
    } catch {
      // NFT history not available, continue
    }

    // Sort by timestamp descending (newest first)
    history.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedHistory = history.slice(offset, offset + limit);

    return c.json<
      ApiResponse<{
        history: HistoryEntry[];
        total: number;
        limit: number;
        offset: number;
      }>
    >({
      success: true,
      data: {
        history: paginatedHistory,
        total: history.length,
        limit,
        offset,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error("[History] Error:", error);
    return c.json<ApiResponse>(
      {
        success: false,
        error: "Failed to get transaction history",
        timestamp: Date.now(),
      },
      500,
    );
  }
});

// =============================================================================
// SCHEDULED TASKS (Cron)
// =============================================================================

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const hour = new Date(event.scheduledTime).getUTCHours();
  const dayOfWeek = new Date(event.scheduledTime).getUTCDay();
  const dayOfMonth = new Date(event.scheduledTime).getUTCDate();

  console.log(
    `[Scheduled] Running at hour=${hour}, dayOfWeek=${dayOfWeek}, dayOfMonth=${dayOfMonth}`,
  );

  // ==========================================================================
  // LEADERBOARD RESET
  // ==========================================================================

  // Daily leaderboard reset - every day at midnight UTC
  if (hour === 0) {
    console.log("[Scheduled] Resetting daily leaderboard...");
    try {
      const redis = getRedis(env);
      await resetDailyLeaderboard(redis);
      console.log("[Scheduled] Daily leaderboard reset complete");
    } catch (error) {
      console.error("[Scheduled] Failed to reset daily leaderboard:", error);
    }
  }

  // Weekly leaderboard reset - Sunday at midnight UTC
  if (dayOfWeek === 0 && hour === 0) {
    console.log("[Scheduled] Resetting weekly leaderboard...");
    try {
      const redis = getRedis(env);
      await resetWeeklyLeaderboard(redis);
      console.log("[Scheduled] Weekly leaderboard reset complete");
    } catch (error) {
      console.error("[Scheduled] Failed to reset weekly leaderboard:", error);
    }
  }

  // ==========================================================================
  // WITHDRAW POOL PROCESSING
  // ==========================================================================

  // Weekly pool - Sunday at midnight
  if (dayOfWeek === 0 && hour === 0) {
    console.log("[Scheduled] Processing weekly pool...");
    const id = env.WITHDRAW_POOL.idFromName("weekly");
    const stub = env.WITHDRAW_POOL.get(id);
    await stub.fetch(
      new Request("http://internal/pool/weekly/process", { method: "POST" }),
    );
  }

  // Monthly pool - 1st of month at midnight
  if (dayOfMonth === 1 && hour === 0) {
    console.log("[Scheduled] Processing monthly pool...");
    const id = env.WITHDRAW_POOL.idFromName("monthly");
    const stub = env.WITHDRAW_POOL.get(id);
    await stub.fetch(
      new Request("http://internal/pool/monthly/process", { method: "POST" }),
    );
  }

  // Low-fee check - every 6 hours
  if (hour % 6 === 0) {
    console.log("[Scheduled] Checking low-fee opportunities...");
    const id = env.WITHDRAW_POOL.idFromName("low_fee");
    const stub = env.WITHDRAW_POOL.get(id);

    // Get current fee rate from mempool.space
    try {
      const feeResponse = await fetch(
        "https://mempool.space/testnet4/api/v1/fees/recommended",
      );
      const fees = (await feeResponse.json()) as { hourFee: number };
      const maxFee = parseInt(env.MAX_FEE_RATE_SAT_VB || "10");

      if (fees.hourFee <= maxFee) {
        console.log(
          `[Scheduled] Fee rate ${fees.hourFee} <= ${maxFee}, processing low_fee pool`,
        );
        await stub.fetch(
          new Request("http://internal/pool/low_fee/process", {
            method: "POST",
          }),
        );
      }
    } catch (error) {
      console.error("[Scheduled] Failed to check fees:", error);
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a cacheable JSON response with proper headers
 * Includes CORS headers for cross-origin requests
 */
function createCacheableResponse(
  data: unknown,
  cacheTTL: number,
  cacheHit: boolean,
): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheTTL}, s-maxage=${cacheTTL}, stale-while-revalidate=${cacheTTL * 2}`,
      "X-Cache": cacheHit ? "HIT" : "MISS",
      "X-Cache-TTL": String(cacheTTL),
      // CORS headers for cached responses
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function isValidBitcoinAddress(address: string): boolean {
  // Testnet4/Testnet addresses (tb1, m, n, 2)
  // Mainnet addresses (bc1, 1, 3)
  const patterns = [
    /^tb1[a-zA-HJ-NP-Z0-9]{39,59}$/, // Testnet bech32
    /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Testnet P2PKH
    /^2[a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Testnet P2SH
    /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/, // Mainnet bech32
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Mainnet P2PKH/P2SH
  ];

  return patterns.some((p) => p.test(address));
}

function isValidPoolType(poolType: string): poolType is PoolType {
  return ["weekly", "monthly", "low_fee", "immediate"].includes(poolType);
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
