/**
 * NFT Boost Calculation (Server-side)
 *
 * Calculates NFT mining boost based on NFT ownership data from Redis.
 * Mirrors the client-side logic in packages/core/src/rewards/providers/nft-provider.ts
 */

import type { Redis } from "@upstash/redis/cloudflare";
import { Logger } from "./logger";

const nftBoostLogger = new Logger("NFTBoost");

// =============================================================================
// CONSTANTS (must match client-side)
// =============================================================================

const RARITY_BOOST: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 5,
  legendary: 8,
  mythic: 12,
};

const LEVEL_BOOST: Record<number, number> = {
  1: 0,
  2: 0.5,
  3: 1,
  4: 1.5,
  5: 2,
  6: 2.5,
  7: 3,
  8: 4,
  9: 5,
  10: 6,
};

const DIMINISHING_RETURNS = [
  1.0, // 1st NFT: 100%
  0.5, // 2nd NFT: 50%
  0.3, // 3rd NFT: 30%
  0.2, // 4th NFT: 20%
  0.15, // 5th NFT: 15%
  0.1, // 6th+ NFT: 10%
];

// =============================================================================
// TYPES
// =============================================================================

export interface NFTBoostData {
  totalBoostPercent: number;
  nftCount: number;
  bestNFTBoost: number;
  /** Base type of the best NFT (for cosmic boost calculation) */
  bestNFTBaseType: string;
  breakdown: Array<{
    tokenId: number;
    level: number;
    rarity: string;
    boostPercent: number;
  }>;
}

// =============================================================================
// FUNCTIONS
// =============================================================================

/**
 * Calculate the mining boost for a single NFT
 */
function calculateSingleNFTBoost(level: number, rarity: string): number {
  const levelBoost = LEVEL_BOOST[level] ?? 0;
  const rarityBoost = RARITY_BOOST[rarity.toLowerCase()] ?? 0;
  return levelBoost + rarityBoost;
}

/**
 * Get NFT boost data for an address from Redis
 */
export async function getNFTBoostData(
  redis: Redis,
  address: string,
): Promise<NFTBoostData> {
  const emptyResult: NFTBoostData = {
    totalBoostPercent: 0,
    nftCount: 0,
    bestNFTBoost: 0,
    bestNFTBaseType: "human", // Default fallback
    breakdown: [],
  };

  try {
    // Get all NFT token IDs owned by address
    const tokenIds = await redis.smembers(`nft:owned:${address}`);

    if (!tokenIds || tokenIds.length === 0) {
      return emptyResult;
    }

    // Fetch data for each NFT
    const nftBoosts: Array<{
      tokenId: number;
      level: number;
      rarity: string;
      baseType: string;
      boost: number;
    }> = [];

    for (const id of tokenIds) {
      const nftData = await redis.hgetall(`nft:minted:${id}`);
      if (!nftData) continue;

      const tokenId = parseInt(id as string, 10);
      const level = parseInt(nftData.level as string, 10) || 1;
      const rarity = (nftData.rarityTier as string) || "common";
      const baseType = (nftData.baseType as string) || "human";
      const boost = calculateSingleNFTBoost(level, rarity);

      nftBoosts.push({ tokenId, level, rarity, baseType, boost });
    }

    if (nftBoosts.length === 0) {
      return emptyResult;
    }

    // Sort by boost descending (best NFT first)
    nftBoosts.sort((a, b) => b.boost - a.boost);

    // Apply diminishing returns
    let totalBoost = 0;
    const breakdown: NFTBoostData["breakdown"] = [];

    for (let i = 0; i < nftBoosts.length; i++) {
      const nft = nftBoosts[i];
      const diminishingFactor =
        i < DIMINISHING_RETURNS.length
          ? DIMINISHING_RETURNS[i]
          : DIMINISHING_RETURNS[DIMINISHING_RETURNS.length - 1];

      const effectiveBoost = nft.boost * diminishingFactor;
      totalBoost += effectiveBoost;

      breakdown.push({
        tokenId: nft.tokenId,
        level: nft.level,
        rarity: nft.rarity,
        boostPercent: effectiveBoost,
      });
    }

    nftBoostLogger.debug("Calculated NFT boost", {
      address: address.slice(0, 10),
      nftCount: nftBoosts.length,
      totalBoost: totalBoost.toFixed(2),
    });

    return {
      totalBoostPercent: totalBoost,
      nftCount: nftBoosts.length,
      bestNFTBoost: nftBoosts[0].boost,
      bestNFTBaseType: nftBoosts[0].baseType,
      breakdown,
    };
  } catch (error) {
    nftBoostLogger.error("Failed to get NFT boost data", error);
    return emptyResult;
  }
}

/**
 * Calculate NFT multiplier from boost percentage
 */
export function getNFTMultiplier(boostPercent: number): number {
  // Convert percentage to multiplier (e.g., 15% -> 1.15x)
  return 1 + boostPercent / 100;
}
