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
  workRouteSchema,
  evolveRouteSchema,
  XP_REQUIREMENTS,
  BASE_XP_PER_SHARE,
  BLOODLINE_XP_MULTIPLIERS,
  MIN_DIFFICULTY_FOR_XP,
  resolveNftAppConfig,
} from "./middleware";
import { parseNFTData } from "./types";
import { countLeadingZeroBits } from "../../lib/proof-validation";
import {
  getNetworkForEnvironment,
  MEMPOOL_API_URLS,
} from "../../config/bitcoin";
import {
  buildWorkProofSpellRequest,
  buildLevelUpSpellRequest,
  MAX_LEVEL,
  type SparkNFTState,
} from "../../services/nft-evolution-service";

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

// =============================================================================
// ON-CHAIN EVOLUTION (Charms v15 spells)
// =============================================================================
//
// POST /api/nft/work/:tokenId    — accrue XP via a work_proof spell
// POST /api/nft/evolve/:tokenId  — level up via a level_up spell
//
// Both build the spell via the evolution service (build{WorkProof,LevelUp}
// SpellRequest), fetch the prev_tx hex for the NFT UTXO, attach it to
// proverRequest.prev_txs, and POST to the Charms v15 prover. On success they
// return { commitTxHex, spellTxHex } so the client can sign + broadcast — the
// same shape returned by POST /prove (reserve.ts).

/** Placeholder for the prover response shape we accept (array of { bitcoin }). */
interface ProverTxResponse {
  bitcoin?: string;
  commitTx?: string;
  spellTx?: string;
}

/**
 * Submit a built evolution spell to the Charms v15 prover.
 *
 * Mirrors NFTMintingServiceSimple.proveOnce: POST `${proverUrl}/spells/prove`
 * with the spell request, then extract commitTx + spellTx from either the
 * `{ commitTx, spellTx }` shape or the `[{ bitcoin }, { bitcoin }]` array
 * shape. Throws on a non-2xx or a response lacking a spellTx.
 */
