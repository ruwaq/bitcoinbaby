/**
 * NFT Reserve Routes — read-only + attempt tracking
 *
 * The write side of minting (reserve / prove / release) was removed in D3 and
 * replaced by the unified `POST /mint/prepare` + `/mint/finalize` flow in
 * `./mint.ts`. What remains here is the read-only counter / health endpoints
 * and the mint-attempt tracking that the client uses to surface status.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import { errorResponse, successResponse } from "../../lib/helpers";
import { validateBody, validateParams } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import { constantTimeEqual } from "../../lib/encoding";
import { getNFTMintingServiceSimple } from "../../services/nft-minting-simple";
import { getNetworkForEnvironment } from "../../config/bitcoin";
import { addressParamSchema } from "./middleware";

export const reserveRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// NFT COUNTER
// =============================================================================

/**
 * GET /counter - Get current NFT counter
 */
reserveRouter.get("/counter", async (c) => {
  try {
    const redis = getRedis(c.env);
    const count = await redis.get<number>("nft:minted:count");

    return successResponse(c, { count: count ?? 0 });
  } catch (error) {
    nftLogger.error("[NFT] Counter get error:", error);
    return errorResponse(c, "Failed to get counter", 500);
  }
});

/**
 * GET /prover-health - Check prover availability
 */
reserveRouter.get("/prover-health", async (c) => {
  try {
    const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
    if (!c.env.NFT_APP_ID || !c.env.NFT_APP_VK) {
      return errorResponse(c, "NFT app not configured", 503);
    }
    const mintingService = getNFTMintingServiceSimple({
      proverUrl: c.env.PROVER_URL || "https://v15.charms.dev",
      appId: c.env.NFT_APP_ID,
      appVk: c.env.NFT_APP_VK,
      network,
    });

    const health = await mintingService.healthCheck();

    return successResponse(c, health);
  } catch (error) {
    nftLogger.error("[NFT] Prover health check error:", error);
    return errorResponse(c, "Health check failed", 500);
  }
});

/**
 * GET /mint-attempts/:address - Get pending/recent mint attempts
 *
 * Returns mint attempts for an address so users can see status of their mints.
 */
reserveRouter.get(
  "/mint-attempts/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    try {
      const redis = getRedis(c.env);

      // Get all attempt IDs for this address
      const attemptIds = await redis.smembers(`nft:attempts:${address}`);

      if (!attemptIds || attemptIds.length === 0) {
        return successResponse(c, { attempts: [], count: 0 });
      }

      // Fetch all attempts
      const attempts = await Promise.all(
        attemptIds.map(async (id) => {
          const attempt = await redis.hgetall(`nft:attempt:${id}`);
          if (!attempt || Object.keys(attempt).length === 0) {
            // Attempt expired, remove from set
            await redis.srem(`nft:attempts:${address}`, id);
            return null;
          }
          return {
            attemptId: attempt.attemptId as string,
            tokenId: parseInt(attempt.tokenId as string, 10),
            status: attempt.status as string,
            reservedAt: parseInt(attempt.reservedAt as string, 10),
            lastUpdatedAt: parseInt(attempt.lastUpdatedAt as string, 10),
            error: attempt.error || null,
            commitTxid: attempt.commitTxid || null,
            spellTxid: attempt.spellTxid || null,
          };
        }),
      );

      const validAttempts = attempts
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => b.reservedAt - a.reservedAt);

      return successResponse(c, {
        attempts: validAttempts,
        count: validAttempts.length,
      });
    } catch (error) {
      nftLogger.error("[NFT] Get mint attempts error:", error);
      return errorResponse(c, "Failed to get mint attempts", 500);
    }
  },
);

/**
 * POST /update-attempt - Update mint attempt status
 *
 * Called by client to update the status of a mint attempt.
 *
 * NOTE (D4.2): this endpoint is admin-gated via ADMIN_KEY. It mutates indexer
 * state and is not part of the normal client mint flow.
 */
reserveRouter.post(
  "/update-attempt",
  validateBody(
    z.object({
      attemptId: z.string(),
      status: z.enum([
        "reserved",
        "proving",
        "signing",
        "broadcasting",
        "confirmed",
        "failed",
      ]),
      error: z.string().optional(),
      commitTxid: z.string().optional(),
      spellTxid: z.string().optional(),
    }),
  ),
  async (c) => {
    // Admin-only: this mutates indexer attempt state and is not part of the
    // normal client mint flow (bug #10).
    const adminKey = c.req.header("X-Admin-Key");
    const expectedKey = c.env.ADMIN_KEY;
    if (
      !expectedKey ||
      !adminKey ||
      !constantTimeEqual(adminKey, expectedKey)
    ) {
      return errorResponse(c, "Unauthorized - admin key required", 401);
    }

    const { attemptId, status, error, commitTxid, spellTxid } =
      c.get("validatedBody");

    try {
      const redis = getRedis(c.env);

      // Check attempt exists
      const existing = await redis.hgetall(`nft:attempt:${attemptId}`);
      if (!existing || Object.keys(existing).length === 0) {
        return errorResponse(c, "Attempt not found or expired", 404);
      }

      // Update attempt
      const updates: Record<string, string | number> = {
        status,
        lastUpdatedAt: Date.now(),
      };

      if (error) updates.error = error;
      if (commitTxid) updates.commitTxid = commitTxid;
      if (spellTxid) updates.spellTxid = spellTxid;

      await redis.hset(`nft:attempt:${attemptId}`, updates);

      // If confirmed or failed, extend TTL for history purposes
      if (status === "confirmed" || status === "failed") {
        await redis.expire(`nft:attempt:${attemptId}`, 604800); // 7 days
      }

      nftLogger.info("Updated mint attempt", { attemptId, status });

      return successResponse(c, { updated: true, status });
    } catch (error) {
      nftLogger.error("[NFT] Update attempt error:", error);
      return errorResponse(c, "Failed to update attempt", 500);
    }
  },
);
