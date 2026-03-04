/**
 * BitcoinBaby API Client - Type Definitions
 *
 * Types for communicating with Cloudflare Workers backend.
 */

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// =============================================================================
// BALANCE
// =============================================================================

export interface BalanceResponse {
  address: string;
  virtualBalance: string;
  pendingWithdraw: string;
  availableToWithdraw: string;
  totalMined: string;
  totalWithdrawn: string;
  /** Server-assigned difficulty (VarDiff) */
  suggestedDifficulty?: number;
  /** Average time between shares */
  averageShareTime?: number;
  /** Engagement state (for bonuses) */
  engagement?: {
    dailyStreak: number;
    playTimeToday: number;
    lastLoginDay: string;
    currentMultiplier: number;
  };
}

export interface CreditResponse {
  credited: string;
  newBalance: string;
  proofId: string;
  /** Streak bonus information */
  streakInfo?: {
    consecutiveShares: number;
    multiplier: number;
    baseReward: string;
    boostedReward: string;
    nextTierAt: number;
  };
  /** VarDiff (Variable Difficulty) information */
  varDiff?: {
    suggestedDifficulty: number;
    averageShareTime: number;
    difficultyChanged: boolean;
  };
  /** Engagement bonus information */
  engagement?: {
    multiplier: number;
    breakdown: {
      babyCare: number;
      dailyStreak: number;
      playTime: number;
    };
    status: "inactive" | "casual" | "engaged" | "dedicated";
  };
}

/** Response from setHashrate endpoint */
export interface SetHashrateResponse {
  suggestedDifficulty: number;
  estimatedShareTime: number;
}

export interface MiningProof {
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  timestamp?: number;
}

// =============================================================================
// WITHDRAW POOL
// =============================================================================

export type PoolType = "weekly" | "monthly" | "low_fee" | "immediate";
export type WithdrawStatus =
  | "pending"
  | "processing"
  | "broadcast"
  | "confirmed"
  | "failed"
  | "cancelled";

export interface PoolStatusResponse {
  poolType: PoolType;
  name: string;
  description: string;
  pendingRequests: number;
  totalAmount: string;
  nextProcessingTime: string;
  currentFeeRate: number;
  estimatedFeePerUser: number;
}

export interface WithdrawRequest {
  id: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  poolType: PoolType;
  maxFeeRate: number | null;
  status: WithdrawStatus;
  txid: string | null;
  error: string | null;
  requestedAt: number;
  updatedAt: number;
}

export interface WithdrawResponse {
  requestId: string;
  amount: string;
  poolType: PoolType;
  estimatedProcessingTime: string;
  estimatedFee: number;
  position: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

export interface GameStats {
  energy: number;
  happiness: number;
  hunger: number;
  health: number;
}

export interface GameState {
  level: number;
  xp: number;
  xpToNextLevel: number;
  stage: string;
  name: string;
  stats: GameStats;
  achievements: string[];
  totalHashes: number;
  totalShares: number;
  lastSyncAt: number;
}

// =============================================================================
// LEADERBOARD
// =============================================================================

export type LeaderboardCategory = "miners" | "babies" | "earners";
export type LeaderboardPeriod = "daily" | "weekly" | "alltime";

export interface LeaderboardEntry {
  address: string;
  score: number;
  rank: number;
  cosmicBonus?: number;
  lastActive?: number;
}

export interface LeaderboardResponse {
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  totalEntries: number;
  lastUpdated: number;
}

export interface UserRankResponse {
  address: string;
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  rank: number | null;
  score: number;
}

export interface UserStats {
  address: string;
  totalHashes: number;
  totalTokens: number;
  babyLevel: number;
  cosmicBonus: number;
  lastActive: number;
}

// =============================================================================
// WEBSOCKET MESSAGES
// =============================================================================

export type WsMessageType =
  | "yjs-sync"
  | "yjs-update"
  | "ping"
  | "pong"
  | "get-state";

export interface WsMessage {
  type: WsMessageType;
  data?: number[];
  clientId?: string;
  reset?: boolean;
}
