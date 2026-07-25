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
  // Spell Format V11 (Current - CLI v11.1.0+)
  SpellV11,
  SpellV11Transaction,
  SpellV11Output,
  SpellV11CoinOutput,
  PoWPrivateInputsV11,
  ProverRequestV11,
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
// TOKEN ($SPARK)
// =============================================================================

export type {
  SPARKMetadata,
  TokenBalance,
  MiningReward,
  TokenMintParams,
  TokenTransferParams,
  // V9 (PoW Direct - primary)
  TokenMintParamsV9,
  // V10 (Merkle Proofs)
  TokenMintParamsV10,
  // V11 (Current - CLI v11.1.0+)
  TokenMintParamsV11,
  TokenTransferParamsV11,
} from "./token";

export {
  // Config
  SPARK_CONFIG,
  SPARK_METADATA,
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
  // Spell Generation (V9 - PoW Direct)
  createSPARKMintSpellV9,
  createSPARKMintSpellV9WithRewards,
  // Spell Generation (V10 - Merkle Proofs)
  createSPARKMintSpellV10,
  createSPARKTransferSpellV10,
  // Spell Generation (V11 - Current, CLI v11.1.0+)
  createSPARKMintSpellV11,
  createSPARKTransferSpellV11,
  addressToScriptPubKeyHex,
  validateAmountForSpell,
} from "./token";

// =============================================================================
// NFT (GENESIS BABIES)
// =============================================================================

export type {
  Bloodline,
  RarityTier,
  BaseType,
  SparkNFTState,
  SparkNFTInfo,
  TraitSet,
  NFTGenesisParams,
  NFTWorkProofParams,
  NFTLevelUpParams,
} from "./nft";

export {
  // Config
  GENESIS_SPARKS_CONFIG,
  XP_REQUIREMENTS,
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

export type { SPARKBalance, BalanceQueryOptions } from "./balance";

export {
  SPARKBalanceService,
  createSPARKBalanceService,
  getSPARKBalance,
  formatSPARKBalance,
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
