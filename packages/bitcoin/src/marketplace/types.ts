/**
 * Marketplace Types
 *
 * Type definitions for NFT marketplace with PSBT-based atomic swaps.
 */

import type { UTXO } from "../blockchain/types";

// =============================================================================
// LISTING TYPES
// =============================================================================

/**
 * NFT listing stored on server
 */
export interface MarketplaceListing {
  /** NFT token ID */
  tokenId: number;
  /** Price in satoshis */
  priceSats: bigint;
  /** Seller's Bitcoin address */
  sellerAddress: string;
  /** Partially signed PSBT (seller's signature with SIGHASH_SINGLE|ANYONECANPAY) */
  sellerPsbt: string;
  /** NFT UTXO location */
  nftUtxo: {
    txid: string;
    vout: number;
    value: number;
  };
  /** Listing creation timestamp */
  createdAt: number;
  /** Listing expiration timestamp */
  expiresAt: number;
  /** Is listing still active */
  isActive: boolean;
}

/**
 * Parameters for creating a listing
 */
export interface CreateListingParams {
  /** NFT UTXO to sell */
  nftUtxo: {
    txid: string;
    vout: number;
    value: number;
  };
  /** Seller's address */
  sellerAddress: string;
  /** Sale price in satoshis */
  priceSats: bigint;
  /** Royalty recipient address */
  royaltyAddress: string;
  /** Royalty percentage (0-100) */
  royaltyPercent: number;
}

/**
 * Result of creating a listing PSBT
 */
export interface CreateListingResult {
  success: boolean;
  /** Base64-encoded PSBT for seller to sign */
  psbt?: string;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// PURCHASE TYPES
// =============================================================================

/**
 * Parameters for completing a purchase
 */
export interface CompletePurchaseParams {
  /** Seller's partially signed PSBT */
  listingPsbt: string;
  /** Buyer's Bitcoin address */
  buyerAddress: string;
  /** Buyer's UTXOs for payment */
  buyerUtxos: UTXO[];
  /** Fee rate in sat/vB */
  feeRate?: number;
}

/**
 * Result of completing a purchase PSBT
 */
export interface CompletePurchaseResult {
  success: boolean;
  /** Base64-encoded PSBT for buyer to sign */
  psbt?: string;
  /** Total fee in satoshis */
  fee?: bigint;
  /** Total amount buyer pays (price + royalty + fee) */
  totalCost?: bigint;
  /** Error message if failed */
  error?: string;
}

// =============================================================================
// SALE RECORD
// =============================================================================

/**
 * Record of a completed sale
 */
export interface SaleRecord {
  /** NFT token ID */
  tokenId: number;
  /** Seller address */
  sellerAddress: string;
  /** Buyer address */
  buyerAddress: string;
  /** Sale price in satoshis */
  priceSats: bigint;
  /** Royalty paid in satoshis */
  royaltySats: bigint;
  /** Transaction ID */
  txid: string;
  /** Sale timestamp */
  timestamp: number;
}

// =============================================================================
// FEE BREAKDOWN
// =============================================================================

/**
 * Fee breakdown for a purchase
 */
export interface PurchaseFeeBreakdown {
  /** Base NFT price */
  priceSats: bigint;
  /** Royalty amount */
  royaltySats: bigint;
  /** Marketplace fee (buyer side) */
  marketplaceFeeSats: bigint;
  /** Network transaction fee */
  networkFeeSats: bigint;
  /** Total cost for buyer */
  totalCostSats: bigint;
  /** Amount seller receives */
  sellerReceivesSats: bigint;
}
