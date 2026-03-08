/**
 * Mining Singleton
 *
 * Global singleton that manages the MiningOrchestrator.
 * This ensures mining persists across page navigations in SPA.
 *
 * Integrates:
 * - IndexedDB persistence (resume after browser close)
 * - Web Locks (one tab mines at a time)
 * - Wake Lock (screen stays on while mining)
 *
 * The orchestrator lives at module level, not inside React components,
 * so it survives when components unmount during navigation.
 */

import { MiningOrchestrator } from "./orchestrator";
import {
  MiningStatePersistence,
  type PersistedMiningState,
} from "./persistence";
import { MiningTabCoordinator } from "./tab-coordinator";
import { MiningWakeLock } from "./wake-lock";
import type {
  OrchestratorConfig,
  MiningResult,
  DeviceCapabilities,
  XPGainedEvent,
} from "./types";
import { MIN_DIFFICULTY } from "../tokenomics/constants";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("MiningManager");
import {
  type ClientVarDiffState,
  createInitialClientVarDiffState,
  setInitialDifficultyFromHashrate,
  processShareForVarDiff,
  isHashrateStable,
  getMinSafeDifficulty,
  DEFAULT_CLIENT_VARDIFF_CONFIG,
} from "./client-vardiff";

// =============================================================================
// TYPES
// =============================================================================

export interface MiningManagerState {
  isRunning: boolean;
  isPaused: boolean;
  hashrate: number;
  totalHashes: number;
  shares: number;
  difficulty: number;
  minerType: "cpu" | "webgpu" | null;
  capabilities: DeviceCapabilities | null;
  lastShare: MiningResult | null;
  error: string | null;
  sessionStartTime: number | null;

  // Feature states
  isLeader: boolean;
  isWaitingForLeadership: boolean;
  wakeLockActive: boolean;
  canResume: boolean;
  lifetimeHashes: number;
  lifetimeShares: number;
}

export interface MiningManagerConfig extends Partial<OrchestratorConfig> {
  onStateChange?: (state: MiningManagerState) => void;
  onWorkFound?: (result: MiningResult) => void;
  /** Callback when XP is gained from mining (for NFT work proof) */
  onXPGained?: (event: XPGainedEvent) => void;
  onError?: (error: Error) => void;

  // Feature options
  enablePersistence?: boolean;
  enableTabCoordination?: boolean;
  enableWakeLock?: boolean;
  autoResumeOnInit?: boolean;
}

type StateListener = (state: MiningManagerState) => void;

// =============================================================================
// SINGLETON IMPLEMENTATION
// =============================================================================

class MiningManager {
  private orchestrator: MiningOrchestrator | null = null;
  private config: MiningManagerConfig = {};
  private listeners: Set<StateListener> = new Set();

  // Feature instances
  private persistence: MiningStatePersistence | null = null;
  private tabCoordinator: MiningTabCoordinator | null = null;
  private wakeLock: MiningWakeLock | null = null;

  // Client-side VarDiff state (independent of server)
  private clientVarDiffState: ClientVarDiffState =
    createInitialClientVarDiffState();
  private lastHashrateCheck: number = 0;
  private hashrateCheckInterval: number = 5000; // Check every 5 seconds

  private state: MiningManagerState = {
    isRunning: false,
    isPaused: false,
    hashrate: 0,
    totalHashes: 0,
    shares: 0,
    difficulty: MIN_DIFFICULTY,
    minerType: null,
    capabilities: null,
    lastShare: null,
    error: null,
    sessionStartTime: null,
    // Feature states
    isLeader: true,
    isWaitingForLeadership: false,
    wakeLockActive: false,
    canResume: false,
    lifetimeHashes: 0,
    lifetimeShares: 0,
  };

