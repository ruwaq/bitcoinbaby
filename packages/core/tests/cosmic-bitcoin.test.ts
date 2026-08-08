/**
 * Cosmic Bitcoin Integration Tests
 *
 * Tests for Bitcoin network data in cosmic system.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getBitcoinCosmicData,
  estimateTimeUntilHalving,
  getHalvingProgress,
  formatDifficulty,
  formatNetworkHashrate,
  clearBitcoinCache,
} from "../src/cosmic/bitcoin";

describe("Cosmic Bitcoin Data", () => {
  beforeEach(() => {
    clearBitcoinCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getBitcoinCosmicData", () => {
    it("should fetch Bitcoin data from mempool.space", async () => {
      // Mock fetch to avoid network calls in tests
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes("/blocks/tip/height")) {
          return new Response("880000", { status: 200 });
        }
        if (urlStr.includes("/v1/blocks")) {
          return new Response(
            JSON.stringify([{ height: 880000, difficulty: 95672703408223 }]),
            { status: 200 },
          );
        }
        if (urlStr.includes("/v1/mining/hashrate")) {
          return new Response(JSON.stringify({ currentHashrate: 700e18 }), {
            status: 200,
          });
        }
        if (urlStr.includes("/mempool")) {
          return new Response(JSON.stringify({ count: 50000, vsize: 100000 }), {
            status: 200,
          });
        }
        return new Response("Not found", { status: 404 });
      });

      const data = await getBitcoinCosmicData();

      expect(data).not.toBeNull();
      expect(data?.currentBlock).toBe(880000);
      expect(data?.nextHalvingBlock).toBe(1050000);
      expect(data?.blocksUntilHalving).toBe(170000);
      expect(data?.difficulty).toBe(95672703408223);
    });

    it("should cache data for 5 minutes", async () => {
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        return new Response("880000", { status: 200 });
      });

      // First call
      await getBitcoinCosmicData();
      const callCount1 = vi.mocked(fetch).mock.calls.length;

      // Second call (should use cache)
      await getBitcoinCosmicData();
      const callCount2 = vi.mocked(fetch).mock.calls.length;

      // Should not have made additional calls
      expect(callCount2).toBe(callCount1);
    });

    it("should force refresh when requested", async () => {
      let callCount = 0;
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        callCount++;
        const urlStr = url.toString();
        if (urlStr.includes("/blocks/tip/height")) {
          return new Response(String(880000 + callCount), { status: 200 });
        }
        if (urlStr.includes("/v1/blocks")) {
          return new Response(
            JSON.stringify([{ height: 880000, difficulty: 1 }]),
            { status: 200 },
          );
        }
        return new Response("", { status: 200 });
      });

      // First call
      const data1 = await getBitcoinCosmicData();

      // Force refresh
      const data2 = await getBitcoinCosmicData(true);

      // Should have different block heights
      expect(data2?.currentBlock).toBeGreaterThan(data1?.currentBlock ?? 0);
    });

    it("should return cached data on API error", async () => {
      // First successful call
      vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const urlStr = url.toString();
        if (urlStr.includes("/blocks/tip/height")) {
          return new Response("880000", { status: 200 });
        }
        if (urlStr.includes("/v1/blocks")) {
          return new Response(
            JSON.stringify([{ height: 880000, difficulty: 1 }]),
            { status: 200 },
          );
        }
        return new Response("", { status: 200 });
      });

      await getBitcoinCosmicData();

      // Second call fails
      vi.spyOn(global, "fetch").mockImplementation(async () => {
        throw new Error("Network error");
      });

      // Should return cached data
      const data = await getBitcoinCosmicData(true);
      expect(data?.currentBlock).toBe(880000);
    });
  });

  describe("estimateTimeUntilHalving", () => {
    it("should calculate days and hours correctly", () => {
      // 170000 blocks * 10 min = 1700000 minutes
      // = 1180.5 days = 1180 days, 12 hours
      const result = estimateTimeUntilHalving(170000);

      expect(result.days).toBe(1180);
      expect(result.hours).toBe(13);
      expect(result.minutes).toBe(20);
    });

    it("should handle small block counts", () => {
      const result = estimateTimeUntilHalving(6);

      expect(result.days).toBe(0);
      expect(result.hours).toBe(1);
      expect(result.minutes).toBe(0);
    });

    it("should handle zero blocks", () => {
      const result = estimateTimeUntilHalving(0);

      expect(result.days).toBe(0);
      expect(result.hours).toBe(0);
      expect(result.minutes).toBe(0);
    });
  });

  describe("getHalvingProgress", () => {
    it("should calculate progress percentage", () => {
      // Halfway through epoch
      const progress = getHalvingProgress(945000, 1050000);
      expect(progress).toBeCloseTo(50, 0);
    });

    it("should return 0 at start of epoch", () => {
      const progress = getHalvingProgress(840000, 1050000);
      expect(progress).toBe(0);
    });

    it("should return ~100 near end of epoch", () => {
      const progress = getHalvingProgress(1049999, 1050000);
      expect(progress).toBeCloseTo(100, 0);
    });
  });

  describe("formatDifficulty", () => {
    it("should format trillions", () => {
      expect(formatDifficulty(95.67e12)).toBe("95.67T");
    });

    it("should format billions", () => {
      expect(formatDifficulty(95.67e9)).toBe("95.67B");
    });

    it("should format millions", () => {
      expect(formatDifficulty(95.67e6)).toBe("95.67M");
    });

    it("should format small numbers as millions", () => {
      const result = formatDifficulty(1234567);
      expect(result).toBe("1.23M");
    });

    it("should format numbers below million with locale", () => {
      const result = formatDifficulty(123456);
      expect(result).toMatch(/123[,.]456/);
    });
  });

  describe("formatNetworkHashrate", () => {
    it("should format exahash", () => {
      expect(formatNetworkHashrate(700e18)).toBe("700.00 EH/s");
    });

    it("should format petahash", () => {
      expect(formatNetworkHashrate(500e15)).toBe("500.00 PH/s");
    });

    it("should format terahash", () => {
      expect(formatNetworkHashrate(100e12)).toBe("100.00 TH/s");
    });
  });
});
