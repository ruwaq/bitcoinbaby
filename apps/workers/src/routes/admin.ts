/**
 * Admin Routes
 *
 * Administrative endpoints for managing the BitcoinBaby platform.
 * All routes require X-Admin-Key header for authentication.
 *
 * Routes:
 * - DELETE /api/admin/reset/:address  - Reset user data
 * - DELETE /api/admin/reset-all       - Reset all leaderboards
 * - POST   /api/admin/nft/sync        - Sync NFT counter
 * - POST   /api/admin/nft/register    - Register existing NFT
 * - GET    /api/history/:address      - Get transaction history
 */

import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Env, ApiResponse, PoolType } from "../lib/types";
import {
  getRedis,
  resetDailyLeaderboard,
  resetWeeklyLeaderboard,
} from "../lib/redis";
import { errorResponse, successResponse } from "../lib/helpers";
import { adminLogger } from "../lib/logger";
import { createTreasurySigner } from "../services/treasury-signer";
import {
  validateBody,
  validateParams,
  validateQuery,
  bitcoinAddressSchema,
  paginationSchema,
} from "../lib/middleware";

export const adminRouter = new Hono<{ Bindings: Env }>();
export const historyRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// SCHEMAS
// =============================================================================

const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

const nftSyncSchema = z.object({
  count: z.number().int().min(0).max(10000),
});

const nftRegisterSchema = z.object({
  tokenId: z.number().int().positive(),
  address: bitcoinAddressSchema,
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  dna: z.string().optional(),
  bloodline: z.enum(["royal", "warrior", "rogue", "mystic"]).optional(),
  baseType: z.enum(["human", "animal", "robot", "mystic", "alien"]).optional(),
  rarityTier: z
    .enum(["common", "uncommon", "rare", "epic", "legendary", "mythic"])
    .optional(),
});

// =============================================================================
// ADMIN AUTH MIDDLEWARE
// =============================================================================

/**
 * Middleware to verify admin authentication
 */
const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const adminKey = c.req.header("X-Admin-Key");
  const expectedKey = c.env.ADMIN_KEY;

  // If admin key is configured, require it
  if (expectedKey && adminKey !== expectedKey) {
    return errorResponse(c, "Unauthorized", 401);
  }

  await next();
});

// Apply admin auth to all routes
adminRouter.use("*", requireAdmin);

// =============================================================================
// ADMIN ENDPOINTS
// =============================================================================

/**
 * DELETE /api/admin/reset/:address - Reset a user's data (testnet only)
 */
adminRouter.delete(
  "/reset/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

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

      adminLogger.info("Reset complete", { address });

      return successResponse(c, { address, reset: true });
    } catch (error) {
      adminLogger.error("Reset error", error);
      return errorResponse(c, "Reset failed", 500);
    }
  },
);

/**
 * DELETE /api/admin/reset-all - Reset all leaderboards (testnet only)
 */
adminRouter.delete("/reset-all", async (c) => {
  try {
    const redis = getRedis(c.env);

    // Reset all leaderboards
    await resetDailyLeaderboard(redis);
    await resetWeeklyLeaderboard(redis);

    // Flush all keys
    await redis.flushdb();

    adminLogger.info("Full reset complete");

    return successResponse(c, { reset: "all" });
  } catch (error) {
    adminLogger.error("Reset-all error", error);
    return errorResponse(c, "Reset failed", 500);
  }
});

/**
 * DELETE /api/admin/full-system-reset - Complete system reset
 * Resets Redis AND triggers full reset on a VirtualBalance DO
 * This effectively clears all mining data, claims, and NFT records
 */
