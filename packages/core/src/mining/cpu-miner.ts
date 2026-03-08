import type { Miner, MiningResult } from "./types";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("CPUMiner");

/**
 * CPUMiner - Mining using CPU via Web Worker
 *
 * Implements proof of work by searching for hashes with leading zeros.
 * Uses Web Workers to avoid blocking the main thread.
 */
export class CPUMiner implements Miner {
  readonly type = "cpu" as const;

  private workers: Worker[] = [];
  private workerUrl: string | null = null;
  private difficulty: number;
  private throttle = 100;
  private running = false;
  private paused = false;
  private isInitializing = false; // Prevents race condition in initWorkers
  private totalHashes = 0;
  private minerAddress = "";
  private workerCount: number;

  // Per-worker hashrates for aggregation
  private workerHashrates: Map<number, number> = new Map();
  private workerTotalHashes: Map<number, number> = new Map();

  // Worker restart tracking
  private workerRestartAttempts = new Map<number, number>();
  private maxWorkerRestarts = 3; // Maximum 3 restart attempts per worker
  private currentBlock?: string; // Current mining block for worker restarts

  // Callbacks
  private onHashrateUpdate?: (hashrate: number) => void;
  private onWorkFound?: (result: MiningResult) => void;
  private onStatusChange?: (status: "running" | "paused" | "stopped") => void;
  private onError?: (error: Error) => void;

  constructor(
    options: {
      difficulty?: number;
      address?: string;
      workerCount?: number;
      onHashrateUpdate?: (hashrate: number) => void;
      onWorkFound?: (result: MiningResult) => void;
      onStatusChange?: (status: "running" | "paused" | "stopped") => void;
      onError?: (error: Error) => void;
    } = {},
  ) {
    this.difficulty = options.difficulty ?? 16; // D16 minimum to match contract
    this.minerAddress = options.address ?? "";
    // Use specified count, or auto-detect CPU cores, or fallback to 1
    this.workerCount =
      options.workerCount ??
      (typeof navigator !== "undefined" ? navigator.hardwareConcurrency : 1) ??
      1;
    this.onHashrateUpdate = options.onHashrateUpdate;
    this.onWorkFound = options.onWorkFound;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
  }

  /**
   * Initialize the Web Workers (one per CPU core)
   */
  private initWorkers(): void {
    // FIX: Prevent race condition when start() is called multiple times rapidly
    if (this.workers.length > 0 || this.isInitializing) return;
    this.isInitializing = true;

    // Check if we're in a browser environment
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      log.warn("Web Workers not available, using fallback");
      this.isInitializing = false;
      return;
    }

