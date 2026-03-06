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
import { getNFTMintingService } from "../services/nft-minting-service";

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
  /** Seller's signed PSBT (SIGHASH_SINGLE|ANYONECANPAY) for atomic swap */
  sellerPsbt: z.string().optional(),
  /** NFT UTXO location for PSBT-based listings */
  nftUtxo: z
    .object({
      txid: z
        .string()
        .length(64)
        .regex(/^[a-fA-F0-9]+$/),
      vout: z.number().int().min(0),
      value: z.number().int().positive(),
    })
    .optional(),
});

const buyNftSchema = z.object({
  buyerAddress: bitcoinAddressSchema,
  /** Transaction ID (required for PSBT-based purchases, optional for legacy) */
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/)
    .optional(),
});

const evolveNftSchema = z.object({
  tokenId: z.number().int().positive(),
  address: bitcoinAddressSchema,
});

const confirmEvolutionSchema = z.object({
  tokenId: z.number().int().positive(),
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  newLevel: z.number().int().min(2).max(10),
  address: bitcoinAddressSchema,
});

const workProofSchema = z.object({
  /** Owner's Bitcoin address */
  ownerAddress: bitcoinAddressSchema,
  /** Mining share hash (proof of work) */
  shareHash: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  /** Difficulty of the share */
  difficulty: z.number().int().min(1),
  /** Timestamp when share was found */
  timestamp: z.number().int().positive(),
});

const proveNftSchema = z.object({
  /** Reserved token ID */
  tokenId: z.number().int().positive(),
  /** Owner's Bitcoin address */
  address: bitcoinAddressSchema,
  /** NFT initial state */
  nftState: z.object({
    dna: z
      .string()
      .length(64)
      .regex(/^[a-fA-F0-9]+$/),
    bloodline: z.enum(["royal", "warrior", "rogue", "mystic"]),
    baseType: z.enum(["human", "animal", "robot", "mystic", "alien"]),
    genesisBlock: z.number().int().min(0),
    rarityTier: z.enum([
      "common",
      "uncommon",
      "rare",
      "epic",
      "legendary",
      "mythic",
    ]),
    tokenId: z.number().int().positive(),
    level: z.number().int().min(1).max(10).default(1),
    xp: z.number().int().min(0).default(0),
    totalXp: z.number().int().min(0).default(0),
    workCount: z.number().int().min(0).default(0),
    lastWorkBlock: z.number().int().min(0).default(0),
    evolutionCount: z.number().int().min(0).default(0),
    tokensEarned: z.string().default("0"),
  }),
  /** Funding UTXO */
  fundingUtxo: z.object({
    txid: z
      .string()
      .length(64)
      .regex(/^[a-fA-F0-9]+$/),
    vout: z.number().int().min(0),
    value: z.number().int().positive(),
  }),
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

// Base XP per valid share
const BASE_XP_PER_SHARE = 100;

// Bloodline XP multipliers
const BLOODLINE_XP_MULTIPLIERS: Record<string, number> = {
  royal: 1.5,
  warrior: 1.2,
  mystic: 1.3,
  rogue: 1.0,
};

// Minimum difficulty to earn XP
const MIN_DIFFICULTY_FOR_XP = 16;

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

/**
 * POST /api/nft/prove - Submit NFT to Charms prover
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
 * 4. Server builds V11 spell and submits to Charms prover
 * 5. Server returns commitTx + spellTx for signing
 * 6. Client signs both transactions with wallet
 * 7. Client broadcasts commitTx first, then spellTx
 * 8. Client confirms via POST /api/nft/confirm/:tokenId
 */
nftRouter.post("/prove", validateBody(proveNftSchema), async (c) => {
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

    // Get prover URL
    const proverUrl = c.env.CHARMS_PROVER_URL || "https://v11.charms.dev";

    // Get minting service
    const mintingService = getNFTMintingService({
      proverUrl,
      appId: nftAppId,
      appVk: nftAppVk,
      network: "testnet4",
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

// =============================================================================
// NFT CORE
// =============================================================================

/**
 * POST /api/nft/release/:tokenId - Release a reserved NFT ID (if mint failed)
 *
 * This endpoint is called when a mint fails after reserving an ID.
 * It decrements the counter only if the tokenId is the current max.
 * This prevents "lost" token IDs from failed mints.
 */
nftRouter.post(
  "/release/:tokenId",
  validateParams(tokenIdParamSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");

    try {
      const redis = getRedis(c.env);

      // Get current count
      const currentCount = await redis.get<number>("nft:minted:count");

      // Only decrement if this is the last reserved ID and it's not confirmed
      if (currentCount === tokenId) {
        // Check if this ID was already confirmed (has NFT data)
        const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
        if (nftData && Object.keys(nftData).length > 0) {
          // Already confirmed, don't release
          return successResponse(c, {
            released: false,
            reason: "already_confirmed",
          });
        }

        // Safe to release - decrement counter
        await redis.decr("nft:minted:count");
        nftLogger.info("Released token ID", { tokenId });
        return successResponse(c, { released: true });
      }

      // Not the last ID - can't release safely (would create gaps)
      // This is OK - gaps are acceptable, we just try to avoid them
      nftLogger.info("Cannot release token ID (not last)", {
        tokenId,
        currentCount,
      });
      return successResponse(c, { released: false, reason: "not_last_id" });
    } catch (error) {
      nftLogger.error("[NFT] Release error:", error);
      return errorResponse(c, "Failed to release NFT ID", 500);
    }
  },
);

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
 * Check if a UTXO exists (not spent) using mempool.space API
 */
async function checkUtxoExists(txid: string, vout: number): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(
      `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${txid}/outspend/${vout}`,
      {},
      5000, // 5 second timeout
    );

    if (!response.ok) {
      // If we can't verify, assume it exists (fail-safe)
      return true;
    }

    const data = (await response.json()) as { spent: boolean };
    // UTXO exists if it's not spent
    return !data.spent;
  } catch {
    // On error, assume UTXO exists (fail-safe)
    return true;
  }
}

// =============================================================================
// NFT EXPLORER - Get all minted NFTs
// =============================================================================

const explorerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "oldest", "rarest", "level", "xp"]).default("newest"),
  bloodline: z
    .enum(["royal", "warrior", "rogue", "mystic", "all"])
    .default("all"),
  rarity: z
    .enum(["common", "uncommon", "rare", "epic", "legendary", "mythic", "all"])
    .default("all"),
  forSale: z.enum(["true", "false", "all"]).default("all"),
});

