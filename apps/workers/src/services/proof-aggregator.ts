/**
 * Proof Aggregator Service
 *
 * Aggregates mining proofs into a single claimable proof.
 * The aggregated proof is signed by the server and can be
 * submitted by the user in a Bitcoin TX to claim tokens.
 *
 * Flow:
 * 1. User requests claim preparation
 * 2. Server aggregates all unclaimed proofs
 * 3. Server signs the aggregated proof
 * 4. User creates Bitcoin TX with OP_RETURN
 * 5. User broadcasts and waits for confirmation
 * 6. User submits to Charms prover to mint tokens
 */

import type { AggregatedProof, ClaimData, MiningProof } from "../lib/types";

// =============================================================================
// CONSTANTS
// =============================================================================

/** Minimum difficulty to count as valid work */
const MIN_DIFFICULTY = 16;

/** Token denomination (8 decimals like Bitcoin) */
const DENOMINATION = 100_000_000n;

/** Work factor for token calculation: tokens = (totalWork * DENOMINATION) / WORK_DIVISOR */
const WORK_DIVISOR = 100n;

/** OP_RETURN prefix for claim data identification */
const CLAIM_PREFIX = "BABTC_CLAIM_V1";

// =============================================================================
// HELPER FUNCTIONS FOR WEB CRYPTO
// =============================================================================

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert string to Uint8Array (UTF-8)
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * SHA-256 hash using Web Crypto API
 */
async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * HMAC-SHA256 using Web Crypto API
 */
async function hmacSha256(key: string, message: string): Promise<string> {
  const keyBytes = stringToBytes(key);
  const messageBytes = stringToBytes(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageBytes);
  return bytesToHex(new Uint8Array(signature));
}

// =============================================================================
// PROOF AGGREGATOR
// =============================================================================

export class ProofAggregator {
  private serverSecretKey: string;

  constructor(serverSecretKey: string) {
    if (!serverSecretKey || serverSecretKey.length < 32) {
      throw new Error("Server secret key must be at least 32 characters");
    }
    this.serverSecretKey = serverSecretKey;
  }

  /**
   * Aggregate multiple proofs into a single claimable proof
   */
  aggregateProofs(address: string, proofs: MiningProof[]): AggregatedProof {
    if (proofs.length === 0) {
      throw new Error("No proofs to aggregate");
    }

    // Calculate total work (sum of difficulty²)
    let totalWork = 0n;
    const proofHashes: string[] = [];

    for (const proof of proofs) {
      // Only count proofs meeting minimum difficulty
      if (proof.difficulty >= MIN_DIFFICULTY) {
        const work = BigInt(proof.difficulty) ** 2n;
        totalWork += work;
        proofHashes.push(proof.hash);
      }
    }

    if (totalWork === 0n) {
      throw new Error("No valid proofs (all below minimum difficulty)");
    }

    // Build merkle root of proof hashes (synchronous version)
    const merkleRoot = this.buildMerkleRootSync(proofHashes);

    // Calculate token amount
    const tokenAmount = (totalWork * DENOMINATION) / WORK_DIVISOR;

    // Generate unique nonce for this claim
    const nonce = crypto.randomUUID();

    return {
      address,
      totalWork,
      proofCount: proofs.length,
      merkleRoot,
      tokenAmount,
      timestamp: Date.now(),
      nonce,
    };
  }

  /**
   * Sign an aggregated proof with server key (async)
   */
  async signProofAsync(proof: AggregatedProof): Promise<string> {
    const message = this.createSignatureMessage(proof);
    return await hmacSha256(this.serverSecretKey, message);
  }

  /**
   * Verify a server signature (async)
   */
  async verifySignatureAsync(
    proof: AggregatedProof,
    signature: string,
  ): Promise<boolean> {
    const expectedSignature = await this.signProofAsync(proof);
    return signature === expectedSignature;
  }

  /**
   * Create claim data for Bitcoin TX (async)
   */
  async createClaimDataAsync(
    proof: AggregatedProof,
    estimatedFee: number,
  ): Promise<ClaimData> {
    const serverSignature = await this.signProofAsync(proof);
    const opReturnData = await this.encodeOpReturnAsync(proof, serverSignature);

    return {
      proof,
      serverSignature,
      opReturnData,
      estimatedFee,
    };
  }

