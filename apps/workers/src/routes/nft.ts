/**
 * NFT Routes
 *
 * NFT management, marketplace, and evolution endpoints.
 *
 * Routes:
 * - GET  /api/nft/counter              - Get current NFT counter
 * - POST /api/nft/reserve              - Reserve next NFT ID
 * - POST /api/nft/confirm/:tokenId     - Confirm NFT mint
 * - GET  /api/nft/owned/:address       - Get NFTs owned by address
 * - POST /api/nft/claim                - Claim NFT by txid
 * - GET  /api/nft/:tokenId             - Get single NFT
 * - POST /api/nft/list                 - List NFT for sale
 * - DELETE /api/nft/unlist/:tokenId    - Remove listing
 * - GET  /api/nft/listings             - Get all active listings
 * - POST /api/nft/buy/:tokenId         - Buy listed NFT
 * - POST /api/nft/evolve               - Evolve NFT to next level
 */

import { Hono } from "hono";
import { z } from "zod";
import type { Env, ApiResponse } from "../lib/types";
import { getRedis } from "../lib/redis";
import {
  errorResponse,
  successResponse,
  fetchWithTimeout,
  TimeoutError,
  EXTERNAL_API,
} from "../lib/helpers";
import {
  validateBody,
  validateParams,
  bitcoinAddressSchema,
} from "../lib/middleware";
import { nftLogger } from "../lib/logger";

export const nftRouter = new Hono<{ Bindings: Env }>();

// Create marketplace logger
const marketplaceLogger = nftLogger.child({ component: "marketplace" });

// =============================================================================
// SCHEMAS
// =============================================================================

const tokenIdParamSchema = z.object({
  tokenId: z.coerce.number().int().positive(),
});

const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

const confirmNftSchema = z.object({
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  address: bitcoinAddressSchema,
  nft: z
    .object({
      dna: z.string(),
      bloodline: z.string(),
      baseType: z.string(),
      rarityTier: z.string(),
      level: z.number().int().min(1),
      xp: z.number().int().min(0),
      totalXp: z.number().int().min(0),
      workCount: z.number().int().min(0),
      evolutionCount: z.number().int().min(0),
    })
    .optional(),
});

const claimNftSchema = z.object({
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  address: bitcoinAddressSchema,
});

const listNftSchema = z.object({
  tokenId: z.number().int().positive(),
  price: z.number().int().min(1000, "Minimum price is 1000 satoshis"),
  sellerAddress: bitcoinAddressSchema,
});

const buyNftSchema = z.object({
  buyerAddress: bitcoinAddressSchema,
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
});

const evolveNftSchema = z.object({
  tokenId: z.number().int().positive(),
  address: bitcoinAddressSchema,
});

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_SUPPLY = 10_000;

// XP requirements per level
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

