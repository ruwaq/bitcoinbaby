/**
 * Test Fixtures for Workers API Testing
 *
 * Provides mock data generators and test utilities for
 * testing the BitcoinBaby Workers API.
 */

import { createHash, randomBytes } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface MockProof {
  hash: string;
  nonce: number;
  difficulty: number;
  blockData: string;
  timestamp: number;
}

export interface MockUTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

export interface MockClaimData {
  claimId: string;
  address: string;
  amount: bigint;
  proofCount: number;
  totalWork: bigint;
  merkleRoot: string;
  serverSignature: string;
  opReturnData: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

export const TEST_ADDRESSES = {
  // Valid testnet4 addresses for testing
  miner: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
  treasury: "tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3",
  staking: "tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc",
  // Invalid addresses for negative testing
  invalid: "not-a-valid-address",
  wrongNetwork: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", // mainnet
};

export const MIN_DIFFICULTY = 16;
export const MAX_DIFFICULTY = 32;

// =============================================================================
// PROOF GENERATORS
// =============================================================================

let proofCounter = 0;

/**
 * Generate a valid mining proof with specified difficulty
 *
 * Actually mines a real proof (slow for high difficulty)
 *
 * The server expects:
 * - blockData format: "prefix:timestamp:nonceHex"
 * - nonce embedded in blockData as hex (without 0x prefix)
 * - hash = double_sha256(blockData)
 */
export function generateValidProof(
  difficulty: number = MIN_DIFFICULTY,
): MockProof {
  const timestamp = Date.now();
  const prefix = `block:${timestamp}:${proofCounter++}`;
  let nonce = 0;
  let hash: string;

  // Mine until we find a valid hash
  const maxAttempts = Math.pow(2, difficulty + 4); // Allow some margin

  while (nonce < maxAttempts) {
    // Format: prefix:nonceHex (nonce as hex WITHOUT 0x prefix)
    const blockData = `${prefix}:${nonce.toString(16)}`;

    // Double SHA256 (Bitcoin standard)
    const firstHash = createHash("sha256").update(blockData).digest();
    hash = createHash("sha256").update(firstHash).digest("hex");

    if (countLeadingZeroBits(hash) >= difficulty) {
      return {
        hash,
        nonce,
        difficulty,
        blockData,
        timestamp: Date.now(),
      };
    }
    nonce++;
  }

  throw new Error(`Failed to generate proof with difficulty ${difficulty}`);
}

/**
 * Generate an invalid proof (hash doesn't match)
 */
export function generateInvalidProof(): MockProof {
  // Hash with insufficient leading zeros (starts with 'f')
  // This will fail the difficulty check since MIN_DIFFICULTY=16 requires 4+ leading hex zeros
  const timestamp = Date.now();
  const nonce = 12345;
  return {
    hash: "f" + "a".repeat(63), // No leading zeros
    nonce,
    difficulty: MIN_DIFFICULTY,
    blockData: `block:${timestamp}:${nonce.toString(16)}`,
    timestamp,
  };
}

/**
 * Generate a proof with insufficient difficulty
 */
export function generateLowDifficultyProof(): MockProof {
  const timestamp = Date.now();
  const nonce = 0;
  const blockData = `block:${timestamp}:${nonce.toString(16)}`;
  const firstHash = createHash("sha256").update(blockData).digest();
  const hash = createHash("sha256").update(firstHash).digest("hex");

  return {
    hash,
    nonce,
    difficulty: 4, // Below minimum
    blockData,
    timestamp,
  };
}

/**
 * Generate a duplicate proof (same hash as provided)
 */
export function generateDuplicateProof(original: MockProof): MockProof {
  return { ...original };
}

/**
 * Generate an expired proof (old timestamp)
 */
export function generateExpiredProof(
  difficulty: number = MIN_DIFFICULTY,
): MockProof {
  const proof = generateValidProof(difficulty);
  return {
    ...proof,
    timestamp: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
  };
}

// =============================================================================
// UTXO GENERATORS
// =============================================================================

/**
 * Generate mock UTXOs for testing
 */
export function generateUTXOs(
  count: number = 3,
  baseValue: number = 10000,
): MockUTXO[] {
  return Array.from({ length: count }, (_, i) => ({
    txid: randomBytes(32).toString("hex"),
    vout: 0,
    value: baseValue + i * 1000,
    status: { confirmed: true },
  }));
}

/**
 * Generate a single funding UTXO
 */
export function generateFundingUTXO(value: number = 50000): MockUTXO {
  return {
    txid: randomBytes(32).toString("hex"),
    vout: 0,
    value,
    status: { confirmed: true },
  };
}

// =============================================================================
// CLAIM DATA GENERATORS
// =============================================================================

/**
 * Generate mock claim preparation data
 */
export function generateClaimData(
  address: string = TEST_ADDRESSES.miner,
  proofCount: number = 10,
): MockClaimData {
  const totalWork = BigInt(proofCount) * BigInt(Math.pow(2, MIN_DIFFICULTY));
  const amount = totalWork / 1000n; // Simplified reward calculation

  return {
    claimId: crypto.randomUUID(),
    address,
    amount,
    proofCount,
    totalWork,
    merkleRoot: randomBytes(32).toString("hex"),
    serverSignature: randomBytes(64).toString("hex"),
    opReturnData: "BABTC" + randomBytes(20).toString("hex"),
  };
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate random block data for mining
 * Note: For actual proof generation, use generateValidProof() which
 * embeds the nonce correctly. This is for test data only.
 */
export function generateBlockData(nonce: number = 0): string {
  const timestamp = Date.now();
  return `block:${timestamp}:${nonce.toString(16)}`;
}

/**
 * Count leading zero bits in a hex hash
 */
export function countLeadingZeroBits(hash: string): number {
  let bits = 0;
  for (const char of hash) {
    const nibble = parseInt(char, 16);
    if (nibble === 0) {
      bits += 4;
    } else {
      // Count leading zeros in this nibble
      if (nibble < 8) bits += 1;
      if (nibble < 4) bits += 1;
      if (nibble < 2) bits += 1;
      break;
    }
  }
  return bits;
}

/**
 * Generate a random Bitcoin txid
 */
export function generateTxid(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Wait for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await delay(baseDelayMs * Math.pow(2, attempt - 1));
      }
    }
  }

  throw lastError;
}

