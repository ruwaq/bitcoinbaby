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
