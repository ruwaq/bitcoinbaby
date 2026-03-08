/**
 * Shared Types - Single Source of Truth
 *
 * All canonical types should be imported from here.
 *
 * @example
 * import {
 *   WalletInfo,
 *   Bloodline,
 *   Heritage,
 *   ApiResponse,
 * } from '@bitcoinbaby/shared';
 */

// Wallet types (BitcoinNetwork comes from ../network, not here)
export {
  type AddressType,
  type WalletInfo,
  type WalletInfoWithBalance,
  type InternalWallet,
  type WalletOptions,
  type WalletConnectionState,
  type WalletGuardState,
} from "./wallet";

// NFT types
export {
  type Bloodline,
  type BaseType,
  type RarityTier,
  type Heritage,
  type ExtendedBloodline,
  type LevelBoostConfig,
  type RarityBoostConfig,
  type BloodlineBoostConfig,
  BLOODLINES,
  HERITAGES,
  RARITY_TIERS,
  MAX_LEVEL,
} from "./nft";

// API types
export {
  type ApiResponse,
  type ApiErrorResponse,
  type ApiResult,
  type PaginatedResponse,
  isApiSuccess,
  isApiError,
  unwrapApiResult,
} from "./api";
