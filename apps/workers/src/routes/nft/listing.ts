/**
 * NFT Listing Routes
 *
 * List NFTs for sale, view listings, unlist NFTs.
 */

import { Hono } from "hono";
import * as bitcoin from "bitcoinjs-lib";
import type { Env } from "../../lib/types";
import { getRedis } from "../../lib/redis";
import { errorResponse, successResponse } from "../../lib/helpers";
import { validateBody, validateParams } from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import {
  tokenIdParamSchema,
  listNftSchema,
  unlistBodySchema,
  checkUtxoExists,
} from "./middleware";

const marketplaceLogger = nftLogger.child({ component: "marketplace" });

export const listingRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// LISTINGS QUERY
// =============================================================================

/**
 * GET /listings - Get all active marketplace listings
 * Must be defined BEFORE /:tokenId to avoid route conflict
 *
 * Validates UTXO existence for PSBT-based listings and auto-invalidates
 * listings where the NFT has been spent.
 */
listingRouter.get("/listings", async (c) => {
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

        // For PSBT-based listings, validate that the UTXO still exists
        if (listing.nftUtxoTxid && listing.nftUtxoVout !== undefined) {
          const utxoExists = await checkUtxoExists(
            listing.nftUtxoTxid as string,
            parseInt(listing.nftUtxoVout as string, 10),
          );

          if (!utxoExists) {
            // Auto-invalidate the listing - UTXO was spent
            marketplaceLogger.info("Auto-invalidating listing - UTXO spent", {
              tokenId: id,
              txid: (listing.nftUtxoTxid as string).slice(0, 8),
            });
            await redis.del(`nft:listing:${id}`);
            await redis.srem("nft:active-listings", id);
            return null;
          }
        }

        // Build response object
        const result: {
          tokenId: number;
          price: number;
          sellerAddress: string;
          listedAt: number;
          sellerPsbt?: string;
          nftUtxo?: { txid: string; vout: number; value: number };
          nft: {
            dna: string;
            bloodline: string;
            baseType: string;
            rarityTier: string;
            level: number;
          };
        } = {
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

        // Include PSBT data if present
        if (listing.sellerPsbt) {
          result.sellerPsbt = listing.sellerPsbt as string;
        }
        if (listing.nftUtxoTxid) {
          result.nftUtxo = {
            txid: listing.nftUtxoTxid as string,
            vout: parseInt(listing.nftUtxoVout as string, 10),
            value: parseInt(listing.nftUtxoValue as string, 10),
          };
        }

        return result;
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

// =============================================================================
// LIST / UNLIST
// =============================================================================

/**
 * Validate that the seller's PSBT has the correct SIGHASH type (SIGHASH_SINGLE | SIGHASH_ANYONECANPAY)
 */
export function validateListingSighash(psbtBase64: string): {
  valid: boolean;
  error?: string;
} {
  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);

    // Must have at least one input (the NFT)
    const inputs = psbt.data.inputs;
    if (inputs.length === 0) {
      return { valid: false, error: "PSBT has no inputs" };
    }

    // Check input 0 (seller's NFT input) for correct sighash
    const input0 = inputs[0];
    const expectedSighash = 0x83; // SIGHASH_SINGLE | SIGHASH_ANYONECANPAY

    const sighashType = input0.sighashType;

    if (sighashType === undefined) {
      // No sighashType set — check partial signatures
      const partialSigs = input0.partialSig;
      if (!partialSigs || partialSigs.length === 0) {
        return {
          valid: false,
          error:
            "PSBT is not signed. The wallet may not have processed the PSBT correctly.",
        };
      }

      // Check the sighash byte in each partial signature (last byte)
      for (const sig of partialSigs) {
        const sigBytes = sig.signature;
        if (sigBytes.length > 0) {
          const sighashByte = sigBytes[sigBytes.length - 1];
          if (sighashByte !== expectedSighash) {
            return {
              valid: false,
              error:
                "Your wallet does not support SIGHASH_SINGLE|ANYONECANPAY. " +
                "Please use Leather, Xverse, or another compatible wallet.",
            };
          }
        }
      }

      return { valid: true };
    }

    if (sighashType !== expectedSighash) {
      return {
        valid: false,
        error:
          "Your wallet does not support SIGHASH_SINGLE|ANYONECANPAY. " +
          "Please use Leather, Xverse, or another compatible wallet.",
      };
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error:
        error instanceof Error
          ? `Failed to validate PSBT: ${error.message}`
          : "Failed to validate PSBT",
    };
  }
}

/**
 * POST /list - List an NFT for sale
 *
 * Supports two modes:
 * 1. Legacy: Simple server-side listing (no PSBT)
 * 2. PSBT-based: Atomic swap with seller's signed PSBT
 */
listingRouter.post("/list", validateBody(listNftSchema), async (c) => {
  const { tokenId, price, sellerAddress, sellerPsbt, nftUtxo } =
    c.get("validatedBody");

  try {
    if (sellerPsbt) {
      const validation = validateListingSighash(sellerPsbt);
      if (!validation.valid) {
        return errorResponse(
          c,
          validation.error || "Invalid PSBT SIGHASH",
          400,
        );
      }
    }

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

    // Create listing record
    const listing: Record<string, string> = {
      tokenId: tokenId.toString(),
      price: price.toString(),
      sellerAddress,
      listedAt: Date.now().toString(),
    };

    // Add PSBT fields if provided (atomic swap mode)
    if (sellerPsbt) {
      listing.sellerPsbt = sellerPsbt;
    }
    if (nftUtxo) {
      listing.nftUtxoTxid = nftUtxo.txid;
      listing.nftUtxoVout = nftUtxo.vout.toString();
      listing.nftUtxoValue = nftUtxo.value.toString();
    }

    await redis.hset(`nft:listing:${tokenId}`, listing);
    await redis.sadd("nft:active-listings", tokenId.toString());

    marketplaceLogger.info("Listed NFT", {
      tokenId,
      price,
      hasPsbt: Boolean(sellerPsbt),
    });

    return successResponse(c, listing);
  } catch (error) {
    marketplaceLogger.error("List error", error);
    return errorResponse(c, "Failed to list NFT", 500);
  }
});

/**
 * DELETE /unlist/:tokenId - Remove NFT listing
 *
 * SECURITY: Now requires signed request with timestamp to prevent spoofing.
 * The client must sign: `unlist:${tokenId}:${timestamp}` with Schnorr.
 *
 * Backward compatibility: If no signature provided, falls back to address-only
 * verification (will be deprecated in future versions).
 */
listingRouter.delete(
  "/unlist/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(unlistBodySchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { sellerAddress, timestamp, signature, publicKey } =
      c.get("validatedBody");

    try {
      const redis = getRedis(c.env);

      // Validate timestamp is within 5 minutes
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;
      if (Math.abs(now - timestamp) > fiveMinutes) {
        return errorResponse(c, "Request expired. Timestamp too old.", 400);
      }

      // Get listing
      const listing = await redis.hgetall(`nft:listing:${tokenId}`);
      if (!listing || Object.keys(listing).length === 0) {
        return errorResponse(c, "NFT is not listed", 404);
      }

      // Verify seller address matches
      if (listing.sellerAddress !== sellerAddress) {
        return errorResponse(c, "Only the seller can unlist", 403);
      }

      // Signature verification (REQUIRED since D4.3). The schema no longer
      // accepts requests without signature+publicKey, so the warn-only path
      // that anyone could unlist with just sellerAddress + tokenId is gone.
      const { verifySchnorrSignature, createAuthMessage } =
        await import("../../lib/crypto");

      const message = createAuthMessage("unlist", tokenId, timestamp);
      const isValid = await verifySchnorrSignature(
        signature,
        message,
        publicKey,
      );

      if (!isValid) {
        marketplaceLogger.warn("Invalid unlist signature", {
          tokenId,
          address: sellerAddress.slice(0, 10),
        });
        return errorResponse(c, "Invalid signature", 401);
      }

      marketplaceLogger.info("Signature verified for unlist", { tokenId });

      // Check for replay attack - use timestamp as nonce
      const nonceKey = `nft:unlist-nonce:${sellerAddress}:${tokenId}:${timestamp}`;
      const nonceUsed = await redis.get(nonceKey);
      if (nonceUsed) {
        return errorResponse(
          c,
          "Request already processed (replay attack)",
          400,
        );
      }
      await redis.set(nonceKey, "1", { ex: 600 }); // 10 min TTL

      // Remove listing
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
