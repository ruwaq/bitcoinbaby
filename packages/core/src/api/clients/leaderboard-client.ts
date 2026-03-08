/**
 * Leaderboard API Client
 *
 * Handles all leaderboard operations:
 * - Get leaderboard entries
 * - Get user rank
 * - Update scores
 * - Get user stats
 */

import { BaseApiClient, type Environment } from "./base-client";
import type {
  ApiResponse,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardResponse,
  UserRankResponse,
  UserStats,
} from "../types";

export class LeaderboardClient extends BaseApiClient {
  constructor(env: Environment = "development") {
    super(env);
  }

  /**
   * Get leaderboard entries
   */
  async getLeaderboard(
    category: LeaderboardCategory = "miners",
    period: LeaderboardPeriod = "alltime",
    limit: number = 100,
    offset: number = 0,
  ): Promise<ApiResponse<LeaderboardResponse>> {
    const params = new URLSearchParams({
      category,
      period,
      limit: limit.toString(),
      offset: offset.toString(),
    });
    return this.get<LeaderboardResponse>(`/api/leaderboard?${params}`);
  }

  /**
   * Get user's rank in leaderboard
   */
  async getUserRank(
    address: string,
    category: LeaderboardCategory = "miners",
    period: LeaderboardPeriod = "alltime",
  ): Promise<ApiResponse<UserRankResponse>> {
    const params = new URLSearchParams({ category, period });
    return this.get<UserRankResponse>(
      `/api/leaderboard/rank/${address}?${params}`,
    );
  }

  /**
   * Update user's score in leaderboard
   */
  async updateLeaderboard(
    address: string,
    category: LeaderboardCategory,
    score: number,
  ): Promise<ApiResponse<void>> {
    return this.post<void>(`/api/leaderboard/update`, {
      address,
      category,
      score,
    });
  }

  /**
   * Get user stats
   */
  async getUserStats(address: string): Promise<ApiResponse<UserStats | null>> {
    return this.get<UserStats | null>(`/api/leaderboard/stats/${address}`);
  }
}

// Singleton instance
let leaderboardClient: LeaderboardClient | null = null;

/**
 * Get leaderboard client singleton
 */
export function getLeaderboardClient(env?: Environment): LeaderboardClient {
  if (!leaderboardClient) {
    leaderboardClient = new LeaderboardClient(env);
  }
  return leaderboardClient;
}
