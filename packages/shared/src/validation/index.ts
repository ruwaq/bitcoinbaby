/**
 * Validation Module
 *
 * @example
 * import {
 *   bitcoinAddressSchema,
 *   miningProofSchema,
 *   validate,
 * } from '@bitcoinbaby/shared/validation';
 *
 * // Validate address
 * const address = validate(bitcoinAddressSchema, userInput);
 *
 * // Validate mining proof
 * const proof = validate(miningProofSchema, proofData);
 */

export {
  // Address schemas
  mainnetAddressSchema,
  testnetAddressSchema,
  bitcoinAddressSchema,
  // Transaction schemas
  txidSchema,
  psbtSchema,
  rawTxSchema,
  // Amount schemas
  satoshiSchema,
  btcAmountSchema,
  feeRateSchema,
  // Mining schemas
  proofHashSchema,
  difficultySchema,
  nonceSchema,
  miningProofSchema,
  type MiningProof,
  // NFT schemas
  dnaSchema,
  bloodlineSchema,
  baseTypeSchema,
  rarityTierSchema,
  tokenIdSchema,
  nftDataSchema,
  type NFTData,
  // Pool schemas
  poolTypeSchema,
  withdrawRequestSchema,
  type PoolType,
  type WithdrawRequest,
  // Leaderboard schemas
  leaderboardCategorySchema,
  leaderboardPeriodSchema,
  type LeaderboardCategory,
  type LeaderboardPeriod,
  // Helpers
  validate,
  safeValidate,
  isValid,
} from "./schemas";

// Re-export Zod for convenience
export { z } from "zod";
