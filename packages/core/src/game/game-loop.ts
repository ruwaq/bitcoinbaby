/**
 * Unified Game Loop — Fixed Timestep Pattern
 *
 * A single requestAnimationFrame-based loop that dispatches work at
 * the appropriate cadence. Replaces 11 independent setInterval timers
 * with one coordinated loop.
 *
 * Architecture:
 *   Master Loop (rAF, ~60fps)
 *     ├── Accumulates delta time
 *     ├── Every ~1s:  uptime, cooldowns, UI timers
 *     ├── Every ~5s:  tab count poll
 *     ├── Every ~10s: game engine tick (stat decay, visual state)
 *     ├── Every ~30s: game engine save, engagement save
 *     └── Every ~60s: cosmic update, engagement play time, midnight check, dedup cleanup
 *
 * Based on: https://gafferongames.com/post/fix_your_timestep/
 *
 * Key principle: update(dt) is separated from render().
 * The loop updates stores/singletons; React re-renders via subscriptions.
 */

import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("GameLoop");

// =============================================================================
// TYPES
// =============================================================================

/** A task registered with the game loop */
export interface LoopTask {
  /** Unique identifier */
  id: string;
  /** Called every frame with delta time in ms */
  update: (dt: number) => void;
  /** Minimum interval between calls in ms (throttles the task) */
  intervalMs: number;
  /** Time since last invocation (managed by the loop) */
  _lastRun: number;
}

/** Configuration for the game loop */
export interface GameLoopConfig {
  /** Target updates per second (default: 60) */
  targetUPS?: number;
  /** Max delta time to prevent spiral of death (default: 1000ms) */
  maxDeltaMs?: number;
}

// =============================================================================
// GAME LOOP
// =============================================================================

export class GameLoop {
  private tasks: Map<string, LoopTask> = new Map();
  private rafId: number | null = null;
  private lastTime: number = 0;
  private isRunning: boolean = false;
  private targetDeltaMs: number;
  private maxDeltaMs: number;
  private accumulatedTime: number = 0;

  constructor(config: GameLoopConfig = {}) {
    this.targetDeltaMs = 1000 / (config.targetUPS ?? 60);
    this.maxDeltaMs = config.maxDeltaMs ?? 1000;
  }

  // ---- Task Management ----

  /**
   * Register a task to be called at the specified interval.
   * Tasks are throttled — they won't be called more often than intervalMs.
   *
   * @example
   * loop.registerTask({
   *   id: 'uptime',
   *   update: (dt) => { uptime += dt / 1000; },
   *   intervalMs: 1000,
   * });
   */
  registerTask(task: Omit<LoopTask, "_lastRun">): void {
    if (this.tasks.has(task.id)) {
      log.warn(`Task "${task.id}" already registered. Overwriting.`);
    }
    this.tasks.set(task.id, { ...task, _lastRun: 0 });
    log.debug(`Registered task: ${task.id} (every ${task.intervalMs}ms)`);
  }

  /** Remove a task by ID */
  unregisterTask(id: string): void {
    this.tasks.delete(id);
    log.debug(`Unregistered task: ${id}`);
  }

  /** Check if a task is registered */
  hasTask(id: string): boolean {
    return this.tasks.has(id);
  }

  // ---- Lifecycle ----

  /**
   * Start the game loop.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.lastTime = performance.now();
    this.accumulatedTime = 0;
    this.rafId = requestAnimationFrame(this.loop);
    log.info("Game loop started");
  }

  /**
   * Stop the game loop.
   * Safe to call multiple times — subsequent calls are no-ops.
   */
  stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    log.info("Game loop stopped");
  }

  /** Whether the loop is currently running */
  get running(): boolean {
    return this.isRunning;
  }

  // ---- Internal Loop ----

  /**
   * Main loop function — called via requestAnimationFrame.
   * Uses fixed timestep accumulation to handle variable frame rates.
   *
   * Arrow function to preserve `this` binding for rAF callback.
   */
  private loop = (currentTime: number): void => {
    if (!this.isRunning) return;

    // Calculate delta, cap to prevent spiral of death
    let dt = currentTime - this.lastTime;
    this.lastTime = currentTime;

    if (dt > this.maxDeltaMs) {
      log.warn(`Delta clamped: ${dt.toFixed(0)}ms → ${this.maxDeltaMs}ms`);
      dt = this.maxDeltaMs;
    }

    this.accumulatedTime += dt;

    // Fixed timestep: run updates at target frequency
    while (this.accumulatedTime >= this.targetDeltaMs) {
      this.updateTasks(this.targetDeltaMs);
      this.accumulatedTime -= this.targetDeltaMs;
    }

    // Schedule next frame
    this.rafId = requestAnimationFrame(this.loop);
  };

  /**
   * Run all registered tasks that are due.
   * Each task tracks its own lastRun time for throttling.
   */
  private updateTasks(_dt: number): void {
    const now = performance.now();

    for (const task of this.tasks.values()) {
      const elapsed = now - task._lastRun;

      if (elapsed >= task.intervalMs) {
        try {
          // Pass the actual elapsed time so tasks can compute accurate deltas
          task.update(elapsed);
          task._lastRun = now;
        } catch (error) {
          log.error(`Task "${task.id}" error`, {
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't let one failing task break the loop
        }
      }
    }
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

/** Global game loop instance — created lazily */
let _instance: GameLoop | null = null;

/**
 * Get the global GameLoop singleton.
 * Creates it on first call.
 */
export function getGameLoop(): GameLoop {
  if (!_instance) {
    _instance = new GameLoop();
  }
  return _instance;
}

/**
 * Initialize and start the global game loop with standard tasks.
 * Called once at app startup.
 */
export function initGameLoop(): GameLoop {
  const loop = getGameLoop();

  if (loop.running) {
    log.debug("Game loop already running");
    return loop;
  }

  loop.start();
  return loop;
}

/**
 * Stop and destroy the global game loop.
 * Called on app shutdown.
 */
export function destroyGameLoop(): void {
  if (_instance) {
    _instance.stop();
    _instance = null;
  }
}
