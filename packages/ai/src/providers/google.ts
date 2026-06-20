/**
 * GoogleProvider — Gemini via Worker proxy
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIProviderStatus,
  AIExecutionResult,
} from "../provider-types";

interface GoogleConfig extends AIProviderConfig {
  proxyUrl: string;
}

export class GoogleProvider implements AIProvider {
  readonly id = "google" as const;
  private apiKey = "";
  private model = "gemini-1.5-flash";
  private proxyUrl = "";
  private ready = false;

  async initialize(config: GoogleConfig): Promise<void> {
    this.apiKey = config.apiKey ?? "";
    this.model = config.model ?? this.model;
    this.proxyUrl = config.proxyUrl;

    if (!this.apiKey) throw new Error("Google API key required");
    if (!this.proxyUrl)
      throw new Error("Worker proxy URL required for Gemini");
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
        provider: "google",
        model: this.model,
        messages,
        apiKey: this.apiKey,
      }),
    });

    if (!res.ok) {
      throw new Error(`Google proxy error: ${res.status}`);
    }

    const data = (await res.json()) as { text: string; tokensUsed: number };

    return {
      text: data.text,
      model: this.model,
      provider: "google",
      tokensUsed: data.tokensUsed,
      latencyMs: Date.now() - start,
    };
  }

  getStatus(): AIProviderStatus {
    return { id: "google", ready: this.ready, model: this.model };
  }

  dispose(): void {
    this.ready = false;
  }
}