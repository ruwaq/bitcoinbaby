/**
 * Storage Interfaces
 *
 * Abstract interfaces for storage operations.
 * Allows swapping implementations (SQLite, KV, Redis, etc.)
 */

import type { ClaimStatusType } from "../config/claim";

// =============================================================================
// BALANCE STORAGE
// =============================================================================

/**
 * Virtual balance record
 */
export interface VirtualBalanceRecord {
  address: string;
  virtualBalance: bigint;
  totalMined: bigint;
  totalWithdrawn: bigint;
  pendingWithdraw: bigint;
  streakCount: number;
  lastMiningAt: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Balance storage interface
 */
export interface IBalanceStorage {
  /**
   * Get balance for address, creating if not exists
   */
  getOrCreateBalance(address: string): Promise<VirtualBalanceRecord>;

  /**
   * Update balance
   */
  updateBalance(balance: VirtualBalanceRecord): Promise<void>;

  /**
   * Add to balance (mining reward)
   */
  addToBalance(
    address: string,
    amount: bigint,
    reason: string,
  ): Promise<VirtualBalanceRecord>;

  /**
   * Deduct from balance (claim, withdraw)
   */
  deductFromBalance(
    address: string,
    amount: bigint,
    reason: string,
  ): Promise<VirtualBalanceRecord>;
}

// =============================================================================
// PROOF STORAGE
// =============================================================================

/**
 * Mining proof record
 */
export interface MiningProofRecord {
  id: string;
  hash: string;
  nonce: string;
  difficulty: number;
  blockData: string;
  reward: bigint;
  credited: boolean;
  claimId: string | null;
  address: string;
  createdAt: number;
}

/**
 * Proof storage interface
 */
export interface IProofStorage {
  /**
   * Save a mining proof
   */
  saveProof(
    proof: Omit<MiningProofRecord, "id" | "createdAt">,
  ): Promise<string>;

  /**
   * Get unclaimed proofs for address
   */
  getUnclaimedProofs(address: string): Promise<MiningProofRecord[]>;

  /**
   * Mark proofs as claimed (locked to claim)
   */
  markProofsClaimed(proofIds: string[], claimId: string): Promise<void>;

  /**
   * Release proofs (unlock from failed/expired claim)
   */
  releaseProofs(claimId: string): Promise<void>;

  /**
   * Permanently mark proofs as credited
   */
  creditProofs(claimId: string): Promise<void>;

  /**
   * Check if proof hash exists globally
   */
  isProofUsedGlobally(hash: string): Promise<boolean>;

  /**
   * Mark proof hash as used globally
   */
  markProofUsedGlobally(hash: string, address: string): Promise<void>;

  /**
   * Prune old proofs
   */
  pruneOldProofs(olderThanMs: number): Promise<number>;
}

// =============================================================================
// CLAIM STORAGE
// =============================================================================

/**
 * Claim record
 */
export interface ClaimRecord {
  id: string;
  address: string;
  tokenAmount: bigint;
  proofCount: number;
  totalWork: bigint;
  merkleRoot: string;
  serverSignature: string;
  opReturnData: string;
  claimTxid: string | null;
  mintTxid: string | null;
  commitTxid: string | null;
  status: ClaimStatusType;
  error: string | null;
  expiresAt: number;
  preparedAt: number;
  broadcastAt: number | null;
  confirmedAt: number | null;
  mintedAt: number | null;
}

/**
 * Claim storage interface
 */
export interface IClaimStorage {
  /**
   * Save a new claim
   */
  saveClaim(
    claim: Omit<ClaimRecord, "broadcastAt" | "confirmedAt" | "mintedAt">,
  ): Promise<void>;

  /**
   * Get claim by ID
   */
  getClaim(claimId: string): Promise<ClaimRecord | null>;

  /**
   * Get claim by address and status
   */
  getClaimByAddressAndStatus(
    address: string,
    status: ClaimStatusType,
  ): Promise<ClaimRecord | null>;

  /**
   * Update claim status
   */
  updateClaimStatus(
    claimId: string,
    status: ClaimStatusType,
    updates?: Partial<
      Pick<ClaimRecord, "claimTxid" | "mintTxid" | "commitTxid" | "error">
    >,
  ): Promise<void>;

  /**
   * Get claim history for address
   */
  getClaimHistory(address: string, limit?: number): Promise<ClaimRecord[]>;

  /**
   * Get pending claims (for cleanup)
   */
  getPendingClaims(address: string): Promise<ClaimRecord[]>;

  /**
   * Get expired claims
   */
  getExpiredClaims(): Promise<ClaimRecord[]>;

  /**
   * Cancel/expire a claim
   */
  cancelClaim(claimId: string, reason: "cancelled" | "expired"): Promise<void>;
}

// =============================================================================
// COMBINED STORAGE FACTORY
// =============================================================================

/**
 * Storage factory interface
 */
export interface IStorageFactory {
  getBalanceStorage(): IBalanceStorage;
  getProofStorage(): IProofStorage;
  getClaimStorage(): IClaimStorage;
}
