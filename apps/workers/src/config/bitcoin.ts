/**
 * Bitcoin Configuration
 *
 * Centralized configuration for Bitcoin network operations.
 */

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

/**
 * Supported Bitcoin networks
 */
export type BitcoinNetwork = "mainnet" | "testnet" | "testnet4";

/**
 * Default network for development (fallback only)
 */
export const DEFAULT_NETWORK: BitcoinNetwork = "testnet4";

/**
 * Get Bitcoin network based on environment
 * CRITICAL: Production MUST use mainnet, development uses testnet4
 */
export function getNetworkForEnvironment(
  environment: string | undefined,
): BitcoinNetwork {
  if (environment === "production") {
    return "mainnet";
  }
  return "testnet4";
}

/**
 * Validate that address matches expected network
 * Throws if mismatch detected (prevents sending to wrong network)
 */
export function validateAddressNetwork(
  address: string,
  expectedNetwork: BitcoinNetwork,
): void {
  const isMainnet = address.startsWith("bc1");
  const isTestnet = address.startsWith("tb1");

  if (expectedNetwork === "mainnet" && !isMainnet) {
    throw new Error(
      `CRITICAL: Expected mainnet address (bc1...) but got testnet address: ${address.slice(0, 10)}...`,
    );
  }

  if (
    (expectedNetwork === "testnet" || expectedNetwork === "testnet4") &&
    !isTestnet
  ) {
    throw new Error(
      `CRITICAL: Expected testnet address (tb1...) but got mainnet address: ${address.slice(0, 10)}...`,
    );
  }
}

/**
 * Mempool.space API URLs by network
 */
export const MEMPOOL_API_URLS: Record<BitcoinNetwork, string> = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
};

/**
 * Block explorer URLs by network
 */
export const EXPLORER_URLS: Record<BitcoinNetwork, string> = {
  mainnet: "https://mempool.space",
  testnet: "https://mempool.space/testnet",
  testnet4: "https://mempool.space/testnet4",
};

// =============================================================================
// CONFIRMATION REQUIREMENTS
// =============================================================================

/**
 * Required confirmations by network
 */
export const REQUIRED_CONFIRMATIONS: Record<BitcoinNetwork, number> = {
  mainnet: 6,
  testnet: 1,
  testnet4: 1,
};

/**
 * Get required confirmations for network
 */
export function getRequiredConfirmations(network: BitcoinNetwork): number {
  return REQUIRED_CONFIRMATIONS[network];
}

// =============================================================================
// FEE ESTIMATION
// =============================================================================

/**
 * Default fee rate in sat/vB (conservative)
 */
export const DEFAULT_FEE_RATE = 5;

/**
 * Conservative fee rate for important transactions
 */
export const CONSERVATIVE_FEE_RATE = 10;

/**
 * Minimum fee rate
 */
export const MIN_FEE_RATE = 1;

/**
 * Maximum fee rate (to prevent accidents)
 */
export const MAX_FEE_RATE = 500;

/**
 * Estimated transaction sizes in vbytes
 */
export const TX_SIZE_ESTIMATES = {
  /** P2TR input */
  P2TR_INPUT: 68,
  /** P2WPKH input */
  P2WPKH_INPUT: 68,
  /** P2TR output */
  P2TR_OUTPUT: 34,
  /** P2WPKH output */
  P2WPKH_OUTPUT: 31,
  /** OP_RETURN output (typical) */
  OP_RETURN_OUTPUT: 40,
  /** Transaction overhead */
  TX_OVERHEAD: 10,
} as const;

/**
 * Estimate claim transaction size
 * 1 input + 1 OP_RETURN + 1 change output
 */
export const CLAIM_TX_SIZE_ESTIMATE =
  TX_SIZE_ESTIMATES.TX_OVERHEAD +
  TX_SIZE_ESTIMATES.P2TR_INPUT +
  TX_SIZE_ESTIMATES.OP_RETURN_OUTPUT +
  TX_SIZE_ESTIMATES.P2TR_OUTPUT;

/**
 * Estimate claim fee in satoshis
 */
export function estimateClaimFee(feeRate: number = DEFAULT_FEE_RATE): number {
  return Math.ceil(CLAIM_TX_SIZE_ESTIMATE * feeRate);
}

// =============================================================================
// MEMPOOL API
// =============================================================================

/**
 * Mempool API request timeout
 */
export const MEMPOOL_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Mempool API max retries
 */
export const MEMPOOL_MAX_RETRIES = 3;

/**
 * Mempool API retry delay
 */
export const MEMPOOL_RETRY_DELAY_MS = 1000;

/**
 * Block height cache TTL (1 minute)
 */
export const BLOCK_HEIGHT_CACHE_TTL_MS = 60_000;

// =============================================================================
// UTXO SELECTION
// =============================================================================

/**
 * Minimum UTXO value for claims (must cover fee + dust)
 */
export const MIN_CLAIM_UTXO_VALUE = 2000;

/**
 * Recommended UTXO value for claims
 */
export const RECOMMENDED_CLAIM_UTXO_VALUE = 5000;

/**
 * Dust limit in satoshis
 */
export const DUST_LIMIT = 546;

// =============================================================================
// ADDRESS VALIDATION
// =============================================================================

/**
 * Bitcoin address prefixes by network
 */
export const ADDRESS_PREFIXES: Record<
  BitcoinNetwork,
  { bech32: string; bech32m: string }
> = {
  mainnet: { bech32: "bc1q", bech32m: "bc1p" },
  testnet: { bech32: "tb1q", bech32m: "tb1p" },
  testnet4: { bech32: "tb1q", bech32m: "tb1p" },
};

/**
 * Check if address is valid for network
 */
export function isValidAddressForNetwork(
  address: string,
  network: BitcoinNetwork,
): boolean {
  const prefixes = ADDRESS_PREFIXES[network];
  return (
    address.startsWith(prefixes.bech32) || address.startsWith(prefixes.bech32m)
  );
}
