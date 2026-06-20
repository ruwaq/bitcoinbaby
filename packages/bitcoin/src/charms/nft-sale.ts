/**
 * NFT Sale System
 *
 * Simple NFT sales for Genesis Sparks.
 * Price: FIXED in Bitcoin (50,000 sats)
 * All funds go to single treasury wallet.
 */

import { GENESIS_SPARKS_CONFIG, type RarityTier } from "./nft";
import { NFT_TREASURY_TESTNET4 } from "../config/treasury";

// =============================================================================
// SALE CONFIGURATION
// =============================================================================

/**
 * NFT Sale Configuration
 *
 * Simple pricing: 50,000 sats per NFT
 * All funds → Treasury (no splits)
 */
export const NFT_SALE_CONFIG = {
  /** Price in SATOSHIS (fixed) */
  priceSats: 50_000n, // 0.0005 BTC (~€50)

  /** Dust limit for NFT UTXO */
  dustLimit: 546n,

  /** Max supply */
  maxSupply: GENESIS_SPARKS_CONFIG.maxSupply,
} as const;

// Treasury address (can be overridden at runtime)
let _treasuryOverride = "";

export function setTreasuryAddress(address: string): void {
  _treasuryOverride = address;
}

export function getTreasuryAddress(): string {
  return _treasuryOverride || NFT_TREASURY_TESTNET4;
}

// =============================================================================
// PRICE UTILITIES
// =============================================================================

/**
 * Price tier (simplified - only standard for now)
 */
export type PriceTier = "standard";

/**
 * Format satoshis for display
 */
export function formatSatsPrice(sats: bigint): string {
  return `${sats.toLocaleString()} sats`;
}

/**
 * Get NFT price
 */
export function getNFTPrice(): bigint {
  return NFT_SALE_CONFIG.priceSats;
}

// Legacy exports for compatibility
export const getTierPrice = (_tier?: PriceTier): bigint => getNFTPrice();
export const getTierGuarantee = (_tier?: PriceTier): RarityTier | null => null;

// =============================================================================
// PRICE BREAKDOWN
// =============================================================================

/**
 * Simple price breakdown
 */
export interface NFTPriceBreakdown {
  /** Price in satoshis */
  priceSats: bigint;
  /** Formatted price */
  displayPrice: string;
  /** Total needed (price + dust + estimated fee) */
  totalNeeded: bigint;
}

/**
 * Calculate NFT price (simple)
 */
export function calculateNFTPrice(_options?: {
  tier?: PriceTier;
  isWhitelist?: boolean;
}): NFTPriceBreakdown {
  const priceSats = NFT_SALE_CONFIG.priceSats;
  const estimatedFee = 2000n; // ~2000 sats for tx fee

  return {
    priceSats,
    displayPrice: formatSatsPrice(priceSats),
    totalNeeded: priceSats + NFT_SALE_CONFIG.dustLimit + estimatedFee,
  };
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface PurchaseValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validatePurchase(params: {
  buyerAddress: string;
  buyerBalance: bigint;
  mintedCount?: number;
}): PurchaseValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate address
  if (!params.buyerAddress || params.buyerAddress.length < 26) {
    errors.push("Connect wallet first");
  }

  // Check supply
  const mintedCount = params.mintedCount ?? 0;
  if (mintedCount >= NFT_SALE_CONFIG.maxSupply) {
    errors.push("Sold out!");
  }

  // Check balance
  const price = calculateNFTPrice();
  if (params.buyerBalance < price.totalNeeded) {
    errors.push(
      `Need ${formatSatsPrice(price.totalNeeded)}, have ${formatSatsPrice(params.buyerBalance)}`,
    );
  }

  // Low supply warning
  if (mintedCount > NFT_SALE_CONFIG.maxSupply * 0.9) {
    warnings.push(`Only ${NFT_SALE_CONFIG.maxSupply - mintedCount} left!`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

// =============================================================================
// PURCHASE TRANSACTION
// =============================================================================

export interface NFTPurchaseParams {
  buyerAddress: string;
  buyerUtxos: Array<{ txid: string; vout: number; value: bigint }>;
  tokenId: number;
  feeRate?: number;
}

export interface NFTPurchaseOutputs {
  outputs: Array<{ address: string; value: bigint }>;
  fee: bigint;
  change: bigint;
}

/**
 * Calculate outputs for NFT purchase
 *
 * Simple structure:
 * - Output 0: Payment to treasury (50,000 sats)
 * - Output 1: NFT to buyer (546 sats dust with charm)
 * - Output 2: Change to buyer (if any)
 */
export function calculatePurchaseOutputs(
  params: NFTPurchaseParams,
): NFTPurchaseOutputs {
  const treasury = getTreasuryAddress();
  if (!treasury) {
    throw new Error("Treasury address not configured");
  }

  const totalInput = params.buyerUtxos.reduce((sum, u) => sum + u.value, 0n);
  const price = NFT_SALE_CONFIG.priceSats;
  const dust = NFT_SALE_CONFIG.dustLimit;

  // Fee estimate: ~250 vbytes * feeRate
  const feeRate = params.feeRate ?? 10;
  const fee = BigInt(250 * feeRate);

  const totalSpent = price + dust + fee;
  const change = totalInput - totalSpent;

  const outputs: Array<{ address: string; value: bigint }> = [
    { address: treasury, value: price }, // Payment
    { address: params.buyerAddress, value: dust }, // NFT
  ];

  // Add change if above dust
  if (change > dust) {
    outputs.push({ address: params.buyerAddress, value: change });
  }

  return { outputs, fee, change: change > dust ? change : 0n };
}

// =============================================================================
// SALE RECORD (simple)
// =============================================================================

export interface NFTSaleRecord {
  tokenId: number;
  buyerAddress: string;
  priceSats: bigint;
  txid: string;
  timestamp: number;
  rarityTier: RarityTier;
}

export interface SalesStats {
  totalMinted: number;
  totalRevenueSats: bigint;
}

export function calculateSalesStats(sales: NFTSaleRecord[]): SalesStats {
  return {
    totalMinted: sales.length,
    totalRevenueSats: sales.reduce((sum, s) => sum + s.priceSats, 0n),
  };
}

export { GENESIS_SPARKS_CONFIG };
