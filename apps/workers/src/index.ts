/**
 * BitcoinBaby Workers - Main Entry Point
 *
 * Cloudflare Workers API for:
 * - Virtual balance management
 * - Withdrawal pool batching
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
import { fetchWithTimeout, EXTERNAL_API } from "./lib/helpers";
import { scheduledLogger } from "./lib/logger";
import {
  createBatchMintingService,
  type ReadyBatch,
} from "./services/batch-minting";

// Import modular routers
import {
  balanceRouter,
  poolRouter,
  leaderboardRouter,
  nftRouter,
  adminRouter,
  historyRouter,
  gameRouter,
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

      // Allow Vercel preview deployments
      if (/^https:\/\/bitcoinbaby-[a-z0-9-]+\.vercel\.app$/.test(origin)) {
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

// =============================================================================
// HEALTH & STATUS
// =============================================================================

app.get("/", (c) => {
  return c.json({
    name: "BitcoinBaby API",
    version: "2.0.0",
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
// MOUNT MODULAR ROUTERS
// =============================================================================

// Balance management
app.route("/api/balance", balanceRouter);

// Withdrawal pools
app.route("/api/pool", poolRouter);

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

// =============================================================================
// BATCH MINTING PROCESSING
// =============================================================================

/**
 * Process ready batches through Prover API
 *
 * This function fetches batches that are ready for processing and submits
 * them to the Charms Prover API to generate commit + spell transactions.
 */
async function processReadyBatchesWithProver(env: Env): Promise<void> {
  const batchMintingService = createBatchMintingService(env);

  // Check if prover is available
  const proverAvailable = await batchMintingService.isProverAvailable();
  if (!proverAvailable) {
    scheduledLogger.warn(
      "Prover service unavailable, skipping batch minting processing",
    );
    return;
  }

  // Get ready batches from all pool types
  const poolTypes = ["weekly", "monthly", "low_fee", "immediate"] as const;

  for (const poolType of poolTypes) {
    try {
      const id = env.WITHDRAW_POOL.idFromName(poolType);
      const stub = env.WITHDRAW_POOL.get(id);

      // Fetch ready batches
      const response = await stub.fetch(
        new Request("http://internal/pool/batches/ready", {
          method: "GET",
          headers: {
            "X-Admin-Key": env.ADMIN_KEY || "",
          },
        }),
      );

      if (!response.ok) {
        scheduledLogger.warn("Failed to fetch ready batches", {
          poolType,
          status: response.status,
        });
        continue;
      }

      const data = (await response.json()) as {
        success: boolean;
        data?: {
          batches: ReadyBatch[];
        };
      };

      if (!data.success || !data.data?.batches?.length) {
        continue;
      }

      // Process each batch through Prover API
      for (const batch of data.data.batches) {
        scheduledLogger.info("Processing batch through Prover API", {
          batchId: batch.id,
          poolType,
          recipientCount: batch.recipients.length,
        });

        const result = await batchMintingService.processBatch(batch);

        if (result.success) {
          scheduledLogger.info("Batch processed successfully", {
            batchId: batch.id,
            hasCommitTx: !!result.commitTxHex,
            hasSpellTx: !!result.spellTxHex,
          });

          // TODO: Store commit/spell TXs for external signing
          // For now, log the result. In production, these TXs would be
          // stored in the batch record and fetched by an external signer.
          // The signer would then sign both TXs and broadcast them.
        } else {
          scheduledLogger.error("Batch processing failed", null, {
            batchId: batch.id,
            error: result.error,
          });
        }
      }
    } catch (error) {
      scheduledLogger.error("Error processing pool batches", error, {
        poolType,
      });
    }
  }
}

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
  // WITHDRAW POOL PROCESSING
  // ==========================================================================

  // Weekly pool - Sunday at midnight
  if (dayOfWeek === 0 && hour === 0) {
    scheduledLogger.info("Processing weekly pool");
    const id = env.WITHDRAW_POOL.idFromName("weekly");
    const stub = env.WITHDRAW_POOL.get(id);
    await stub.fetch(
      new Request("http://internal/pool/weekly/process", { method: "POST" }),
    );
  }

  // Monthly pool - 1st of month at midnight
  if (dayOfMonth === 1 && hour === 0) {
    scheduledLogger.info("Processing monthly pool");
    const id = env.WITHDRAW_POOL.idFromName("monthly");
    const stub = env.WITHDRAW_POOL.get(id);
    await stub.fetch(
      new Request("http://internal/pool/monthly/process", { method: "POST" }),
    );
  }

  // Low-fee check - every 6 hours
  if (hour % 6 === 0) {
    scheduledLogger.info("Checking low-fee opportunities");
    const id = env.WITHDRAW_POOL.idFromName("low_fee");
    const stub = env.WITHDRAW_POOL.get(id);

    try {
      const feeResponse = await fetchWithTimeout(
        `${EXTERNAL_API.MEMPOOL_TESTNET4}/v1/fees/recommended`,
        {},
        EXTERNAL_API.FEE_ESTIMATE_TIMEOUT_MS,
      );
      const fees = (await feeResponse.json()) as { hourFee: number };
      const maxFee = parseInt(env.MAX_FEE_RATE_SAT_VB || "10");

      if (fees.hourFee <= maxFee) {
        scheduledLogger.info("Processing low_fee pool", {
          feeRate: fees.hourFee,
          maxFee,
        });
        await stub.fetch(
          new Request("http://internal/pool/low_fee/process", {
            method: "POST",
          }),
        );
      }
    } catch (error) {
      scheduledLogger.error("Failed to check fees", error);
    }
  }

  // ==========================================================================
  // BATCH MINTING - PROVER API PROCESSING
  // ==========================================================================

  // Process ready batches every hour (after any pool processing)
  // This calls the Charms Prover API to generate commit + spell TXs
  scheduledLogger.info("Processing ready batches through Prover API");
  try {
    await processReadyBatchesWithProver(env);
    scheduledLogger.info("Batch minting processing complete");
  } catch (error) {
    scheduledLogger.error("Failed to process batches with Prover", error);
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  fetch: app.fetch,
  scheduled: handleScheduled,
};
