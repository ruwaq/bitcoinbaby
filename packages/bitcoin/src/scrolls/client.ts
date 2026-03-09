/**
 * Scrolls API Client
 *
 * Client for interacting with the Charms Scrolls API.
 * https://scrolls.charms.dev
 */

import type {
  ScrollsNetwork,
  ScrollsConfig,
  SignRequest,
  FeeCalculation,
  AddressTokenBalances,
  TokenBalance,
  TokenUTXO,
} from "./types";
import { ApiError } from "../errors";

const DEFAULT_BASE_URL = "https://scrolls.charms.dev";

export interface ScrollsClientOptions {
  baseUrl?: string;
  timeout?: number;
  network?: ScrollsNetwork;
}

export class ScrollsClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private network: ScrollsNetwork;
  private config: ScrollsConfig | null = null;

  constructor(options: ScrollsClientOptions = {}) {
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || 30000;
    this.network = options.network || "testnet4";
  }

  /**
   * Make HTTP request to Scrolls API
   */
  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new ScrollsAPIError(
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
  setNetwork(network: ScrollsNetwork): void {
    this.network = network;
    this.config = null; // Reset cached config
  }

  /**
   * Get current network
   */
  getNetwork(): ScrollsNetwork {
    return this.network;
  }

  /**
   * Get API configuration including fee addresses
   */
  async getConfig(): Promise<ScrollsConfig> {
    if (this.config) {
      return this.config;
    }

    this.config = await this.fetch<ScrollsConfig>("/config");
    return this.config;
  }

  /**
   * Get the fee address for the current network
   */
  async getFeeAddress(): Promise<string> {
    const config = await this.getConfig();
    return this.network === "main"
      ? config.fee_address.main
      : config.fee_address.testnet4;
  }

  /**
   * Derive an address from a nonce
   * The same nonce always results in the same address on the same network
   */
  async deriveAddress(nonce: number): Promise<string> {
    return this.fetch<string>(`/${this.network}/address/${nonce}`);
  }

  /**
   * Sign a transaction
   */
  async signTransaction(request: SignRequest): Promise<string> {
    return this.fetch<string>(`/${this.network}/sign`, {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  /**
   * Calculate fee for a transaction
   * Fee formula: fixed_cost + fee_per_input * number_of_inputs + fee_basis_points / 10000 * total_input_sats
   */
  async calculateFee(
    numberOfInputs: number,
    totalInputSats: number,
  ): Promise<FeeCalculation> {
    const config = await this.getConfig();

    const fixedCost = config.fixed_cost;
    const inputFees = config.fee_per_input * numberOfInputs;
    const percentageFee = Math.floor(
      (config.fee_basis_points / 10000) * totalInputSats,
    );
    const totalFee = fixedCost + inputFees + percentageFee;

    return {
      fixedCost,
      inputFees,
      percentageFee,
      totalFee,
      feeAddress: await this.getFeeAddress(),
    };
  }

  /**
   * Get token balances for an address
   *
   * NOTE: Scrolls API does not have a balance endpoint yet.
   * This method returns empty balances until the endpoint is available.
   * See: https://scrolls.charms.dev (only has /config, /address, /sign)
   *
   * @param address - Bitcoin address to query
   * @param _tokenTicker - Optional specific token ticker to filter (unused)
   */
  async getTokenBalances(
    address: string,
    _tokenTicker?: string,
  ): Promise<AddressTokenBalances> {
    // Scrolls API does not have balance endpoint - return empty
    // When Charms team adds this endpoint, implement the actual call here
    return {
      address,
      network: this.network,
      balances: [],
      blockHeight: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Get balance for a specific token
   *
   * NOTE: Scrolls API does not have a balance endpoint yet.
   *
   * @param _address - Bitcoin address to query (unused)
   * @param _tokenTicker - Token ticker (unused)
   */
  async getTokenBalance(
    _address: string,
    _tokenTicker: string,
  ): Promise<TokenBalance | null> {
    // Scrolls API does not have balance endpoint
    return null;
  }

  /**
   * Get token UTXOs for an address
   *
   * NOTE: Scrolls API does not have a UTXOs endpoint yet.
   *
   * @param _address - Bitcoin address to query (unused)
   * @param _tokenTicker - Optional token ticker to filter (unused)
   */
  async getTokenUTXOs(
    _address: string,
    _tokenTicker?: string,
  ): Promise<TokenUTXO[]> {
    // Scrolls API does not have UTXOs endpoint
    return [];
  }

  /**
   * Check if token balance API is available
   *
   * NOTE: Currently always returns false as Scrolls API
   * does not have balance/UTXOs endpoints yet.
   */
  async isTokenBalanceAvailable(): Promise<boolean> {
    // Scrolls API does not have balance endpoint yet
    return false;
  }
}

/**
 * Custom error for Scrolls API errors
 * Extends shared ApiError for consistency
 */
export class ScrollsAPIError extends ApiError {
  readonly statusCode: number;
  readonly response?: string;

  constructor(message: string, statusCode?: number, response?: string) {
    super("scrolls.charms.dev", statusCode, response || message);
    this.name = "ScrollsAPIError";
    this.statusCode = statusCode ?? 0;
    this.response = response;
  }
}

/**
 * Create a Scrolls client instance
 */
export function createScrollsClient(
  options?: ScrollsClientOptions,
): ScrollsClient {
  return new ScrollsClient(options);
}
