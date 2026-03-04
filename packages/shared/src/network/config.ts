/**
 * Centralized Network Configuration
 *
 * Single source of truth for network definitions, endpoints, and mappings.
 * All packages should import network types and utilities from here.
 */

// =============================================================================
// NETWORK TYPES
// =============================================================================

/**
 * All Bitcoin networks that bitcoinjs-lib supports
 */
export type BitcoinJsNetwork = "mainnet" | "testnet" | "regtest";

/**
 * Networks supported by BitcoinBaby
 * Note: testnet4 is Bitcoin's new testnet (2024+), uses same params as testnet
 */
export type SupportedNetwork = "mainnet" | "testnet4";

/**
 * Scrolls API network format
 */
export type ScrollsNetwork = "main" | "testnet4";

/**
 * Extended network type including legacy testnet for backwards compatibility
 */
export type BitcoinNetwork = SupportedNetwork | "testnet" | "regtest";

// =============================================================================
// NETWORK ENDPOINTS
// =============================================================================

export interface NetworkEndpoints {
  /** Mempool.space API URL */
  mempoolApi: string;
  /** Scrolls/Charms API URL */
  scrollsApi: string;
  /** Block explorer URL for transaction links */
  explorerUrl: string;
  /** Faucet URL (testnet only) */
  faucetUrl?: string;
}

/**
 * Network endpoints for each supported network
 */
export const NETWORK_ENDPOINTS: Record<SupportedNetwork, NetworkEndpoints> = {
  mainnet: {
    mempoolApi: "https://mempool.space/api",
    scrollsApi: "https://scrolls.charms.dev",
    explorerUrl: "https://mempool.space",
  },
  testnet4: {
    mempoolApi: "https://mempool.space/testnet4/api",
    scrollsApi: "https://scrolls.charms.dev",
    explorerUrl: "https://mempool.space/testnet4",
    faucetUrl: "https://mempool.space/testnet4/faucet",
  },
};

// =============================================================================
// NETWORK NORMALIZATION
// =============================================================================

/**
 * Normalize any network value to a SupportedNetwork
 *
 * - "testnet" → "testnet4" (legacy support)
 * - "regtest" → "testnet4" (no regtest in production)
 * - "mainnet" → "mainnet"
 * - "testnet4" → "testnet4"
 */
export function normalizeNetwork(network: BitcoinNetwork): SupportedNetwork {
  switch (network) {
    case "mainnet":
      return "mainnet";
    case "testnet":
    case "testnet4":
    case "regtest":
      return "testnet4";
    default:
      // Type guard for exhaustiveness
      const _exhaustive: never = network;
      return "testnet4";
  }
}

/**
 * Convert to Scrolls API network format
 */
export function toScrollsNetwork(network: BitcoinNetwork): ScrollsNetwork {
  return normalizeNetwork(network) === "mainnet" ? "main" : "testnet4";
}

/**
 * Convert to bitcoinjs-lib network format
 * Note: bitcoinjs-lib uses "testnet" for testnet4 (same network params)
 */
export function toBitcoinJsNetwork(network: BitcoinNetwork): BitcoinJsNetwork {
  const normalized = normalizeNetwork(network);
  return normalized === "mainnet" ? "mainnet" : "testnet";
}

/**
 * Get endpoints for a network
 */
export function getNetworkEndpoints(network: BitcoinNetwork): NetworkEndpoints {
  return NETWORK_ENDPOINTS[normalizeNetwork(network)];
}

/**
 * Get mempool API URL for a network
 */
export function getMempoolApiUrl(network: BitcoinNetwork): string {
  return getNetworkEndpoints(network).mempoolApi;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(
  network: BitcoinNetwork,
  txid: string,
): string {
  const endpoints = getNetworkEndpoints(network);
  return `${endpoints.explorerUrl}/tx/${txid}`;
}

/**
 * Get explorer URL for an address
 */
export function getExplorerAddressUrl(
  network: BitcoinNetwork,
  address: string,
): string {
  const endpoints = getNetworkEndpoints(network);
  return `${endpoints.explorerUrl}/address/${address}`;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if a string is a valid network
 */
export function isValidNetwork(network: unknown): network is BitcoinNetwork {
  return (
    typeof network === "string" &&
    ["mainnet", "testnet", "testnet4", "regtest"].includes(network)
  );
}

/**
 * Check if network is a testnet (any variation)
 */
export function isTestnet(network: BitcoinNetwork): boolean {
  return normalizeNetwork(network) === "testnet4";
}

/**
 * Check if network is mainnet
 */
export function isMainnet(network: BitcoinNetwork): boolean {
  return normalizeNetwork(network) === "mainnet";
}

// =============================================================================
// DEFAULT CONFIGURATION
// =============================================================================

/**
 * Default network for the application
 * Using testnet4 for safety during development
 */
export const DEFAULT_NETWORK: SupportedNetwork = "testnet4";

/**
 * Environment-based network selection
 */
export function getDefaultNetwork(): SupportedNetwork {
  // Check environment variable
  const envNetwork =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_NETWORK || process.env.BITCOIN_NETWORK
      : undefined;

  if (envNetwork && isValidNetwork(envNetwork)) {
    return normalizeNetwork(envNetwork);
  }

  return DEFAULT_NETWORK;
}