  /**
   * Initialize the mining manager with config
   * Safe to call multiple times - will only initialize once
   */
  initialize(config: MiningManagerConfig = {}): void {
    if (this.orchestrator) {
      // Already initialized, just update config
      this.config = { ...this.config, ...config };
      return;
    }

    this.config = {
      enablePersistence: true,
      enableTabCoordination: true,
      enableWakeLock: true,
      autoResumeOnInit: false,
      ...config,
    };

    this.orchestrator = new MiningOrchestrator({
      initialDifficulty: config.initialDifficulty ?? MIN_DIFFICULTY,
      minerAddress: config.minerAddress,
      preferWebGPU: config.preferWebGPU ?? true,
      fallbackToCPU: config.fallbackToCPU ?? true,
      throttleOnBattery: config.throttleOnBattery ?? true,
      throttleWhenHidden: config.throttleWhenHidden ?? true,
    });

    // Setup event handlers
    this.orchestrator.on("onHashrateUpdate", (hashrate) => {
      const totalHashes = this.orchestrator?.getTotalHashes() ?? 0;
      this.updateState({
        hashrate,
        totalHashes,
      });

      // Auto-adjust difficulty based on hashrate (client-side VarDiff)
      this.checkAndAdjustDifficulty(hashrate, totalHashes);
    });

    this.orchestrator.on("onWorkFound", (result) => {
      this.updateState({
        shares: this.state.shares + 1,
        lastShare: result,
      });

      // Process share through client VarDiff for timing-based adjustment
      this.processShareForClientVarDiff();

      this.config.onWorkFound?.(result);
    });

    // XP gained event (for NFT work proof system)
    this.orchestrator.on("onXPGained", (event) => {
      this.config.onXPGained?.(event);
    });

    this.orchestrator.on("onStatusChange", (status) => {
      this.updateState({
        isRunning: status === "running",
        isPaused: status === "paused",
        minerType: this.orchestrator?.getMinerType() ?? null,
      });

      // Handle wake lock based on mining status
      if (status === "running" && this.config.enableWakeLock) {
        this.wakeLock?.acquire();
      } else if (status === "stopped") {
        this.wakeLock?.release();
      }
    });

    this.orchestrator.on("onError", (error) => {
      this.updateState({ error: error.message });
      this.config.onError?.(error);
    });

    // Detect capabilities
    this.orchestrator.detectCapabilities().then((caps) => {
      this.updateState({ capabilities: caps });
    });

    // Initialize features
    this.initializeFeatures();
  }

