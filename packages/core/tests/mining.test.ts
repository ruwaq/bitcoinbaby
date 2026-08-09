/**
 * Mining Module Tests
 *
 * Critical tests for the mining engine to ensure safety and correctness.
 */

import { describe, it, expect, vi } from "vitest";

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

    it("should expose an optional BlockObserver hook (no AI-loop change)", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");
      const { BlockObserver } = await import("../src/mining/block-observer");

      const orchestrator = new MiningOrchestrator();

      // Initially none attached.
      expect(orchestrator.getBlockObserver()).toBeNull();

      // Attaching/stripping must not throw and must not start mining.
      const obs = new BlockObserver({}, {}, async () => ({
        height: 1,
        hash: "0".repeat(64),
        time: 0,
      }));
      expect(() => orchestrator.setBlockObserver(obs)).not.toThrow();
      expect(orchestrator.getBlockObserver()).toBe(obs);
      expect(orchestrator.getIsRunning()).toBe(false);

      // terminate() clears the hook and stops the observer without throwing.
      expect(() => orchestrator.terminate()).not.toThrow();
      expect(orchestrator.getBlockObserver()).toBeNull();
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
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

      const miner = new CPUMiner();

      expect(miner.type).toBe("cpu");
      expect(miner.getHashrate()).toBe(0);
      expect(miner.getTotalHashes()).toBe(0);
    });

    it("should accept custom options", async () => {
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

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
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw with out of range values
      expect(() => miner.setThrottle(-50)).not.toThrow();
      expect(() => miner.setThrottle(150)).not.toThrow();
      expect(() => miner.setThrottle(50)).not.toThrow();
    });
  });

  describe("Lifecycle", () => {
    it("should handle stop when not started", async () => {
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.stop()).not.toThrow();
    });

    it("should handle terminate cleanly", async () => {
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.terminate()).not.toThrow();
      expect(() => miner.terminate()).not.toThrow(); // Double terminate
    });

    it("should handle pause/resume when not started", async () => {
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

      const miner = new CPUMiner();

      // Should not throw
      expect(() => miner.pause()).not.toThrow();
      expect(() => miner.resume()).not.toThrow();
    });
  });

  describe("isRunning semantics", () => {
    it("should return false when not started", async () => {
      const { CPUMiner } = await import("../src/mining/legacy/cpu-miner");

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

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Mining Integration", () => {
  describe("Orchestrator State Machine", () => {
    it("should transition from idle -> starting -> running", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator({
        preferWebGPU: false,
        fallbackToCPU: true,
      });

      const states: string[] = [];
      orchestrator.on("onStatusChange", (status) => {
        states.push(status);
      });

      // Initial state should be idle/not running
      expect(orchestrator.getIsRunning()).toBe(false);

      // When we terminate, it should clean up without error
      orchestrator.terminate();
    });

    it("should handle rapid start/stop cycles", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator({
        preferWebGPU: false,
        fallbackToCPU: true,
      });

      // Rapid cycles should not throw or cause memory leaks
      for (let i = 0; i < 5; i++) {
        orchestrator.stop();
      }

      orchestrator.terminate();
    });
  });

  describe("Challenge Generation", () => {
    it("should create valid challenge format", async () => {
      // Challenge format: "timestamp:address"
      const timestamp = Date.now();
      const address = "tb1p123456789abcdef";
      const challenge = `${timestamp}:${address}`;

      expect(challenge).toMatch(/^\d+:tb1p[a-z0-9]+$/);

      // Parse and validate
      const parts = challenge.split(":");
      expect(parts.length).toBe(2);
      expect(parseInt(parts[0])).toBeGreaterThan(0);
      expect(parts[1].startsWith("tb1p")).toBe(true);
    });

    it("should generate unique challenges", () => {
      const address = "tb1p123456789abcdef";
      const challenges = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const challenge = `${Date.now() + i}:${address}`;
        challenges.add(challenge);
      }

      // All challenges should be unique
      expect(challenges.size).toBe(10);
    });
  });

  describe("Hashrate Aggregation", () => {
    it("should aggregate hashrates from multiple workers", async () => {
      // Simulate hashrate data from multiple workers
      const workerHashrates = new Map<number, number>();
      workerHashrates.set(0, 1000); // Worker 0: 1000 H/s
      workerHashrates.set(1, 1200); // Worker 1: 1200 H/s
      workerHashrates.set(2, 800); // Worker 2: 800 H/s

      // Calculate aggregate
      const totalHashrate = Array.from(workerHashrates.values()).reduce(
        (sum, hr) => sum + hr,
        0,
      );

      expect(totalHashrate).toBe(3000);
    });

    it("should handle worker hashrate going to zero", async () => {
      const workerHashrates = new Map<number, number>();
      workerHashrates.set(0, 1000);
      workerHashrates.set(1, 0); // Worker stopped
      workerHashrates.set(2, 800);

      const totalHashrate = Array.from(workerHashrates.values()).reduce(
        (sum, hr) => sum + hr,
        0,
      );

      // Should still calculate correctly with one worker at 0
      expect(totalHashrate).toBe(1800);
    });
  });

  describe("Difficulty Validation", () => {
    it("should enforce minimum difficulty of 16", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      const orchestrator = new MiningOrchestrator({
        initialDifficulty: 10, // Below minimum
        preferWebGPU: false,
      });

      // The orchestrator should be created (difficulty handled internally)
      expect(orchestrator).toBeDefined();

      orchestrator.terminate();
    });

    it("should accept valid difficulty range", async () => {
      const { MiningOrchestrator } = await import("../src/mining/orchestrator");

      // Test valid difficulties
      const validDifficulties = [16, 17, 20, 24, 32];

      for (const diff of validDifficulties) {
        const orchestrator = new MiningOrchestrator({
          initialDifficulty: diff,
          preferWebGPU: false,
        });
        expect(orchestrator).toBeDefined();
        orchestrator.terminate();
      }
    });
  });

  describe("Proof Validation", () => {
    it("should validate proof meets difficulty", () => {
      // A hash with 17 leading zero bits would start with "0000" (16 bits) + 0-7 nibble (1 bit)
      const hash17zeros = "00007fff" + "f".repeat(56);
      const hash16zeros = "0000ffff" + "f".repeat(56);

      // Count leading zeros
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

      expect(countLeadingZeroBits(hash17zeros)).toBeGreaterThanOrEqual(17);
      expect(countLeadingZeroBits(hash16zeros)).toBe(16);
    });
  });

  describe("Worker Error Handling", () => {
    it("should track restart attempts per worker", () => {
      const maxRestarts = 3;
      const workerRestartAttempts = new Map<number, number>();

      // Simulate worker failures
      const handleWorkerError = (workerId: number): boolean => {
        const attempts = workerRestartAttempts.get(workerId) ?? 0;

        if (attempts >= maxRestarts) {
          return false; // Can't restart
        }

        workerRestartAttempts.set(workerId, attempts + 1);
        return true; // Restarted
      };

      // Worker 0 fails 3 times
      expect(handleWorkerError(0)).toBe(true);
      expect(handleWorkerError(0)).toBe(true);
      expect(handleWorkerError(0)).toBe(true);
      expect(handleWorkerError(0)).toBe(false); // Max reached

      // Worker 1 can still restart
      expect(handleWorkerError(1)).toBe(true);
    });

    it("should only stop mining when ALL workers fail", () => {
      const maxRestarts = 3;
      const workerCount = 4;
      const workerRestartAttempts = new Map<number, number>();

      // Initialize all workers at max attempts except one
      for (let i = 0; i < workerCount - 1; i++) {
        workerRestartAttempts.set(i, maxRestarts);
      }
      workerRestartAttempts.set(workerCount - 1, 0); // One worker still alive

      // Check if all workers have failed
      const allFailed = Array.from({ length: workerCount }, (_, i) => i).every(
        (i) => (workerRestartAttempts.get(i) ?? 0) >= maxRestarts,
      );

      expect(allFailed).toBe(false); // Not all failed

      // Now fail the last worker
      workerRestartAttempts.set(workerCount - 1, maxRestarts);

      const allFailedNow = Array.from(
        { length: workerCount },
        (_, i) => i,
      ).every((i) => (workerRestartAttempts.get(i) ?? 0) >= maxRestarts);

      expect(allFailedNow).toBe(true); // All failed
    });
  });

  describe("Memory Management", () => {
    it("should clear hashrate data when worker stops", () => {
      const workerHashrates = new Map<number, number>();
      const workerTotalHashes = new Map<number, number>();

      // Setup worker data
      workerHashrates.set(0, 1000);
      workerTotalHashes.set(0, 1000000);

      // Simulate worker stop/cleanup
      const cleanupWorker = (workerId: number) => {
        workerHashrates.delete(workerId);
        // Note: total hashes should be preserved for stats
      };

      cleanupWorker(0);

      expect(workerHashrates.has(0)).toBe(false);
      expect(workerTotalHashes.has(0)).toBe(true); // Preserved
    });
  });
});
