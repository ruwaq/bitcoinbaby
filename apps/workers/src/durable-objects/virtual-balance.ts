/**
 * Virtual Balance Durable Object
 *
 * Manages each user's virtual $BABY token balance.
 * Tokens are accumulated here until user decides to withdraw to Bitcoin.
 *
 * Storage: SQLite (free tier on Cloudflare)
 * One instance per user address.
 *
 * SECURITY:
 * - All proofs are validated server-side (SHA256 + difficulty check)
 * - Rewards are calculated server-side (never trust client)
 * - Rate limiting is enforced
 * - Proof hashes are globally unique (prevents cross-address submission)
 */

import { DurableObject } from "cloudflare:workers";
import { balanceLogger } from "../lib/logger";
import type {
  Env,
  VirtualBalance,
  MiningProof,
  ApiResponse,
  BalanceResponse,
  ClaimableBalance,
  ClaimPrepareResponse,
  ClaimConfirmResponse,
  ClaimRequest,
  ClaimStatus,
} from "../lib/types";
import { CLAIM_EXPIRATION_MS } from "../lib/types";
import {
  getProofAggregator,
  calculateWorkFromDifficulty,
  estimateClaimFee,
} from "../services/proof-aggregator";
import {
  validateMiningProof,
  checkRateLimit,
  getStreakMultiplier,
  isProofUsedGlobally,
  markProofUsedGlobally,
  STREAK_RESET_MS,
  MIN_DIFFICULTY,
} from "../lib/proof-validation";
import {
  processShare,
  createInitialState,
  serializeState,
  deserializeState,
  estimateInitialDifficulty,
  type UserDifficultyState,
  VARDIFF_CONFIG,
} from "../lib/vardiff";
import { getRedis, updateAllPeriods, updateUserStats } from "../lib/redis";
import { getNFTBoostData, getNFTMultiplier } from "../lib/nft-boost";
import {
  getEngagementBoostData,
  getEngagementMultiplier,
} from "../lib/engagement-boost";
import { getCosmicBoostData, getCosmicMultiplier } from "../lib/cosmic-boost";
import { MULTIPLIER_CONFIG } from "../lib/reward-multipliers";

// Minimum withdraw amount (from env)
const DEFAULT_MIN_WITHDRAW = 100n;

