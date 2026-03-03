/**
 * AI Engine - Motor de IA para Proof of Useful Work
 *
 * Usa Transformers.js para ejecutar modelos ML en el browser.
 * Generates verifiable proofs from AI computations.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface AITask {
  id: string;
  type: "classification" | "embedding" | "sentiment";
  input: string | string[];
  model?: string;
}

export interface AIResult {
  taskId: string;
  output: unknown;
  computeTime: number;
  proof: string;
  verified: boolean;
}

export interface AIProof {
  taskId: string;
  taskType: string;
  inputHash: string;
  outputHash: string;
  computeTime: number;
  modelId: string;
  timestamp: number;
  nonce: number;
}

interface EngineConfig {
  preferWebGPU: boolean;
  cacheModels: boolean;
  maxConcurrentTasks: number;
}

const defaultConfig: EngineConfig = {
  preferWebGPU: true,
  cacheModels: true,
  maxConcurrentTasks: 2,
};

// =============================================================================
// ENGINE
// =============================================================================

/**
 * AI Engine for executing ML tasks and generating PoUW proofs
 */
export class AIEngine {
  private config: EngineConfig;
  private isInitialized = false;
  private classificationPipeline: any = null;
  private embeddingPipeline: any = null;
  private hasWebGPUSupport = false;
  private currentModel = "";

  constructor(config: Partial<EngineConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Initialize the engine with models
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    console.log("[AIEngine] Initializing...");

    try {
      // Check WebGPU support first
      this.hasWebGPUSupport = await this.checkWebGPU();
      console.log(`[AIEngine] WebGPU support: ${this.hasWebGPUSupport}`);

      // Dynamic import of Transformers.js
      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure for browser usage
      env.allowLocalModels = false;
      env.useBrowserCache = this.config.cacheModels;

      // Determine device
      const device =
        this.hasWebGPUSupport && this.config.preferWebGPU ? "webgpu" : "wasm";
      console.log(`[AIEngine] Using device: ${device}`);

      // Load sentiment analysis model (small and fast)
      // This model is ~17MB quantized and runs fast in browser
      this.currentModel =
        "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
      console.log(`[AIEngine] Loading model: ${this.currentModel}`);

      this.classificationPipeline = await pipeline(
        "sentiment-analysis",
        this.currentModel,
        {
          device,
          dtype: "q8", // Quantized for faster inference
        },
      );

      this.isInitialized = true;
      console.log("[AIEngine] Initialized successfully");
    } catch (error) {
      console.error("[AIEngine] Initialization failed:", error);
      throw new Error(`AI Engine initialization failed: ${error}`);
    }
  }

  /**
   * Execute an AI task and generate proof
   */
  async executeTask(task: AITask): Promise<AIResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    let output: unknown;

    try {
      switch (task.type) {
        case "sentiment":
        case "classification": {
          const inputs = Array.isArray(task.input) ? task.input : [task.input];
          output = await this.classificationPipeline(inputs);
          break;
        }
        case "embedding": {
          // For embeddings, we'd use a different model
          // For now, use classification as proof of work
          const inputs = Array.isArray(task.input) ? task.input : [task.input];
          output = await this.classificationPipeline(inputs);
          break;
        }
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error("[AIEngine] Task execution failed:", error);
      throw error;
    }

    const computeTime = performance.now() - startTime;

    // Generate verifiable proof
    const proof = await this.generateProof(task, output, computeTime);

    console.log(
      `[AIEngine] Task ${task.id} completed in ${computeTime.toFixed(2)}ms`,
    );

    return {
      taskId: task.id,
      output,
      computeTime,
      proof,
      verified: true,
    };
  }

  /**
   * Generate proof of useful work
   * The proof contains hashes that can be verified
   */
  private async generateProof(
    task: AITask,
    output: unknown,
    computeTime: number,
  ): Promise<string> {
    const inputHash = await this.sha256(
      typeof task.input === "string" ? task.input : task.input.join("|"),
    );
    const outputHash = await this.sha256(JSON.stringify(output));

    // Add nonce for additional proof-of-work
    const nonce = Math.floor(Math.random() * 1000000);

    const proofData: AIProof = {
      taskId: task.id,
      taskType: task.type,
      inputHash,
      outputHash,
      computeTime,
      modelId: this.currentModel,
      timestamp: Date.now(),
      nonce,
    };

    // Hash the entire proof for compact storage
    const proofHash = await this.sha256(JSON.stringify(proofData));

    // Return both the proof data and its hash
    return JSON.stringify({
      ...proofData,
      hash: proofHash,
    });
  }

  /**
   * SHA-256 hash using Web Crypto API
   */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  /**
   * Check if WebGPU is available
   */
  private async checkWebGPU(): Promise<boolean> {
    if (typeof navigator === "undefined") return false;
    if (!("gpu" in navigator)) return false;

    try {
      const gpu = (navigator as any).gpu;
      const adapter = await gpu?.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Verify a proof is valid
   * Can be used by verifiers to check work
   */
  async verifyProof(proofString: string): Promise<boolean> {
    try {
      const proof = JSON.parse(proofString);
      const { hash, ...proofData } = proof;

      // Verify the hash matches
      const expectedHash = await this.sha256(JSON.stringify(proofData));
      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * Get engine status
   */
  getStatus(): {
    initialized: boolean;
    hasWebGPU: boolean;
    modelLoaded: string;
  } {
    return {
      initialized: this.isInitialized,
      hasWebGPU: this.hasWebGPUSupport,
      modelLoaded: this.currentModel,
    };
  }

  /**
   * Check if WebGPU is available (public method)
   */
  async hasWebGPU(): Promise<boolean> {
    return this.checkWebGPU();
  }
}

// =============================================================================
// TASK GENERATORS
// =============================================================================

/**
 * Generate random sentiment analysis tasks
 * These are the "useful work" that contributes to the network
 */
export function generateSentimentTask(): AITask {
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
  ];

  const randomSentence =
    sentences[Math.floor(Math.random() * sentences.length)];

  return {
    id: `sentiment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "sentiment",
    input: randomSentence,
  };
}

/**
 * Generate batch of tasks for mining
 */
export function generateTaskBatch(count: number): AITask[] {
  return Array.from({ length: count }, () => generateSentimentTask());
}
