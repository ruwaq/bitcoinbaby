/**
 * Shared AI Types
 *
 * Core type definitions used across AI providers, BabyBrain, and Cloudflare AI.
 * Extracted from the former engine.ts after removing local Gemma/Transformers.js.
 */

export interface AIProgressData {
  progress: number;
  loaded: number;
  total: number;
  status: string;
  file: string;
  filesCount: number;
  doneCount: number;
}

export interface AITask {
  id: string;
  type: "text-generation" | "pouw";
  input: string;
  seed: string;
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
  difficulty?: number;
  hash?: string;
}
