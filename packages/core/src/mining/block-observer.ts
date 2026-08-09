/**
 * BlockObserver — the trustless randomness beacon for the Block-Tick mining
 * model (spec Sección 4).
 *
 * In the Block-Tick model the player does NOT hash. Instead they observe real
 * Bitcoin blocks (whose proof-of-work has already been paid for by real miners)
 * and use each new block's hash as a public, inmanipulable randomness beacon.
 *
 * Every ~10 min Bitcoin mines a block. Its 64-hex little-endian hash is the
 * "tick". From it we derive `clzObserved` (leading-zero BITS of the hash), which
 * feeds the canonical BRO reward formula
 * (`packages/bitcoin/src/charms/bro-reward.ts::minedAmountBro`).
 *
 * Ecological: zero player hashing. Accessible: any client can poll a free RPC.
 *
 * NOTE on scope: this module is intentionally independent of the orchestrator.
 * The orchestrator keeps its AI loop for now; it may consume ticks
 * opportunistically via an optional hook. Replacing the AI loop wholesale is a
 * larger change tracked separately.
 */

import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("BlockObserver");

// =============================================================================
// TYPES
// =============================================================================

/**
 * A single observed Bitcoin block = one "tick" in the Block-Tick model.
 * The block hash is a trustless randomness beacon (no oracle needed).
 */
export interface BlockTick {
  /** Chain height of the block. */
  blockHeight: number;
  /** 64-hex-char little-endian block hash (the randomness beacon). */
  blockHash: string;
  /** Leading-zero BITS of blockHash (feeds the BRO reward formula). */
  clzObserved: number;
  /** Block header time, unix seconds. Feeds the halving schedule of BRO. */
  timestamp: number;
}

export interface BlockObserverConfig {
  /** Polling interval (ms). Default 60_000 (1 min) — blocks come every ~10 min. */
  pollIntervalMs?: number;
  /**
   * Base RPC URL for fetching the chain tip. If omitted, derived from `network`
   * via {@link defaultRpcUrl}.
   */
  rpcUrl?: string;
  /** Network. Determines the default endpoint when `rpcUrl` is omitted. */
  network?: "testnet4" | "mainnet" | "regtest";
}

export interface BlockObserverEvents {
  /** Emitted each time a NEW block height is observed. */
  onNewTick?: (tick: BlockTick) => void;
  /** Emitted when a poll fails. Observer keeps running. */
  onError?: (error: Error) => void;
}

/**
 * Raw chain-tip data returned by {@link ChainTipFetcher}.
 * Matches the mempool.space `/api/blocks/tip` payload shape.
 */
export interface ChainTip {
  height: number;
  /** 64-hex-char block hash (little-endian, as served by the REST API). */
  hash: string;
  /** Block header time, unix seconds. */
  time: number;
}

/**
 * Pluggable fetcher for the chain tip.
 *
 * Injecting this keeps the observer free of hard network dependencies: tests
 * pass a stub, production passes a `globalThis.fetch`-based implementation.
 * This mirrors the "pluggable fetcher" fallback the task anticipates.
 */
export type ChainTipFetcher = (rpcUrl: string) => Promise<ChainTip>;

// =============================================================================
// PURE HELPERS (unit-testable, no I/O)
// =============================================================================

/**
 * Count the leading-zero BITS of a 64-hex-char hash.
 *
 * Mirrors the per-nibble semantics used across the codebase:
 *   - `apps/workers/src/lib/proof-validation.ts::countLeadingZeroBits`
 *   - `packages/shared/src/utils/hash256.ts::countLeadingZeroBits`
 *   - `apps/workers/tests/fixtures/index.ts::countLeadingZeroBits`
 *
 * Per nibble (4 bits):
 *   0   → +4, continue
 *   1   → +3, stop   (0001)
 *   2-3 → +2, stop   (001x)
 *   4-7 → +1, stop   (01xx)
 *   8-f → +0, stop   (1xxx)
 *
 * Block hashes are little-endian, so leading zeros in the displayed hex = high
 * difficulty of the block — exactly what feeds `minedAmountBro(clz, blockTime)`.
 *
 * Input contract: a lowercase (or uppercase) hex string. Non-hex characters or
 * an odd-length string are treated as a programming error and throw, so callers
 * can't silently get a wrong `clzObserved` (which would mis-price a reward).
 * The empty string is allowed and returns 0.
 */
export function countLeadingZeroBits(hex: string): number {
  if (hex.length === 0) return 0;

  let zeroBits = 0;
  for (const char of hex.toLowerCase()) {
    const nibble = parseInt(char, 16);
    if (Number.isNaN(nibble) || char === " ") {
      throw new Error(
        `countLeadingZeroBits: invalid hex character "${char}" in "${hex.slice(0, 16)}..."`,
      );
    }
    if (nibble === 0) {
      zeroBits += 4;
    } else if (nibble <= 1) {
      zeroBits += 3;
      break;
    } else if (nibble <= 3) {
      zeroBits += 2;
      break;
    } else if (nibble <= 7) {
      zeroBits += 1;
      break;
    } else {
      break;
    }
  }
  return zeroBits;
}

// =============================================================================
// RPC ENDPOINTS
// =============================================================================

/**
 * Default REST base URL for a given network.
 *
 * - testnet4 / mainnet: mempool.space public REST API (free, CORS-enabled).
 * - regtest: the local docker stack's electrs/mempool backend on :3000.
 *   Best-effort — the local stack shape varies by deployment.
 */
export function defaultRpcUrl(
  network: "testnet4" | "mainnet" | "regtest",
): string {
  switch (network) {
    case "testnet4":
      return "https://mempool.space/testnet4/api";
    case "mainnet":
      return "https://mempool.space/api";
    case "regtest":
      return "http://localhost:3000";
  }
}

