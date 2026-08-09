/**
 * @bitcoinbaby/bitcoin
 *
 * Bitcoin wallet and transaction utilities.
 * Built on bitcoinjs-lib with Charms protocol support.
 */

// Types
export * from "./types";

// Errors
export * from "./errors";

// Validation - canonical validators using bitcoinjs-lib
export {
  ValidationError,
  validateAddress, // Uses bitcoinjs-lib for cryptographic validation
  validateTxid,
  validateHash,
  validateTxHex,
  validateSatoshis,
  validateDifficulty,
  validateNonce,
  validateTimestamp,
  isHex,
  isHexBytes,
  requireValidAddress,
  requireValidTxid,
  requireValidHash,
} from "./validation";

// Crypto utilities
export {
  randomBytes,
  secureErase,
  sha256,
  hash256,
  hexToBytes,
  bytesToHex,
  getPublicKey,
  signSchnorr,
  verifySchnorr,
} from "./crypto";

// JSON utilities (BigInt-safe serialization)
export {
  stringifyWithBigInt,
  parseWithBigInt,
  safeStringify,
  bigIntReplacer,
  bigIntReviver,
} from "./utils";

// Wallet
export {
  BitcoinWallet,
  // validateAddress removed - use the canonical one from validation.ts
  getAddressType,
  formatAddress,
  satsToBtc,
  btcToSats,
  generateMnemonicFromEntropy,
  validateMnemonic,
  generateRandomMnemonic,
} from "./wallet";

// Charms Protocol (v2 + v10 + v11)
export {
  // Types V2 (legacy)
  type CharmsNetwork,
  type SpellV2,
  type SpellV2Input,
  type SpellV2Output,
  // Types V10
  type SpellV10,
  type SpellV10Input,
  type SpellV10Output,
  type Spell,
  type MiningPrivateInputs,
  type MiningMintSpellParams,
  type AppType,
  type ExtractedCharm,
  type CharmBalance,
  type ScrollsConfigResponse,
  // Types V11 (current)
  type SpellV11,
  type SpellV11Output,
  type SpellV11CoinOutput,
  type SpellV11Transaction,
  type PoWPrivateInputsV11,
  type ProverRequestV11,
  // Constants
  DUST_LIMIT,
  CHARMS_PROTOCOL_VERSION,
  MIN_SPELL_OUTPUT_SATS,
  SCROLLS_URLS,
  MEMPOOL_URLS,
  // Utilities
  parseAppReference,
  createAppReference,
  createMiningMintSpellV10,
  createTokenTransferSpellV10,
  // Token ($SPARK)
  type SPARKMetadata,
  type TokenBalance as CharmsTokenBalance,
  type MiningReward,
  type MiningRewardBro,
  type TokenMintParamsV10,
  type TokenMintParamsV11,
  SPARK_CONFIG,
  SPARK_METADATA,
  getCurrentEpoch,
  calculateBlockReward,
  calculateMiningReward,
  calculateMiningRewardBro,
  calculateRewardForDifficulty,
  getRewardTable,
  formatTokenAmount,
  parseTokenAmount,
  createTokenMintSpell,
  createTokenTransferSpell,
  createSPARKMintSpellV10,
  createSPARKTransferSpellV10,
  createSPARKMintSpellV11,
  createSPARKTransferSpellV11,
  addressToScriptPubKeyHex,
  validateAmountForSpell,
  // Batch Transfer (Withdrawal Pool)
  type BatchRecipient,
  type BatchTransferParams,
  createBatchTransferSpellV10,
  // Balance Service
  type SPARKBalance,
  type BalanceQueryOptions,
  SPARKBalanceService,
  createSPARKBalanceService,
  getSPARKBalance,
  formatSPARKBalance,
  hasSufficientBalance,
  // NFT (Genesis Sparks)
  type Bloodline,
  type RarityTier,
  type BaseType,
  type SparkNFTState,
  type SparkNFTInfo,
  GENESIS_SPARKS_CONFIG,
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  getMiningBoost,
  canLevelUp,
  calculateXpGain,
  getTraitsFromDNA,
  createNFTGenesisSpell,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
  // NFT Sales (Simple Fixed BTC Pricing)
  type PriceTier,
  type NFTPriceBreakdown,
  type PurchaseValidation,
  type NFTPurchaseParams,
  type NFTPurchaseOutputs,
  type NFTSaleRecord,
  type SalesStats,
  NFT_SALE_CONFIG,
  setTreasuryAddress,
  getTreasuryAddress,
  formatSatsPrice,
  getNFTPrice,
  getTierPrice,
  getTierGuarantee,
  calculateNFTPrice,
  validatePurchase,
  calculatePurchaseOutputs,
  calculateSalesStats,
  // Client
  type CharmsClientOptions,
  CharmsClient,
  CharmsError,
  createCharmsClient,
  // Evolution Service
  type EvolutionServiceOptions,
  type EvolutionStatus,
  type EvolutionResult,
  EvolutionService,
  EvolutionError,
  createEvolutionService,
  // Prover Client (Charms Proving Service)
  type ProverResponse,
  type ProverRequest,
  type CharmsProverClientOptions,
  CharmsProverClient,
  ProverError,
  createCharmsProverClient,
  getProverUrl,
  // Minting Manager (Complete Minting Flow)
  type MintingManagerOptions,
  type MiningData,
  type MintingStep,
  type MintingProgressCallback,
  type MintingResult,
  type PreparedMintingTxs,
  MintingManager,
  MintingError,
  createMintingManager,
} from "./charms/index";

