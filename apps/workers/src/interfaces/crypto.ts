/**
 * Crypto Interfaces
 *
 * Abstract interfaces for cryptographic operations.
 * Allows testing with mock implementations.
 */

// =============================================================================
// MINING PROOF TYPES
// =============================================================================

/**
 * Mining proof input (from miner)
 */
export interface MiningProofInput {
  hash: string;
  nonce: string;
  difficulty: number;
  blockData: string;
  timestamp: number;
}

/**
 * Validated mining proof
 */
export interface ValidatedMiningProof extends MiningProofInput {
  isValid: boolean;
  work: bigint;
  reward: bigint;
  validationErrors?: string[];
}

// =============================================================================
// AGGREGATED PROOF TYPES
// =============================================================================

/**
 * Aggregated proof (multiple proofs combined)
 */
export interface AggregatedProof {
  address: string;
  totalWork: bigint;
  proofCount: number;
  merkleRoot: string;
  tokenAmount: bigint;
  timestamp: number;
  nonce: string;
}

/**
 * Claim data with signature
 */
export interface ClaimData {
  proof: AggregatedProof;
  serverSignature: string;
  opReturnData: string;
  estimatedFee: number;
}

// =============================================================================
// PROOF VALIDATOR INTERFACE
// =============================================================================

/**
 * Rate limit check input
 */
export interface RateLimitCheck {
  address: string;
  timestamp: number;
  recentProofs: Array<{ timestamp: number; difficulty: number }>;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  currentCount?: number;
  maxAllowed?: number;
  resetAt?: number;
}

/**
 * Proof validator interface
 */
export interface IProofValidator {
  /**
   * Validate a mining proof
   */
  validateProof(proof: MiningProofInput): Promise<ValidatedMiningProof>;

  /**
   * Check if proof meets difficulty requirement
   */
  checkDifficulty(hash: string, difficulty: number): boolean;

  /**
   * Calculate reward for proof
   */
  calculateReward(
    difficulty: number,
    multipliers?: {
      nft?: number;
      engagement?: number;
      cosmic?: number;
      streak?: number;
    },
  ): bigint;

  /**
   * Check rate limiting
   */
  checkRateLimit(check: RateLimitCheck): RateLimitResult;
}

// =============================================================================
// PROOF AGGREGATOR INTERFACE
// =============================================================================

/**
 * Proof for aggregation
 */
export interface ProofForAggregation {
  hash: string;
  difficulty: number;
  reward: bigint;
}

/**
 * Proof aggregator interface
 */
export interface IProofAggregator {
  /**
   * Aggregate multiple proofs into one
   */
  aggregateProofs(
    address: string,
    proofs: ProofForAggregation[],
  ): AggregatedProof;

  /**
   * Build merkle root from proof hashes
   */
  buildMerkleRoot(hashes: string[]): Promise<string>;

  /**
   * Sign aggregated proof
   */
  signProof(proof: AggregatedProof): Promise<string>;

  /**
   * Verify signature
   */
  verifySignature(proof: AggregatedProof, signature: string): Promise<boolean>;

  /**
   * Create complete claim data
   */
  createClaimData(
    proof: AggregatedProof,
    estimatedFee: number,
  ): Promise<ClaimData>;

  /**
   * Encode OP_RETURN data
   */
  encodeOpReturn(proof: AggregatedProof, signature: string): Promise<string>;
}

// =============================================================================
// CRYPTO UTILITIES INTERFACE
// =============================================================================

/**
 * Crypto utilities interface
 */
export interface ICryptoUtils {
  /**
   * SHA-256 hash
   */
  sha256(data: Uint8Array): Promise<Uint8Array>;

  /**
   * Double SHA-256 (Bitcoin standard)
   */
  doubleSha256(data: Uint8Array): Promise<Uint8Array>;

  /**
   * HMAC-SHA256
   */
  hmacSha256(key: string, message: string): Promise<string>;

  /**
   * Generate random bytes
   */
  randomBytes(length: number): Uint8Array;

  /**
   * Generate UUID
   */
  generateUuid(): string;
}
