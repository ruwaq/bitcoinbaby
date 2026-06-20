/**
 * Configuration Module
 *
 * Network configuration and deployment settings.
 */

export {
  // Endpoints
  TESTNET4_ENDPOINTS,
  // SPARK Config
  SPARK_TESTNET4,
  isSPARKConfigured,
  requireSPARKConfigured,
  // Genesis Sparks NFT Config
  GENESIS_SPARKS_TESTNET4,
  GENESIS_SPARKS_MAINNET,
  getGenesisBabiesConfig,
  isGenesisBabiesConfigured,
  // Mining Config
  MINING_CONFIG_TESTNET4,
  // Network Helpers
  toScrollsNetwork,
  toBitcoinNetwork,
  // Status
  getDeploymentStatus,
} from "./testnet4";

export {
  // Deployment Config
  type DeploymentConfig,
  SPARK_TESTNET4 as SPARK_DEPLOY_CONFIG,
  SPARK_MAINNET as SPARK_DEPLOY_MAINNET,
  getDeploymentConfig,
  isDeploymentReady,
  validateDeployment,
} from "./deployment";

export {
  // Treasury (NFT Sales)
  NFT_TREASURY_TESTNET4,
  NFT_TREASURY_MAINNET,
  getNFTTreasuryAddress,
} from "./treasury";
