/**
 * OllamaProvider — local AI via Ollama HTTP API
 *
 * Direct connection to localhost (no Worker proxy needed).
 * User must have Ollama running locally with the chosen model pulled.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderStatus,
  AIExecutionResult,
} from "../provider-types";

export class OllamaProvider implements AIProvider {
  readonly id = "ollama" as const;
  private endpoint = "http://localhost:11434";
  private model = "llama3";
  private ready = false;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.endpoint = config.endpoint ?? this.endpoint;
    this.model = config.model ?? this.model;

    try {
      const res = await fetch(`${this.endpoint}/api/tags`);
      if (!res.ok) throw new Error(`Ollama not reachable: ${res.status}`);
      this.ready = true;
    } catch (err) {
      this.ready = false;
      throw new Error(
        `Ollama connection failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  async executeTask(
    prompt: string,
    systemPrompt?: string
  ): Promise<AIExecutionResult> {
    const start = Date.now();
    const body: Record<string, unknown> = {
      model: this.model,
      prompt,
      stream: false,
    };
    if (systemPrompt) body.system = systemPrompt;

    const res = await fetch(`${this.endpoint}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok)
      throw new Error(`Ollama generation failed: ${res.status}`);

    const data = (await res.json()) as {
      response: string;
      eval_count?: number;
    };

    return {
      text: data.response,
      model: this.model,
      provider: "ollama",
      tokensUsed: data.eval_count ?? 0,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return {
      id: "ollama",
      ready: this.ready,
      model: this.model,
    };
  }

  dispose(): void {
    this.ready = false;
  }
}