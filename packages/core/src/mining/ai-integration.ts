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
 */

// Types are defined locally to avoid importing from @bitcoinbaby/ai at build time
// The actual types are compatible with the AI package

/** AI Task definition (matches @bitcoinbaby/ai) */
interface AITask {
  id: string;
  type: "classification" | "embedding" | "sentiment";
  input: string | string[];
  model?: string;
}

/** AI Result definition (matches @bitcoinbaby/ai) */
interface AIResult {
  taskId: string;
  output: unknown;
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

export interface AIStatus {
  available: boolean;
  initialized: boolean;
  hasWebGPU: boolean;
  modelLoaded: string;
  tasksCompleted: number;
  lastError?: string;
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

  constructor(config: Partial<AIIntegrationConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
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

  private async _doInitialize(): Promise<void> {
    try {
      log.debug("Loading AI package...");

      // Use dynamic import with variable to prevent webpack from bundling
      // This ensures the AI package is truly optional and loaded at runtime only
      const packageName = "@bitcoinbaby/ai";
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const importFn = new Function("p", "return import(p)");
      const aiModule = await (importFn as (p: string) => Promise<any>)(
        packageName,
      );
      const { AIEngine } = aiModule;

      // Create and initialize the engine
      this.engine = new AIEngine({
        preferWebGPU: this.config.preferWebGPU,
        cacheModels: true,
        maxConcurrentTasks: 1, // Keep it simple for mining integration
      });

      await this.engine.initialize();
      log.info("AI Engine initialized successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown AI init error";
      log.warn("Failed to initialize AI", { error: message });
      this.lastError = message;
      this.engine = null;
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
  async executeTask(): Promise<AIWorkResult> {
    if (!this.engine) {
      return {
        success: false,
        taskId: "none",
        error: "AI engine not initialized",
      };
    }

    try {
      // Generate a random sentiment analysis task
      const task = this.generateSentimentTask();

      // Execute with timeout
      const result = await this.executeWithTimeout(task);

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
   * Generate a sentiment analysis task
   * These tasks contribute to training collective sentiment models
   */
  private generateSentimentTask(): AITask {
    const sentences = [
      "The new Bitcoin update brings exciting features to the ecosystem.",
      "I'm concerned about the recent market volatility.",
      "This project has incredible potential for the future.",
      "The community support for this initiative is overwhelming.",
      "Technical challenges remain, but progress is being made.",
      "Innovation in blockchain continues to accelerate.",
      "The user experience could definitely be improved.",
      "Great progress on the development roadmap today!",
      "Security concerns need to be addressed urgently.",
      "The team is doing an amazing job with this release.",
      "Decentralization is the key to financial freedom.",
      "The network hashrate has reached new all-time highs.",
      "Mining rewards are helping secure the network.",
      "Baby's first Bitcoin transaction was a success!",
      "The proof of useful work concept is revolutionary.",
    ];

    const randomSentence =
      sentences[Math.floor(Math.random() * sentences.length)];

    return {
      id: `pouw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "sentiment",
      input: randomSentence,
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
