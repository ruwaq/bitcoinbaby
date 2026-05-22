/**
 * AI Engine Unit Tests
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { AIEngine, generateSentimentTask, generateTaskBatch } from "./engine";

vi.mock("@huggingface/transformers", () => {
  const mockPipelineFn = vi.fn().mockImplementation(async (prompt: string, _options?: unknown) => {
    return [{ generated_text: `${prompt} -> simulated-output` }];
  });
  // Add dispose property to the mock function
  (mockPipelineFn as any).dispose = vi.fn();

  return {
    pipeline: vi.fn().mockImplementation(async (_taskType: string, _modelName: string, _options?: unknown) => {
      return mockPipelineFn;
    }),
    env: {
      allowLocalModels: true,
      useBrowserCache: true,
    },
  };
});

describe("AIEngine", () => {
  let engine: AIEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AIEngine({
      preferWebGPU: false, // WASM for testing environment
      cacheModels: false,
    });
  });

  describe("Constructor", () => {
    it("should instantiate with default configuration", () => {
      const defaultEngine = new AIEngine();
      const status = defaultEngine.getStatus();
      expect(status.initialized).toBe(false);
      expect(status.modelLoaded).toBe("");
    });
  });

  describe("Initialization & Lifecycle", () => {
    it("should initialize pipeline correctly", async () => {
      await engine.initialize();
      const status = engine.getStatus();
      expect(status.initialized).toBe(true);
      expect(status.modelLoaded).toBe("onnx-community/gemma-4-E2B-it-ONNX");
    });

    it("should dispose resources and reset state", async () => {
      await engine.initialize();
      expect(engine.getStatus().initialized).toBe(true);

      engine.dispose();
      expect(engine.getStatus().initialized).toBe(false);
    });
  });

  describe("Task Execution", () => {
    it("should execute task and return deterministically generated output and valid proof", async () => {
      await engine.initialize();
      const task = {
        id: "task-123",
        type: "pouw" as const,
        input: "Test input prompt",
        seed: "block-hash-abc",
        maxTokens: 10,
      };

      const result = await engine.executeTask(task);

      expect(result.taskId).toBe(task.id);
      expect(result.output).toBeDefined();
      expect(result.output).toContain("simulated-output");
      expect(result.proof).toBeDefined();
      expect(result.verified).toBe(false); // Verified false initially before Byzantine consensus
    });
  });

  describe("Proof Verification", () => {
    it("should verify correct proof structured data", async () => {
      await engine.initialize();
      const task = {
        id: "task-456",
        type: "pouw" as const,
        input: "Verify this prompt",
        seed: "block-hash-xyz",
      };

      const result = await engine.executeTask(task);
      const isVerified = await engine.verifyProof(result.proof);
      expect(isVerified).toBe(true);
    });

    it("should reject tampered proofs", async () => {
      await engine.initialize();
      const task = {
        id: "task-789",
        type: "pouw" as const,
        input: "Tamper test prompt",
        seed: "block-hash-123",
      };

      const result = await engine.executeTask(task);
      
      // Parse, tamper the output, and re-stringified
      const parsedProof = JSON.parse(result.proof);
      parsedProof.output = "Tampered output content";
      const tamperedProofString = JSON.stringify(parsedProof);

      const isVerified = await engine.verifyProof(tamperedProofString);
      expect(isVerified).toBe(false);
    });
  });
});

describe("Task Generators", () => {
  describe("generateSentimentTask", () => {
    it("should generate a valid AITask with random content", () => {
      const task = generateSentimentTask();
      expect(task.id).toContain("pouw-");
      expect(task.type).toBe("pouw");
      expect(task.input).toBeDefined();
      expect(task.seed).toHaveLength(64); // Fake block hash length
    });
  });

  describe("generateTaskBatch", () => {
    it("should generate a batch of tasks with correct count", () => {
      const count = 5;
      const batch = generateTaskBatch(count);
      expect(batch).toHaveLength(count);
      batch.forEach((task) => {
        expect(task.type).toBe("pouw");
        expect(task.seed).toHaveLength(64);
      });
    });
  });
});
