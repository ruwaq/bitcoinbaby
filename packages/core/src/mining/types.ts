/**
 * Mining Types
 *
 * Type definitions for the mining engine.
 */

/**
 * Result of a successful proof of work
 */
export interface MiningResult {
  hash: string;
  nonce: number;
  difficulty: number;
  timestamp: number;
  /** Full block data (challenge:nonce) for validation */
  blockData?: string;
  /** Challenge string (timestamp:address) for spell generation */
  challenge?: string;
  /** AI proof for Proof of Useful Work (optional) */
  aiProof?: string;
}

/**
 * Mining statistics
 */
export interface MiningStats {
  hashrate: number;
  totalHashes: number;
  difficulty: number;
  shares: number;
  lastShareTime?: number;
}

/**
 * Events emitted by miners
 */
export interface MinerEvents {
  onHashrateUpdate: (hashrate: number) => void;
  onWorkFound: (result: MiningResult) => void;
  onStatusChange: (status: "running" | "paused" | "stopped") => void;
  onError: (error: Error) => void;
}

/**
 * Interface for miners (CPU, WebGPU)
 */
export interface Miner {
  /** The type of miner backend */
  readonly type: "cpu" | "webgpu";

  /** Start mining with optional block data */
  start(block?: string): Promise<void>;
  /** Stop mining completely */
  stop(): void;
  /** Pause mining (can be resumed) */
  pause(): void;
  /** Resume mining after pause */
  resume(): void;

  /** Set mining difficulty (number of leading zero bits) */
  setDifficulty(difficulty: number): void;
  /** Set throttle percentage (0-100) */
  setThrottle(percent: number): void;
  /** Set miner address for reward attribution */
  setAddress(address: string): void;

  /** Get current hashrate (hashes per second) */
  getHashrate(): number;
  /** Get total hashes computed since start */
  getTotalHashes(): number;
  /**
   * Check if miner is actively running
   * @returns true if started and not paused/stopped, false otherwise
   * @note Returns false when paused - use this to check if hashing is active
   */
  isRunning(): boolean;

  /** Terminate miner and release all resources */
  terminate(): void;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  preferWebGPU: boolean;
  fallbackToCPU: boolean;
  throttleOnBattery: boolean;
  throttleWhenHidden: boolean;
  initialDifficulty: number;
  minerAddress?: string;
  /** Enable AI Proof of Useful Work alongside mining (default: false) */
  enableAIPoUW?: boolean;
  /** Execute AI task on every N shares found (default: 1) */
  aiTaskFrequency?: number;
}

/**
 * Device capabilities
 */
export interface DeviceCapabilities {
  webgpu: boolean;
  webgl: boolean;
  workers: boolean;
  cores: number;
  memory?: number;
  gpu?: {
    vendor: string;
    renderer: string;
  };
}

/**
 * Mining pool configuration (for future use)
 */
export interface PoolConfig {
  url: string;
  user: string;
  password?: string;
  algorithm: "sha256d";
}

// ============================================
// Browser API type extensions
// These are not in standard TypeScript lib
// ============================================

/**
 * Battery Manager API (Navigator.getBattery())
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Battery_Status_API
 */
export interface BatteryManager extends EventTarget {
  readonly charging: boolean;
  readonly level: number;
  readonly chargingTime: number;
  readonly dischargingTime: number;
  addEventListener(
    type:
      | "chargingchange"
      | "levelchange"
      | "chargingtimechange"
      | "dischargingtimechange",
    listener: () => void,
  ): void;
  removeEventListener(
    type:
      | "chargingchange"
      | "levelchange"
      | "chargingtimechange"
      | "dischargingtimechange",
    listener: () => void,
  ): void;
}

/**
 * Navigator with non-standard APIs (for type-safe casting)
 * Use as: (navigator as NavigatorExtended)
 */
export interface NavigatorExtended {
  /** Device memory in GB (Chrome only) */
  deviceMemory?: number;
  /** Battery Status API */
  getBattery?: () => Promise<BatteryManager>;
  /** WebGPU API */
  gpu?: GPU;
  /** Hardware concurrency (standard but included for completeness) */
  hardwareConcurrency?: number;
}
