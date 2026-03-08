/**
 * Wallet Types - Single Source of Truth
 *
 * All wallet-related types should be imported from here.
 * DO NOT duplicate these definitions in other packages.
 *
 * @example
 * import { WalletInfo, AddressType } from '@bitcoinbaby/shared';
 */

// Import network type from canonical source
import { type BitcoinNetwork } from "../network/config";

// Re-export for convenience
export type { BitcoinNetwork } from "../network/config";

/**
 * Address types supported by the wallet
 */
export type AddressType = "taproot" | "segwit" | "legacy";

// =============================================================================
// WALLET INFO (PUBLIC)
// =============================================================================

/**
 * Public wallet information (safe to expose, log, etc.)
 *
 * This is the canonical wallet type used across all packages.
 * - Use for display, API calls, non-sensitive operations
 * - DO NOT include private keys or mnemonics
 */
export interface WalletInfo {
  /** Bitcoin address (P2TR, P2WPKH, or P2PKH) */
  address: string;

  /** Public key in hex format */
  publicKey: string;

  /** Network the wallet is connected to */
  network?: BitcoinNetwork;

  /** BIP44/84/86 derivation path */
  derivationPath?: string;

  /** Address type (taproot, segwit, legacy) */
  addressType?: AddressType;
}

/**
 * Extended wallet info with balance (for UI display)
 */
export interface WalletInfoWithBalance extends WalletInfo {
  /** On-chain balance in satoshis */
  balance: bigint;

  /** BABTC token balance */
  babyTokens: bigint;
}

// =============================================================================
// INTERNAL WALLET (SENSITIVE)
// =============================================================================

/**
 * Internal wallet with sensitive data
 * NEVER log, expose to UI, or transmit over network
 */
export interface InternalWallet extends WalletInfo {
  /** Private key bytes - ZERO AFTER USE */
  privateKey: Uint8Array;

  /** Mnemonic phrase - ZERO AFTER USE */
  mnemonic?: string;
}

// =============================================================================
// WALLET OPTIONS
// =============================================================================

/**
 * Options for wallet creation/import
 */
export interface WalletOptions {
  network?: BitcoinNetwork;
  mnemonic?: string;
  addressIndex?: number;
  addressType?: AddressType;
}

// =============================================================================
// WALLET STATE
// =============================================================================

/**
 * Wallet connection state for UI
 */
export interface WalletConnectionState {
  isConnected: boolean;
  isLocked: boolean;
  isLoading: boolean;
  wallet: WalletInfo | null;
  error: string | null;
}

/**
 * Wallet state for guards/validation
 */
export interface WalletGuardState {
  isConnected: boolean;
  isLocked: boolean;
  wallet: WalletInfo | null;
  signPsbt: ((psbtHex: string) => Promise<string | null>) | null;
}
