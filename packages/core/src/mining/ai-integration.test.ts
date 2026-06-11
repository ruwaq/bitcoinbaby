/**
 * AI Work Integration — End-to-End Tests
 *
 * Validates the complete BabyBrain mining pipeline:
 *   initialize → generateDefaultAITask → executeTask → verifyProof
 *
 * All tests run 100% locally without server or network access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIWorkIntegration } from "./ai-integration";
import type { AITask, AIProof } from "./types";

// Mock @bitcoinbaby/ai to provide BabyBrainEngine in test environment
vi.mock("@bitcoinbaby/ai", () => {
  class MockBabyBrainEngine {
    private initialized = false;
    private tasksCompleted = 0;

    async initialize(): Promise<void> {
      this.initialized = true;
    }

    async executeTask(task: AITask): Promise<{
      taskId: string;
      output: string;
      computeTime: number;
      proof: string;
      verified: boolean;
    }> {
      if (!this.initialized) throw new Error("Engine not initialized");

      const startTime = performance.now();
      const output = `[BabyBrain] Response to: "${task.input}" with seed ${task.seed.slice(0, 8)}`;
      const computeTime = performance.now() - startTime;

      const proofObj: AIProof = {
        taskId: task.id,
        taskType: task.type,
        inputPrompt: task.input,
        seed: task.seed,
        output,
        computeTime,
        modelId: "baby-brain",
        timestamp: Date.now(),
      };

      const hash = await this.sha256(JSON.stringify(proofObj));
      const proof = JSON.stringify({ ...proofObj, hash });

      this.tasksCompleted++;

      return {
        taskId: task.id,
        output,
        computeTime,
        proof,
        verified: true,
      };
    }

    async verifyProof(proofString: string): Promise<boolean> {
      const proof = JSON.parse(proofString);
      const { hash, ...proofData } = proof;
      const expectedHash = await this.sha256(JSON.stringify(proofData));
      return hash === expectedHash;
    }

    getStatus() {
      return {
        initialized: this.initialized,
        hasWebGPU: false,
        modelLoaded: "baby-brain",
        modelChainStatus: [
          { id: "baby-brain", name: "BabyBrain", status: "loaded" as const },
        ],
      };
    }

    dispose(): void {
      this.initialized = false;
    }

    private async sha256(data: string): Promise<string> {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(data),
      );
      return Array.from(new Uint8Array(hashBuffer), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
    }
  }

  return {
    AIEngine: MockBabyBrainEngine,
    BabyBrainEngine: MockBabyBrainEngine,
    AIEngineError: class extends Error {
      readonly code = "unknown";
      readonly modelId = "";
    },
  };
});

describe("AIWorkIntegration — BabyBrain End-to-End Pipeline", () => {
  let integration: AIWorkIntegration;
  let statusUpdates: Array<ReturnType<AIWorkIntegration["getStatus"]>> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    statusUpdates = [];
    integration = new AIWorkIntegration(
      {
        enabled: true,
        taskFrequency: 1,
        preferWebGPU: false,
      },
      (status) => {
        statusUpdates.push(status);
      },
    );
  });

  describe("Pipeline: initialize → generate → execute → verify", () => {
    it("should complete the full BabyBrain mining cycle without server", async () => {
      // Step 1: Initialize (activates BabyBrain)
      await integration.initialize();

      const statusAfterInit = integration.getStatus();
      expect(statusAfterInit.initialized).toBe(true);
      expect(statusAfterInit.modelState).toBe("ready");
      expect(statusAfterInit.available).toBe(true);

      // Step 2: Generate a default AI task
      const task = integration.generateDefaultAITask();
      expect(task.id).toMatch(/^pouw-/);
      expect(task.type).toBe("pouw");
      expect(task.input).toBeTruthy();
      expect(task.seed).toHaveLength(32); // 16 bytes hex = 32 chars

      // Step 3: Execute the task
      const result = await integration.executeTask(task);
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.proof).toBeTruthy();
      expect(result.computeTime).toBeGreaterThan(0);

      // Step 4: Verify the proof
      const proofObj = JSON.parse(result.proof!) as AIProof;
      expect(proofObj.taskId).toBe(task.id);
      expect(proofObj.taskType).toBe("pouw");
      expect(proofObj.inputPrompt).toBe(task.input);
      expect(proofObj.seed).toBe(task.seed);
      expect(proofObj.output).toContain("[BabyBrain]");
      expect(proofObj.modelId).toBe("baby-brain");
      expect(proofObj.hash).toBeTruthy();

      // Verify hash integrity
      const { hash, ...proofData } = proofObj;
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        encoder.encode(JSON.stringify(proofData)),
      );
      const expectedHash = Array.from(new Uint8Array(hashBuffer), (b) =>
        b.toString(16).padStart(2, "0"),
      ).join("");
      expect(hash).toBe(expectedHash);

      // Step 5: Check status updates were emitted
      expect(statusUpdates.length).toBeGreaterThan(0);
      const finalStatus = statusUpdates[statusUpdates.length - 1];
      expect(finalStatus.initialized).toBe(true);
      expect(finalStatus.modelState).toBe("ready");
    });

    it("should generate unique tasks with different seeds", () => {
      const task1 = integration.generateDefaultAITask();
      const task2 = integration.generateDefaultAITask();

      expect(task1.id).not.toBe(task2.id);
      expect(task1.seed).not.toBe(task2.seed);
    });

    it("should execute multiple tasks sequentially", async () => {
      await integration.initialize();

      const results = [];
      for (let i = 0; i < 5; i++) {
        const task = integration.generateDefaultAITask();
        const result = await integration.executeTask(task);
        results.push(result);
      }

      expect(results).toHaveLength(5);
      results.forEach((r) => {
        expect(r.success).toBe(true);
        expect(r.proof).toBeTruthy();
      });

      // All task IDs should be unique
      const ids = results.map((r) => r.taskId);
      expect(new Set(ids).size).toBe(5);
    });

    it("should report correct tasksCompleted count", async () => {
      await integration.initialize();

      const statusBefore = integration.getStatus();
      expect(statusBefore.tasksCompleted).toBe(0);

      await integration.executeTask(integration.generateDefaultAITask());
      await integration.executeTask(integration.generateDefaultAITask());
      await integration.executeTask(integration.generateDefaultAITask());

      const statusAfter = integration.getStatus();
      expect(statusAfter.tasksCompleted).toBe(3);
    });
  });

  describe("Error handling", () => {
    it("should reject executeTask when not initialized", async () => {
      const task = integration.generateDefaultAITask();
      const result = await integration.executeTask(task);

      expect(result.success).toBe(false);
      expect(result.error).toContain("not initialized");
    });

    it("should handle rapid sequential initializations gracefully", async () => {
      const p1 = integration.initialize();
      const p2 = integration.initialize();
      const p3 = integration.initialize();

      await Promise.all([p1, p2, p3]);

      const status = integration.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelState).toBe("ready");
    });
  });

  describe("Status reporting", () => {
    it("should emit status updates during initialization", async () => {
      await integration.initialize();

      // Should have at least one status update
      expect(statusUpdates.length).toBeGreaterThan(0);

      // First update should show loading/idle state
      const firstUpdate = statusUpdates[0];
      expect(["idle", "loading", "ready"]).toContain(firstUpdate.modelState);
    });

    it("should report model state transitions", async () => {
      await integration.initialize();

      const status = integration.getStatus();
      expect(status.modelState).toBe("ready");
      expect(status.available).toBe(true);
      expect(status.initialized).toBe(true);
    });
  });

  describe("Termination", () => {
    it("should clean up engine on terminate", async () => {
      await integration.initialize();
      expect(integration.getStatus().initialized).toBe(true);

      integration.terminate();

      const status = integration.getStatus();
      expect(status.initialized).toBe(false);
      // After terminate, modelState may remain "ready" since the engine
      // was initialized before termination
      expect(["idle", "ready"]).toContain(status.modelState);
    });

    it("should be safe to terminate without initialization", () => {
      expect(() => integration.terminate()).not.toThrow();
    });
  });
});