/**
 * GET /api/nft/all - Get all minted NFTs with filtering and pagination
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
nftRouter.get("/all", async (c) => {
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

    // Get total minted count
    const mintedCount = await redis.get<number>("nft:minted:count");
    if (!mintedCount || mintedCount === 0) {
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

    // Fetch all NFTs (we need all for filtering/sorting, then paginate)
    const allNFTs: Array<
      NFTRecord & {
        isListed: boolean;
        listingPrice?: number;
        listedAt?: number;
        blockchainUrl: string;
      }
    > = [];

    // Rarity order for sorting
    const rarityOrder: Record<string, number> = {
      mythic: 6,
      legendary: 5,
      epic: 4,
      rare: 3,
      uncommon: 2,
      common: 1,
    };

    // Fetch NFTs
    for (let i = 1; i <= mintedCount; i++) {
      const nftData = await redis.hgetall(`nft:minted:${i}`);
      if (!nftData || Object.keys(nftData).length === 0) continue;

      const nft = parseNFTData(nftData, i);
      const isListed = listingsSet.has(i.toString());
      const listingInfo = listingPrices[i];

      // Apply filters
      if (bloodline !== "all" && nft.bloodline !== bloodline) continue;
      if (rarity !== "all" && nft.rarityTier !== rarity) continue;
      if (forSale === "true" && !isListed) continue;
      if (forSale === "false" && isListed) continue;

      allNFTs.push({
        ...nft,
        isListed,
        listingPrice: listingInfo?.price,
        listedAt: listingInfo?.listedAt,
        blockchainUrl: `https://mempool.space/testnet4/tx/${nft.txid}`,
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

    // Calculate stats
    const stats = {
      total: mintedCount,
      forSale: listingsSet.size,
      byRarity: {} as Record<string, number>,
      byBloodline: {} as Record<string, number>,
    };

    for (const nft of allNFTs) {
      stats.byRarity[nft.rarityTier] =
        (stats.byRarity[nft.rarityTier] || 0) + 1;
      stats.byBloodline[nft.bloodline] =
        (stats.byBloodline[nft.bloodline] || 0) + 1;
    }

    // Paginate
    const total = allNFTs.length;
    const totalPages = Math.ceil(total / limit);
    const offset = (page - 1) * limit;
    const paginatedNFTs = allNFTs.slice(offset, offset + limit);

    return successResponse(c, {
      nfts: paginatedNFTs,
      total,
      page,
      limit,
      totalPages,
      stats,
    });
  } catch (error) {
    nftLogger.error("[NFT] Get all error:", error);
    return errorResponse(c, "Failed to get NFTs", 500);
  }
});

/**
 * GET /api/nft/stats - Get global NFT statistics
 */
