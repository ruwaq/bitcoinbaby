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
  ApiResponse,
  BalanceResponse,
  ClaimableBalance,
  ClaimPrepareResponse,
  ClaimConfirmResponse,
  ClaimStatus,
  AIProof,
} from "../lib/types";
import { CLAIM_EXPIRATION_MS } from "../lib/types";
import {
  getProofAggregator,
  calculateWorkFromDifficulty,
  estimateClaimFee,
} from "../services/proof-aggregator";
import { estimateInitialDifficulty, VARDIFF_CONFIG } from "../lib/vardiff";
import { getRedis, updateAllPeriods, updateUserStats } from "../lib/redis";
import { initMempoolService } from "../services/mempool-service";
import { getNetworkForEnvironment } from "../config/bitcoin";

// Modular repositories and services
import {
  BalanceRepository,
  ProofRepository,
  ClaimRepository,
} from "./repositories";
import { processAICredit, performSemanticAudit } from "./services";

// Minimum withdraw amount (from env)
const DEFAULT_MIN_WITHDRAW = 100n;

export class VirtualBalanceDO extends DurableObject<Env> {
  private sql: SqlStorage;
  private address: string | null = null;

  // Repositories
  private balanceRepo!: BalanceRepository;
  private proofRepo!: ProofRepository;
  private claimRepo!: ClaimRepository;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;

