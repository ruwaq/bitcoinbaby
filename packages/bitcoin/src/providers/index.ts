/**
 * Wallet Providers
 *
 * Unified interface for Bitcoin wallet interactions.
 * Supports both internal (self-custodied) and external (browser extension) wallets.
 */

// Types
export * from "./types";

// Providers
export {
  InternalWalletProvider,
  createInternalProvider,
  type InternalProviderOptions,
} from "./internal-provider";

export { UnisatProvider, createUnisatProvider } from "./unisat-provider";

export { XVerseProvider, createXVerseProvider } from "./xverse-provider";

// Registry
export {
  getProviderRegistry,
  createProviderRegistry,
  detectWallets,
  getProvider,
  getAvailableProviders,
  hasAvailableWallet,
  getBestProvider,
} from "./registry";

// Dev Fund (local testing)
export {
  DevFundProvider,
  getDevFundProvider,
  isDevFundEnabled,
  enableDevFund,
  disableDevFund,
  DEV_FUND,
} from "./dev-fund-provider";
