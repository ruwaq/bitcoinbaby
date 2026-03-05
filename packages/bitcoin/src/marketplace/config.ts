/**
 * Marketplace Configuration
 *
 * Fee structure and configuration for NFT marketplace.
 */

import { getTreasuryAddress } from "../charms/nft-sale";

// =============================================================================
// FEE CONFIGURATION
// =============================================================================

export interface MarketplaceConfig {
  /** Royalty percentage for creator (e.g., 5 = 5%) */
  royaltyPercent: number;
  /** Marketplace fee for seller (e.g., 0 = 0%) */
  sellerFeePercent: number;
  /** Marketplace fee for buyer (e.g., 1.5 = 1.5%) */
  buyerFeePercent: number;
  /** Listing expiration in milliseconds (default: 7 days) */
  listingExpirationMs: number;
  /** Minimum listing price in satoshis */
  minPriceSats: bigint;
  /** Maximum listing price in satoshis */
  maxPriceSats: bigint;
}

/**
 * Default marketplace configuration
 */
export const MARKETPLACE_CONFIG: MarketplaceConfig = {
  // Royalties go to the original creator/project
  royaltyPercent: 5,

  // Fee structure: 0% seller, 1.5% buyer (like Magic Eden)
  sellerFeePercent: 0,
  buyerFeePercent: 1.5,

  // Listings expire after 7 days
  listingExpirationMs: 7 * 24 * 60 * 60 * 1000,

  // Price limits
  minPriceSats: 1000n, // 1,000 sats minimum
  maxPriceSats: 100_000_000_000n, // 1,000 BTC maximum
};

// =============================================================================
// ADDRESS CONFIGURATION
// =============================================================================

/**
 * Get royalty recipient address
 * Uses treasury address from nft-sale module
 */
export function getRoyaltyAddress(): string {
  return getTreasuryAddress();
}

/**
 * Get marketplace fee recipient address
 * Same as royalty address for simplicity
 */
export function getMarketplaceFeeAddress(): string {
  return getTreasuryAddress();
}

// =============================================================================
// FEE CALCULATIONS
// =============================================================================

/**
 * Calculate royalty amount from price
 */
export function calculateRoyalty(
  priceSats: bigint,
  royaltyPercent: number = MARKETPLACE_CONFIG.royaltyPercent,
): bigint {
  return (priceSats * BigInt(Math.round(royaltyPercent * 100))) / 10000n;
}

/**
 * Calculate marketplace fee for buyer
 */
export function calculateBuyerFee(
  priceSats: bigint,
  feePercent: number = MARKETPLACE_CONFIG.buyerFeePercent,
): bigint {
  return (priceSats * BigInt(Math.round(feePercent * 100))) / 10000n;
}

/**
 * Calculate marketplace fee for seller
 */
export function calculateSellerFee(
  priceSats: bigint,
  feePercent: number = MARKETPLACE_CONFIG.sellerFeePercent,
): bigint {
  return (priceSats * BigInt(Math.round(feePercent * 100))) / 10000n;
}

/**
 * Calculate what seller receives after fees
 */
export function calculateSellerReceives(priceSats: bigint): bigint {
  const sellerFee = calculateSellerFee(priceSats);
  return priceSats - sellerFee;
}

/**
 * Calculate total cost for buyer
 */
export function calculateBuyerTotalCost(
  priceSats: bigint,
  networkFeeSats: bigint = 0n,
): bigint {
  const royalty = calculateRoyalty(priceSats);
  const buyerFee = calculateBuyerFee(priceSats);
  return priceSats + royalty + buyerFee + networkFeeSats;
}

/**
 * Validate listing price
 */
export function validateListingPrice(priceSats: bigint): {
  valid: boolean;
  error?: string;
} {
  if (priceSats < MARKETPLACE_CONFIG.minPriceSats) {
    return {
      valid: false,
      error: `Price must be at least ${MARKETPLACE_CONFIG.minPriceSats} sats`,
    };
  }

  if (priceSats > MARKETPLACE_CONFIG.maxPriceSats) {
    return {
      valid: false,
      error: `Price must be less than ${MARKETPLACE_CONFIG.maxPriceSats} sats`,
    };
  }

  return { valid: true };
}

/**
 * Check if listing is expired
 */
export function isListingExpired(createdAt: number): boolean {
  return Date.now() - createdAt > MARKETPLACE_CONFIG.listingExpirationMs;
}

/**
 * Calculate expiration timestamp for new listing
 */
export function calculateExpirationTime(): number {
  return Date.now() + MARKETPLACE_CONFIG.listingExpirationMs;
}
