/**
 * NFT Module
 *
 * Complete NFT minting and management for Genesis Babies.
 *
 * NOTE: For minting, use `useNFTMinting` from `@bitcoinbaby/core` which
 * uses the correct Charms witness data format.
 */

// Re-export NFT types from charms
export type {
  BabyNFTState,
  BabyNFTInfo,
  Bloodline,
  BaseType,
  RarityTier,
} from "../charms/nft";

export {
  GENESIS_BABIES_CONFIG,
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
} from "../charms/nft";

// Re-export sale types
export {
  NFT_SALE_CONFIG,
  getTreasuryAddress,
  setTreasuryAddress,
  calculateNFTPrice,
  validatePurchase,
  formatSatsPrice,
} from "../charms/nft-sale";

// Re-export config
export {
  GENESIS_BABIES_TESTNET4,
  isGenesisBabiesConfigured,
} from "../config/testnet4";

// Validation utilities
export {
  validateAddress,
  validateDNA,
  validateUTXOs,
  validateTreasury,
  validateAmounts,
  validateMintRequest,
  checkRateLimit,
  recordMintAttempt,
  clearRateLimit,
  type ValidationResult,
  type MintValidationParams,
} from "./validation";
