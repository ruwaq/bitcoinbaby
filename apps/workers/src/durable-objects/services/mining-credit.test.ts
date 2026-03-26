/**
 * Mining Credit Service Tests
 *
 * Tests for the mining credit calculation and boost system.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("../../lib/proof-validation", () => ({
  validateMiningProof: vi.fn(),
  checkRateLimit: vi.fn(),
  getStreakMultiplier: vi.fn(),
  isProofUsedGlobally: vi.fn(),
  markProofUsedGlobally: vi.fn(),
  STREAK_RESET_MS: 30 * 60 * 1000, // 30 minutes
  MIN_DIFFICULTY: 8,
}));

vi.mock("../../lib/vardiff", () => ({
  processShare: vi.fn(),
}));

vi.mock("../../lib/redis", () => ({
  getRedis: vi.fn(),
}));

vi.mock("../../lib/nft-boost", () => ({
  getNFTBoostData: vi.fn(),
  getNFTMultiplier: vi.fn(),
}));

vi.mock("../../lib/engagement-boost", () => ({
  getEngagementBoostData: vi.fn(),
  getEngagementMultiplier: vi.fn(),
}));

vi.mock("../../lib/cosmic-boost", () => ({
  getCosmicBoostData: vi.fn(),
  getCosmicMultiplier: vi.fn(),
}));

vi.mock("../../lib/reward-multipliers", () => ({
  MULTIPLIER_CONFIG: {
    enabled: {
      nft: false,
      engagement: false,
      cosmic: false,
    },
    maxTotalMultiplier: 10,
  },
}));

import { processMiningCredit, type MiningCreditDeps } from "./mining-credit";
import {
  validateMiningProof,
  checkRateLimit,
  isProofUsedGlobally,
  markProofUsedGlobally,
  getStreakMultiplier,
} from "../../lib/proof-validation";
import { processShare } from "../../lib/vardiff";

describe("Mining Credit Service", () => {
  const mockEnv = {
    CACHE: null,
    ENVIRONMENT: "development" as const,
  } as unknown as MiningCreditDeps["env"];

  const mockBalance = {
    address: "tb1test123",
    virtualBalance: 1000n,
    totalMined: 1000n,
    totalWithdrawn: 0n,
    pendingWithdraw: 0n,
    streakCount: 5,
    lastMiningAt: Date.now() - 1000, // Recent mining
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now(),
  };

  const mockDifficultyState = {
    currentDiff: 10,
    recentShareTimes: [] as number[],
    sharesSinceRetarget: 5,
    lastRetargetAt: Date.now() - 30000,
    averageShareTime: 3,
  };

  const mockProof = {
    hash: "0000000abc123def456",
    nonce: 12345,
    difficulty: 10,
    blockData: "test-block-data",
    timestamp: Date.now(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(validateMiningProof).mockResolvedValue({
      valid: true,
      calculatedReward: 100n,
    });

    vi.mocked(checkRateLimit).mockReturnValue({ valid: true });

    vi.mocked(isProofUsedGlobally).mockResolvedValue({
      used: false,
      error: undefined,
    });

    vi.mocked(markProofUsedGlobally).mockResolvedValue(undefined);

    vi.mocked(getStreakMultiplier).mockReturnValue(1.1);

    vi.mocked(processShare).mockReturnValue({
      state: mockDifficultyState,
      result: {
        changed: false,
        newDifficulty: 10,
        averageShareTime: 30,
        reason: "",
      },
    });
  });

  describe("processMiningCredit", () => {
    it("should process valid proof and return credit result", async () => {
      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(true);
      expect(result.proofId).toBeDefined();
      expect(result.reward).toBeDefined();
      expect(result.balance).toBeDefined();
      expect(result.boosts).toBeDefined();
      expect(result.varDiff).toBeDefined();
    });

    it("should reject invalid proof", async () => {
      vi.mocked(validateMiningProof).mockResolvedValue({
        valid: false,
        reason: "Invalid hash",
      });

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid proof");
      expect(result.errorCode).toBe(400);
    });

    it("should reject duplicate proof", async () => {
      vi.mocked(isProofUsedGlobally).mockResolvedValue({
        used: true,
        error: undefined,
      });

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Proof already used");
      expect(result.errorCode).toBe(409);
    });

    it("should reject when rate limited", async () => {
      vi.mocked(checkRateLimit).mockReturnValue({
        valid: false,
        reason: "Too many requests",
      });

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 1000,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Too many requests");
      expect(result.errorCode).toBe(429);
    });

    it("should reject proof below minimum difficulty", async () => {
      const lowDiffProof = { ...mockProof, difficulty: 5 };

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(lowDiffProof, deps);

      expect(result.success).toBe(false);
      expect(result.error).toContain("below minimum");
      expect(result.errorCode).toBe(400);
    });

    it("should handle string nonce (from IndexedDB)", async () => {
      const proofWithStringNonce = {
        ...mockProof,
        nonce: "12345" as unknown as number,
      };

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(proofWithStringNonce, deps);

      expect(result.success).toBe(true);
    });

    it("should apply streak multiplier correctly", async () => {
      vi.mocked(getStreakMultiplier).mockReturnValue(1.5);
      vi.mocked(validateMiningProof).mockResolvedValue({
        valid: true,
        calculatedReward: 100n,
      });

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance, streakCount: 50 },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(true);
      // Base 100 * 1.5 streak = 150
      expect(result.reward).toBe(150n);
    });

    it("should reset streak after gap", async () => {
      vi.mocked(getStreakMultiplier).mockReturnValue(1.0);

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: {
          ...mockBalance,
          lastMiningAt: Date.now() - 60 * 60 * 1000, // 1 hour ago (gap)
          streakCount: 100,
        },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(true);
      // Streak should reset
      expect(result.boosts?.streak.consecutiveShares).toBe(1);
    });

    it("should update balance correctly", async () => {
      vi.mocked(validateMiningProof).mockResolvedValue({
        valid: true,
        calculatedReward: 100n,
      });
      vi.mocked(getStreakMultiplier).mockReturnValue(1.0);

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: {
          ...mockBalance,
          virtualBalance: 500n,
          totalMined: 500n,
        },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(true);
      expect(result.balance?.virtualBalance).toBe(600n); // 500 + 100
      expect(result.balance?.totalMined).toBe(600n);
    });

    it("should handle KV unavailable gracefully", async () => {
      vi.mocked(isProofUsedGlobally).mockResolvedValue({
        used: false,
        error: "KV unavailable",
      });

      const deps: MiningCreditDeps = {
        env: mockEnv,
        address: "tb1test123",
        balance: { ...mockBalance },
        difficultyState: { ...mockDifficultyState },
        sharesInLastHour: 10,
      };

      const result = await processMiningCredit(mockProof, deps);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe(503);
    });
  });
});
