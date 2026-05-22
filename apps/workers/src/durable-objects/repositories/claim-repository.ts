/**
 * Claim Repository
 *
 * Handles storage and retrieval of token claims.
 */

import type { ClaimStatus } from "../../lib/types";

export interface StoredClaim {
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
  expiresAt: number;
}

export class ClaimRepository {
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    this.sql = sql;
  }

  /**
   * Create a new claim
   */
  create(claim: {
    id: string;
    address: string;
    amount: string;
    proofCount: number;
    totalWork: string;
    merkleRoot: string;
    serverSignature: string;
    opReturnData: string;
    expiresAt: number;
    preparedAt?: number;
  }): void {
    const preparedAt = claim.preparedAt || Date.now();
    this.sql.exec(
      `INSERT INTO claims
       (id, address, amount, proof_count, total_work, merkle_root, server_signature, op_return_data, status, prepared_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'prepared', ?, ?)`,
      claim.id,
      claim.address,
      claim.amount,
      claim.proofCount,
      claim.totalWork,
      claim.merkleRoot,
      claim.serverSignature,
      claim.opReturnData,
      preparedAt,
      claim.expiresAt,
    );
  }

  /**
   * Get claim by ID and address
   */
  get(claimId: string, address: string): StoredClaim | null {
    const rows = this.sql
      .exec(
        `SELECT * FROM claims WHERE id = ? AND address = ?`,
        claimId,
        address,
      )
      .toArray();

    if (rows.length === 0) return null;
    return this.mapRow(rows[0]);
  }

  /**
   * Get pending claims for an address
   */
  getPending(address: string): StoredClaim[] {
    const now = Date.now();
    const rows = this.sql
      .exec(
        `SELECT * FROM claims
         WHERE address = ? AND status = 'prepared' AND expires_at > ?`,
        address,
        now,
      )
      .toArray();

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Get broadcast claims (TX sent, waiting confirmation)
   */
  getBroadcast(address: string): StoredClaim[] {
    const now = Date.now();
    const rows = this.sql
      .exec(
        `SELECT * FROM claims
         WHERE address = ? AND status = 'broadcast' AND expires_at > ?`,
        address,
        now,
      )
      .toArray();

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Get expired prepared claims
   */
  getExpiredPrepared(now: number): StoredClaim[] {
    const rows = this.sql
      .exec(
        `SELECT * FROM claims
         WHERE status = 'prepared' AND expires_at <= ?`,
        now,
      )
      .toArray();

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Get claims that can be retried (broadcast or failed status)
   */
  getRetriable(address: string): StoredClaim[] {
    const rows = this.sql
      .exec(
        `SELECT * FROM claims
         WHERE address = ? AND (status = 'broadcast' OR status = 'failed')`,
        address,
      )
      .toArray();

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Get claim history for an address
   */
  getHistory(address: string, limit: number = 50): StoredClaim[] {
    const rows = this.sql
      .exec(
        `SELECT * FROM claims WHERE address = ? ORDER BY prepared_at DESC LIMIT ?`,
        address,
        limit,
      )
      .toArray();

    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Get total claimed amount for completed claims
   */
  getTotalClaimed(address: string): { total: bigint; count: number } {
    const sumRows = this.sql
      .exec(
        `SELECT SUM(CAST(amount AS INTEGER)) as total FROM claims
         WHERE address = ? AND status = 'completed'`,
        address,
      )
      .toArray();
    const total = BigInt((sumRows[0]?.total as number) || 0);

    const countRows = this.sql
      .exec(
        `SELECT COUNT(*) as count FROM claims
         WHERE address = ? AND status = 'completed'`,
        address,
      )
      .toArray();
    const count = (countRows[0]?.count as number) || 0;

    return { total, count };
  }

  /**
   * Update claim status
   */
  updateStatus(
    claimId: string,
    address: string,
    status: ClaimStatus,
    extra?: { claimTxid?: string; mintTxid?: string; error?: string },
  ): boolean {
    const now = Date.now();

    if (status === "broadcast" && extra?.claimTxid) {
      this.sql.exec(
        `UPDATE claims SET
           claim_txid = ?,
           status = 'broadcast',
           confirmed_at = ?
         WHERE id = ? AND address = ?`,
        extra.claimTxid,
        now,
        claimId,
        address,
      );
    } else if (status === "completed" && extra?.mintTxid) {
      this.sql.exec(
        `UPDATE claims SET
           status = 'completed',
           mint_txid = ?,
           minted_at = ?
         WHERE id = ? AND address = ?`,
        extra.mintTxid,
        now,
        claimId,
        address,
      );
    } else if (status === "failed") {
      const errorMsg = extra?.error || "Minting failed - no details available";
      this.sql.exec(
        `UPDATE claims SET status = 'failed', error = ? WHERE id = ? AND address = ?`,
        errorMsg,
        claimId,
        address,
      );
    } else if (status === "expired") {
      this.sql.exec(
        `UPDATE claims SET status = 'expired' WHERE id = ?`,
        claimId,
      );
    } else if (status === "cancelled") {
      this.sql.exec(
        `UPDATE claims SET status = 'cancelled' WHERE id = ?`,
        claimId,
      );
    } else {
      this.sql.exec(
        `UPDATE claims SET status = ? WHERE id = ? AND address = ?`,
        status,
        claimId,
        address,
      );
    }

    return true;
  }

  /**
   * Cancel all pending claims for an address
   */
  cancelAllPending(address: string): number {
    const pending = this.getPending(address);
    for (const claim of pending) {
      this.updateStatus(claim.id, address, "cancelled");
    }
    return pending.length;
  }

  /**
   * Delete all claims for an address
   */
  deleteForAddress(address: string): void {
    this.sql.exec("DELETE FROM claims WHERE address = ?", address);
  }

  /**
   * Map database row to StoredClaim
   */
  private mapRow(row: Record<string, unknown>): StoredClaim {
    return {
      id: row.id as string,
      address: row.address as string,
      amount: row.amount as string,
      proofCount: row.proof_count as number,
      totalWork: row.total_work as string,
      merkleRoot: (row.merkle_root as string) || null,
      serverSignature: (row.server_signature as string) || null,
      opReturnData: (row.op_return_data as string) || null,
      claimTxid: (row.claim_txid as string) || null,
      mintTxid: (row.mint_txid as string) || null,
      status: row.status as ClaimStatus,
      error: (row.error as string) || null,
      preparedAt: row.prepared_at as number,
      confirmedAt: (row.confirmed_at as number) || null,
      mintedAt: (row.minted_at as number) || null,
      expiresAt: row.expires_at as number,
    };
  }
}