// Evolution costs in BABTC
const EVOLUTION_COSTS: Record<number, bigint> = {
  2: 100n * 100_000_000n,
  3: 250n * 100_000_000n,
  4: 500n * 100_000_000n,
  5: 1000n * 100_000_000n,
  6: 2500n * 100_000_000n,
  7: 5000n * 100_000_000n,
  8: 10000n * 100_000_000n,
  9: 25000n * 100_000_000n,
  10: 50000n * 100_000_000n,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

interface NFTRecord {
  tokenId: number;
  txid: string;
  address: string;
  mintedAt: number;
  dna: string;
  bloodline: string;
  baseType: string;
  rarityTier: string;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  evolutionCount: number;
  genesisBlock: number;
  lastWorkBlock: number;
  tokensEarned: string;
}

function parseNFTData(
  data: Record<string, unknown>,
  tokenId?: number,
): NFTRecord {
  return {
    tokenId: tokenId ?? parseInt(data.tokenId as string, 10),
    dna: data.dna as string,
    bloodline: data.bloodline as string,
    baseType: data.baseType as string,
    genesisBlock: parseInt(data.genesisBlock as string, 10) || 0,
    rarityTier: data.rarityTier as string,
    level: parseInt(data.level as string, 10) || 1,
    xp: parseInt(data.xp as string, 10) || 0,
    totalXp: parseInt(data.totalXp as string, 10) || 0,
    workCount: parseInt(data.workCount as string, 10) || 0,
    lastWorkBlock: parseInt(data.lastWorkBlock as string, 10) || 0,
    evolutionCount: parseInt(data.evolutionCount as string, 10) || 0,
    tokensEarned: (data.tokensEarned as string) || "0",
    txid: data.txid as string,
    address: data.address as string,
    mintedAt: parseInt(data.mintedAt as string, 10),
  };
}

// =============================================================================
// NFT COUNTER API
// =============================================================================

/**
 * GET /api/nft/counter - Get current NFT counter
 */
nftRouter.get("/counter", async (c) => {
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
 * POST /api/nft/reserve - Reserve next NFT ID (atomic increment)
 */
nftRouter.post("/reserve", async (c) => {
  try {
    const redis = getRedis(c.env);

    // Atomic increment
    const newCount = await redis.incr("nft:minted:count");

    if (newCount > MAX_SUPPLY) {
      await redis.decr("nft:minted:count");
      return errorResponse(c, "Max supply reached", 400);
    }

    nftLogger.info("Reserved token ID", { tokenId: newCount });

    return successResponse(c, {
      tokenId: newCount,
      totalMinted: newCount,
    });
  } catch (error) {
    nftLogger.error("[NFT] Reserve error:", error);
    return errorResponse(c, "Failed to reserve NFT ID", 500);
  }
});

// =============================================================================
// NFT CORE
// =============================================================================

/**
 * POST /api/nft/confirm/:tokenId - Confirm NFT was minted successfully
 */
nftRouter.post(
  "/confirm/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(confirmNftSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const body = c.get("validatedBody");

    try {
      const redis = getRedis(c.env);
      const mintedAt = Date.now();

      const nftRecord = {
        tokenId,
        txid: body.txid,
        address: body.address,
        mintedAt,
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

      await redis.hset(`nft:minted:${tokenId}`, nftRecord);
      await redis.sadd(`nft:owned:${body.address}`, tokenId.toString());

      nftLogger.info("Confirmed token ID", { tokenId, owner: body.address });

      return successResponse(c, { confirmed: true });
    } catch (error) {
      nftLogger.error("[NFT] Confirm error:", error);
      return errorResponse(c, "Failed to confirm mint", 500);
    }
  },
);

/**
 * GET /api/nft/owned/:address - Get all NFTs owned by an address
 */
nftRouter.get(
  "/owned/:address",
  validateParams(addressParamSchema),
  async (c) => {
    const { address } = c.get("validatedParams");

    try {
      const redis = getRedis(c.env);
      const tokenIds = await redis.smembers(`nft:owned:${address}`);

      if (!tokenIds || tokenIds.length === 0) {
        return successResponse(c, { nfts: [], count: 0 });
      }

      const nfts = await Promise.all(
        tokenIds.map(async (id) => {
          const nftData = await redis.hgetall(`nft:minted:${id}`);
          if (!nftData) return null;
          return parseNFTData(nftData, parseInt(id, 10));
        }),
      );

      const validNFTs = nfts
        .filter((n): n is NonNullable<typeof n> => n !== null)
        .sort((a, b) => a.tokenId - b.tokenId);

      return successResponse(c, { nfts: validNFTs, count: validNFTs.length });
    } catch (error) {
      nftLogger.error("[NFT] Get owned error:", error);
      return errorResponse(c, "Failed to get owned NFTs", 500);
    }
  },
);

/**
 * POST /api/nft/claim - Claim an NFT by providing txid
 */
nftRouter.post("/claim", validateBody(claimNftSchema), async (c) => {
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

    // Create NFT record
    const claimCount = await redis.incr("nft:claim:count");
    const tokenId = claimCount;
    const mintedAt = Date.now();

    // Generate random traits for legacy mint
    const randomDna = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");

    const bloodlines = ["royal", "warrior", "rogue", "mystic"];
    const baseTypes = ["human", "animal", "robot", "mystic", "alien"];

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

/**
 * GET /api/nft/listings - Get all active marketplace listings
 * Must be defined BEFORE /:tokenId to avoid route conflict
 */
nftRouter.get("/listings", async (c) => {
  try {
    if (!c.env.UPSTASH_REDIS_REST_URL || !c.env.UPSTASH_REDIS_REST_TOKEN) {
      return successResponse(c, { listings: [], count: 0 });
    }

    const redis = getRedis(c.env);
    const listingIds = await redis.smembers("nft:active-listings");

    if (!listingIds || listingIds.length === 0) {
      return successResponse(c, { listings: [], count: 0 });
    }

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
      .sort((a, b) => b.listedAt - a.listedAt);

    return successResponse(c, {
      listings: validListings,
      count: validListings.length,
    });
  } catch (error) {
    marketplaceLogger.error("Get listings error", error);
    return errorResponse(c, "Failed to get listings", 500);
  }
});

/**
 * GET /api/nft/:tokenId - Get a single NFT by token ID
 */
nftRouter.get("/:tokenId", validateParams(tokenIdParamSchema), async (c) => {
  const { tokenId } = c.get("validatedParams");

  try {
    const redis = getRedis(c.env);
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);

    if (!nftData || Object.keys(nftData).length === 0) {
      return errorResponse(c, "NFT not found", 404);
    }

    return successResponse(c, parseNFTData(nftData, tokenId));
  } catch (error) {
    nftLogger.error("[NFT] Get single error:", error);
    return errorResponse(c, "Failed to get NFT", 500);
  }
});

// =============================================================================
// NFT MARKETPLACE
// =============================================================================

/**
 * POST /api/nft/list - List an NFT for sale
 */
nftRouter.post("/list", validateBody(listNftSchema), async (c) => {
  const { tokenId, price, sellerAddress } = c.get("validatedBody");

  try {
    const redis = getRedis(c.env);

    // Check NFT exists
    const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
    if (!nftData || Object.keys(nftData).length === 0) {
      return errorResponse(c, "NFT not found", 404);
    }

    // Check ownership
    const isOwned = await redis.sismember(
      `nft:owned:${sellerAddress}`,
      tokenId.toString(),
    );
    if (!isOwned) {
      return errorResponse(c, "You do not own this NFT", 403);
    }

    // Check if already listed
    const existingListing = await redis.hgetall(`nft:listing:${tokenId}`);
    if (existingListing && Object.keys(existingListing).length > 0) {
      return errorResponse(c, "NFT is already listed for sale", 400);
    }

    const listing = {
      tokenId: tokenId.toString(),
      price: price.toString(),
      sellerAddress,
      listedAt: Date.now().toString(),
    };

    await redis.hset(`nft:listing:${tokenId}`, listing);
    await redis.sadd("nft:active-listings", tokenId.toString());

    marketplaceLogger.info("Listed NFT", { tokenId, price });

    return successResponse(c, listing);
  } catch (error) {
    marketplaceLogger.error("List error", error);
    return errorResponse(c, "Failed to list NFT", 500);
  }
});

/**
 * DELETE /api/nft/unlist/:tokenId - Remove NFT listing
 */
nftRouter.delete(
  "/unlist/:tokenId",
  validateParams(tokenIdParamSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const sellerAddress = c.req.header("X-Wallet-Address");

    if (!sellerAddress) {
      return errorResponse(c, "X-Wallet-Address header required", 400);
    }

    try {
      const redis = getRedis(c.env);

      const listing = await redis.hgetall(`nft:listing:${tokenId}`);
      if (!listing || Object.keys(listing).length === 0) {
        return errorResponse(c, "NFT is not listed", 404);
      }

      if (listing.sellerAddress !== sellerAddress) {
        return errorResponse(c, "Only the seller can unlist", 403);
      }

      await redis.del(`nft:listing:${tokenId}`);
      await redis.srem("nft:active-listings", tokenId.toString());

      marketplaceLogger.info("Unlisted NFT", { tokenId });

      return successResponse(c, { tokenId, unlisted: true });
    } catch (error) {
      marketplaceLogger.error("Unlist error", error);
      return errorResponse(c, "Failed to unlist NFT", 500);
    }
  },
);

/**
 * POST /api/nft/buy/:tokenId - Buy a listed NFT
 *
 * SECURITY: Verifies payment on blockchain before transferring ownership.
 */
nftRouter.post(
  "/buy/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(buyNftSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { buyerAddress, txid } = c.get("validatedBody");

    try {
      const redis = getRedis(c.env);

      // Check if txid already used
      const existingPurchase = await redis.get(`nft:purchase:${txid}`);
      if (existingPurchase) {
        return errorResponse(
          c,
          "This transaction was already used for a purchase",
          400,
        );
      }

      // Get listing
      const listing = await redis.hgetall(`nft:listing:${tokenId}`);
      if (!listing || Object.keys(listing).length === 0) {
        return errorResponse(c, "NFT is not listed for sale", 404);
      }

      const sellerAddress = listing.sellerAddress as string;
      const listingPrice = parseInt(listing.price as string, 10);

      if (sellerAddress === buyerAddress) {
        return errorResponse(c, "Cannot buy your own NFT", 400);
      }

      // Blockchain payment verification with timeout
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
        return errorResponse(
          c,
          "Payment transaction not found on blockchain",
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

      // Verify buyer is sender
      const buyerIsInput = txData.vin.some(
        (input) => input.prevout?.scriptpubkey_address === buyerAddress,
      );

      if (!buyerIsInput) {
        return errorResponse(
          c,
          "Transaction does not originate from buyer address",
          400,
        );
      }

      // Verify payment to seller
      const paymentOutput = txData.vout.find(
        (output) => output.scriptpubkey_address === sellerAddress,
      );

      if (!paymentOutput) {
        return errorResponse(
          c,
          "Transaction does not have payment output to seller",
          400,
        );
      }

      if (paymentOutput.value < listingPrice) {
        return errorResponse(
          c,
          `Payment amount (${paymentOutput.value} sats) is less than listing price (${listingPrice} sats)`,
          400,
        );
      }

      marketplaceLogger.info("Payment verified", {
        txid: txid.slice(0, 8),
        amount: paymentOutput.value,
      });

      // Transfer ownership
      await redis.set(`nft:purchase:${txid}`, tokenId.toString());
      await redis.srem(`nft:owned:${sellerAddress}`, tokenId.toString());
      await redis.sadd(`nft:owned:${buyerAddress}`, tokenId.toString());
      await redis.hset(`nft:minted:${tokenId}`, { address: buyerAddress });
      await redis.del(`nft:listing:${tokenId}`);
      await redis.srem("nft:active-listings", tokenId.toString());

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

      marketplaceLogger.info("Sold NFT", {
        tokenId,
        seller: sellerAddress,
        buyer: buyerAddress,
      });

      return successResponse(c, sale);
    } catch (error) {
      marketplaceLogger.error("Buy error", error);
      return errorResponse(c, "Failed to complete purchase", 500);
    }
  },
);

// =============================================================================
// NFT EVOLUTION
// =============================================================================

/**
 * POST /api/nft/evolve - Evolve an NFT to the next level
 */
nftRouter.post("/evolve", validateBody(evolveNftSchema), async (c) => {
  const { tokenId, address } = c.get("validatedBody");

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

    const evolutionCost = EVOLUTION_COSTS[nextLevel];
    if (!evolutionCost) {
      return errorResponse(c, "Invalid evolution level", 400);
    }

    // Deduct balance from VirtualBalanceDO
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

    // Update NFT
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
      evolutionCost: evolutionCost.toString(),
      previousLevel: currentLevel,
      newLevel: nextLevel,
    });
  } catch (error) {
    nftLogger.error("[NFT] Evolution error:", error);
    return errorResponse(c, "Failed to evolve NFT", 500);
  }
});
