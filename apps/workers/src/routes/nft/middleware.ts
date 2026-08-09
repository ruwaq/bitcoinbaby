/**
 * NFT Middleware
 *
 * Shared schemas, constants, and middleware for NFT sub-routers.
 */

import { z } from "zod";
import { fetchWithTimeout, EXTERNAL_API } from "../../lib/helpers";
import { bitcoinAddressSchema } from "../../lib/middleware";

// =============================================================================
// SCHEMAS
// =============================================================================

export const tokenIdParamSchema = z.object({
  tokenId: z.coerce.number().int().positive(),
});

export const addressParamSchema = z.object({
  address: bitcoinAddressSchema,
});

export const reserveNftSchema = z.object({
  address: bitcoinAddressSchema,
});

export const confirmNftSchema = z.object({
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
      heritage: z.number().int().min(0).max(4).optional(),
    })
    .optional(),
});

export const claimNftSchema = z.object({
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  address: bitcoinAddressSchema,
});

export const listNftSchema = z.object({
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

export const buyNftSchema = z.object({
  buyerAddress: bitcoinAddressSchema,
  /** Transaction ID (required for PSBT-based purchases, optional for legacy) */
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/)
    .optional(),
});

export const evolveNftSchema = z.object({
  tokenId: z.number().int().positive(),
  address: bitcoinAddressSchema,
  currentLevel: z.number().int().min(1).max(9).optional(),
});

export const confirmEvolutionSchema = z.object({
  tokenId: z.number().int().positive(),
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  newLevel: z.number().int().min(2).max(10),
  address: bitcoinAddressSchema,
});

export const workProofSchema = z.object({
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

/**
 * NFT UTXO reference for evolution spells. The route fetches the prev_tx hex
 * for this UTXO and adds it to `prev_txs` before proving.
 */
export const nftUtxoSchema = z.object({
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  vout: z.number().int().min(0),
});

/**
 * Optional current-state override. The server reads the canonical state from
 * the indexer (Redis `nft:minted:<tokenId>`), but clients MAY pass the state
 * they observed so the server can cross-check / fail loudly on drift.
 *
 * Mirrors the snake_case `SparkNFTState` shape used by the on-chain contract.
 */
export const sparkNftStateSchema = z.object({
  dna: z.string(),
  bloodline: z.string(),
  base_type: z.string(),
  genesis_block: z.number().int().min(0),
  rarity_tier: z.string(),
  token_id: z.number().int().positive(),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  total_xp: z.number().int().min(0),
  work_count: z.number().int().min(0),
  last_work_block: z.number().int().min(0),
  evolution_count: z.number().int().min(0),
  tokens_earned: z.string(),
  heritage: z.number().int().min(0).max(4),
});

/**
 * POST /api/nft/work/:tokenId — accrue XP via a PoW-verified work spell (op `work`).
 *
 * C3 CLOSURE: the client supplies PoW inputs (challenge, nonce, difficulty,
 * proof hash/blockData); the server validates the proof cryptographically via
 * `validateMiningProof` and derives xp_gain from the verified difficulty. The
 * client NEVER supplies xp_gain — that was the C3 exploit vector (a client with
 * prover access could claim xp_gain = 999_999 and the old work_proof contract
 * accepted it because it didn't re-derive on-chain).
 */
export const workRouteSchema = z.object({
  ownerAddress: bitcoinAddressSchema,
  /** Block height the work was performed against (becomes last_work_block). */
  currentBlock: z.number().int().min(0),
  /** PoW challenge (e.g. "tokenId:blockHeight"). Contract re-hashes this. */
  challenge: z.string().min(1),
  /** Nonce (hex, no 0x prefix) that satisfies the difficulty. */
  nonce: z.string().min(1),
  /** Required leading-zero bits the hash must have. Drives xp_gain derivation. */
  difficulty: z.number().int().min(16),
  /** The PoW hash the client claims (hex, 64 chars). */
  proofHash: z.string().regex(/^[0-9a-fA-F]{64}$/),
  /** blockData for validateMiningProof: "block:address:nonceHex". */
  proofBlockData: z.string().min(1),
  /** Optional proof timestamp (ms) for freshness check. */
  proofTimestamp: z.number().int().optional(),
  /** The NFT UTXO to spend (current location of the NFT coin). */
  nftUtxo: nftUtxoSchema,
  /** Optional client-observed state for cross-checking the indexer. */
  currentState: sparkNftStateSchema.optional(),
});

/**
 * POST /api/nft/evolve/:tokenId — level up the NFT.
 */
export const evolveRouteSchema = z.object({
  ownerAddress: bitcoinAddressSchema,
  /** The NFT UTXO to spend (current location of the NFT coin). */
  nftUtxo: nftUtxoSchema,
  /** Optional client-observed state for cross-checking the indexer. */
  currentState: sparkNftStateSchema.optional(),
});

export const proveNftSchema = z.object({
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
    heritage: z.number().int().min(0).max(4).default(0),
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

export const unlistBodySchema = z.object({
  /** Seller's Bitcoin address */
  sellerAddress: bitcoinAddressSchema,
  /** Unix timestamp (ms) - must be within 5 minutes */
  timestamp: z.number().int().positive(),
  /** Schnorr signature (64 bytes hex) of: unlist:{tokenId}:{timestamp} */
  signature: z
    .string()
    .length(128)
    .regex(/^[a-fA-F0-9]+$/)
    .optional(), // Optional for backward compatibility
  /** x-only public key (32 bytes hex) for signature verification */
  publicKey: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/)
    .optional(),
});

export const explorerQuerySchema = z.object({
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

// =============================================================================
// CONSTANTS
// =============================================================================

export const MAX_SUPPLY = 10_000;

// XP requirements per level (1-21)
export const XP_REQUIREMENTS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 8000,
  9: 16000,
  10: 32000,
  11: 48000,
  12: 64000,
  13: 96000,
  14: 128000,
  15: 192000,
  16: 256000,
  17: 384000,
  18: 512000,
  19: 768000,
  20: 1024000,
};

// Base XP per valid share
export const BASE_XP_PER_SHARE = 100;

// Bloodline XP multipliers
export const BLOODLINE_XP_MULTIPLIERS: Record<string, number> = {
  royal: 1.5,
  warrior: 1.2,
  mystic: 1.3,
  rogue: 1.0,
};

// Minimum difficulty to earn XP
export const MIN_DIFFICULTY_FOR_XP = 16;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * The placeholder NFT_APP_ID shipped before the first mint establishes the real
 * app id on-chain. Kept here so every route that depends on the deployed app
 * (mint /prove, evolution /work, /evolve) can guard identically.
 */
export const PLACEHOLDER_NFT_APP_ID =
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Resolve the NFT app id + verification key from the environment, or return
 * `null` when evolution/minting is unavailable.
 *
 * Returns `{ status: "ok", appId, appVk }` when the app is configured AND not
 * still the placeholder; otherwise returns `{ status: "unavailable", reason }`
 * so the caller can map `reason` to the right HTTP response:
 *   - "missing"      → 503 "NFT minting not available: app not configured"
 *   - "placeholder"  → 503 "NFT minting not available: app ID not yet established"
 */
export function resolveNftAppConfig(env: {
  NFT_APP_ID?: string;
  NFT_APP_VK?: string;
}):
  | { status: "ok"; appId: string; appVk: string }
  | { status: "unavailable"; reason: "missing" | "placeholder" } {
  const appId = env.NFT_APP_ID;
  const appVk = env.NFT_APP_VK;

  if (!appId || !appVk) {
    return { status: "unavailable", reason: "missing" };
  }
  if (appId === PLACEHOLDER_NFT_APP_ID) {
    return { status: "unavailable", reason: "placeholder" };
  }
  return { status: "ok", appId, appVk };
}

/**
 * Check if a UTXO exists (not spent) using mempool.space API
 */
export async function checkUtxoExists(
  txid: string,
  vout: number,
): Promise<boolean> {
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