// Canonical BRO reward formula (single source of truth for off-chain rewards).
export {
  minedAmountBro,
  BRO_DENOMINATION,
  SPARK_START_TIME,
  BRO_HALVING_PERIOD_SECONDS,
} from "./charms/bro-reward";

// Scrolls API & Charms Service (signing only)
export {
  // Client
  ScrollsClient,
  ScrollsAPIError,
  createScrollsClient,
  type ScrollsClientOptions,
  // Service
  CharmsService,
  createCharmsService,
  type CharmsServiceOptions,
  // Types
  type ScrollsNetwork,
  type ScrollsConfig,
  type SignInput,
  type SignRequest,
  type FeeCalculation,
  type CharmToken,
  type CharmUTXO,
  type SpellConfig,
  type SpellInput,
  type SpellOutput,
  type TokenBalance,
  type AddressTokenBalances,
  type TokenUTXO,
} from "./scrolls";

// Charms Explorer API (balances & UTXOs)
export {
  CharmsExplorerClient,
  ExplorerAPIError,
  createExplorerClient,
  getExplorerClient,
  type ExplorerClientOptions,
  type ExplorerNetwork,
  type CharmBalance as ExplorerCharmBalance,
  type CharmUTXO as ExplorerCharmUTXO,
  type WalletCharmsResponse,
  type WalletUTXOsResponse,
} from "./explorer";

// Blockchain API (Mempool.space)
export {
  MempoolClient,
  MempoolAPIError,
  createMempoolClient,
  type MempoolClientOptions,
  type UTXO,
  type AddressBalance,
  type TransactionInfo,
  type FeeEstimates,
  type BlockchainAPI,
  type BlockInfo,
  // Merkle Proofs (V10)
  type MerkleProof,
  type BlockHeader,
  type EncodedMerkleProof,
  doubleSha256,
  reverseHex,
  buildMerkleTree,
  extractMerklePath,
  verifyMerkleProof,
  getMerkleProof,
  encodeMerkleProofHex,
  getEncodedMerkleProof,
  countLeadingZeroBits,
  computeMiningHash,
  calculateMerkleReward,
} from "./blockchain";

// Mining integration
export {
  MiningSubmitter,
  createMiningSubmitter,
  type MiningSubmitterOptions,
  type MiningSubmission,
  type SubmissionStatus,
  type SubmissionResult,
  type MiningProof,
  type RewardParams,
  // V10 Mining Flow
  type SubmissionResultV10,
} from "./mining";

// Configuration (Testnet4)
export {
  TESTNET4_ENDPOINTS,
  SPARK_TESTNET4,
  isSPARKConfigured,
  requireSPARKConfigured,
  MINING_CONFIG_TESTNET4,
  toScrollsNetwork,
  toBitcoinNetwork,
  getDeploymentStatus,
  // Deployment
  type DeploymentConfig,
  getDeploymentConfig,
  isDeploymentReady,
  validateDeployment,
} from "./config";

// Re-export bitcoinjs-lib Psbt for PSBT handling
export { Psbt } from "bitcoinjs-lib";