    try {
      // Create worker from URL (works with Next.js)
      // The worker code is inlined as a blob for portability
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: "application/javascript" });
      this.workerUrl = URL.createObjectURL(blob);

      // Create multiple workers (one per core)
      for (let i = 0; i < this.workerCount; i++) {
        const worker = new Worker(this.workerUrl);
        this.setupWorkerHandlers(worker, i);
        this.workers.push(worker);
      }

      log.info("Initialized workers for parallel mining", {
        workerCount: this.workerCount,
      });
    } catch (error) {
      log.error("Failed to create mining workers", { error });
      // Propagate initialization errors
      const errorObj =
        error instanceof Error ? error : new Error("Failed to create workers");
      this.onError?.(errorObj);
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Restart a single worker that has crashed
   */
  private restartWorker(workerId: number): void {
    if (!this.running || !this.workerUrl) {
      return;
    }

    const attempts = this.workerRestartAttempts.get(workerId) ?? 0;

    if (attempts >= this.maxWorkerRestarts) {
      log.error("Worker exceeded max restart attempts", { workerId, attempts });

      // Only stop mining if ALL workers have failed
      const allFailed = this.workers.every((w, i) => {
        return (
          !w ||
          (this.workerRestartAttempts.get(i) ?? 0) >= this.maxWorkerRestarts
        );
      });

      if (allFailed) {
        log.error("All workers failed, stopping mining");
        this.running = false;
        this.terminateWorkers();
        this.onStatusChange?.("stopped");
        this.onError?.(new Error("All mining workers failed"));
      }
      return;
    }

    try {
      const newWorker = new Worker(this.workerUrl);
      this.setupWorkerHandlers(newWorker, workerId);
      this.workers[workerId] = newWorker;

      this.workerRestartAttempts.set(workerId, attempts + 1);

      // If there is an active block, restart mining on this worker
      if (this.currentBlock && this.minerAddress) {
        const nonceSpacing = Math.floor(
          Number.MAX_SAFE_INTEGER / this.workerCount,
        );
        newWorker.postMessage({
          type: "start",
          block: this.currentBlock,
          address: this.minerAddress,
          startNonce: workerId * nonceSpacing,
        });
      }

      log.info("Worker restarted successfully", {
        workerId,
        attempt: attempts + 1,
      });
    } catch (err) {
      log.error("Failed to restart worker", { workerId, error: err });
      this.workerRestartAttempts.set(workerId, attempts + 1);

      // Retry after a delay
      setTimeout(() => this.restartWorker(workerId), 1000);
    }
  }

  /**
   * Setup message handlers for a single worker
   */
  private setupWorkerHandlers(worker: Worker, workerId: number): void {
    worker.onmessage = (event) => {
      const { type, ...data } = event.data;

      switch (type) {
        case "hashrate":
          // Store per-worker hashrate and total
          this.workerHashrates.set(workerId, data.hashrate);
          this.workerTotalHashes.set(workerId, data.totalHashes);

          // Aggregate hashrates from all workers
          let totalHashrate = 0;
          let totalHashes = 0;
          for (const hr of this.workerHashrates.values()) totalHashrate += hr;
          for (const th of this.workerTotalHashes.values()) totalHashes += th;

          this.totalHashes = totalHashes;
          this.onHashrateUpdate?.(totalHashrate);
          break;

        case "found":
          this.onWorkFound?.({
            hash: data.hash,
            nonce: data.nonce,
            difficulty: data.difficulty,
            timestamp: Date.now(),
            blockData: data.blockData, // Include blockData for server validation
          });
          break;

        case "status":
          if (data.status === "stopped" && data.totalHashes) {
            this.workerTotalHashes.set(workerId, data.totalHashes);
          }
          // Only emit status change on first worker to avoid duplicates
          if (workerId === 0) {
            this.onStatusChange?.(data.status);
          }
          break;
      }
    };

    worker.onerror = (error) => {
      log.error("Mining worker error", {
        workerId,
        error: error.message,
        restartAttempts: this.workerRestartAttempts.get(workerId) ?? 0,
      });

      // Clean up the failed worker
      const index = this.workers.indexOf(worker);
      if (index > -1) {
        try {
          worker.terminate();
        } catch {
          // Ignore termination errors
        }
        // Mark as null temporarily (will be replaced by restartWorker)
        this.workers[index] = null as unknown as Worker;
      }

      // Clear hashrate data for this worker
      this.workerHashrates.delete(workerId);

      // Attempt to restart only this worker (not all workers)
      this.restartWorker(workerId);
    };
  }

  /**
   * Terminate all workers and clean up resources
   */
  private terminateWorkers(): void {
    for (const worker of this.workers) {
      if (worker) {
        try {
          worker.terminate();
        } catch {
          // Ignore termination errors
        }
      }
    }
    this.workers = [];
    this.workerHashrates.clear();
    this.workerTotalHashes.clear();
    this.workerRestartAttempts.clear(); // Reset restart attempts
    this.isInitializing = false; // Reset so workers can be re-initialized
    this.currentBlock = undefined; // Clear current block

    if (this.workerUrl) {
      URL.revokeObjectURL(this.workerUrl);
      this.workerUrl = null;
    }
  }

  /**
   * Get the worker code as a string
   * This allows the worker to be created as a Blob URL
   */
  private getWorkerCode(): string {
    return `
      // SHA256 returning raw bytes (Uint8Array)
      const sha256Bytes = async (data) => {
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return new Uint8Array(hashBuffer);
      };

      // Convert bytes to hex string
      const bytesToHex = (bytes) => {
        return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      };

      /**
       * Double SHA256 (Bitcoin standard hash256)
       * CRITICAL: Second SHA256 must be on the 32 BYTES, not the hex string!
       * This matches the server implementation in proof-validation.ts
       */
      const hash256 = async (message) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);

        // First SHA256 -> 32 bytes
        const firstHash = await sha256Bytes(data);

        // Second SHA256 on the 32 BYTES (not hex string!)
        const secondHash = await sha256Bytes(firstHash);

        // Return as hex string
        return bytesToHex(secondHash);
      };

      // Count leading zero bits in a hash
      const countLeadingZeroBits = (hash) => {
        let count = 0;
        for (const char of hash) {
          const nibble = parseInt(char, 16);
          if (nibble === 0) {
            count += 4;
          } else {
            if (nibble < 8) count += 1;
            if (nibble < 4) count += 1;
            if (nibble < 2) count += 1;
            break;
          }
        }
        return count;
      };

      // Worker state
      let isRunning = false;
      let isPaused = false;
      let difficulty = 16; // D16 minimum to match contract
      let throttle = 100;
      let nonce = 0;
      let totalHashes = 0;
      let currentBlock = '';
      let minerAddress = '';
      let hashesThisSecond = 0;
      let lastStatsUpdate = Date.now();

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Main mining function
      const mine = async () => {
        while (isRunning) {
          if (isPaused) {
            await sleep(100);
            continue;
          }

          const batchSize = Math.max(1, Math.floor(100 * (throttle / 100)));

          for (let i = 0; i < batchSize && isRunning && !isPaused; i++) {
            // Use hex nonce for consistency with WebGPU miner
            // Format: challenge:nonce where challenge = timestamp:address
            const nonceHex = nonce.toString(16);
            const challenge = currentBlock + ':' + minerAddress;
            const blockData = challenge + ':' + nonceHex;
            const hash = await hash256(blockData);
            totalHashes++;
            hashesThisSecond++;
            nonce++;

            const zeroBits = countLeadingZeroBits(hash);
            if (zeroBits >= difficulty) {
              self.postMessage({
                type: 'found',
                hash,
                nonce: nonce - 1,
                difficulty: zeroBits,
                blockData,
                challenge, // Include challenge for spell generation
              });
            }
          }

          const now = Date.now();
          if (now - lastStatsUpdate >= 1000) {
            self.postMessage({
              type: 'hashrate',
              hashrate: hashesThisSecond,
              totalHashes,
              nonce,
            });
            hashesThisSecond = 0;
            lastStatsUpdate = now;
          }

          await sleep(1);
        }
      };

      self.onmessage = async (event) => {
        const { type, ...data } = event.data;

        switch (type) {
          case 'start':
            if (!isRunning) {
              isRunning = true;
              isPaused = false;
              currentBlock = data.block || Date.now().toString();
              minerAddress = data.address || 'unknown';
              nonce = data.startNonce || 0;
              self.postMessage({ type: 'status', status: 'running' });
              mine();
            }
            break;

          case 'stop':
            isRunning = false;
            isPaused = false;
            self.postMessage({ type: 'status', status: 'stopped', totalHashes });
            break;

          case 'pause':
            isPaused = true;
            self.postMessage({ type: 'status', status: 'paused' });
            break;

          case 'resume':
            isPaused = false;
            self.postMessage({ type: 'status', status: 'running' });
            break;

          case 'config':
            if (typeof data.difficulty === 'number') difficulty = data.difficulty;
            if (typeof data.throttle === 'number') throttle = Math.max(0, Math.min(100, data.throttle));
            if (typeof data.block === 'string') { currentBlock = data.block; nonce = 0; }
            self.postMessage({ type: 'config', difficulty, throttle });
            break;
        }
      };
    `;
  }

  async start(block?: string): Promise<void> {
    if (this.running) return;

    this.initWorkers();
    this.running = true;
    this.paused = false;

    if (this.workers.length > 0) {
      // Start each worker with a different nonce range to avoid duplicates
      const blockId = block || Date.now().toString();
      this.currentBlock = blockId; // Save for worker restarts
      const nonceSpacing = Math.floor(
        Number.MAX_SAFE_INTEGER / this.workerCount,
      );

      this.workers.forEach((worker, index) => {
        if (worker) {
          worker.postMessage({
            type: "start",
            block: blockId,
            address: this.minerAddress,
            startNonce: index * nonceSpacing,
          });
        }
      });
    } else {
      // Fallback: simulate mining without worker
      this.startFallbackMining();
    }
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.currentBlock = undefined; // Clear current block
    this.workerRestartAttempts.clear(); // Reset restart attempts

    for (const worker of this.workers) {
      if (worker) {
        worker.postMessage({ type: "stop" });
      }
    }

    this.workerHashrates.clear();
  }

  pause(): void {
    this.paused = true;
    for (const worker of this.workers) {
      worker.postMessage({ type: "pause" });
    }
  }

  resume(): void {
    this.paused = false;
    for (const worker of this.workers) {
      worker.postMessage({ type: "resume" });
    }
  }

  setDifficulty(difficulty: number): void {
    this.difficulty = difficulty;
    for (const worker of this.workers) {
      worker.postMessage({ type: "config", difficulty });
    }
  }

  setThrottle(percent: number): void {
    this.throttle = Math.max(0, Math.min(100, percent));
    for (const worker of this.workers) {
      worker.postMessage({ type: "config", throttle: this.throttle });
    }
  }

  setAddress(address: string): void {
    this.minerAddress = address;
  }

  getHashrate(): number {
    // Sum hashrates from all workers
    let total = 0;
    for (const hr of this.workerHashrates.values()) total += hr;
    return total;
  }

  getTotalHashes(): number {
    return this.totalHashes;
  }

  getWorkerCount(): number {
    return this.workerCount;
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  /**
   * Terminate all workers and clean up
   */
  terminate(): void {
    this.stop();
    this.terminateWorkers();
  }

  /**
   * Fallback mining for environments without Web Workers
   * WARNING: This runs in the main thread and will be significantly slower
   * Uses real SHA-256d hashing via crypto.subtle
   */
  private startFallbackMining(): void {
    log.warn(
      "Running in fallback mode (no Web Workers). Mining will be slower.",
    );

    let nonce = 0;
    let lastUpdate = Date.now();
    let hashesThisSecond = 0;
    const currentBlock = Date.now().toString();

    // SHA-256 returning raw bytes
    const sha256Bytes = async (data: BufferSource): Promise<Uint8Array> => {
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      return new Uint8Array(hashBuffer);
    };

    // Convert bytes to hex string
    const bytesToHex = (bytes: Uint8Array): string => {
      return Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    };

    /**
     * Double SHA-256 (Bitcoin standard hash256)
     * CRITICAL: Second SHA256 must be on the 32 BYTES, not the hex string!
     * This matches the server implementation in proof-validation.ts
     */
    const hash256 = async (message: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);

      // First SHA256 -> 32 bytes
      const firstHash = await sha256Bytes(data);

      // Second SHA256 on the 32 BYTES (not hex string!)
      // Cast to ArrayBuffer to satisfy TypeScript (Uint8Array.buffer is always ArrayBuffer in practice)
      const secondHash = await sha256Bytes(firstHash.buffer as ArrayBuffer);

      // Return as hex string
      return bytesToHex(secondHash);
    };

    // Count leading zero bits
    const countLeadingZeroBits = (hash: string): number => {
      let count = 0;
      for (const char of hash) {
        const nibble = parseInt(char, 16);
        if (nibble === 0) {
          count += 4;
        } else {
          if (nibble < 8) count += 1;
          if (nibble < 4) count += 1;
          if (nibble < 2) count += 1;
          break;
        }
      }
      return count;
    };

    const mine = async () => {
      if (!this.running) return;
      if (this.paused) {
        setTimeout(mine, 100);
        return;
      }

      // Process fewer hashes per batch in main thread to keep UI responsive
      const batchSize = Math.max(1, Math.floor(10 * (this.throttle / 100)));

      for (let i = 0; i < batchSize && this.running && !this.paused; i++) {
        // Use hex nonce for consistency with WebGPU miner
        // Format: challenge:nonce where challenge = timestamp:address
        const nonceHex = nonce.toString(16);
        const challenge = `${currentBlock}:${this.minerAddress}`;
        const blockData = `${challenge}:${nonceHex}`;
        const hash = await hash256(blockData);
        this.totalHashes++;
        hashesThisSecond++;
        nonce++;

        const zeroBits = countLeadingZeroBits(hash);
        if (zeroBits >= this.difficulty) {
          this.onWorkFound?.({
            hash,
            nonce: nonce - 1,
            difficulty: zeroBits,
            timestamp: Date.now(),
            blockData, // Include blockData for server validation
            challenge, // Include challenge for spell generation
          });
        }
      }

      const now = Date.now();
      if (now - lastUpdate >= 1000) {
        this.onHashrateUpdate?.(hashesThisSecond);
        hashesThisSecond = 0;
        lastUpdate = now;
      }

      // Yield to event loop more frequently in fallback mode
      setTimeout(mine, 1);
    };

    mine().catch((err) => {
      log.error("Fallback mining error", { error: err });
      this.running = false;
      this.onStatusChange?.("stopped");
      this.onError?.(
        err instanceof Error ? err : new Error("Fallback mining failed"),
      );
    });
    this.onStatusChange?.("running");
  }
}
