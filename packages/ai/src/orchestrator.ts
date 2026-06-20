/**
 * AIOrchestrator — manages AI providers with fallback
 *
 * Configure one or more providers. The orchestrator uses the active one.
 * If no provider is configured, throws an error prompting the user to connect one.
 */

import type {
  AIProvider,
  AIProviderConfig,
  AIExecutionResult,
  AIProviderId,
} from "./provider-types";
import { createProvider } from "./providers/registry";

export class AIOrchestrator {
  private providers = new Map<AIProviderId, AIProvider>();
  private activeId: AIProviderId | null = null;

  /** Configure a provider (initialize + register) */
  async configure(config: AIProviderConfig): Promise<void> {
    const provider = createProvider(config.id);
    await provider.initialize(config);
    this.providers.set(config.id, provider);
    if (!this.activeId) {
      this.activeId = config.id;
    }
  }

  /** Set the active provider for subsequent execution */
  setActive(id: AIProviderId): void {
    if (!this.providers.has(id)) {
      throw new Error(
        `Provider "${id}" not configured. Call configure() first.`
      );
    }
    this.activeId = id;
  }

  /** Get the currently active provider ID */
  getActive(): AIProviderId | null {
    return this.activeId;
  }

  /** Execute a task using the active provider */
  async execute(
    prompt: string,
    systemPrompt?: string
  ): Promise<AIExecutionResult> {
    if (!this.activeId) {
      throw new Error(
        "No AI provider configured. Go to Settings → AI Provider to connect one."
      );
    }
    const provider = this.providers.get(this.activeId);
    if (!provider) {
      throw new Error(`Provider "${this.activeId}" not found`);
    }
    return provider.executeTask(prompt, systemPrompt);
  }

  /** Dispose all providers */
  dispose(): void {
    for (const provider of this.providers.values()) {
      provider.dispose();
    }
    this.providers.clear();
    this.activeId = null;
  }
}