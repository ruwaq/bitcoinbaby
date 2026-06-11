/**
 * NFT Reserve Routes
 *
 * Token ID reservation, release, mint attempts, and proving.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import { errorResponse, successResponse } from "../../lib/helpers";
import { validateBody, validateParams } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import { getNFTMintingServiceSimple } from "../../services/nft-minting-simple";
import { getNetworkForEnvironment } from "../../config/bitcoin";
import {
  tokenIdParamSchema,
  addressParamSchema,
  reserveNftSchema,
  proveNftSchema,
  MAX_SUPPLY,
} from "./middleware";

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
    const mintingService = getNFTMintingServiceSimple({
      proverUrl: c.env.PROVER_URL || "https://v14.charms.dev",
      appId: c.env.NFT_APP_ID || "placeholder",
      appVk: c.env.NFT_APP_VK || "placeholder",
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
 * POST /reserve - Reserve a random NFT ID
 *
 * Uses random ID selection with collision detection for better UX:
 * - Each failed mint gets a new random ID (not stuck on same number)
 * - Token ID is treated as provisional until confirmed
 * - Failed reservations are automatically cleaned up
 *
 * The system maintains:
 * - nft:minted:count - Total confirmed mints (for stats)
 * - nft:reserved:{id} - Temporary reservation (expires in 10 min)
 * - nft:minted:{id} - Confirmed NFT data
 */
