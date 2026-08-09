import type {
  MinerEvents,
  MiningResult,
  OrchestratorConfig,
  DeviceCapabilities,
  XPGainedEvent,
  AITask,
  AIProof,
  AIStatus,
} from "./types";
import { detectCapabilities } from "./capabilities";
import { MIN_DIFFICULTY } from "../tokenomics/constants";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("Orchestrator");
import { AIWorkIntegration } from "./ai-integration";
// TYPE-ONLY import: keeps the BlockObserver available as an optional hook
// without adding a runtime dependency that could affect import ordering in
// tests. The AI loop remains the active mining driver; the observer is wired
// in opportunistically (see setBlockObserver). See spec Sección 4 / Fase 4.
import type { BlockObserver } from "./block-observer";

const defaultConfig: OrchestratorConfig = {
  preferWebGPU: true,
  fallbackToCPU: true,
  throttleOnBattery: true,
  throttleWhenHidden: true,
  initialDifficulty: MIN_DIFFICULTY, // D22 - sustainable emission rate
  enableAIPoUW: true,
  aiTaskFrequency: 1, // Execute AI task on every share
};

/**
 * MiningOrchestrator - Coordinates the AI Proof-of-Useful-Work loop.
 *
 * NOTE: This orchestrator does NOT instantiate any miner. BitcoinBaby's
 * production model is "Block-Tick" (the player observes real Bitcoin blocks and
 * reacts to them; the player does not mine). `getMinerType()` therefore always
 * returns `null`. The reference CPU/WebGPU miners live under `./legacy/` but are
 * not wired in here.
 *
 * Basado en el patron del BRO token:
 * https://github.com/CharmsDev/bro/tree/main/webapp/src/mining
 */
