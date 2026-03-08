// Primary exports - AIEngine is the recommended way to use AI features
export {
  AIEngine,
  generateSentimentTask,
  generateTaskBatch,
  type AITask,
  type AIResult,
  type AIProof,
} from "./engine";

// @deprecated - Use AIEngine instead. Kept for backwards compatibility.
export { ModelLoader } from "./model-loader";
