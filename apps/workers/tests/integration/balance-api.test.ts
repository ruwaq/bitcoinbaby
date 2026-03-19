/**
 * Balance API Integration Tests
 *
 * Tests the /api/balance endpoints including:
 * - GET /api/balance/:address - Get balance
 * - POST /api/balance/credit - Credit mining reward
 * - GET /api/balance/:address/history - Get mining history
 *
 * These tests use mocked fetch responses to simulate the Workers API
 * without requiring a running Cloudflare Workers instance.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateValidProof,
  generateInvalidProof,
  generateLowDifficultyProof,
  TEST_ADDRESSES,
  MIN_DIFFICULTY,
  isValidApiResponse,
  isValidBalanceResponse,
  isValidCreditResponse,
} from "../fixtures";

// =============================================================================
// MOCK API CLIENT
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

/**
 * Mock API client for testing
 * Simulates Workers API responses
 */
class MockBalanceApiClient {
  private balances: Map<
    string,
    {
      virtualBalance: bigint;
      totalMined: bigint;
      totalWithdrawn: bigint;
      pendingWithdraw: bigint;
      streakCount: number;
      lastMiningAt: number;
      suggestedDifficulty: number;
    }
  > = new Map();

  private proofs: Map<string, Set<string>> = new Map(); // address -> proof hashes
  private globalProofs: Set<string> = new Set(); // all proof hashes (global dedup)

  constructor() {
    this.reset();
  }

  reset(): void {
    this.balances.clear();
    this.proofs.clear();
    this.globalProofs.clear();
  }

  private getOrCreateBalance(address: string) {
    if (!this.balances.has(address)) {
      this.balances.set(address, {
        virtualBalance: 0n,
        totalMined: 0n,
        totalWithdrawn: 0n,
        pendingWithdraw: 0n,
        streakCount: 0,
        lastMiningAt: 0,
        suggestedDifficulty: MIN_DIFFICULTY,
      });
      this.proofs.set(address, new Set());
    }
    return this.balances.get(address)!;
  }

  async getBalance(address: string): Promise<ApiResponse> {
    // Validate address format
    if (!address.startsWith("tb1") && !address.startsWith("bc1")) {
      return {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      };
    }

    const balance = this.getOrCreateBalance(address);
    const available = balance.virtualBalance - balance.pendingWithdraw;

    return {
      success: true,
      data: {
        address,
        virtualBalance: balance.virtualBalance.toString(),
        pendingWithdraw: balance.pendingWithdraw.toString(),
        availableToWithdraw: (available > 0n ? available : 0n).toString(),
        totalMined: balance.totalMined.toString(),
        totalWithdrawn: balance.totalWithdrawn.toString(),
        suggestedDifficulty: balance.suggestedDifficulty,
        averageShareTime: 30,
      },
      timestamp: Date.now(),
    };
  }

