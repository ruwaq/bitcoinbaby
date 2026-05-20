/**
 * NFT Buy Routes
 *
 * Purchase NFTs from the marketplace.
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
import {
  validateBody,
  validateParams,
} from "../../lib/middleware";
import { nftLogger } from "../../lib/logger";
import {
  tokenIdParamSchema,
  buyNftSchema,
} from "./middleware";

const marketplaceLogger = nftLogger.child({ component: "marketplace" });

export const buyRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// NFT MARKETPLACE - BUY
// =============================================================================

/**
 * POST /buy/:tokenId - Buy a listed NFT
 *
 * For PSBT-based purchases, the buyer broadcasts the transaction and provides
 * the txid. The server verifies the payment and updates ownership.
 *
 * SECURITY: Verifies payment on blockchain before transferring ownership.
 */
buyRouter.post(
  "/buy/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(buyNftSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { buyerAddress, txid } = c.get("validatedBody");

    // txid is required for purchase verification
    if (!txid) {
      return errorResponse(c, "Transaction ID is required for purchase", 400);
    }

    try {
      const redis = getRedis(c.env);

      // Atomically try to claim this txid to prevent race conditions
      // SETNX returns 1 if key was set (new), 0 if already existed
      const purchaseLockKey = `nft:purchase:${txid}`;
      const lockAcquired = await redis.setnx(
        purchaseLockKey,
        `pending:${tokenId}`,
      );

      if (!lockAcquired) {
        return errorResponse(
          c,
          "This transaction was already used for a purchase",
          400,
        );
      }

      // Set TTL on the lock in case verification fails (auto-cleanup)
      await redis.expire(purchaseLockKey, 3600); // 1 hour TTL

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

      // Verify NFT transfer to buyer (dust output = 546 sats)
      const nftOutput = txData.vout.find(
        (output) =>
          output.scriptpubkey_address === buyerAddress &&
          output.value === 546,
      );

      if (!nftOutput) {
        return errorResponse(
          c,
          "Transaction does not transfer NFT (dust output) to buyer",
          400,
        );
      }

      // Verify seller's original UTXO is spent (no UTXO substitution)
      if (listing.nftUtxoTxid && listing.nftUtxoVout !== undefined) {
        const sellerUtxoSpent = txData.vin.some(
          (input) =>
            input.txid === (listing.nftUtxoTxid as string) &&
            input.vout === parseInt(listing.nftUtxoVout as string, 10),
        );

        if (!sellerUtxoSpent) {
          return errorResponse(
            c,
            "Transaction does not spend seller's original NFT UTXO",
            400,
          );
        }
      }

      marketplaceLogger.info("Payment verified", {
        txid: txid.slice(0, 8),
        amount: paymentOutput.value,
      });

      // Transfer ownership (update lock key to final value)
      await redis.set(purchaseLockKey, tokenId.toString());
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
