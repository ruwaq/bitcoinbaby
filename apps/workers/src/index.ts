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
// SECURITY: No wildcards with credentials - list exact origins
app.use(
  "*",
  cors({
    origin: (origin) => {
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://bitcoinbaby.app",
        "https://www.bitcoinbaby.app",
        "https://bitcoinbaby.vercel.app",
      ];

      if (!origin) return allowedOrigins[0];

      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      // Allow bitcoinbaby.app subdomains
      if (/^https:\/\/[a-z0-9-]+\.bitcoinbaby\.app$/.test(origin)) {
        return origin;
      }

      // SECURITY WARNING: This pattern matches ANY Vercel preview deployment
      // under the bitcoinbaby- prefix. A malicious actor could create a
      // bitcoinbaby-evil.vcerl.app deployment to bypass CORS. Consider
      // restricting this to known branch names (e.g., main, staging) or
      // removing it entirely and using an explicit allowlist for previews.
      if (/^https:\/\/bitcoinbaby-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
        console.warn("[CORS] Allowing Vercel preview origin (broad pattern):", origin);
        return origin;
      }

      return null;
    },
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
import { metricsMiddleware } from "./lib/middleware";
app.use("*", metricsMiddleware);

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

app.get("/health", async (c) => {
  const checks: Record<string, "ok" | "error" | "unknown"> = {
    api: "ok",
    redis: "unknown",
    kv: "unknown",
  };

  // Check Redis connectivity
  try {
    const redis = getRedis(c.env);
    if (redis) {
      await redis.ping();
      checks.redis = "ok";
    }
  } catch {
    checks.redis = "error";
  }

  // Check KV availability
  try {
    if (c.env.CACHE) {
      // Simple read test
      await c.env.CACHE.get("health-check-test");
      checks.kv = "ok";
    }
  } catch {
    checks.kv = "error";
  }

  const allHealthy = Object.values(checks).every(
    (v) => v === "ok" || v === "unknown",
  );

  return c.json(
    {
      status: allHealthy ? "healthy" : "degraded",
      environment: c.env.ENVIRONMENT,
      version: "2.0.0",
      checks,
      timestamp: Date.now(),
    },
    allHealthy ? 200 : 503,
  );
});

// Metrics endpoint (JSON summary)
import { metrics } from "./lib/metrics";

app.get("/metrics", (c) => {
  return c.json({
    success: true,
    data: metrics.summary(),
    timestamp: Date.now(),
  });
});

// Prometheus-compatible metrics endpoint
app.get("/metrics/prometheus", (c) => {
  c.header("Content-Type", "text/plain; charset=utf-8");
  return c.text(metrics.toPrometheus());
});

// =============================================================================
// MOUNT MODULAR ROUTERS
// =============================================================================

// Balance management
app.route("/api/balance", balanceRouter);

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
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
