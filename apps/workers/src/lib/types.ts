/**
 * BitcoinBaby Workers - Type Definitions
 *
 * Production types for the virtual balance and withdrawal system.
 */

// =============================================================================
// ENVIRONMENT
// =============================================================================

export interface Env {
  // Durable Objects
  VIRTUAL_BALANCE: DurableObjectNamespace;
  WITHDRAW_POOL: DurableObjectNamespace;
  GAME_ROOM: DurableObjectNamespace;

  // KV Namespace
  CACHE: KVNamespace;

  // Environment variables
  ENVIRONMENT: "development" | "production";
  MIN_WITHDRAW_AMOUNT: string;
  POOL_PERIOD_DAYS: string;
  MAX_FEE_RATE_SAT_VB: string;

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;

  // Secrets
  SCROLLS_API_KEY?: string;
  BATCH_WALLET_SEED?: string;
  ADMIN_KEY?: string;

  // Charms/Prover configuration
  PROVER_URL?: string;
  CHARMS_PROVER_URL?: string;
  TREASURY_ADDRESS?: string;

  // BABTC Token configuration
  BABTC_APP_VK?: string;
  BABTC_GENESIS?: string;
  SCROLLS_API_URL?: string;
}

// =============================================================================
// VIRTUAL BALANCE
// =============================================================================

/**
 * User's virtual balance stored in Durable Object
 */
export interface VirtualBalance {
  /** User's Bitcoin address (identifier) */
  address: string;
  /** Virtual balance (not yet on-chain) */
  virtualBalance: bigint;
  /** Total mined all-time */
  totalMined: bigint;
  /** Total withdrawn to Bitcoin */
  totalWithdrawn: bigint;
  /** Amount currently pending withdrawal */
  pendingWithdraw: bigint;
  /** Current mining streak count (for bonus) */
  streakCount: number;
  /** Last mining activity timestamp */
  lastMiningAt: number;
  /** Account creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Mining proof submitted by user
 *
 * SECURITY: Server validates all fields - never trust client data
 * - hash must match SHA256(blockData + nonce)
 * - hash must have required leading zeros (difficulty)
 * - reward is calculated server-side (client value ignored)
 */
export interface MiningProof {
  /** Unique proof ID */
  id?: string;
  /** User's Bitcoin address */
  address?: string;
  /** Mining hash - MUST match SHA256(blockData + nonce) */
  hash: string;
  /** Nonce that solved the puzzle */
  nonce: number;
  /** Difficulty achieved (leading zero bits) */
  difficulty: number;
  /** Block data used - required for hash verification */
  blockData: string;
  /** Timestamp of mining (optional, validated if provided) */
  timestamp?: number;
  /** Calculated reward in tokens (ignored by server - calculated server-side) */
  reward?: bigint;
  /** Whether this proof has been credited */
  credited?: boolean;
}

// =============================================================================
// WITHDRAW POOL
// =============================================================================

/**
 * Withdrawal request from user
 */
export interface WithdrawRequest {
  /** Unique request ID */
  id: string;
  /** User's Bitcoin address (source of virtual balance) */
  fromAddress: string;
  /** Destination Bitcoin address for tokens */
  toAddress: string;
  /** Amount to withdraw */
  amount: bigint;
  /** Pool type chosen by user */
  poolType: PoolType;
  /** Maximum fee rate user is willing to pay (sat/vB) */
  maxFeeRate: number | null;
  /** Request timestamp */
  requestedAt: number;
  /** Status of the request */
  status: WithdrawStatus;
  /** Transaction ID if processed */
  txid: string | null;
  /** Error message if failed */
  error: string | null;
  /** When status was last updated */
  updatedAt: number;
}

export type PoolType =
  | "weekly" // Process every Sunday (cheapest)
  | "monthly" // Process on 1st of month (cheapest)
  | "low_fee" // Process when fees < threshold
  | "immediate"; // Process ASAP (most expensive)

export type WithdrawStatus =
  | "pending" // Waiting in pool
  | "processing" // Being included in batch TX
  | "broadcast" // TX broadcast, waiting confirmation
  | "confirmed" // TX confirmed on-chain
  | "failed" // Failed to process
  | "cancelled"; // Cancelled by user

/**
 * Batch transaction for multiple withdrawals
 */
export interface BatchTransaction {
  /** Unique batch ID */
  id: string;
  /** Withdrawal requests included */
  requests: string[]; // Request IDs
  /** Total amount in batch */
  totalAmount: bigint;
  /** Number of recipients */
  recipientCount: number;
  /** Transaction hex (unsigned) */
  txHex: string | null;
  /** Transaction ID after broadcast */
  txid: string | null;
  /** Fee rate used (sat/vB) */
  feeRate: number;
  /** Total fee paid */
  totalFee: number;
  /** Fee per recipient */
  feePerRecipient: number;
  /** Status */
  status: "building" | "ready" | "broadcast" | "confirmed" | "failed";
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

// =============================================================================
// GAME STATE
// =============================================================================

/**
 * Game state synced via Yjs
 */
export interface GameState {
  /** Baby's current level */
  level: number;
  /** Current XP */
  xp: number;
  /** XP needed for next level */
  xpToNextLevel: number;
  /** Current evolution stage */
  stage: string;
  /** Baby's name */
  name: string;
  /** Stats */
  stats: {
    energy: number;
    happiness: number;
    hunger: number;
    health: number;
  };
  /** Unlocked achievements */
  achievements: string[];
  /** Total hashes mined */
  totalHashes: number;
  /** Total shares found */
  totalShares: number;
  /** Last sync timestamp */
  lastSyncAt: number;
}

// =============================================================================
// API RESPONSES
// =============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Validation error details */
  details?: Record<string, string[] | undefined>;
  timestamp: number;
}

export interface BalanceResponse {
  address: string;
  virtualBalance: string; // BigInt as string
  pendingWithdraw: string;
  availableToWithdraw: string;
  totalMined: string;
  totalWithdrawn: string;
}

export interface WithdrawResponse {
  requestId: string;
  amount: string;
  poolType: PoolType;
  estimatedProcessingTime: string;
  estimatedFee: number;
  position: number;
}

export interface PoolStatusResponse {
  poolType: PoolType;
  pendingRequests: number;
  totalAmount: string;
  nextProcessingTime: string;
  currentFeeRate: number;
  estimatedFeePerUser: number;
}

// =============================================================================
// BITCOIN/CHARMS
// =============================================================================

export interface FeeEstimate {
  fastestFee: number; // sat/vB
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface CharmsSpell {
  version: string;
  app: string;
  operations: CharmsOperation[];
}

export interface CharmsOperation {
  type: "mint" | "transfer" | "burn";
  token: string;
  amount: bigint;
  recipient?: string;
  proof?: string;
}

// =============================================================================
// LEADERBOARD
// =============================================================================

export type LeaderboardCategory = "miners" | "babies" | "earners";
export type LeaderboardPeriod = "daily" | "weekly" | "alltime";

export interface LeaderboardEntry {
  /** User's Bitcoin address */
  address: string;
  /** Score value */
  score: number;
  /** Rank position (1-based) */
  rank: number;
  /** Cosmic bonus multiplier (optional) */
  cosmicBonus?: number;
  /** Last active timestamp */
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
