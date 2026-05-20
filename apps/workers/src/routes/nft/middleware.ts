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

// XP requirements per level
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
};

// Evolution costs in BABTC
export const EVOLUTION_COSTS: Record<number, bigint> = {
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