export class VirtualBalanceDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private address: string | null = null;

  // In-memory cache to reduce DB reads
  private cachedBalance: VirtualBalance | null = null;
  private cacheLoadedAt: number = 0;
  private static readonly CACHE_TTL_MS = 60_000; // 1 minute cache

  // Rate limit cache - avoid COUNT query on every request
  private sharesThisHourCache: number = 0;
  private sharesHourStartedAt: number = 0;

  // VarDiff state cache
  private difficultyState: UserDifficultyState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize database schema
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
    });
  }

  /**
   * Initialize SQLite schema
   */
  private async initializeSchema(): Promise<void> {
    // Balance table (includes streak for efficiency)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS balance (
        address TEXT PRIMARY KEY,
        virtual_balance TEXT NOT NULL DEFAULT '0',
        total_mined TEXT NOT NULL DEFAULT '0',
        total_withdrawn TEXT NOT NULL DEFAULT '0',
        pending_withdraw TEXT NOT NULL DEFAULT '0',
        streak_count INTEGER NOT NULL DEFAULT 0,
        last_mining_at INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // Add streak_count if not exists (migration)
    try {
      this.sql.exec(
        `ALTER TABLE balance ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      // Column already exists
    }

    // Add difficulty_state if not exists (VarDiff migration)
    try {
      this.sql.exec(`ALTER TABLE balance ADD COLUMN difficulty_state TEXT`);
    } catch {
      // Column already exists
    }

    // Mining proofs table (for audit trail)
    // SECURITY: Hash is UNIQUE to prevent same proof being submitted multiple times
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS mining_proofs (
        id TEXT PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        nonce INTEGER NOT NULL,
        difficulty INTEGER NOT NULL,
        block_data TEXT NOT NULL,
        reward TEXT NOT NULL,
        credited INTEGER NOT NULL DEFAULT 0,
        address TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    // Migration: Add address column if it doesn't exist (for existing tables)
    try {
      this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN address TEXT`);
    } catch {
      // Column already exists
    }

    // Indexes
    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_proofs_credited
      ON mining_proofs(credited)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_proofs_address
      ON mining_proofs(address)
    `);

    // Add claimed column for tracking which proofs have been claimed
    try {
      this.sql.exec(
        `ALTER TABLE mining_proofs ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      // Column already exists
    }

    try {
      this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN claim_id TEXT`);
    } catch {
      // Column already exists
    }

    // Claims table - tracks user claim requests
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        address TEXT NOT NULL,
        amount TEXT NOT NULL,
        proof_count INTEGER NOT NULL,
        total_work TEXT NOT NULL,
        merkle_root TEXT,
        server_signature TEXT,
        op_return_data TEXT,
        claim_txid TEXT,
        mint_txid TEXT,
        status TEXT NOT NULL DEFAULT 'prepared',
        error TEXT,
        prepared_at INTEGER NOT NULL,
        confirmed_at INTEGER,
        minted_at INTEGER,
        expires_at INTEGER NOT NULL
      )
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_address
      ON claims(address)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_claims_status
      ON claims(status)
    `);

    this.sql.exec(`
      CREATE INDEX IF NOT EXISTS idx_proofs_claimed
      ON mining_proofs(claimed)
    `);
  }

  /**
   * Get or create balance record (uses in-memory cache)
   * OPTIMIZATION: Cache balance in memory to reduce DB reads by ~90%
   */
  private getOrCreateBalance(address: string): VirtualBalance {
    const now = Date.now();

    // Return cached balance if still valid
    if (
      this.cachedBalance &&
      this.cachedBalance.address === address &&
      now - this.cacheLoadedAt < VirtualBalanceDO.CACHE_TTL_MS
    ) {
      return this.cachedBalance;
    }

    // Try to get existing - single read
    const rows = this.sql
      .exec("SELECT * FROM balance WHERE address = ? LIMIT 1", address)
      .toArray();

    if (rows.length > 0) {
      const row = rows[0];
      this.cachedBalance = {
        address: row.address as string,
        virtualBalance: BigInt(row.virtual_balance as string),
        totalMined: BigInt(row.total_mined as string),
        totalWithdrawn: BigInt(row.total_withdrawn as string),
        pendingWithdraw: BigInt(row.pending_withdraw as string),
        streakCount: (row.streak_count as number) || 0,
        lastMiningAt: row.last_mining_at as number,
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
      };
      // Load VarDiff state
      this.difficultyState = deserializeState(
        row.difficulty_state as string | null,
      );
      this.cacheLoadedAt = now;
      return this.cachedBalance;
    }

    // Create new
    this.sql.exec(
      `INSERT INTO balance (address, streak_count, created_at, updated_at) VALUES (?, 0, ?, ?)`,
      address,
      now,
      now,
    );

    this.cachedBalance = {
      address,
      virtualBalance: 0n,
      totalMined: 0n,
      totalWithdrawn: 0n,
      pendingWithdraw: 0n,
      streakCount: 0,
      lastMiningAt: 0,
      createdAt: now,
      updatedAt: now,
    };
    // Initialize VarDiff state for new user
    this.difficultyState = createInitialState();
    this.cacheLoadedAt = now;
    return this.cachedBalance;
  }

  /**
   * Update balance in database and cache
   */
  private updateBalance(balance: VirtualBalance): void {
    const now = Date.now();
    const diffStateJson = this.difficultyState
      ? serializeState(this.difficultyState)
      : null;

    this.sql.exec(
      `UPDATE balance SET
        virtual_balance = ?,
        total_mined = ?,
        total_withdrawn = ?,
        pending_withdraw = ?,
        streak_count = ?,
        last_mining_at = ?,
        difficulty_state = ?,
        updated_at = ?
       WHERE address = ?`,
      balance.virtualBalance.toString(),
      balance.totalMined.toString(),
      balance.totalWithdrawn.toString(),
      balance.pendingWithdraw.toString(),
      balance.streakCount,
      balance.lastMiningAt,
      diffStateJson,
      now,
      balance.address,
    );

    // Update cache after write
    this.cachedBalance = { ...balance, updatedAt: now };
    this.cacheLoadedAt = now;
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Extract address from path: /balance/{address}/...
      const pathParts = path.split("/").filter(Boolean);
      if (pathParts.length < 2 || pathParts[0] !== "balance") {
        return this.errorResponse("Invalid path", 400);
      }

      this.address = pathParts[1];
      const action = pathParts[2] || "get";

      switch (request.method) {
        case "GET":
          if (action === "get" || action === "") {
            return this.handleGetBalance();
          }
          if (action === "history") {
            const limitParam = url.searchParams.get("limit");
            const limit = limitParam ? parseInt(limitParam, 10) : 100;
            return this.handleGetHistory(limit);
          }
          // Claim system endpoints
          if (action === "claimable") {
            return this.handleGetClaimableBalance();
          }
          if (action === "claim-history") {
            return this.handleGetClaimHistory();
          }
          if (action === "claim-status") {
            const claimId = pathParts[3];
            if (!claimId) {
              return this.errorResponse("Claim ID required", 400);
            }
            return this.handleGetClaimStatus(claimId);
          }
          break;

        case "POST":
          if (action === "credit") {
            return this.handleCreditMining(request);
          }
          if (action === "reserve") {
            return this.handleReserveWithdraw(request);
          }
          if (action === "confirm-withdraw") {
            return this.handleConfirmWithdraw(request);
          }
          if (action === "cancel-withdraw") {
            return this.handleCancelWithdraw(request);
          }
          if (action === "set-hashrate") {
            return this.handleSetHashrate(request);
          }
          if (action === "deduct") {
            return this.handleDeductBalance(request);
          }
          // Claim system endpoints
          if (action === "prepare-claim") {
            return this.handlePrepareClaim();
          }
          if (action === "confirm-claim") {
            return this.handleConfirmClaim(request);
          }
          if (action === "update-claim-status") {
            return this.handleUpdateClaimStatus(request);
          }
          if (action === "cancel-claim") {
            return this.handleCancelClaim(request);
          }
          break;

        case "DELETE":
          if (action === "reset") {
            return this.handleReset();
          }
          if (action === "full-reset") {
            return this.handleFullReset();
          }
          break;
      }

      return this.errorResponse("Not found", 404);
    } catch (error) {
      balanceLogger.error("Request error", error);
      return this.errorResponse(
        error instanceof Error ? error.message : "Internal error",
        500,
      );
    }
  }

  /**
   * GET /balance/{address} - Get current balance
   */
  private handleGetBalance(): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const balance = this.getOrCreateBalance(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    // Ensure difficulty state is initialized
    if (!this.difficultyState) {
      this.difficultyState = createInitialState();
    }

    const response: ApiResponse<
      BalanceResponse & {
        suggestedDifficulty: number;
        averageShareTime: number;
      }
    > = {
      success: true,
      data: {
        address: balance.address,
        virtualBalance: balance.virtualBalance.toString(),
        pendingWithdraw: balance.pendingWithdraw.toString(),
        availableToWithdraw: (available > 0n ? available : 0n).toString(),
        totalMined: balance.totalMined.toString(),
        totalWithdrawn: balance.totalWithdrawn.toString(),
        suggestedDifficulty: this.difficultyState.currentDiff,
        averageShareTime: this.difficultyState.averageShareTime,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * GET /balance/{address}/history - Get mining history
   */
  private handleGetHistory(limit: number): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    // Get mining proofs (reward history)
    const rows = this.sql
      .exec(
        `SELECT id, reward, created_at
         FROM mining_proofs
         WHERE credited = 1
         ORDER BY created_at DESC
         LIMIT ?`,
        Math.min(limit, 100), // Cap at 100
      )
      .toArray();

    const history = rows.map((row) => ({
      id: row.id as string,
      amount: row.reward as string,
      timestamp: row.created_at as number,
      type: "mining" as const,
    }));

    const response: ApiResponse<{
      history: Array<{
        id: string;
        amount: string;
        timestamp: number;
        type: string;
      }>;
    }> = {
      success: true,
      data: { history },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/set-hashrate - Report hashrate to estimate initial difficulty
   *
   * This allows new miners to get an appropriate starting difficulty based on their device.
   * The VarDiff algorithm will fine-tune from there.
   */
  private async handleSetHashrate(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      hashrate: number;
    };

    if (typeof body.hashrate !== "number" || body.hashrate < 0) {
      return this.errorResponse("Invalid hashrate", 400);
    }

    // Initialize balance and difficulty state
    this.getOrCreateBalance(this.address);

    if (!this.difficultyState) {
      this.difficultyState = createInitialState();
    }

    // Estimate initial difficulty based on hashrate
    const estimatedDiff = estimateInitialDifficulty(
      body.hashrate,
      VARDIFF_CONFIG.targetTime,
      VARDIFF_CONFIG,
    );

    // Only update if new difficulty is different and higher than current
    // (don't let users artificially lower their difficulty)
    if (estimatedDiff > this.difficultyState.currentDiff) {
      this.difficultyState.currentDiff = estimatedDiff;
      // Force save the updated difficulty state
      this.updateBalance(this.cachedBalance!);

      balanceLogger.info("Set initial difficulty", {
        address: this.address,
        difficulty: estimatedDiff,
        hashrate: body.hashrate,
      });
    }

    const response: ApiResponse<{
      suggestedDifficulty: number;
      estimatedShareTime: number;
    }> = {
      success: true,
      data: {
        suggestedDifficulty: this.difficultyState.currentDiff,
        estimatedShareTime:
          Math.pow(2, this.difficultyState.currentDiff) / body.hashrate,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/credit - Credit mining reward
   *
   * SECURITY: All validation is done server-side
   * - Proof hash is verified (SHA256)
   * - Difficulty is verified (leading zeros)
   * - Reward is calculated server-side (never trust client)
   * - Rate limiting is enforced
   * - Global duplicate check prevents cross-address submission
   */
  private async handleCreditMining(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    // NOTE: The proof is sent directly (not wrapped in { proof: ... })
    // because the Hono middleware already validated it via miningProofSchema
    let proof: MiningProof;
    try {
      proof = (await request.json()) as MiningProof;
    } catch (e) {
      balanceLogger.error("JSON parse error", e, { address: this.address });
      return this.errorResponse("Invalid JSON body", 400);
    }

    // =========================================================================
    // SECURITY: Validate proof fields exist
    // =========================================================================
    if (!proof || !proof.hash || !proof.blockData) {
      balanceLogger.warn("Missing proof fields", {
        address: this.address,
        hasProof: !!proof,
        hasHash: !!proof?.hash,
        hasBlockData: !!proof?.blockData,
        hasNonce: proof?.nonce !== undefined,
        hasDifficulty: proof?.difficulty !== undefined,
      });
      return this.errorResponse(
        `Invalid proof: missing required fields (hash=${!!proof?.hash}, blockData=${!!proof?.blockData})`,
        400,
      );
    }

    // Coerce nonce to number (IndexedDB may serialize as string)
    const nonce =
      typeof proof.nonce === "string"
        ? parseInt(proof.nonce, 10)
        : typeof proof.nonce === "number"
          ? proof.nonce
          : NaN;

    if (isNaN(nonce)) {
      balanceLogger.warn("Invalid nonce type", {
        address: this.address,
        nonceValue: proof.nonce,
        nonceType: typeof proof.nonce,
      });
      return this.errorResponse(
        `Invalid proof: nonce must be a number (got ${typeof proof.nonce})`,
        400,
      );
    }

    // Use coerced nonce for validation
    const proofWithNonce = { ...proof, nonce };

    const now = Date.now();

    // =========================================================================
    // SECURITY: Cryptographic proof validation
    // Verifies: hash matches SHA256(blockData + nonce) AND meets difficulty
    // =========================================================================
    const proofValidation = await validateMiningProof({
      hash: proofWithNonce.hash,
      nonce: proofWithNonce.nonce,
      difficulty: proofWithNonce.difficulty,
      blockData: proofWithNonce.blockData,
      timestamp: proofWithNonce.timestamp,
    });

    if (!proofValidation.valid) {
      // Detailed logging for debugging validation failures
      balanceLogger.warn("Proof validation failed", {
        address: this.address,
        reason: proofValidation.reason,
        hash: proofWithNonce.hash.slice(0, 16),
        nonce: proofWithNonce.nonce,
        difficulty: proofWithNonce.difficulty,
        blockDataPreview: proofWithNonce.blockData.slice(0, 50),
        timestamp: proofWithNonce.timestamp,
        proofAge: proofWithNonce.timestamp
          ? now - proofWithNonce.timestamp
          : "N/A",
      });
      return this.errorResponse(
        `Invalid proof: ${proofValidation.reason}`,
        400,
      );
    }

    // =========================================================================
    // SECURITY: Check global duplicate (prevents same proof to multiple addresses)
    // =========================================================================
    const kv = this.env.CACHE || null;
    const globalCheck = await isProofUsedGlobally(
      proofWithNonce.hash,
      kv,
      this.env.ENVIRONMENT,
    );

    // If KV unavailable in production, reject the request
    if (globalCheck.error) {
      balanceLogger.warn("Proof rejected - KV unavailable", {
        address: this.address,
        hash: proofWithNonce.hash.slice(0, 16),
      });
      return this.errorResponse(globalCheck.error, 503);
    }

    if (globalCheck.used) {
      balanceLogger.info("Duplicate proof rejected", {
        address: this.address,
        hash: proofWithNonce.hash.slice(0, 16),
      });
      return this.errorResponse("Proof already used", 409);
    }

    // =========================================================================
    // Get balance and check rate limits
    // =========================================================================
    const balance = this.getOrCreateBalance(this.address);

    // SECURITY: Rate limiting
    const sharesThisHour = this.getSharesInLastHour();
    const rateLimitCheck = checkRateLimit({
      sharesThisHour,
      lastShareTime: balance.lastMiningAt,
    });

    if (!rateLimitCheck.valid) {
      balanceLogger.warn("Rate limit hit", {
        address: this.address,
        sharesThisHour,
        lastShareTime: balance.lastMiningAt,
        timeSinceLastShare: now - balance.lastMiningAt,
        reason: rateLimitCheck.reason,
      });
      return this.errorResponse(rateLimitCheck.reason!, 429);
    }

    // =========================================================================
    // VarDiff: Initialize and process share
    // =========================================================================
    if (!this.difficultyState) {
      this.difficultyState = createInitialState();
    }

    // Validate that submitted difficulty meets minimum
    // NOTE: VarDiff is advisory - we accept any share >= MIN_DIFFICULTY
    // The reward is always calculated based on actual difficulty submitted
    // This prevents sync issues when client has stale difficulty assignment
    const assignedDiff = this.difficultyState.currentDiff;
    if (proofWithNonce.difficulty < MIN_DIFFICULTY) {
      balanceLogger.warn("Difficulty below global minimum", {
        address: this.address,
        submittedDiff: proofWithNonce.difficulty,
        globalMinDiff: MIN_DIFFICULTY,
      });
      return this.errorResponse(
        `Share difficulty D${proofWithNonce.difficulty} below minimum D${MIN_DIFFICULTY}`,
        400,
      );
    }

    // Log if share is below assigned difficulty (for monitoring)
    if (proofWithNonce.difficulty < assignedDiff) {
      balanceLogger.debug("Share below assigned difficulty (accepted)", {
        address: this.address,
        submittedDiff: proofWithNonce.difficulty,
        assignedDiff,
      });
    }

    // Process this share through VarDiff algorithm
    const varDiffResult = processShare(this.difficultyState, now);
    this.difficultyState = varDiffResult.state;

    if (varDiffResult.result.changed) {
      balanceLogger.info("VarDiff adjustment", {
        address: this.address,
        from: assignedDiff,
        to: varDiffResult.result.newDifficulty,
        reason: varDiffResult.result.reason,
      });
    }

    // =========================================================================
    // Calculate streak bonus (server-side)
    // =========================================================================
    const streakActive = now - balance.lastMiningAt < STREAK_RESET_MS;
    const consecutiveShares = streakActive ? balance.streakCount : 0;
    const streakMultiplier = getStreakMultiplier(consecutiveShares);

    // =========================================================================
    // Calculate NFT boost (server-side, from Redis)
    // =========================================================================
    let nftMultiplier = 1.0;
    let nftBoostPercent = 0;
    let userBabyType = "human"; // Default fallback

    if (MULTIPLIER_CONFIG.enabled.nft) {
      try {
        const redis = getRedis(this.env);
        const nftData = await getNFTBoostData(redis, this.address!);
        nftBoostPercent = nftData.totalBoostPercent;
        nftMultiplier = getNFTMultiplier(nftBoostPercent);
        userBabyType = nftData.bestNFTBaseType;

        if (nftBoostPercent > 0) {
          balanceLogger.debug("NFT boost applied", {
            address: this.address!.slice(0, 10),
            nftCount: nftData.nftCount,
            boostPercent: nftBoostPercent.toFixed(2),
            multiplier: nftMultiplier.toFixed(3),
            babyType: userBabyType,
          });
        }
      } catch (error) {
        // NFT boost is non-critical - continue without it
        balanceLogger.warn("NFT boost fetch failed", { error });
      }
    }

    // =========================================================================
    // Calculate Engagement boost (server-side, from Redis)
    // =========================================================================
    let engagementMultiplier = 1.0;
    let engagementBoostPercent = 0;

    if (MULTIPLIER_CONFIG.enabled.engagement) {
      try {
        const redis = getRedis(this.env);
        const engagementData = await getEngagementBoostData(
          redis,
          this.address!,
        );
        engagementBoostPercent = engagementData.totalBoostPercent;
        engagementMultiplier = getEngagementMultiplier(engagementBoostPercent);

        if (engagementBoostPercent > 0) {
          balanceLogger.debug("Engagement boost applied", {
            address: this.address!.slice(0, 10),
            boostPercent: engagementBoostPercent.toFixed(2),
            breakdown: engagementData.breakdown,
          });
        }
      } catch (error) {
        // Engagement boost is non-critical - continue without it
        balanceLogger.warn("Engagement boost fetch failed", { error });
      }
    }

    // =========================================================================
    // Calculate Cosmic boost (server-side, pure math calculations)
    // =========================================================================
    let cosmicMultiplier = 1.0;
    let cosmicBoostPercent = 0;
    let cosmicStatus = "normal";

    if (MULTIPLIER_CONFIG.enabled.cosmic) {
      try {
        // Baby type comes from user's best NFT (fetched above)
        const cosmicData = getCosmicBoostData(userBabyType);
        cosmicBoostPercent = cosmicData.totalBoostPercent;
        cosmicMultiplier = getCosmicMultiplier(cosmicBoostPercent);
        cosmicStatus = cosmicData.status;

        if (cosmicBoostPercent !== 0) {
          balanceLogger.debug("Cosmic boost applied", {
            address: this.address!.slice(0, 10),
            boostPercent: cosmicBoostPercent.toFixed(2),
            moonPhase: cosmicData.state.moonPhase,
            season: cosmicData.state.season,
            status: cosmicStatus,
          });
        }
      } catch (error) {
        // Cosmic boost is non-critical - continue without it
        balanceLogger.warn("Cosmic boost calc failed", { error });
      }
    }

    // =========================================================================
    // SECURITY: Calculate reward SERVER-SIDE (never trust client)
    // Combines: base × streak × nft × engagement × cosmic (with safety cap)
    // =========================================================================
    const baseReward = proofValidation.calculatedReward!;
    const combinedMultiplier = Math.min(
      streakMultiplier *
        nftMultiplier *
        engagementMultiplier *
        cosmicMultiplier,
      MULTIPLIER_CONFIG.maxTotalMultiplier,
    );
    const boostedReward = BigInt(
      Math.floor(Number(baseReward) * combinedMultiplier),
    );

    // =========================================================================
    // CRITICAL: Mark proof globally FIRST (prevents cross-address double-spend)
    //
    // Order: KV MARK → SQLite INSERT
    // Security trade-off:
    //   - If KV mark fails: Reject request, user can retry
    //   - If SQLite fails after KV mark: Proof is "burned" but no double credit
    //     (better to lose one proof than allow exploitation)
    //
    // This order prevents the race condition where:
    //   1. User A submits proof, SQLite insert succeeds, KV mark pending
    //   2. User B submits same proof, KV check passes (not marked yet)
    //   3. User B's SQLite insert succeeds too → double credit
    // =========================================================================
    const currentAddress = this.address!; // Safe: validated earlier in flow

    // BLOCKING: Mark in KV first with retry
    const markGloballyWithRetry = async (retries = 3): Promise<boolean> => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          await markProofUsedGlobally(proofWithNonce.hash, currentAddress, kv);
          return true;
        } catch (e) {
          balanceLogger.warn("KV mark attempt failed", {
            attempt,
            retries,
            error: e instanceof Error ? e.message : String(e),
          });
          if (attempt < retries) {
            // Exponential backoff: 50ms, 100ms, 200ms
            await new Promise((r) =>
              setTimeout(r, 50 * Math.pow(2, attempt - 1)),
            );
          }
        }
      }
      return false;
    };

    // Mark globally FIRST (blocking)
    const kvMarkSuccess = await markGloballyWithRetry();
    if (!kvMarkSuccess) {
      balanceLogger.error(
        "Failed to mark proof globally after retries",
        undefined,
        {
          hash: proofWithNonce.hash,
          address: currentAddress,
        },
      );
      // Fail the request - better to reject than risk double credit
      return this.errorResponse(
        "Unable to process proof. Please retry in a moment.",
        503,
      );
    }

    // =========================================================================
    // Store proof locally (now safe - KV is already marked)
    // =========================================================================
    const proofId = crypto.randomUUID();

    try {
      this.sql.exec(
        `INSERT INTO mining_proofs
         (id, hash, nonce, difficulty, block_data, reward, credited, address, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        proofId,
        proofWithNonce.hash,
        proofWithNonce.nonce,
        proofWithNonce.difficulty,
        proofWithNonce.blockData,
        boostedReward.toString(),
        this.address,
        now,
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("UNIQUE")) {
        // Proof already credited to this address
        return this.errorResponse("Proof already credited", 409);
      }
      // SQLite failed after KV mark - proof is "burned" but no double credit
      // This is acceptable because:
      // 1. It's extremely rare (SQLite in DO is reliable)
      // 2. Better to lose one proof than allow exploitation
      balanceLogger.error("SQLite insert failed after KV mark", e, {
        hash: proofWithNonce.hash,
        address: currentAddress,
      });
      return this.errorResponse("Database error. Please retry.", 500);
    }

    // =========================================================================
    // Update balance
    // =========================================================================
    balance.virtualBalance += boostedReward;
    balance.totalMined += boostedReward;
    balance.lastMiningAt = now;

    // Update streak count
    if (streakActive) {
      balance.streakCount += 1;
    } else {
      balance.streakCount = 1;
    }

    this.updateBalance(balance);

    // Increment rate limit counter
    this.incrementShareCounter();

    // Log successful credit for monitoring
    balanceLogger.info("Credit awarded", {
      address: this.address,
      reward: boostedReward.toString(),
      difficulty: proofWithNonce.difficulty,
      streak: balance.streakCount,
      streakMultiplier: streakMultiplier.toFixed(2),
      nftBoost: nftBoostPercent.toFixed(2),
      engagementBoost: engagementBoostPercent.toFixed(2),
      cosmicBoost: cosmicBoostPercent.toFixed(2),
      totalMultiplier: combinedMultiplier.toFixed(3),
    });

    // =========================================================================
    // Update leaderboard (non-blocking, don't fail if it errors)
    // =========================================================================
    this.updateLeaderboardAsync(this.address, balance.totalMined);

    // =========================================================================
    // Response (includes VarDiff, NFT boost, and Engagement boost)
    // =========================================================================
    const response: ApiResponse<{
      credited: string;
      newBalance: string;
      proofId: string;
      streakInfo: {
        consecutiveShares: number;
        multiplier: number;
        baseReward: string;
        boostedReward: string;
        nextTierAt: number;
      };
      nftBoost: {
        multiplier: number;
        boostPercent: number;
        enabled: boolean;
      };
      engagementBoost: {
        multiplier: number;
        boostPercent: number;
        enabled: boolean;
      };
      cosmicBoost: {
        multiplier: number;
        boostPercent: number;
        status: string;
        enabled: boolean;
      };
      varDiff: {
        suggestedDifficulty: number;
        averageShareTime: number;
        difficultyChanged: boolean;
      };
    }> = {
      success: true,
      data: {
        credited: boostedReward.toString(),
        newBalance: balance.virtualBalance.toString(),
        proofId,
        streakInfo: {
          consecutiveShares: balance.streakCount,
          multiplier: streakMultiplier,
          baseReward: baseReward.toString(),
          boostedReward: boostedReward.toString(),
          nextTierAt: this.getNextStreakTier(balance.streakCount),
        },
        nftBoost: {
          multiplier: nftMultiplier,
          boostPercent: nftBoostPercent,
          enabled: MULTIPLIER_CONFIG.enabled.nft,
        },
        engagementBoost: {
          multiplier: engagementMultiplier,
          boostPercent: engagementBoostPercent,
          enabled: MULTIPLIER_CONFIG.enabled.engagement,
        },
        cosmicBoost: {
          multiplier: cosmicMultiplier,
          boostPercent: cosmicBoostPercent,
          status: cosmicStatus,
          enabled: MULTIPLIER_CONFIG.enabled.cosmic,
        },
        varDiff: {
          suggestedDifficulty: this.difficultyState!.currentDiff,
          averageShareTime: varDiffResult.result.averageShareTime,
          difficultyChanged: varDiffResult.result.changed,
        },
      },
      timestamp: now,
    };

    return Response.json(response);
  }

  /**
   * Get number of shares submitted in the last hour
   * SECURITY: Always query DB for accurate rolling 60-minute window
   * Previous optimization using hour slots was bypassable at hour boundaries
   */
  private getSharesInLastHour(): number {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // SECURITY: Always query for accurate rolling window
    // Cache is only used as optimization within same request batch
    // The hour-slot optimization was a security hole (bypass at :59/:01)
    const cacheAge = now - this.sharesHourStartedAt;
    const cacheValid = cacheAge < 5000; // 5 second cache max

    if (!cacheValid || this.sharesHourStartedAt === 0) {
      const result = this.sql
        .exec(
          `SELECT COUNT(*) as count FROM mining_proofs WHERE created_at > ?`,
          oneHourAgo,
        )
        .toArray();
      this.sharesThisHourCache = (result[0]?.count as number) || 0;
      this.sharesHourStartedAt = now;
    }

    return this.sharesThisHourCache;
  }

  /**
   * Increment share counter (called after successful credit)
   */
  private incrementShareCounter(): void {
    this.sharesThisHourCache++;
  }

  /**
   * Get next streak tier threshold
   */
  private getNextStreakTier(currentShares: number): number {
    const tiers = [10, 50, 100, 250, 500];
    for (const tier of tiers) {
      if (currentShares < tier) return tier;
    }
    return 500; // Max tier reached
  }

  /**
   * POST /balance/{address}/reserve - Reserve amount for withdrawal
   */
  private async handleReserveWithdraw(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      amount: string;
      requestId: string;
    };

    const amount = BigInt(body.amount);
    const minWithdraw = BigInt(
      this.env.MIN_WITHDRAW_AMOUNT || DEFAULT_MIN_WITHDRAW,
    );

    // Validate amount
    if (amount < minWithdraw) {
      return this.errorResponse(
        `Minimum withdrawal is ${minWithdraw} tokens`,
        400,
      );
    }

    const balance = this.getOrCreateBalance(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    if (amount > available) {
      return this.errorResponse(
        `Insufficient balance. Available: ${available}`,
        400,
      );
    }

    // Reserve the amount
    balance.pendingWithdraw += amount;
    this.updateBalance(balance);

    const response: ApiResponse<{
      reserved: string;
      pendingTotal: string;
      availableAfter: string;
    }> = {
      success: true,
      data: {
        reserved: amount.toString(),
        pendingTotal: balance.pendingWithdraw.toString(),
        availableAfter: (
          balance.virtualBalance - balance.pendingWithdraw
        ).toString(),
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/confirm-withdraw - Confirm withdrawal completed
   */
  private async handleConfirmWithdraw(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      amount: string;
      txid: string;
    };

    const amount = BigInt(body.amount);
    const balance = this.getOrCreateBalance(this.address);

    // Validate
    if (amount > balance.pendingWithdraw) {
      return this.errorResponse("Amount exceeds pending withdrawal", 400);
    }

    // Confirm withdrawal
    balance.pendingWithdraw -= amount;
    balance.virtualBalance -= amount;
    balance.totalWithdrawn += amount;

    this.updateBalance(balance);

    const response: ApiResponse<{
      withdrawn: string;
      txid: string;
      newBalance: string;
    }> = {
      success: true,
      data: {
        withdrawn: amount.toString(),
        txid: body.txid,
        newBalance: balance.virtualBalance.toString(),
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/cancel-withdraw - Cancel pending withdrawal
   */
  private async handleCancelWithdraw(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      amount: string;
      requestId: string;
    };

    const amount = BigInt(body.amount);
    const balance = this.getOrCreateBalance(this.address);

    // Validate
    if (amount > balance.pendingWithdraw) {
      return this.errorResponse("Amount exceeds pending withdrawal", 400);
    }

    // Release the reserved amount
    balance.pendingWithdraw -= amount;
    this.updateBalance(balance);

    const response: ApiResponse<{
      released: string;
      availableNow: string;
    }> = {
      success: true,
      data: {
        released: amount.toString(),
        availableNow: (
          balance.virtualBalance - balance.pendingWithdraw
        ).toString(),
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/deduct - Deduct balance for purchases (NFT evolution, etc.)
   * Unlike reserve, this immediately removes balance without pending state
   */
  private async handleDeductBalance(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      amount: string;
      reason: string;
    };

    if (!body.amount || !body.reason) {
      return this.errorResponse("Amount and reason are required", 400);
    }

    const amount = BigInt(body.amount);

    if (amount <= 0n) {
      return this.errorResponse("Amount must be positive", 400);
    }

    const balance = this.getOrCreateBalance(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    if (amount > available) {
      return this.errorResponse(
        `Insufficient balance. Available: ${available}, required: ${amount}`,
        400,
      );
    }

    // Deduct the amount directly
    balance.virtualBalance -= amount;
    this.updateBalance(balance);

    balanceLogger.info("Deducted balance", {
      amount: amount.toString(),
      address: this.address,
      reason: body.reason,
    });

    const response: ApiResponse<{
      deducted: string;
      newBalance: string;
      reason: string;
    }> = {
      success: true,
      data: {
        deducted: amount.toString(),
        newBalance: balance.virtualBalance.toString(),
        reason: body.reason,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * DELETE /balance/{address}/reset - Reset user data (testnet only)
   * Clears balance, proofs, and difficulty state
   */
  private handleReset(): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    // Delete all data for THIS address only (NOT all users!)
    // SECURITY FIX: Previous code had `WHERE 1=1` which deleted ALL users' data
    this.sql.exec("DELETE FROM mining_proofs WHERE address = ?", this.address);
    this.sql.exec("DELETE FROM balance WHERE address = ?", this.address);
    this.sql.exec("DELETE FROM claims WHERE address = ?", this.address);

    // Clear caches
    this.cachedBalance = null;
    this.cacheLoadedAt = 0;
    this.difficultyState = null;
    this.sharesThisHourCache = 0;
    this.sharesHourStartedAt = 0;

    balanceLogger.info("Reset complete", { address: this.address });

    const response: ApiResponse<{ reset: boolean }> = {
      success: true,
      data: { reset: true },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * DELETE /balance/full-reset - Full system reset (admin only)
   * Drops and recreates all tables. Use with caution!
   */
  private handleFullReset(): Response {
    // Drop all tables
    this.sql.exec("DROP TABLE IF EXISTS mining_proofs");
    this.sql.exec("DROP TABLE IF EXISTS balance");
    this.sql.exec("DROP TABLE IF EXISTS claims");

    // Recreate tables
    this.initializeSchema();

    // Clear all caches
    this.cachedBalance = null;
    this.cacheLoadedAt = 0;
    this.difficultyState = null;
    this.sharesThisHourCache = 0;
    this.sharesHourStartedAt = 0;

    balanceLogger.info("Full reset complete - all tables recreated");

    const response: ApiResponse<{ fullReset: boolean }> = {
      success: true,
      data: { fullReset: true },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  // ===========================================================================
  // CLAIM SYSTEM HANDLERS
  // ===========================================================================

  /**
   * GET /balance/{address}/claimable - Get claimable balance
   *
   * Returns the sum of actual mining rewards that can be claimed on-chain.
   * Uses the reward column from mining_proofs (what users actually earned).
   */
  private handleGetClaimableBalance(): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    // Get all unclaimed proofs (credited but not claimed)
    const rows = this.sql
      .exec(
        `SELECT reward, difficulty, created_at FROM mining_proofs
         WHERE address = ? AND credited = 1 AND claimed = 0
         ORDER BY created_at DESC`,
        this.address,
      )
      .toArray();

    // Sum actual rewards (what users earned from mining)
    let claimableTokens = 0n;
    let unclaimedWork = 0n;
    let lastProofAt = 0;
    for (const row of rows) {
      // Use the actual reward from mining (not recalculated)
      claimableTokens += BigInt(row.reward as string);
      // Also track work for reference
      const difficulty = row.difficulty as number;
      unclaimedWork += calculateWorkFromDifficulty(difficulty);
      if (lastProofAt === 0) {
        lastProofAt = row.created_at as number;
      }
    }

    // Get total claimed (from completed claims)
    const claimedRows = this.sql
      .exec(
        `SELECT SUM(CAST(amount AS INTEGER)) as total FROM claims
         WHERE address = ? AND status = 'completed'`,
        this.address,
      )
      .toArray();
    const totalClaimed = BigInt((claimedRows[0]?.total as number) || 0);

    // Count completed claims
    const countRows = this.sql
      .exec(
        `SELECT COUNT(*) as count FROM claims
         WHERE address = ? AND status = 'completed'`,
        this.address,
      )
      .toArray();
    const claimCount = (countRows[0]?.count as number) || 0;

    const data: ClaimableBalance = {
      address: this.address,
      unclaimedWork,
      unclaimedProofs: rows.length,
      claimableTokens,
      lastProofAt,
      totalClaimed,
      claimCount,
    };

    const response: ApiResponse<{
      address: string;
      unclaimedWork: string;
      unclaimedProofs: number;
      claimableTokens: string;
      lastProofAt: number;
      totalClaimed: string;
      claimCount: number;
    }> = {
      success: true,
      data: {
        address: data.address,
        unclaimedWork: data.unclaimedWork.toString(),
        unclaimedProofs: data.unclaimedProofs,
        claimableTokens: data.claimableTokens.toString(),
        lastProofAt: data.lastProofAt,
        totalClaimed: data.totalClaimed.toString(),
        claimCount: data.claimCount,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/prepare-claim - Prepare a claim
   *
   * Aggregates all unclaimed proofs, creates a signed claim,
   * and returns data for the user's Bitcoin TX.
   */
  private async handlePrepareClaim(): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    // Auto-cancel any existing pending claims (allows user to start fresh)
    // This is more user-friendly than blocking with 409
    const pendingClaims = this.sql
      .exec(
        `SELECT id FROM claims
         WHERE address = ? AND status = 'prepared'
         AND expires_at > ?`,
        this.address,
        Date.now(),
      )
      .toArray();

    if (pendingClaims.length > 0) {
      // Cancel old pending claims and release their proofs
      for (const claim of pendingClaims) {
        const claimId = claim.id as string;
        this.sql.exec(
          `UPDATE claims SET status = 'cancelled' WHERE id = ?`,
          claimId,
        );
        // Release proofs that were locked to this claim
        this.sql.exec(
          `UPDATE mining_proofs SET claim_id = NULL WHERE claim_id = ?`,
          claimId,
        );
        balanceLogger.info("Auto-cancelled pending claim for new prepare", {
          address: this.address,
          cancelledClaimId: claimId,
        });
      }
    }

    // Block if there's a broadcast claim (TX already sent, can't cancel)
    const broadcastClaims = this.sql
      .exec(
        `SELECT id FROM claims
         WHERE address = ? AND status = 'broadcast'
         AND expires_at > ?`,
        this.address,
        Date.now(),
      )
      .toArray();

    if (broadcastClaims.length > 0) {
      return this.errorResponse(
        "You have a broadcast claim waiting for confirmation. Please wait for it to complete.",
        409,
      );
    }

    // Get all unclaimed proofs WITH their actual rewards
    const rows = this.sql
      .exec(
        `SELECT id, hash, difficulty, reward FROM mining_proofs
         WHERE address = ? AND credited = 1 AND claimed = 0`,
        this.address,
      )
      .toArray();

    if (rows.length === 0) {
      return this.errorResponse("No unclaimed proofs to claim", 400);
    }

    // Calculate total work AND sum actual rewards
    let totalWork = 0n;
    let actualTokens = 0n;
    const proofHashes: string[] = [];
    for (const row of rows) {
      const difficulty = row.difficulty as number;
      totalWork += calculateWorkFromDifficulty(difficulty);
      actualTokens += BigInt(row.reward as string);
      proofHashes.push(row.hash as string);
    }

    // Check minimum tokens requirement (use actual rewards, not work)
    // MIN_CLAIM_WORK is in work units, so we need a minimum token check instead
    const MIN_CLAIM_TOKENS = 10n; // Minimum 10 tokens to claim
    if (actualTokens < MIN_CLAIM_TOKENS) {
      return this.errorResponse(
        `Minimum ${MIN_CLAIM_TOKENS} tokens required to claim. Current: ${actualTokens}`,
        400,
      );
    }

    // Get proof aggregator
    const serverSecret = this.env.ADMIN_KEY;
    if (!serverSecret) {
      return this.errorResponse("Server not configured for claims", 500);
    }

    const aggregator = getProofAggregator(serverSecret);

    // Create mining proofs array for aggregation
    const miningProofs = rows.map((row) => ({
      hash: row.hash as string,
      difficulty: row.difficulty as number,
      nonce: 0,
      blockData: "",
    }));

    // Aggregate proofs
    const aggregatedProof = aggregator.aggregateProofs(
      this.address,
      miningProofs,
    );

    // IMPORTANT: Override tokenAmount with actual mining rewards
    // The aggregator calculates tokens from difficulty, but we want
    // to use the actual rewards users earned (includes multipliers, etc.)
    aggregatedProof.tokenAmount = actualTokens;

    // Estimate fee
    const feeRate = 5; // Conservative default
    const estimatedFee = estimateClaimFee(feeRate);

    // Create claim data with ASYNC signature (real HMAC-SHA256)
    const claimData = await aggregator.createClaimDataAsync(
      aggregatedProof,
      estimatedFee,
    );

    // Calculate expiration
    const now = Date.now();
    const expiresAt = now + CLAIM_EXPIRATION_MS;

    // Save claim to database with full data
    const claimId = aggregatedProof.nonce;
    this.sql.exec(
      `INSERT INTO claims
       (id, address, amount, proof_count, total_work, merkle_root, server_signature, op_return_data, status, prepared_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
      claimId,
      this.address,
      aggregatedProof.tokenAmount.toString(),
      rows.length,
      aggregatedProof.totalWork.toString(),
      aggregatedProof.merkleRoot,
      claimData.serverSignature,
      claimData.opReturnData,
      now,
      expiresAt,
    );

    // Mark proofs as being claimed (but not yet confirmed)
    const proofIds = rows.map((r) => r.id as string);
    for (const proofId of proofIds) {
      this.sql.exec(
        `UPDATE mining_proofs SET claim_id = ? WHERE id = ?`,
        claimId,
        proofId,
      );
    }

    balanceLogger.info("Claim prepared", {
      address: this.address,
      claimId,
      proofCount: rows.length,
      tokenAmount: aggregatedProof.tokenAmount.toString(),
    });

    // Convert BigInt to string for JSON serialization
    const serializableClaimData = {
      ...claimData,
      proof: {
        ...claimData.proof,
        totalWork: claimData.proof.totalWork.toString(),
        tokenAmount: claimData.proof.tokenAmount.toString(),
      },
    };

    const responseData: ClaimPrepareResponse = {
      claimData: serializableClaimData as unknown as typeof claimData,
      totalWork: aggregatedProof.totalWork.toString(),
      proofCount: rows.length,
      tokenAmount: aggregatedProof.tokenAmount.toString(),
      estimatedFee,
      expiresAt,
    };

    const response: ApiResponse<ClaimPrepareResponse> = {
      success: true,
      data: responseData,
      timestamp: now,
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/confirm-claim - Confirm claim TX broadcast
   *
   * User calls this after broadcasting their Bitcoin TX.
   */
  private async handleConfirmClaim(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      claimId: string;
      claimTxid: string;
    };

    if (!body.claimId || !body.claimTxid) {
      return this.errorResponse("claimId and claimTxid are required", 400);
    }

    // Get the claim
    const claimRows = this.sql
      .exec(
        `SELECT * FROM claims WHERE id = ? AND address = ?`,
        body.claimId,
        this.address,
      )
      .toArray();

    if (claimRows.length === 0) {
      return this.errorResponse("Claim not found", 404);
    }

    const claim = claimRows[0];
    const status = claim.status as ClaimStatus;

    // Validate status
    if (status !== "prepared") {
      return this.errorResponse(
        `Claim already in status: ${status}. Cannot confirm.`,
        400,
      );
    }

    // Check expiration
    const expiresAt = claim.expires_at as number;
    if (Date.now() > expiresAt) {
      // Mark as expired
      this.sql.exec(
        `UPDATE claims SET status = 'expired' WHERE id = ?`,
        body.claimId,
      );
      // Release proofs
      this.sql.exec(
        `UPDATE mining_proofs SET claim_id = NULL WHERE claim_id = ?`,
        body.claimId,
      );
      return this.errorResponse("Claim has expired", 410);
    }

    const now = Date.now();

    // Update claim with txid and status
    this.sql.exec(
      `UPDATE claims SET
         claim_txid = ?,
         status = 'broadcast',
         confirmed_at = ?
       WHERE id = ?`,
      body.claimTxid,
      now,
      body.claimId,
    );

    // Mark proofs as claimed
    this.sql.exec(
      `UPDATE mining_proofs SET claimed = 1 WHERE claim_id = ?`,
      body.claimId,
    );

    balanceLogger.info("Claim confirmed", {
      address: this.address,
      claimId: body.claimId,
      claimTxid: body.claimTxid,
    });

    const responseData: ClaimConfirmResponse = {
      status: "broadcast",
      mintTxid: null,
      tokensMinted: null,
      nextStep:
        "Wait for TX confirmation (6 blocks), then call /api/claim/mint",
    };

    const response: ApiResponse<ClaimConfirmResponse> = {
      success: true,
      data: responseData,
      timestamp: now,
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/cancel-claim - Cancel a pending claim
   *
   * Allows users to cancel claims that are still in 'prepared' status.
   * Releases the locked proofs so they can be claimed again.
   */
  private async handleCancelClaim(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      claimId?: string;
    };

    // If no claimId provided, cancel all pending claims for this address
    if (!body.claimId) {
      const pendingClaims = this.sql
        .exec(
          `SELECT id FROM claims WHERE address = ? AND status = 'prepared'`,
          this.address,
        )
        .toArray();

      if (pendingClaims.length === 0) {
        return this.errorResponse("No pending claims to cancel", 404);
      }

      let cancelledCount = 0;
      for (const claim of pendingClaims) {
        const claimId = claim.id as string;
        this.sql.exec(
          `UPDATE claims SET status = 'cancelled' WHERE id = ?`,
          claimId,
        );
        this.sql.exec(
          `UPDATE mining_proofs SET claim_id = NULL WHERE claim_id = ?`,
          claimId,
        );
        cancelledCount++;
      }

      balanceLogger.info("Cancelled all pending claims", {
        address: this.address,
        count: cancelledCount,
      });

      const response: ApiResponse<{ cancelled: number }> = {
        success: true,
        data: { cancelled: cancelledCount },
        timestamp: Date.now(),
      };

      return Response.json(response);
    }

    // Cancel specific claim
    const claimRows = this.sql
      .exec(
        `SELECT status FROM claims WHERE id = ? AND address = ?`,
        body.claimId,
        this.address,
      )
      .toArray();

    if (claimRows.length === 0) {
      return this.errorResponse("Claim not found", 404);
    }

    const status = claimRows[0].status as ClaimStatus;

    // Only allow cancelling 'prepared' claims
    if (status !== "prepared") {
      return this.errorResponse(
        `Cannot cancel claim in status: ${status}. Only 'prepared' claims can be cancelled.`,
        400,
      );
    }

    // Cancel the claim
    this.sql.exec(
      `UPDATE claims SET status = 'cancelled' WHERE id = ?`,
      body.claimId,
    );

    // Release the proofs
    this.sql.exec(
      `UPDATE mining_proofs SET claim_id = NULL WHERE claim_id = ?`,
      body.claimId,
    );

    balanceLogger.info("Claim cancelled", {
      address: this.address,
      claimId: body.claimId,
    });

    const response: ApiResponse<{ cancelled: boolean; claimId: string }> = {
      success: true,
      data: { cancelled: true, claimId: body.claimId },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * GET /balance/{address}/claim-status/{claimId} - Get claim status
   */
  private handleGetClaimStatus(claimId: string): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const rows = this.sql
      .exec(
        `SELECT * FROM claims WHERE id = ? AND address = ?`,
        claimId,
        this.address,
      )
      .toArray();

    if (rows.length === 0) {
      return this.errorResponse("Claim not found", 404);
    }

    const claim = rows[0];

    const data: ClaimRequest = {
      id: claim.id as string,
      address: claim.address as string,
      amount: BigInt(claim.amount as string),
      proofCount: claim.proof_count as number,
      totalWork: BigInt(claim.total_work as string),
      claimTxid: (claim.claim_txid as string) || null,
      mintTxid: (claim.mint_txid as string) || null,
      status: claim.status as ClaimStatus,
      error: (claim.error as string) || null,
      preparedAt: claim.prepared_at as number,
      confirmedAt: (claim.confirmed_at as number) || null,
      mintedAt: (claim.minted_at as number) || null,
    };

    const response: ApiResponse<{
      id: string;
      address: string;
      amount: string;
      proofCount: number;
      totalWork: string;
      merkleRoot: string | null;
      serverSignature: string | null;
      opReturnData: string | null;
      claimTxid: string | null;
      mintTxid: string | null;
      status: ClaimStatus;
      error: string | null;
      preparedAt: number;
      confirmedAt: number | null;
      mintedAt: number | null;
    }> = {
      success: true,
      data: {
        id: data.id,
        address: data.address,
        amount: data.amount.toString(),
        proofCount: data.proofCount,
        totalWork: data.totalWork.toString(),
        merkleRoot: (claim.merkle_root as string) || null,
        serverSignature: (claim.server_signature as string) || null,
        opReturnData: (claim.op_return_data as string) || null,
        claimTxid: data.claimTxid,
        mintTxid: data.mintTxid,
        status: data.status,
        error: data.error,
        preparedAt: data.preparedAt,
        confirmedAt: data.confirmedAt,
        mintedAt: data.mintedAt,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * GET /balance/{address}/claim-history - Get claim history
   */
  private handleGetClaimHistory(): Response {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const rows = this.sql
      .exec(
        `SELECT * FROM claims WHERE address = ? ORDER BY prepared_at DESC LIMIT 50`,
        this.address,
      )
      .toArray();

    const claims = rows.map((row) => ({
      id: row.id as string,
      amount: row.amount as string,
      proofCount: row.proof_count as number,
      status: row.status as ClaimStatus,
      claimTxid: (row.claim_txid as string) || null,
      mintTxid: (row.mint_txid as string) || null,
      preparedAt: row.prepared_at as number,
      confirmedAt: (row.confirmed_at as number) || null,
      mintedAt: (row.minted_at as number) || null,
    }));

    const response: ApiResponse<{
      claims: Array<{
        id: string;
        amount: string;
        proofCount: number;
        status: ClaimStatus;
        claimTxid: string | null;
        mintTxid: string | null;
        preparedAt: number;
        confirmedAt: number | null;
        mintedAt: number | null;
      }>;
    }> = {
      success: true,
      data: { claims },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  /**
   * POST /balance/{address}/update-claim-status - Update claim status
   *
   * Used by the mint endpoint to update claim status during minting lifecycle.
   */
  private async handleUpdateClaimStatus(request: Request): Promise<Response> {
    if (!this.address) {
      return this.errorResponse("Address required", 400);
    }

    const body = (await request.json()) as {
      claimId: string;
      status: ClaimStatus;
      mintTxid?: string;
      error?: string;
    };

    if (!body.claimId || !body.status) {
      return this.errorResponse("claimId and status required", 400);
    }

    // Validate status transition
    const validStatuses: ClaimStatus[] = [
      "prepared",
      "broadcast",
      "confirmed",
      "minting",
      "completed",
      "failed",
      "expired",
      "cancelled",
    ];

    if (!validStatuses.includes(body.status)) {
      return this.errorResponse("Invalid status", 400);
    }

    // Check claim exists
    const existing = this.sql
      .exec(
        `SELECT status FROM claims WHERE id = ? AND address = ?`,
        body.claimId,
        this.address,
      )
      .toArray();

    if (existing.length === 0) {
      return this.errorResponse("Claim not found", 404);
    }

    const now = Date.now();

    // Build update query based on new status
    if (body.status === "completed" && body.mintTxid) {
      this.sql.exec(
        `UPDATE claims
         SET status = ?, mint_txid = ?, minted_at = ?
         WHERE id = ? AND address = ?`,
        body.status,
        body.mintTxid,
        now,
        body.claimId,
        this.address,
      );
    } else if (body.status === "failed" && body.error) {
      this.sql.exec(
        `UPDATE claims
         SET status = ?, error = ?
         WHERE id = ? AND address = ?`,
        body.status,
        body.error,
        body.claimId,
        this.address,
      );
    } else {
      this.sql.exec(
        `UPDATE claims SET status = ? WHERE id = ? AND address = ?`,
        body.status,
        body.claimId,
        this.address,
      );
    }

    balanceLogger.info("Claim status updated", {
      address: this.address,
      claimId: body.claimId,
      status: body.status,
    });

    const response: ApiResponse<{ status: ClaimStatus }> = {
      success: true,
      data: { status: body.status },
      timestamp: now,
    };

    return Response.json(response);
  }

  // ===========================================================================
  // END CLAIM SYSTEM HANDLERS
  // ===========================================================================

  /**
   * Helper to create error response
   */
  private errorResponse(message: string, status: number): Response {
    const response: ApiResponse = {
      success: false,
      error: message,
      timestamp: Date.now(),
    };
    return Response.json(response, { status });
  }

  /**
   * Update leaderboard asynchronously (non-blocking)
   * Called after crediting mining rewards
   */
  private updateLeaderboardAsync(address: string, totalMined: bigint): void {
    // Use waitUntil to ensure the update completes even after response is sent
    this.ctx.waitUntil(
      (async () => {
        try {
          const redis = getRedis(this.env);

          // Update miners category (total tokens mined)
          // Clamp to safe integer range to prevent precision loss
          const score =
            totalMined > BigInt(Number.MAX_SAFE_INTEGER)
              ? Number.MAX_SAFE_INTEGER
              : Number(totalMined);

          await updateAllPeriods(redis, "miners", address, score);

          // Also update "earners" category with same score
          await updateAllPeriods(redis, "earners", address, score);

          // Update user stats
          await updateUserStats(redis, {
            address,
            totalHashes: score, // Using totalMined as proxy for total hashes
            totalTokens: score,
          });
        } catch (error) {
          // Log but don't fail - leaderboard is non-critical
          balanceLogger.error("Leaderboard update failed", error);
        }
      })(),
    );
  }
}
