/**
 * Charms Module
 *
 * Unified exports for Charms protocol integration.
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Network & Config
  CharmsNetwork,
  CharmsConfig,
  ScrollsConfigResponse,
  // Spell Format V2 (deprecated)
  SpellV2,
  SpellV2Input,
  SpellV2Output,
  // Spell Format V10 (current)
  SpellV10,
  SpellV10Input,
  SpellV10Output,
  Spell,
  SpellInput,
  SpellOutput,
  MiningPrivateInputs,
  MiningMintSpellParams,
  // Common
  AppType,
  AppReference,
  // Charm Data
  ExtractedCharm,
  CharmBalance,
  CharmUTXOInfo,
  // Transactions
  CharmTransactionParams,
  FundingUTXO,
  CharmTransaction,
  ScrollsSignRequest,
  ScrollsSignInput,
  SignedCharmTransaction,
  // Batch Transfer (Withdrawal Pool)
  BatchRecipient,
  BatchTransferParams,
} from "./types";

export {
  // Constants
  DUST_LIMIT,
  CHARMS_PROTOCOL_VERSION,
  MIN_SPELL_OUTPUT_SATS,
  SCROLLS_URLS,
  MEMPOOL_URLS,
  // Utilities
  parseAppReference,
  createAppReference,
  // V10 Spell Builders
  createMiningMintSpellV10,
  createTokenTransferSpellV10,
  createBatchTransferSpellV10,
} from "./types";

// =============================================================================
// TOKEN ($BABTC)
// =============================================================================

export type {
  BABTCMetadata,
  TokenBalance,
  MiningReward,
  TokenMintParams,
  TokenTransferParams,
  TokenMintParamsV10,
} from "./token";

export {
  // Config
  BABTC_CONFIG,
  BABTC_METADATA,
  // Calculations
  getCurrentEpoch,
  calculateBlockReward,
  calculateMiningReward,
  formatTokenAmount,
  parseTokenAmount,
  // Spell Generation (V2 - deprecated)
  createTokenMintSpell,
  createTokenTransferSpell,
  // Spell Generation (V10 - current)
  createBABTCMintSpellV10,
  createBABTCTransferSpellV10,
  validateAmountForSpell,
} from "./token";

// =============================================================================
// NFT (GENESIS BABIES)
// =============================================================================

export type {
  Bloodline,
  RarityTier,
  BaseType,
  BabyNFTState,
  BabyNFTInfo,
  TraitSet,
  NFTGenesisParams,
  NFTWorkProofParams,
  NFTLevelUpParams,
} from "./nft";

export {
  // Config
  GENESIS_BABIES_CONFIG,
  XP_REQUIREMENTS,
  EVOLUTION_COSTS,
  LEVEL_BOOSTS,
  // Calculations
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
  calculateRarityScore,
  // Spell Generation
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
} from "./nft";

// =============================================================================
// CLIENT
// =============================================================================

export type { CharmsClientOptions } from "./client";

export { CharmsClient, CharmsError, createCharmsClient } from "./client";

// =============================================================================
// EVOLUTION SERVICE
// =============================================================================

export type {
  EvolutionServiceOptions,
  EvolutionStatus,
  EvolutionResult,
} from "./evolution";

export {
  EvolutionService,
  EvolutionError,
  createEvolutionService,
} from "./evolution";

// =============================================================================
// BALANCE SERVICE (V10)
// =============================================================================

export type { BABTCBalance, BalanceQueryOptions } from "./balance";

export {
  BABTCBalanceService,
  createBABTCBalanceService,
  getBABTCBalance,
  formatBABTCBalance,
  hasSufficientBalance,
} from "./balance";

// =============================================================================
// NFT SALES (Simple Fixed BTC Pricing)
// =============================================================================

export type {
  PriceTier,
  NFTPriceBreakdown,
  PurchaseValidation,
  NFTPurchaseParams,
  NFTPurchaseOutputs,
  NFTSaleRecord,
  SalesStats,
} from "./nft-sale";

export {
  // Config
  NFT_SALE_CONFIG,
  setTreasuryAddress,
  getTreasuryAddress,
  // Price
  formatSatsPrice,
  getNFTPrice,
  getTierPrice, // Legacy compat
  getTierGuarantee, // Legacy compat
  calculateNFTPrice,
  // Validation & Purchase
  validatePurchase,
  calculatePurchaseOutputs,
  calculateSalesStats,
} from "./nft-sale";
