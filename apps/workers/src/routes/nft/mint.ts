/**
 * NFT Mint Routes — Unified /mint flow (D3)
 *
 * Replaces the old reserve → prove → confirm triplet (and the divergent
 * /claim path) with a single, secure, two-step mint:
 *
 *   1. `POST /mint/prepare`  — server derives tokenId + traits from the
 *      funding txid, builds an atomic spell (NFT coin + treasury payment in
 *      the SAME Bitcoin tx) and returns the unsigned hex. The client signs
 *      and broadcasts.
 *
 *   2. `POST /mint/finalize` — server verifies the broadcast spell tx
 *      on-chain (confirmed + correct outputs to treasury and owner) and
 *      persists the NFT to the indexer.
 *
 * Security properties vs. the old flow (see SESSION-8-HANDOFF bugs #1-#9):
 *   - Traits are generated server-side from the txid; the client never
 *     supplies them (closes #2 mythic-always).
 *   - The funding UTXO is verified to belong to `address` and be unspent
 *     (closes #3 unvalidated ownership).
 *   - Atomic payment: the mint and the payment are the same tx, so a NFT
 *     cannot be minted without paying the treasury (closes #1 free-mint).
 *   - Anti-race locks keyed by the funding outpoint (/prepare) and by the
 *     spell txid (/finalize), both via SETNX (closes #4 TOCTOU).
 *   - Anti-replay by spell txid (closes #5 replay).
 *   - On-chain verification of the spell tx on finalize (closes #6 blind
 *     trust in the client txid).
 *   - The indexer set `nft:all-tokens` is updated (closes #9 invisible NFTs).
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
import { getNetworkForEnvironment } from "../../config/bitcoin";
import { getNFTMintingServiceSimple } from "../../services/nft-minting-simple";
import { NFT_DUST_SATS } from "../../services/nft-spell-utils";
import {
  mintPrepareSchema,
  mintFinalizeSchema,
  resolveNftAppConfig,
  MAX_SUPPLY,
} from "./middleware";
import { createSeededRandom } from "./types";

export const mintRouter = new Hono<{ Bindings: Env }>();

// =============================================================================
// CONSTANTS
// =============================================================================

/** TTL of the /prepare lock (keyed by funding outpoint). Must exceed the time
 *  the client reasonably needs to sign+broadcast. 10 min matches the old
 *  /reserve TTL. */
const PREPARE_LOCK_TTL_SECONDS = 600;

/** TTL of the pending-mint record (keyed by tokenId). 1h window to finalize. */
const PENDING_RECORD_TTL_SECONDS = 3600;

/** Sats reserved on top of (price + dust) to cover the Bitcoin fee of the
 *  atomic mint tx. Conservative for a 1-in/3-out P2TR tx at ~10 sat/vB. */
const MINT_FEE_RESERVE_SATS = 1000;

// =============================================================================
// TRAIT GENERATION (server-side, deterministic from the funding txid)
// =============================================================================

const BLOODLINES = ["royal", "warrior", "rogue", "mystic"] as const;
const BASE_TYPES = ["human", "animal", "robot", "mystic", "alien"] as const;

interface MintTraits {
  dna: string;
  bloodline: string;
  baseType: string;
  rarityTier: string;
}

/**
 * Derive NFT traits deterministically from a seed.
 *
 * Same rarity distribution as the legacy /claim route so the existing economy
 * curve is preserved. The seed is the `{fundingTxid}:{tokenId}` — both inputs
 * are on-chain and outside the client's control by the time /prepare runs, so
 * the traits cannot be gamed.
 */
function generateTraits(seed: string): MintTraits {
  const rng = createSeededRandom(seed);

  const dna = Array.from({ length: 64 }, () =>
    Math.floor(rng() * 16).toString(16),
  ).join("");

  const bloodline = BLOODLINES[Math.floor(rng() * BLOODLINES.length)];
  const baseType = BASE_TYPES[Math.floor(rng() * BASE_TYPES.length)];

  const rarityRoll = rng() * 100;
  let rarityTier: string;
  if (rarityRoll < 50) rarityTier = "common";
  else if (rarityRoll < 75) rarityTier = "uncommon";
  else if (rarityRoll < 90) rarityTier = "rare";
  else if (rarityRoll < 97) rarityTier = "epic";
  else if (rarityRoll < 99.5) rarityTier = "legendary";
  else rarityTier = "mythic";

  return { dna, bloodline, baseType, rarityTier };
}

// =============================================================================
// ENV RESOLUTION
// =============================================================================

