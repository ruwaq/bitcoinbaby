/**
 * Cloudflare Workers AI Backend
 *
 * Uses Cloudflare's global edge GPU network for LLM inference.
 * No model download — pure HTTP API with ~200-800ms latency.
 *
 * Models available (free tier, 10k Neurons/day):
 *   @cf/google/gemma-2b-it-lora (Gemma 2B, ~20-40 neurons/request)
 *   @cf/meta/llama-3.2-1b-instruct (Llama 3.2 1B, fast + free)
 *
 * The API key is NOT embedded here. Requests go through a Cloudflare Worker
 * proxy at BITCOINSPARK_AI_PROXY_URL (set via env/config), which injects
 * the key server-side so it never reaches the browser.
 */

import { createLogger } from "@bitcoinbaby/shared";
import type { AITask, AIResult, AIProof } from "./types";

const log = createLogger("CloudflareAI");

// =============================================================================
// TYPES
// =============================================================================

export interface CloudflareAIConfig {
  /** Cloudflare Worker proxy URL (protects API key) */
  proxyUrl?: string;
  /** Model to use. Default: @cf/meta/llama-3.2-1b-instruct (fastest free tier) */
  model?: string;
  /** Max tokens for generation */
  maxTokens?: number;
  /** Temperature (0-1), lower = more deterministic */
  temperature?: number;
}

export interface AIProgressData {
  progress: number;
  loaded: number;
  total: number;
  status: string;
  file: string;
  filesCount: number;
  doneCount: number;
}

export interface ModelChainEntryStatus {
  id: string;
  name: string;
  status: "pending" | "loading" | "loaded" | "failed";
  error?: string;
}

/** Models available in Cloudflare Workers AI free tier (May 2026) */
const AVAILABLE_MODELS = [
  {
    id: "llama-3.2-1b",
    name: "@cf/meta/llama-3.2-1b-instruct",
    displayName: "Llama 3.2 1B",
    maxOutputTokens: 512,
  },
  {
    id: "gemma-2b",
    name: "@cf/google/gemma-2b-it-lora",
    displayName: "Gemma 2B",
    maxOutputTokens: 512,
  },
];

/** Default proxy URL — set via VITE_CLOUDFLARE_AI_PROXY or build-time config */
const DEFAULT_PROXY_URL =
  (typeof globalThis !== "undefined" &&
    (globalThis as any).process?.env?.BITCOINSPARK_AI_PROXY_URL) ||
  "";

// =============================================================================
// ENGINE
// =============================================================================

export class CloudflareAIEngine {
  private config: Required<Omit<CloudflareAIConfig, "proxyUrl">> & {
    proxyUrl: string;
  };
  private isInitialized = false;
  private abortController: AbortController | null = null;
  private totalRequests = 0;
  private failedRequests = 0;
  private averageLatency = 0;

  constructor(config: CloudflareAIConfig = {}) {
    this.config = {
      proxyUrl: config.proxyUrl || DEFAULT_PROXY_URL,
      model: config.model || "@cf/meta/llama-3.2-1b-instruct",
      maxTokens: config.maxTokens ?? 64,
      temperature: config.temperature ?? 0.7,
    };
  }

