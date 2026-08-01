/**
 * AI Work Integration for Proof of Useful Work (PoUW)
 *
 * Integrates external AI providers (Gemini, OpenAI, Anthropic, Ollama)
 * with the mining system. Requires a configured AI provider in Settings.
 *
 * Flow:
 *   1. User configures AI provider in Settings → AIProviderStore
 *   2. Mining starts → AIWorkIntegration reads config + decrypts API key
 *   3. AI loop generates creative prompts → external API → AI output
 *   4. Output is hashed as a verifiable proof → forwarded to narrative pipeline
 */

import { AITask, AIProof, AIStatus } from "./types";
export { type AIStatus } from "./types";
import { createLogger } from "@bitcoinbaby/shared";
import { useAIProviderStore } from "../stores/ai-provider-store";

// Lazily imported from @bitcoinbaby/ai (tree-shaken, no heavy deps)
let _AIOrchestrator: typeof import("@bitcoinbaby/ai").AIOrchestrator | null =
  null;
let _NarrativeEngine: typeof import("@bitcoinbaby/ai").NarrativeEngine | null =
  null;

const log = createLogger("AIIntegration");

// =============================================================================
// TYPES
// =============================================================================

export interface AIWorkResult {
  success: boolean;
  taskId: string;
  proof?: string;
  computeTime?: number;
  error?: string;
  /** The generated text output (for narrative processing at UI layer) */
  output?: string;
  /** Which backend generated this output */
  modelUsed?: string;
}

export interface AIIntegrationConfig {
  enabled: boolean;
  taskFrequency: number;
  taskTimeout: number;
}

const defaultConfig: AIIntegrationConfig = {
  enabled: true,
  taskFrequency: 1,
  taskTimeout: 30000,
};

// =============================================================================
// AI WORK INTEGRATION
// =============================================================================

export class AIWorkIntegration {
  private config: AIIntegrationConfig;
  private orchestrator: any = null; // AIOrchestrator
  private narrativeEngine: any = null; // NarrativeEngine
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private tasksCompleted = 0;
  private lastError?: string;
  private shareCounter = 0;
  private providerName = "none";
  private providerModel = "";

  private modelState: "idle" | "loading" | "ready" | "error" = "idle";
  private onStatusChange?: (status: AIStatus) => void;

  constructor(
    config: Partial<AIIntegrationConfig> = {},
    onStatusChange?: (status: AIStatus) => void,
  ) {
    this.config = { ...defaultConfig, ...config };
    this.onStatusChange = onStatusChange;
  }

  // ===========================================================================
  // INITIALIZATION
  // ===========================================================================

