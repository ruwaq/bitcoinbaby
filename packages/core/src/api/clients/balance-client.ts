/**
 * Balance API Client
 *
 * Handles all balance-related operations:
 * - Get virtual balance
 * - Credit mining rewards
 * - Set hashrate for VarDiff
 * - Reset balance (testnet)
 */

import { BaseApiClient, type Environment } from "./base-client";
import type {
  ApiResponse,
  BalanceResponse,
  CreditResponse,
  MiningProof,
  SetHashrateResponse,
} from "../types";

export class BalanceClient extends BaseApiClient {
  constructor(env: Environment = "development") {
    super(env);
  }

  /**
   * Get user's virtual balance
   */
  async getBalance(address: string): Promise<ApiResponse<BalanceResponse>> {
    return this.get<BalanceResponse>(`/api/balance/${address}`);
  }

  /**
   * Credit mining reward to user's balance
   *
   * Note: Server handles idempotency via hash uniqueness
   */
  async creditMining(
    address: string,
    proof: MiningProof,
  ): Promise<ApiResponse<CreditResponse>> {
    return this.post<CreditResponse>(`/api/balance/${address}/credit`, proof);
  }

  /**
   * Report hashrate to get appropriate starting difficulty (VarDiff)
   *
   * This helps new miners start at an appropriate difficulty based on their device.
   * The VarDiff algorithm will fine-tune from there based on actual share submission rates.
   */
  async setHashrate(
    address: string,
    hashrate: number,
  ): Promise<ApiResponse<SetHashrateResponse>> {
    return this.post<SetHashrateResponse>(
      `/api/balance/${address}/set-hashrate`,
      { hashrate },
    );
  }

  /**
   * Reset user's balance and mining data (TESTNET ONLY)
   *
   * Clears:
   * - Virtual balance
   * - Total mined
   * - Mining proofs
   * - Difficulty state
   *
   * WARNING: This permanently deletes all mining progress.
   */
  async resetBalance(
    address: string,
  ): Promise<ApiResponse<{ reset: boolean }>> {
    return this.delete<{ reset: boolean }>(`/api/balance/${address}/reset`);
  }
}

// Singleton instance
let balanceClient: BalanceClient | null = null;

/**
 * Get balance client singleton
 */
export function getBalanceClient(env?: Environment): BalanceClient {
  if (!balanceClient) {
    balanceClient = new BalanceClient(env);
  }
  return balanceClient;
}
