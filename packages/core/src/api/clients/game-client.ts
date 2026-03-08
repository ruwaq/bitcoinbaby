/**
 * Game API Client
 *
 * Handles all game state operations:
 * - Get game state
 * - Reset game state
 * - WebSocket URLs for real-time sync
 */

import { BaseApiClient, type Environment } from "./base-client";
import type { ApiResponse, GameState } from "../types";

export class GameClient extends BaseApiClient {
  constructor(env: Environment = "development") {
    super(env);
  }

  /**
   * Get current game state (HTTP, non-realtime)
   */
  async getGameState(roomId: string): Promise<ApiResponse<GameState>> {
    return this.get<GameState>(`/api/game/${roomId}/state`);
  }

  /**
   * Reset game state
   */
  async resetGameState(
    roomId: string,
  ): Promise<ApiResponse<{ reset: boolean }>> {
    return this.post<{ reset: boolean }>(`/api/game/${roomId}/reset`);
  }

  /**
   * Get WebSocket URL for real-time game sync
   */
  getGameWebSocketUrl(roomId: string): string {
    const baseUrl = this.getBaseUrl();
    const wsProtocol = baseUrl.startsWith("https") ? "wss" : "ws";
    const host = baseUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}/api/game/${roomId}`;
  }
}

// Singleton instance
let gameClient: GameClient | null = null;

/**
 * Get game client singleton
 */
export function getGameClient(env?: Environment): GameClient {
  if (!gameClient) {
    gameClient = new GameClient(env);
  }
  return gameClient;
}
