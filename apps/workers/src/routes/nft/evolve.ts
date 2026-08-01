/**
 * NFT Evolution Routes
 *
 * Server-side evolution and on-chain evolution confirmation.
 * Work proof (XP from mining) endpoint.
 */

import { Hono } from "hono";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import {
  errorResponse,
  successResponse,
  fetchWithTimeout,
  EXTERNAL_API,
} from "../../lib/helpers";
import { validateBody, validateParams } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import {
  tokenIdParamSchema,
  evolveNftSchema,
  confirmEvolutionSchema,
  workProofSchema,
  XP_REQUIREMENTS,
  BASE_XP_PER_SHARE,
  BLOODLINE_XP_MULTIPLIERS,
  MIN_DIFFICULTY_FOR_XP,
} from "./middleware";
import { parseNFTData } from "./types";
import { countLeadingZeroBits } from "../../lib/proof-validation";

export const evolveRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// NFT EVOLUTION
// =============================================================================

/**
 * POST /evolve - Evolve an NFT to the next level
 */
evolveRouter.post("/evolve", validateBody(evolveNftSchema), async (c) => {
  const {
    tokenId,
    address,
    currentLevel: clientClaimedLevel,
  } = c.get("validatedBody");

  try {
    const redis = getRedis(c.env);

    // Check NFT exists
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
    if (!nftData || Object.keys(nftData).length === 0) {
      return errorResponse(c, "NFT not found", 404);
    }

    // Check ownership
    const isOwned = await redis.sismember(
      `nft:owned:${address}`,
      tokenId.toString(),
    );
    if (!isOwned) {
      return errorResponse(c, "You do not own this NFT", 403);
    }

    const currentLevel = parseInt(nftData.level as string, 10) || 1;

    // Cross-check client-claimed level against server truth
    if (
      clientClaimedLevel !== undefined &&
      clientClaimedLevel !== currentLevel
    ) {
      return errorResponse(
        c,
        `Level mismatch: client claims level ${clientClaimedLevel}, server has ${currentLevel}`,
        409,
      );
    }
    const currentXp = parseInt(nftData.xp as string, 10) || 0;
    const currentEvolutionCount =
      parseInt(nftData.evolutionCount as string, 10) || 0;

    const nextLevel = currentLevel + 1;
    if (nextLevel > 10) {
      return errorResponse(c, "NFT is already at maximum level (10)", 400);
    }

    const requiredXp = XP_REQUIREMENTS[nextLevel];
    if (currentXp < requiredXp) {
      return errorResponse(
        c,
        `Insufficient XP. Required: ${requiredXp}, Current: ${currentXp}`,
        400,
      );
    }

    // Update NFT — XP-based level up (no token cost)
    const updatedNft = {
      ...nftData,
      level: nextLevel.toString(),
      xp: "0",
      evolutionCount: (currentEvolutionCount + 1).toString(),
    };

    await redis.hset(`nft:minted:${tokenId}`, updatedNft);

    nftLogger.info("Evolved token", { tokenId, newLevel: nextLevel, address });

    const responseNft = parseNFTData(
      { ...nftData, level: nextLevel.toString(), xp: "0" },
      tokenId,
    );
    responseNft.evolutionCount = currentEvolutionCount + 1;

    return successResponse(c, {
      nft: responseNft,
      previousLevel: currentLevel,
      newLevel: nextLevel,
    });
  } catch (error) {
    nftLogger.error("[NFT] Evolution error:", error);
    return errorResponse(c, "Failed to evolve NFT", 500);
  }
});

/**
 * POST /confirm-evolution - Confirm on-chain evolution transaction
 *
 * Called after a client broadcasts an evolution transaction to the blockchain.
 * Updates the server state to reflect the new level.
 *
 * Note: This is different from /evolve which uses virtual balance.
 * This endpoint is for on-chain evolution with real BABTC burn.
 */
evolveRouter.post(
  "/confirm-evolution",
  validateBody(confirmEvolutionSchema),
  async (c) => {
    const { tokenId, txid, newLevel, address } = c.get("validatedBody");

    try {
      const redis = getRedis(c.env);

      // Check NFT exists
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) {
        return errorResponse(c, "NFT not found", 404);
      }

      // Check ownership
      const isOwned = await redis.sismember(
        `nft:owned:${address}`,
        tokenId.toString(),
      );
      if (!isOwned) {
        return errorResponse(c, "You do not own this NFT", 403);
      }

      const currentLevel = parseInt(nftData.level as string, 10) || 1;
      const currentEvolutionCount =
        parseInt(nftData.evolutionCount as string, 10) || 0;

      // Validate new level is exactly current + 1
      if (newLevel !== currentLevel + 1) {
        return errorResponse(
          c,
          `Invalid level transition: ${currentLevel} -> ${newLevel}`,
          400,
        );
      }

      // Verify transaction exists on blockchain
      const txResponse = await fetchWithTimeout(
        `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${txid}`,
        {},
        10000,
      );

      if (!txResponse.ok) {
        return errorResponse(
          c,
          "Transaction not found on blockchain. Please wait for confirmation.",
          400,
        );
      }

      // Update NFT state
      const updatedNft = {
        ...nftData,
        level: newLevel.toString(),
        xp: "0", // Reset XP after evolution
        evolutionCount: (currentEvolutionCount + 1).toString(),
        lastEvolutionTxid: txid,
      };

      await redis.hset(`nft:minted:${tokenId}`, updatedNft);

      nftLogger.info("Confirmed on-chain evolution", {
        tokenId,
        txid: txid.slice(0, 8),
        previousLevel: currentLevel,
        newLevel,
        address: address.slice(0, 10),
      });

      const responseNft = parseNFTData(updatedNft, tokenId);

      return successResponse(c, {
        confirmed: true,
        nft: responseNft,
        txid,
        previousLevel: currentLevel,
        newLevel,
      });
    } catch (error) {
      nftLogger.error("[NFT] Confirm evolution error:", error);
      return errorResponse(c, "Failed to confirm evolution", 500);
    }
  },
);

