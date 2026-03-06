/**
 * Treasury Configuration
 *
 * Addresses for receiving payments and holding tokens.
 * These are separate from BitcoinBaby operational wallets.
 *
 * Treasury Types:
 * - NFT Treasury: Receives NFT sale payments (BTC)
 * - BABTC Treasury: Holds BABTC tokens for batch withdrawals
 */

// =============================================================================
// BABTC TOKEN TREASURY (Testnet4)
// =============================================================================

/**
 * BABTC Token Treasury Address
 *
 * Holds BABTC tokens that are distributed to users on withdraw.
 * Must be pre-funded with tokens via initial mint.
 *
 * Network: Testnet4
 * Type: Taproot (P2TR)
 *
 * IMPORTANT: This wallet's private key must be available to the signer service.
 * Store mnemonic securely (env var: BABTC_TREASURY_MNEMONIC)
 */
export const BABTC_TREASURY_TESTNET4 =
  process.env.NEXT_PUBLIC_BABTC_TREASURY_ADDRESS ||
  process.env.BABTC_TREASURY_ADDRESS ||
  "tb1prrj7vwsxxfk0nvp279h9l83fplq9e2yf4v7727rxnt7d3zvgdccqcjywq8";

// Mainnet (set when ready for production)
export const BABTC_TREASURY_MAINNET = "";

/**
 * Get BABTC treasury address for current network
 */
export function getBABTCTreasuryAddress(
  network: "testnet4" | "mainnet" = "testnet4",
): string {
  if (network === "mainnet") {
    if (!BABTC_TREASURY_MAINNET) {
      throw new Error("Mainnet BABTC treasury not configured");
    }
    return BABTC_TREASURY_MAINNET;
  }
  if (!BABTC_TREASURY_TESTNET4) {
    throw new Error(
      "Testnet4 BABTC treasury not configured. Set BABTC_TREASURY_ADDRESS env var.",
    );
  }
  return BABTC_TREASURY_TESTNET4;
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

// Mainnet (set when ready for production)
export const NFT_TREASURY_MAINNET = "";

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
