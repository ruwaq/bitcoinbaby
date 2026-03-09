/**
 * WebGPUMiner - GPU-accelerated SHA-256d mining
 *
 * Uses WebGPU compute shaders for 10-100x faster hashing than CPU.
 * Architecture follows the BRO token pattern.
 */

import type { Miner, MiningResult } from "./types";
import { getNavigator } from "./capabilities";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("WebGPUMiner");

// Workgroup sizes to try, in preference order
const WORKGROUP_SIZES = [256, 128, 64] as const;

// How many nonces to process per GPU dispatch
// Start small to prevent system freeze on first dispatch
const DEFAULT_BATCH_SIZE = 4096;

// Maximum batch size to prevent GPU timeout/TDR
const MAX_BATCH_SIZE = 262144; // 256K max (was 1M - too aggressive)

// Minimum batch size for efficiency
const MIN_BATCH_SIZE = 1024;

// Target milliseconds per batch (auto-tuning)
// Higher value = safer but slower; lower = faster but riskier
const TARGET_BATCH_MS = 50; // ~20fps - safer for integrated GPUs

export class WebGPUMiner implements Miner {
  readonly type = "webgpu" as const;

  private device: GPUDevice | null = null;
  private pipeline: GPUComputePipeline | null = null;
  private bindGroup: GPUBindGroup | null = null;

  // Persistent GPU buffers
  private uniformBuffer: GPUBuffer | null = null;
  private challengeBuffer: GPUBuffer | null = null;
  private bestDigestBuffer: GPUBuffer | null = null;
  private bestInfoBuffer: GPUBuffer | null = null;
  private readDigestBuffer: GPUBuffer | null = null;
  private readInfoBuffer: GPUBuffer | null = null;

  private workgroupSize = 256;
  private batchSize = DEFAULT_BATCH_SIZE;

  // Mining state
  private running = false;
  private paused = false;
  private nonce = 0n;
  private difficulty = 16; // D16 minimum to match contract
  private throttle = 100;
  private challenge = "";
  private challengeByteLength = 0; // Cached challenge byte length for performance
  private minerAddress = "";
  private hashrate = 0;
  private totalHashes = 0;

  // Stats tracking
  private hashesThisSecond = 0;
  private lastStatsUpdate = Date.now();

  // Recovery state (prevents infinite crash loops)
  private totalRecoveryAttempts = 0; // Lifetime attempts across all sessions
  private maxLifetimeRecoveries = 10; // Maximum 10 total lifetime attempts
  private recoveryAttempts = 0; // Per-session attempts
  private maxRecoveryAttempts = 3; // Per-session limit
  private lastRecoveryTime = 0;
  private shouldRecover = false;

  // Callbacks
  private onHashrateUpdate?: (hashrate: number) => void;
  private onWorkFound?: (result: MiningResult) => void;
  private onStatusChange?: (status: "running" | "paused" | "stopped") => void;
  private onError?: (error: Error) => void;

  constructor(
    options: {
      difficulty?: number;
      address?: string;
      onHashrateUpdate?: (hashrate: number) => void;
      onWorkFound?: (result: MiningResult) => void;
      onStatusChange?: (status: "running" | "paused" | "stopped") => void;
      onError?: (error: Error) => void;
    } = {},
  ) {
    this.difficulty = options.difficulty ?? 16; // D16 minimum to match contract
    this.minerAddress = options.address ?? "";
    this.onHashrateUpdate = options.onHashrateUpdate;
    this.onWorkFound = options.onWorkFound;
    this.onStatusChange = options.onStatusChange;
    this.onError = options.onError;
  }

  // ----------------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------------

  async init(): Promise<void> {
    const nav = getNavigator();
    const gpu = nav?.gpu;
    if (!gpu) throw new Error("WebGPU not supported in this browser");

    const adapter = await gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) throw new Error("No WebGPU adapter found");

