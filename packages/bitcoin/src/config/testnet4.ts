/**
 * Testnet4 Configuration
 *
 * Configuration for SPARK deployment on Bitcoin testnet4.
 * Update these values after deploying the SPARK contract.
 *
 * Deployment Steps:
 * 1. Build the Rust contract: packages/bitcoin/contracts/babtc/BUILD.md
 * 2. Deploy to testnet4 using Charms CLI
 * 3. Update SPARK_APP_ID and SPARK_APP_VK below
 * 4. Run E2E tests to verify
 */

import {
  NETWORK_ENDPOINTS,
  toScrollsNetwork as sharedToScrollsNetwork,
  MIN_DIFFICULTY,
  type BitcoinNetwork,
  type ScrollsNetwork,
} from "@bitcoinbaby/shared";
import type { SupportedNetwork } from "../types";

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
// SPARK DEPLOYMENT CONFIG
// =============================================================================
//
// This file is the SINGLE SOURCE OF TRUTH for the SPARK_TESTNET4 deployment
// data (appId, appVk, genesisUtxo). The companion file `deployment.ts` adds
// multi-network helpers (getDeploymentConfig / isDeploymentReady / ...) but it
// re-uses the SPARK_TESTNET4 constant defined here instead of redefining it.
//
// Placeholder detection is string-prefix based (see `isSPARKConfigured`) so it
// cannot drift the way a hand-maintained `isPlaceholder` boolean would.

/** Placeholder markers that mark an appId/appVk as "not yet deployed". */
const PLACEHOLDER_MARKERS = ["PLACEHOLDER", "not_deployed", ""];

/**
 * A minimal shape that {@link isSPARKConfigured} can inspect. Any config object
 * with `appId` / `appVk` strings (real or placeholder) satisfies this.
 */
export interface SparkConfigLike {
  appId: string;
  appVk: string;
}

/**
 * SPARK App Configuration
 *
 * STATUS: DEPLOYED on testnet4 (2026-02-18)
 * Genesis UTXO: b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0
 */
export const SPARK_TESTNET4 = {
  /**
   * App ID - SHA256 hash of the genesis UTXO
   * Deployed and verified on testnet4
   */
  appId:
    process.env.NEXT_PUBLIC_SPARK_APP_ID ||
    process.env.SPARK_APP_ID ||
    "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",

  /**
   * Verification Key - SHA256 hash of the WASM binary
   * Generated with: charms app vk ./target/wasm32-wasip1/release/babtc-contract.wasm
   * Updated: 2026-03-05 (synced with deployment.ts)
   */
  appVk:
    process.env.NEXT_PUBLIC_SPARK_APP_VK ||
    process.env.SPARK_APP_VK ||
    "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d",

  /** Token ticker */
  ticker: "SPARK",

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
 * Check whether a SPARK config is properly deployed (not a placeholder).
 *
 * Uses string-prefix detection against known placeholder markers so it stays
 * correct without maintaining a manual `isPlaceholder` boolean. With no
 * argument it inspects {@link SPARK_TESTNET4} (preserving the existing
 * call-site contract).
 */
export function isSPARKConfigured(
  config: SparkConfigLike = SPARK_TESTNET4,
): boolean {
  return (
    !isPlaceholderValue(config.appId) &&
    !isPlaceholderValue(config.appVk) &&
    config.appId.length === 64 &&
    config.appVk.length === 64
  );
}

/**
 * True if a value is a known placeholder marker (empty, "PLACEHOLDER...",
 * "not_deployed") or all-zero hex (a sentinel for "unset").
 */
function isPlaceholderValue(value: string): boolean {
  const trimmed = value.trim();
  if (PLACEHOLDER_MARKERS.includes(trimmed)) return true;
  if (value.startsWith("PLACEHOLDER") || value.startsWith("not_deployed")) {
    return true;
  }
  // All-zero hex (64 chars of '0') is treated as an unset sentinel.
  if (/^0+$/.test(trimmed)) return true;
  return false;
}

/**
 * Validate SPARK configuration
 * Throws error if not properly configured
 */
export function requireSPARKConfigured(): void {
  if (!isSPARKConfigured()) {
    throw new Error(
      "SPARK not configured for testnet4. " +
        "Please deploy the contract and set SPARK_APP_ID and SPARK_APP_VK environment variables. " +
        "See packages/bitcoin/contracts/babtc/BUILD.md for instructions.",
    );
  }

  // Validate format
  if (SPARK_TESTNET4.appId.length !== 64) {
    throw new Error(`Invalid SPARK_APP_ID length: expected 64 hex chars`);
  }
  if (SPARK_TESTNET4.appVk.length !== 64) {
    throw new Error(`Invalid SPARK_APP_VK length: expected 64 hex chars`);
  }
}

// =============================================================================
// GENESIS BABIES NFT CONFIG
// =============================================================================

/**
 * Genesis Sparks NFT App Configuration
 *
 * NFT collection for BitcoinBaby with mining boosts.
 * Separate from SPARK token - uses 'n' app type instead of 't'.
 */
export const GENESIS_SPARKS_TESTNET4 = {
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
  name: "Genesis Sparks",

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
 * Mainnet Genesis Sparks NFT App Configuration
 *
 * STATUS: NOT DEPLOYED
 * WARNING: Deploy to mainnet only after thorough testnet4 testing
 */
export const GENESIS_SPARKS_MAINNET = {
  network: "mainnet" as const,
  appId: "not_deployed",
  appVk: "not_deployed",
  name: "Genesis Sparks",
  symbol: "GBABY",
  maxSupply: 10_000,
  priceSats: 50_000n,
  treasuryAddress: "",
  isPlaceholder: true,
} as const;

/**
 * Regtest Genesis Sparks NFT App Configuration
 *
 * STATUS: DEPLOYED locally for development.
 */
export const GENESIS_SPARKS_REGTEST = {
  network: "regtest" as const,
  appId: "6ce41e63fa9a1029e934fd0113e322c292c9de31a4cb10f03f07e0bfc0c6c2cf",
  appVk: "2e455d2692d118528f5aefd4a32b37ab32de8fb90a8a385f198f0a1da7a43754",
  name: "Genesis Sparks",
  symbol: "GBABY",
  maxSupply: 10_000,
  priceSats: 50_000n,
  treasuryAddress:
    "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu",
  isPlaceholder: false,
} as const;

/**
 * Get Genesis Sparks config for a network
 */
export function getGenesisBabiesConfig(network: SupportedNetwork = "testnet4") {
  if (network === "mainnet") return GENESIS_SPARKS_MAINNET;
  if (network === "regtest") return GENESIS_SPARKS_REGTEST;
  return GENESIS_SPARKS_TESTNET4;
}

/**
 * Check if Genesis Sparks NFT is configured
 */
export function isGenesisBabiesConfigured(): boolean {
  return (
    GENESIS_SPARKS_TESTNET4.appId.length === 64 &&
    GENESIS_SPARKS_TESTNET4.appVk.length === 64
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
  const configured = isSPARKConfigured();

  return {
    configured,
    network: "testnet4",
    appId: configured
      ? SPARK_TESTNET4.appId.substring(0, 16) + "..."
      : "Not configured",
    appVk: configured
      ? SPARK_TESTNET4.appVk.substring(0, 16) + "..."
      : "Not configured",
    message: configured
      ? "SPARK contract deployed and ready"
      : "Deploy SPARK contract to testnet4 to enable mining. See BUILD.md for instructions.",
  };
}