  /**
   * Initialize persistence, tab coordination, and wake lock
   */
  private async initializeFeatures(): Promise<void> {
    // Initialize persistence
    if (this.config.enablePersistence) {
      this.persistence = new MiningStatePersistence();
      try {
        await this.persistence.open();
        const savedState = await this.persistence.loadState();
        const stats = await this.persistence.getLifetimeStats();

        // NOTE: Difficulty is NOT restored from persistence
        // Always use config.initialDifficulty to ensure MIN_DIFFICULTY is enforced
        this.updateState({
          canResume: savedState !== null,
          lifetimeHashes: stats.totalHashes,
          lifetimeShares: stats.totalShares,
          // difficulty is intentionally NOT restored - use config value
        });

        log.info("Persistence initialized", {
          canResume: savedState !== null,
          lifetimeHashes: stats.totalHashes,
        });
      } catch (err) {
        log.warn("Persistence init failed", { error: err });
      }
    }

    // Initialize tab coordinator
    if (
      this.config.enableTabCoordination &&
      MiningTabCoordinator.isSupported()
    ) {
      this.tabCoordinator = new MiningTabCoordinator({
        onBecomeLeader: () => {
          this.updateState({ isLeader: true, isWaitingForLeadership: false });
          log.info("This tab is now the mining leader");
        },
        onLostLeadership: () => {
          this.updateState({ isLeader: false });
          // Stop mining if we lose leadership
          if (this.state.isRunning) {
            log.info("Lost leadership, stopping mining");
            this.stop();
          }
        },
        onWaitingForLeadership: () => {
          this.updateState({ isWaitingForLeadership: true });
        },
      });
    }

    // Initialize wake lock
    if (this.config.enableWakeLock && MiningWakeLock.isSupported()) {
      this.wakeLock = new MiningWakeLock();
      this.wakeLock.enableAutoReacquire();
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Immediately call with current state
    listener(this.state);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Update state and notify listeners
   */
  private updateState(partial: Partial<MiningManagerState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
    this.config.onStateChange?.(this.state);
  }

  /**
   * Get current state
   */
  getState(): MiningManagerState {
    return this.state;
  }

  /**
   * Start mining
   */
  async start(blockData?: string): Promise<void> {
    if (!this.orchestrator) {
      throw new Error(
        "MiningManager not initialized. Call initialize() first.",
      );
    }

    if (this.state.isRunning) {
      log.warn("Mining already running");
      return;
    }

    // Request leadership if tab coordination is enabled
    if (this.tabCoordinator && !this.state.isLeader) {
      const isAnotherMining = await this.tabCoordinator.isAnotherTabMining();
      if (isAnotherMining) {
        log.info("Another tab is mining, requesting leadership...");
        this.updateState({ isWaitingForLeadership: true });
        await this.tabCoordinator.requestLeadership();
      } else {
        await this.tabCoordinator.tryImmediateLeadership();
      }
    }

    this.updateState({
      error: null,
      sessionStartTime: Date.now(),
    });

    try {
      await this.orchestrator.start(blockData);

      // Start auto-saving state
      // FIX: Stop any existing auto-save first to prevent memory leak
      // if start() is called multiple times quickly
      if (this.persistence) {
        this.persistence.stopAutoSave(); // Clear any existing interval
        this.persistence.startAutoSave(() => ({
          lastNonce: 0, // Would need orchestrator to expose this
          totalHashes: this.state.totalHashes,
          totalShares: this.state.shares,
          difficulty: this.state.difficulty,
          lastBlockData: blockData ?? "",
          sessionUptime: this.getUptime(),
          tokensEarned: 0,
        }));
      }

      // Acquire wake lock
      if (this.wakeLock) {
        const acquired = await this.wakeLock.acquire();
        this.updateState({ wakeLockActive: acquired });
      }
    } catch (error) {
      this.updateState({
        error:
          error instanceof Error ? error.message : "Failed to start mining",
        sessionStartTime: null,
      });
      throw error;
    }
  }

  /**
   * Stop mining
   */
  async stop(): Promise<void> {
    if (!this.orchestrator) return;

    // Save final state before stopping
    if (this.persistence) {
      this.persistence.stopAutoSave();
      try {
        await this.persistence.saveState({
          lastNonce: 0,
          totalHashes: this.state.lifetimeHashes + this.state.totalHashes,
          totalShares: this.state.lifetimeShares + this.state.shares,
          difficulty: this.state.difficulty,
          lastBlockData: "",
          lastSavedAt: Date.now(),
          sessionUptime: this.getUptime(),
          tokensEarned: 0,
        });
        log.info("State saved before stop");
      } catch (err) {
        log.warn("Failed to save state", { error: err });
      }
    }

    this.orchestrator.stop();

    // Release wake lock
    if (this.wakeLock) {
      await this.wakeLock.release();
      this.updateState({ wakeLockActive: false });
    }

    // Release leadership
    this.tabCoordinator?.releaseLeadership();

    this.updateState({ sessionStartTime: null });
  }

  /**
   * Pause mining
   */
  pause(): void {
    if (!this.orchestrator || !this.state.isRunning || this.state.isPaused) {
      return;
    }
    this.orchestrator.pause();
    this.updateState({ isPaused: true });

    // Release wake lock when paused
    if (this.wakeLock) {
      this.wakeLock.release();
      this.updateState({ wakeLockActive: false });
    }
  }

  /**
   * Resume mining
   */
  resume(): void {
    if (!this.orchestrator || !this.state.isRunning || !this.state.isPaused) {
      return;
    }
    this.orchestrator.resume();
    this.updateState({ isPaused: false });

    // Re-acquire wake lock when resumed
    if (this.wakeLock && this.config.enableWakeLock) {
      this.wakeLock.acquire().then((acquired) => {
        this.updateState({ wakeLockActive: acquired });
      });
    }
  }

  /**
   * Toggle mining state
   */
  async toggle(blockData?: string): Promise<void> {
    if (this.state.isRunning) {
      await this.stop();
    } else {
      await this.start(blockData);
    }
  }

  /**
   * Set difficulty (enforces MIN_DIFFICULTY)
   */
  setDifficulty(difficulty: number): void {
    // CRITICAL: Never allow difficulty below MIN_DIFFICULTY
    // This prevents low-difficulty shares that will be rejected by server
    const safeDifficulty = Math.max(difficulty, MIN_DIFFICULTY);

    if (difficulty < MIN_DIFFICULTY) {
      log.warn("Difficulty below minimum, enforcing MIN_DIFFICULTY", {
        requested: difficulty,
        enforced: MIN_DIFFICULTY,
      });
    }

    this.orchestrator?.setDifficulty(safeDifficulty);
    this.updateState({ difficulty: safeDifficulty });
  }

  /**
   * Update difficulty from VarDiff response (called by SyncManager)
   *
   * Only updates if the new difficulty is different from current.
   * Enforces MIN_DIFFICULTY to prevent rejected shares.
   */
  updateDifficultyFromVarDiff(newDifficulty: number): boolean {
    // Enforce MIN_DIFFICULTY
    const safeDifficulty = Math.max(newDifficulty, MIN_DIFFICULTY);

    if (safeDifficulty === this.state.difficulty) {
      return false;
    }

    const oldDiff = this.state.difficulty;
    this.setDifficulty(safeDifficulty);

    // Also update client VarDiff state to stay in sync
    this.clientVarDiffState = {
      ...this.clientVarDiffState,
      currentDiff: safeDifficulty,
      // Reset share times since difficulty changed
      recentShareTimes: [],
      sharesSinceRetarget: 0,
    };

    log.info("VarDiff adjustment", {
      oldDiff,
      newDiff: safeDifficulty,
      clamped: newDifficulty < MIN_DIFFICULTY ? newDifficulty : undefined,
    });

    return true;
  }

  /**
   * Check and auto-adjust difficulty based on hashrate (client-side VarDiff)
   *
   * This runs independently of server VarDiff to ensure miners start at
   * appropriate difficulty even when server communication is blocked.
   *
   * CRITICAL: Prevents rate limiting by calculating correct difficulty locally.
   */
  private checkAndAdjustDifficulty(
    hashrate: number,
    totalHashes: number,
  ): void {
    const now = Date.now();

    // Throttle checks to avoid excessive processing
    if (now - this.lastHashrateCheck < this.hashrateCheckInterval) {
      return;
    }
    this.lastHashrateCheck = now;

    // Skip if hashrate not stable yet
    if (!isHashrateStable(totalHashes, DEFAULT_CLIENT_VARDIFF_CONFIG)) {
      return;
    }

    // Try to set initial difficulty from hashrate
    const result = setInitialDifficultyFromHashrate(
      this.clientVarDiffState,
      hashrate,
      totalHashes,
      DEFAULT_CLIENT_VARDIFF_CONFIG,
    );

    if (result.changed) {
      this.clientVarDiffState = result.state;

      // Also check if we need a higher difficulty to avoid rate limits
      const safeDiff = getMinSafeDifficulty(hashrate, 1500); // MAX_SHARES_PER_HOUR
      const finalDiff = Math.max(result.newDifficulty, safeDiff);

      if (finalDiff !== this.state.difficulty) {
        const oldDiff = this.state.difficulty;
        this.setDifficulty(finalDiff);
        log.info("Client VarDiff adjustment", {
          oldDiff,
          newDiff: finalDiff,
          hashrateMH: (hashrate / 1_000_000).toFixed(2),
          optimalDiff: result.newDifficulty,
          safeDiff,
        });
      }
    }
  }

  /**
   * Process share through client VarDiff for timing-based adjustment
   *
   * This monitors actual share times and adjusts difficulty accordingly,
   * providing a secondary adjustment mechanism to the hashrate-based one.
   */
  private processShareForClientVarDiff(): void {
    const result = processShareForVarDiff(
      this.clientVarDiffState,
      Date.now(),
      DEFAULT_CLIENT_VARDIFF_CONFIG,
    );

    this.clientVarDiffState = result.state;

    if (result.adjustment.changed) {
      // Only adjust if significantly different to avoid oscillation
      const diff = Math.abs(
        result.adjustment.newDifficulty - this.state.difficulty,
      );
      if (diff >= 1) {
        const oldDiff = this.state.difficulty;
        this.setDifficulty(result.adjustment.newDifficulty);
        log.info("Client VarDiff timing adjustment", {
          oldDiff,
          newDiff: result.adjustment.newDifficulty,
          reason: result.adjustment.reason,
        });
      }
    }
  }

  /**
   * Get current difficulty
   */
  getDifficulty(): number {
    return this.state.difficulty;
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.orchestrator !== null;
  }

  /**
   * Get session uptime in seconds
   */
  getUptime(): number {
    if (!this.state.sessionStartTime || !this.state.isRunning) {
      return 0;
    }
    return Math.floor((Date.now() - this.state.sessionStartTime) / 1000);
  }

  /**
   * Destroy the manager and cleanup
   * Use this only when the app is closing
   */
  destroy(): void {
    // Cleanup features
    this.persistence?.stopAutoSave();
    this.persistence?.close();
    this.persistence = null;

    this.tabCoordinator?.destroy();
    this.tabCoordinator = null;

    this.wakeLock?.destroy();
    this.wakeLock = null;

    // Cleanup orchestrator
    this.orchestrator?.terminate();
    this.orchestrator = null;
    this.listeners.clear();
    this.state = {
      isRunning: false,
      isPaused: false,
      hashrate: 0,
      totalHashes: 0,
      shares: 0,
      difficulty: MIN_DIFFICULTY,
      minerType: null,
      capabilities: null,
      lastShare: null,
      error: null,
      sessionStartTime: null,
      isLeader: true,
      isWaitingForLeadership: false,
      wakeLockActive: false,
      canResume: false,
      lifetimeHashes: 0,
      lifetimeShares: 0,
    };
  }

  /**
   * Get saved state from persistence
   */
  async getSavedState(): Promise<PersistedMiningState | null> {
    return this.persistence?.loadState() ?? null;
  }

  /**
   * Clear saved state
   */
  async clearSavedState(): Promise<void> {
    await this.persistence?.clearState();
    this.updateState({ canResume: false });
  }

  /**
   * Reset all mining data (for testnet debugging)
   * Clears:
   * - Mining state (hashes, shares, difficulty)
   * - Lifetime stats
   * Does NOT clear: share queue (use SyncManager for that)
   */
  async resetAllMiningData(): Promise<void> {
    log.info("Resetting all mining data...");

    // Stop mining first
    this.orchestrator?.stop();

    // Clear persistence (clearState handles both state and sessions via IndexedDB)
    await this.persistence?.clearState();

    // Reset state to defaults
    this.updateState({
      totalHashes: 0,
      shares: 0,
      difficulty: MIN_DIFFICULTY,
      lastShare: null,
      error: null,
      sessionStartTime: null,
      canResume: false,
      lifetimeHashes: 0,
      lifetimeShares: 0,
    });

    log.info("All mining data reset complete");
  }

  /**
   * Force save current state immediately
   * Called on page unload to prevent data loss
   */
  forceSave(): void {
    if (!this.persistence) return;

    try {
      // Use synchronous approach for beforeunload
      const stateToSave = {
        lastNonce: 0,
        totalHashes: this.state.lifetimeHashes + this.state.totalHashes,
        totalShares: this.state.lifetimeShares + this.state.shares,
        difficulty: this.state.difficulty,
        lastBlockData: "",
        lastSavedAt: Date.now(),
        sessionUptime: this.getUptime(),
        tokensEarned: 0,
      };

      // Fire-and-forget save - can't await in beforeunload
      this.persistence.saveState(stateToSave).catch((err) => {
        log.warn("Force save failed", { error: err });
      });

      log.debug("Force save triggered");
    } catch (err) {
      log.warn("Force save error", { error: err });
    }
  }

  /**
   * Check if wake lock is supported
   */
  isWakeLockSupported(): boolean {
    return MiningWakeLock.isSupported();
  }

  /**
   * Check if tab coordination is supported
   */
  isTabCoordinationSupported(): boolean {
    return MiningTabCoordinator.isSupported();
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

// Single global instance
let instance: MiningManager | null = null;

/**
 * Get the global mining manager instance
 * Creates one if it doesn't exist
 */
export function getMiningManager(): MiningManager {
  if (!instance) {
    instance = new MiningManager();
  }
  return instance;
}

/**
 * Destroy the global mining manager
 * Use this only when the app is completely closing
 */
export function destroyMiningManager(): void {
  instance?.destroy();
  instance = null;
}

/**
 * Force save mining state immediately
 * Call this on page unload (beforeunload event) to prevent data loss
 */
export function forceSaveMiningState(): void {
  instance?.forceSave();
}

// Export class for testing
export { MiningManager };
