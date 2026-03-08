/**
 * BABTC Balance Utilities
 *
 * High-level utilities for querying BABTC token balances.
 * Combines Scrolls API data with pending mining rewards.
 *
 * Updated for Charms Protocol v10 (January 2026)
 */

import { ScrollsClient } from "../scrolls/client";
import { MempoolClient } from "../blockchain/mempool";
import type { ScrollsNetwork } from "../scrolls/types";
import { BABTC_CONFIG, formatTokenAmount } from "./token";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Complete BABTC balance for an address
 */
export interface BABTCBalance {
  /** Raw balance in base units (8 decimals) */
  confirmed: bigint;
  /** Pending rewards from unconfirmed mining transactions */
  pending: bigint;
  /** Total balance (confirmed + pending) */
  total: bigint;
  /** Formatted confirmed balance (e.g., "123.45") */
  formattedConfirmed: string;
  /** Formatted total balance */
  formattedTotal: string;
  /** Number of UTXOs holding BABTC */
  utxoCount: number;
  /** Block height at query time */
  blockHeight: number;
  /** Network queried */
  network: ScrollsNetwork;
  /** Timestamp of query */
  timestamp: number;
}

/**
 * Balance query options
 */
export interface BalanceQueryOptions {
  /** Include pending mining rewards (default: true) */
  includePending?: boolean;
  /** Scrolls API base URL override */
  scrollsUrl?: string;
  /** Mempool API base URL override */
  mempoolUrl?: string;
}

// =============================================================================
// BALANCE SERVICE
// =============================================================================

/**
 * BABTC Balance Service
 *
 * Provides methods for querying BABTC token balances across networks.
 */
export class BABTCBalanceService {
  private scrollsClient: ScrollsClient;
  private mempoolClient: MempoolClient;
  private network: ScrollsNetwork;

  constructor(
    network: ScrollsNetwork = "testnet4",
    options: BalanceQueryOptions = {},
  ) {
    this.network = network;

    this.scrollsClient = new ScrollsClient({
      network,
      baseUrl: options.scrollsUrl,
    });

    this.mempoolClient = new MempoolClient({
      network: network === "main" ? "mainnet" : "testnet4",
      baseUrl: options.mempoolUrl,
    });
  }

  /**
   * Get BABTC balance for an address
   */
  async getBalance(
    address: string,
    options: BalanceQueryOptions = {},
  ): Promise<BABTCBalance> {
    const { includePending = true } = options;

    // Query confirmed balance from Scrolls
    const tokenBalances = await this.scrollsClient.getTokenBalances(
      address,
      BABTC_CONFIG.ticker,
    );

    // Find BABTC balance
    const babtcBalance = tokenBalances.balances.find(
      (b) => b.ticker === BABTC_CONFIG.ticker,
    );

    const confirmed = babtcBalance?.amount ?? 0n;
    const utxoCount = babtcBalance?.utxoCount ?? 0;

    // Query pending rewards if requested
    let pending = 0n;
    if (includePending) {
      pending = await this.getPendingRewards(address);
    }

    const total = confirmed + pending;

    return {
      confirmed,
      pending,
      total,
      formattedConfirmed: formatTokenAmount(confirmed),
      formattedTotal: formatTokenAmount(total),
      utxoCount,
      blockHeight: tokenBalances.blockHeight,
      network: this.network,
      timestamp: Date.now(),
    };
  }

  /**
   * Get pending mining rewards for an address
   *
   * STATUS: NOT IMPLEMENTED - Returns 0n
   *
   * Full pending reward tracking requires parsing spell data from
   * transaction witnesses, which depends on charms-wallet-js SDK
   * supporting spell witness parsing.
   *
   * Current behavior:
   * - Always returns 0n (no pending rewards shown)
   * - Confirmed balances from Scrolls API are authoritative
   * - Users see balance updates after transaction confirms
   *
   * Future implementation (when SDK support available):
   * 1. Get unconfirmed transactions for the address
   * 2. Parse spell witness data from each TX
   * 3. Extract pending mint amounts
   * 4. Sum and return pending rewards
   *
   * Tracking issue: Consider using virtual balance from workers API
   * as a workaround for pending rewards until SDK support.
   */
  async getPendingRewards(_address: string): Promise<bigint> {
    // Returns 0n - pending rewards not tracked yet
    // Confirmed balances from getBalance() are authoritative
    return 0n;
  }

  /**
   * Get multiple balances in a single call
   */
  async getBalances(
    addresses: string[],
    options: BalanceQueryOptions = {},
  ): Promise<Map<string, BABTCBalance>> {
    const results = new Map<string, BABTCBalance>();

    // Query in parallel with concurrency limit
    const batchSize = 5;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      const balances = await Promise.all(
        batch.map((addr) => this.getBalance(addr, options)),
      );

      batch.forEach((addr, idx) => {
        results.set(addr, balances[idx]);
      });
    }

    return results;
  }

  /**
   * Check if an address has any BABTC
   */
  async hasBalance(address: string): Promise<boolean> {
    const balance = await this.getBalance(address, { includePending: false });
    return balance.confirmed > 0n;
  }

  /**
   * Get current block height
   */
  async getBlockHeight(): Promise<number> {
    return this.mempoolClient.getBlockHeight();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a BABTC balance service
 */
export function createBABTCBalanceService(
  network: ScrollsNetwork = "testnet4",
  options: BalanceQueryOptions = {},
): BABTCBalanceService {
  return new BABTCBalanceService(network, options);
}

/**
 * Quick balance check for a single address
 */
export async function getBABTCBalance(
  address: string,
  network: ScrollsNetwork = "testnet4",
): Promise<BABTCBalance> {
  const service = createBABTCBalanceService(network);
  return service.getBalance(address);
}

/**
 * Format balance for display
 */
export function formatBABTCBalance(balance: BABTCBalance): string {
  if (balance.pending > 0n) {
    return `${balance.formattedConfirmed} (+${formatTokenAmount(balance.pending)} pending)`;
  }
  return balance.formattedConfirmed;
}

/**
 * Check if balance is sufficient for a transfer
 */
export function hasSufficientBalance(
  balance: BABTCBalance,
  amount: bigint,
  options: { includePending?: boolean } = {},
): boolean {
  const available = options.includePending ? balance.total : balance.confirmed;
  return available >= amount;
}