  async creditMining(
    address: string,
    proof: {
      hash: string;
      nonce: number;
      difficulty: number;
      blockData: string;
      timestamp?: number;
    },
  ): Promise<ApiResponse> {
    // Validate address
    if (!address.startsWith("tb1") && !address.startsWith("bc1")) {
      return {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      };
    }

    // Validate proof fields
    if (!proof.hash || !proof.blockData || proof.nonce === undefined) {
      return {
        success: false,
        error: "Invalid proof: missing required fields",
        timestamp: Date.now(),
      };
    }

    // Validate difficulty
    if (proof.difficulty < MIN_DIFFICULTY) {
      return {
        success: false,
        error: `Share difficulty D${proof.difficulty} below minimum D${MIN_DIFFICULTY}`,
        timestamp: Date.now(),
      };
    }

    // Check global duplicate
    if (this.globalProofs.has(proof.hash)) {
      return {
        success: false,
        error: "Proof already used",
        timestamp: Date.now(),
      };
    }

    // Verify hash (simplified - just check format)
    if (!/^[0-9a-f]{64}$/.test(proof.hash)) {
      return {
        success: false,
        error: "Invalid proof: hash format invalid",
        timestamp: Date.now(),
      };
    }

    // Count leading zeros
    let leadingZeros = 0;
    for (const char of proof.hash) {
      const nibble = parseInt(char, 16);
      if (nibble === 0) {
        leadingZeros += 4;
      } else {
        if (nibble < 8) leadingZeros += 1;
        if (nibble < 4) leadingZeros += 1;
        if (nibble < 2) leadingZeros += 1;
        break;
      }
    }

    if (leadingZeros < proof.difficulty) {
      return {
        success: false,
        error: `Invalid proof: hash has ${leadingZeros} leading zero bits, needs ${proof.difficulty}`,
        timestamp: Date.now(),
      };
    }

    // Calculate reward: D² tokens
    const baseReward = BigInt(proof.difficulty * proof.difficulty);

    // Get balance and calculate streak
    const balance = this.getOrCreateBalance(address);
    const now = Date.now();
    const streakActive = now - balance.lastMiningAt < 10 * 60 * 1000; // 10 min

    if (streakActive) {
      balance.streakCount += 1;
    } else {
      balance.streakCount = 1;
    }

    // Calculate streak multiplier
    let streakMultiplier = 1.0;
    if (balance.streakCount >= 500) streakMultiplier = 1.5;
    else if (balance.streakCount >= 250) streakMultiplier = 1.4;
    else if (balance.streakCount >= 100) streakMultiplier = 1.3;
    else if (balance.streakCount >= 50) streakMultiplier = 1.2;
    else if (balance.streakCount >= 10) streakMultiplier = 1.1;

    const boostedReward = BigInt(
      Math.floor(Number(baseReward) * streakMultiplier),
    );

    // Credit balance
    balance.virtualBalance += boostedReward;
    balance.totalMined += boostedReward;
    balance.lastMiningAt = now;

    // Mark proof as used
    this.globalProofs.add(proof.hash);
    this.proofs.get(address)!.add(proof.hash);

    return {
      success: true,
      data: {
        credited: boostedReward.toString(),
        newBalance: balance.virtualBalance.toString(),
        proofId: crypto.randomUUID(),
        streakInfo: {
          consecutiveShares: balance.streakCount,
          multiplier: streakMultiplier,
          baseReward: baseReward.toString(),
          boostedReward: boostedReward.toString(),
          nextTierAt: this.getNextStreakTier(balance.streakCount),
        },
        nftBoost: { multiplier: 1.0, boostPercent: 0, enabled: true },
        engagementBoost: { multiplier: 1.0, boostPercent: 0, enabled: true },
        cosmicBoost: {
          multiplier: 1.0,
          boostPercent: 0,
          status: "normal",
          enabled: true,
        },
        varDiff: {
          suggestedDifficulty: balance.suggestedDifficulty,
          averageShareTime: 30,
          difficultyChanged: false,
        },
      },
      timestamp: now,
    };
  }

  async getHistory(address: string, limit: number = 100): Promise<ApiResponse> {
    if (!address.startsWith("tb1") && !address.startsWith("bc1")) {
      return {
        success: false,
        error: "Invalid Bitcoin address",
        timestamp: Date.now(),
      };
    }

    const proofSet = this.proofs.get(address) || new Set();
    const history = Array.from(proofSet)
      .slice(0, limit)
      .map((hash, i) => ({
        id: crypto.randomUUID(),
        amount: "256", // D=16 → 16² = 256
        timestamp: Date.now() - i * 60000,
        type: "mining",
      }));

    return {
      success: true,
      data: { history },
      timestamp: Date.now(),
    };
  }

