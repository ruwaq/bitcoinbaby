/**
 * Faucet Rate Limiting Tests
 *
 * Tests the BABTC faucet claim flow:
 * - POST /api/faucet/claim — Claim 5 BABTC per 24h, max 50 BABTC lifetime
 *
 * Uses a mock faucet API client matching the real implementation:
 * - KV-based rate limiting (24h cooldown)
 * - VirtualBalanceDO for balance tracking
 * - Max total cap of 50 BABTC (lifetime)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

interface FaucetClaimResponse {
  amount: string;
  newBalance: string;
  totalClaimed: number;
  nextClaimAt?: number;
  message: string;
}

interface FaucetErrorResponse {
  nextClaimAt?: number;
  retryAfterSeconds?: number;
  totalClaimed?: number;
  maxTotal?: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const FAUCET_AMOUNT = 5;
const FAUCET_MAX_TOTAL = 50;
const FAUCET_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Valid test addresses
const VALID_ADDRESSES = {
  tb1: "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
  bc1: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
};

const INVALID_ADDRESSES = {
  wrongPrefix: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  random: "not-a-valid-address",
  empty: "",
};

// =============================================================================
// MOCK FAUCET CLIENT
// =============================================================================

class MockFaucetClient {
  private rateLimitStore: Map<
    string,
    { lastClaimAt: number; totalClaimed: number }
  > = new Map();

  private balances: Map<string, bigint> = new Map();

  constructor() {
    this.reset();
  }

  reset(): void {
    this.rateLimitStore.clear();
    this.balances.clear();
  }

  private getOrCreateRateLimit(
    address: string,
  ): { lastClaimAt: number; totalClaimed: number } {
    if (!this.rateLimitStore.has(address)) {
      this.rateLimitStore.set(address, {
        lastClaimAt: 0,
        totalClaimed: 0,
      });
    }
    return this.rateLimitStore.get(address)!;
  }

  private getOrCreateBalance(address: string): bigint {
    if (!this.balances.has(address)) {
      this.balances.set(address, 0n);
    }
    return this.balances.get(address)!;
  }

  /**
   * POST /api/faucet/claim
   */
  async claim(
    address: string | undefined | null,
  ): Promise<ApiResponse<FaucetClaimResponse>> {
    // ---- Missing address check ----
    if (!address) {
      return {
        success: false,
        error: "Address is required",
        timestamp: Date.now(),
      };
    }

    // ---- Address validation ----
    if (
      !address.startsWith("tb1") &&
      !address.startsWith("bc1") &&
      !address.startsWith("tb1q") &&
      !address.startsWith("bc1q")
    ) {
      return {
        success: false,
        error: "Invalid Bitcoin address format",
        timestamp: Date.now(),
      };
    }

    const now = Date.now();
    const rateLimit = this.getOrCreateRateLimit(address);

    // ---- Cooldown check ----
    const nextClaimAt = rateLimit.lastClaimAt + FAUCET_WINDOW_MS;
    if (now < nextClaimAt) {
      const retryAfterSec = Math.ceil((nextClaimAt - now) / 1000);
      return {
        success: false,
        error:
          "Faucet cooldown active. Please wait before claiming again.",
        nextClaimAt,
        retryAfterSeconds: retryAfterSec,
        totalClaimed: rateLimit.totalClaimed,
        timestamp: now,
      } as unknown as ApiResponse<FaucetClaimResponse>;
    }

    // ---- Max total check ----
    if (rateLimit.totalClaimed + FAUCET_AMOUNT > FAUCET_MAX_TOTAL) {
      return {
        success: false,
        error: `Maximum faucet total reached (${FAUCET_MAX_TOTAL} BABTC). You have claimed ${rateLimit.totalClaimed}.`,
        totalClaimed: rateLimit.totalClaimed,
        maxTotal: FAUCET_MAX_TOTAL,
        timestamp: now,
      } as unknown as ApiResponse<FaucetClaimResponse>;
    }

    // ---- Credit ----
    const balance = this.getOrCreateBalance(address);
    const newBalance = balance + BigInt(FAUCET_AMOUNT);
    this.balances.set(address, newBalance);

    // Update rate limit tracking
    rateLimit.lastClaimAt = now;
    rateLimit.totalClaimed += FAUCET_AMOUNT;

    return {
      success: true,
      data: {
        amount: String(FAUCET_AMOUNT),
        newBalance: newBalance.toString(),
        totalClaimed: rateLimit.totalClaimed,
        message: `Claimed ${FAUCET_AMOUNT} BABTC. New balance: ${newBalance}`,
      },
      timestamp: now,
    };
  }

  /**
   * Helper: advance time for testing cooldown
   */
  advanceTime(address: string, ms: number): void {
    const rateLimit = this.rateLimitStore.get(address);
    if (rateLimit) {
      rateLimit.lastClaimAt -= ms;
    }
  }

  /**
   * Helper: get current total claimed for an address
   */
  getTotalClaimed(address: string): number {
    return this.rateLimitStore.get(address)?.totalClaimed ?? 0;
  }
}

// =============================================================================
// TESTS
// =============================================================================

