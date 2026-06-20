/**
 * OpenAIProvider — ChatGPT via Worker proxy
 *
 * API keys are never sent directly from the browser.
 * All requests go through the Cloudflare Worker proxy which injects the key server-side.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderStatus,
  AIExecutionResult,
} from "../provider-types";

interface OpenAIConfig extends AIProviderConfig {
  proxyUrl: string; // Required for OpenAI (Worker proxy)
}

export class OpenAIProvider implements AIProvider {
  readonly id = "openai" as const;
  private apiKey = "";
  private model = "gpt-4o-mini";
  private proxyUrl = "";
  private ready = false;

  async initialize(config: OpenAIConfig): Promise<void> {
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? this.model;
    this.proxyUrl = config.proxyUrl;

    if (!this.apiKey) throw new Error("OpenAI API key required");
    if (!this.proxyUrl) throw new Error("Worker proxy URL required for OpenAI");
    this.ready = true;
  }

  async executeTask(
    prompt: string,
    systemPrompt?: string
  ): Promise<AIExecutionResult> {
    const start = Date.now();
    const messages: Array<{ role: string; content: string }> = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: prompt });

    const res = await fetch(`${this.proxyUrl}/api/ai/proxy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openai",
        model: this.model,
        messages,
        apiKey: this.apiKey,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "unknown error");
      throw new Error(`OpenAI proxy error: ${res.status} — ${errText}`);
    }

    const data = (await res.json()) as { text: string; tokensUsed: number };

    return {
      text: data.text,
      model: this.model,
      provider: "openai",
      tokensUsed: data.tokensUsed,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return { id: "openai", ready: this.ready, model: this.model };
  }

  dispose(): void {
    this.ready = false;
  }
}