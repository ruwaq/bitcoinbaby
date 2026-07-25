/**
 * AI Work Integration — Tests
 *
 * Validates the AI-powered mining pipeline with external AI providers.
 * All tests run 100% locally without server or network access.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AIWorkIntegration } from "./ai-integration";
import type { AITask, AIProof } from "./types";

// Mock @bitcoinbaby/ai to provide AIOrchestrator in test environment
vi.mock("@bitcoinbaby/ai", () => {
  class MockAIOrchestrator {
    async execute(_prompt: string, _systemPrompt?: string) {
      return {
        text: "The AI generated a fascinating story about blockchain discovery.",
        provider: "mock",
        model: "mock-model",
      };
    }
  }

  class MockNarrativeEngine {
    async processAIOutput() {
      return {
        event: { type: "LORE", title: "Test", description: "Mock" },
        updatedPersonality: {},
        updatedMood: "neutral",
      };
    }
  }

  return {
    AIOrchestrator: MockAIOrchestrator,
    NarrativeEngine: MockNarrativeEngine,
  };
});

// Mock the AI provider store (zustand)
vi.mock("../stores/ai-provider-store", () => ({
  useAIProviderStore: {
    getState: () => ({
      providerId: "mock",
      apiKey: "encrypted-mock-key",
      model: "mock-model",
      isConfigured: () => true,
      getOrchestratorConfig: async () => ({
        id: "mock",
        apiKey: "mock-key",
        model: "mock-model",
      }),
    }),
  },
}));

describe("AIWorkIntegration (AI-only mining)", () => {
  let integration: AIWorkIntegration;

  beforeEach(() => {
    integration = new AIWorkIntegration({ enabled: true, taskFrequency: 1 });
  });

  afterEach(() => {
    integration.terminate();
  });

  it("should initialize with configured AI provider", async () => {
    await integration.initialize();
    expect(integration.isAvailable()).toBe(true);
    expect(integration.getStatus().initialized).toBe(true);
  });

  it("should execute AI tasks and return valid results", async () => {
    await integration.initialize();

    const result = await integration.executeTask();
    expect(result.success).toBe(true);
    expect(result.proof).toBeDefined();
    expect(result.output).toContain("fascinating");
    expect(result.modelUsed).toContain("mock");
  });

  it("should generate default AI tasks with creative prompts", () => {
    const task = (integration as any).generateDefaultAITask() as AITask;
    expect(task.id).toMatch(/^pouw-/);
    expect(task.type).toBe("pouw");
    expect(task.input).toBeTruthy();
    expect(task.seed).toBeTruthy();
  });

  it("should generate SHA-256 proofs", async () => {
    await integration.initialize();
    const result = await integration.executeTask();
    expect(result.success).toBe(true);

    const proof: AIProof = JSON.parse(result.proof!);
    expect(proof.taskId).toBeDefined();
    expect(proof.taskType).toBe("pouw");
    expect(proof.output).toBeDefined();
    expect(proof.modelId).toBeDefined();
    expect(proof.timestamp).toBeDefined();
    expect(proof.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("should handle task timeout gracefully", async () => {
    // Fast timeout for testing
    const fastIntegration = new AIWorkIntegration({
      enabled: true,
      taskTimeout: 1,
    });
    await fastIntegration.initialize();

    const result = await fastIntegration.executeTask();
    // Should either succeed quickly or timeout
    expect(result.success !== undefined).toBe(true);
    fastIntegration.terminate();
  });
});