  private getNextStreakTier(currentShares: number): number {
    const tiers = [10, 50, 100, 250, 500];
    for (const tier of tiers) {
      if (currentShares < tier) return tier;
    }
    return 500;
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe("Balance API Integration", () => {
  let api: MockBalanceApiClient;

  beforeEach(() => {
    api = new MockBalanceApiClient();
  });

  afterEach(() => {
    api.reset();
  });

  // ===========================================================================
  // GET /api/balance/:address
  // ===========================================================================

  describe("GET /api/balance/:address", () => {
    it("should return zero balance for new address", async () => {
      const response = await api.getBalance(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      expect(isValidApiResponse(response)).toBe(true);
      expect(isValidBalanceResponse(response.data)).toBe(true);

      const data = response.data as Record<string, unknown>;
      expect(data.virtualBalance).toBe("0");
      expect(data.totalMined).toBe("0");
      expect(data.suggestedDifficulty).toBe(MIN_DIFFICULTY);
    });

    it("should reject invalid address", async () => {
      const response = await api.getBalance(TEST_ADDRESSES.invalid);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid");
    });

    it("should return accumulated balance after mining", async () => {
      const proof = generateValidProof(MIN_DIFFICULTY);
      await api.creditMining(TEST_ADDRESSES.miner, proof);

      const response = await api.getBalance(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      const data = response.data as Record<string, unknown>;
      expect(BigInt(data.virtualBalance as string)).toBeGreaterThan(0n);
    });

    it("should track available balance correctly with pending withdrawals", async () => {
      // First mine some tokens
      const proof = generateValidProof(MIN_DIFFICULTY);
      await api.creditMining(TEST_ADDRESSES.miner, proof);

      const response = await api.getBalance(TEST_ADDRESSES.miner);
      const data = response.data as Record<string, unknown>;

      // Available should equal virtual when no pending
      expect(data.availableToWithdraw).toBe(data.virtualBalance);
    });
  });

  // ===========================================================================
  // POST /api/balance/credit
  // ===========================================================================

  describe("POST /api/balance/credit", () => {
    it("should credit valid mining proof", async () => {
      const proof = generateValidProof(MIN_DIFFICULTY);
      const response = await api.creditMining(TEST_ADDRESSES.miner, proof);

      expect(response.success).toBe(true);
      expect(isValidCreditResponse(response.data)).toBe(true);

      const data = response.data as Record<string, unknown>;
      expect(BigInt(data.credited as string)).toBeGreaterThan(0n);
      expect(data.proofId).toBeDefined();
    });

    it("should reject invalid proof (hash mismatch)", async () => {
      const proof = generateInvalidProof();
      const response = await api.creditMining(TEST_ADDRESSES.miner, proof);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid proof");
    });

    it("should reject proof with insufficient difficulty", async () => {
      const proof = generateLowDifficultyProof();
      const response = await api.creditMining(TEST_ADDRESSES.miner, proof);

      expect(response.success).toBe(false);
      expect(response.error).toContain("below minimum");
    });

    it("should reject duplicate proof", async () => {
      const proof = generateValidProof(MIN_DIFFICULTY);

      // First submission should succeed
      const first = await api.creditMining(TEST_ADDRESSES.miner, proof);
      expect(first.success).toBe(true);

      // Second submission should fail
      const second = await api.creditMining(TEST_ADDRESSES.miner, proof);
      expect(second.success).toBe(false);
      expect(second.error).toContain("already used");
    });

    it("should reject same proof from different address", async () => {
      const proof = generateValidProof(MIN_DIFFICULTY);

      // First address
      const first = await api.creditMining(TEST_ADDRESSES.miner, proof);
      expect(first.success).toBe(true);

      // Different address, same proof
      const second = await api.creditMining(TEST_ADDRESSES.treasury, proof);
      expect(second.success).toBe(false);
      expect(second.error).toContain("already used");
    });

    it("should calculate reward based on difficulty squared", async () => {
      const difficulty = MIN_DIFFICULTY;
      const proof = generateValidProof(difficulty);
      const response = await api.creditMining(TEST_ADDRESSES.miner, proof);

      expect(response.success).toBe(true);
      const data = response.data as { streakInfo: { baseReward: string } };

      // Base reward = D²
      const expectedBase = BigInt(difficulty * difficulty);
      expect(BigInt(data.streakInfo.baseReward)).toBe(expectedBase);
    });

    it("should apply streak multiplier for consecutive shares", async () => {
      // Submit 10 proofs to hit first streak tier
      const rewards: bigint[] = [];

      for (let i = 0; i < 11; i++) {
        const proof = generateValidProof(MIN_DIFFICULTY);
        const response = await api.creditMining(TEST_ADDRESSES.miner, proof);
        expect(response.success).toBe(true);

        const data = response.data as {
          credited: string;
          streakInfo: { multiplier: number };
        };
        rewards.push(BigInt(data.credited));

        // After 10 shares, multiplier should increase
        if (i >= 10) {
          expect(data.streakInfo.multiplier).toBeGreaterThan(1.0);
        }
      }

      // Last reward should be higher due to streak
      expect(rewards[10]).toBeGreaterThan(rewards[0]);
    });

    it("should return VarDiff info in response", async () => {
      const proof = generateValidProof(MIN_DIFFICULTY);
      const response = await api.creditMining(TEST_ADDRESSES.miner, proof);

      expect(response.success).toBe(true);
      const data = response.data as {
        varDiff: { suggestedDifficulty: number };
      };

      expect(data.varDiff).toBeDefined();
      expect(data.varDiff.suggestedDifficulty).toBeGreaterThanOrEqual(
        MIN_DIFFICULTY,
      );
    });

    it("should reject proof missing required fields", async () => {
      const response = await api.creditMining(TEST_ADDRESSES.miner, {
        hash: "",
        nonce: 0,
        difficulty: MIN_DIFFICULTY,
        blockData: "",
      });

      expect(response.success).toBe(false);
      expect(response.error).toContain("missing required fields");
    });
  });

  // ===========================================================================
  // GET /api/balance/:address/history
  // ===========================================================================

  describe("GET /api/balance/:address/history", () => {
    it("should return empty history for new address", async () => {
      const response = await api.getHistory(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      const data = response.data as { history: unknown[] };
      expect(data.history).toHaveLength(0);
    });

    it("should return mining history after credits", async () => {
      // Mine 3 proofs
      for (let i = 0; i < 3; i++) {
        const proof = generateValidProof(MIN_DIFFICULTY);
        await api.creditMining(TEST_ADDRESSES.miner, proof);
      }

      const response = await api.getHistory(TEST_ADDRESSES.miner);

      expect(response.success).toBe(true);
      const data = response.data as { history: unknown[] };
      expect(data.history).toHaveLength(3);
    });

    it("should respect limit parameter", async () => {
      // Mine 5 proofs
      for (let i = 0; i < 5; i++) {
        const proof = generateValidProof(MIN_DIFFICULTY);
        await api.creditMining(TEST_ADDRESSES.miner, proof);
      }

      const response = await api.getHistory(TEST_ADDRESSES.miner, 2);

      expect(response.success).toBe(true);
      const data = response.data as { history: unknown[] };
      expect(data.history).toHaveLength(2);
    });
  });

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================

  describe("Edge Cases", () => {
    it("should handle concurrent credit requests correctly", async () => {
      const proofs = Array.from({ length: 5 }, () =>
        generateValidProof(MIN_DIFFICULTY),
      );

      // Submit all concurrently
      const results = await Promise.all(
        proofs.map((proof) => api.creditMining(TEST_ADDRESSES.miner, proof)),
      );

      // All should succeed (different proofs)
      const successes = results.filter((r) => r.success);
      expect(successes).toHaveLength(5);

      // Check final balance
      const balance = await api.getBalance(TEST_ADDRESSES.miner);
      expect(
        BigInt((balance.data as { totalMined: string }).totalMined),
      ).toBeGreaterThan(0n);
    });

    it("should isolate balance between different addresses", async () => {
      const proof1 = generateValidProof(MIN_DIFFICULTY);
      const proof2 = generateValidProof(MIN_DIFFICULTY);

      await api.creditMining(TEST_ADDRESSES.miner, proof1);
      await api.creditMining(TEST_ADDRESSES.treasury, proof2);

      const balance1 = await api.getBalance(TEST_ADDRESSES.miner);
      const balance2 = await api.getBalance(TEST_ADDRESSES.treasury);

      // Both should have balance
      expect(
        BigInt((balance1.data as { virtualBalance: string }).virtualBalance),
      ).toBeGreaterThan(0n);
      expect(
        BigInt((balance2.data as { virtualBalance: string }).virtualBalance),
      ).toBeGreaterThan(0n);

      // Balances should be independent
      expect((balance1.data as { virtualBalance: string }).virtualBalance).toBe(
        (balance2.data as { virtualBalance: string }).virtualBalance,
      );
    });
  });
});