  async initialize(): Promise<void> {
    if (this.orchestrator) return;
    if (this.initPromise) return this.initPromise;

    this.isInitializing = true;
    this.initPromise = this._doInitialize();

    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
      this.initPromise = null;
    }
  }

  private notifyStatusChange(): void {
    if (this.onStatusChange) {
      this.onStatusChange(this.getStatus());
    }
  }

  private async _doInitialize(): Promise<void> {
    try {
      log.debug("Initializing AI integration (external providers)...");
      this.modelState = "loading";
      this.notifyStatusChange();

      // Load the AI package (tree-shaken — only pulls what we need)
      const aiModule = await import("@bitcoinbaby/ai");
      _AIOrchestrator = aiModule.AIOrchestrator;
      _NarrativeEngine = aiModule.NarrativeEngine;

      // Check for configured AI provider
      const providerState = useAIProviderStore.getState();
      const orchestratorConfig = await providerState.getOrchestratorConfig();

      if (orchestratorConfig && providerState.isConfigured()) {
        log.info("Configuring AI provider", {
          provider: orchestratorConfig.id,
          model: orchestratorConfig.model,
        });

        this.orchestrator = new _AIOrchestrator();
        await this.orchestrator.configure(orchestratorConfig);
        this.providerName = orchestratorConfig.id;
        this.providerModel = orchestratorConfig.model || "";
      } else {
        log.info("No AI provider configured — mining requires API setup");
        this.providerName = "not-configured";
        this.providerModel = "";
      }

      // Create NarrativeEngine for story processing
      this.narrativeEngine = new _NarrativeEngine();

      if (!this.orchestrator) {
        this.modelState = "error";
        this.lastError =
          "No AI provider configured. Go to Settings → AI Provider.";
        this.notifyStatusChange();
        return;
      }

      this.modelState = "ready";
      log.info("AI integration ready", {
        provider: this.providerName,
        model: this.providerModel,
      });
      this.notifyStatusChange();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown AI init error";
      log.warn("Failed to initialize AI integration", { error: message });
      this.lastError = message;
      this.modelState = "error";
      this.notifyStatusChange();
    }
  }

  // ===========================================================================
  // AVAILABILITY
  // ===========================================================================

  isAvailable(): boolean {
    return this.config.enabled && !!this.orchestrator;
  }

  // ===========================================================================
  // SHARE FOUND HANDLER
  // ===========================================================================

  async onShareFound(forceExecute = false): Promise<AIWorkResult | null> {
    if (!this.config.enabled) return null;

    this.shareCounter++;
    if (!forceExecute && this.shareCounter % this.config.taskFrequency !== 0) {
      return null;
    }

    // Lazy initialize
    if (!this.orchestrator && !this.isInitializing) {
      await this.initialize();
    }

    if (!this.orchestrator) {
      return {
        success: false,
        taskId: "none",
        error: this.lastError || "AI not available",
      };
    }

    return this.executeTask();
  }

  // ===========================================================================
  // TASK EXECUTION
  // ===========================================================================

  async executeTask(task?: AITask): Promise<AIWorkResult> {
    const taskToExecute = task || this.generateDefaultAITask();

    try {
      if (!this.orchestrator) {
        return {
          success: false,
          taskId: taskToExecute.id,
          error: "No AI provider configured. Go to Settings → AI Provider.",
        };
      }

      const startTime = performance.now();
      const response = (await this.executeWithTimeout(
        this.orchestrator.execute(
          taskToExecute.input,
          "You are a creative AI generating stories for a Bitcoin-themed virtual pet game. Keep responses under 200 words.",
        ),
      )) as { text: string; provider: string; model: string };
      const output = response.text;
      const modelUsed = `${response.provider}/${response.model}`;
      const computeTime = performance.now() - startTime;

      const proof = await this.generateProof(
        taskToExecute,
        output,
        computeTime,
        modelUsed,
      );
      this.tasksCompleted++;

      return {
        success: true,
        taskId: taskToExecute.id,
        proof,
        computeTime,
        output,
        modelUsed,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Task execution failed";
      this.lastError = message;
      log.warn("AI task failed", { error: message });

      return {
        success: false,
        taskId: taskToExecute.id,
        error: message,
      };
    }
  }

  // ===========================================================================
  // PROOF GENERATION
  // ===========================================================================

  private async generateProof(
    task: AITask,
    output: string,
    computeTime: number,
    modelId: string,
  ): Promise<string> {
    const proofData: AIProof = {
      taskId: task.id,
      taskType: task.type,
      inputPrompt: task.input,
      seed: task.seed,
      output,
      computeTime,
      modelId,
      timestamp: Date.now(),
    };

    // Cryptographic hash via Web Crypto
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(JSON.stringify(proofData)),
    );
    const hash = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return JSON.stringify({ ...proofData, hash });
  }

  // ===========================================================================
  // TIMEOUT PROTECTION
  // ===========================================================================

  private async executeWithTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`AI task timed out after ${this.config.taskTimeout}ms`),
        );
      }, this.config.taskTimeout);

      promise
        .then((result) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  // ===========================================================================
  // DEFAULT TASK GENERATION
  // ===========================================================================

  /** @internal - exposed for testing */
  generateDefaultAITask(): AITask {
    const prompts = [
      "A baby spark explores a new block on the Bitcoin blockchain. Describe what it discovers.",
      "The spark meets a mysterious miner in the mempool. What happens?",
      "A rainbow-colored transaction appears in the spark's nursery. Describe the scene.",
      "The spark levels up after solving a complex hash puzzle. Describe its transformation.",
      "Two sparks compete to validate the same block. Write a short story about their rivalry.",
      "An ancient Bitcoin whale visits the spark's playground. What wisdom does it share?",
      "The spark discovers a hidden message in a coinbase transaction. What does it say?",
      "A lightning channel opens near the spark's home. Describe the celebration.",
      "The spark dreams about Satoshi. What does the dream reveal?",
      "A difficult fork threatens the spark's chain. How does the spark help resolve it?",
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    return {
      id: `pouw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "pouw",
      input: randomPrompt,
      seed: Array.from({ length: 16 }, () =>
        Math.floor(Math.random() * 256)
          .toString(16)
          .padStart(2, "0"),
      ).join(""),
    };
  }

  // ===========================================================================
  // STATUS
  // ===========================================================================

  getStatus(): AIStatus {
    return {
      available: this.config.enabled,
      initialized: this.modelState === "ready",
      hasWebGPU: false, // External APIs don't need WebGPU
      modelLoaded: this.providerName
        ? `${this.providerName}${this.providerModel ? ` (${this.providerModel})` : ""}`
        : "none",
      tasksCompleted: this.tasksCompleted,
      lastError: this.lastError,
      modelState: this.modelState,
      downloadProgress: this.modelState === "ready" ? 100 : 0,
      downloadDetails: undefined,
    };
  }

  // ===========================================================================
  // CONFIGURATION
  // ===========================================================================

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  setTaskFrequency(frequency: number): void {
    this.config.taskFrequency = Math.max(1, frequency);
  }

  getTasksCompleted(): number {
    return this.tasksCompleted;
  }

  /** Get the current AI provider name (for UI display) */
  getProviderName(): string {
    return this.providerName;
  }

  /** Get the current AI model name (for UI display) */
  getProviderModel(): string {
    return this.providerModel;
  }

  // ===========================================================================
  // CLEANUP
  // ===========================================================================

  terminate(): void {
    if (this.orchestrator && typeof this.orchestrator.dispose === "function") {
      this.orchestrator.dispose();
    }
    this.orchestrator = null;
    this.narrativeEngine = null;
    this.isInitializing = false;
    this.initPromise = null;
    log.debug("Terminated");
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let globalAIIntegration: AIWorkIntegration | null = null;

export function getAIIntegration(
  config?: Partial<AIIntegrationConfig>,
): AIWorkIntegration {
  if (!globalAIIntegration) {
    globalAIIntegration = new AIWorkIntegration(config);
  }
  return globalAIIntegration;
}

export function destroyAIIntegration(): void {
  globalAIIntegration?.terminate();
  globalAIIntegration = null;
}
