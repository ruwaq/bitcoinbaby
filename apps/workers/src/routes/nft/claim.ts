/**
 * NFT Claim Routes
 *
 * Claim NFTs by providing transaction ID.
 */

import { Hono } from "hono";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import {
  errorResponse,
  successResponse,
  fetchWithTimeout,
  TimeoutError,
  EXTERNAL_API,
} from "../../lib/helpers";
import { validateBody } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import { claimNftSchema } from "./middleware";
import { createSeededRandom } from "./types";

export const claimRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// NFT CLAIMING
// =============================================================================

/**
 * POST /claim - Claim an NFT by providing txid
 */
claimRouter.post("/claim", validateBody(claimNftSchema), async (c) => {
  const { txid, address } = c.get("validatedBody");

  try {
    const redis = getRedis(c.env);

    // Check if txid already claimed
    const existingClaim = await redis.get(`nft:claimed:${txid}`);
    if (existingClaim) {
      return errorResponse(c, "This transaction was already claimed", 400);
    }

    // Verify transaction on blockchain with timeout
    let txResponse: Response;
    try {
      txResponse = await fetchWithTimeout(
        `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${txid}`,
        {},
        EXTERNAL_API.TX_LOOKUP_TIMEOUT_MS,
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        return errorResponse(
          c,
          "Blockchain API timeout. Please try again.",
          503,
        );
      }
      throw error;
    }

    if (!txResponse.ok) {
      return errorResponse(c, "Transaction not found on blockchain", 404);
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

    if (!txData.status?.confirmed) {
      return errorResponse(c, "Transaction not yet confirmed", 400);
    }

    // Check for CHARM OP_RETURN
    const hasCharmOpReturn = txData.vout.some(
      (out) =>
        out.scriptpubkey_type === "op_return" &&
        out.scriptpubkey.includes("434841524d"),
    );

    if (!hasCharmOpReturn) {
      return errorResponse(
        c,
        "Transaction does not contain a valid Charm/NFT mint",
        400,
      );
    }

    // Verify address received output
    const userOutput = txData.vout.find(
      (out) => out.scriptpubkey_address === address,
    );

    if (!userOutput) {
      return errorResponse(
        c,
        "Your address did not receive an output in this transaction",
        400,
      );
    }

    // Create NFT record - use same counter as minting to avoid tokenId collision
    const tokenId = await redis.incr("nft:minted:count");
    const mintedAt = Date.now();

    // Generate deterministic traits based on txid (verifiable and fair)
    const seededRandom = createSeededRandom(txid);

    const randomDna = Array.from({ length: 64 }, () =>
      Math.floor(seededRandom() * 16).toString(16),
    ).join("");

    const bloodlines = ["royal", "warrior", "rogue", "mystic"];
    const baseTypes = ["human", "animal", "robot", "mystic", "alien"];

    const rarityRoll = seededRandom() * 100;
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
      bloodline: bloodlines[Math.floor(seededRandom() * bloodlines.length)],
      baseType: baseTypes[Math.floor(seededRandom() * baseTypes.length)],
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

    await redis.hset(`nft:minted:${tokenId}`, nftRecord);
    await redis.sadd(`nft:owned:${address}`, tokenId.toString());
    await redis.set(`nft:claimed:${txid}`, tokenId.toString());

    nftLogger.info("Claimed NFT", {
      tokenId,
      address,
      txid: txid.slice(0, 8),
    });

    return successResponse(c, nftRecord);
  } catch (error) {
    nftLogger.error("[NFT] Claim error:", error);
    return errorResponse(c, "Failed to claim NFT", 500);
  }
});
