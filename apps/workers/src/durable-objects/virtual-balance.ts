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
} from "../lib/types";
import {
  validateMiningProof,
  checkRateLimit,
  calculateRewardWithStreak,
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
          break;

        case "DELETE":
          if (action === "reset") {
            return this.handleReset();
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
    // SECURITY: Calculate reward SERVER-SIDE (never trust client)
    // =========================================================================
    const boostedReward = calculateRewardWithStreak(
      proofWithNonce.difficulty,
      consecutiveShares,
    );
    const baseReward = proofValidation.calculatedReward!;

    // =========================================================================
    // CRITICAL: Store proof LOCALLY FIRST with UNIQUE constraint
    // This prevents the race condition where global marking succeeds but
    // local insert fails, causing the proof to be "burned" permanently.
    //
    // Order: SQLite INSERT → KV PUT (with retry)
    // Risk mitigation:
    //   - If SQLite fails first: No harm done, user can retry
    //   - If KV fails after SQLite: User credited, small cross-address risk
    //     (acceptable because KV retries and expires after 24h anyway)
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
      // Other SQLite errors - safe to fail here, nothing committed yet
      balanceLogger.error("SQLite insert failed", e);
      return this.errorResponse("Database error. Please retry.", 500);
    }

    // =========================================================================
    // Mark proof globally in KV with retry (best effort)
    // If this fails, the proof is still credited locally. The small risk of
    // cross-address double-spend is acceptable (proofs expire in 24h anyway).
    // =========================================================================
    const currentAddress = this.address!; // Safe: validated earlier in flow
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

    // Non-blocking global mark - user is already credited locally
    markGloballyWithRetry().then((success) => {
      if (!success) {
        balanceLogger.error(
          "CRITICAL: Failed to mark proof globally after retries",
          undefined,
          { hash: proofWithNonce.hash, address: currentAddress },
        );
        // TODO: Add to dead-letter queue for manual review
      }
    });

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
      multiplier: streakMultiplier.toFixed(2),
    });

    // =========================================================================
    // Update leaderboard (non-blocking, don't fail if it errors)
    // =========================================================================
    this.updateLeaderboardAsync(this.address, balance.totalMined);

    // =========================================================================
    // Response (includes VarDiff suggested difficulty)
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
