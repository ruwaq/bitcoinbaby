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
  MiningProof,
  ApiResponse,
  BalanceResponse,
  ClaimableBalance,
  ClaimPrepareResponse,
  ClaimConfirmResponse,
  ClaimStatus,
} from "../lib/types";
import { CLAIM_EXPIRATION_MS } from "../lib/types";
import {
  getProofAggregator,
  calculateWorkFromDifficulty,
  estimateClaimFee,
} from "../services/proof-aggregator";
import { estimateInitialDifficulty, VARDIFF_CONFIG } from "../lib/vardiff";
import { getRedis, updateAllPeriods, updateUserStats } from "../lib/redis";

// Modular repositories and services
import {
  BalanceRepository,
  ProofRepository,
  ClaimRepository,
} from "./repositories";
import { processMiningCredit } from "./services";

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

  /**
   * Initialize SQLite schema
   */
  private async initializeSchema(): Promise<void> {
    // Balance table
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

    // Migrations
    try {
      this.sql.exec(
        `ALTER TABLE balance ADD COLUMN streak_count INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      /* exists */
    }
    try {
      this.sql.exec(`ALTER TABLE balance ADD COLUMN difficulty_state TEXT`);
    } catch {
      /* exists */
    }

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
        address TEXT,
        created_at INTEGER NOT NULL
      )
    `);

    try {
      this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN address TEXT`);
    } catch {
      /* exists */
    }
    try {
      this.sql.exec(
        `ALTER TABLE mining_proofs ADD COLUMN claimed INTEGER NOT NULL DEFAULT 0`,
      );
    } catch {
      /* exists */
    }
    try {
      this.sql.exec(`ALTER TABLE mining_proofs ADD COLUMN claim_id TEXT`);
    } catch {
      /* exists */
    }

    // Indexes
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_proofs_credited ON mining_proofs(credited)`,
    );
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_proofs_address ON mining_proofs(address)`,
    );
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_proofs_claimed ON mining_proofs(claimed)`,
    );
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_proofs_created_at ON mining_proofs(created_at)`,
    );

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

    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_claims_address ON claims(address)`,
    );
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status)`,
    );
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
          if (action === "history") {
            const limit = parseInt(url.searchParams.get("limit") || "100", 10);
            return this.handleGetHistory(limit);
          }
          if (action === "claimable") return this.handleGetClaimableBalance();
          if (action === "claim-history") return this.handleGetClaimHistory();
          if (action === "claim-status") {
            const claimId = pathParts[3];
            if (!claimId) return this.errorResponse("Claim ID required", 400);
            return this.handleGetClaimStatus(claimId);
          }
          break;

        case "POST":
          if (action === "credit") return this.handleCreditMining(request);
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
  // MINING CREDIT
  // ===========================================================================

  private async handleCreditMining(request: Request): Promise<Response> {
    if (!this.address) return this.errorResponse("Address required", 400);

    let proof: MiningProof;
    try {
      proof = (await request.json()) as MiningProof;
    } catch {
      return this.errorResponse("Invalid JSON body", 400);
    }

    if (!proof || !proof.hash || !proof.blockData) {
      return this.errorResponse("Invalid proof: missing required fields", 400);
    }

    const balance = this.balanceRepo.getOrCreate(this.address);
    const difficultyState = this.balanceRepo.getDifficultyState();
    const sharesInLastHour = this.proofRepo.getSharesInLastHour();

    const result = await processMiningCredit(proof, {
      env: this.env,
      address: this.address,
      balance,
      difficultyState,
      sharesInLastHour,
    });

    if (!result.success) {
      return this.errorResponse(result.error!, result.errorCode || 500);
    }

    // Store proof
    this.proofRepo.store({
      id: result.proofId!,
      hash: proof.hash,
      nonce:
        typeof proof.nonce === "string"
          ? parseInt(proof.nonce, 10)
          : proof.nonce,
      difficulty: proof.difficulty,
      blockData: proof.blockData,
      reward: result.reward!,
      address: this.address,
    });

    // Update balance
    this.balanceRepo.update(result.balance!);
    this.proofRepo.incrementShareCounter();

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
        varDiff: result.varDiff,
      },
      timestamp: Date.now(),
    });
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

    // Get proof aggregator
    const serverSecret = this.env.ADMIN_KEY;
    if (!serverSecret) {
      return this.errorResponse("Server not configured for claims", 500);
    }

    const aggregator = getProofAggregator(serverSecret);

    const miningProofs = proofs.map((p) => ({
      hash: p.hash,
      difficulty: p.difficulty,
      nonce: 0,
      blockData: "",
    }));

    const aggregatedProof = aggregator.aggregateProofs(
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

    const now = Date.now();
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