    // Initialize database schema
    this.ctx.blockConcurrencyWhile(async () => {
      await this.initializeSchema();
      this.initializeRepositories();
    });
  }

  private initializeRepositories(): void {
    this.balanceRepo = new BalanceRepository(this.sql);
    this.proofRepo = new ProofRepository(this.sql);
    this.claimRepo = new ClaimRepository(this.sql);
  }

  private async initializeSchema(): Promise<void> {
    const CURRENT_DB_VERSION = 4;

    // Get current schema version
    const versionResult = this.sql.exec("PRAGMA user_version").toArray();
    let userVersion = 0;
    if (versionResult.length > 0 && versionResult[0] && typeof versionResult[0] === "object") {
      userVersion = (versionResult[0] as Record<string, unknown>).user_version as number || 0;
    }

    balanceLogger.info("SQLite schema version initialization", {
      currentVersion: userVersion,
      targetVersion: CURRENT_DB_VERSION,
      address: this.address || "global",
    });

    // Version 0 -> 1: Create initial tables
    if (userVersion < 1) {
      // Balance table
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS balance (
          address TEXT PRIMARY KEY,
          virtual_balance TEXT NOT NULL DEFAULT '0',
          total_mined TEXT NOT NULL DEFAULT '0',
          total_withdrawn TEXT NOT NULL DEFAULT '0',
          pending_withdraw TEXT NOT NULL DEFAULT '0',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      // Mining proofs table
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS mining_proofs (
          id TEXT PRIMARY KEY,
          hash TEXT NOT NULL UNIQUE,
          nonce INTEGER NOT NULL,
          difficulty INTEGER NOT NULL,
          block_data TEXT NOT NULL,
          reward TEXT NOT NULL,
          credited INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL
        )
      `);

      // Claims table
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

      // PoUW Tasks table
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS pouw_tasks (
          id TEXT PRIMARY KEY,
          block_hash TEXT NOT NULL,
          prompt TEXT NOT NULL,
          seed TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          status TEXT DEFAULT 'active'
        )
      `);

      // PoUW Submissions table
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS pouw_submissions (
          task_id TEXT NOT NULL,
          address TEXT NOT NULL,
          output TEXT NOT NULL,
          compute_time REAL NOT NULL,
          signature TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (task_id, address)
        )
      `);

      // Credit history table
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS credit_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          address TEXT NOT NULL,
          amount INTEGER NOT NULL,
          type TEXT NOT NULL DEFAULT 'mining',
          proof_id TEXT,
          created_at INTEGER NOT NULL
        )
      `);

      // Indexes
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_proofs_credited ON mining_proofs(credited)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_proofs_address ON mining_proofs(address)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_proofs_claimed ON mining_proofs(claimed)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_proofs_created_at ON mining_proofs(created_at)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_claims_address ON claims(address)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_submissions_task ON pouw_submissions(task_id)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_credit_history_address ON credit_history(address)`);
      this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_credit_history_created ON credit_history(created_at)`);

      userVersion = 1;
    }

    // Version 1 -> 2: Add initial migrations for balance columns
    if (userVersion < 2) {
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN difficulty_state TEXT`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN faucet_last_claim_at INTEGER NOT NULL DEFAULT 0`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN faucet_total_claimed TEXT NOT NULL DEFAULT '0'`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      userVersion = 2;
    }

    // Version 2 -> 3: Add initial migrations for mining_proofs columns
    if (userVersion < 3) {
      try {
        this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN address TEXT`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN claim_id TEXT`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      userVersion = 3;
    }

    // Version 3 -> 4: Add reputation_score and lockout_until to balance
    if (userVersion < 4) {
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN reputation_score INTEGER DEFAULT 100`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      try {
        this.sql.exec(`ALTER TABLE balance ADD COLUMN lockout_until INTEGER DEFAULT 0`);
      } catch (err) {
        /* Already exists or safe to ignore */
      }
      userVersion = 4;
    }

    // Set schema version final
    this.sql.exec(`PRAGMA user_version = ${CURRENT_DB_VERSION}`);
  }

  /**
   * Handle incoming requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const pathParts = path.split("/").filter(Boolean);
      if (pathParts.length < 2 || pathParts[0] !== "balance") {
        return this.errorResponse("Invalid path", 400);
      }

      this.address = pathParts[1];
      const action = pathParts[2] || "get";

      switch (request.method) {
        case "GET":
          if (action === "get" || action === "") return this.handleGetBalance();
          if (action === "pouw-task") return this.handleGetPouwTask();
          if (action === "history") {
            const limit = parseInt(url.searchParams.get("limit") || "100", 10);
            return this.handleGetHistory(limit);
          }
          if (action === "claimable") return this.handleGetClaimableBalance();
          if (action === "claim-history") return this.handleGetClaimHistory();
          if (action === "retriable-claims")
            return this.handleGetRetriableClaims();
          if (action === "claim-status") {
            const claimId = pathParts[3];
            if (!claimId) return this.errorResponse("Claim ID required", 400);
            return this.handleGetClaimStatus(claimId);
          }
          break;

        case "POST":
          if (action === "credit") return this.handleCreditMining(request);
          if (action === "faucet") return this.handleFaucetCredit(request);
          if (action === "pouw-verify")
            return this.handleVerifyPouwTask(request);
          if (action === "reserve") return this.handleReserveWithdraw(request);
          if (action === "confirm-withdraw")
            return this.handleConfirmWithdraw(request);
          if (action === "cancel-withdraw")
            return this.handleCancelWithdraw(request);
          if (action === "set-hashrate") return this.handleSetHashrate(request);
          if (action === "deduct") return this.handleDeductBalance(request);
          if (action === "prepare-claim") return this.handlePrepareClaim();
          if (action === "confirm-claim")
            return this.handleConfirmClaim(request);
          if (action === "update-claim-status")
            return this.handleUpdateClaimStatus(request);
          if (action === "cancel-claim") return this.handleCancelClaim(request);
          if (action === "cleanup-expired") return this.handleCleanupExpired();
          if (action === "reconcile") return this.handleReconcile();
          break;

        case "DELETE":
          if (action === "reset") return this.handleReset();
          if (action === "full-reset") return this.handleFullReset();
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

  // ===========================================================================
  // BALANCE HANDLERS
  // ===========================================================================

  private handleGetBalance(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    // Probabilistic pruning (1% chance)
    if (Math.random() < 0.01) {
      this.proofRepo.pruneOld();
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;
    const diffState = this.balanceRepo.getDifficultyState();

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
        suggestedDifficulty: diffState.currentDiff,
        averageShareTime: diffState.averageShareTime,
      },
      timestamp: Date.now(),
    };

    return Response.json(response);
  }

  private handleGetHistory(limit: number): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    const history = this.proofRepo.getRecent(limit).map((p) => ({
      ...p,
      type: "mining" as const,
    }));

    return Response.json({
      success: true,
      data: { history },
      timestamp: Date.now(),
    });
  }

  // ===========================================================================
  // MINING CREDIT (PoUW AI Era)
  // ===========================================================================

  private async handleCreditMining(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    let proof: AIProof;
    try {
      proof = (await request.json()) as AIProof;
    } catch {
      return this.errorResponse("Invalid JSON body", 400);
    }

    if (
      !proof ||
      !proof.taskId ||
      !proof.output ||
      !proof.signature ||
      !proof.publicKey
    ) {
      return this.errorResponse("Invalid proof: missing required fields", 400);
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    // Count submissions in last hour for rate limiting/stats
    // We query the pouw_submissions table for count in last hour
    let submissionsInLastHour = 0;
    try {
      const oneHourAgo = Date.now() - 3600000;
      const countRows = this.sql
        .exec(
          "SELECT COUNT(*) as cnt FROM pouw_submissions WHERE address = ? AND created_at > ?",
          this.address,
          oneHourAgo,
        )
        .toArray();
      submissionsInLastHour = (countRows[0]?.cnt as number) || 0;
    } catch {
      /* ignore */
    }

    // Process AI Credit (validates signature, checks derived address, computes rewards)
    const result = await processAICredit(proof, {
      env: this.env,
      address: this.address,
      balance,
      submissionsInLastHour,
      balanceRepo: this.balanceRepo,
    });

    if (!result.success) {
      return this.errorResponse(result.error!, result.errorCode || 500);
    }

    // Store PoUW submission in database
    try {
      this.sql.exec(
        `INSERT OR REPLACE INTO pouw_submissions (task_id, address, output, compute_time, signature, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        proof.taskId,
        this.address,
        proof.output,
        proof.computeTime,
        proof.signature,
        Date.now(),
      );
    } catch (err) {
      balanceLogger.error("Failed to store pouw submission in SQLite", {
        err,
        address: this.address,
      });
      return this.errorResponse("Internal database error storing proof", 500);
    }

    // Update balance
    this.balanceRepo.update(result.balance!);

    // Schedule random semantic audit LLM-as-a-Judge (1% chance)
    const shouldAudit = Math.random() < 0.01;
    if (shouldAudit) {
      this.ctx.waitUntil(
        performSemanticAudit(
          this.env,
          proof,
          this.address,
          result.reward!,
          this.balanceRepo,
        ),
      );
    }

    // Update leaderboard async
    this.updateLeaderboardAsync(this.address, result.balance!.totalMined);

    return Response.json({
      success: true,
      data: {
        credited: result.reward!.toString(),
        newBalance: result.balance!.virtualBalance.toString(),
        proofId: result.proofId,
        streakInfo: result.boosts!.streak,
        nftBoost: result.boosts!.nft,
        engagementBoost: result.boosts!.engagement,
        cosmicBoost: result.boosts!.cosmic,
        reputation: result.boosts!.reputation,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * GET /balance/:address/pouw-task - Retrieve or generate PoUW task based JIT on Bitcoin block
   */
  private async handleGetPouwTask(): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    try {
      const network = getNetworkForEnvironment(this.env.ENVIRONMENT);
      const mempoolService = initMempoolService(
        network,
        this.env.CACHE || null,
      );
      const blockHash = await mempoolService.getCurrentBlockHash();

      // Check if there is an active task for this blockHash in the database
      const rows = this.sql
        .exec(
          "SELECT * FROM pouw_tasks WHERE block_hash = ? AND status = 'active' LIMIT 1",
          blockHash,
        )
        .toArray();

      if (rows.length > 0) {
        const row = rows[0];
        return Response.json({
          success: true,
          data: {
            id: row.id as string,
            type: "pouw",
            input: row.prompt as string,
            seed: row.seed as string,
            blockHash: row.block_hash as string,
          },
        });
      }

      // Generate a new task
      const prompts = [
        "Write a short lore entry about Baby learning how to read the Bitcoin blockchain.",
        "Describe the Genesis Baby's reaction to seeing the Bitcoin difficulty adjustment.",
        "Describe how a baby miner operates a tiny WebGPU mining rig in their crib.",
        "Write a story about a baby discovering Satoshi's whitepaper in their toy chest.",
        "Describe the Genesis Baby's first encounter with a Lightning Network node.",
        "Write a legend about how the Golden Pacifier was forged in a blocks mined by Satoshi.",
      ];
      const prompt = prompts[Math.floor(Math.random() * prompts.length)];
      const taskId = `pouw-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      this.sql.exec(
        `INSERT INTO pouw_tasks (id, block_hash, prompt, seed, created_at, status)
         VALUES (?, ?, ?, ?, ?, 'active')`,
        taskId,
        blockHash,
        prompt,
        blockHash,
        Date.now(),
      );

      return Response.json({
        success: true,
        data: {
          id: taskId,
          type: "pouw",
          input: prompt,
          seed: blockHash,
          blockHash,
        },
      });
    } catch (error) {
      balanceLogger.error("Failed to generate/retrieve PoUW task", {
        error,
        address: this.address,
      });
      return this.errorResponse("Failed to generate PoUW task", 500);
    }
  }

  /**
   * POST /balance/:address/pouw-verify - Verify AI PoUW submission
   *
   * Server-side verification of AI inference results. This is the critical
   * security layer that prevents users from spoofing AI work.
   *
   * Verification steps:
   * 1. Task exists and is in 'active' status
   * 2. Task hasn't expired (5 minute TTL from creation)
   * 3. Output meets minimum quality requirements:
   *    - Minimum 50 characters (non-trivial response)
   *    - Not a copy of the prompt itself
   *    - Contains actual content (not just whitespace/punctuation)
   * 4. Task is marked as 'completed' to prevent double-claiming
   *
   * On success, the submission is stored and the user receives credit.
   */
  private async handleVerifyPouwTask(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    try {
      const body = (await request.json()) as {
        taskId: string;
        output: string;
        computeTime: string;
        signature: string;
        publicKey: string;
      };

      const { taskId, output, computeTime, signature } = body;
      // publicKey and signature are stored for audit trail;
      // full cryptographic verification can be added in a future iteration
      void body.publicKey;

      // ---- Step 1: Validate task exists and is active ----
      const taskRows = this.sql
        .exec(
          "SELECT * FROM pouw_tasks WHERE id = ? AND status = 'active' LIMIT 1",
          taskId,
        )
        .toArray();

      if (taskRows.length === 0) {
        balanceLogger.warn(
          "PoUW verification failed: task not found or not active",
          {
            taskId,
            address: this.address,
          },
        );
        return this.errorResponse(
          "Task not found, already completed, or expired",
          404,
        );
      }

      const task = taskRows[0];
      const taskCreatedAt = task.created_at as number;
      const TASK_TTL_MS = 5 * 60 * 1000; // 5 minutes

      if (Date.now() - taskCreatedAt > TASK_TTL_MS) {
        // Mark expired task as 'expired'
        this.sql.exec(
          "UPDATE pouw_tasks SET status = 'expired' WHERE id = ?",
          taskId,
        );
        balanceLogger.warn("PoUW verification failed: task expired", {
          taskId,
          age: Date.now() - taskCreatedAt,
        });
        return this.errorResponse(
          "Task has expired. Please request a new one.",
          410,
        );
      }

      // ---- Step 2: Validate output quality ----
      const trimmedOutput = output.trim();

      if (trimmedOutput.length < 50) {
        balanceLogger.warn("PoUW verification failed: output too short", {
          taskId,
          outputLength: trimmedOutput.length,
        });
        return this.errorResponse(
          "Output too short. AI inference must produce meaningful results.",
          400,
        );
      }

      // Check that output is not just the prompt echoed back
      const prompt = task.prompt as string;
      if (
        trimmedOutput === prompt.trim() ||
        trimmedOutput.includes(prompt.trim().slice(0, 20))
      ) {
        balanceLogger.warn("PoUW verification failed: output matches prompt", {
          taskId,
        });
        return this.errorResponse(
          "Output appears to be a copy of the input prompt. Please run actual inference.",
          400,
        );
      }

      // Check for obviously fake outputs (just repeated characters)
      const uniqueChars = new Set(trimmedOutput.slice(0, 100)).size;
      if (uniqueChars < 5) {
        balanceLogger.warn("PoUW verification failed: output lacks diversity", {
          taskId,
          uniqueChars,
        });
        return this.errorResponse(
          "Output lacks sufficient content diversity. Please run actual inference.",
          400,
        );
      }

      // ---- Step 3: Store verified submission ----
      const computeTimeNum = parseInt(computeTime, 10) || 0;
      const now = Date.now();

      try {
        this.sql.exec(
          `INSERT INTO pouw_submissions (task_id, address, output, compute_time, signature, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          taskId,
          this.address,
          trimmedOutput,
          computeTimeNum,
          signature,
          now,
        );
      } catch (insertErr) {
        balanceLogger.error("Failed to insert pouw submission", {
          error: String(insertErr),
          taskId,
          address: this.address,
        });
        return this.errorResponse(
          "Failed to record submission. Please try again.",
          500,
        );
      }

      // Mark task as completed to prevent double-claiming
      this.sql.exec(
        "UPDATE pouw_tasks SET status = 'completed' WHERE id = ?",
        taskId,
      );

      // ---- Step 4: Credit the user for useful work ----
      // Base reward: proportional to compute time (capped)
      const baseReward = Math.min(Math.ceil(computeTimeNum / 100), 10);
      // Quality bonus: longer outputs get a small bonus
      const qualityBonus = Math.min(Math.floor(trimmedOutput.length / 200), 5);

      const totalReward = baseReward + qualityBonus;

      // Update virtual balance
      // First try to update existing row
      this.sql.exec(
        `UPDATE balance
         SET virtual_balance = CAST(virtual_balance AS INTEGER) + ?,
             total_mined = CAST(total_mined AS INTEGER) + ?,
             last_mining_at = ?
         WHERE address = ?`,
        totalReward,
        totalReward,
        now,
        this.address,
      );

      // If the address doesn't have a balance row yet, create one.
      // We detect this by checking if the row exists after the UPDATE.
      const checkRow = this.sql
        .exec("SELECT address FROM balance WHERE address = ?", this.address)
        .toArray();

      if (checkRow.length === 0) {
        this.sql.exec(
          `INSERT INTO balance (address, virtual_balance, total_mined, last_mining_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          this.address,
          String(totalReward),
          String(totalReward),
          now,
          now,
          now,
        );
      }

      // Record the credit transaction
      this.sql.exec(
        `INSERT INTO credit_history (address, amount, type, proof_id, created_at)
         VALUES (?, ?, 'pouw', ?, ?)`,
        this.address,
        totalReward,
        taskId,
        now,
      );

      balanceLogger.info("PoUW verification successful", {
        taskId,
        address: this.address,
        outputLength: trimmedOutput.length,
        computeTime: computeTimeNum,
        reward: totalReward,
      });

      return Response.json({
        success: true,
        data: {
          taskId,
          verified: true,
          reward: totalReward,
          outputLength: trimmedOutput.length,
          computeTime: computeTimeNum,
        },
        timestamp: now,
      });
    } catch (error) {
      // Extract meaningful error info from SQLite/DO errors
      const errorInfo: Record<string, unknown> = {};
      if (error instanceof Error) {
        errorInfo.message = error.message;
        errorInfo.name = error.name;
        errorInfo.stack = error.stack;
      } else if (typeof error === "object" && error !== null) {
        // Try to extract properties from SQLite error objects
        for (const key of Object.getOwnPropertyNames(error)) {
          try {
            errorInfo[key] = (error as Record<string, unknown>)[key];
          } catch {
            errorInfo[key] = "[unable to access]";
          }
        }
      } else {
        errorInfo.message = String(error);
      }

      balanceLogger.error(
        "Failed to verify PoUW task",
        error instanceof Error ? error : new Error(JSON.stringify(errorInfo)),
        { address: this.address },
      );
      return this.errorResponse(
        `Failed to verify PoUW submission: ${JSON.stringify(errorInfo)}`,
        500,
      );
    }
  }

  private async handleSetHashrate(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as { hashrate: number };
    if (typeof body.hashrate !== "number" || body.hashrate < 0) {
      return this.errorResponse("Invalid hashrate", 400);
    }

    this.balanceRepo.getOrCreate(this.address);
    const diffState = this.balanceRepo.getDifficultyState();

    const estimatedDiff = estimateInitialDifficulty(
      body.hashrate,
      VARDIFF_CONFIG.targetTime,
      VARDIFF_CONFIG,
    );

    if (estimatedDiff > diffState.currentDiff) {
      diffState.currentDiff = estimatedDiff;
      this.balanceRepo.setDifficultyState(diffState);
      const cachedBalance = this.balanceRepo.getState().cachedBalance;
      if (cachedBalance) this.balanceRepo.update(cachedBalance);
    }

    return Response.json({
      success: true,
      data: {
        suggestedDifficulty: diffState.currentDiff,
        estimatedShareTime: Math.pow(2, diffState.currentDiff) / body.hashrate,
      },
      timestamp: Date.now(),
    });
  }

  // ===========================================================================
  // WITHDRAWAL HANDLERS
  // ===========================================================================

  private async handleReserveWithdraw(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as {
      amount: string;
      requestId: string;
    };
    const amount = BigInt(body.amount);
    const minWithdraw = BigInt(
      this.env.MIN_WITHDRAW_AMOUNT || DEFAULT_MIN_WITHDRAW,
    );

    if (amount < minWithdraw) {
      return this.errorResponse(
        `Minimum withdrawal is ${minWithdraw} tokens`,
        400,
      );
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    if (amount > available) {
      return this.errorResponse(
        `Insufficient balance. Available: ${available}`,
        400,
      );
    }

    balance.pendingWithdraw += amount;
    this.balanceRepo.update(balance);

    return Response.json({
      success: true,
      data: {
        reserved: amount.toString(),
        pendingTotal: balance.pendingWithdraw.toString(),
        availableAfter: (
          balance.virtualBalance - balance.pendingWithdraw
        ).toString(),
      },
      timestamp: Date.now(),
    });
  }

  private async handleConfirmWithdraw(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as { amount: string; txid: string };
    const amount = BigInt(body.amount);
    const balance = this.balanceRepo.getOrCreate(this.address);

    if (amount > balance.pendingWithdraw) {
      return this.errorResponse("Amount exceeds pending withdrawal", 400);
    }

    balance.pendingWithdraw -= amount;
    balance.virtualBalance -= amount;
    balance.totalWithdrawn += amount;
    this.balanceRepo.update(balance);

    return Response.json({
      success: true,
      data: {
        withdrawn: amount.toString(),
        txid: body.txid,
        newBalance: balance.virtualBalance.toString(),
      },
      timestamp: Date.now(),
    });
  }

  private async handleCancelWithdraw(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as {
      amount: string;
      requestId: string;
    };
    const amount = BigInt(body.amount);
    const balance = this.balanceRepo.getOrCreate(this.address);

    if (amount > balance.pendingWithdraw) {
      return this.errorResponse("Amount exceeds pending withdrawal", 400);
    }

    balance.pendingWithdraw -= amount;
    this.balanceRepo.update(balance);

    return Response.json({
      success: true,
      data: {
        released: amount.toString(),
        availableNow: (
          balance.virtualBalance - balance.pendingWithdraw
        ).toString(),
      },
      timestamp: Date.now(),
    });
  }

  private async handleDeductBalance(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as { amount: string; reason: string };
    if (!body.amount || !body.reason) {
      return this.errorResponse("Amount and reason are required", 400);
    }

    const amount = BigInt(body.amount);
    if (amount <= 0n) {
      return this.errorResponse("Amount must be positive", 400);
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    if (amount > available) {
      return this.errorResponse(
        `Insufficient balance. Available: ${available}, required: ${amount}`,
        400,
      );
    }

    balance.virtualBalance -= amount;
    this.balanceRepo.update(balance);

    balanceLogger.info("Deducted balance", {
      amount: amount.toString(),
      address: this.address,
      reason: body.reason,
    });

    return Response.json({
      success: true,
      data: {
        deducted: amount.toString(),
        newBalance: balance.virtualBalance.toString(),
        reason: body.reason,
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Faucet credit handler (Phase 1)
   *
   * Credits BABTC tokens from the faucet with no proof required.
   * Used in Phase 1 before mining is active so users can evolve NFTs.
   */
  private async handleFaucetCredit(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    let body: { amount: string; maxTotal?: string; cooldownMs?: number };
    try {
      body = (await request.json()) as {
        amount: string;
        maxTotal?: string;
        cooldownMs?: number;
      };
    } catch {
      return this.errorResponse("Invalid JSON body", 400);
    }

    if (!body.amount) {
      return this.errorResponse("Amount is required", 400);
    }

    const amount = BigInt(body.amount);
    if (amount <= 0n) {
      return this.errorResponse("Amount must be positive", 400);
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    const now = Date.now();

    // Sybil protection: Require at least 1 successfully mined share (proof) in Phase 2+
    const phaseNum = parseInt(this.env.PHASE || "1", 10);
    if (phaseNum >= 2) {
      const proofCountResult = this.sql
        .exec(
          "SELECT COUNT(*) as count FROM mining_proofs WHERE address = ?",
          this.address,
        )
        .toArray();
      const count = (proofCountResult[0]?.count as number) || 0;
      if (count === 0) {
        return this.errorResponse(
          "Faucet access denied. You must mine at least 1 valid share (Proof of Work) before using the faucet in Phase 2+.",
          403,
        );
      }
    }

    // 1. Check Cooldown
    if (body.cooldownMs && body.cooldownMs > 0) {
      const timeSinceLastClaim = now - balance.faucetLastClaimAt;
      if (timeSinceLastClaim < body.cooldownMs) {
        const remainingMs = body.cooldownMs - timeSinceLastClaim;
        return this.errorResponse(
          `Faucet cooldown active. Try again in ${Math.ceil(remainingMs / 1000)} seconds.`,
          429,
        );
      }
    }

    // 2. Check Max Claim limit
    if (body.maxTotal) {
      const maxTotal = BigInt(body.maxTotal);
      const totalClaimedAfter = balance.faucetTotalClaimed + amount;
      if (totalClaimedAfter > maxTotal) {
        return this.errorResponse(
          `Maximum faucet total reached (${maxTotal} BABTC). You have claimed ${balance.faucetTotalClaimed}.`,
          400,
        );
      }
    }

    // Credit to virtual balance, total mined, and faucet fields
    balance.virtualBalance += amount;
    balance.totalMined += amount;
    balance.faucetLastClaimAt = now;
    balance.faucetTotalClaimed += amount;
    this.balanceRepo.update(balance);

    balanceLogger.info("Faucet credited", {
      amount: amount.toString(),
      address: this.address,
      newBalance: balance.virtualBalance.toString(),
      totalMined: balance.totalMined.toString(),
      faucetLastClaimAt: balance.faucetLastClaimAt,
      faucetTotalClaimed: balance.faucetTotalClaimed.toString(),
    });

    // Update leaderboard async
    this.updateLeaderboardAsync(this.address, balance.totalMined);

    return Response.json({
      success: true,
      data: {
        credited: amount.toString(),
        newBalance: balance.virtualBalance.toString(),
        totalMined: balance.totalMined.toString(),
        faucetLastClaimAt: balance.faucetLastClaimAt,
        faucetTotalClaimed: balance.faucetTotalClaimed.toString(),
      },
      timestamp: now,
    });
  }

  // ===========================================================================
  // CLAIM HANDLERS
  // ===========================================================================

  private handleGetClaimableBalance(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    const proofs = this.proofRepo.getUnclaimed(this.address);

    let claimableTokens = 0n;
    let unclaimedWork = 0n;
    let lastProofAt = 0;

    for (const proof of proofs) {
      claimableTokens += BigInt(proof.reward);
      unclaimedWork += calculateWorkFromDifficulty(proof.difficulty);
      if (lastProofAt === 0) lastProofAt = proof.createdAt;
    }

    const { total: totalClaimed, count: claimCount } =
      this.claimRepo.getTotalClaimed(this.address);

    const data: ClaimableBalance = {
      address: this.address,
      unclaimedWork,
      unclaimedProofs: proofs.length,
      claimableTokens,
      lastProofAt,
      totalClaimed,
      claimCount,
    };

    return Response.json({
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
    });
  }

  private async handlePrepareClaim(): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    // Cancel pending claims first
    const pending = this.claimRepo.getPending(this.address);
    for (const claim of pending) {
      this.claimRepo.updateStatus(claim.id, this.address, "cancelled");
      this.proofRepo.releaseFromClaim(claim.id);
    }

    // Check for broadcast claims (can't cancel those)
    const broadcast = this.claimRepo.getBroadcast(this.address);
    if (broadcast.length > 0) {
      return this.errorResponse(
        "You have a broadcast claim waiting for confirmation. Please wait for it to complete.",
        409,
      );
    }

    // Get unclaimed proofs
    const proofs = this.proofRepo.getUnclaimed(this.address);
    if (proofs.length === 0) {
      return this.errorResponse("No unclaimed proofs to claim", 400);
    }

    // Calculate totals
    let totalWork = 0n;
    let actualTokens = 0n;
    const proofHashes: string[] = [];

    for (const proof of proofs) {
      totalWork += calculateWorkFromDifficulty(proof.difficulty);
      actualTokens += BigInt(proof.reward);
      proofHashes.push(proof.hash);
    }

    const MIN_CLAIM_TOKENS = 10n;
    if (actualTokens < MIN_CLAIM_TOKENS) {
      return this.errorResponse(
        `Minimum ${MIN_CLAIM_TOKENS} tokens required to claim. Current: ${actualTokens}`,
        400,
      );
    }

    // Get proof aggregator - prefer CLAIM_SECRET_KEY for better security separation
    const serverSecret = this.env.CLAIM_SECRET_KEY || this.env.ADMIN_KEY;
    if (!serverSecret) {
      return this.errorResponse(
        "Server not configured for claims (missing CLAIM_SECRET_KEY)",
        500,
      );
    }

    const aggregator = getProofAggregator(serverSecret);

    const miningProofs = proofs.map((p) => ({
      hash: p.hash,
      difficulty: p.difficulty,
      nonce: 0,
      blockData: "",
    }));

    const aggregatedProof = await aggregator.aggregateProofs(
      this.address,
      miningProofs,
    );
    aggregatedProof.tokenAmount = actualTokens;

    const feeRate = 5;
    const estimatedFee = estimateClaimFee(feeRate);
    const claimData = await aggregator.createClaimDataAsync(
      aggregatedProof,
      estimatedFee,
    );

    const now = aggregatedProof.timestamp;
    const expiresAt = now + CLAIM_EXPIRATION_MS;
    const claimId = aggregatedProof.nonce;

    // Save claim
    this.claimRepo.create({
      id: claimId,
      address: this.address,
      amount: aggregatedProof.tokenAmount.toString(),
      proofCount: proofs.length,
      totalWork: aggregatedProof.totalWork.toString(),
      merkleRoot: aggregatedProof.merkleRoot,
      serverSignature: claimData.serverSignature,
      opReturnData: claimData.opReturnData,
      expiresAt,
      preparedAt: now,
    });

    // Mark proofs as being claimed
    const proofIds = proofs.map((p) => p.id);
    this.proofRepo.assignToClaim(proofIds, claimId);

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
      proofCount: proofs.length,
      tokenAmount: aggregatedProof.tokenAmount.toString(),
      estimatedFee,
      expiresAt,
    };

    return Response.json({
      success: true,
      data: responseData,
      timestamp: now,
    });
  }

  private async handleConfirmClaim(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as {
      claimId: string;
      claimTxid: string;
    };
    if (!body.claimId || !body.claimTxid) {
      return this.errorResponse("claimId and claimTxid are required", 400);
    }

    const claim = this.claimRepo.get(body.claimId, this.address);
    if (!claim) return this.errorResponse("Claim not found", 404);

    if (claim.status !== "prepared") {
      return this.errorResponse(
        `Claim already in status: ${claim.status}. Cannot confirm.`,
        400,
      );
    }

    if (Date.now() > claim.expiresAt) {
      this.claimRepo.updateStatus(body.claimId, this.address, "expired");
      this.proofRepo.releaseFromClaim(body.claimId);
      return this.errorResponse("Claim has expired", 410);
    }

    this.claimRepo.updateStatus(body.claimId, this.address, "broadcast", {
      claimTxid: body.claimTxid,
    });
    this.proofRepo.markClaimed(body.claimId);

    // Deduct the claimed amount from the user's virtual balance to prevent double spending
    const balance = this.balanceRepo.getOrCreate(this.address);
    const amountToDeduct = BigInt(claim.amount);
    balance.virtualBalance -= amountToDeduct;
    balance.totalWithdrawn += amountToDeduct;
    this.balanceRepo.update(balance);

    const responseData: ClaimConfirmResponse = {
      status: "broadcast",
      mintTxid: null,
      tokensMinted: null,
      nextStep:
        "Wait for TX confirmation (6 blocks), then call /api/claim/mint",
    };

    return Response.json({
      success: true,
      data: responseData,
      timestamp: Date.now(),
    });
  }

  private handleGetRetriableClaims(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);
    const retriable = this.claimRepo.getRetriable(this.address);
    return Response.json({
      success: true,
      data: { retriable },
      timestamp: Date.now(),
    });
  }

  private handleCleanupExpired(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);
    const expired = this.claimRepo.getExpiredPrepared(Date.now());
    for (const claim of expired) {
      this.claimRepo.updateStatus(claim.id, this.address, "expired");
      this.proofRepo.releaseFromClaim(claim.id);
    }
    return Response.json({
      success: true,
      data: { cleanedCount: expired.length },
      timestamp: Date.now(),
    });
  }

  private async handleCancelClaim(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as { claimId?: string };

    if (!body.claimId) {
      const cancelled = this.claimRepo.cancelAllPending(this.address);
      const pending = this.claimRepo.getPending(this.address);
      for (const claim of pending) {
        this.proofRepo.releaseFromClaim(claim.id);
      }
      return Response.json({
        success: true,
        data: { cancelled },
        timestamp: Date.now(),
      });
    }

    const claim = this.claimRepo.get(body.claimId, this.address);
    if (!claim) return this.errorResponse("Claim not found", 404);

    if (claim.status !== "prepared") {
      return this.errorResponse(
        `Cannot cancel claim in status: ${claim.status}. Only 'prepared' claims can be cancelled.`,
        400,
      );
    }

    this.claimRepo.updateStatus(body.claimId, this.address, "cancelled");
    this.proofRepo.releaseFromClaim(body.claimId);

    return Response.json({
      success: true,
      data: { cancelled: true, claimId: body.claimId },
      timestamp: Date.now(),
    });
  }

  private handleGetClaimStatus(claimId: string): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    const claim = this.claimRepo.get(claimId, this.address);
    if (!claim) return this.errorResponse("Claim not found", 404);

    return Response.json({
      success: true,
      data: {
        id: claim.id,
        address: claim.address,
        amount: claim.amount,
        proofCount: claim.proofCount,
        totalWork: claim.totalWork,
        merkleRoot: claim.merkleRoot,
        serverSignature: claim.serverSignature,
        opReturnData: claim.opReturnData,
        claimTxid: claim.claimTxid,
        mintTxid: claim.mintTxid,
        status: claim.status,
        error: claim.error,
        preparedAt: claim.preparedAt,
        confirmedAt: claim.confirmedAt,
        mintedAt: claim.mintedAt,
      },
      timestamp: Date.now(),
    });
  }

  private handleGetClaimHistory(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    const claims = this.claimRepo.getHistory(this.address);

    return Response.json({
      success: true,
      data: {
        claims: claims.map((c) => ({
          id: c.id,
          amount: c.amount,
          proofCount: c.proofCount,
          status: c.status,
          claimTxid: c.claimTxid,
          mintTxid: c.mintTxid,
          error: c.error,
          preparedAt: c.preparedAt,
          confirmedAt: c.confirmedAt,
          mintedAt: c.mintedAt,
        })),
      },
      timestamp: Date.now(),
    });
  }

  private async handleUpdateClaimStatus(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    const body = (await request.json()) as {
      claimId: string;
      status: ClaimStatus;
      mintTxid?: string;
      error?: string;
    };

    if (!body.claimId || !body.status) {
      return this.errorResponse("claimId and status required", 400);
    }

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

    const claim = this.claimRepo.get(body.claimId, this.address);
    if (!claim) return this.errorResponse("Claim not found", 404);

    const isDebitedStatus = (s: string) => ["broadcast", "confirmed", "minting"].includes(s);
    const isErrorStatus = (s: string) => ["failed", "cancelled", "expired"].includes(s);

    if (isErrorStatus(body.status)) {
      // If the claim was already debited, refund the virtual balance
      if (isDebitedStatus(claim.status)) {
        const balance = this.balanceRepo.getOrCreate(this.address);
        const amountToRefund = BigInt(claim.amount);
        balance.virtualBalance += amountToRefund;
        
        if (balance.totalWithdrawn >= amountToRefund) {
          balance.totalWithdrawn -= amountToRefund;
        } else {
          balance.totalWithdrawn = 0n;
        }
        
        this.balanceRepo.update(balance);
        balanceLogger.info("Refunded virtual balance for failed claim", {
          claimId: body.claimId,
          address: this.address,
          amount: amountToRefund.toString(),
        });
      }

      // Release the associated proofs so they can be claimed again
      this.proofRepo.releaseFromClaim(body.claimId);
      balanceLogger.info("Released proofs for failed claim", {
        claimId: body.claimId,
        address: this.address,
      });
    }

    this.claimRepo.updateStatus(body.claimId, this.address, body.status, {
      mintTxid: body.mintTxid,
      error: body.error,
    });

    return Response.json({
      success: true,
      data: { status: body.status },
      timestamp: Date.now(),
    });
  }

  private handleReconcile(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);
    const balance = this.balanceRepo.getOrCreate(this.address);
    this.updateLeaderboardAsync(this.address, balance.totalMined);
    return Response.json({
      success: true,
      data: {
        reconciled: true,
        address: this.address,
        totalMined: balance.totalMined.toString(),
      },
      timestamp: Date.now(),
    });
  }

  // ===========================================================================
  // ADMIN HANDLERS
  // ===========================================================================

  private handleReset(): Response {
    if (!this.address) return this.errorResponse("Address required", 400);

    this.proofRepo.deleteForAddress(this.address);
    this.balanceRepo.delete(this.address);
    this.claimRepo.deleteForAddress(this.address);

    this.balanceRepo.clearCache();
    this.proofRepo.clearCache();

    return Response.json({
      success: true,
      data: { reset: true },
      timestamp: Date.now(),
    });
  }

  private handleFullReset(): Response {
    this.sql.exec("DROP TABLE IF EXISTS mining_proofs");
    this.sql.exec("DROP TABLE IF EXISTS balance");
    this.sql.exec("DROP TABLE IF EXISTS claims");

    this.initializeSchema();
    this.initializeRepositories();

    return Response.json({
      success: true,
      data: { fullReset: true },
      timestamp: Date.now(),
    });
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private errorResponse(message: string, status: number): Response {
    return Response.json(
      { success: false, error: message, timestamp: Date.now() },
      { status },
    );
  }

  private updateLeaderboardAsync(address: string, totalMined: bigint): void {
    this.ctx.waitUntil(
      (async () => {
        try {
          const redis = getRedis(this.env);
          const score =
            totalMined > BigInt(Number.MAX_SAFE_INTEGER)
              ? Number.MAX_SAFE_INTEGER
              : Number(totalMined);

          await updateAllPeriods(redis, "miners", address, score);
          await updateAllPeriods(redis, "earners", address, score);
          await updateUserStats(redis, {
            address,
            totalHashes: score,
            totalTokens: score,
          });
        } catch (error) {
          balanceLogger.error("Leaderboard update failed", error);
        }
      })(),
    );
  }
}
