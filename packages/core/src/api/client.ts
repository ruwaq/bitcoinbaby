/**
 * BitcoinBaby API Client
 *
 * Client for communicating with Cloudflare Workers backend.
 * Handles balance, withdrawals, and game state sync.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Error normalization
 */

import type {
  ApiResponse,
  BalanceResponse,
  CreditResponse,
  MiningProof,
  PoolType,
  PoolStatusResponse,
  WithdrawRequest,
  WithdrawResponse,
  GameState,
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardResponse,
  UserRankResponse,
  UserStats,
  SetHashrateResponse,
} from "./types";

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_ENDPOINTS = {
  development: "http://localhost:8787",
  production: "https://bitcoinbaby-api.andeanlabs-58f.workers.dev",
} as const;

type Environment = keyof typeof API_ENDPOINTS;

/** Default timeout for requests (10 seconds) */
const DEFAULT_TIMEOUT_MS = 10_000;

/** Max retries for transient failures */
const MAX_RETRIES = 3;

/** Base delay for exponential backoff (ms) */
const BASE_RETRY_DELAY_MS = 1000;

// =============================================================================
// RETRY HELPER
// =============================================================================

/**
 * Fetch with retry and timeout
 * Only retries on network errors and 5xx server errors
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = MAX_RETRIES,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx)
      if (response.status >= 500 && attempt < maxRetries) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[API] Server error ${response.status}, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on abort (timeout)
      if (lastError.name === "AbortError") {
        throw new Error(`Request timeout after ${timeoutMs}ms`);
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(
          `[API] Network error, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries}):`,
          lastError.message,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error("Request failed after retries");
}

// =============================================================================
// CLIENT
// =============================================================================

export class BitcoinBabyClient {
  private baseUrl: string;
  private environment: Environment;

  constructor(env: Environment = "development") {
    this.environment = env;
    this.baseUrl = API_ENDPOINTS[env];
  }

  /**
   * Set custom base URL (for testing or custom deployments)
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url;
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.environment;
  }

  // ===========================================================================
  // BALANCE API
  // ===========================================================================

  /**
   * Get user's virtual balance
   */
  async getBalance(address: string): Promise<ApiResponse<BalanceResponse>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/balance/${address}`,
    );
    return response.json() as Promise<ApiResponse<BalanceResponse>>;
  }

  /**
   * Credit mining reward to user's balance
   * Note: No retry on POST to prevent double-crediting
   */
  async creditMining(
    address: string,
    proof: MiningProof,
  ): Promise<ApiResponse<CreditResponse>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/balance/${address}/credit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      },
      0, // No retries for POST - server handles idempotency via hash uniqueness
    );
    return response.json() as Promise<ApiResponse<CreditResponse>>;
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
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/balance/${address}/set-hashrate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hashrate }),
      },
      1, // Single retry for this idempotent operation
    );
    return response.json() as Promise<ApiResponse<SetHashrateResponse>>;
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
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/balance/${address}/reset`,
      {
        method: "DELETE",
      },
      0, // No retries for destructive operation
    );
    return response.json() as Promise<ApiResponse<{ reset: boolean }>>;
  }

  // ===========================================================================
  // WITHDRAW POOL API
  // ===========================================================================

  /**
   * Get pool status
   */
  async getPoolStatus(
    poolType: PoolType,
  ): Promise<ApiResponse<PoolStatusResponse>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pool/${poolType}/status`,
    );
    return response.json() as Promise<ApiResponse<PoolStatusResponse>>;
  }

  /**
   * Get all pool statuses
   */
  async getAllPoolStatuses(): Promise<
    Record<PoolType, PoolStatusResponse | null>
  > {
    const pools: PoolType[] = ["weekly", "monthly", "low_fee", "immediate"];

    const results = await Promise.all(
      pools.map(async (poolType) => {
        try {
          const response = await this.getPoolStatus(poolType);
          return [
            poolType,
            response.success ? (response.data ?? null) : null,
          ] as const;
        } catch {
          return [poolType, null] as const;
        }
      }),
    );

    return Object.fromEntries(results) as Record<
      PoolType,
      PoolStatusResponse | null
    >;
  }

  /**
   * Create withdrawal request
   * Note: No retry to prevent duplicate withdrawal requests
   */
  async createWithdrawRequest(
    poolType: PoolType,
    fromAddress: string,
    toAddress: string,
    amount: string,
    maxFeeRate?: number,
  ): Promise<ApiResponse<WithdrawResponse>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pool/${poolType}/request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAddress,
          toAddress,
          amount,
          maxFeeRate,
        }),
      },
      0, // No retries for withdrawal creation
    );
    return response.json() as Promise<ApiResponse<WithdrawResponse>>;
  }

  /**
   * Cancel withdrawal request
   */
  async cancelWithdrawRequest(
    poolType: PoolType,
    requestId: string,
    fromAddress: string,
  ): Promise<ApiResponse<{ released: string; availableNow: string }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pool/${poolType}/cancel`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, fromAddress }),
      },
      1, // Single retry - operation is idempotent
    );
    return response.json() as Promise<
      ApiResponse<{ released: string; availableNow: string }>
    >;
  }

  /**
   * Get user's withdrawal requests
   */
  async getUserWithdrawRequests(
    poolType: PoolType,
    address: string,
  ): Promise<ApiResponse<WithdrawRequest[]>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pool/${poolType}/requests?address=${address}`,
    );
    return response.json() as Promise<ApiResponse<WithdrawRequest[]>>;
  }

  // ===========================================================================
  // GAME STATE API
  // ===========================================================================

  /**
   * Get current game state (HTTP, non-realtime)
   */
  async getGameState(roomId: string): Promise<ApiResponse<GameState>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/game/${roomId}/state`,
    );
    return response.json() as Promise<ApiResponse<GameState>>;
  }

  /**
   * Reset game state
   */
  async resetGameState(
    roomId: string,
  ): Promise<ApiResponse<{ reset: boolean }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/game/${roomId}/reset`,
      { method: "POST" },
      1, // Single retry - idempotent operation
    );
    return response.json() as Promise<ApiResponse<{ reset: boolean }>>;
  }

  /**
   * Get WebSocket URL for real-time game sync
   */
  getGameWebSocketUrl(roomId: string): string {
    const wsProtocol = this.baseUrl.startsWith("https") ? "wss" : "ws";
    const host = this.baseUrl.replace(/^https?:\/\//, "");
    return `${wsProtocol}://${host}/api/game/${roomId}`;
  }

  // ===========================================================================
  // LEADERBOARD API
  // ===========================================================================

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
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/leaderboard?${params}`,
    );
    return response.json() as Promise<ApiResponse<LeaderboardResponse>>;
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
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/leaderboard/rank/${address}?${params}`,
    );
    return response.json() as Promise<ApiResponse<UserRankResponse>>;
  }

  /**
   * Update user's score in leaderboard
   */
  async updateLeaderboard(
    address: string,
    category: LeaderboardCategory,
    score: number,
  ): Promise<ApiResponse<void>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/leaderboard/update`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, category, score }),
      },
      1, // Single retry - updates are idempotent
    );
    return response.json() as Promise<ApiResponse<void>>;
  }

  /**
   * Get user stats
   */
  async getUserStats(address: string): Promise<ApiResponse<UserStats | null>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/leaderboard/stats/${address}`,
    );
    return response.json() as Promise<ApiResponse<UserStats | null>>;
  }

  // ===========================================================================
  // NFT API
  // ===========================================================================

  /**
   * Get current NFT counter (total minted)
   */
  async getNFTCounter(): Promise<ApiResponse<{ count: number }>> {
    const response = await fetchWithRetry(`${this.baseUrl}/api/nft/counter`);
    return response.json() as Promise<ApiResponse<{ count: number }>>;
  }

  /**
   * Reserve next NFT ID (atomic increment)
   * Returns the reserved token ID for minting
   * No retry - atomic operation must not be duplicated
   */
  async reserveNFT(): Promise<
    ApiResponse<{ tokenId: number; totalMinted: number }>
  > {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/reserve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      0, // No retries - atomic counter
    );
    return response.json() as Promise<
      ApiResponse<{ tokenId: number; totalMinted: number }>
    >;
  }

  /**
   * Release a reserved NFT ID (when mint fails after reservation)
   * This allows the ID to be re-used
   */
  async releaseNFT(
    tokenId: number,
  ): Promise<ApiResponse<{ released: boolean }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/release/${tokenId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      0, // No retries - release is idempotent but should not spam
    );
    return response.json() as Promise<ApiResponse<{ released: boolean }>>;
  }

  /**
   * Confirm NFT mint after successful broadcast
   * Records the txid, address and full NFT data for indexing
   */
  async confirmNFTMint(
    tokenId: number,
    txid: string,
    address: string,
    nftData?: {
      dna: string;
      bloodline: string;
      baseType: string;
      rarityTier: string;
      level: number;
      xp: number;
      totalXp: number;
      workCount: number;
      evolutionCount: number;
    },
  ): Promise<ApiResponse<{ confirmed: boolean }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/confirm/${tokenId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid, address, nft: nftData }),
      },
      1, // Single retry - idempotent
    );
    return response.json() as Promise<ApiResponse<{ confirmed: boolean }>>;
  }

  /**
   * Get all NFTs owned by an address
   * Returns full NFT state for display
   */
  async getOwnedNFTs(
    address: string,
  ): Promise<ApiResponse<{ nfts: NFTRecord[]; count: number }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/owned/${address}`,
    );
    return response.json() as Promise<
      ApiResponse<{ nfts: NFTRecord[]; count: number }>
    >;
  }

  /**
   * Get a single NFT by token ID
   */
  async getNFT(tokenId: number): Promise<ApiResponse<NFTRecord | null>> {
    const response = await fetchWithRetry(`${this.baseUrl}/api/nft/${tokenId}`);
    return response.json() as Promise<ApiResponse<NFTRecord | null>>;
  }

  /**
   * Submit NFT to Charms prover for proof generation
   *
   * Returns commit + spell transaction hexes that need to be signed.
   * After signing, broadcast commitTx first, then spellTx.
   *
   * Flow:
   * 1. Reserve tokenId via reserveNFT()
   * 2. Generate NFT traits locally
   * 3. Call proveNFT() to get transactions
   * 4. Sign both transactions with wallet
   * 5. Broadcast commitTx, then spellTx
   * 6. Confirm via confirmNFTMint()
   */
  async proveNFT(params: {
    tokenId: number;
    address: string;
    nftState: {
      dna: string;
      bloodline: "royal" | "warrior" | "rogue" | "mystic";
      baseType: "human" | "animal" | "robot" | "mystic" | "alien";
      genesisBlock: number;
      rarityTier:
        | "common"
        | "uncommon"
        | "rare"
        | "epic"
        | "legendary"
        | "mythic";
      tokenId: number;
      level?: number;
      xp?: number;
      totalXp?: number;
      workCount?: number;
      lastWorkBlock?: number;
      evolutionCount?: number;
      tokensEarned?: string;
    };
    fundingUtxo: {
      txid: string;
      vout: number;
      value: number;
    };
  }): Promise<ApiResponse<NFTProveResult>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/prove`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
      0, // No retries - prover takes time
      120_000, // 2 minute timeout for proof generation
    );
    return response.json() as Promise<ApiResponse<NFTProveResult>>;
  }

  /**
   * Claim an NFT by providing the mint transaction ID
   * Verifies the transaction on blockchain and registers the NFT
   * Used to claim NFTs minted before the indexing system
   */
  async claimNFT(
    txid: string,
    address: string,
  ): Promise<ApiResponse<NFTRecord>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/claim`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txid, address }),
      },
      0, // No retries - could result in duplicate claims
    );
    return response.json() as Promise<ApiResponse<NFTRecord>>;
  }

  // ===========================================================================
  // MARKETPLACE
  // ===========================================================================

  /**
   * List an NFT for sale on the marketplace
   *
   * @param tokenId - NFT token ID
   * @param price - Price in satoshis
   * @param sellerAddress - Seller's Bitcoin address
   * @param sellerPsbt - Optional: Seller's signed PSBT (SIGHASH_SINGLE|ANYONECANPAY)
   * @param nftUtxo - Optional: NFT UTXO info for PSBT-based listings
   */
  async listNFT(
    tokenId: number,
    price: number,
    sellerAddress: string,
    sellerPsbt?: string,
    nftUtxo?: { txid: string; vout: number; value: number },
  ): Promise<ApiResponse<NFTListing>> {
    const response = await fetchWithRetry(`${this.baseUrl}/api/nft/list`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tokenId,
        price,
        sellerAddress,
        sellerPsbt,
        nftUtxo,
      }),
    });
    return response.json() as Promise<ApiResponse<NFTListing>>;
  }

  /**
   * Remove an NFT listing from the marketplace
   */
  async unlistNFT(
    tokenId: number,
    sellerAddress: string,
  ): Promise<ApiResponse<{ tokenId: number; unlisted: boolean }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/unlist/${tokenId}`,
      {
        method: "DELETE",
        headers: { "X-Wallet-Address": sellerAddress },
      },
    );
    return response.json() as Promise<
      ApiResponse<{ tokenId: number; unlisted: boolean }>
    >;
  }

  /**
   * Get all active marketplace listings
   */
  async getListings(): Promise<
    ApiResponse<{ listings: NFTListingWithNFT[]; count: number }>
  > {
    const response = await fetchWithRetry(`${this.baseUrl}/api/nft/listings`);
    return response.json() as Promise<
      ApiResponse<{ listings: NFTListingWithNFT[]; count: number }>
    >;
  }

  /**
   * Buy a listed NFT
   */
  async buyNFT(
    tokenId: number,
    buyerAddress: string,
    txid?: string,
  ): Promise<ApiResponse<NFTSale>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/buy/${tokenId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyerAddress, txid }),
      },
      0, // No retries for purchases
    );
    return response.json() as Promise<ApiResponse<NFTSale>>;
  }

  // ===========================================================================
  // WORK PROOF (XP FROM MINING)
  // ===========================================================================

  /**
   * Submit work proof to gain XP for an NFT
   *
   * When a user mines a valid share, their equipped NFT gains XP.
   */
  async submitWorkProof(
    tokenId: number,
    params: {
      ownerAddress: string;
      shareHash: string;
      difficulty: number;
      timestamp: number;
    },
  ): Promise<ApiResponse<WorkProofResult>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/${tokenId}/work-proof`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
      0, // No retries to prevent double XP
    );
    return response.json() as Promise<ApiResponse<WorkProofResult>>;
  }

  // ===========================================================================
  // NFT EXPLORER
  // ===========================================================================

  /**
   * Get all minted NFTs with filtering and pagination
   *
   * Used for the Explorer tab to browse all NFTs in the collection.
   */
  async getAllNFTs(
    query: NFTExplorerQuery = {},
  ): Promise<ApiResponse<NFTExplorerResponse>> {
    const params = new URLSearchParams();
    if (query.page) params.set("page", query.page.toString());
    if (query.limit) params.set("limit", query.limit.toString());
    if (query.sort) params.set("sort", query.sort);
    if (query.bloodline) params.set("bloodline", query.bloodline);
    if (query.rarity) params.set("rarity", query.rarity);
    if (query.forSale) params.set("forSale", query.forSale);

    const url = `${this.baseUrl}/api/nft/all${params.toString() ? `?${params.toString()}` : ""}`;
    const response = await fetchWithRetry(url);
    return response.json() as Promise<ApiResponse<NFTExplorerResponse>>;
  }

  /**
   * Get global NFT statistics
   *
   * Returns total minted, for sale count, distribution by rarity/bloodline.
   */
  async getNFTStats(): Promise<ApiResponse<NFTGlobalStats>> {
    const response = await fetchWithRetry(`${this.baseUrl}/api/nft/stats`);
    return response.json() as Promise<ApiResponse<NFTGlobalStats>>;
  }

  /**
   * Confirm on-chain evolution transaction
   *
   * Called after a client broadcasts an evolution transaction to the blockchain.
   * Updates the server state to reflect the new level.
   */
  async confirmEvolution(
    tokenId: number,
    txid: string,
    newLevel: number,
    address: string,
  ): Promise<ApiResponse<EvolutionConfirmResult>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/confirm-evolution`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, txid, newLevel, address }),
      },
    );
    return response.json() as Promise<ApiResponse<EvolutionConfirmResult>>;
  }
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

/**
 * Global NFT statistics
 */
export interface NFTGlobalStats {
  totalMinted: number;
  totalForSale: number;
  maxSupply: number;
  mintProgress: number;
  byRarity: Record<string, number>;
  byBloodline: Record<string, number>;
}

// =============================================================================
// SINGLETON INSTANCE
// =============================================================================

let clientInstance: BitcoinBabyClient | null = null;

/**
 * Get the API client singleton
 *
 * Always uses production Workers API by default.
 * The Workers API handles both testnet and mainnet.
 */
export function getApiClient(env?: Environment): BitcoinBabyClient {
  if (!clientInstance) {
    // Always use production - Workers API is deployed on Cloudflare
    // Development mode only used when explicitly requested
    clientInstance = new BitcoinBabyClient(env ?? "production");
  }
  return clientInstance;
}

/**
 * Reset client instance (useful for testing)
 */
export function resetApiClient(): void {
  clientInstance = null;
}
