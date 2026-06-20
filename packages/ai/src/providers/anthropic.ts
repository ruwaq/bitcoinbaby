/**
 * AnthropicProvider — Claude via Worker proxy
 *
 * Same proxy pattern as OpenAI: API key never touches the browser.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderStatus,
  AIExecutionResult,
} from "../provider-types";

interface AnthropicConfig extends AIProviderConfig {
  proxyUrl: string;
}

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic" as const;
  private apiKey = "";
  private model = "claude-3-haiku-20240307";
  private proxyUrl = "";
  private ready = false;

  async initialize(config: AnthropicConfig): Promise<void> {
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? this.model;
    this.proxyUrl = config.proxyUrl;

    if (!this.apiKey) throw new Error("Anthropic API key required");
    if (!this.proxyUrl)
      throw new Error("Worker proxy URL required for Anthropic");
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
        provider: "anthropic",
        model: this.model,
        messages,
        apiKey: this.apiKey,
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic proxy error: ${res.status}`);
    }

    const data = (await res.json()) as { text: string; tokensUsed: number };

    return {
      text: data.text,
      model: this.model,
      provider: "anthropic",
      tokensUsed: data.tokensUsed,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return { id: "anthropic", ready: this.ready, model: this.model };
  }

  dispose(): void {
    this.ready = false;
  }
}