import type {
  Miner,
  MinerEvents,
  MiningResult,
  OrchestratorConfig,
  DeviceCapabilities,
  BatteryManager,
  XPGainedEvent,
} from "./types";
import { CPUMiner } from "./cpu-miner";
import {
  detectCapabilities,
  isOnBattery,
  isPageVisible,
  getNavigator,
} from "./capabilities";
import { MIN_DIFFICULTY } from "../tokenomics/constants";
import {
  AIWorkIntegration,
  type AIStatus,
  type AIWorkResult,
} from "./ai-integration";

const defaultConfig: OrchestratorConfig = {
  preferWebGPU: true,
  fallbackToCPU: true,
  throttleOnBattery: true,
  throttleWhenHidden: true,
  initialDifficulty: MIN_DIFFICULTY, // D22 - sustainable emission rate
  enableAIPoUW: false, // AI PoUW disabled by default
  aiTaskFrequency: 1, // Execute AI task on every share
};

/**
 * MiningOrchestrator - Coordina miners CPU y WebGPU
 *
 * Basado en el patron del BRO token:
 * https://github.com/CharmsDev/bro/tree/main/webapp/src/mining
 */
export class MiningOrchestrator {
  private config: OrchestratorConfig;
  private activeMiner: Miner | null = null;
  private events: Partial<MinerEvents> = {};
  private isRunning = false;
  private isStarting = false; // Prevents concurrent start() calls
  private startCancelled = false; // Tracks if stop() was called during start()
  private isHandlingError = false; // Prevents race condition in handleMinerError
  private capabilities: DeviceCapabilities | null = null;
  private cleanupFunctions: (() => void)[] = [];
  private currentBlockData?: string; // Store for fallback recovery
  private aiIntegration: AIWorkIntegration | null = null; // AI PoUW integration

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    // Enforce MIN_DIFFICULTY on initial config
    if (this.config.initialDifficulty < MIN_DIFFICULTY) {
      console.warn(
        `[Orchestrator] Initial difficulty D${this.config.initialDifficulty} below MIN_DIFFICULTY, using D${MIN_DIFFICULTY}`,
      );
      this.config.initialDifficulty = MIN_DIFFICULTY;
    }

