/**
 * Bitcoin Wallet Types
 *
 * Tipos compartidos para el modulo de wallet Bitcoin.
 * Siguiendo patrones de Charms wallet.
 */

import {
  type WalletInfo as SharedWalletInfo,
  type WalletOptions as SharedWalletOptions,
  type InternalWallet as SharedInternalWallet,
  type AddressType,
} from "@bitcoinbaby/shared";

// Re-export shared types
export type { AddressType } from "@bitcoinbaby/shared";

// =============================================================================
// NETWORKS (Extended for Bitcoin module)
// =============================================================================

/** All supported Bitcoin networks (includes regtest for local dev) */
export type BitcoinNetwork = "mainnet" | "testnet" | "testnet4" | "regtest";

/** Networks supported in production (subset) */
export type SupportedNetwork = "mainnet" | "testnet4";

/** Scrolls API network mapping */
export type ScrollsNetwork = "main" | "testnet4";

/** Map BitcoinNetwork to ScrollsNetwork */
export function toScrollsNetwork(network: BitcoinNetwork): ScrollsNetwork {
  return network === "mainnet" ? "main" : "testnet4";
}

/** Network endpoint configuration */
export interface NetworkEndpoints {
  mempoolApi: string;
  scrollsApi: string;
  explorerUrl: string;
}

/** Default network endpoints */
export const NETWORK_ENDPOINTS: Record<SupportedNetwork, NetworkEndpoints> = {
  mainnet: {
    mempoolApi: "https://mempool.space/api",
    scrollsApi: "https://scrolls.charms.dev",
    explorerUrl: "https://mempool.space",
  },
  testnet4: {
    mempoolApi: "https://mempool.space/testnet4/api",
    scrollsApi: "https://scrolls.charms.dev",
    explorerUrl: "https://mempool.space/testnet4",
  },
};

// =============================================================================
// WALLET TYPES (Extended from @bitcoinbaby/shared)
// =============================================================================

/**
 * Bitcoin wallet info with full metadata
 * Extends SharedWalletInfo with required blockchain fields
 */
export interface WalletInfo extends SharedWalletInfo {
  network: BitcoinNetwork;
  derivationPath: string;
  addressType: AddressType;
}

/**
 * Internal wallet with sensitive data
 * NEVER log, expose to UI, or transmit over network
 */
export interface InternalWallet extends WalletInfo {
  privateKey: Uint8Array;
  mnemonic?: string;
}

/**
 * Wallet creation/import options
 */
export interface WalletOptions extends SharedWalletOptions {
  network?: BitcoinNetwork;
}

// Transaction types
export interface UTxO {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey: string;
}

export interface TransactionInput {
  utxo: UTxO;
  sequence?: number;
}

export interface TransactionOutput {
  address: string;
  value: number; // satoshis
}

export interface UnsignedTransaction {
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fee: number;
}

export interface SignedTransaction {
  hex: string;
  txid: string;
  size: number;
  fee: number;
}

// Mining transaction with OP_RETURN
export interface MiningTransaction extends UnsignedTransaction {
  opReturnData: Uint8Array;
  workProof: string;
}

// Charms/Spell types
export interface CharmSpell {
  name: string;
  version: string;
  operations: CharmOperation[];
}

export interface CharmOperation {
  type: "mint" | "transfer" | "burn";
  token: string;
  amount: string | number;
  recipient?: string;
  proof?: string;
}

// Balance response
export interface TokenBalance {
  runeId: string;
  symbol: string;
  balance: bigint;
  decimals: number;
}

export interface WalletBalance {
  btc: number; // satoshis
  tokens: TokenBalance[];
}