    this.device = await adapter.requestDevice({
      label: "BitcoinBaby miner",
    });

    // CRITICAL: Handle GPU device loss (prevents crashes from appearing as malware)
    // This can happen due to: driver crash, GPU timeout (TDR), system sleep, etc.
    this.device.lost.then((info) => {
      const wasRunning = this.running;
      this.running = false;

      log.error("GPU device lost", {
        reason: info.reason,
        message: info.message,
        wasRunning,
        totalRecoveryAttempts: this.totalRecoveryAttempts,
        sessionRecoveryAttempts: this.recoveryAttempts,
      });

      this.cleanupBuffers();
      this.device = null;
      this.pipeline = null;
      this.bindGroup = null;
      this.onStatusChange?.("stopped");

      // If the device was destroyed intentionally, don't try to recover
      if (info.reason === "destroyed") {
        return;
      }

      if (wasRunning) {
        this.totalRecoveryAttempts++;

        // Check lifetime limit to prevent infinite recovery loops
        if (this.totalRecoveryAttempts > this.maxLifetimeRecoveries) {
          log.error(
            "Max lifetime GPU recoveries exceeded, falling back to CPU",
          );
          this.onError?.(
            new Error(
              "GPU permanently unavailable after too many failures. Please use CPU mining.",
            ),
          );
          return;
        }

        // Exponential backoff: 1s, 2s, 4s, 8s... up to 30s max
        const backoffMs = Math.min(
          1000 * Math.pow(2, this.totalRecoveryAttempts - 1),
          30000,
        );

        log.info("Attempting GPU recovery", {
          attempt: this.totalRecoveryAttempts,
          maxAttempts: this.maxLifetimeRecoveries,
          backoffMs,
        });

        setTimeout(() => this.attemptRecovery(), backoffMs);
      }
    });

    // Choose workgroup size based on device limits
    const maxInvocations = this.device.limits.maxComputeInvocationsPerWorkgroup;
    this.workgroupSize = WORKGROUP_SIZES.find((s) => s <= maxInvocations) ?? 64;