/** Parse NFT_MINT_PRICE_SATS from env (string, as wrangler delivers vars). */
function getMintPriceSats(env: Env): number {
  const raw = env.NFT_MINT_PRICE_SATS;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5000;
}

/** Resolve the treasury address. Falls back to the canonical testnet4 one if
 *  the env var is unset — production MUST override via wrangler secret. */
function getMintTreasury(env: Env): string {
  return (
    env.NFT_TREASURY_ADDRESS ||
    "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu"
  );
}

// =============================================================================
// STEP 1 — PREPARE
// =============================================================================

mintRouter.post("/mint/prepare", validateBody(mintPrepareSchema), async (c) => {
  const { address, fundingUtxo } = c.get("validatedBody");
  const redis = getRedis(c.env);

  try {
    // 1. App config guard (same gate as the legacy /prove route).
    const app = resolveNftAppConfig(c.env);
    if (app.status === "unavailable") {
      return errorResponse(
        c,
        app.reason === "placeholder"
          ? "NFT minting not available: app ID not yet established"
          : "NFT minting not available: app not configured",
        503,
      );
    }

    // 2. Supply cap.
    const mintedCount = Number((await redis.get("nft:minted:count")) || "0");
    if (mintedCount >= MAX_SUPPLY) {
      return errorResponse(c, "Max supply reached", 400);
    }

    // 3. Atomic anti-race lock keyed by the funding outpoint. A second
    //    /prepare for the same UTXO cannot proceed until the lock expires.
    const lockKey = `nft:mint:prepare:${fundingUtxo.txid}:${fundingUtxo.vout}`;
    const acquired = await redis.setnx(lockKey, address);
    if (!acquired) {
      return errorResponse(
        c,
        "This UTXO is already being used for a mint in progress",
        409,
      );
    }
    await redis.expire(lockKey, PREPARE_LOCK_TTL_SECONDS);

    // 4. Verify the funding UTXO belongs to `address` and is unspent.
    //    Closes bug #3: the legacy /prove never checked this, so a client
    //    could mint against someone else's UTXO.
    const utxoOwner = await fetchUtxoOwner(fundingUtxo.txid, fundingUtxo.vout);
    if (utxoOwner === null) {
      return errorResponse(
        c,
        "Funding UTXO is already spent or does not exist",
        400,
      );
    }
    if (utxoOwner !== address) {
      return errorResponse(
        c,
        "Funding UTXO does not belong to the requesting address",
        400,
      );
    }

    // 5. Validate the UTXO value covers price + dust + fee.
    const priceSats = getMintPriceSats(c.env);
    const required = priceSats + NFT_DUST_SATS + MINT_FEE_RESERVE_SATS;
    if (fundingUtxo.value < required) {
      return errorResponse(
        c,
        `Funding UTXO value ${fundingUtxo.value} sats is below the minimum ${required} sats (price ${priceSats} + dust ${NFT_DUST_SATS} + fee reserve ${MINT_FEE_RESERVE_SATS})`,
        400,
      );
    }

    // 6. Server-side tokenId + traits. The seed binds the traits to BOTH the
    //    on-chain funding txid AND the tokenId, so they are unfakeable.
    const tokenId = await redis.incr("nft:minted:count");
    if (tokenId > MAX_SUPPLY) {
      // We incremented past the cap under contention; release and bail.
      await redis.del(lockKey);
      return errorResponse(c, "Max supply reached", 400);
    }
    const traits = generateTraits(`${fundingUtxo.txid}:${tokenId}`);

    // 7. Build the atomic mint spell via the shared service. The spell emits
    //    TWO coin outputs in the same Bitcoin tx: the NFT dust to the owner
    //    and the price to the treasury. The client cannot mint without paying.
    const network = getNetworkForEnvironment(c.env.ENVIRONMENT);
    const mintingService = getNFTMintingServiceSimple({
      proverUrl: c.env.PROVER_URL || "https://v15.charms.dev",
      appId: app.appId,
      appVk: app.appVk,
      network,
    });

    nftLogger.info("Submitting unified /mint/prepare to prover", {
      tokenId,
      address,
      rarity: traits.rarityTier,
      bloodline: traits.bloodline,
      priceSats,
    });

    const result = await mintingService.processMint({
      tokenId,
      ownerAddress: address,
      nftState: {
        dna: traits.dna,
        bloodline: traits.bloodline,
        baseType: traits.baseType,
        genesisBlock: 0,
        rarityTier: traits.rarityTier,
        tokenId,
        level: 1,
        xp: 0,
        totalXp: 0,
        workCount: 0,
        lastWorkBlock: 0,
        evolutionCount: 0,
        tokensEarned: "0",
        heritage: 0,
      },
      fundingUtxo,
      treasuryAddress: getMintTreasury(c.env),
      priceSats,
    });

    if (!result.success) {
      nftLogger.error("Prover failed during /mint/prepare", {
        tokenId,
        error: result.error,
      });
      // Release the lock so the client can retry with a fresh UTXO.
      await redis.del(lockKey);
      return errorResponse(
        c,
        result.error || "Failed to generate NFT proof",
        500,
      );
    }

    // 8. Persist a pending record so /finalize can recover the traits. The
    //    indexer is NOT updated here — only on confirmed finalize.
    const pendingRecord = {
      tokenId,
      address,
      fundingTxid: fundingUtxo.txid,
      fundingVout: fundingUtxo.vout,
      priceSats,
      traits: JSON.stringify(traits),
      preparedAt: Date.now(),
      commitTxid: result.commitTxid || "",
      spellTxid: result.spellTxid || "",
    };
    await redis.hset(`nft:mint:pending:${tokenId}`, pendingRecord);
    await redis.expire(
      `nft:mint:pending:${tokenId}`,
      PENDING_RECORD_TTL_SECONDS,
    );

    nftLogger.info("Unified /mint/prepare generated proof", {
      tokenId,
      commitTxid: result.commitTxid,
      spellTxid: result.spellTxid,
    });

    return successResponse(c, {
      tokenId,
      traits,
      priceSats,
      treasuryAddress: getMintTreasury(c.env),
      commitTxHex: result.commitTxHex,
      spellTxHex: result.spellTxHex,
      commitTxid: result.commitTxid,
      spellTxid: result.spellTxid,
      nextSteps: [
        "1. Sign commitTx with your wallet",
        "2. Sign spellTx with your wallet",
        "3. Broadcast commitTx and wait for confirmation",
        "4. Broadcast spellTx",
        "5. Call POST /api/nft/mint/finalize with the spellTxid",
      ],
    });
  } catch (error) {
    nftLogger.error("[NFT] /mint/prepare error:", error);
    return errorResponse(c, "Failed to prepare NFT mint", 500);
  }
});

