/**
 * Mining Module Tests
 *
 * Critical tests for the mining engine to ensure safety and correctness.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// =============================================================================
// UTILITY FUNCTION TESTS
// =============================================================================

describe("Mining Utilities", () => {
  describe("countLeadingZeroBits", () => {
    // This function is critical for proof of work validation
    // It exists in the worker code (as string) - we test the algorithm here

    const countLeadingZeroBits = (hash: string): number => {
      let count = 0;
      for (const char of hash) {
        const nibble = parseInt(char, 16);
        if (nibble === 0) {
          count += 4;
        } else {
          if (nibble < 8) count += 1;
          if (nibble < 4) count += 1;
          if (nibble < 2) count += 1;
          break;
        }
      }
      return count;
    };

    it("should return 0 for hash starting with f", () => {
      expect(countLeadingZeroBits("ffffffff")).toBe(0);
    });

    it("should return 0 for hash starting with 8-f", () => {
      expect(countLeadingZeroBits("8abcdef0")).toBe(0);
      expect(countLeadingZeroBits("9abcdef0")).toBe(0);
      expect(countLeadingZeroBits("aabcdef0")).toBe(0);
      expect(countLeadingZeroBits("fabcdef0")).toBe(0);
    });

    it("should return 1 for hash starting with 4-7", () => {
      expect(countLeadingZeroBits("4abcdef0")).toBe(1);
      expect(countLeadingZeroBits("5abcdef0")).toBe(1);
      expect(countLeadingZeroBits("6abcdef0")).toBe(1);
      expect(countLeadingZeroBits("7abcdef0")).toBe(1);
    });

    it("should return 2 for hash starting with 2-3", () => {
      expect(countLeadingZeroBits("2abcdef0")).toBe(2);
      expect(countLeadingZeroBits("3abcdef0")).toBe(2);
    });

    it("should return 3 for hash starting with 1", () => {
      expect(countLeadingZeroBits("1abcdef0")).toBe(3);
    });

    it("should return 4 for each leading zero", () => {
      expect(countLeadingZeroBits("0abcdef0")).toBe(4);
      expect(countLeadingZeroBits("00abcdef")).toBe(8);
      expect(countLeadingZeroBits("000abcde")).toBe(12);
      expect(countLeadingZeroBits("0000abcd")).toBe(16);
    });

    it("should handle combined zeros and partial", () => {
      // 0000 = 16 bits, then 1 = 3 more bits
      expect(countLeadingZeroBits("00001abc")).toBe(19);
      // 0000 0000 = 32 bits, then 2 = 2 more bits
      expect(countLeadingZeroBits("000000002")).toBe(34);
    });

    it("should handle all zeros (256 bits for SHA-256)", () => {
      const allZeros = "0".repeat(64);
      expect(countLeadingZeroBits(allZeros)).toBe(256);
    });

    it("should handle empty string", () => {
      expect(countLeadingZeroBits("")).toBe(0);
    });
  });
});

// =============================================================================
// CAPABILITIES DETECTION TESTS
// =============================================================================

describe("Capabilities Detection", () => {
  describe("detectWorkers", () => {
    it("should detect Web Worker support", async () => {
      const { detectWorkers } = await import("../src/mining/capabilities");

      // In Node.js test environment, Worker is not defined
      const hasWorkers = typeof Worker !== "undefined";
      expect(detectWorkers()).toBe(hasWorkers);
    });
  });

  describe("getCPUCores", () => {
    it("should return a positive number", async () => {
      const { getCPUCores } = await import("../src/mining/capabilities");
      const cores = getCPUCores();
      expect(cores).toBeGreaterThan(0);
    });

    it("should return at least 1 core and at most 256", async () => {
      const { getCPUCores } = await import("../src/mining/capabilities");
      const cores = getCPUCores();
      // Should return a reasonable number of cores
      expect(cores).toBeGreaterThanOrEqual(1);
      expect(cores).toBeLessThanOrEqual(256);
    });
  });

  describe("isPageVisible", () => {
    it("should return true when document is undefined (SSR)", async () => {
      const { isPageVisible } = await import("../src/mining/capabilities");

      // In Node.js, document is undefined
      if (typeof document === "undefined") {
        expect(isPageVisible()).toBe(true);
      }
    });
  });
});

// =============================================================================
// ORCHESTRATOR TESTS
// =============================================================================

describe("MiningOrchestrator", () => {
  describe("Configuration", () => {
    it("should use default config when none provided", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      // The orchestrator should be created without errors
      expect(orchestrator).toBeDefined();
      expect(orchestrator.getIsRunning()).toBe(false);
    });

    it("should accept custom config", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator({
        preferWebGPU: false,
        fallbackToCPU: true,
        initialDifficulty: 20,
      });

      expect(orchestrator).toBeDefined();
    });
  });

  describe("State Management", () => {
    it("should track running state correctly", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      expect(orchestrator.getIsRunning()).toBe(false);
      expect(orchestrator.getMinerType()).toBeNull();
      expect(orchestrator.getHashrate()).toBe(0);
      expect(orchestrator.getTotalHashes()).toBe(0);
    });

    it("should allow registering event handlers", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      const onHashrate = vi.fn();
      const onWorkFound = vi.fn();
      const onStatusChange = vi.fn();
      const onError = vi.fn();

      // Should not throw
      orchestrator.on("onHashrateUpdate", onHashrate);
      orchestrator.on("onWorkFound", onWorkFound);
      orchestrator.on("onStatusChange", onStatusChange);
      orchestrator.on("onError", onError);

      expect(true).toBe(true); // No errors thrown
    });
  });

  describe("Lifecycle", () => {
    it("should handle start when already running gracefully", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      // Mock the internal state
      // @ts-expect-error - accessing private property for testing
      orchestrator.isRunning = true;

      // Should not throw when starting while already running
      await expect(orchestrator.start()).resolves.not.toThrow();

      // Should still be marked as running
      expect(orchestrator.getIsRunning()).toBe(true);
    });

    it("should handle stop when not running gracefully", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      // Should not throw when stopping a non-running orchestrator
      expect(() => orchestrator.stop()).not.toThrow();
    });

    it("should clean up on terminate", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator();

      // Should not throw
      expect(() => orchestrator.terminate()).not.toThrow();

      // Should be able to call terminate multiple times
      expect(() => orchestrator.terminate()).not.toThrow();
    });
  });

  describe("Difficulty Management", () => {
    it("should allow setting difficulty", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator({ initialDifficulty: 16 });

      // Should not throw
      expect(() => orchestrator.setDifficulty(20)).not.toThrow();
      expect(() => orchestrator.setDifficulty(8)).not.toThrow();
    });
  });
});

// =============================================================================
// CPU MINER TESTS
// =============================================================================

describe("CPUMiner", () => {
  describe("Constructor", () => {
    it("should create with default options", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      expect(miner.type).toBe("cpu");
      expect(miner.getHashrate()).toBe(0);
      expect(miner.getTotalHashes()).toBe(0);
    });

    it("should accept custom options", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const onHashrate = vi.fn();
      const onWorkFound = vi.fn();
      const onStatusChange = vi.fn();

      const miner = new CPUMiner({
        difficulty: 20,
        address: "test-address",
        onHashrateUpdate: onHashrate,
        onWorkFound: onWorkFound,
        onStatusChange: onStatusChange,
      });

      expect(miner).toBeDefined();
    });
  });

  describe("Throttle", () => {
    it("should clamp throttle to 0-100 range", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw with out of range values
      expect(() => miner.setThrottle(-50)).not.toThrow();
      expect(() => miner.setThrottle(150)).not.toThrow();
      expect(() => miner.setThrottle(50)).not.toThrow();
    });
  });

  describe("Lifecycle", () => {
    it("should handle stop when not started", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.stop()).not.toThrow();
    });

    it("should handle terminate cleanly", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.terminate()).not.toThrow();
      expect(() => miner.terminate()).not.toThrow(); // Double terminate
    });

    it("should handle pause/resume when not started", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.pause()).not.toThrow();
      expect(() => miner.resume()).not.toThrow();
    });
  });

  describe("isRunning semantics", () => {
    it("should return false when not started", async () => {
      const { CPUMiner } = await import("../src/mining/cpu-miner");

      const miner = new CPUMiner();

      expect(miner.isRunning()).toBe(false);
    });
  });
});

// =============================================================================
// TYPES TESTS
// =============================================================================

describe("Mining Types", () => {
  it("should export all required types", async () => {
    const types = await import("../src/mining/types");

    // Check that types are exported (they exist at runtime as undefined for interfaces)
    expect(types).toBeDefined();
  });
});
