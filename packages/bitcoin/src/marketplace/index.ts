/**
 * Marketplace Module
 *
 * PSBT-based NFT marketplace with atomic swaps.
 */

// Types
export type {
  MarketplaceListing,
  CreateListingParams,
  CreateListingResult,
  CompletePurchaseParams,
  CompletePurchaseResult,
  SaleRecord,
  PurchaseFeeBreakdown,
} from "./types";

// Config
export {
  MARKETPLACE_CONFIG,
  type MarketplaceConfig,
  getRoyaltyAddress,
  getMarketplaceFeeAddress,
  calculateRoyalty,
  calculateBuyerFee,
  calculateSellerFee,
  calculateSellerReceives,
  calculateBuyerTotalCost,
  validateListingPrice,
  isListingExpired,
  calculateExpirationTime,
} from "./config";

// Service
export {
  ListingService,
  ListingError,
  createListingService,
  type ListingServiceOptions,
} from "./listing-service";