export class MiningOrchestrator {
  private config: OrchestratorConfig;
  private events: Partial<MinerEvents> = {};
  private isRunning = false;
  private isStarting = false;
  private startCancelled = false;
  private cleanupFunctions: (() => void)[] = [];
  private currentBlockData?: string;
  private aiIntegration: AIWorkIntegration | null = null;
  private aiHashrate = 0;
  private aiTotalTokens = 0;
  private isPaused = false;
  private abortController: AbortController | null = null;
  /**
   * Optional Block-Tick observer (trustless randomness beacon, spec Sección 4).
   * When set, the orchestrator MAY consume observed ticks opportunistically.
   * The AI Proof-of-Useful-Work loop remains the active driver until a future
   * Fase replaces it; this field only makes the observer AVAILABLE here.
   */
  private blockObserver: BlockObserver | null = null;

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...defaultConfig, ...config };

    // Enforce MIN_DIFFICULTY on initial config
    if (this.config.initialDifficulty < MIN_DIFFICULTY) {
      log.warn("Initial difficulty below MIN_DIFFICULTY", {
        requested: this.config.initialDifficulty,
        enforced: MIN_DIFFICULTY,
      });
      this.config.initialDifficulty = MIN_DIFFICULTY;
    }

    // Initialize AI integration if enabled
    if (this.config.enableAIPoUW) {
      this.aiIntegration = this.createAIIntegration();
    }
  }

  private createAIIntegration(): AIWorkIntegration {
    return new AIWorkIntegration(
      {
        enabled: true,
        taskFrequency: this.config.aiTaskFrequency ?? 1,
      },
      (status) => {
        this.events.onAIStatusChange?.(status);
      },
    );
  }

  // Called by mining-singleton to populate status
  async detectCapabilities(): Promise<DeviceCapabilities> {
    const caps = await detectCapabilities();
    return caps;
  }

  /**
   * Initialize and start the appropriate miner
   */
  async start(blockData?: string): Promise<void> {
    if (this.isStarting) {
      log.warn("Start already in progress");
      return;
    }

    if (this.isRunning) {
      log.warn("Mining already running");
      return;
    }

    this.isStarting = true;
    this.startCancelled = false;
    this.isRunning = true;
    this.currentBlockData = blockData;

    try {
      // Initialize AI integration
      if (!this.aiIntegration) {
        this.aiIntegration = this.createAIIntegration();
      }
      await this.aiIntegration.initialize();

      if (this.startCancelled) {
        log.debug("Start cancelled during AI init");
        this.isRunning = false;
        this.isStarting = false;
        return;
      }

      if (!this.aiIntegration.isAvailable()) {
        this.isRunning = false;
        this.isStarting = false;
        this.events.onStatusChange?.("stopped");
        this.events.onError?.(
          new Error(
            "No AI provider configured. Go to Settings → AI Provider to connect Gemini, OpenAI, or another provider.",
          ),
        );
        return;
      }

      this.isPaused = false;
      this.isStarting = false;
      this.events.onStatusChange?.("running");

      this.runAILoop();
    } catch (error) {
      this.isRunning = false;
      this.isStarting = false;
      this.events.onError?.(
        error instanceof Error ? error : new Error("Failed to start mining"),
      );
      throw error;
    }
  }

  private calculateBaseXP(difficulty: number): number {
    const difficultyBonus = difficulty - MIN_DIFFICULTY;
    return Math.floor(100 * Math.pow(1.5, difficultyBonus));
  }

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

  stop(): void {
    if (this.isStarting) {
      this.startCancelled = true;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    const wasRunning = this.isRunning;
    this.isRunning = false;

    if (!wasRunning && !this.isStarting) {
      return;
    }

    this.events.onStatusChange?.("stopped");
  }

  pause(): void {
    if (this.isRunning) {
      this.isPaused = true;
      this.events.onStatusChange?.("paused");
    }
  }

  resume(): void {
    if (this.isRunning) {
      this.isPaused = false;
      this.events.onStatusChange?.("running");
    }
  }

  setDifficulty(difficulty: number): void {
    const safeDifficulty = Math.max(difficulty, MIN_DIFFICULTY);
    this.config.initialDifficulty = safeDifficulty;
  }

  updateConfig(config: Partial<OrchestratorConfig>): void {
    this.config = { ...this.config, ...config };
    if (this.config.initialDifficulty < MIN_DIFFICULTY) {
      this.config.initialDifficulty = MIN_DIFFICULTY;
    }
  }

  on<K extends keyof MinerEvents>(event: K, handler: MinerEvents[K]): void {
    this.events[event] = handler;
  }

  terminate(): void {
    this.startCancelled = true;
    this.isStarting = false;
    this.stop();
    // Stop the Block-Tick observer if one was attached so it doesn't leak a
    // polling interval. The caller owned it; we only guarantee cleanup.
    this.blockObserver?.stop();
    this.blockObserver = null;
    this.cleanupFunctions.forEach((cleanup) => cleanup());
    this.cleanupFunctions = [];
    this.aiIntegration?.terminate();
    this.aiIntegration = null;
  }

  // ==========================================================================
  // Getters (AI-only mining)
  // ==========================================================================

  getHashrate(): number {
    return this.aiHashrate;
  }

  getTotalHashes(): number {
    return this.aiTotalTokens;
  }

  getMinerType(): "cpu" | "webgpu" | null {
    // The orchestrator never instantiates a real miner; it only runs the AI
    // Proof-of-Useful-Work loop. Report `null` honestly so status surfaces
    // (e.g. via mining-singleton) don't claim a CPU/WebGPU miner is active.
    return null;
  }

  getCapabilities(): DeviceCapabilities | null {
    return null;
  }

  getIsRunning(): boolean {
    return this.isRunning;
  }

  // ==========================================================================
  // Block-Tick observer (optional, opportunistic — AI loop stays active)
  // ==========================================================================

  /**
   * Attach a {@link BlockObserver} so the orchestrator can consume observed
   * Bitcoin ticks. Does NOT replace the AI loop. The caller owns the observer's
   * lifecycle (start/stop); the orchestrator only stops it on terminate().
   */
  setBlockObserver(observer: BlockObserver | null): void {
    this.blockObserver = observer;
    log.info("BlockObserver attached", { attached: observer !== null });
  }

  /** Returns the attached BlockObserver, if any. */
  getBlockObserver(): BlockObserver | null {
    return this.blockObserver;
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
      this.aiIntegration = this.createAIIntegration();
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
      this.aiIntegration = this.createAIIntegration();
    }
    await this.aiIntegration.initialize();
  }

  /**
   * Run the sequential AI Proof of Useful Work loop
   *
   * Creates an AbortController for clean cancellation of in-flight
   * operations (fetch requests, AI inference). The controller is
   * aborted when stop() is called, allowing the loop to exit cleanly
   * without leaving dangling promises.
   */
  private async runAILoop(): Promise<void> {
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    log.info("Starting AI mining loop...");

    while (this.isRunning && !signal.aborted) {
      if (this.isPaused) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      try {
        const startTime = performance.now();
        const aiResult = await this.aiIntegration!.executeTask();

        if (!aiResult.success || !aiResult.proof) {
          log.warn("AI task failed, retrying in 3s...", {
            error: aiResult.error,
          });
          await new Promise((resolve) => setTimeout(resolve, 3000));
          continue;
        }

        const computeTime = performance.now() - startTime;
        const proofObj = JSON.parse(aiResult.proof) as AIProof;

        // Emit to narrative + signing pipeline
        const aiTask: AITask = {
          id: proofObj.taskId,
          type: "pouw",
          input: proofObj.inputPrompt,
          seed: proofObj.seed,
        };

        if (this.events.onAILocalTaskResolved) {
          this.events.onAILocalTaskResolved(proofObj, aiTask);
        }

        // XP gain event
        const baseXP = this.calculateBaseXP(MIN_DIFFICULTY);
        const aiMiningResult: MiningResult = {
          hash: proofObj.taskId,
          nonce: 0,
          difficulty: MIN_DIFFICULTY,
          timestamp: proofObj.timestamp,
          blockData: "",
          aiProof: aiResult.proof,
        };
        this.emitXPGained(aiMiningResult, baseXP);

        // Update AI metrics (tokens/s)
        const tokenCount = Math.ceil(proofObj.output.length / 4) + 1;
        this.aiTotalTokens += tokenCount;
        const tokensPerSecond = tokenCount / (computeTime / 1000);
        this.aiHashrate = tokensPerSecond;
        this.events.onHashrateUpdate?.(tokensPerSecond);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        log.error("Error in AI mining loop", { error });
        this.events.onError?.(
          error instanceof Error
            ? error
            : new Error("AI mining loop encountered an error"),
        );
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
    log.info("AI mining loop stopped.");
  }
}
