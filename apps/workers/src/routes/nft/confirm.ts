/**
 * NFT Confirm Routes
 *
 * Confirm mint, query NFTs, explorer, stats, migration.
 */

import { Hono } from "hono";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import { errorResponse, successResponse } from "../../lib/helpers";
import { validateParams } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import { getNetworkForEnvironment, EXPLORER_URLS } from "../../config/bitcoin";
import {
  tokenIdParamSchema,
  addressParamSchema,
  explorerQuerySchema,
  MAX_SUPPLY,
} from "./middleware";
import { parseNFTData, type NFTRecord } from "./types";

export const confirmRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// NFT CORE
// =============================================================================
// NOTE (D3): the POST /confirm/:tokenId handler was removed. It trusted the
// client txid blindly (bug #6) and had a TOCTOU race (bug #4). Minting is now
// finalized exclusively via POST /mint/finalize in ./mint.ts, which verifies
// the spell tx on-chain and persists atomically.

/**
 * GET /owned/:address - Get all NFTs owned by an address
 */
confirmRouter.get(
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
// =============================================================================
// NFT EXPLORER - Get all minted NFTs
// =============================================================================

/**
 * GET /all - Get all minted NFTs with filtering and pagination
 *
 * Query params:
 * - page: Page number (default 1)
 * - limit: Items per page (default 20, max 100)
 * - sort: newest | oldest | rarest | level | xp
 * - bloodline: royal | warrior | rogue | mystic | all
 * - rarity: common | uncommon | rare | epic | legendary | mythic | all
 * - forSale: true | false | all
 *
 * Returns NFTs with owner info, listing status, and blockchain links
 */
confirmRouter.get("/all", async (c) => {
  try {
    // Parse query params
    const queryResult = explorerQuerySchema.safeParse(c.req.query());
    if (!queryResult.success) {
      return errorResponse(c, "Invalid query parameters", 400);
    }
    const { page, limit, sort, bloodline, rarity, forSale } = queryResult.data;

    if (!c.env.UPSTASH_REDIS_REST_URL || !c.env.UPSTASH_REDIS_REST_TOKEN) {
      return successResponse(c, {
        nfts: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        stats: { total: 0, forSale: 0, byRarity: {}, byBloodline: {} },
      });
    }

    const redis = getRedis(c.env);

    // Get all minted token IDs from the global index
    const allTokenIds = await redis.smembers("nft:all-tokens");
    if (!allTokenIds || allTokenIds.length === 0) {
      return successResponse(c, {
        nfts: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
        stats: { total: 0, forSale: 0, byRarity: {}, byBloodline: {} },
      });
    }

    // Get all active listings for cross-reference
    const activeListings = await redis.smembers("nft:active-listings");
    const listingsSet = new Set(activeListings || []);

    // Get listing details for prices
    const listingPrices: Record<number, { price: number; listedAt: number }> =
      {};
    for (const id of activeListings || []) {
      const listing = await redis.hgetall(`nft:listing:${id}`);
      if (listing && listing.price) {
        listingPrices[parseInt(id, 10)] = {
          price: parseInt(listing.price as string, 10),
          listedAt: parseInt(listing.listedAt as string, 10) || 0,
        };
      }
    }

    // Fetch all NFTs using the global index (supports random token IDs)
    const allNFTs: Array<
      NFTRecord & {
        isListed: boolean;
        listingPrice?: number;
        listedAt?: number;
        blockchainUrl: string;
      }
    > = [];

    // Stats for ALL NFTs (before filtering)
    const globalStats = {
      total: allTokenIds.length,
      forSale: listingsSet.size,
      byRarity: {} as Record<string, number>,
      byBloodline: {} as Record<string, number>,
    };

    // Rarity order for sorting
    const rarityOrder: Record<string, number> = {
      mythic: 6,
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    };

    // Fetch NFTs using the global index
    for (const tokenIdStr of allTokenIds) {
      const tokenId = parseInt(tokenIdStr, 10);
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) continue;

      const nft = parseNFTData(nftData, tokenId);
      const isListed = listingsSet.has(tokenIdStr);
      const listingInfo = listingPrices[tokenId];

      // Count stats for ALL NFTs (before filtering)
      globalStats.byRarity[nft.rarityTier] =
        (globalStats.byRarity[nft.rarityTier] || 0) + 1;
      globalStats.byBloodline[nft.bloodline] =
        (globalStats.byBloodline[nft.bloodline] || 0) + 1;

      // Apply filters
      if (bloodline !== "all" && nft.bloodline !== bloodline) continue;
      if (rarity !== "all" && nft.rarityTier !== rarity) continue;
      if (forSale === "true" && !isListed) continue;
      if (forSale === "false" && isListed) continue;

      const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
      const explorerUrl = EXPLORER_URLS[network];
      allNFTs.push({
        ...nft,
        isListed,
        listingPrice: listingInfo?.price,
        listedAt: listingInfo?.listedAt,
        blockchainUrl: `${explorerUrl}/tx/${nft.txid}`,
      });
    }

    // Sort NFTs
    switch (sort) {
      case "newest":
        allNFTs.sort((a, b) => b.mintedAt - a.mintedAt);
        break;
      case "oldest":
        allNFTs.sort((a, b) => a.mintedAt - b.mintedAt);
        break;
      case "rarest":
        allNFTs.sort(
          (a, b) =>
            (rarityOrder[b.rarityTier] || 0) - (rarityOrder[a.rarityTier] || 0),
        );
        break;
      case "level":
        allNFTs.sort((a, b) => b.level - a.level || b.xp - a.xp);
        break;
      case "xp":
        allNFTs.sort((a, b) => b.totalXp - a.totalXp);
        break;
    }

    // Paginate filtered results
    const filteredTotal = allNFTs.length;
    const totalPages = Math.ceil(filteredTotal / limit);
    const offset = (page - 1) * limit;
    const paginatedNFTs = allNFTs.slice(offset, offset + limit);

    return successResponse(c, {
      nfts: paginatedNFTs,
      total: filteredTotal,
      page,
      limit,
      totalPages,
      stats: globalStats, // Stats for ALL NFTs, not just filtered
    });
  } catch (error) {
    nftLogger.error("[NFT] Get all error:", error);
    return errorResponse(c, "Failed to get NFTs", 500);
  }
});

