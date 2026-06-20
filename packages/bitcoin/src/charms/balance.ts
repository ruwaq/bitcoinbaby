/**
 * SPARK Balance Utilities
 *
 * High-level utilities for querying SPARK token balances.
 * Combines Scrolls API data with pending mining rewards.
 *
 * Updated for Charms Protocol v10 (January 2026)
 */

import { ScrollsClient } from "../scrolls/client";
import { MempoolClient } from "../blockchain/mempool";
import type { ScrollsNetwork } from "../scrolls/types";
import { SPARK_CONFIG, formatTokenAmount } from "./token";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Complete SPARK balance for an address
 */
export interface SPARKBalance {
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
  /** Number of UTXOs holding SPARK */
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
 * SPARK Balance Service
 *
 * Provides methods for querying SPARK token balances across networks.
 */
export class SPARKBalanceService {
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
   * Get SPARK balance for an address
   */
  async getBalance(
    address: string,
    options: BalanceQueryOptions = {},
  ): Promise<SPARKBalance> {
    const { includePending = true } = options;

    // Query confirmed balance from Scrolls
    const tokenBalances = await this.scrollsClient.getTokenBalances(
      address,
      SPARK_CONFIG.ticker,
    );

    // Find SPARK balance
    const babtcBalance = tokenBalances.balances.find(
      (b) => b.ticker === SPARK_CONFIG.ticker,
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
   * Get pending on-chain rewards for an address
   *
   * DESIGN NOTE: Returns 0n by design
   *
   * This service handles ON-CHAIN balances only via Scrolls API.
   * Pending/unconfirmed rewards are tracked separately:
   *
   * - Virtual balance (mined, not withdrawn) → Workers API
   * - Combined view → useUnifiedBalance hook in @bitcoinbaby/core
   *
   * The architecture intentionally separates concerns:
   * - packages/bitcoin: On-chain data (blockchain agnostic)
   * - apps/workers: Virtual balance (application state)
   * - packages/core: Combined hooks for UI consumption
   *
   * For full balance including virtual:
   * @see packages/core/src/hooks/useUnifiedBalance.ts
   * @see packages/core/src/api/clients/balance-client.ts
   */
  async getPendingRewards(_address: string): Promise<bigint> {
    // On-chain pending not tracked - use useUnifiedBalance for combined view
    return 0n;
  }

  /**
   * Get multiple balances in a single call
   */
  async getBalances(
    addresses: string[],
    options: BalanceQueryOptions = {},
  ): Promise<Map<string, SPARKBalance>> {
    const results = new Map<string, SPARKBalance>();

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
   * Check if an address has any SPARK
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
 * Create a SPARK balance service
 */
export function createSPARKBalanceService(
  network: ScrollsNetwork = "testnet4",
  options: BalanceQueryOptions = {},
): SPARKBalanceService {
  return new SPARKBalanceService(network, options);
}

/**
 * Quick balance check for a single address
 */
export async function getSPARKBalance(
  address: string,
  network: ScrollsNetwork = "testnet4",
): Promise<SPARKBalance> {
  const service = createSPARKBalanceService(network);
  return service.getBalance(address);
}

/**
 * Format balance for display
 */
export function formatSPARKBalance(balance: SPARKBalance): string {
  if (balance.pending > 0n) {
    return `${balance.formattedConfirmed} (+${formatTokenAmount(balance.pending)} pending)`;
  }
  return balance.formattedConfirmed;
}

/**
 * Check if balance is sufficient for a transfer
 */
export function hasSufficientBalance(
  balance: SPARKBalance,
  amount: bigint,
  options: { includePending?: boolean } = {},
): boolean {
  const available = options.includePending ? balance.total : balance.confirmed;
  return available >= amount;
}