    await this.buildPipeline();
  }

  private async buildPipeline(): Promise<void> {
    // Buffers are now created in prepareChallenge() to avoid redundant creation
    // This method is kept for potential future initialization logic
  }

  /**
   * Prepare challenge buffer and shader
   * FIX: Clean up ALL buffers first to prevent GPU memory leak on restart
   */
  private async prepareChallenge(challenge: string): Promise<void> {
    // Guard against device loss during recovery
    if (!this.device) {
      throw new Error("GPU device not available");
    }

    // Clean up all existing buffers before creating new ones
    // This prevents GPU memory leak if prepareChallenge is called multiple times
    this.cleanupBuffers();

    const device = this.device;

    // Recreate all persistent buffers that were destroyed by cleanupBuffers()
    this.uniformBuffer = device.createBuffer({
      label: "mining-params",
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bestDigestBuffer = device.createBuffer({
      label: "best-digest",
      size: 32,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    this.bestInfoBuffer = device.createBuffer({
      label: "best-info",
      size: 16,
      usage:
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_SRC |
        GPUBufferUsage.COPY_DST,
    });

    this.readDigestBuffer = device.createBuffer({
      label: "read-digest",
      size: 32,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    this.readInfoBuffer = device.createBuffer({
      label: "read-info",
      size: 16,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    // Encode challenge as UTF-8 bytes
    const encoder = new TextEncoder();
    const challengeBytes = encoder.encode(challenge);

    // Cache the byte length for computeBatch (avoids re-encoding on every batch)
    this.challengeByteLength = challengeBytes.length;

    // Pad to u32 boundary
    const paddedLen = Math.ceil(challengeBytes.length / 4) * 4;
    const paddedBytes = new Uint8Array(paddedLen);
    paddedBytes.set(challengeBytes);

    // Pack bytes big-endian into u32 array
    const u32Count = paddedLen / 4;
    const challengeU32 = new Uint32Array(u32Count);
    for (let i = 0; i < paddedLen; i++) {
      const wordIdx = Math.floor(i / 4);
      const byteShift = (3 - (i % 4)) * 8;
      challengeU32[wordIdx] |= paddedBytes[i] << byteShift;
    }

    // Create challenge buffer (cleanupBuffers already destroyed the old one)
    this.challengeBuffer = device.createBuffer({
      label: "challenge",
      size: Math.max(paddedLen, 4),
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.challengeBuffer, 0, challengeU32);

    // Build shader with workgroup size
    const shaderSource = getShaderSource(this.workgroupSize);

    const shaderModule = device.createShaderModule({
      label: "sha256d-miner",
      code: shaderSource,
    });

    // Bind group layout
    const bindGroupLayout = device.createBindGroupLayout({
      label: "mining-bgl",
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "read-only-storage" },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: "storage" },
        },
      ],
    });

    this.pipeline = device.createComputePipeline({
      label: "sha256d-pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
      }),
      compute: { module: shaderModule, entryPoint: "main" },
    });

    this.bindGroup = device.createBindGroup({
      label: "mining-bg",
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer! } },
        { binding: 1, resource: { buffer: this.challengeBuffer } },
        { binding: 2, resource: { buffer: this.bestDigestBuffer! } },
        { binding: 3, resource: { buffer: this.bestInfoBuffer! } },
      ],
    });
  }

  // ----------------------------------------------------------------
  // Batch dispatch
  // ----------------------------------------------------------------

  async computeBatch(
    startNonce: bigint,
    count: number,
  ): Promise<{
    bestDigest: Uint32Array;
    bestLeadingZeros: number;
    bestNonce: bigint;
  }> {
    const device = this.device!;
    const queue = device.queue;

    const startLo = Number(startNonce & 0xffffffffn) >>> 0;
    const startHi = Number((startNonce >> 32n) & 0xffffffffn) >>> 0;

    // Write uniform params (using cached challengeByteLength for performance)
    const uniformData = new Uint32Array([
      startLo,
      startHi,
      count,
      this.challengeByteLength, // Cached in prepareChallenge(), avoids TextEncoder on every batch
      this.difficulty,
      0,
    ]);
    queue.writeBuffer(this.uniformBuffer!, 0, uniformData);

    // Reset best result buffers
    queue.writeBuffer(this.bestDigestBuffer!, 0, new Uint8Array(32));
    queue.writeBuffer(this.bestInfoBuffer!, 0, new Uint8Array(16));

    // Encode and dispatch
    const encoder = device.createCommandEncoder({ label: "mining-batch" });
    const pass = encoder.beginComputePass({ label: "mining-pass" });

    pass.setPipeline(this.pipeline!);
    pass.setBindGroup(0, this.bindGroup!);

    const workgroupCount = Math.ceil(count / this.workgroupSize);
    pass.dispatchWorkgroups(workgroupCount);
    pass.end();

    // Copy results to MAP_READ buffers
    encoder.copyBufferToBuffer(
      this.bestDigestBuffer!,
      0,
      this.readDigestBuffer!,
      0,
      32,
    );
    encoder.copyBufferToBuffer(
      this.bestInfoBuffer!,
      0,
      this.readInfoBuffer!,
      0,
      16,
    );

    queue.submit([encoder.finish()]);

    // Read results back to CPU (with timeout to prevent hanging on device loss)
    await mapAsyncWithTimeout(this.readDigestBuffer!, GPUMapMode.READ);
    const digestData = new Uint32Array(
      this.readDigestBuffer!.getMappedRange(),
    ).slice();
    this.readDigestBuffer!.unmap();

    await mapAsyncWithTimeout(this.readInfoBuffer!, GPUMapMode.READ);
    const infoData = new Uint32Array(
      this.readInfoBuffer!.getMappedRange(),
    ).slice();
    this.readInfoBuffer!.unmap();

    const bestLeadingZeros = infoData[0] >>> 0;
    const bestNonceLo = BigInt(infoData[1] >>> 0);
    const bestNonceHi = BigInt(infoData[2] >>> 0);
    const bestNonce = (bestNonceHi << 32n) | bestNonceLo;

    return { bestDigest: digestData, bestLeadingZeros, bestNonce };
  }

  // ----------------------------------------------------------------
  // Mining loop
  // ----------------------------------------------------------------

  private async miningLoop(): Promise<void> {
    while (this.running) {
      if (this.paused) {
        await sleep(100);
        continue;
      }

      const batchStart = performance.now();

      try {
        const result = await this.computeBatch(this.nonce, this.batchSize);

        this.totalHashes += this.batchSize;
        this.hashesThisSecond += this.batchSize;
        this.nonce += BigInt(this.batchSize);

        // Check if any hash met difficulty target
        if (result.bestLeadingZeros >= this.difficulty) {
          const hashHex = Array.from(result.bestDigest)
            .map((w) => w.toString(16).padStart(8, "0"))
            .join("");

          const foundNonce = Number(result.bestNonce & 0xffffffffn);
          // CRITICAL: GPU encodes nonce as lowercase hex - must match for server validation
          const nonceHex = foundNonce.toString(16);
          this.onWorkFound?.({
            hash: hashHex,
            nonce: foundNonce,
            difficulty: result.bestLeadingZeros,
            timestamp: Date.now(),
            blockData: `${this.challenge}:${nonceHex}`, // Must be hex to match GPU hash
          });
        }
      } catch (err) {
        log.error("GPU batch error", { error: err });
        this.running = false;
        this.onStatusChange?.("stopped");
        // Propagate error to consumer for proper handling (e.g., device lost, OOM)
        const errorObj =
          err instanceof Error ? err : new Error("GPU batch error");
        this.onError?.(errorObj);
        break;
      }

      // Hashrate reporting
      const now = Date.now();
      if (now - this.lastStatsUpdate >= 1000) {
        this.hashrate = this.hashesThisSecond;
        this.onHashrateUpdate?.(this.hashrate);
        this.hashesThisSecond = 0;
        this.lastStatsUpdate = now;
      }

      // Auto-tune batch size (conservative to prevent GPU hangs)
      const batchMs = performance.now() - batchStart;
      if (batchMs < TARGET_BATCH_MS * 0.5 && this.batchSize < MAX_BATCH_SIZE) {
        // Only grow by 50% to avoid sudden spikes
        this.batchSize = Math.min(
          Math.floor(this.batchSize * 1.5),
          MAX_BATCH_SIZE,
        );
      } else if (
        batchMs > TARGET_BATCH_MS * 2 &&
        this.batchSize > MIN_BATCH_SIZE
      ) {
        // Shrink faster if batches are too slow
        this.batchSize = Math.max(
          Math.floor(this.batchSize / 2),
          MIN_BATCH_SIZE,
        );
      }

      // CRITICAL: Always yield to event loop to prevent system freeze
      // This ensures the browser can handle user input and other tasks
      // Minimum 1ms sleep prevents GPU from monopolizing the system
      const minYieldMs = 1;

      // Apply throttle with deterministic sleep (smoother than random batch-skipping)
      // At 100% throttle: minimal yield only
      // At 50% throttle: sleep equal to batch time (halves hashrate)
      // At 25% throttle: sleep 3x batch time (quarters hashrate)
      let sleepMs = minYieldMs;
      if (this.throttle < 100 && this.throttle > 0) {
        const sleepMultiplier = (100 - this.throttle) / this.throttle;
        sleepMs = Math.max(minYieldMs, Math.ceil(batchMs * sleepMultiplier));
      }
      await sleep(sleepMs);
    }
  }

  // ----------------------------------------------------------------
  // Miner interface
  // ----------------------------------------------------------------

  async start(block?: string): Promise<void> {
    if (this.running) return;

    try {
      if (!this.device) await this.init();

      this.challenge = `${block ?? Date.now()}:${this.minerAddress}`;
      await this.prepareChallenge(this.challenge);

      this.running = true;
      this.paused = false;
      this.nonce = 0n;
      this.totalHashes = 0;
      this.hashesThisSecond = 0;
      this.lastStatsUpdate = Date.now();

      this.onStatusChange?.("running");
      // Start mining loop without awaiting (runs in background)
      // Add .catch() to handle any errors that escape the internal try/catch
      this.miningLoop().catch((err) => {
        log.error("Unhandled mining loop error", { error: err });
        this.running = false;
        this.onStatusChange?.("stopped");
        this.onError?.(
          err instanceof Error ? err : new Error("Mining loop failed"),
        );
      });
    } catch (err) {
      log.error("WebGPU miner start error", { error: err });
      this.running = false;
      this.onStatusChange?.("stopped");
      // Propagate initialization/start errors (e.g., WebGPU not supported)
      const errorObj =
        err instanceof Error ? err : new Error("Failed to start WebGPU miner");
      this.onError?.(errorObj);
      throw err; // Re-throw for caller to handle
    }
  }

  stop(): void {
    this.running = false;
    this.paused = false;
    this.hashrate = 0;
    this.recoveryAttempts = 0; // Reset session attempts on manual stop
    this.onStatusChange?.("stopped");
  }

  /**
   * Reset the recovery counter (useful when user manually restarts mining)
   */
  resetRecoveryCounter(): void {
    this.totalRecoveryAttempts = 0;
    this.recoveryAttempts = 0;
  }

  pause(): void {
    this.paused = true;
    this.onStatusChange?.("paused");
  }

  resume(): void {
    this.paused = false;
    this.onStatusChange?.("running");
  }

  setDifficulty(difficulty: number): void {
    this.difficulty = difficulty;
  }

  setThrottle(percent: number): void {
    this.throttle = Math.max(0, Math.min(100, percent));
  }

  setAddress(address: string): void {
    this.minerAddress = address;
  }

  getHashrate(): number {
    return this.hashrate;
  }

  getTotalHashes(): number {
    return this.totalHashes;
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  terminate(): void {
    this.stop();
    this.shouldRecover = false; // Prevent recovery after explicit termination
    // Use cleanupBuffers for proper unmap handling
    this.cleanupBuffers();
    this.device?.destroy();
    this.device = null;
  }

  /**
   * Attempt to recover from GPU device loss
   * Uses exponential backoff and limits attempts to prevent crash loops
   */
  private async attemptRecovery(): Promise<void> {
    const now = Date.now();

    // Reset recovery attempts if enough time has passed (5 minutes)
    if (now - this.lastRecoveryTime > 300_000) {
      this.recoveryAttempts = 0;
    }

    // Check if we've exceeded max recovery attempts
    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      log.error("Max GPU recovery attempts reached. Please restart the app.");
      this.onError?.(
        new Error(
          "GPU recovery failed after multiple attempts. Mining stopped for safety.",
        ),
      );
      return;
    }

    this.recoveryAttempts++;
    this.lastRecoveryTime = now;

    log.info("GPU recovery attempt", {
      attempt: this.recoveryAttempts,
      maxAttempts: this.maxRecoveryAttempts,
    });

    try {
      // Clean up any remaining resources
      this.cleanupBuffers();

      // Reinitialize GPU
      await this.init();

      // Restore challenge if we had one
      if (this.challenge) {
        await this.prepareChallenge(this.challenge);
      }

      // Resume mining
      this.running = true;
      this.paused = false;
      this.onStatusChange?.("running");
      this.miningLoop().catch((err) => {
        log.error("Unhandled mining loop error after recovery", { error: err });
        this.running = false;
        this.onStatusChange?.("stopped");
        this.onError?.(
          err instanceof Error
            ? err
            : new Error("Mining loop failed after recovery"),
        );
      });

      log.info("GPU recovery successful!");
      // Reset all counters on successful recovery
      this.recoveryAttempts = 0;
      this.totalRecoveryAttempts = 0; // Reset lifetime counter on success
    } catch (err) {
      log.error("GPU recovery failed", { error: err });

      // If we still have attempts left, try again with exponential backoff
      if (this.recoveryAttempts < this.maxRecoveryAttempts) {
        const backoffMs = Math.pow(2, this.recoveryAttempts) * 1000; // 2s, 4s, 8s
        log.debug("Retrying recovery", { backoffSec: backoffMs / 1000 });
        setTimeout(() => this.attemptRecovery(), backoffMs);
      } else {
        this.onError?.(
          new Error(
            "GPU unavailable. Mining will use CPU fallback if available.",
          ),
        );
      }
    }
  }

  /**
   * Clean up GPU buffers without destroying device
   * IMPORTANT: Properly handles mapped buffers to prevent memory leaks
   */
  private cleanupBuffers(): void {
    // Helper to safely destroy a buffer (unmap first if needed)
    const safeDestroy = (buffer: GPUBuffer | null) => {
      if (!buffer) return;
      try {
        // GPUBuffer.mapState tells us if buffer is mapped
        // If mapped, unmap before destroying to prevent memory leak
        if (buffer.mapState === "mapped") {
          buffer.unmap();
        }
        buffer.destroy();
      } catch (e) {
        // Buffer may already be destroyed or in invalid state
        log.debug("Buffer cleanup warning", { error: e });
      }
    };

    safeDestroy(this.challengeBuffer);
    safeDestroy(this.uniformBuffer);
    safeDestroy(this.bestDigestBuffer);
    safeDestroy(this.bestInfoBuffer);
    safeDestroy(this.readDigestBuffer);
    safeDestroy(this.readInfoBuffer);

    this.challengeBuffer = null;
    this.uniformBuffer = null;
    this.bestDigestBuffer = null;
    this.bestInfoBuffer = null;
    this.readDigestBuffer = null;
    this.readInfoBuffer = null;
    this.pipeline = null;
    this.bindGroup = null;
  }
}