adminRouter.delete("/full-system-reset", async (c) => {
  try {
    const results: Record<string, boolean> = {};

    // 1. Reset Redis (leaderboards, NFT data, caches)
    try {
      const redis = getRedis(c.env);
      await resetDailyLeaderboard(redis);
      await resetWeeklyLeaderboard(redis);
      await redis.flushdb();
      results.redis = true;
      adminLogger.info("Redis flushed");
    } catch (redisError) {
      adminLogger.error("Redis reset failed", redisError);
      results.redis = false;
    }

    // 2. Reset KV cache
    try {
      // List and delete all keys in CACHE namespace
      const listResult = await c.env.CACHE.list();
      for (const key of listResult.keys) {
        await c.env.CACHE.delete(key.name);
      }
      results.kvCache = true;
      adminLogger.info("KV cache cleared", {
        keysDeleted: listResult.keys.length,
      });
    } catch (kvError) {
      adminLogger.error("KV reset failed", kvError);
      results.kvCache = false;
    }

    // 3. Trigger full reset on system DO (uses a special system address)
    try {
      const systemId = c.env.VIRTUAL_BALANCE.idFromName("__system__");
      const systemStub = c.env.VIRTUAL_BALANCE.get(systemId);
      await systemStub.fetch(
        new Request("http://internal/balance/__system__/full-reset", {
          method: "DELETE",
        }),
      );
      results.virtualBalanceDO = true;
      adminLogger.info("VirtualBalance DO tables reset");
    } catch (doError) {
      adminLogger.error("DO reset failed", doError);
      results.virtualBalanceDO = false;
    }

    // 4. Reset WithdrawPool DOs
    try {
      const poolTypes = ["weekly", "monthly", "low_fee", "immediate"];
      for (const poolType of poolTypes) {
        const poolId = c.env.WITHDRAW_POOL.idFromName(poolType);
        const poolStub = c.env.WITHDRAW_POOL.get(poolId);
        await poolStub.fetch(
          new Request(`http://internal/pool/${poolType}/reset`, {
            method: "DELETE",
          }),
        );
      }
      results.withdrawPoolDO = true;
      adminLogger.info("WithdrawPool DOs reset");
    } catch (poolError) {
      adminLogger.error("WithdrawPool reset failed", poolError);
      results.withdrawPoolDO = false;
    }

    adminLogger.info("Full system reset complete", results);

    return successResponse(c, {
      message: "Full system reset complete",
      results,
      timestamp: Date.now(),
    });
  } catch (error) {
    adminLogger.error("Full system reset error", error);
    return errorResponse(c, "Full system reset failed", 500);
  }
});

/**
 * POST /api/admin/nft/sync - Sync NFT counter with on-chain data
 */
adminRouter.post("/nft/sync", validateBody(nftSyncSchema), async (c) => {
  const { count } = c.get("validatedBody");

  try {
    const redis = getRedis(c.env);
    await redis.set("nft:minted:count", count);

    adminLogger.info("NFT counter synced", { count });

    return successResponse(c, { count });
  } catch (error) {
    adminLogger.error("NFT sync error", error);
    return errorResponse(c, "Sync failed", 500);
  }
});

/**
 * POST /api/admin/nft/register - Register an existing NFT manually
 */
adminRouter.post(
  "/nft/register",
  validateBody(nftRegisterSchema),
  async (c) => {
    const body = c.get("validatedBody");
    const { tokenId, address, txid } = body;

    try {
      const redis = getRedis(c.env);
      const mintedAt = Date.now();

      // Generate random NFT data if not provided
      const randomDna =
        body.dna ||
        Array.from({ length: 64 }, () =>
          Math.floor(Math.random() * 16).toString(16),
        ).join("");

      const bloodlines = ["royal", "warrior", "rogue", "mystic"] as const;
      const baseTypes = [
        "human",
        "animal",
        "robot",
        "mystic",
        "alien",
      ] as const;

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
        rarityTier: body.rarityTier || "common",
        level: 1,
        xp: 0,
        totalXp: 0,
        workCount: 0,
        evolutionCount: 0,
        genesisBlock: 0,
        lastWorkBlock: 0,
        tokensEarned: "0",
      };

      await redis.hset(`nft:minted:${tokenId}`, nftRecord);
      await redis.sadd(`nft:owned:${address}`, tokenId.toString());

      adminLogger.info("Registered NFT", { tokenId, address });

      return successResponse(c, nftRecord);
    } catch (error) {
      adminLogger.error("NFT register error", error);
      return errorResponse(c, "Registration failed", 500);
    }
  },
);