  /**
   * Initialize — validates the proxy is reachable.
   * Resolves in <2s (single health check HTTP request).
   */
  async initialize(onProgress?: (data: AIProgressData) => void): Promise<void> {
    if (this.isInitialized) return;

    log.info("Initializing Cloudflare Workers AI backend...");

    onProgress?.({
      progress: 10,
      loaded: 0,
      total: 0,
      status: "initiate",
      file: "cloudflare-proxy-check",
      filesCount: 1,
      doneCount: 0,
    });

    this.abortController = new AbortController();

    try {
      // Validate proxy is reachable
      if (this.config.proxyUrl) {
        const resp = await fetch(`${this.config.proxyUrl}/api/ai/health`, {
          signal: this.abortController.signal,
        });
        if (!resp.ok) {
          throw new Error(`Proxy health check failed: ${resp.status}`);
        }
      }

      onProgress?.({
        progress: 100,
        loaded: 0,
        total: 0,
        status: "done",
        file: "cloudflare-proxy-check",
        filesCount: 1,
        doneCount: 1,
      });

      this.isInitialized = true;
      log.info("Cloudflare Workers AI ready", {
        model: this.config.model,
        proxyConfigured: !!this.config.proxyUrl,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown";
      log.warn("Cloudflare AI init failed (network/proxy issue)", {
        error: msg,
      });
      throw error; // Let the caller fall back to next tier
    }
  }

  /**
   * Execute a task via Cloudflare Workers AI API.
   */
  async executeTask(task: AITask): Promise<AIResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();
    const signal = this.abortController?.signal;

    try {
      const prompt = this.buildPrompt(task);
      const response = await this.callAPI(prompt, signal);
      const computeTime = performance.now() - startTime;

      this.totalRequests++;
      this.averageLatency =
        (this.averageLatency * (this.totalRequests - 1) + computeTime) /
        this.totalRequests;

      const proofData: AIProof = {
        taskId: task.id,
        taskType: task.type,
        inputPrompt: task.input,
        seed: task.seed,
        output: response,
        computeTime,
        modelId: this.config.model,
        timestamp: Date.now(),
      };

      const proofHash = await this.sha256(JSON.stringify(proofData));
      const proof = JSON.stringify({ ...proofData, hash: proofHash });

      return {
        taskId: task.id,
        output: response,
        computeTime,
        proof,
        verified: false,
      };
    } catch (error) {
      this.failedRequests++;
      const msg = error instanceof Error ? error.message : "API error";
      log.warn("Cloudflare AI request failed", { error: msg });
      throw error;
    }
  }

  /**
   * Build a prompt optimized for small text generation (~50 tokens).
   */
  private buildPrompt(task: AITask): string {
    const prompt = task.input;
    const maxTokens = Math.min(task.maxTokens || 48, this.config.maxTokens);

    // For short-form PoUW, use a concise instruction format
    return `Generate a short, creative response (max ${maxTokens} words): ${prompt}`;
  }

  /**
   * Call the Cloudflare Worker proxy.
   * The proxy injects the API key and forwards to Cloudflare Workers AI.
   */
  private async callAPI(prompt: string, signal?: AbortSignal): Promise<string> {
    const url = this.config.proxyUrl || "https://api.cloudflare.com/client/v4";

    const body = JSON.stringify({
      model: this.config.model,
      prompt,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const resp = await fetch(`${url}/api/ai/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
      signal,
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => "Unknown error");
      if (resp.status === 429) {
        throw new Error("Cloudflare AI rate limit exceeded. Try again later.");
      }
      throw new Error(
        `Cloudflare AI returned ${resp.status}: ${errorText.slice(0, 120)}`,
      );
    }

    const data = await resp.json();

    // Cloudflare Workers AI returns { result: { response: "..." } }
    if (data.result?.response) {
      return data.result.response;
    }

    // Some models return { result: { text: "..." } }
    if (data.result?.text) {
      return data.result.text;
    }

    throw new Error(
      `Unexpected Cloudflare AI response format: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }

  /**
   * SHA-256 via Web Crypto API (same as BabyBrain for proof consistency).
   */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(data),
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Verify a proof's structural integrity.
   */
  async verifyProof(proofString: string): Promise<boolean> {
    try {
      const proof = JSON.parse(proofString);
      const { hash, ...proofData } = proof;
      const expectedHash = await this.sha256(JSON.stringify(proofData));
      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  /** Set model (must be one of AVAILABLE_MODELS) */
  setModel(modelName: string): void {
    const model = AVAILABLE_MODELS.find(
      (m) => m.id === modelName || m.name === modelName,
    );
    if (!model) {
      log.warn("Unknown model, keeping current", { requested: modelName });
      return;
    }
    this.config.model = model.name;
    log.info("Model changed", { model: model.name });
  }

  /** No GPU resources to release */
  dispose(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.isInitialized = false;
    log.info("Cloudflare AI disposed");
  }

  getStatus(): {
    initialized: boolean;
    hasWebGPU: boolean;
    modelLoaded: string;
    modelChainStatus: ModelChainEntryStatus[];
    totalRequests: number;
    failedRequests: number;
    averageLatency: number;
  } {
    return {
      initialized: this.isInitialized,
      hasWebGPU: false,
      modelLoaded: this.config.model,
      modelChainStatus: [
        {
          id: "cloudflare-ai",
          name: "cloudflare",
          status: this.isInitialized ? "loaded" : "pending",
        },
      ],
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      averageLatency: this.averageLatency,
    };
  }

  async hasWebGPU(): Promise<boolean> {
    return false;
  }

  /** Get available models */
  static getAvailableModels(): typeof AVAILABLE_MODELS {
    return AVAILABLE_MODELS;
  }
}