nftRouter.get("/stats", async (c) => {
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

    // Get counts
    const mintedCount = (await redis.get<number>("nft:minted:count")) || 0;
    const activeListings = await redis.smembers("nft:active-listings");
    const forSaleCount = activeListings?.length || 0;

    // Get distribution stats (sample first 100 for performance)
    const byRarity: Record<string, number> = {};
    const byBloodline: Record<string, number> = {};
    const sampleSize = Math.min(mintedCount, 100);

    for (let i = 1; i <= sampleSize; i++) {
      const nftData = await redis.hgetall(`nft:minted:${i}`);
      if (nftData) {
        const rarity = nftData.rarityTier as string;
        const blood = nftData.bloodline as string;
        if (rarity) byRarity[rarity] = (byRarity[rarity] || 0) + 1;
        if (blood) byBloodline[blood] = (byBloodline[blood] || 0) + 1;
      }
    }

    // Scale up to total if sampled
    if (sampleSize < mintedCount) {
      const scale = mintedCount / sampleSize;
      for (const key in byRarity) {
        byRarity[key] = Math.round(byRarity[key] * scale);
      }
      for (const key in byBloodline) {
        byBloodline[key] = Math.round(byBloodline[key] * scale);
      }
    }

    return successResponse(c, {
      totalMinted: mintedCount,
      totalForSale: forSaleCount,
      maxSupply: MAX_SUPPLY,
      mintProgress: Math.round((mintedCount / MAX_SUPPLY) * 100 * 100) / 100,
      byRarity,
      byBloodline,
    });
  } catch (error) {
    nftLogger.error("[NFT] Get stats error:", error);
    return errorResponse(c, "Failed to get stats", 500);
  }
});

/**
 * GET /api/nft/listings - Get all active marketplace listings
 * Must be defined BEFORE /:tokenId to avoid route conflict
 *
 * Validates UTXO existence for PSBT-based listings and auto-invalidates
 * listings where the NFT has been spent.
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
 *
 * Supports two modes:
 * 1. Legacy: Simple server-side listing (no PSBT)
 * 2. PSBT-based: Atomic swap with seller's signed PSBT
 */
nftRouter.post("/list", validateBody(listNftSchema), async (c) => {
  const { tokenId, price, sellerAddress, sellerPsbt, nftUtxo } =
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
 * For PSBT-based purchases, the buyer broadcasts the transaction and provides
 * the txid. The server verifies the payment and updates ownership.
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

    // txid is required for purchase verification
    if (!txid) {
      return errorResponse(c, "Transaction ID is required for purchase", 400);
    }

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

/**
 * POST /api/nft/confirm-evolution - Confirm on-chain evolution transaction
 *
 * Called after a client broadcasts an evolution transaction to the blockchain.
 * Updates the server state to reflect the new level.
 *
 * Note: This is different from /evolve which uses virtual balance.
 * This endpoint is for on-chain evolution with real BABTC burn.
 */
nftRouter.post(
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
 * POST /api/nft/:tokenId/work-proof - Submit work proof to gain XP
 *
 * When a user mines a valid share, their equipped NFT gains XP.
 * XP is calculated based on:
 * - Base XP (100)
 * - Bloodline multiplier (Royal: 1.5x, Warrior: 1.2x, Mystic: 1.3x, Rogue: 1.0x)
 * - Difficulty bonus (higher difficulty = more XP)
 */
nftRouter.post(
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

      // Check for duplicate share hash (prevent double-counting)
      const shareKey = `nft:share:${shareHash}`;
      const existingShare = await redis.get(shareKey);
      if (existingShare) {
        return errorResponse(c, "This share was already submitted", 400);
      }

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

      // Mark share as used (expire after 24 hours to prevent infinite storage)
      await redis.set(shareKey, tokenId.toString(), { ex: 86400 });

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
