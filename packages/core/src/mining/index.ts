/**
 * Mining Module
 *
 * Browser-based mining engine for BitcoinBaby.
 * Supports CPU mining via Web Workers with WebGPU planned.
 */

// Core mining classes
export { MiningOrchestrator } from "./orchestrator";
export { CPUMiner } from "./cpu-miner";
export { WebGPUMiner } from "./webgpu-miner";

// Global mining singleton (persists across navigation)
export {
  getMiningManager,
  destroyMiningManager,
  forceSaveMiningState,
  MiningManager,
  type MiningManagerState,
  type MiningManagerConfig,
} from "./mining-singleton";

// Device capability detection
export {
  getNavigator,
  detectWebGPU,
  detectWebGL,
  detectWorkers,
  getCPUCores,
  getDeviceMemory,
  isOnBattery,
  isPageVisible,
  detectCapabilities,
  getRecommendedConfig,
} from "./capabilities";

// Persistence (IndexedDB state saving)
export {
  MiningStatePersistence,
  getMiningPersistence,
  initMiningPersistence,
  type PersistedMiningState,
  type PersistedSession,
} from "./persistence";

// Tab Coordinator (Web Locks API)
export {
  MiningTabCoordinator,
  getTabCoordinator,
  destroyTabCoordinator,
  type TabCoordinatorEvents,
  type TabInfo,
} from "./tab-coordinator";

// Wake Lock (Screen Wake Lock API)
export {
  MiningWakeLock,
  getMiningWakeLock,
  destroyMiningWakeLock,
  type WakeLockStatus,
} from "./wake-lock";

// AI Integration (Proof of Useful Work)
export {
  AIWorkIntegration,
  getAIIntegration,
  destroyAIIntegration,
  type AIWorkResult,
  type AIStatus,
  type AIIntegrationConfig,
} from "./ai-integration";

// Dead Letter Queue (Failed Proof Recovery)
export {
  DeadLetterQueue,
  getDeadLetterQueue,
  initDeadLetterQueue,
  type FailedProof,
  type DeadLetterQueueStats,
  type DeadLetterQueueEvents,
  type DeadLetterQueueConfig,
} from "./dead-letter-queue";

// Client-side VarDiff (hashrate-based difficulty adjustment)
export {
  estimateDifficultyFromHashrate,
  isHashrateStable,
  getMinSafeDifficulty,
  getDifficultyForDevice,
  expectedSharesPerHour,
  willHitRateLimit,
  DEVICE_HASHRATE_PRESETS,
  DEFAULT_CLIENT_VARDIFF_CONFIG,
  type ClientVarDiffConfig,
  type ClientVarDiffState,
} from "./client-vardiff";

// Types
export type {
  Miner,
  MinerEvents,
  MiningResult,
  MiningStats,
  OrchestratorConfig,
  DeviceCapabilities,
  PoolConfig,
} from "./types";