// =============================================================================
// NFT WORK PROOF (XP FROM MINING)
// =============================================================================

/**
 * POST /:tokenId/work-proof - Submit work proof to gain XP
 *
 * When a user mines a valid share, their equipped NFT gains XP.
 * XP is calculated based on:
 * - Base XP (100)
 * - Bloodline multiplier (Royal: 1.5x, Warrior: 1.2x, Mystic: 1.3x, Rogue: 1.0x)
 * - Difficulty bonus (higher difficulty = more XP)
 */
evolveRouter.post(
  "/:tokenId/work-proof",
  validateParams(tokenIdParamSchema),
  validateBody(workProofSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { ownerAddress, shareHash, difficulty, timestamp } =
      c.get("validatedBody");

    try {
      const redis = getRedis(c.env);

      // Check NFT exists
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) {
        return errorResponse(c, "NFT not found", 404);
      }

      // Check ownership
      const isOwned = await redis.sismember(
        `nft:owned:${ownerAddress}`,
        tokenId.toString(),
      );
      if (!isOwned) {
        return errorResponse(c, "You do not own this NFT", 403);
      }

      // Validate difficulty meets minimum
      if (difficulty < MIN_DIFFICULTY_FOR_XP) {
        return errorResponse(
          c,
          `Difficulty ${difficulty} is below minimum ${MIN_DIFFICULTY_FOR_XP}`,
          400,
        );
      }

      // Cryptographically verify the share hash meets the claimed difficulty target
      const leadingZeros = countLeadingZeroBits(shareHash);
      if (leadingZeros < difficulty) {
        return errorResponse(
          c,
          `Invalid proof of work: share hash does not meet claimed difficulty of ${difficulty} (got ${leadingZeros})`,
          400,
        );
      }

      // Atomically claim share hash to prevent double-counting (race condition fix)
      // SETNX returns 1 if key was set (new), 0 if already existed
      const shareKey = `nft:share:${shareHash}`;
      const shareClaimed = await redis.setnx(shareKey, `pending:${tokenId}`);
      if (!shareClaimed) {
        return errorResponse(c, "This share was already submitted", 400);
      }
      // Set TTL immediately (24 hours)
      await redis.expire(shareKey, 86400);

      // Calculate XP
      const bloodline = (nftData.bloodline as string) || "rogue";
      const multiplier = BLOODLINE_XP_MULTIPLIERS[bloodline] || 1.0;
      const difficultyBonus = Math.max(0, difficulty - MIN_DIFFICULTY_FOR_XP);
      const xpGained = Math.floor(
        BASE_XP_PER_SHARE * multiplier * (1 + difficultyBonus * 0.1),
      );

      // Update NFT XP
      const currentXp = parseInt(nftData.xp as string, 10) || 0;
      const currentTotalXp = parseInt(nftData.totalXp as string, 10) || 0;
      const currentWorkCount = parseInt(nftData.workCount as string, 10) || 0;

      const newXp = currentXp + xpGained;
      const newTotalXp = currentTotalXp + xpGained;
      const newWorkCount = currentWorkCount + 1;

      await redis.hset(`nft:minted:${tokenId}`, {
        xp: newXp.toString(),
        totalXp: newTotalXp.toString(),
        workCount: newWorkCount.toString(),
        lastWorkBlock: timestamp.toString(),
      });

      // Update share record with final tokenId (already has TTL from SETNX)
      await redis.set(shareKey, tokenId.toString());

      // Check if NFT can now evolve
      const currentLevel = parseInt(nftData.level as string, 10) || 1;
      const nextLevel = currentLevel + 1;
      const xpRequired = XP_REQUIREMENTS[nextLevel] || Infinity;
      const canEvolve = nextLevel <= 10 && newXp >= xpRequired;

      nftLogger.info("Work proof submitted", {
        tokenId,
        xpGained,
        newXp,
        bloodline,
        difficulty,
      });

      return successResponse(c, {
        tokenId,
        xpGained,
        newXp,
        totalXp: newTotalXp,
        workCount: newWorkCount,
        bloodline,
        multiplier,
        canEvolve,
        xpToNextLevel: Math.max(0, xpRequired - newXp),
      });
    } catch (error) {
      nftLogger.error("[NFT] Work proof error:", error);
      return errorResponse(c, "Failed to submit work proof", 500);
    }
  },
);
