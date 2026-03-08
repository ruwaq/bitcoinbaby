/**
 * Testnet4 Configuration
 *
 * Configuration for BABTC deployment on Bitcoin testnet4.
 * Update these values after deploying the BABTC contract.
 *
 * Deployment Steps:
 * 1. Build the Rust contract: packages/bitcoin/contracts/babtc/BUILD.md
 * 2. Deploy to testnet4 using Charms CLI
 * 3. Update BABTC_APP_ID and BABTC_APP_VK below
 * 4. Run E2E tests to verify
 */

import {
  NETWORK_ENDPOINTS,
  toScrollsNetwork as sharedToScrollsNetwork,
  MIN_DIFFICULTY,
  type BitcoinNetwork,
  type ScrollsNetwork,
} from "@bitcoinbaby/shared";

// =============================================================================
// NETWORK ENDPOINTS (re-exported from shared for convenience)
// =============================================================================

/**
 * @deprecated Use NETWORK_ENDPOINTS from @bitcoinbaby/shared instead
 */
export const TESTNET4_ENDPOINTS = {
  /** Mempool.space API for testnet4 */
  mempool: NETWORK_ENDPOINTS.testnet4.mempoolApi,

  /** Block explorer URL */
  explorer: NETWORK_ENDPOINTS.testnet4.explorerUrl,

  /** Scrolls API for Charms indexing */
  scrolls: NETWORK_ENDPOINTS.testnet4.scrollsApi,

  /** Charms Explorer */
  charmsExplorer: "https://explorer.charms.dev",
} as const;

// =============================================================================
// BABTC DEPLOYMENT CONFIG
// =============================================================================

/**
 * BABTC App Configuration
 *
 * STATUS: DEPLOYED on testnet4 (2026-02-18)
 * Genesis UTXO: b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0
 */
export const BABTC_TESTNET4 = {
  /**
   * App ID - SHA256 hash of the genesis UTXO
   * Deployed and verified on testnet4
   */
  appId:
    process.env.NEXT_PUBLIC_BABTC_APP_ID ||
    process.env.BABTC_APP_ID ||
    "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",

  /**
   * Verification Key - SHA256 hash of the WASM binary
   * Generated from compiled contract
   */
  appVk:
    process.env.NEXT_PUBLIC_BABTC_APP_VK ||
    process.env.BABTC_APP_VK ||
    "ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6",

  /** Token ticker */
  ticker: "BABTC",

  /** Token name */
  name: "BitcoinBaby",

  /** Decimal places */
  decimals: 8,

  /** Genesis UTXO that created this app */
  genesisUtxo:
    "b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0",

  /** Deployment block height (approximate) */
  deploymentBlock: 75000,
} as const;

/**
 * Check if BABTC is properly configured for deployment
 */
export function isBABTCConfigured(): boolean {
  return (
    !BABTC_TESTNET4.appId.startsWith("PLACEHOLDER") &&
    !BABTC_TESTNET4.appVk.startsWith("PLACEHOLDER")
  );
}

/**
 * Validate BABTC configuration
 * Throws error if not properly configured
 */
export function requireBABTCConfigured(): void {
  if (!isBABTCConfigured()) {
    throw new Error(
      "BABTC not configured for testnet4. " +
        "Please deploy the contract and set BABTC_APP_ID and BABTC_APP_VK environment variables. " +
        "See packages/bitcoin/contracts/babtc/BUILD.md for instructions.",
    );
  }

  // Validate format
  if (BABTC_TESTNET4.appId.length !== 64) {
    throw new Error(`Invalid BABTC_APP_ID length: expected 64 hex chars`);
  }
  if (BABTC_TESTNET4.appVk.length !== 64) {
    throw new Error(`Invalid BABTC_APP_VK length: expected 64 hex chars`);
  }
}

// =============================================================================
// GENESIS BABIES NFT CONFIG
// =============================================================================

/**
 * Genesis Babies NFT App Configuration
 *
 * NFT collection for BitcoinBaby with mining boosts.
 * Separate from BABTC token - uses 'n' app type instead of 't'.
 */
export const GENESIS_BABIES_TESTNET4 = {
  /**
   * App ID - SHA256 hash of "genesis-babies-testnet4-v1"
   * Deterministic ID for NFT collection on testnet4
   */
  appId:
    process.env.NEXT_PUBLIC_GBABY_APP_ID ||
    process.env.GBABY_APP_ID ||
    // SHA256("genesis-babies-testnet4-v1")
    "6ce41e63fa9a1029e934fd0113e322c292c9de31a4cb10f03f07e0bfc0c6c2cf",

  /**
   * Verification Key - SHA256 hash of "genesis-babies-nft-vk-v1"
   * Deterministic VK for NFT contract logic
   */
  appVk:
    process.env.NEXT_PUBLIC_GBABY_APP_VK ||
    process.env.GBABY_APP_VK ||
    // SHA256("genesis-babies-nft-vk-v1")
    "2e455d2692d118528f5aefd4a32b37ab32de8fb90a8a385f198f0a1da7a43754",

  /** Collection name */
  name: "Genesis Babies",

  /** Collection symbol */
  symbol: "GBABY",

  /** Max supply */
  maxSupply: 10_000,

  /** Price in satoshis */
  priceSats: 50_000n,

  /** Treasury address for NFT sales (testnet4) */
  treasuryAddress:
    "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
} as const;

/**
 * Check if Genesis Babies NFT is configured
 */
export function isGenesisBabiesConfigured(): boolean {
  return (
    GENESIS_BABIES_TESTNET4.appId.length === 64 &&
    GENESIS_BABIES_TESTNET4.appVk.length === 64
  );
}

// =============================================================================
// MINING CONFIG
// =============================================================================

export const MINING_CONFIG_TESTNET4 = {
  /** Minimum PoW difficulty (leading zero bits) - from shared */
  minDifficulty: MIN_DIFFICULTY,

  /** Target share time in seconds */
  targetShareTime: 60,

  /** Minimum UTXO value for mining transactions */
  minUtxoValue: 7000,

  /** Sats for spell output (Charms protocol minimum) */
  spellOutputSats: 700,

  /** Fee buffer percentage */
  feeBufferPercent: 20,
} as const;

// =============================================================================
// NETWORK HELPERS (re-exported from shared)
// =============================================================================

/**
 * Get Scrolls network name from Bitcoin network
 * @deprecated Use toScrollsNetwork from @bitcoinbaby/shared
 */
export const toScrollsNetwork = sharedToScrollsNetwork;

/**
 * Get Bitcoin network from Scrolls network
 */
export function toBitcoinNetwork(network: ScrollsNetwork): BitcoinNetwork {
  return network === "main" ? "mainnet" : "testnet4";
}

// =============================================================================
// DEPLOYMENT STATUS
// =============================================================================

/**
 * Get deployment status for display
 */
export function getDeploymentStatus(): {
  configured: boolean;
  network: string;
  appId: string;
  appVk: string;
  message: string;
} {
  const configured = isBABTCConfigured();

  return {
    configured,
    network: "testnet4",
    appId: configured
      ? BABTC_TESTNET4.appId.substring(0, 16) + "..."
      : "Not configured",
    appVk: configured
      ? BABTC_TESTNET4.appVk.substring(0, 16) + "..."
      : "Not configured",
    message: configured
      ? "BABTC contract deployed and ready"
      : "Deploy BABTC contract to testnet4 to enable mining. See BUILD.md for instructions.",
  };
}
