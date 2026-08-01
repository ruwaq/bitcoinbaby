/**
 * BitcoinBaby Workers - Main Entry Point
 *
 * Cloudflare Workers API for:
 * - Virtual balance management
 * - Claim system (user-paid token minting)
 * - Game state synchronization
 * - NFT management and marketplace
 * - Leaderboards
 *
 * 100% FREE on Cloudflare Workers (free tier)
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./lib/types";
import {
  getRedis,
  resetDailyLeaderboard,
  resetWeeklyLeaderboard,
} from "./lib/redis";
import { scheduledLogger } from "./lib/logger";

// Import modular routers
import {
  balanceRouter,
  leaderboardRouter,
  nftRouter,
  adminRouter,
  historyRouter,
  gameRouter,
  claimRouter,
  engagementRouter,
  faucetRouter,
  pouwRouter,
  healthRouter,
  aiProxy,
  aiProxyExternal,
} from "./routes";

// Re-export Durable Objects
export { VirtualBalanceDO } from "./durable-objects/virtual-balance";
export { WithdrawPoolDO } from "./durable-objects/withdraw-pool";
export { GameRoomDO } from "./durable-objects/game-room";

// =============================================================================
// CREATE APP
// =============================================================================

const app = new Hono<{ Bindings: Env }>();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS for frontend
// SECURITY: No wildcards with credentials - list exact origins.
// The allowlist policy lives in src/lib/cors.ts so it can be unit-tested
// in isolation (see tests/cors-origins.test.ts).
import { getAllowedOrigin } from "./lib/cors";
app.use(
  "*",
  cors({
    origin: getAllowedOrigin,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Request-Id",
      "X-Wallet-Address",
      "X-Admin-Key",
    ],
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

// Metrics middleware (must be after request ID)
import { metricsMiddleware, securityHeaders } from "./lib/middleware";
app.use("*", metricsMiddleware);

// Security headers (must be applied to all responses)
app.use("*", securityHeaders);

// =============================================================================
// PHASE GATING - Apply before mounting gated routes
// =============================================================================

import { phaseGate } from "./lib/middleware";

// =============================================================================
// HEALTH & STATUS & METRICS
// =============================================================================

app.get("/", (c) => {
  return c.json({
    name: "BitcoinBaby API",
    version: "2.0.0",
    status: "healthy",
    timestamp: Date.now(),
  });
});

// Mount Health router (which handles /health, /health/metrics and /health/metrics/prometheus)
app.route("/health", healthRouter);

// =============================================================================
// MOUNT MODULAR ROUTERS
// =============================================================================

// Apply phase gating to feature routers
// Phase 2+: claims, leaderboard
claimRouter.use("*", phaseGate(2));
leaderboardRouter.use("*", phaseGate(2));
// Phase 3+: game, pouw
gameRouter.use("*", phaseGate(3));
pouwRouter.use("*", phaseGate(3));

// Balance management
app.route("/api/balance", balanceRouter);

// PoUW Task Retrieval
app.route("/api/pouw", pouwRouter);

// Leaderboards
app.route("/api/leaderboard", leaderboardRouter);

// NFT management and marketplace
app.route("/api/nft", nftRouter);

// Game rooms (WebSocket + HTTP)
app.route("/api/game", gameRouter);

// Admin endpoints
app.route("/api/admin", adminRouter);

// Transaction history
app.route("/api/history", historyRouter);

// Claim system - Server-Assisted (simplified UX)
app.route("/api/claim", claimRouter);

// Engagement tracking (daily login, baby care, play time)
app.route("/api/engagement", engagementRouter);

// BABTC Faucet (Phase 1)
app.route("/api/faucet", faucetRouter);

// AI Proxy — Cloudflare Workers AI (server-side token)
app.route("/api/ai", aiProxy);

// AI Proxy — External providers (OpenAI, Anthropic, Google)
app.route("/api/ai/proxy", aiProxyExternal);

// =============================================================================
// SCHEDULED TASKS (Cron)
// =============================================================================

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  const hour = new Date(event.scheduledTime).getUTCHours();
  const dayOfWeek = new Date(event.scheduledTime).getUTCDay();
  const dayOfMonth = new Date(event.scheduledTime).getUTCDate();

  scheduledLogger.info("Running scheduled tasks", {
    hour,
    dayOfWeek,
    dayOfMonth,
  });

  // ==========================================================================
  // LEADERBOARD RESET
  // ==========================================================================

  // Daily leaderboard reset - every day at midnight UTC
  if (hour === 0) {
    scheduledLogger.info("Resetting daily leaderboard");
    try {
      const redis = getRedis(env);
      await resetDailyLeaderboard(redis);
      scheduledLogger.info("Daily leaderboard reset complete");
    } catch (error) {
      scheduledLogger.error("Failed to reset daily leaderboard", error);
    }
  }

  // Weekly leaderboard reset - Sunday at midnight UTC
  if (dayOfWeek === 0 && hour === 0) {
    scheduledLogger.info("Resetting weekly leaderboard");
    try {
      const redis = getRedis(env);
      await resetWeeklyLeaderboard(redis);
      scheduledLogger.info("Weekly leaderboard reset complete");
    } catch (error) {
      scheduledLogger.error("Failed to reset weekly leaderboard", error);
    }
  }

  // ==========================================================================
  // CLAIM SYSTEM MAINTENANCE
  // ==========================================================================

  // Expire old claims every 6 hours
  if (hour % 6 === 0) {
    scheduledLogger.info("Running claim maintenance");
    try {
      // Call internal cleanup endpoint
      const response = await app.fetch(
        new Request("http://internal/api/claim/cleanup", { method: "POST" }),
        env,
      );
      const result = (await response.json()) as { expiredCount?: number };
      scheduledLogger.info("Claim maintenance complete", {
        expiredCount: result.expiredCount || 0,
      });
    } catch (error) {
      scheduledLogger.error("Claim maintenance failed", error);
    }
  }

  // Retry failed mints every hour
  if (hour % 1 === 0) {
    try {
      const response = await app.fetch(
        new Request("http://internal/api/claim/retry-failed", {
          method: "POST",
        }),
        env,
      );
      const result = (await response.json()) as { retriedCount?: number };
      if ((result.retriedCount ?? 0) > 0) {
        scheduledLogger.info("Retried failed mints", {
          retriedCount: result.retriedCount,
        });
      }
    } catch (error) {
      scheduledLogger.error("Failed mint retry failed", error);
    }
  }

  // Reconcile leaderboards periodically (daily at 00:00 UTC)
  if (hour === 0) {
    scheduledLogger.info("Running leaderboard reconciliation");
    try {
      const redis = getRedis(env);
      // Fetch all miner addresses from leaderboard
      const addresses = await redis.zrange("leaderboard:miners:all", 0, -1);
      
      scheduledLogger.info(`Found ${addresses.length} miners to reconcile`);
      
      for (const address of addresses) {
        if (typeof address === "string") {
          const id = env.VIRTUAL_BALANCE.idFromName(address);
          const stub = env.VIRTUAL_BALANCE.get(id);
          await stub.fetch(
            new Request(`http://internal/balance/${address}/reconcile`, {
              method: "POST",
              headers: {
                "X-Admin-Key": env.ADMIN_KEY || "",
              },
            }),
          );
        }
      }
      scheduledLogger.info("Leaderboard reconciliation complete");
    } catch (error) {
      scheduledLogger.error("Leaderboard reconciliation failed", error);
    }
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
