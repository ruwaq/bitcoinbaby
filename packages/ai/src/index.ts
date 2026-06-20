// Primary exports - AIEngine is the recommended way to use AI features
export {
  AIEngine,
  generateSentimentTask,
  generateTaskBatch,
  type AITask,
  type AIResult,
  type AIProof,
  type AIProgressData,
} from "./engine";

// Cloudflare AI backend
export type { ModelChainEntryStatus } from "./cloudflare-ai";

// AI Provider System (BYO keys)
export { AIOrchestrator } from "./orchestrator";
export { createProvider, getAvailableProviders } from "./providers/registry";
export {
  type AIProvider,
  type AIProviderId,
  type AIProviderConfig,
  type AIProviderStatus,
  type AIExecutionResult,
} from "./provider-types";

// Narrative Engine (AI World Engine)
export { NarrativeEngine } from "./narrative-engine";
export type {
  SparkNFTState,
  PersonalityTraits,
  Archetype,
  Mood,
  NarrativeEventType,
  NarrativeEvent,
  NarrativeState,
  Relationship,
  Item,
} from "./narrative-types";
export { generatePersonality, generateArchetype } from "./narrative-templates";