async function submitEvolutionSpell(
  proverUrl: string,
  proverRequest: unknown,
  logContext: Record<string, unknown>,
): Promise<{ commitTxHex?: string; spellTxHex: string }> {
  const endpoint = `${proverUrl}/spells/prove`;
  const controller = new AbortController();
  // Match the minting service's 120s timeout.
  const timeoutId = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BitcoinBaby/2.0",
      },
      body: JSON.stringify(proverRequest),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Prover API error: ${response.status} - ${errorText.slice(0, 200)}`,
      );
    }

    const rawData = (await response.json()) as
      | ProverTxResponse
      | ProverTxResponse[];
    nftLogger.info("Evolution prover raw response", {
      ...logContext,
      isArray: Array.isArray(rawData),
      preview: JSON.stringify(rawData).slice(0, 200),
    });

    let commitTxHex: string | undefined;
    let spellTxHex: string | undefined;

    if (!Array.isArray(rawData)) {
      commitTxHex = rawData.commitTx;
      spellTxHex = rawData.spellTx;
    } else {
      const txs = rawData
        .filter((t) => t.bitcoin)
        .map((t) => t.bitcoin as string);
      if (txs.length >= 2) {
        commitTxHex = txs[0];
        spellTxHex = txs[1];
      } else if (txs.length === 1) {
        spellTxHex = txs[0];
      }
    }

    if (!spellTxHex) {
      throw new Error(
        `Invalid prover response: no transactions. Raw: ${JSON.stringify(rawData).slice(0, 200)}`,
      );
    }

    return { commitTxHex, spellTxHex };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch the raw transaction hex for a UTXO's prev_tx (required by the prover
 * to validate the input being spent). Mirrors NFTMintingServiceSimple.
 * fetchRawTransaction. On regtest/test stub txids it returns a canned hex.
 */
async function fetchPrevTxHex(
  txid: string,
  network: ReturnType<typeof getNetworkForEnvironment>,
): Promise<string> {
  if (
    txid ===
      "0000000000000000000000000000000000000000000000000000000000000001" ||
    txid ===
      "0000000000000000000000000000000000000000000000000000000000000002" ||
    network === "regtest"
  ) {
    return "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100f2052a010000000000000000";
  }
  const baseUrl = MEMPOOL_API_URLS[network];
  const response = await fetch(`${baseUrl}/tx/${txid}/hex`);
  if (!response.ok) {
    throw new Error(`Failed to fetch prev tx ${txid}: ${response.status}`);
  }
  return response.text();
}

/**
 * Convert an NFT's Redis record (camelCase hset) into the snake_case
 * SparkNFTState the evolution service / on-chain contract expects.
 */
function nftRecordToSparkState(data: Record<string, unknown>): SparkNFTState {
  return {
    dna: (data.dna as string) || "",
    bloodline: (data.bloodline as string) || "rogue",
    base_type: (data.baseType as string) || "human",
    genesis_block: parseInt(data.genesisBlock as string, 10) || 0,
    rarity_tier: (data.rarityTier as string) || "common",
    token_id: parseInt(data.tokenId as string, 10),
    level: parseInt(data.level as string, 10) || 1,
    xp: parseInt(data.xp as string, 10) || 0,
    total_xp: parseInt(data.totalXp as string, 10) || 0,
    work_count: parseInt(data.workCount as string, 10) || 0,
    last_work_block: parseInt(data.lastWorkBlock as string, 10) || 0,
    evolution_count: parseInt(data.evolutionCount as string, 10) || 0,
    tokens_earned: (data.tokensEarned as string) || "0",
  };
}

/**
 * POST /work/:tokenId — accrue XP via a work_proof spell.
 *
 * Body: { ownerAddress, currentBlock, xpGain, nftUtxo: {txid, vout}, currentState? }
 *
 * Validates ownership + NFT_APP_ID, reads the NFT's current state from the
 * indexer, builds a work_proof spell, fetches the prev_tx, calls the prover,
 * and returns { commitTxHex, spellTxHex }.
 */
evolveRouter.post(
  "/work/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(workRouteSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { ownerAddress, currentBlock, xpGain, nftUtxo, currentState } =
      c.get("validatedBody");

    try {
      // Guard: evolution also needs the deployed NFT app on-chain.
      const appConfig = resolveNftAppConfig(c.env);
      if (appConfig.status === "unavailable") {
        if (appConfig.reason === "placeholder") {
          nftLogger.error(
            "NFT_APP_ID is still the placeholder value. Update after first mint.",
          );
          return errorResponse(
            c,
            "NFT minting not available: app ID not yet established",
            503,
          );
        }
        nftLogger.error("NFT app not configured");
        return errorResponse(
          c,
          "NFT minting not available: app not configured",
          503,
        );
      }

      const redis = getRedis(c.env);

      // Read the canonical NFT state from the indexer.
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) {
        return errorResponse(c, "NFT not found", 404);
      }

      // Ownership check — only the owner can evolve their NFT.
      const isOwned = await redis.sismember(
        `nft:owned:${ownerAddress}`,
        tokenId.toString(),
      );
      if (!isOwned) {
        return errorResponse(c, "You do not own this NFT", 403);
      }

      let state = nftRecordToSparkState(nftData);

      // If the client supplied an observed state, fail loudly on drift so the
      // prover isn't asked to prove a transition the client doesn't expect.
      if (currentState) {
        if (currentState.token_id !== state.token_id) {
          return errorResponse(
            c,
            `State mismatch: client token_id ${currentState.token_id} != server ${state.token_id}`,
            409,
          );
        }
        state = currentState;
      }

      const { proverRequest } = buildWorkProofSpellRequest({
        appId: appConfig.appId,
        appVk: appConfig.appVk,
        nftUtxo,
        currentState: state,
        ownerAddress,
        xpGain,
        currentBlock,
      });

      // Fetch the prev_tx for the NFT UTXO and attach it before proving.
      const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
      const prevTxHex = await fetchPrevTxHex(nftUtxo.txid, network);
      proverRequest.prev_txs = [{ bitcoin: prevTxHex }];

      nftLogger.info("Submitting work_proof spell to prover", {
        tokenId,
        owner: ownerAddress.slice(0, 10),
        xpGain,
        currentBlock,
      });

      const proverUrl = c.env.PROVER_URL || "https://v15.charms.dev";
      const { commitTxHex, spellTxHex } = await submitEvolutionSpell(
        proverUrl,
        proverRequest,
        { tokenId, op: "work_proof" },
      );

      nftLogger.info("Work_proof spell generated", { tokenId });

      return successResponse(c, {
        tokenId,
        commitTxHex,
        spellTxHex,
        nextSteps: [
          "1. Sign commitTx with your wallet",
          "2. Sign spellTx with your wallet",
          "3. Broadcast commitTx and wait for confirmation",
          "4. Broadcast spellTx",
          "5. Call POST /api/nft/confirm-evolution with the spellTxid",
        ],
      });
    } catch (error) {
      nftLogger.error("[NFT] Work spell error:", error);
      return errorResponse(c, "Failed to prove work spell", 500);
    }
  },
);

/**
 * POST /evolve/:tokenId — level up the NFT via a level_up spell.
 *
 * Body: { ownerAddress, nftUtxo: {txid, vout}, currentState? }
 *
 * Validates ownership + NFT_APP_ID, refuses level >= MAX_LEVEL early (400),
 * builds a level_up spell, fetches the prev_tx, calls the prover, and returns
 * { commitTxHex, spellTxHex }.
 */
evolveRouter.post(
  "/evolve/:tokenId",
  validateParams(tokenIdParamSchema),
  validateBody(evolveRouteSchema),
  async (c) => {
    const { tokenId } = c.get("validatedParams");
    const { ownerAddress, nftUtxo, currentState } = c.get("validatedBody");

    try {
      // Guard: evolution also needs the deployed NFT app on-chain.
      const appConfig = resolveNftAppConfig(c.env);
      if (appConfig.status === "unavailable") {
        if (appConfig.reason === "placeholder") {
          nftLogger.error(
            "NFT_APP_ID is still the placeholder value. Update after first mint.",
          );
          return errorResponse(
            c,
            "NFT minting not available: app ID not yet established",
            503,
          );
        }
        nftLogger.error("NFT app not configured");
        return errorResponse(
          c,
          "NFT minting not available: app not configured",
          503,
        );
      }

      const redis = getRedis(c.env);

      // Read the canonical NFT state from the indexer.
      const nftData = await redis.hgetall(`nft:minted:${tokenId}`);
      if (!nftData || Object.keys(nftData).length === 0) {
        return errorResponse(c, "NFT not found", 404);
      }

      // Ownership check — only the owner can evolve their NFT.
      const isOwned = await redis.sismember(
        `nft:owned:${ownerAddress}`,
        tokenId.toString(),
      );
      if (!isOwned) {
        return errorResponse(c, "You do not own this NFT", 403);
      }

      let state = nftRecordToSparkState(nftData);

      // Early refuse: the contract can't level past MAX_LEVEL.
      if (state.level >= MAX_LEVEL) {
        return errorResponse(
          c,
          `NFT is already at max level (${MAX_LEVEL})`,
          400,
        );
      }

      // If the client supplied an observed state, fail loudly on drift.
      if (currentState) {
        if (currentState.token_id !== state.token_id) {
          return errorResponse(
            c,
            `State mismatch: client token_id ${currentState.token_id} != server ${state.token_id}`,
            409,
          );
        }
        state = currentState;
      }

      // buildLevelUpSpellRequest throws at MAX_LEVEL — we already refused
      // above, but guard defensively (e.g. client-supplied state at 21).
      let spellResult;
      try {
        spellResult = buildLevelUpSpellRequest({
          appId: appConfig.appId,
          appVk: appConfig.appVk,
          nftUtxo,
          currentState: state,
          ownerAddress,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/max level/i.test(msg)) {
          return errorResponse(c, msg, 400);
        }
        throw e;
      }
      const { proverRequest, outState } = spellResult;

      // Fetch the prev_tx for the NFT UTXO and attach it before proving.
      const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
      const prevTxHex = await fetchPrevTxHex(nftUtxo.txid, network);
      proverRequest.prev_txs = [{ bitcoin: prevTxHex }];

      nftLogger.info("Submitting level_up spell to prover", {
        tokenId,
        owner: ownerAddress.slice(0, 10),
        fromLevel: state.level,
        toLevel: outState.level,
      });

      const proverUrl = c.env.PROVER_URL || "https://v15.charms.dev";
      const { commitTxHex, spellTxHex } = await submitEvolutionSpell(
        proverUrl,
        proverRequest,
        { tokenId, op: "level_up" },
      );

      nftLogger.info("Level_up spell generated", { tokenId });

      return successResponse(c, {
        tokenId,
        commitTxHex,
        spellTxHex,
        nextSteps: [
          "1. Sign commitTx with your wallet",
          "2. Sign spellTx with your wallet",
          "3. Broadcast commitTx and wait for confirmation",
          "4. Broadcast spellTx",
          "5. Call POST /api/nft/confirm-evolution with the spellTxid",
        ],
      });
    } catch (error) {
      nftLogger.error("[NFT] Evolve spell error:", error);
      return errorResponse(c, "Failed to prove evolution spell", 500);
    }
  },
);
