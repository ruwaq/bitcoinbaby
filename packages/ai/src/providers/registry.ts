/**
 * Provider Registry — factory for creating AI provider instances
 */

import type { AIProvider, AIProviderId } from "../provider-types";
import { OllamaProvider } from "./ollama";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GoogleProvider } from "./google";

const providerConstructors: Record<AIProviderId, new () => AIProvider> = {
  ollama: OllamaProvider,
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  google: GoogleProvider,
};

export function createProvider(id: AIProviderId): AIProvider {
  const Ctor = providerConstructors[id];
  if (!Ctor) throw new Error(`Unknown provider: ${id}`);
  return new Ctor();
}

export function getAvailableProviders(): AIProviderId[] {
  return Object.keys(providerConstructors) as AIProviderId[];
}