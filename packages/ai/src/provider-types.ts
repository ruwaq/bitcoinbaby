/**
 * AIProvider — unified interface for all AI backends
 *
 * Supports: Ollama (local), OpenAI, Anthropic, Google
 * Future: Local Gemma, Cloudflare Workers AI, Procedural BabyBrain
 */

export type AIProviderId = "ollama" | "openai" | "anthropic" | "google";

export interface AIProviderConfig {
  id: AIProviderId;
  apiKey?: string;
  model?: string;
  endpoint?: string; // for Ollama (localhost:11434)
  proxyUrl?: string; // Worker proxy for external APIs
}

export interface AIProviderStatus {
  id: AIProviderId;
  ready: boolean;
  model: string;
  error?: string;
}

export interface AIExecutionResult {
  text: string;
  model: string;
  provider: AIProviderId;
  tokensUsed: number;
  latencyMs: number;
}

export interface AIProvider {
  readonly id: AIProviderId;
  initialize(config: AIProviderConfig): Promise<void>;
  executeTask(prompt: string, systemPrompt?: string): Promise<AIExecutionResult>;
  getStatus(): AIProviderStatus;
  dispose(): void;
}