/**
 * Proof Repository
 *
 * Handles storage and retrieval of mining proofs.
 * Includes rate limiting queries and pruning.
 */

import { balanceLogger } from "../../lib/logger";

export interface StoredProof {
  id: string;
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  reward: string;
  credited: boolean;
  claimed: boolean;
  claimId: string | null;
  address: string | null;
  createdAt: number;
}

export interface ProofRepositoryState {
  sharesThisHourCache: number;
  sharesHourStartedAt: number;
}

export class ProofRepository {
  private sql: SqlStorage;
  private state: ProofRepositoryState;

  constructor(sql: SqlStorage, initialState?: ProofRepositoryState) {
    this.sql = sql;
    this.state = initialState || {
      sharesThisHourCache: 0,
      sharesHourStartedAt: 0,
    };
  }

  /**
   * Get current state
   */
  getState(): ProofRepositoryState {
    return this.state;
  }

  /**
   * Store a new mining proof
   */
  store(proof: {
    id: string;
    hash: string;
    nonce: number;
    difficulty: number;
    blockData: string;
    reward: bigint;
    address: string;
  }): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO mining_proofs
       (id, hash, nonce, difficulty, block_data, reward, credited, address, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      proof.id,
      proof.hash,
      proof.nonce,
      proof.difficulty,
      proof.blockData,
      proof.reward.toString(),
      proof.address,
      now,
    );
  }

  /**
   * Check if proof hash already exists
   */
  exists(hash: string): boolean {
    const rows = this.sql
      .exec("SELECT 1 FROM mining_proofs WHERE hash = ? LIMIT 1", hash)
      .toArray();
    return rows.length > 0;
  }

  /**
   * Get unclaimed proofs for an address
   */
  getUnclaimed(address: string): StoredProof[] {
    const rows = this.sql
      .exec(
        `SELECT * FROM mining_proofs
         WHERE address = ? AND credited = 1 AND claimed = 0
         ORDER BY created_at DESC`,
        address,
      )
      .toArray();

    return rows.map((row) => ({
      id: row.id as string,
      hash: row.hash as string,
      nonce: row.nonce as number,
      difficulty: row.difficulty as number,
      blockData: row.block_data as string,
      reward: row.reward as string,
      credited: (row.credited as number) === 1,
      claimed: (row.claimed as number) === 1,
      claimId: (row.claim_id as string) || null,
      address: (row.address as string) || null,
      createdAt: row.created_at as number,
    }));
  }

  /**
   * Get recent proofs (for history)
   */
  getRecent(
    limit: number,
  ): Array<{ id: string; amount: string; timestamp: number }> {
    const rows = this.sql
      .exec(
        `SELECT id, reward, created_at
         FROM mining_proofs
         WHERE credited = 1
         ORDER BY created_at DESC
         LIMIT ?`,
        Math.min(limit, 100),
      )
      .toArray();

    return rows.map((row) => ({
      id: row.id as string,
      amount: row.reward as string,
      timestamp: row.created_at as number,
    }));
  }

  /**
   * Mark proofs as belonging to a claim
   */
  assignToClaim(proofIds: string[], claimId: string): void {
    for (const proofId of proofIds) {
      this.sql.exec(
        `UPDATE mining_proofs SET claim_id = ? WHERE id = ?`,
        claimId,
        proofId,
      );
    }
  }

  /**
   * Mark proofs as claimed
   */
  markClaimed(claimId: string): void {
    this.sql.exec(
      `UPDATE mining_proofs SET claimed = 1 WHERE claim_id = ?`,
      claimId,
    );
  }

  /**
   * Release proofs from a claim (for cancellation)
   */
  releaseFromClaim(claimId: string): void {
    this.sql.exec(
      `UPDATE mining_proofs SET claim_id = NULL WHERE claim_id = ?`,
      claimId,
    );
  }

  /**
   * Get number of shares in the last hour (rate limiting)
   */
  getSharesInLastHour(): number {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    // 5 second cache max for security
    const cacheAge = now - this.state.sharesHourStartedAt;
    const cacheValid = cacheAge < 5000;

    if (!cacheValid || this.state.sharesHourStartedAt === 0) {
      const result = this.sql
        .exec(
          `SELECT COUNT(*) as count FROM mining_proofs WHERE created_at > ?`,
          oneHourAgo,
        )
        .toArray();
      this.state.sharesThisHourCache = (result[0]?.count as number) || 0;
      this.state.sharesHourStartedAt = now;
    }

    return this.state.sharesThisHourCache;
  }

  /**
   * Increment share counter (after successful credit)
   */
  incrementShareCounter(): void {
    this.state.sharesThisHourCache++;
  }

  /**
   * Prune old proofs to prevent unbounded storage growth
   * Keeps last 30 days, deletes older credited/claimed proofs
   */
  pruneOld(): number {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;

    const result = this.sql.exec(
      `DELETE FROM mining_proofs
       WHERE created_at < ?
       AND credited = 1
       AND (claimed = 1 OR claim_id IS NULL)`,
      thirtyDaysAgo,
    );

    const deleted = result.rowsWritten;
    if (deleted > 0) {
      balanceLogger.info("Pruned old proofs", {
        deleted,
        cutoffDate: new Date(thirtyDaysAgo).toISOString(),
      });
    }

    return deleted;
  }

  /**
   * Delete all proofs for an address
   */
  deleteForAddress(address: string): void {
    this.sql.exec("DELETE FROM mining_proofs WHERE address = ?", address);
  }

  /**
   * Clear rate limit cache
   */
  clearCache(): void {
    this.state.sharesThisHourCache = 0;
    this.state.sharesHourStartedAt = 0;
  }
}
