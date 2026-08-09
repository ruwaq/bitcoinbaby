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
  AIProof,
  PouwTaskResponse,
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
import type { MintAttempt } from "./clients/nft-client";

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
        throw new Error(`Request timeout after ${timeoutMs}ms`, {
          cause: error,
        });
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
   * Get JIT useful work task for PoUW
   */
  async getPouwTask(address: string): Promise<ApiResponse<PouwTaskResponse>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pouw/${address}/task`,
    );
    return response.json() as Promise<ApiResponse<PouwTaskResponse>>;
  }

  /**
   * Verify AI PoUW submission server-side
   *
   * This is the security-critical step that prevents users from
   * spoofing AI inference results. The server validates:
   * - Task exists and is active (not expired or already used)
   * - Output meets quality requirements
   * - The submission is properly signed
   *
   * Only after server verification is the user credited.
   */
  async verifyPouwTask(
    address: string,
    proof: {
      taskId: string;
      output: string;
      computeTime: number;
      signature: string;
      publicKey: string;
    },
  ): Promise<
    ApiResponse<{ taskId: string; verified: boolean; reward: number }>
  > {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/pouw/${address}/verify`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof),
      },
      0, // No retries for POST — server handles idempotency
    );
    return response.json() as Promise<
      ApiResponse<{ taskId: string; verified: boolean; reward: number }>
    >;
  }

  /**
   * Credit mining reward to user's balance
   * Note: No retry on POST to prevent double-crediting
   */
  async creditMining(
    address: string,
    proof: MiningProof | AIProof,
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
   * Check prover health before minting
   * Returns availability status and latency
   */
  async checkProverHealth(): Promise<
    ApiResponse<{ available: boolean; latencyMs: number; error?: string }>
  > {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/prover-health`,
      { method: "GET" },
      1, // Single retry for health check
    );
    return response.json() as Promise<
      ApiResponse<{ available: boolean; latencyMs: number; error?: string }>
    >;
  }

  /**
   * Get mint attempts for an address
   * Shows pending, failed, and recent successful mints
   */
  async getMintAttempts(
    address: string,
  ): Promise<ApiResponse<{ attempts: MintAttempt[]; count: number }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/mint-attempts/${address}`,
      { method: "GET" },
      2,
    );
    return response.json() as Promise<
      ApiResponse<{ attempts: MintAttempt[]; count: number }>
    >;
  }

  /**
   * Update mint attempt status
   * Call this at each step of the minting process for user visibility
   */
  async updateMintAttempt(
    attemptId: string,
    status: MintAttempt["status"],
    options?: { error?: string; commitTxid?: string; spellTxid?: string },
  ): Promise<ApiResponse<{ updated: boolean; status: string }>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/update-attempt`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId, status, ...options }),
      },
      1,
    );
    return response.json() as Promise<
      ApiResponse<{ updated: boolean; status: string }>
    >;
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

  // ===========================================================================
  // UNIFIED /mint FLOW (D3 + D6)
  // ===========================================================================

  /**
   * Step 1 of the unified mint: prepare the atomic spell server-side.
   *
   * The server derives the tokenId + traits (the client never sends traits —
   * closes the mythic-always bug #2), verifies the funding UTXO belongs to the
   * caller, and builds an atomic spell where the NFT coin and the treasury
   * payment are in the SAME Bitcoin tx (closes the free-mint bug #1).
   *
   * Returns the unsigned commit + spell hexes that the client must sign and
   * broadcast (commit first), then call `finalizeMint`.
   */
  async prepareMint(params: {
    address: string;
    fundingUtxo: { txid: string; vout: number; value: number };
  }): Promise<ApiResponse<MintPrepareResult>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/mint/prepare`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
      0, // No retries - prover takes time
      120_000, // 2 minute timeout for proof generation
    );
    return response.json() as Promise<ApiResponse<MintPrepareResult>>;
  }

  /**
   * Step 2 of the unified mint: finalize after broadcasting the spell tx.
   *
   * The server verifies the spell tx on-chain (confirmed + NFT dust to owner
   * + price to treasury) and persists the NFT to the indexer. Closes the
   * blind-trust bug #6 and the replay bug #5.
   */
  async finalizeMint(params: {
    spellTxid: string;
    address: string;
  }): Promise<ApiResponse<MintFinalizeResult>> {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/mint/finalize`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
      1, // Single retry - idempotent on success
    );
    return response.json() as Promise<ApiResponse<MintFinalizeResult>>;
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
   * Request virtual NFT evolution (Phase 1 — debits virtual SPARK)
   *
   * Server-side evolution that deducts virtual BALANCE without requiring
   * an on-chain transaction. Returns updated NFT state.
   */
  async evolveNFT(
    tokenId: number,
    address: string,
    currentLevel: number,
  ): Promise<
    ApiResponse<{
      nft: NFTRecord;
      previousLevel: number;
      newLevel: number;
    }>
  > {
    const response = await fetchWithRetry(
      `${this.baseUrl}/api/nft/evolve`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId, address, currentLevel }),
      },
      0, // No retries — server handles idempotency
    );
    return response.json() as Promise<
      ApiResponse<{
        nft: NFTRecord;
        evolutionCost: string;
        previousLevel: number;
        newLevel: number;
      }>
    >;
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

// =============================================================================
// UNIFIED /mint FLOW (D3 + D6)
// =============================================================================

/**
 * NFT traits generated server-side by /mint/prepare.
 *
 * The client never supplies these — that was the root cause of the
 * mythic-always bug (#2). The server derives them deterministically from the
 * funding txid, so they are unfakeable.
 */
export interface MintTraits {
  dna: string;
  bloodline: string;
  baseType: string;
  rarityTier: string;
}

/**
 * Response from `POST /api/nft/mint/prepare`.
 *
 * The server picks the tokenId, derives traits, and builds an atomic spell
 * (NFT coin + treasury payment in the same Bitcoin tx). The client must sign
 * `commitTxHex` and `spellTxHex`, broadcast them, then call `finalizeMint`.
 */
export interface MintPrepareResult {
  tokenId: number;
  traits: MintTraits;
  commitTxHex: string;
  spellTxHex: string;
  commitTxid: string;
  spellTxid: string;
  /** Mint price in sats paid to the treasury in the atomic tx */
  priceSats: number;
  /** Treasury address receiving the payment */
  treasuryAddress: string;
  nextSteps: string[];
}

/**
 * Response from `POST /api/nft/mint/finalize`.
 *
 * The server verifies the spell tx on-chain (confirmed + outputs) and persists
 * the NFT to the indexer.
 */
export interface MintFinalizeResult {
  confirmed: boolean;
  tokenId: number;
  traits: MintTraits;
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
    let resolvedEnv: Environment = "production";

    // Auto-detect development mode if running on localhost/127.0.0.1 or NEXT_PUBLIC_WORKERS_API_URL is configured
    const hasNextPublicUrl =
      typeof process !== "undefined" &&
      process?.env &&
      process.env.NEXT_PUBLIC_WORKERS_API_URL;
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (env) {
      resolvedEnv = env;
    } else if (hasNextPublicUrl || isLocalhost) {
      resolvedEnv = "development";
    }

    clientInstance = new BitcoinBabyClient(resolvedEnv);

    // Apply custom URL override if configured
    if (
      typeof process !== "undefined" &&
      process?.env &&
      process.env.NEXT_PUBLIC_WORKERS_API_URL
    ) {
      clientInstance.setBaseUrl(process.env.NEXT_PUBLIC_WORKERS_API_URL);
    }
  }
  return clientInstance;
}

/**
 * Reset client instance (useful for testing)
 */
export function resetApiClient(): void {
  clientInstance = null;
}