reserveRouter.post("/reserve", validateBody(reserveNftSchema), async (c) => {
  const { address } = c.get("validatedBody");

  try {
    const redis = getRedis(c.env);

    // Get current confirmed count for supply check
    const confirmedCount = (await redis.get<number>("nft:minted:count")) || 0;

    if (confirmedCount >= MAX_SUPPLY) {
      return errorResponse(c, "Max supply reached", 400);
    }

    // Find an available random token ID
    // Use a range slightly larger than MAX_SUPPLY for better distribution
    const MAX_ATTEMPTS = 20;
    let tokenId: number | null = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Generate random ID between 1 and MAX_SUPPLY
      const candidateId =
        Math.floor(
          (crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32) *
            MAX_SUPPLY,
        ) + 1;

      // Check if already minted (confirmed)
      const isMinted = await redis.exists(`nft:minted:${candidateId}`);
      if (isMinted) continue;

      // Check if already reserved (pending mint)
      const isReserved = await redis.exists(`nft:reserved:${candidateId}`);
      if (isReserved) continue;

      // Try to atomically reserve this ID
      const reserved = await redis.setnx(
        `nft:reserved:${candidateId}`,
        JSON.stringify({
          address,
          reservedAt: Date.now(),
        }),
      );

      if (reserved) {
        tokenId = candidateId;
        // Set 10-minute expiration - if mint doesn't complete, ID is released
        await redis.expire(`nft:reserved:${candidateId}`, 600);
        break;
      }
    }

    // Fallback to sequential if random fails (unlikely but safe)
    if (tokenId === null) {
      // Find first available sequential ID
      for (let i = 1; i <= MAX_SUPPLY; i++) {
        const isMinted = await redis.exists(`nft:minted:${i}`);
        const isReserved = await redis.exists(`nft:reserved:${i}`);
        if (!isMinted && !isReserved) {
          const reserved = await redis.setnx(
            `nft:reserved:${i}`,
            JSON.stringify({ address, reservedAt: Date.now() }),
          );
          if (reserved) {
            tokenId = i;
            await redis.expire(`nft:reserved:${i}`, 600);
            break;
          }
        }
      }
    }

    if (tokenId === null) {
      return errorResponse(c, "No available token IDs. Try again later.", 503);
    }

    // Track this mint attempt
    const attemptId = `${address}:${tokenId}:${Date.now()}`;
    const attempt = {
      attemptId,
      tokenId,
      address,
      status: "reserved", // reserved -> proving -> signing -> broadcasting -> confirmed | failed
      reservedAt: Date.now(),
      lastUpdatedAt: Date.now(),
      error: null,
    };

    // Store attempt (expires after 24 hours for history)
    await redis.hset(`nft:attempt:${attemptId}`, attempt);
    await redis.expire(`nft:attempt:${attemptId}`, 86400);

    // Add to user's pending attempts
    await redis.sadd(`nft:attempts:${address}`, attemptId);

    nftLogger.info("Reserved random token ID", { tokenId, address });

    return successResponse(c, {
      tokenId,
      // Note: totalMinted is confirmed mints, not reservations
      totalMinted: confirmedCount,
      attemptId,
      // Indicate this is a provisional ID
      provisional: true,
    });
  } catch (error) {
    nftLogger.error("[NFT] Reserve error:", error);
    return errorResponse(c, "Failed to reserve NFT ID", 500);
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

/**
 * POST /prove - Submit NFT to Charms prover
 *
 * After reserving a tokenId and generating traits, the client calls this
 * endpoint to get the commit + spell transactions from the Charms prover.
 *
 * Returns raw transaction hexes that the client must sign and broadcast.
 *
 * Flow:
 * 1. Client reserves tokenId via POST /api/nft/reserve
 * 2. Client generates traits (DNA, bloodline, rarity) locally
 * 3. Client calls this endpoint with NFT state + funding UTXO
 * 4. Server builds V10 spell (JSON) and submits to Charms prover
 * 5. Server returns commitTx + spellTx for signing
 * 6. Client signs both transactions with wallet
 * 7. Client broadcasts commitTx first, then spellTx
 * 8. Client confirms via POST /api/nft/confirm/:tokenId
 */
reserveRouter.post("/prove", validateBody(proveNftSchema), async (c) => {
  const { tokenId, address, nftState, fundingUtxo } = c.get("validatedBody");

  try {
    // Validate tokenId matches nftState
    if (tokenId !== nftState.tokenId) {
      return errorResponse(
        c,
        "tokenId in request does not match nftState.tokenId",
        400,
      );
    }

    // Get NFT app configuration
    const nftAppId = c.env.NFT_APP_ID;
    const nftAppVk = c.env.NFT_APP_VK;

    if (!nftAppId || !nftAppVk) {
      nftLogger.error("NFT app not configured", {
        hasAppId: Boolean(nftAppId),
        hasAppVk: Boolean(nftAppVk),
      });
      return errorResponse(
        c,
        "NFT minting not available: app not configured",
        503,
      );
    }

    // Validate that NFT_APP_ID is not the placeholder value
    const PLACEHOLDER_APP_ID =
      "0000000000000000000000000000000000000000000000000000000000000000";
    if (nftAppId === PLACEHOLDER_APP_ID) {
      nftLogger.error(
        "NFT_APP_ID is still the placeholder value. Update after first mint.",
      );
      return errorResponse(
        c,
        "NFT minting not available: app ID not yet established",
        503,
      );
    }

    // Get minting service (simple JSON format - like original)
    const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
    const mintingService = getNFTMintingServiceSimple({
      proverUrl: c.env.PROVER_URL || "https://v14.charms.dev",
      appId: nftAppId,
      appVk: nftAppVk,
      network,
    });

    nftLogger.info("Submitting NFT to prover", {
      tokenId,
      address,
      rarity: nftState.rarityTier,
      bloodline: nftState.bloodline,
    });

    // Process the mint request
    const result = await mintingService.processMint({
      tokenId,
      ownerAddress: address,
      nftState: {
        ...nftState,
        // Ensure tokensEarned is a string
        tokensEarned: nftState.tokensEarned || "0",
      },
      fundingUtxo,
    });

    if (!result.success) {
      nftLogger.error("Prover failed", { tokenId, error: result.error });
      return errorResponse(
        c,
        result.error || "Failed to generate NFT proof",
        500,
      );
    }

    nftLogger.info("NFT proof generated", {
      tokenId,
      commitTxid: result.commitTxid,
      spellTxid: result.spellTxid,
    });

    return successResponse(c, {
      tokenId,
      commitTxHex: result.commitTxHex,
      spellTxHex: result.spellTxHex,
      commitTxid: result.commitTxid,
      spellTxid: result.spellTxid,
      // Instructions for client
      nextSteps: [
        "1. Sign commitTx with your wallet",
        "2. Sign spellTx with your wallet",
        "3. Broadcast commitTx and wait for confirmation",
        "4. Broadcast spellTx",
        "5. Call POST /api/nft/confirm/:tokenId with the spellTxid",
      ],
    });
  } catch (error) {
    nftLogger.error("[NFT] Prove error:", error);
    return errorResponse(c, "Failed to prove NFT mint", 500);
  }
});

/**
 * POST /release/:tokenId - Release a reserved NFT ID (if mint failed)
 *
 * With the new random ID system, releasing is simple:
 * - Delete the temporary reservation key
 * - The ID is immediately available for other users
 *
 * Note: Reservations auto-expire after 10 minutes anyway,
 * but calling release is good practice for immediate cleanup.
 */
reserveRouter.post(
  "/release/:tokenId",
  validateParams(tokenIdParamSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");

    try {
      const redis = getRedis(c.env);

      // Check if this token is already minted (can't release confirmed mints)
      const isMinted = await redis.exists(`nft:minted:${tokenId}`);
      if (isMinted) {
        return successResponse(c, {
          released: false,
          reason: "already_confirmed",
        });
      }

      // Delete the reservation (if it exists)
      const deleted = await redis.del(`nft:reserved:${tokenId}`);

      if (deleted) {
        nftLogger.info("Released reserved token ID", { tokenId });
        return successResponse(c, { released: true });
      }

      // No reservation found - might have auto-expired
      nftLogger.info("No reservation found to release", { tokenId });
      return successResponse(c, {
        released: false,
        reason: "no_reservation",
      });
    } catch (error) {
      nftLogger.error("[NFT] Release error:", error);
      return errorResponse(c, "Failed to release NFT ID", 500);
    }
  },
);