/**
 * Build a mempool.space `/blocks/tip` URL from a base.
 *
 * mempool.space returns the chain tip hash at `/blocks/tip/hash` (plain text)
 * and a richer payload at `/blocks/tip` (JSON with height, timestamp, id...).
 * We use the JSON endpoint so one round-trip yields height + hash + time.
 */
function tipUrl(rpcUrl: string): string {
  const base = rpcUrl.replace(/\/+$/, "");
  return `${base}/blocks/tip`;
}

/**
 * Production fetcher backed by `globalThis.fetch`.
 *
 * Hits mempool.space's `/blocks/tip` endpoint. The payload is an array of block
 * summaries; we take the first (the tip). We tolerate either an array or a
 * single object to stay robust across endpoint versions.
 */
export const defaultChainTipFetcher: ChainTipFetcher = async (
  rpcUrl: string,
) => {
  if (typeof globalThis.fetch !== "function") {
    throw new Error(
      "BlockObserver: globalThis.fetch is not available in this environment. " +
        "Inject a custom ChainTipFetcher.",
    );
  }

  const res = await globalThis.fetch(tipUrl(rpcUrl));
  if (!res.ok) {
    throw new Error(
      `BlockObserver: chain-tip fetch failed: HTTP ${res.status} ${res.statusText}`,
    );
  }
  const json = (await res.json()) as ChainTip | ChainTip[];
  const tip = Array.isArray(json) ? json[0] : json;
  if (!tip || typeof tip.height !== "number" || !tip.hash) {
    throw new Error(
      "BlockObserver: chain-tip payload missing height/hash fields",
    );
  }

  // mempool.space uses `id` for the hash and `timestamp` for the time in the
  // /blocks payload; the /blocks/tip single-object variant uses `time`. Accept
  // both spellings defensively.
  const hash = (tip as { id?: string; hash?: string }).id ?? tip.hash;
  const time =
    (tip as { timestamp?: number; time?: number }).timestamp ?? tip.time ?? 0;

  return { height: tip.height, hash, time };
};

// =============================================================================
// OBSERVER
// =============================================================================

/**
 * Watches the Bitcoin chain tip and emits a {@link BlockTick} each time a new
 * block appears. See module doc for the Block-Tick rationale.
 */
export class BlockObserver {
  private config: Required<BlockObserverConfig>;
  private events: BlockObserverEvents;
  private readonly fetcher: ChainTipFetcher;
  private isRunning = false;
  private lastSeenHeight = -1;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    config: BlockObserverConfig = {},
    events: BlockObserverEvents = {},
    fetcher: ChainTipFetcher = defaultChainTipFetcher,
  ) {
    const network = config.network ?? "testnet4";
    this.config = {
      pollIntervalMs: config.pollIntervalMs ?? 60_000,
      rpcUrl: config.rpcUrl ?? defaultRpcUrl(network),
      network,
    };
    this.events = events;
    this.fetcher = fetcher;
  }

  // --------------------------------------------------------------------------
  // Lifecycle
  // --------------------------------------------------------------------------

  /** Begin polling the chain tip at the configured interval. */
  start(): void {
    if (this.isRunning) {
      log.warn("BlockObserver already running");
      return;
    }
    this.isRunning = true;
    log.info("BlockObserver started", {
      network: this.config.network,
      pollIntervalMs: this.config.pollIntervalMs,
      rpcUrl: this.config.rpcUrl,
    });

    // Fire one poll immediately so callers don't wait up to `pollIntervalMs`
    // for the first tick, then schedule the recurring interval.
    void this.pollOnce().catch((err) => this.events.onError?.(err as Error));
    this.pollTimer = setInterval(() => {
      void this.pollOnce().catch((err) => this.events.onError?.(err as Error));
    }, this.config.pollIntervalMs);
  }

  /** Stop polling and clear the timer. Safe to call when not running. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.isRunning) {
      this.isRunning = false;
      log.info("BlockObserver stopped");
    }
  }

  getRunning(): boolean {
    return this.isRunning;
  }

  /** The most recent block height we have emitted (or -1 before any tick). */
  getLastSeenHeight(): number {
    return this.lastSeenHeight;
  }

  // --------------------------------------------------------------------------
  // Polling
  // --------------------------------------------------------------------------

  /**
   * Fetch the current chain tip ONCE and emit a tick if it is new.
   *
   * @returns the emitted {@link BlockTick}, or `null` if the tip was already
   *          seen (dedup via {@link lastSeenHeight}) or the chain went
   *          backwards (reorg / flapping node).
   */
  async pollOnce(): Promise<BlockTick | null> {
    let tip: ChainTip;
    try {
      tip = await this.fetcher(this.config.rpcUrl);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      log.error("pollOnce: fetch failed", { error: error.message });
      this.events.onError?.(error);
      return null;
    }

    // Dedup: ignore re-seen heights. Also guard against heights going backwards
    // (a node behind a reorg flapping); we never want to "rewind" the beacon.
    if (tip.height <= this.lastSeenHeight) {
      log.debug("pollOnce: tip already seen or stale", {
        height: tip.height,
        lastSeen: this.lastSeenHeight,
      });
      return null;
    }

    const clzObserved = countLeadingZeroBits(tip.hash);
    const tick: BlockTick = {
      blockHeight: tip.height,
      blockHash: tip.hash,
      clzObserved,
      timestamp: tip.time,
    };

    this.lastSeenHeight = tip.height;
    log.info("New tick", {
      height: tick.blockHeight,
      clz: tick.clzObserved,
      hash: tick.blockHash,
    });
    this.events.onNewTick?.(tick);
    return tick;
  }
}
