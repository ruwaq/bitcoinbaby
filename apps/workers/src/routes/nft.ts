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
import type { Env } from "../lib/types";
import { reserveRouter } from "./nft/reserve";
import { confirmRouter } from "./nft/confirm";
import { evolveRouter } from "./nft/evolve";
import { listingRouter } from "./nft/listing";
import { buyRouter } from "./nft/buy";
import { claimRouter } from "./nft/claim";
import { mintRouter } from "./nft/mint";

export const nftRouter = new Hono<{ Bindings: Env }>();

// Mount sub-routers
// Order matters: /listings must be before /:tokenId in confirmRouter,
// but since each sub-router handles its own route namespace, Hono resolves correctly.
nftRouter.route("/", mintRouter); // unified /mint/prepare + /mint/finalize (D3)
nftRouter.route("/", reserveRouter);
nftRouter.route("/", evolveRouter);
nftRouter.route("/", listingRouter);
nftRouter.route("/", buyRouter);
nftRouter.route("/", claimRouter);
nftRouter.route("/", confirmRouter); // Mount last to prevent /:tokenId from stealing routes