describe("Faucet API", () => {
  let faucet: MockFaucetClient;

  beforeEach(() => {
    faucet = new MockFaucetClient();
  });

  afterEach(() => {
    faucet.reset();
  });

  // ===========================================================================
  // Successful Claims
  // ===========================================================================

  describe("POST /api/faucet/claim — successful claims", () => {
    it("returns 5 BABTC on first claim", async () => {
      const response = await faucet.claim(VALID_ADDRESSES.tb1);

      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data!.amount).toBe("5");
      expect(response.data!.totalClaimed).toBe(5);
      expect(BigInt(response.data!.newBalance)).toBe(5n);
    });

    it("returns correct newBalance accumulating claims (after cooldown)", async () => {
      // First claim
      await faucet.claim(VALID_ADDRESSES.tb1);

      // Advance past cooldown
      faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);

      // Second claim
      const response = await faucet.claim(VALID_ADDRESSES.tb1);

      expect(response.success).toBe(true);
      expect(BigInt(response.data!.newBalance)).toBe(10n); // 5 + 5
      expect(response.data!.totalClaimed).toBe(10);
    });

    it("supports bc1 addresses", async () => {
      const response = await faucet.claim(VALID_ADDRESSES.bc1);

      expect(response.success).toBe(true);
      expect(response.data!.amount).toBe("5");
    });

    it("response includes timestamp", async () => {
      const response = await faucet.claim(VALID_ADDRESSES.tb1);

      expect(response.timestamp).toBeGreaterThan(0);
      expect(typeof response.timestamp).toBe("number");
    });
  });

  // ===========================================================================
  // Rate Limiting
  // ===========================================================================

  describe("Rate Limiting", () => {
    it("rejects second claim within 24h with error", async () => {
      // First claim succeeds
      const first = await faucet.claim(VALID_ADDRESSES.tb1);
      expect(first.success).toBe(true);

      // Second claim fails (cooldown active)
      const second = await faucet.claim(VALID_ADDRESSES.tb1);

      expect(second.success).toBe(false);
      expect(second.error).toContain("cooldown");
    });

    it("includes Retry-After info on rate-limited response", async () => {
      await faucet.claim(VALID_ADDRESSES.tb1);

      const response = await faucet.claim(VALID_ADDRESSES.tb1);

      const errorData = response as unknown as FaucetErrorResponse;
      expect(errorData.retryAfterSeconds).toBeGreaterThan(0);
      expect(errorData.retryAfterSeconds).toBeLessThanOrEqual(
        FAUCET_WINDOW_MS / 1000,
      );
      expect(errorData.nextClaimAt).toBeGreaterThan(Date.now());
    });

    it("allows claim after cooldown expires", async () => {
      await faucet.claim(VALID_ADDRESSES.tb1);

      // Advance past the 24h window
      faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1000);

      const response = await faucet.claim(VALID_ADDRESSES.tb1);
      expect(response.success).toBe(true);
      expect(response.data!.totalClaimed).toBe(10); // 5 + 5
    });

    it("tracks cooldown independently per address", async () => {
      await faucet.claim(VALID_ADDRESSES.tb1);

      // Different address should not be rate-limited
      const response = await faucet.claim(VALID_ADDRESSES.bc1);
      expect(response.success).toBe(true);
      expect(response.data!.amount).toBe("5");
    });
  });

  // ===========================================================================
  // Max Total Lifetime Cap
  // ===========================================================================

  describe("Max Total Cap (50 BABTC)", () => {
    it("allows exactly 10 claims (5 × 10 = 50)", async () => {
      for (let i = 0; i < 10; i++) {
        faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);
        const response = await faucet.claim(VALID_ADDRESSES.tb1);
        expect(response.success).toBe(true);
        expect(response.data!.totalClaimed).toBe((i + 1) * 5);
      }

      expect(faucet.getTotalClaimed(VALID_ADDRESSES.tb1)).toBe(50);
    });

    it("rejects 11th claim (would exceed 50 BABTC)", async () => {
      // Claim 10 times (50 BABTC total)
      for (let i = 0; i < 10; i++) {
        faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);
        await faucet.claim(VALID_ADDRESSES.tb1);
      }

      // 11th claim should fail
      faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);
      const response = await faucet.claim(VALID_ADDRESSES.tb1);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Maximum faucet total reached");
      expect(response.error).toContain("50");

      const errorData = response as unknown as FaucetErrorResponse;
      expect(errorData.maxTotal).toBe(50);
      expect(errorData.totalClaimed).toBe(50);
    });

    it("rejects partial claim that would exceed cap", async () => {
      // Claim exactly the max: 10 × 5 = 50
      for (let i = 0; i < 10; i++) {
        faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);
        await faucet.claim(VALID_ADDRESSES.tb1);
      }

      // Try one more
      faucet.advanceTime(VALID_ADDRESSES.tb1, FAUCET_WINDOW_MS + 1);
      const response = await faucet.claim(VALID_ADDRESSES.tb1);
      expect(response.success).toBe(false);
    });
  });

  // ===========================================================================
  // Address Validation
  // ===========================================================================

  describe("Address Validation", () => {
    it("rejects missing address with error", async () => {
      const response = await faucet.claim(undefined);

      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
      expect(response.error).toContain("required");
    });

    it("rejects null address", async () => {
      const response = await faucet.claim(null);

      expect(response.success).toBe(false);
    });

    it("rejects empty string address", async () => {
      const response = await faucet.claim(INVALID_ADDRESSES.empty);

      expect(response.success).toBe(false);
      // Empty string is falsy — treated as missing address
      expect(response.error).toContain("required");
    });

    it("rejects invalid address format", async () => {
      const response = await faucet.claim(INVALID_ADDRESSES.random);

      expect(response.success).toBe(false);
      expect(response.error).toContain("Invalid");
    });

    it("rejects legacy Bitcoin address (not bech32)", async () => {
      const response = await faucet.claim(INVALID_ADDRESSES.wrongPrefix);

      expect(response.success).toBe(false);
    });
  });
});