// NFT Config
export {
  GENESIS_SPARKS_TESTNET4,
  GENESIS_SPARKS_MAINNET,
  getGenesisBabiesConfig,
  isGenesisBabiesConfigured,
} from "./config/testnet4";

// Transactions
export {
  // Builder
  TransactionBuilder,
  createTransactionBuilder,
  estimateFee,
  // Spell Encoder
  encodeSpellForWitness,
  decodeSpellFromWitness,
  createSpellOpReturn,
  calculateSpellSize,
  validateSpell,
  // PSBT Utilities
  rawTxToPsbt,
  type FundingUtxo,
  // Types
  type TxUTXO,
  type TxInput,
  type TxOutput,
  type UnsignedTx,
  type SignedTx,
  type CharmsTx,
  type MiningTx,
  type TxBuilderOptions,
  type CoinSelection,
  type FeeEstimate,
  type BroadcastResult,
} from "./transactions";

// Wallet Providers
export {
  // Types
  type WalletProviderType,
  type WalletAccount,
  type WalletConnectionState,
  type SignedMessage,
  type SignedPsbt,
  type BroadcastResult as ProviderBroadcastResult,
  type ProviderCapabilities,
  type WalletProvider,
  type ConnectOptions,
  type SignPsbtOptions,
  type DetectedProvider,
  type ProviderRegistry,
  // Providers
  InternalWalletProvider,
  createInternalProvider,
  type InternalProviderOptions,
  UnisatProvider,
  createUnisatProvider,
  XVerseProvider,
  createXVerseProvider,
  // Registry
  getProviderRegistry,
  createProviderRegistry,
  detectWallets,
  getProvider,
  getAvailableProviders,
  hasAvailableWallet,
  getBestProvider,
  // Dev Fund (local testing)
  DevFundProvider,
  getDevFundProvider,
  isDevFundEnabled,
  enableDevFund,
  disableDevFund,
  DEV_FUND,
} from "./providers";

// Marketplace (PSBT-based NFT Trading)
export {
  // Types
  type MarketplaceListing,
  type CreateListingParams,
  type CreateListingResult,
  type CompletePurchaseParams,
  type CompletePurchaseResult,
  type SaleRecord,
  type PurchaseFeeBreakdown,
  // Config
  MARKETPLACE_CONFIG,
  type MarketplaceConfig,
  getRoyaltyAddress,
  getMarketplaceFeeAddress,
  calculateRoyalty,
  calculateBuyerFee,
  calculateSellerFee,
  calculateSellerReceives,
  calculateBuyerTotalCost,
  validateListingPrice,
  isListingExpired,
  calculateExpirationTime,
  // Service
  ListingService,
  ListingError,
  createListingService,
  validateListingSighash,
  type ListingServiceOptions,
} from "./marketplace";

// Treasury Signer (External signing service)
export {
  TreasurySigner,
  createTreasurySigner,
  startTreasurySignerDaemon,
  type SignerConfig,
  type ReadyBatch,
  type SigningResult,
} from "./signer";

// Inscription System (Genesis Sparks NFTs on Bitcoin)
export {
  // PNG Exporter
  exportSVGtoPNG,
  exportSpriteSheet,
  svgToCanvas,
  generateManifest,
  type PNGExportOptions,
  type ExportResult,
  type SpriteComponent,
  type SpriteManifest,
  // Sprite Library
  GENESIS_SPARKS_LIBRARY,
  parseDNA as parseInscriptionDNA,
  getRarityFromScore,
  getBaseTypeFromIndex,
  getBloodlineFromIndex,
  buildSpriteLibrary,
  generateLibraryInscription,
  type SpriteLibrary,
  type SpriteCategory,
  type SpriteComponentDef,
  type ColorPaletteDef,
  type LayerRule,
  type DNAMapping,
  type BuildResult,
  type BuildStats,
  // On-Chain Renderer
  generateOnChainRenderer,
  minifyRenderer,
  generateRendererInscription,
  generateNFTMetadata,
  generateMinimalNFTInscription,
  // Inscription Builder
  createInscriptionEnvelope,
  estimateInscriptionFee,
  estimateCostUSD,
  generateInscriptionPlan,
  generateNFTInscriptionData,
  buildCommitTransaction,
  buildRevealTransaction,
  getDeploymentSummary,
  INSCRIPTION_ORDER,
  type InscriptionData,
  type InscriptionResult,
  type InscriptionConfig,
  type BatchInscriptionPlan,
} from "./inscription";
