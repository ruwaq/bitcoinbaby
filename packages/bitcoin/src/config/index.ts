/**
 * Configuration Module
 *
 * Network configuration and deployment settings.
 */

export {
  // Endpoints
  TESTNET4_ENDPOINTS,
  // BABTC Config
  BABTC_TESTNET4,
  isBABTCConfigured,
  requireBABTCConfigured,
  // Genesis Babies NFT Config
  GENESIS_BABIES_TESTNET4,
  GENESIS_BABIES_MAINNET,
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
  BABTC_TESTNET4 as BABTC_DEPLOY_CONFIG,
  BABTC_MAINNET as BABTC_DEPLOY_MAINNET,
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