    // Initialize AI integration if enabled
    if (this.config.enableAIPoUW) {
      this.aiIntegration = new AIWorkIntegration({
        enabled: true,
        taskFrequency: this.config.aiTaskFrequency ?? 1,
        preferWebGPU: this.config.preferWebGPU,
      });
    }
  }

  /**
   * Detect device capabilities
   */
  async detectCapabilities(): Promise<DeviceCapabilities> {
    if (!this.capabilities) {
      this.capabilities = await detectCapabilities();
    }
    return this.capabilities;
  }

  /**
   * Initialize and start the appropriate miner
   */
  async start(blockData?: string): Promise<void> {
    // Prevent concurrent start() calls
    if (this.isStarting) {
      console.warn("[Orchestrator] Start already in progress");
      return;
    }

    if (this.isRunning) {
      console.warn("[Orchestrator] Mining already running");
      return;
    }

    // Set flags BEFORE async operations to prevent race conditions
    this.isStarting = true;
    this.startCancelled = false;
    this.isRunning = true;
    this.currentBlockData = blockData;

    try {
      // Detect capabilities
      const caps = await this.detectCapabilities();

      // Check if stop() was called during detectCapabilities()
      if (this.startCancelled) {
        console.log(
          "[Orchestrator] Start cancelled during capability detection",
        );
        this.isRunning = false;
        this.isStarting = false;
        return;
      }

      if (this.config.preferWebGPU && caps.webgpu) {
        // Use WebGPU miner for 10-100x faster hashing
        const { WebGPUMiner } = await import("./webgpu-miner");

        // Check again after dynamic import
        if (this.startCancelled) {
          console.log("[Orchestrator] Start cancelled during WebGPU import");
          this.isRunning = false;
          this.isStarting = false;
          return;
        }

        this.activeMiner = new WebGPUMiner({
          difficulty: this.config.initialDifficulty,
          address: this.config.minerAddress,
          onHashrateUpdate: (hashrate) =>
            this.events.onHashrateUpdate?.(hashrate),
          onWorkFound: (result) => this.handleWorkFound(result),
          onStatusChange: (status) => this.events.onStatusChange?.(status),
          onError: (error) => this.handleMinerError(error),
        });
      } else if (this.config.fallbackToCPU && caps.workers) {
        this.activeMiner = this.createCPUMiner();
      } else {
        throw new Error("No mining backend available");
      }

      // Final check before starting
      if (this.startCancelled) {
        console.log("[Orchestrator] Start cancelled before miner.start()");
        this.activeMiner?.terminate();
        this.activeMiner = null;
        this.isRunning = false;
        this.isStarting = false;
        return;
      }

      // Setup visibility handling
      if (this.config.throttleWhenHidden) {
        this.setupVisibilityHandling();
      }

      // Setup battery handling
      if (this.config.throttleOnBattery) {
        this.setupBatteryHandling();
      }

      await this.activeMiner.start(blockData);
      this.isStarting = false;
      this.events.onStatusChange?.("running");
    } catch (error) {
      // Reset state on failure
      this.isRunning = false;
      this.isStarting = false;
      this.activeMiner = null;
      throw error;
    }
  }

  /**
   * Create CPU miner with event handlers
   */
  private createCPUMiner(): CPUMiner {
    return new CPUMiner({
      difficulty: this.config.initialDifficulty,
      address: this.config.minerAddress,
      onHashrateUpdate: (hashrate) => this.events.onHashrateUpdate?.(hashrate),
      onWorkFound: (result) => this.handleWorkFound(result),
      onStatusChange: (status) => this.events.onStatusChange?.(status),
      onError: (error) => {
        console.error("[Orchestrator] CPU miner error:", error.message);
        this.events.onError?.(error);
        // CPU is the last resort, so just stop mining
        this.isRunning = false;
        this.events.onStatusChange?.("stopped");
      },
    });
  }

  /**
   * Handle work found from miners
   * Integrates AI PoUW by executing AI tasks on each share
   * AI work is non-blocking and optional
   *
   * Also emits XP gained event for NFT system integration
   */
  private handleWorkFound(result: MiningResult): void {
    // Emit XP gained event for NFT system (symbiosis: mining → NFT XP)
    // Base XP is calculated from difficulty - higher difficulty = more XP
    const baseXP = this.calculateBaseXP(result.difficulty);
    this.emitXPGained(result, baseXP);

    // If AI PoUW is not enabled, just pass through
    if (!this.aiIntegration) {
      this.events.onWorkFound?.(result);
      return;
    }

    // Execute AI task asynchronously (non-blocking)
    // The share is reported immediately, AI proof is added if available
    this.aiIntegration
      .onShareFound()
      .then((aiResult) => {
        if (aiResult?.success && aiResult.proof) {
          // Add AI proof to the mining result
          const enhancedResult: MiningResult = {
            ...result,
            aiProof: aiResult.proof,
          };
          console.log(
            `[Orchestrator] Share with AI proof (task: ${aiResult.taskId}, time: ${aiResult.computeTime?.toFixed(0)}ms)`,
          );
          this.events.onWorkFound?.(enhancedResult);
        } else {
          // AI failed or skipped, report share without AI proof
          if (aiResult?.error) {
            console.warn("[Orchestrator] AI task failed:", aiResult.error);
          }
          this.events.onWorkFound?.(result);
        }
      })
      .catch((error) => {
        // AI completely failed, mining continues normally
        console.warn("[Orchestrator] AI integration error:", error);
        this.events.onWorkFound?.(result);
      });
  }

  /**
   * Calculate base XP from difficulty
   * Higher difficulty = more XP (rewards harder work)
   */
  private calculateBaseXP(difficulty: number): number {
    // Base: 100 XP at MIN_DIFFICULTY
    // Each additional difficulty bit doubles the XP
    const difficultyBonus = difficulty - MIN_DIFFICULTY;
    return Math.floor(100 * Math.pow(1.5, difficultyBonus));
  }

  /**
   * Emit XP gained event for NFT system
   * This enables the symbiosis between mining and NFT progression
   */
  private emitXPGained(result: MiningResult, baseXP: number): void {
    if (this.events.onXPGained) {
      const event: XPGainedEvent = {
        result,
        baseXP,
        timestamp: Date.now(),
      };
      this.events.onXPGained(event);
    }
  }

  /**
   * Stop the active miner
   */
  stop(): void {
    // Cancel any in-progress start() operation
    if (this.isStarting) {
      this.startCancelled = true;
    }

    if (!this.isRunning) {
      return;
    }

    if (this.activeMiner) {
      this.activeMiner.stop();
    }

    this.isRunning = false;
    this.events.onStatusChange?.("stopped");
  }

  /**
   * Pause mining
   */
  pause(): void {
    if (this.activeMiner && this.isRunning) {
      this.activeMiner.pause();
      this.events.onStatusChange?.("paused");
    }
  }

  /**
   * Resume mining
   */
  resume(): void {
    if (this.activeMiner && this.isRunning) {
      this.activeMiner.resume();
      this.events.onStatusChange?.("running");
    }
  }

  /**
   * Set difficulty
   *
   * Enforces MIN_DIFFICULTY to prevent unsustainable emission rates.
   * Difficulty below MIN_DIFFICULTY will be clamped.
   */
  setDifficulty(difficulty: number): void {
    const safeDifficulty = Math.max(difficulty, MIN_DIFFICULTY);
    if (difficulty < MIN_DIFFICULTY) {
      console.warn(
        `[Orchestrator] Difficulty D${difficulty} below MIN_DIFFICULTY, using D${safeDifficulty}`,
      );
    }
    this.config.initialDifficulty = safeDifficulty;
    this.activeMiner?.setDifficulty(safeDifficulty);
  }

  /**
   * Register event handlers
   */
  on<K extends keyof MinerEvents>(event: K, handler: MinerEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * Terminate and cleanup
   */
  terminate(): void {
    // Cancel any in-progress start
    this.startCancelled = true;
    this.isStarting = false;
    this.isHandlingError = false; // Reset error handling flag

    this.stop();

    // Cleanup event listeners
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];

    this.activeMiner?.terminate();
    this.activeMiner = null;
    this.capabilities = null;

    // Cleanup AI integration
    this.aiIntegration?.terminate();
    this.aiIntegration = null;
  }

  /**
   * Handle miner errors with automatic fallback to CPU
   * This ensures mining continues even if GPU fails
   *
   * FIX: Added race condition protection to prevent issues when stop() is
   * called during the async fallback operation.
   */
  private async handleMinerError(error: Error): Promise<void> {
    // Prevent concurrent error handling and check if still running
    if (this.isHandlingError || !this.isRunning) {
      console.log(
        "[Orchestrator] Skipping error handling (not running or already handling)",
      );
      return;
    }
    this.isHandlingError = true;

    try {
      console.error("[Orchestrator] Miner error:", error.message);

      // Notify listeners of the error
      this.events.onError?.(error);

      // If current miner is WebGPU and CPU fallback is enabled, switch to CPU
      if (
        this.activeMiner?.type === "webgpu" &&
        this.config.fallbackToCPU &&
        this.capabilities?.workers
      ) {
        console.log("[Orchestrator] Falling back to CPU mining...");

        // Stop the failed GPU miner
        this.activeMiner.terminate();

        // Check if stop() was called during terminate
        if (!this.isRunning) {
          console.log("[Orchestrator] Stop called during fallback, aborting");
          return;
        }

        // Create and start CPU miner
        this.activeMiner = this.createCPUMiner();

        // Check again before async start
        if (!this.isRunning) {
          console.log("[Orchestrator] Stop called before CPU start, aborting");
          this.activeMiner.terminate();
          this.activeMiner = null;
          return;
        }

        try {
          await this.activeMiner.start(this.currentBlockData);

          // Check if stop was called during start
          if (!this.isRunning) {
            console.log(
              "[Orchestrator] Stop called during CPU start, stopping",
            );
            this.activeMiner.stop();
            return;
          }

          this.events.onStatusChange?.("running");
          console.log("[Orchestrator] CPU fallback successful");
        } catch (cpuError) {
          console.error("[Orchestrator] CPU fallback failed:", cpuError);
          this.isRunning = false;
          this.activeMiner = null;
          this.events.onStatusChange?.("stopped");
          this.events.onError?.(
            cpuError instanceof Error
              ? cpuError
              : new Error("CPU mining failed"),
          );
        }
      } else {
        // No fallback available, stop mining
        this.isRunning = false;
        this.events.onStatusChange?.("stopped");
      }
    } finally {
      this.isHandlingError = false;
    }
  }

  /**
   * Handle page visibility changes
   */
  private setupVisibilityHandling(): void {
    if (typeof document === "undefined") return;

    const handler = () => {
      if (!this.activeMiner) return;

      if (!isPageVisible()) {
        this.activeMiner.setThrottle(10); // 10% when hidden
      } else {
        this.activeMiner.setThrottle(100); // 100% when visible
      }
    };

    document.addEventListener("visibilitychange", handler);

    // Track cleanup function
    this.cleanupFunctions.push(() => {
      document.removeEventListener("visibilitychange", handler);
    });
  }

  /**
   * Handle battery status changes
   */
  private setupBatteryHandling(): void {
    const nav = getNavigator();
    if (!nav?.getBattery) return;

    nav
      .getBattery()
      .then((battery: BatteryManager) => {
        const updateThrottle = () => {
          if (!this.activeMiner) return;

          if (!battery.charging && battery.level < 0.2) {
            this.activeMiner.setThrottle(25); // 25% on low battery
          } else if (!battery.charging) {
            this.activeMiner.setThrottle(50); // 50% on battery
          } else {
            this.activeMiner.setThrottle(100); // 100% when charging
          }
        };

        battery.addEventListener("chargingchange", updateThrottle);
        battery.addEventListener("levelchange", updateThrottle);
        updateThrottle();

        // Track cleanup function
        this.cleanupFunctions.push(() => {
          battery.removeEventListener("chargingchange", updateThrottle);
          battery.removeEventListener("levelchange", updateThrottle);
        });
      })
      .catch(() => {
        // Battery API not available
      });
  }

  // Getters
  getHashrate(): number {
    return this.activeMiner?.getHashrate() ?? 0;
  }

  getTotalHashes(): number {
    return this.activeMiner?.getTotalHashes() ?? 0;
  }

  getMinerType(): "cpu" | "webgpu" | null {
    return this.activeMiner?.type ?? null;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  getCapabilities(): DeviceCapabilities | null {
    return this.capabilities;
  }

  // ==========================================================================
  // AI PoUW Methods
  // ==========================================================================

  /**
   * Get AI integration status
   */
  getAIStatus(): AIStatus | null {
    return this.aiIntegration?.getStatus() ?? null;
  }

  /**
   * Check if AI PoUW is enabled and available
   */
  isAIEnabled(): boolean {
    return this.aiIntegration?.isAvailable() ?? false;
  }

  /**
   * Enable or disable AI PoUW
   */
  setAIEnabled(enabled: boolean): void {
    if (enabled && !this.aiIntegration) {
      // Create new AI integration
      this.aiIntegration = new AIWorkIntegration({
        enabled: true,
        taskFrequency: this.config.aiTaskFrequency ?? 1,
        preferWebGPU: this.config.preferWebGPU,
      });
    } else if (this.aiIntegration) {
      this.aiIntegration.setEnabled(enabled);
    }
  }

  /**
   * Set AI task frequency (every N shares)
   */
  setAITaskFrequency(frequency: number): void {
    this.config.aiTaskFrequency = frequency;
    this.aiIntegration?.setTaskFrequency(frequency);
  }

  /**
   * Get number of AI tasks completed
   */
  getAITasksCompleted(): number {
    return this.aiIntegration?.getTasksCompleted() ?? 0;
  }

  /**
   * Initialize AI engine proactively (optional)
   * Can be called before mining starts to pre-load models
   */
  async initializeAI(): Promise<void> {
    if (!this.aiIntegration) {
      this.aiIntegration = new AIWorkIntegration({
        enabled: true,
        taskFrequency: this.config.aiTaskFrequency ?? 1,
        preferWebGPU: this.config.preferWebGPU,
      });
    }
    await this.aiIntegration.initialize();
  }
}
