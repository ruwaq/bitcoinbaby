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
  // Spell Format V9 (PoW Direct - CLI 0.11.1)
  SpellV9,
  SpellV9Input,
  SpellV9Output,
  PoWPrivateInputs,
  PoWMintSpellParams,
  // Spell Format V10 (Merkle Proofs)
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
  // V9 Spell Builders (PoW Direct)
  createPoWMintSpellV9,
  // V10 Spell Builders (Merkle Proofs)
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
  // V9 (PoW Direct - primary)
  TokenMintParamsV9,
  // V10 (Merkle Proofs)
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
  calculateRewardForDifficulty,
  getRewardTable,
  formatTokenAmount,
  parseTokenAmount,
  // Spell Generation (V2 - deprecated)
  createTokenMintSpell,
  createTokenTransferSpell,
  // Spell Generation (V9 - PoW Direct, primary)
  createBABTCMintSpellV9,
  createBABTCMintSpellV9WithRewards,
  // Spell Generation (V10 - Merkle Proofs)
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

// =============================================================================
// PROVER CLIENT (Charms Proving Service)
// =============================================================================

export type {
  ProverResponse,
  ProverRequest,
  CharmsProverClientOptions,
} from "./prover";

export {
  CharmsProverClient,
  ProverError,
  createCharmsProverClient,
  getProverUrl,
  getLocalProverUrl,
  getHostedProverUrl,
} from "./prover";

// =============================================================================
// MINTING MANAGER (Complete Minting Flow)
// =============================================================================

export type {
  MintingManagerOptions,
  MiningData,
  MintingStep,
  MintingProgressCallback,
  MintingResult,
  PreparedMintingTxs,
} from "./minting-manager";

export {
  MintingManager,
  MintingError,
  createMintingManager,
} from "./minting-manager";