// =============================================================================
// TREASURY SIGNER ENDPOINTS
// =============================================================================

/**
 * GET /api/admin/signer/health - Check signer service health
 */
adminRouter.get("/signer/health", async (c) => {
  try {
    const signer = createTreasurySigner(c.env);
    const health = await signer.healthCheck();

    return successResponse(c, health);
  } catch (error) {
    adminLogger.error("Signer health check error", error);
    return errorResponse(c, "Health check failed", 500);
  }
});

/**
 * POST /api/admin/signer/process - Manually trigger batch processing
 */
adminRouter.post("/signer/process", async (c) => {
  try {
    adminLogger.info("Manual signer processing triggered");

    const signer = createTreasurySigner(c.env);
    const results = await signer.processAllBatches();

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    adminLogger.info("Manual processing complete", {
      total: results.length,
      successful,
      failed,
    });

    return successResponse(c, {
      processed: results.length,
      successful,
      failed,
      results,
    });
  } catch (error) {
    adminLogger.error("Manual signer processing error", error);
    return errorResponse(c, "Processing failed", 500);
  }
});

/**
 * GET /api/admin/treasury/balance - Get treasury token balance
 */
adminRouter.get("/treasury/balance", async (c) => {
  try {
    const signer = createTreasurySigner(c.env);
    await signer.initialize();

    const address = signer.getTreasuryAddress();
    const balance = await signer.getTreasuryTokenBalance();

    return successResponse(c, {
      address,
      balance: balance.toString(),
      balanceFormatted: `${Number(balance) / 100_000_000} BABTC`,
    });
  } catch (error) {
    adminLogger.error("Treasury balance check error", error);
    return errorResponse(c, "Balance check failed", 500);
  }
});

// =============================================================================
// HISTORY ENDPOINT
// =============================================================================

interface HistoryEntry {
  id: string;
  type: "mining" | "withdraw" | "nft_purchase" | "nft_sale" | "evolution";
  amount: string;
  status: "completed" | "pending" | "failed" | "broadcast";
  timestamp: number;
  txid?: string | null;
  details?: Record<string, unknown>;
}

/**
 * GET /api/history/:address - Get transaction history for an address
 */
historyRouter.get(
  "/:address",
  validateParams(addressParamSchema),
  validateQuery(paginationSchema),
  async (c) => {
    const { address } = c.get("validatedParams");
    const { limit, offset } = c.get("validatedQuery");

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
        // Mining history not available
      }

      // 2. Get withdrawal history from WithdrawPoolDO
      try {
        const poolTypes: PoolType[] = [
          "weekly",
          "monthly",
          "low_fee",
          "immediate",
        ];

        for (const poolType of poolTypes) {
          const poolId = c.env.WITHDRAW_POOL.idFromName(poolType);
          const poolStub = c.env.WITHDRAW_POOL.get(poolId);

          const withdrawResponse = await poolStub.fetch(
            new Request(
              `http://internal/pool/${poolType}/requests?address=${address}`,
            ),
          );

          if (withdrawResponse.ok) {
            const withdrawData =
              (await withdrawResponse.json()) as ApiResponse<{
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
                  amount: `-${req.amount}`,
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
        // Withdrawal history not available
      }

      // 3. Get NFT transaction history from Redis
      try {
        const redis = getRedis(c.env);

        const purchaseKeys = await redis.keys("nft:purchase:*");
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
        // NFT history not available
      }

      // Sort by timestamp descending
      history.sort((a, b) => b.timestamp - a.timestamp);

      // Apply pagination
      const paginatedHistory = history.slice(offset, offset + limit);

      return successResponse(c, {
        history: paginatedHistory,
        total: history.length,
        limit,
        offset,
      });
    } catch (error) {
      adminLogger.error("History error", error);
      return errorResponse(c, "Failed to get transaction history", 500);
    }
  },
);
