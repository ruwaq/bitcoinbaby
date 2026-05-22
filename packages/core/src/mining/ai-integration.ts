/**
 * AI Work Integration for Proof of Useful Work (PoUW)
 *
 * Integrates the AI Engine with the mining system to execute
 * useful AI tasks alongside traditional PoW mining.
 *
 * IMPORTANT: AI work is OPTIONAL - if it fails, mining continues normally.
 * AI tasks run asynchronously and don't block the mining loop.
 *
 * NOTE: This module uses fully dynamic imports to avoid bundling
 * the AI package (which has Node.js-only dependencies) into the browser build.
 *
 * ============================================================================
 * SECURITY WARNING - NOT PRODUCTION READY
 * ============================================================================
 *
 * This AI PoUW implementation is EXPERIMENTAL and lacks server-side
 * verification. Without backend validation:
 *
 * 1. AI proofs can be spoofed (client-side only verification)
 * 2. Tasks use a static pool (not randomized server-side)
 * 3. Users can claim rewards without performing real AI work
 *
 * DO NOT ENABLE in production until server-side verification is implemented.
 * See: docs/SECURITY_AUDIT_2026-03-08.md for details.
 *
 * Required for production:
 * - Backend generates unique tasks with nonces
 * - Backend re-executes AI inference to verify outputs
 * - Task pool is randomized per-request from server
 * ============================================================================
 */

import { AITask, AIProof, AIStatus } from "./types";
import type { AIProgressData } from "@bitcoinbaby/ai";

/** AI Result definition (matches @bitcoinbaby/ai) */
interface AIResult {
  taskId: string;
  output: string;
  computeTime: number;
  proof: string;
  verified: boolean;
}

import { createLogger } from "@bitcoinbaby/shared";

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
}

export interface AIIntegrationConfig {
  /** Enable AI work alongside mining (default: true) */
  enabled: boolean;
  /** Execute AI task on every N shares found (default: 1) */
  taskFrequency: number;
  /** Timeout for AI tasks in ms (default: 30000) */
  taskTimeout: number;
  /** Prefer WebGPU for AI inference (default: true) */
  preferWebGPU: boolean;
}

const defaultConfig: AIIntegrationConfig = {
  enabled: true,
  taskFrequency: 1,
  taskTimeout: 30000,
  preferWebGPU: true,
};

// =============================================================================
// AI WORK INTEGRATION
// =============================================================================

/**
 * AIWorkIntegration - Manages AI task execution alongside mining
 *
 * Uses dynamic imports to load the AI package only when needed,
 * ensuring mining works even if AI dependencies aren't available.
 */
export class AIWorkIntegration {
  private config: AIIntegrationConfig;
  private engine: any = null; // AIEngine type, loaded dynamically
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private tasksCompleted = 0;
  private lastError?: string;
  private shareCounter = 0;
  
  private modelState: "idle" | "loading" | "ready" | "error" = "idle";
  private downloadProgress = 0;
  private downloadDetails?: { file?: string; loaded?: number; total?: number };
  private onStatusChange?: (status: AIStatus) => void;

  constructor(
    config: Partial<AIIntegrationConfig> = {},
    onStatusChange?: (status: AIStatus) => void,
  ) {
    this.config = { ...defaultConfig, ...config };
    this.onStatusChange = onStatusChange;
  }

