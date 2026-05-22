/**
 * AI Engine - Motor de IA para Proof of Useful Work
 *
 * Usa Transformers.js para ejecutar modelos ML en el browser.
 * Generates verifiable proofs from AI computations.
 */

import { createLogger } from "@bitcoinbaby/shared";
import type { TextGenerationPipeline } from "@huggingface/transformers";

const log = createLogger("AIEngine");

// =============================================================================
// TYPES
// =============================================================================

export interface AITask {
  id: string;
  type: "text-generation" | "pouw";
  input: string;
  seed: string; // Hash del bloque de Bitcoin
  maxTokens?: number;
  model?: string;
}

export interface AIResult {
  taskId: string;
  output: string;
  computeTime: number;
  proof: string;
  verified: boolean;
}

export interface AIProof {
  taskId: string;
  taskType: string;
  inputPrompt: string;
  seed: string;
  output: string;
  computeTime: number;
  modelId: string;
  timestamp: number;
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
  private textGenerationPipeline: TextGenerationPipeline | null = null;
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

    log.info("Initializing Gemma 4 E2B AI Engine...");

    try {
      // Check WebGPU support first
      this.hasWebGPUSupport = await this.checkWebGPU();
      log.info(`WebGPU support detected: ${this.hasWebGPUSupport}`);

      // Dynamic import of Transformers.js
      const { pipeline, env } = await import("@huggingface/transformers");

      // Configure for browser usage
      env.allowLocalModels = false;
      env.useBrowserCache = this.config.cacheModels;

      // SEGURIDAD: En Transformers.js v3, la ejecución en navegador corre sobre ONNX Runtime Web.
      // No se utilizan archivos de pesos basados en PyTorch Pickle (.bin / .ckpt), los cuales
      // son vulnerables a RCE. ONNX provee una especificación puramente declarativa
      // de tensores matemáticos, eliminando la posibilidad de ejecución de código arbitrario.
      
      // Determine device
      const device =
        this.hasWebGPUSupport && this.config.preferWebGPU ? "webgpu" : "wasm";
      log.info(`Using device target: ${device}`);

      // Gemma 4 E2B (Effective 2B) optimized for edge/WebGPU
      this.currentModel = "onnx-community/gemma-4-E2B-it-ONNX";
      log.info(`Loading model weights: ${this.currentModel}`);

      // Safe cast of pipeline function to bypass TS2590 complex union type representation issue
      const pipelineFn = pipeline as unknown as (
        task: "text-generation",
        model: string,
        options?: {
          device?: string;
          dtype?: string;
        }
      ) => Promise<TextGenerationPipeline>;

      this.textGenerationPipeline = await pipelineFn(
        "text-generation",
        this.currentModel,
        {
          device,
          dtype: "q4", // Quantized in 4-bit (Safetensors ONNX format) for rapid WebGPU execution
        },
      );

      this.isInitialized = true;
      log.info("Gemma 4 E2B engine initialized successfully");
    } catch (error) {
      log.error("Gemma 4 initialization failed:", { error });
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
    let generatedText = "";

    try {
      if (task.type === "text-generation" || task.type === "pouw") {
        // Enforce deterministic execution via Greedy Search (do_sample: false, temperature: 0)
        // Combine prompt and block seed to vary the deterministic output per block task
        const combinedPrompt = `<bos><start_of_turn>user\n${task.input}\nContext Seed: ${task.seed}<end_of_turn>\n<start_of_turn>model\n`;

        if (!this.textGenerationPipeline) {
          throw new Error("Text generation pipeline not initialized");
        }

        const outputs = await this.textGenerationPipeline(combinedPrompt, {
          max_new_tokens: task.maxTokens || 48,
          temperature: 0.0,
          do_sample: false, // Greedy decoding ensures reproducibility across all nodes
        });

        // Extract the generated part
        const firstOutput = outputs[0] as unknown as { generated_text: string } | undefined;
        const fullOutput = firstOutput?.generated_text || "";
        generatedText = fullOutput.replace(combinedPrompt, "").trim();
      } else {
        throw new Error(`Unsupported task type: ${task.type}`);
      }
    } catch (error) {
      log.error("Gemma 4 task execution failed:", { error });
      throw error;
    }

    const computeTime = performance.now() - startTime;

    // Generate cryptographic PoUW proof containing input metadata and actual output
    const proof = await this.generateProof(task, generatedText, computeTime);

    log.info(
      `PoUW Task ${task.id} completed locally in ${computeTime.toFixed(2)}ms`,
    );

    return {
      taskId: task.id,
      output: generatedText,
      computeTime,
      proof,
      // Verification is done asynchronously on server side using Byzantine Consensus 2/3
      verified: false,
    };
  }

  /**
   * Generate proof of useful work
   * The proof contains hashes that can be verified
   */
  private async generateProof(
    task: AITask,
    output: string,
    computeTime: number,
  ): Promise<string> {
    const proofData: AIProof = {
      taskId: task.id,
      taskType: task.type,
      inputPrompt: task.input,
      seed: task.seed,
      output,
      computeTime,
      modelId: this.currentModel,
      timestamp: Date.now(),
    };

    const proofHash = await this.sha256(JSON.stringify(proofData));

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

  private async checkWebGPU(): Promise<boolean> {
    if (typeof navigator === "undefined") return false;
    if (!("gpu" in navigator)) return false;

    try {
      const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
      const adapter = await gpu?.requestAdapter();
      return adapter !== null;
    } catch {
      return false;
    }
  }

  /**
   * Verify a proof's structural integrity (hash match only).
   *
   * IMPORTANT: This only checks that the proof data has not been tampered
   * with (the hash matches). It does NOT verify that the AI computation
   * was actually performed correctly. Full verification requires server-side
   * re-execution of the inference to compare outputs.
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
   * Dispose of GPU/WebAssembly resources held by pipelines.
   *
   * Transformers.js pipelines allocate tensors (WebGPU/WebGL/WASM memory)
   * that are NOT garbage-collected. Without calling dispose(), these
   * resources leak — especially critical on mobile devices with limited
   * GPU memory.
   */
  dispose(): void {
    if (this.textGenerationPipeline) {
      this.textGenerationPipeline.dispose();
      this.textGenerationPipeline = null;
    }
    this.isInitialized = false;
    log.info("Disposed — GPU memory released");
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
  const prompts = [
    "Write a short lore entry about Baby learning how to read the Bitcoin blockchain.",
    "Describe the Genesis Baby's reaction to seeing the Bitcoin difficulty adjustment.",
    "Describe how a baby miner operates a tiny WebGPU mining rig in their crib.",
    "Write a story about a baby discovering Satoshi's whitepaper in their toy chest.",
  ];

  const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  const fakeBlockHash = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");

  return {
    id: `pouw-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type: "pouw",
    input: randomPrompt,
    seed: fakeBlockHash,
    maxTokens: 48,
  };
}

export function generateTaskBatch(count: number): AITask[] {
  return Array.from({ length: count }, () => generateSentimentTask());
}