// =============================================================================
// API RESPONSE VALIDATORS
// =============================================================================

/**
 * Validate API response structure
 */
export function isValidApiResponse(response: unknown): response is {
  success: boolean;
  data?: unknown;
  error?: string;
  timestamp: number;
} {
  if (typeof response !== "object" || response === null) return false;
  const r = response as Record<string, unknown>;
  return typeof r.success === "boolean" && typeof r.timestamp === "number";
}

/**
 * Validate balance response
 */
export function isValidBalanceResponse(data: unknown): data is {
  address: string;
  virtualBalance: string;
  totalMined: string;
  suggestedDifficulty: number;
} {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.address === "string" &&
    typeof d.virtualBalance === "string" &&
    typeof d.totalMined === "string" &&
    typeof d.suggestedDifficulty === "number"
  );
}

/**
 * Validate credit response
 */
export function isValidCreditResponse(data: unknown): data is {
  credited: string;
  newBalance: string;
  proofId: string;
  streakInfo: {
    consecutiveShares: number;
    multiplier: number;
  };
} {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.credited === "string" &&
    typeof d.newBalance === "string" &&
    typeof d.proofId === "string" &&
    typeof d.streakInfo === "object"
  );
}

/**
 * Validate claimable balance response
 */
export function isValidClaimableResponse(data: unknown): data is {
  address: string;
  claimableTokens: string;
  unclaimedProofs: number;
  estimatedFee: number;
} {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.address === "string" &&
    typeof d.claimableTokens === "string" &&
    typeof d.unclaimedProofs === "number" &&
    typeof d.estimatedFee === "number"
  );
}