// ---- Helpers ----

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Map a GPU buffer with timeout to prevent hanging on device loss
 * If the device is lost, mapAsync can hang forever - this prevents that
 */
async function mapAsyncWithTimeout(
  buffer: GPUBuffer,
  mode: GPUMapModeFlags,
  timeoutMs = 5000,
): Promise<void> {
  const mapPromise = buffer.mapAsync(mode);
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(new Error("GPU buffer mapAsync timeout - device may be lost")),
      timeoutMs,
    );
  });
  await Promise.race([mapPromise, timeoutPromise]);
}

function getShaderSource(workgroupSize: number): string {
  return SHA256D_SHADER.replace(/WORKGROUP_SIZE/g, String(workgroupSize));
}

// SHA-256d WGSL Compute Shader
const SHA256D_SHADER = `
// SHA-256d WebGPU Compute Shader
// Each thread processes one nonce: hash(hash(challenge + nonce))

struct Params {
  startLo      : u32,
  startHi      : u32,
  count        : u32,
  challengeLen : u32,
  difficulty   : u32,
  _pad         : u32,
}

struct BestInfo {
  bestLz      : atomic<u32>,
  bestNonceLo : atomic<u32>,
  bestNonceHi : atomic<u32>,
  bestLock    : atomic<u32>,
}

@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> challengeBytes: array<u32>;
@group(0) @binding(2) var<storage, read_write> bestDigest: array<u32>;
@group(0) @binding(3) var<storage, read_write> bestInfo: BestInfo;

const K: array<u32, 64> = array<u32, 64>(
  0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u,
  0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
  0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
  0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
  0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu,
  0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
  0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u,
  0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
  0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
  0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
  0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u,
  0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
  0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u,
  0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
  0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
  0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u,
);

fn rotr(x: u32, n: u32) -> u32 { return (x >> n) | (x << (32u - n)); }
fn ch(x: u32, y: u32, z: u32) -> u32 { return (x & y) ^ (~x & z); }
fn maj(x: u32, y: u32, z: u32) -> u32 { return (x & y) ^ (x & z) ^ (y & z); }
fn ep0(x: u32) -> u32 { return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u); }
fn ep1(x: u32) -> u32 { return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u); }
fn sig0(x: u32) -> u32 { return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u); }
fn sig1(x: u32) -> u32 { return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u); }

fn sha256_block(msg: array<u32, 16>, state_in: array<u32, 8>) -> array<u32, 8> {
  var w: array<u32, 64>;
  for (var i = 0u; i < 16u; i++) { w[i] = msg[i]; }
  for (var i = 16u; i < 64u; i++) {
    w[i] = sig1(w[i - 2u]) + w[i - 7u] + sig0(w[i - 15u]) + w[i - 16u];
  }

  var a = state_in[0]; var b = state_in[1];
  var c = state_in[2]; var d = state_in[3];
  var e = state_in[4]; var f = state_in[5];
  var g = state_in[6]; var h = state_in[7];

  for (var i = 0u; i < 64u; i++) {
    let t1 = h + ep1(e) + ch(e, f, g) + K[i] + w[i];
    let t2 = ep0(a) + maj(a, b, c);
    h = g; g = f; f = e; e = d + t1;
    d = c; c = b; b = a; a = t1 + t2;
  }

  return array<u32, 8>(
    state_in[0] + a, state_in[1] + b,
    state_in[2] + c, state_in[3] + d,
    state_in[4] + e, state_in[5] + f,
    state_in[6] + g, state_in[7] + h,
  );
}

fn sha256_init() -> array<u32, 8> {
  return array<u32, 8>(
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u,
  );
}

fn sha256(raw: ptr<function, array<u32, 256>>, msgLen: u32) -> array<u32, 8> {
  var blocks: array<u32, 32>;
  let bitLen = msgLen * 8u;
  let blockCount = select(1u, 2u, msgLen >= 55u);

  for (var i = 0u; i < 32u; i++) { blocks[i] = 0u; }

  for (var i = 0u; i < msgLen; i++) {
    let word_idx = i / 4u;
    let byte_pos = 3u - (i % 4u);
    let byte_val = (*raw)[i];
    blocks[word_idx] = blocks[word_idx] | (byte_val << (byte_pos * 8u));
  }

  let pad_word = msgLen / 4u;
  let pad_byte = 3u - (msgLen % 4u);
  blocks[pad_word] = blocks[pad_word] | (0x80u << (pad_byte * 8u));

  let last_block_offset = (blockCount - 1u) * 16u;
  blocks[last_block_offset + 15u] = bitLen;

  var state = sha256_init();

  var block0: array<u32, 16>;
  for (var i = 0u; i < 16u; i++) { block0[i] = blocks[i]; }
  state = sha256_block(block0, state);

  if (blockCount == 2u) {
    var block1: array<u32, 16>;
    for (var i = 0u; i < 16u; i++) { block1[i] = blocks[16u + i]; }
    state = sha256_block(block1, state);
  }

  return state;
}

fn sha256_32(digest: array<u32, 8>) -> array<u32, 8> {
  var msg: array<u32, 16>;
  for (var i = 0u; i < 8u; i++) { msg[i] = digest[i]; }
  msg[8] = 0x80000000u;
  msg[9] = 0u; msg[10] = 0u; msg[11] = 0u;
  msg[12] = 0u; msg[13] = 0u; msg[14] = 0u;
  msg[15] = 256u;
  return sha256_block(msg, sha256_init());
}

fn count_leading_zeros(digest: array<u32, 8>) -> u32 {
  var lz = 0u;
  for (var i = 0u; i < 8u; i++) {
    let w = digest[i];
    let clz = countLeadingZeros(w);
    lz += clz;
    if (clz < 32u) { break; }
  }
  return lz;
}

@compute @workgroup_size(WORKGROUP_SIZE)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  if (idx >= params.count) { return; }

  var nonceLo = params.startLo + idx;
  var nonceHi = params.startHi + select(0u, 1u, nonceLo < params.startLo);

  var raw: array<u32, 256>;
  let clen = params.challengeLen;

  for (var i = 0u; i < clen; i++) {
    let word_idx = i / 4u;
    let byte_shift = (3u - (i % 4u)) * 8u;
    raw[i] = (challengeBytes[word_idx] >> byte_shift) & 0xFFu;
  }

  raw[clen] = 58u;
  var msgLen = clen + 1u;

  // OPTIMIZED: Hex encoding instead of decimal (shifts vs divisions)
  // Hex uses 16 chars max (64-bit) vs 20 chars for decimal
  // GPU integer shifts are much faster than division

  // Encode high 32 bits first (if non-zero), then low 32 bits
  let hasHi = (nonceHi != 0u);

  if (!hasHi && nonceLo == 0u) {
    // Special case: nonce is 0
    raw[msgLen] = 48u; // '0'
    msgLen++;
  } else {
    // Count leading hex digits to skip leading zeros
    var hiDigits = 0u;
    var loDigits = 0u;

    if (hasHi) {
      // Count significant digits in high word
      hiDigits = (32u - countLeadingZeros(nonceHi) + 3u) / 4u;
      loDigits = 8u; // All 8 digits of low word
    } else {
      // Count significant digits in low word only
      loDigits = (32u - countLeadingZeros(nonceLo) + 3u) / 4u;
    }

    // Output high word digits (if present)
    for (var i = hiDigits; i > 0u; i--) {
      let nibble = (nonceHi >> ((i - 1u) * 4u)) & 0xFu;
      raw[msgLen] = select(nibble + 48u, nibble + 87u, nibble > 9u); // '0'-'9' or 'a'-'f'
      msgLen++;
    }

    // Output low word digits
    for (var i = loDigits; i > 0u; i--) {
      let nibble = (nonceLo >> ((i - 1u) * 4u)) & 0xFu;
      raw[msgLen] = select(nibble + 48u, nibble + 87u, nibble > 9u);
      msgLen++;
    }
  }

  let digest1 = sha256(&raw, msgLen);
  let digest2 = sha256_32(digest1);
  let lz = count_leading_zeros(digest2);

  // Lock-free update: try to update best result without spinlock
  // This avoids GPU hang that can crash the entire system on Apple Silicon
  let prev_best = atomicMax(&bestInfo.bestLz, lz);
  if (lz > prev_best) {
    // Try to acquire lock with bounded attempts (prevents infinite loop)
    var acquired = false;
    for (var attempt = 0u; attempt < 32u; attempt++) {
      if (atomicCompareExchangeWeak(&bestInfo.bestLock, 0u, 1u).exchanged) {
        acquired = true;
        break;
      }
    }
    if (acquired) {
      // Double-check we still have the best result
      if (lz >= atomicLoad(&bestInfo.bestLz)) {
        atomicStore(&bestInfo.bestNonceLo, params.startLo + idx);
        atomicStore(&bestInfo.bestNonceHi, nonceHi);
        for (var i = 0u; i < 8u; i++) {
          bestDigest[i] = digest2[i];
        }
      }
      atomicStore(&bestInfo.bestLock, 0u);
    }
    // If we couldn't acquire lock after 32 attempts, skip this update
    // Another thread with equal or better result will update instead
  }
}
`;