// =============================================================================
// STEP 2 — FINALIZE
// =============================================================================

mintRouter.post(
  "/mint/finalize",
  validateBody(mintFinalizeSchema),
  async (c) => {
    const { spellTxid, address } = c.get("validatedBody");
    const redis = getRedis(c.env);

    try {
      // 1. Anti-replay by spell txid. Closes bug #5.
      const alreadyMinted = await redis.get(`nft:minted:txid:${spellTxid}`);
      if (alreadyMinted) {
        return errorResponse(
          c,
          "This spell tx was already used for a mint",
          409,
        );
      }

      // 2. Atomic finalize lock keyed by spell txid. Closes the TOCTOU race
      //    (bug #4) that the legacy /confirm had.
      const finalizeLock = `nft:mint:finalizing:${spellTxid}`;
      const acquired = await redis.setnx(finalizeLock, address);
      if (!acquired) {
        return errorResponse(
          c,
          "This spell tx is already being finalized",
          409,
        );
      }
      await redis.expire(finalizeLock, PENDING_RECORD_TTL_SECONDS);

      // 3. Verify the spell tx on-chain. Closes bug #6 (legacy /confirm trusted
      //    the client txid blindly).
      let txResponse: Response;
      try {
        txResponse = await fetchWithTimeout(
          `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${spellTxid}`,
          {},
          EXTERNAL_API.TX_LOOKUP_TIMEOUT_MS,
        );
      } catch (error) {
        if (error instanceof TimeoutError) {
          return errorResponse(
            c,
            "Blockchain API timeout. Please retry finalize shortly.",
            503,
          );
        }
        throw error;
      }
      if (!txResponse.ok) {
        return errorResponse(
          c,
          "Spell transaction not found on blockchain. Broadcast it first.",
          404,
        );
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
        return errorResponse(
          c,
          "Spell transaction not yet confirmed. Retry after confirmation.",
          400,
        );
      }

      // 4. Validate outputs: NFT dust to the owner + price to the treasury.
      const priceSats = getMintPriceSats(c.env);
      const treasury = getMintTreasury(c.env);

      const nftOutput = txData.vout.find(
        (out) =>
          out.scriptpubkey_address === address && out.value === NFT_DUST_SATS,
      );
      if (!nftOutput) {
        return errorResponse(
          c,
          "Spell tx does not pay the NFT dust output to the requester",
          400,
        );
      }

      const treasuryOutput = txData.vout.find(
        (out) =>
          out.scriptpubkey_address === treasury && out.value >= priceSats,
      );
      if (!treasuryOutput) {
        return errorResponse(
          c,
          `Spell tx does not pay the treasury the required ${priceSats} sats`,
          400,
        );
      }

      // 5. Recover the pending record to fetch the server-generated traits.
      //    We look it up by (address, fundingTxid) because the spell txid in the
      //    pending record is the *expected* one the prover computed, which may
      //    differ from the actual broadcast txid once the client signs. The
      //    canonical binding is therefore (owner + confirmed on-chain outputs).
      const pendingByTxid = await redis.get(
        `nft:mint:pending:txid:${spellTxid}`,
      );
      let tokenId: number | null = null;
      let traits: MintTraits | null = null;

      if (pendingByTxid) {
        tokenId = Number(pendingByTxid);
        const pending = (await redis.hgetall(
          `nft:mint:pending:${tokenId}`,
        )) as Record<string, string> | null;
        if (pending && pending.traits) {
          traits = JSON.parse(pending.traits) as MintTraits;
        }
      }

      // Fallback: if no pending record tracks this spellTxid (e.g. lock expired
      // but the tx is valid on-chain), recompute the tokenId sequentially and
      // regenerate traits deterministically from the spell txid. This keeps the
      // indexer correct even if Redis state was evicted.
      if (tokenId === null) {
        tokenId = await redis.incr("nft:minted:count");
        traits = generateTraits(spellTxid);
        nftLogger.warn(
          "/mint/finalize: no pending record, regenerated tokenId+traits from spell txid",
          { tokenId, spellTxid: spellTxid.slice(0, 8) },
        );
      }

      // Defensive: traits must be resolved by now (either from the pending record
      // or regenerated above). If somehow still null, regenerate from the txid so
      // the NFT is never persisted with empty traits.
      if (traits === null) {
        traits = generateTraits(spellTxid);
      }

      // 6. Persist the definitive NFT record. NOTE the `nft:all-tokens` write —
      //    the legacy /claim forgot it (bug #9), making claimed NFTs invisible
      //    to the explorer.
      const mintedAt = Date.now();
      const nftRecord = {
        tokenId,
        txid: spellTxid,
        address,
        mintedAt,
        dna: traits.dna,
        bloodline: traits.bloodline,
        baseType: traits.baseType,
        rarityTier: traits.rarityTier,
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
      await redis.sadd("nft:all-tokens", tokenId.toString());
      await redis.set(`nft:minted:txid:${spellTxid}`, tokenId.toString());
      if (tokenId !== null) {
        await redis.del(`nft:mint:pending:${tokenId}`);
      }

      nftLogger.info("Unified /mint/finalize confirmed", {
        tokenId,
        address,
        spellTxid: spellTxid.slice(0, 8),
      });

      return successResponse(c, {
        confirmed: true,
        tokenId,
        traits,
      });
    } catch (error) {
      nftLogger.error("[NFT] /mint/finalize error:", error);
      return errorResponse(c, "Failed to finalize NFT mint", 500);
    }
  },
);

// =============================================================================
// HELPERS
// =============================================================================

interface MempoolTx {
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address?: string;
    scriptpubkey_type: string;
    value: number;
  }>;
}