  /**
   * Create claim data for Bitcoin TX (sync wrapper - generates opReturn data only)
   */
  createClaimData(proof: AggregatedProof, estimatedFee: number): ClaimData {
    // For sync operation, we'll generate a placeholder signature
    // The actual signing should be done async
    const signatureMessage = this.createSignatureMessage(proof);
    const placeholderSignature = `pending:${signatureMessage.slice(0, 32)}`;
    const opReturnData = this.encodeOpReturnSync(proof, placeholderSignature);

    return {
      proof,
      serverSignature: placeholderSignature,
      opReturnData,
      estimatedFee,
    };
  }

  /**
   * Decode and verify claim data from OP_RETURN (async)
   */
  async decodeAndVerifyOpReturn(
    opReturnHex: string,
  ): Promise<{ proof: AggregatedProof; valid: boolean } | null> {
    try {
      const bytes = hexToBytes(opReturnHex);
      const data = new TextDecoder().decode(bytes);

      // Check prefix
      if (!data.startsWith(CLAIM_PREFIX + "|")) {
        return null;
      }

      // Parse JSON after prefix
      const jsonStr = data.slice(CLAIM_PREFIX.length + 1);
      const parsed = JSON.parse(jsonStr);

      const proof: AggregatedProof = {
        address: parsed.a,
        totalWork: BigInt(parsed.w),
        proofCount: parsed.c,
        merkleRoot: parsed.m,
        tokenAmount: BigInt(parsed.t),
        timestamp: parsed.ts,
        nonce: parsed.n,
      };

      const valid = await this.verifySignatureAsync(proof, parsed.s);

      return { proof, valid };
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  /**
   * Build merkle root from proof hashes (synchronous)
   *
   * Uses a simplified but deterministic approach:
   * 1. Sort hashes for deterministic order
   * 2. Concatenate all hashes
   * 3. Simple hash of the concatenated data
   *
   * Note: For production, consider async version with proper SHA256
   */
  private buildMerkleRootSync(hashes: string[]): string {
    if (hashes.length === 0) {
      return "0".repeat(64);
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    // Sort for deterministic order
    const sortedHashes = [...hashes].sort();

    // Concatenate all hashes
    const concatenated = sortedHashes.join("");

    // Simple deterministic hash (FNV-1a variant for 256 bits)
    // This is not cryptographically secure but is deterministic
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    let h3 = 0x811c9dc5;
    let h4 = 0x811c9dc5;

    for (let i = 0; i < concatenated.length; i++) {
      const char = concatenated.charCodeAt(i);
      h1 = Math.imul(h1 ^ char, 0x01000193);
      h2 = Math.imul(h2 ^ char, 0x01000193) >>> 0;
      h3 = Math.imul(h3 ^ (char << 8), 0x01000193);
      h4 = Math.imul(h4 ^ (char << 16), 0x01000193) >>> 0;
    }

    // Convert to hex and pad to 64 chars
    const hex1 = (h1 >>> 0).toString(16).padStart(8, "0");
    const hex2 = (h2 >>> 0).toString(16).padStart(8, "0");
    const hex3 = (h3 >>> 0).toString(16).padStart(8, "0");
    const hex4 = (h4 >>> 0).toString(16).padStart(8, "0");

    // Combine with count prefix for uniqueness
    const countHex = hashes.length.toString(16).padStart(8, "0");
    return countHex + hex1 + hex2 + hex3 + hex4 + countHex.slice(0, 16);
  }

  /**
   * Build merkle root from proof hashes (async with proper SHA256)
   */
  async buildMerkleRootAsync(hashes: string[]): Promise<string> {
    if (hashes.length === 0) {
      return "0".repeat(64);
    }

    if (hashes.length === 1) {
      return hashes[0];
    }

    // Sort for deterministic order
    const sortedHashes = [...hashes].sort();

    // Build merkle tree
    let level = sortedHashes.map((h) => hexToBytes(h));

    while (level.length > 1) {
      const nextLevel: Uint8Array[] = [];

      for (let i = 0; i < level.length; i += 2) {
        const left = level[i];
        const right = i + 1 < level.length ? level[i + 1] : level[i];

        // Concatenate and hash
        const combined = new Uint8Array(left.length + right.length);
        combined.set(left, 0);
        combined.set(right, left.length);

        const hash = await sha256(combined);
        nextLevel.push(hash);
      }

      level = nextLevel;
    }

    return bytesToHex(level[0]);
  }

  /**
   * Create message for signing
   */
  private createSignatureMessage(proof: AggregatedProof): string {
    // Deterministic message format
    return [
      proof.address,
      proof.totalWork.toString(),
      proof.proofCount.toString(),
      proof.merkleRoot,
      proof.tokenAmount.toString(),
      proof.timestamp.toString(),
      proof.nonce,
    ].join("|");
  }

  /**
   * Encode claim data for OP_RETURN (sync version)
   */
  private encodeOpReturnSync(
    proof: AggregatedProof,
    signature: string,
  ): string {
    // Compress to fit in OP_RETURN (80 bytes max)
    const compact = {
      a: proof.address,
      w: proof.totalWork.toString(),
      c: proof.proofCount,
      m: proof.merkleRoot.slice(0, 16),
      t: proof.tokenAmount.toString(),
      ts: proof.timestamp,
      n: proof.nonce.slice(0, 8),
      s: signature.slice(0, 16),
    };

    const fullData = JSON.stringify(compact);

    // Simple hash for data reference
    let hash = 0;
    for (let i = 0; i < fullData.length; i++) {
      hash = ((hash << 5) - hash + fullData.charCodeAt(i)) | 0;
    }
    const dataHash = Math.abs(hash).toString(16).padStart(32, "0").slice(0, 32);

    const opReturn = `${CLAIM_PREFIX}|${dataHash}`;
    return bytesToHex(stringToBytes(opReturn));
  }

  /**
   * Encode claim data for OP_RETURN (async version with proper hash)
   */
  private async encodeOpReturnAsync(
    proof: AggregatedProof,
    signature: string,
  ): Promise<string> {
    // Compress to fit in OP_RETURN (80 bytes max)
    const compact = {
      a: proof.address,
      w: proof.totalWork.toString(),
      c: proof.proofCount,
      m: proof.merkleRoot.slice(0, 16),
      t: proof.tokenAmount.toString(),
      ts: proof.timestamp,
      n: proof.nonce.slice(0, 8),
      s: signature.slice(0, 16),
    };

    const fullData = JSON.stringify(compact);
    const dataHashBytes = await sha256(stringToBytes(fullData));
    const dataHash = bytesToHex(dataHashBytes).slice(0, 32);

    const opReturn = `${CLAIM_PREFIX}|${dataHash}`;
    return bytesToHex(stringToBytes(opReturn));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let aggregatorInstance: ProofAggregator | null = null;

/**
 * Get or create the proof aggregator instance
 */
export function getProofAggregator(serverSecretKey: string): ProofAggregator {
  if (!aggregatorInstance) {
    aggregatorInstance = new ProofAggregator(serverSecretKey);
  }
  return aggregatorInstance;
}

/**
 * Calculate claimable tokens from work
 */
export function calculateTokensFromWork(totalWork: bigint): bigint {
  return (totalWork * DENOMINATION) / WORK_DIVISOR;
}

/**
 * Calculate work from difficulty
 */
export function calculateWorkFromDifficulty(difficulty: number): bigint {
  if (difficulty < MIN_DIFFICULTY) {
    return 0n;
  }
  return BigInt(difficulty) ** 2n;
}

/**
 * Estimate Bitcoin fee for claim TX
 *
 * Claim TX structure:
 * - 1 input (user's UTXO): ~68 vbytes
 * - 1 OP_RETURN output: ~40 vbytes
 * - 1 change output: ~34 vbytes
 * - Overhead: ~10 vbytes
 * Total: ~152 vbytes
 */
export function estimateClaimFee(feeRate: number): number {
  const CLAIM_TX_VBYTES = 152;
  return Math.ceil(CLAIM_TX_VBYTES * feeRate);
}
