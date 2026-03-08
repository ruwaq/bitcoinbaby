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

// =============================================================================
// NFT
// =============================================================================

/**
 * NFT record from server index
 * Note: tokensEarned is string because BigInt cannot be serialized to JSON
 */
export interface NFTRecord {
  tokenId: number;
  dna: string;
  bloodline: string;
  baseType: string;
  genesisBlock: number;
  rarityTier: string;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: string;
  txid: string;
  mintedAt: number;
}

/**
 * NFT marketplace listing
 */
export interface NFTListing {
  tokenId: string;
  price: string;
  sellerAddress: string;
  listedAt: string;
}

/**
 * Extended NFT record with listing and blockchain info
 */
export interface NFTRecordWithListing extends NFTRecord {
  /** Owner's Bitcoin address */
  address: string;
  /** Is currently listed for sale */
  isListed: boolean;
  /** Listing price in satoshis (if listed) */
  listingPrice?: number;
  /** When listed (timestamp, if listed) */
  listedAt?: number;
  /** URL to view on blockchain explorer */
  blockchainUrl: string;
}

/**
 * NFT global statistics
 */
export interface NFTGlobalStats {
  totalMinted: number;
  totalOwners: number;
  averageLevel: number;
  bloodlineDistribution: Record<string, number>;
  rarityDistribution: Record<string, number>;
}

/**
 * NFT listing with embedded NFT data for display
 */
export interface NFTListingWithNFT {
  tokenId: number;
  price: number;
  sellerAddress: string;
  listedAt: number;
  /** Seller's partially signed PSBT (SIGHASH_SINGLE|ANYONECANPAY) */
  sellerPsbt?: string;
  /** NFT UTXO info for transaction construction */
  nftUtxo?: {
    txid: string;
    vout: number;
    value: number;
  };
  nft: {
    dna: string;
    bloodline: string;
    baseType: string;
    rarityTier: string;
    level: number;
  };
}

/**
 * NFT sale record
 */
export interface NFTSale {
  tokenId: string;
  seller: string;
  buyer: string;
  price: string;
  txid: string;
  soldAt: string;
}

/**
 * Result from NFT prover submission
 */
export interface NFTProveResult {
  /** Reserved token ID */
  tokenId: number;
  /** Commit transaction hex (needs signing) */
  commitTxHex: string;
  /** Spell transaction hex (needs signing) */
  spellTxHex: string;
  /** Commit transaction ID */
  commitTxid: string;
  /** Spell transaction ID (final NFT location) */
  spellTxid: string;
  /** Instructions for next steps */
  nextSteps: string[];
}

/**
 * Work proof result from submitting mining XP
 */
export interface WorkProofResult {
  tokenId: number;
  xpGained: number;
  newXp: number;
  totalXp: number;
  workCount: number;
  bloodline: string;
  multiplier: number;
  canEvolve: boolean;
  xpToNextLevel: number;
}

/**
 * Evolution confirmation result
 */
export interface EvolutionConfirmResult {
  confirmed: boolean;
  nft: NFTRecord;
  txid: string;
  previousLevel: number;
  newLevel: number;
}

/**
 * NFT explorer query parameters
 */
export interface NFTExplorerQuery {
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "rarest" | "level" | "xp";
  bloodline?: "royal" | "warrior" | "rogue" | "mystic" | "all";
  rarity?:
    | "common"
    | "uncommon"
    | "rare"
    | "epic"
    | "legendary"
    | "mythic"
    | "all";
  forSale?: "true" | "false" | "all";
}

/**
 * NFT explorer response
 */
export interface NFTExplorerResponse {
  nfts: NFTRecordWithListing[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    total: number;
    forSale: number;
    byRarity: Record<string, number>;
    byBloodline: Record<string, number>;
  };
}