  /**
   * Initialize the AI engine
   * Uses dynamic import to load @bitcoinbaby/ai only if available
   */
  async initialize(): Promise<void> {
    if (this.engine) return;
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
      log.debug("Loading AI package...");
      this.modelState = "loading";
      this.downloadProgress = 0;
      this.notifyStatusChange();

      // Dynamic import — AI package is optional and loaded at runtime only.
      // Uses a variable to prevent bundlers from statically resolving the import.
      // This replaces the previous new Function() pattern which was a code
      // injection vector. The package name is a hardcoded constant, so this
      // is safe — but if it ever becomes configurable, add whitelist validation.
      const aiModule = await import("@bitcoinbaby/ai");
      const { AIEngine } = aiModule;

      // Create and initialize the engine
      this.engine = new AIEngine({
        preferWebGPU: this.config.preferWebGPU,
        cacheModels: true,
        maxConcurrentTasks: 1, // Keep it simple for mining integration
      });

      await this.engine.initialize((progressData: AIProgressData) => {
        this.downloadProgress = progressData.progress;
        this.downloadDetails = {
          file: progressData.file,
          loaded: progressData.loaded,
          total: progressData.total,
        };
        this.notifyStatusChange();
      });

      this.modelState = "ready";
      this.downloadProgress = 100;
      log.info("AI Engine initialized successfully");
      this.notifyStatusChange();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown AI init error";
      log.warn("Failed to initialize AI", { error: message });
      this.lastError = message;
      this.engine = null;
      this.modelState = "error";
      this.notifyStatusChange();
      // Don't throw - AI is optional
    }
  }

  /**
   * Check if AI work is available
   */
  isAvailable(): boolean {
    return this.engine !== null && this.config.enabled;
  }

  /**
   * Execute an AI task if conditions are met
   * Called after a mining share is found
   *
   * @param forceExecute - Execute regardless of frequency counter
   * @returns AI work result or null if skipped
   */
  async onShareFound(forceExecute = false): Promise<AIWorkResult | null> {
    if (!this.config.enabled) return null;

    // Increment share counter and check frequency
    this.shareCounter++;
    if (!forceExecute && this.shareCounter % this.config.taskFrequency !== 0) {
      return null;
    }

    // Initialize if not done yet (lazy initialization)
    if (!this.engine && !this.isInitializing) {
      await this.initialize();
    }

    // If still no engine after init attempt, skip
    if (!this.engine) {
      return {
        success: false,
        taskId: "none",
        error: this.lastError || "AI engine not available",
      };
    }

    return this.executeTask();
  }

  /**
   * Execute a single AI task
   */
  async executeTask(task?: AITask): Promise<AIWorkResult> {
    if (!this.engine) {
      return {
        success: false,
        taskId: "none",
        error: "AI engine not initialized",
      };
    }

    try {
      // Use provided task or generate a default one
      const taskToExecute = task || this.generateDefaultAITask();

      // Execute with timeout
      const result = await this.executeWithTimeout(taskToExecute);

      this.tasksCompleted++;

      return {
        success: true,
        taskId: result.taskId,
        proof: result.proof,
        computeTime: result.computeTime,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Task execution failed";
      this.lastError = message;
      log.warn("Task failed", { error: message });

      return {
        success: false,
        taskId: "error",
        error: message,
      };
    }
  }

  /**
   * Execute task with timeout protection
   */
  private async executeWithTimeout(task: AITask): Promise<AIResult> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`AI task timed out after ${this.config.taskTimeout}ms`),
        );
      }, this.config.taskTimeout);

      this.engine
        .executeTask(task)
        .then((result: AIResult) => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch((error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }

  /**
   * Generate a default AI PoUW task
   */
  private generateDefaultAITask(): AITask {
    const prompts = [
      "Explain the importance of decentralization in public blockchains.",
      "Summarize how Proof of Useful Work helps reduce carbon footprint.",
      "Write a short pixel-art description of a cyber baby learning AI.",
      "How does WebGPU enable local neural network inference in browsers?",
      "Design a virtual gym workout routine for a Bitcoin Baby."
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];

    return {
      id: `pouw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "pouw",
      input: randomPrompt,
      seed: Math.random().toString(16).slice(2),
    };
  }

  /**
   * Get current AI integration status
   */
  getStatus(): AIStatus {
    if (!this.engine) {
      return {
        available: false,
        initialized: false,
        hasWebGPU: false,
        modelLoaded: "",
        tasksCompleted: this.tasksCompleted,
        lastError: this.lastError,
        modelState: this.modelState,
        downloadProgress: this.downloadProgress,
        downloadDetails: this.downloadDetails,
      };
    }

    const engineStatus = this.engine.getStatus();
    return {
      available: this.config.enabled,
      initialized: engineStatus.initialized,
      hasWebGPU: engineStatus.hasWebGPU,
      modelLoaded: engineStatus.modelLoaded,
      tasksCompleted: this.tasksCompleted,
      lastError: this.lastError,
      modelState: this.modelState,
      downloadProgress: this.downloadProgress,
      downloadDetails: this.downloadDetails,
    };
  }

  /**
   * Enable or disable AI work
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Set task frequency (every N shares)
   */
  setTaskFrequency(frequency: number): void {
    this.config.taskFrequency = Math.max(1, frequency);
  }

  /**
   * Get total tasks completed
   */
  getTasksCompleted(): number {
    return this.tasksCompleted;
  }

  /**
   * Cleanup resources
   */
  terminate(): void {
    // Release GPU/WebAssembly memory before dereferencing the engine
    if (this.engine && typeof this.engine.dispose === "function") {
      this.engine.dispose();
    }
    this.engine = null;
    this.isInitializing = false;
    this.initPromise = null;
    log.debug("Terminated");
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let globalAIIntegration: AIWorkIntegration | null = null;

/**
 * Get the global AI integration instance
 */
export function getAIIntegration(
  config?: Partial<AIIntegrationConfig>,
): AIWorkIntegration {
  if (!globalAIIntegration) {
    globalAIIntegration = new AIWorkIntegration(config);
  }
  return globalAIIntegration;
}

/**
 * Destroy the global AI integration instance
 */
export function destroyAIIntegration(): void {
  globalAIIntegration?.terminate();
  globalAIIntegration = null;
}
