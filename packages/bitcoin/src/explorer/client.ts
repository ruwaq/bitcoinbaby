/**
 * Charms Explorer API Client
 *
 * Client for querying Charms token balances and UTXOs.
 * Uses the Charms Explorer indexer API.
 *
 * API: https://charms-explorer-api.fly.dev/v1
 * Source: https://github.com/CharmsDev/charms-explorer
 */

import { ApiError } from "../errors";

// =============================================================================
// TYPES
// =============================================================================

export type ExplorerNetwork = "mainnet" | "testnet4";

export interface ExplorerClientOptions {
  baseUrl?: string;
  timeout?: number;
  network?: ExplorerNetwork;
}

export interface CharmBalance {
  /** App ID (e.g., "t/..." for tokens, "n/..." for NFTs) */
  appId: string;
  /** Asset type: "token", "nft", "dapp", "other" */
  assetType: string;
  /** Token ticker if available */
  ticker?: string;
  /** Balance amount */
  amount: bigint;
  /** Charm ID */
  charmId: string;
  /** Transaction ID */
  txid: string;
  /** Output index */
  vout: number;
}

export interface CharmUTXO {
  txid: string;
  vout: number;
  value: number;
  charmId: string;
  appId: string;
  assetType: string;
  ticker?: string;
  amount: bigint;
  confirmed: boolean;
  blockHeight?: number;
}

export interface WalletCharmsResponse {
  address: string;
  network: string;
  balances: CharmBalance[];
  count: number;
}

export interface WalletUTXOsResponse {
  address: string;
  utxos: CharmUTXO[];
  count: number;
}

// =============================================================================
// API RESPONSE TYPES (raw from API)
// =============================================================================

interface ApiCharmBalance {
  app_id: string;
  asset_type: string;
  ticker?: string;
  amount: string;
  charmid: string;
  txid: string;
  vout: number;
}

interface ApiWalletCharmsResponse {
  address: string;
  network: string;
  balances: ApiCharmBalance[];
  count: number;
}

interface ApiCharmUTXO {
  txid: string;
  vout: number;
  value: number;
  charmid: string;
  app_id: string;
  asset_type: string;
  ticker?: string;
  amount: string;
  confirmed: boolean;
  block_height?: number;
}

interface ApiWalletUTXOsResponse {
  address: string;
  utxos: ApiCharmUTXO[];
  count: number;
}

// =============================================================================
// CLIENT
// =============================================================================

const DEFAULT_BASE_URL = "https://charms-explorer-api.fly.dev/v1";

export class CharmsExplorerClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private network: ExplorerNetwork;

  constructor(options: ExplorerClientOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || 30000;
    this.network = options.network || "testnet4";
  }

  /**
   * Make HTTP request to Explorer API
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    // Add network query parameter
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}network=${this.network}`;

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ExplorerAPIError(
          `API error: ${response.status} ${response.statusText}`,
          response.status,
          error,
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Set the network for API calls
   */
  setNetwork(network: ExplorerNetwork): void {
    this.network = network;
  }

  /**
   * Get current network
   */
  getNetwork(): ExplorerNetwork {
    return this.network;
  }

  /**
   * Get all charms (tokens/NFTs) for an address
   */
  async getWalletCharms(address: string): Promise<WalletCharmsResponse> {
    const response = await this.fetch<ApiWalletCharmsResponse>(
      `/wallet/charms/${address}`,
    );

    return {
      address: response.address,
      network: response.network,
      count: response.count,
      balances: response.balances.map((b) => ({
        appId: b.app_id,
        assetType: b.asset_type,
        ticker: b.ticker,
        amount: BigInt(b.amount || "0"),
        charmId: b.charmid,
        txid: b.txid,
        vout: b.vout,
      })),
    };
  }

  /**
   * Get charm UTXOs for an address
   */
  async getWalletUTXOs(address: string): Promise<WalletUTXOsResponse> {
    const response = await this.fetch<ApiWalletUTXOsResponse>(
      `/wallet/utxos/${address}`,
    );

    return {
      address: response.address,
      count: response.count,
      utxos: response.utxos.map((u) => ({
        txid: u.txid,
        vout: u.vout,
        value: u.value,
        charmId: u.charmid,
        appId: u.app_id,
        assetType: u.asset_type,
        ticker: u.ticker,
        amount: BigInt(u.amount || "0"),
        confirmed: u.confirmed,
        blockHeight: u.block_height,
      })),
    };
  }

  /**
   * Get token balance for a specific ticker
   */
  async getTokenBalance(address: string, ticker: string): Promise<bigint> {
    const response = await this.getWalletCharms(address);

    const tokenBalances = response.balances.filter(
      (b) => b.assetType === "token" && b.ticker === ticker,
    );

    // Sum all balances for this ticker
    return tokenBalances.reduce((sum, b) => sum + b.amount, 0n);
  }

  /**
   * Get all token balances grouped by ticker
   */
  async getTokenBalances(address: string): Promise<Map<string, bigint>> {
    const response = await this.getWalletCharms(address);
    const balances = new Map<string, bigint>();

    for (const charm of response.balances) {
      if (charm.assetType === "token" && charm.ticker) {
        const current = balances.get(charm.ticker) || 0n;
        balances.set(charm.ticker, current + charm.amount);
      }
    }

    return balances;
  }

  /**
   * Get NFTs owned by address
   */
  async getNFTs(address: string): Promise<CharmBalance[]> {
    const response = await this.getWalletCharms(address);
    return response.balances.filter((b) => b.assetType === "nft");
  }

  /**
   * Check if explorer API is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// ERROR
// =============================================================================

export class ExplorerAPIError extends ApiError {
  readonly statusCode: number;
  readonly response?: string;

  constructor(message: string, statusCode?: number, response?: string) {
    super("charms-explorer-api.fly.dev", statusCode, response || message);
    this.name = "ExplorerAPIError";
    this.statusCode = statusCode ?? 0;
    this.response = response;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let explorerClient: CharmsExplorerClient | null = null;

/**
 * Get or create explorer client singleton
 */
export function getExplorerClient(
  options?: ExplorerClientOptions,
): CharmsExplorerClient {
  if (!explorerClient) {
    explorerClient = new CharmsExplorerClient(options);
  }
  return explorerClient;
}

/**
 * Create a new explorer client instance
 */
export function createExplorerClient(
  options?: ExplorerClientOptions,
): CharmsExplorerClient {
  return new CharmsExplorerClient(options);
}
