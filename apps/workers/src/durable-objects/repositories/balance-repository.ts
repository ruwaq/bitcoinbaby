/**
 * Balance Repository
 *
 * Handles CRUD operations for user virtual balances.
 * Includes in-memory caching to reduce SQLite reads.
 */

import type { VirtualBalance } from "../../lib/types";
import {
  createInitialState,
  deserializeState,
  serializeState,
  type UserDifficultyState,
} from "../../lib/vardiff";

const CACHE_TTL_MS = 60_000; // 1 minute cache

export interface BalanceRepositoryState {
  cachedBalance: VirtualBalance | null;
  cacheLoadedAt: number;
  difficultyState: UserDifficultyState | null;
}

export class BalanceRepository {
  private sql: SqlStorage;
  private state: BalanceRepositoryState;

  constructor(sql: SqlStorage, initialState?: BalanceRepositoryState) {
    this.sql = sql;
    this.state = initialState || {
      cachedBalance: null,
      cacheLoadedAt: 0,
      difficultyState: null,
    };
  }

  /**
   * Get current state (for persistence between requests)
   */
  getState(): BalanceRepositoryState {
    return this.state;
  }

  /**
   * Get or create balance record with caching
   */
  getOrCreate(address: string): VirtualBalance {
    const now = Date.now();

    // Return cached if valid
    if (
      this.state.cachedBalance &&
      this.state.cachedBalance.address === address &&
      now - this.state.cacheLoadedAt < CACHE_TTL_MS
    ) {
      return this.state.cachedBalance;
    }

    // Try to get existing
    const rows = this.sql
      .exec("SELECT * FROM balance WHERE address = ? LIMIT 1", address)
      .toArray();

    if (rows.length > 0) {
      const row = rows[0];
      this.state.cachedBalance = {
        address: row.address as string,
        virtualBalance: BigInt(row.virtual_balance as string),
        totalMined: BigInt(row.total_mined as string),
        totalWithdrawn: BigInt(row.total_withdrawn as string),
        pendingWithdraw: BigInt(row.pending_withdraw as string),
        streakCount: (row.streak_count as number) || 0,
        lastMiningAt: row.last_mining_at as number,
        faucetLastClaimAt: (row.faucet_last_claim_at as number) || 0,
        faucetTotalClaimed: BigInt((row.faucet_total_claimed as string) || "0"),
        createdAt: row.created_at as number,
        updatedAt: row.updated_at as number,
        reputationScore: typeof row.reputation_score === "number" ? row.reputation_score : 100,
        lockoutUntil: typeof row.lockout_until === "number" ? row.lockout_until : 0,
      };
      this.state.difficultyState = deserializeState(
        row.difficulty_state as string | null,
      );
      this.state.cacheLoadedAt = now;
      return this.state.cachedBalance;
    }

    // Create new
    this.sql.exec(
      `INSERT INTO balance (address, streak_count, reputation_score, lockout_until, created_at, updated_at) VALUES (?, 0, 100, 0, ?, ?)`,
      address,
      now,
      now,
    );

    this.state.cachedBalance = {
      address,
      virtualBalance: 0n,
      totalMined: 0n,
      totalWithdrawn: 0n,
      pendingWithdraw: 0n,
      streakCount: 0,
      lastMiningAt: 0,
      faucetLastClaimAt: 0,
      faucetTotalClaimed: 0n,
      createdAt: now,
      updatedAt: now,
      reputationScore: 100,
      lockoutUntil: 0,
    };
    this.state.difficultyState = createInitialState();
    this.state.cacheLoadedAt = now;

    return this.state.cachedBalance;
  }

  /**
   * Update balance in database and cache
   */
  update(balance: VirtualBalance): void {
    const now = Date.now();
    const diffStateJson = this.state.difficultyState
      ? serializeState(this.state.difficultyState)
      : null;

    this.sql.exec(
      `UPDATE balance SET
        virtual_balance = ?,
        total_mined = ?,
        total_withdrawn = ?,
        pending_withdraw = ?,
        streak_count = ?,
        last_mining_at = ?,
        faucet_last_claim_at = ?,
        faucet_total_claimed = ?,
        difficulty_state = ?,
        reputation_score = ?,
        lockout_until = ?,
        updated_at = ?
       WHERE address = ?`,
      balance.virtualBalance.toString(),
      balance.totalMined.toString(),
      balance.totalWithdrawn.toString(),
      balance.pendingWithdraw.toString(),
      balance.streakCount,
      balance.lastMiningAt,
      balance.faucetLastClaimAt,
      balance.faucetTotalClaimed.toString(),
      diffStateJson,
      balance.reputationScore ?? 100,
      balance.lockoutUntil ?? 0,
      now,
      balance.address,
    );

    // Update cache
    this.state.cachedBalance = { ...balance, updatedAt: now };
    this.state.cacheLoadedAt = now;
  }

  /**
   * Get difficulty state (lazy initialization)
   */
  getDifficultyState(): UserDifficultyState {
    if (!this.state.difficultyState) {
      this.state.difficultyState = createInitialState();
    }
    return this.state.difficultyState;
  }

  /**
   * Update difficulty state
   */
  setDifficultyState(state: UserDifficultyState): void {
    this.state.difficultyState = state;
  }

  /**
   * Delete balance for address
   */
  delete(address: string): void {
    this.sql.exec("DELETE FROM balance WHERE address = ?", address);
    this.clearCache();
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.state.cachedBalance = null;
    this.state.cacheLoadedAt = 0;
    this.state.difficultyState = null;
  }
}
