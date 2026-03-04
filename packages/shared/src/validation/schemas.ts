/**
 * Zod Validation Schemas
 *
 * Centralized validation schemas for all Bitcoin-related types.
 */

import { z } from "zod";

// =============================================================================
// BITCOIN ADDRESS SCHEMAS
// =============================================================================

/**
 * Bitcoin mainnet address (P2WPKH, P2TR, P2PKH, P2SH)
 */
export const mainnetAddressSchema = z.string().refine(
  (addr) => {
    // P2WPKH (native segwit)
    if (/^bc1q[a-z0-9]{38,58}$/.test(addr)) return true;
    // P2TR (taproot)
    if (/^bc1p[a-z0-9]{58}$/.test(addr)) return true;
    // P2PKH (legacy)
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) return true;
    return false;
  },
  { message: "Invalid mainnet Bitcoin address" },
);

/**
 * Bitcoin testnet address (tb1 prefix)
 */
export const testnetAddressSchema = z.string().refine(
  (addr) => {
    // P2WPKH (native segwit)
    if (/^tb1q[a-z0-9]{38,58}$/.test(addr)) return true;
    // P2TR (taproot)
    if (/^tb1p[a-z0-9]{58}$/.test(addr)) return true;
    // P2PKH (legacy testnet)
    if (/^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) return true;
    return false;
  },
  { message: "Invalid testnet Bitcoin address" },
);

/**
 * Any valid Bitcoin address (mainnet or testnet)
 */
export const bitcoinAddressSchema = z.string().refine(
  (addr) => {
    return (
      mainnetAddressSchema.safeParse(addr).success ||
      testnetAddressSchema.safeParse(addr).success
    );
  },
  { message: "Invalid Bitcoin address" },
);

// =============================================================================
// TRANSACTION SCHEMAS
// =============================================================================

/**
 * Bitcoin transaction ID (64 hex characters)
 */
export const txidSchema = z
  .string()
  .length(64, "Transaction ID must be 64 characters")
  .regex(/^[a-fA-F0-9]+$/, "Transaction ID must be hexadecimal");

/**
 * PSBT (Partially Signed Bitcoin Transaction) in base64
 */
export const psbtSchema = z
  .string()
  .regex(/^cHNi[A-Za-z0-9+/=]+$/, "Invalid PSBT format");

/**
 * Raw transaction hex
 */
export const rawTxSchema = z
  .string()
  .min(20)
  .regex(/^[a-fA-F0-9]+$/, "Transaction must be hexadecimal");

// =============================================================================
// AMOUNT SCHEMAS
// =============================================================================

/**
 * Satoshi amount (positive integer)
 */
export const satoshiSchema = z.union([
  z.number().int().min(0, "Amount must be non-negative"),
  z.bigint().refine((n) => n >= 0n, "Amount must be non-negative"),
  z.string().regex(/^\d+$/, "Amount must be numeric").transform(BigInt),
]);

/**
 * BTC amount (decimal string)
 */
export const btcAmountSchema = z
  .string()
  .regex(/^\d+(\.\d{1,8})?$/, "Invalid BTC amount format")
  .transform((val) => BigInt(Math.round(parseFloat(val) * 100_000_000)));

/**
 * Fee rate in sat/vB
 */
export const feeRateSchema = z
  .number()
  .min(1, "Fee rate must be at least 1 sat/vB")
  .max(10000, "Fee rate seems too high");

// =============================================================================
// MINING SCHEMAS
// =============================================================================

/**
 * Mining proof hash (64 hex characters)
 */
export const proofHashSchema = z
  .string()
  .length(64, "Proof hash must be 64 characters")
  .regex(/^[a-fA-F0-9]+$/, "Proof hash must be hexadecimal");

/**
 * Mining difficulty (16-32 bits)
 */
export const difficultySchema = z
  .number()
  .int()
  .min(16, "Difficulty must be at least 16")
  .max(32, "Difficulty must be at most 32");

/**
 * Mining nonce
 */
export const nonceSchema = z.number().int().min(0);

/**
 * Mining proof object
 */
export const miningProofSchema = z.object({
  hash: proofHashSchema,
  nonce: nonceSchema,
  difficulty: difficultySchema,
  blockData: z.string().min(1, "Block data is required"),
  timestamp: z.number().int().positive().optional(),
});

export type MiningProof = z.infer<typeof miningProofSchema>;

// =============================================================================
// NFT SCHEMAS
// =============================================================================

/**
 * NFT DNA (64 hex characters)
 */
export const dnaSchema = z
  .string()
  .length(64, "DNA must be 64 characters")
  .regex(/^[a-fA-F0-9]+$/, "DNA must be hexadecimal");

/**
 * NFT bloodline
 */
export const bloodlineSchema = z.enum(["royal", "warrior", "rogue", "mystic"]);

/**
 * NFT base type
 */
export const baseTypeSchema = z.enum([
  "human",
  "animal",
  "robot",
  "mystic",
  "alien",
]);

/**
 * NFT rarity tier
 */
export const rarityTierSchema = z.enum([
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
  "mythic",
]);

/**
 * NFT token ID (positive integer)
 */
export const tokenIdSchema = z
  .number()
  .int()
  .positive("Token ID must be positive");

/**
 * Full NFT data schema
 */
export const nftDataSchema = z.object({
  tokenId: tokenIdSchema,
  dna: dnaSchema,
  bloodline: bloodlineSchema,
  baseType: baseTypeSchema,
  rarityTier: rarityTierSchema,
  level: z.number().int().min(1).max(100),
  xp: z.number().int().min(0),
  totalXp: z.number().int().min(0),
  workCount: z.number().int().min(0),
  evolutionCount: z.number().int().min(0),
});

export type NFTData = z.infer<typeof nftDataSchema>;

// =============================================================================
// POOL SCHEMAS
// =============================================================================

/**
 * Withdrawal pool type
 */
export const poolTypeSchema = z.enum([
  "weekly",
  "monthly",
  "low_fee",
  "immediate",
]);

export type PoolType = z.infer<typeof poolTypeSchema>;

/**
 * Withdrawal request
 */
export const withdrawRequestSchema = z.object({
  fromAddress: bitcoinAddressSchema,
  toAddress: bitcoinAddressSchema,
  amount: satoshiSchema,
  maxFeeRate: feeRateSchema.optional(),
});

export type WithdrawRequest = z.infer<typeof withdrawRequestSchema>;

// =============================================================================
// LEADERBOARD SCHEMAS
// =============================================================================

/**
 * Leaderboard category
 */
export const leaderboardCategorySchema = z.enum([
  "miners",
  "babies",
  "earners",
]);

export type LeaderboardCategory = z.infer<typeof leaderboardCategorySchema>;

/**
 * Leaderboard period
 */
export const leaderboardPeriodSchema = z.enum(["daily", "weekly", "alltime"]);

export type LeaderboardPeriod = z.infer<typeof leaderboardPeriodSchema>;

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Validate and parse data with a schema
 *
 * @throws {ValidationError} if validation fails
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const errors = result.error.flatten();
    throw new Error(`Validation failed: ${JSON.stringify(errors.fieldErrors)}`);
  }

  return result.data;
}

/**
 * Safe validation that returns null on failure
 */
export function safeValidate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}

/**
 * Check if data matches schema
 */
export function isValid<T>(schema: z.ZodSchema<T>, data: unknown): boolean {
  return schema.safeParse(data).success;
}