/**
 * GET /stats - Get global NFT statistics
 */
confirmRouter.get("/stats", async (c) => {
  try {
    if (!c.env.UPSTASH_REDIS_REST_URL || !c.env.UPSTASH_REDIS_REST_TOKEN) {
      return successResponse(c, {
        totalMinted: 0,
        totalForSale: 0,
        maxSupply: MAX_SUPPLY,
        byRarity: {},
        byBloodline: {},
        recentSales: [],
      });
    }

    const redis = getRedis(c.env);

    // Get all token IDs from the global index
    const allTokenIds = await redis.smembers("nft:all-tokens");
    const activeListings = await redis.smembers("nft:active-listings");
    const forSaleCount = activeListings?.length || 0;

    // Get distribution stats from all NFTs
    const byRarity: Record<string, number> = {};
    const byBloodline: Record<string, number> = {};

    for (const tokenIdStr of allTokenIds || []) {
      const tokenId = parseInt(tokenIdStr, 10);
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (nftData && Object.keys(nftData).length > 0) {
        const rarity = nftData.rarityTier as string;
        const blood = nftData.bloodline as string;
        if (rarity) byRarity[rarity] = (byRarity[rarity] || 0) + 1;
        if (blood) byBloodline[blood] = (byBloodline[blood] || 0) + 1;
      }
    }

    const totalMinted = allTokenIds?.length || 0;

    return successResponse(c, {
      totalMinted,
      totalForSale: forSaleCount,
      maxSupply: MAX_SUPPLY,
      mintProgress: Math.round((totalMinted / MAX_SUPPLY) * 100 * 100) / 100,
      byRarity,
      byBloodline,
    });
  } catch (error) {
    nftLogger.error("[NFT] Get stats error:", error);
    return errorResponse(c, "Failed to get stats", 500);
  }
});

/**
 * POST /migrate-index - Add tokens to the global index
 *
 * Pass token IDs in the request body to add them to nft:all-tokens.
 * Example: POST /api/nft/migrate-index {"tokenIds": [1, 3, 9443]}
 */
confirmRouter.post("/migrate-index", async (c) => {
  try {
    if (!c.env.UPSTASH_REDIS_REST_URL || !c.env.UPSTASH_REDIS_REST_TOKEN) {
      return errorResponse(c, "Redis not configured", 500);
    }

    const redis = getRedis(c.env);
    const body = await c.req.json().catch(() => ({}));
    const tokenIds: number[] = body.tokenIds || [];

    if (tokenIds.length === 0) {
      return errorResponse(c, "No tokenIds provided", 400);
    }

    // Add all token IDs to the global index
    for (const id of tokenIds) {
      await redis.sadd("nft:all-tokens", id.toString());
    }

    // Update the count
    const finalTokens = await redis.smembers("nft:all-tokens");
    const actualCount = finalTokens?.length || 0;
    await redis.set("nft:minted:count", actualCount);

    nftLogger.info("Migration completed", {
      addedTokens: tokenIds,
      totalCount: actualCount,
    });

    return successResponse(c, {
      migrated: true,
      addedTokens: tokenIds,
      totalCount: actualCount,
    });
  } catch (error) {
    nftLogger.error("[NFT] Migration error:", error);
    return errorResponse(c, "Failed to migrate index", 500);
  }
});

/**
 * GET /:tokenId - Get a single NFT by token ID
 */
confirmRouter.get(
  "/:tokenId",
  validateParams(tokenIdParamSchema),
  async (c) => {
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
  },
);
