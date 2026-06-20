/**
 * Treasury Configuration
 *
 * Addresses for receiving payments and holding tokens.
 * These are separate from BitcoinBaby operational wallets.
 *
 * Treasury Types:
 * - NFT Treasury: Receives NFT sale payments (BTC)
 * - SPARK Treasury: Holds SPARK tokens for batch withdrawals
 */

// =============================================================================
// SPARK TOKEN TREASURY (Testnet4)
// =============================================================================

/**
 * SPARK Token Treasury Address
 *
 * Holds SPARK tokens that are distributed to users on withdraw.
 * Must be pre-funded with tokens via initial mint.
 *
 * Network: Testnet4
 * Type: Taproot (P2TR)
 *
 * IMPORTANT: This wallet's private key must be available to the signer service.
 * Store mnemonic securely (env var: SPARK_TREASURY_MNEMONIC)
 */
export const SPARK_TREASURY_TESTNET4 =
  process.env.NEXT_PUBLIC_SPARK_TREASURY_ADDRESS ||
  process.env.SPARK_TREASURY_ADDRESS ||
  "tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8";

// Mainnet — set via SPARK_TREASURY_MAINNET_ADDRESS env var before production
export const SPARK_TREASURY_MAINNET =
  process.env.SPARK_TREASURY_MAINNET_ADDRESS || "";

/**
 * Get SPARK treasury address for current network
 */
export function getSPARKTreasuryAddress(
  network: "testnet4" | "mainnet" = "testnet4",
): string {
  if (network === "mainnet") {
    if (!SPARK_TREASURY_MAINNET) {
      throw new Error("Mainnet SPARK treasury not configured");
    }
    return SPARK_TREASURY_MAINNET;
  }
  if (!SPARK_TREASURY_TESTNET4) {
    throw new Error(
      "Testnet4 SPARK treasury not configured. Set SPARK_TREASURY_ADDRESS env var.",
    );
  }
  return SPARK_TREASURY_TESTNET4;
}

// =============================================================================
// NFT SALES TREASURY (Testnet4)
// =============================================================================

/**
 * NFT Sales Treasury Address
 *
 * All NFT sale payments (50,000 sats each) go here.
 * This wallet is SEPARATE from BitcoinBaby operational funds.
 *
 * Network: Testnet4
 * Type: Taproot (P2TR)
 * Mnemonic stored in password manager (see DEPLOYMENT.md)
 */
export const NFT_TREASURY_TESTNET4 =
  "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu";

// Mainnet — set via NFT_TREASURY_MAINNET_ADDRESS env var before production
export const NFT_TREASURY_MAINNET =
  process.env.NFT_TREASURY_MAINNET_ADDRESS || "";

/**
 * Get treasury address for current network
 */
export function getNFTTreasuryAddress(
  network: "testnet4" | "mainnet" = "testnet4",
): string {
  if (network === "mainnet") {
    if (!NFT_TREASURY_MAINNET) {
      throw new Error("Mainnet treasury not configured");
    }
    return NFT_TREASURY_MAINNET;
  }
  return NFT_TREASURY_TESTNET4;
}