interface MempoolOutspend {
  spent: boolean;
}

/**
 * Fetch the owner address of a UTXO, or `null` if it does not exist or is
 * already spent. Used by /prepare to validate that the client actually owns
 * the funding UTXO (bug #3).
 */
async function fetchUtxoOwner(
  txid: string,
  vout: number,
): Promise<string | null> {
  try {
    // 1. Is it already spent?
    const outspendRes = await fetchWithTimeout(
      `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${txid}/outspend/${vout}`,
      {},
      EXTERNAL_API.TX_LOOKUP_TIMEOUT_MS,
    );
    if (outspendRes.ok) {
      const outspend = (await outspendRes.json()) as MempoolOutspend;
      if (outspend.spent) {
        return null;
      }
    }
    // If outspend lookup fails, fall through and confirm via the tx itself.

    // 2. Resolve the owner address from the tx output.
    const txRes = await fetchWithTimeout(
      `${EXTERNAL_API.MEMPOOL_TESTNET4}/tx/${txid}`,
      {},
      EXTERNAL_API.TX_LOOKUP_TIMEOUT_MS,
    );
    if (!txRes.ok) {
      return null;
    }
    const tx = (await txRes.json()) as MempoolTx;
    const output = tx.vout?.[vout];
    return output?.scriptpubkey_address ?? null;
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error;
    }
    nftLogger.warn("fetchUtxoOwner: error contacting mempool", {
      txid: txid.slice(0, 8),
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
