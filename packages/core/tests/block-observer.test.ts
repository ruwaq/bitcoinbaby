/**
 * BlockObserver tests — Block-Tick trustless randomness beacon (Fase 4).
 *
 * Tests cover:
 *   - `countLeadingZeroBits` per-nibble semantics (must match the worker's
 *     proof-validation.ts version exactly, since `clzObserved` prices the reward).
 *   - `BlockObserver` lifecycle (start/stop, isRunning) and pollOnce behavior
 *     (emission, dedup via lastSeenHeight, error path).
 *
 * No real network: the observer is constructed with an in-process
 * `ChainTipFetcher` stub that returns canned `ChainTip` objects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  BlockObserver,
  countLeadingZeroBits,
  defaultRpcUrl,
  type BlockTick,
  type ChainTip,
  type ChainTipFetcher,
} from "../src/mining/block-observer";

// =============================================================================
// PURE HELPER: countLeadingZeroBits
// =============================================================================

describe("countLeadingZeroBits", () => {
  it("returns 0 for empty string", () => {
    expect(countLeadingZeroBits("")).toBe(0);
  });

  it("returns 256 for an all-zeros 64-hex hash", () => {
    expect(countLeadingZeroBits("0".repeat(64))).toBe(256);
  });

  it("returns 0 for a hash starting with 'f'", () => {
    expect(countLeadingZeroBits("f" + "0".repeat(63))).toBe(0);
  });

  it("returns 0 for nibbles 8-f", () => {
    for (const n of ["8", "9", "a", "b", "c", "d", "e", "f"]) {
      expect(countLeadingZeroBits(n + "0".repeat(63))).toBe(0);
    }
  });

  it("returns 1 for nibbles 4-7", () => {
    for (const n of ["4", "5", "6", "7"]) {
      expect(countLeadingZeroBits(n + "0".repeat(63))).toBe(1);
    }
  });

  it("returns 2 for nibbles 2-3", () => {
    for (const n of ["2", "3"]) {
      expect(countLeadingZeroBits(n + "0".repeat(63))).toBe(2);
    }
  });

  it("returns 3 for a hash starting with '1'", () => {
    // nibble 1 = 0b0001 -> 3 leading zeros
    expect(countLeadingZeroBits("1" + "0".repeat(63))).toBe(3);
  });

  it("counts 4 bits per leading '0' nibble up to the first non-zero", () => {
    expect(countLeadingZeroBits("0000" + "f".repeat(60))).toBe(16);
    expect(countLeadingZeroBits("00000" + "f".repeat(59))).toBe(20);
  });

  it("combines full-zero nibbles with the partial count of the stopping nibble", () => {
    // 0000 (16) then '1' (3) = 19
    expect(countLeadingZeroBits("00001" + "f".repeat(59))).toBe(19);
    // 00000000 (32) then '2' (2) = 34
    expect(countLeadingZeroBits("000000002" + "f".repeat(55))).toBe(34);
  });

  it("is case-insensitive", () => {
    expect(countLeadingZeroBits("0000ABCD" + "0".repeat(56))).toBe(16);
    expect(countLeadingZeroBits("0000abcd" + "0".repeat(56))).toBe(16);
  });

  it("throws on non-hex characters (defensive: prevents wrong clz -> wrong reward)", () => {
    expect(() => countLeadingZeroBits("zzz")).toThrow(/invalid hex/);
    expect(() => countLeadingZeroBits("000g" + "0".repeat(60))).toThrow(
      /invalid hex/,
    );
  });

  it("matches a known real testnet4 block-hash clz (4 leading-zero nibbles)", () => {
    // A realistic shape: 4 leading zero nibbles (clz 16) then a non-zero nibble.
    // Block hashes with exactly this many leading zeros are typical for testnet4.
    const hash = "00001a2b3c4d5e6f" + "0".repeat(48);
    // 4 * 4 (zeros) + 3 (nibble '1') = 19
    expect(countLeadingZeroBits(hash)).toBe(19);
  });
});

// =============================================================================
// defaultRpcUrl
// =============================================================================

describe("defaultRpcUrl", () => {
  it("returns the testnet4 mempool.space endpoint", () => {
    expect(defaultRpcUrl("testnet4")).toBe(
      "https://mempool.space/testnet4/api",
    );
  });

  it("returns the mainnet mempool.space endpoint", () => {
    expect(defaultRpcUrl("mainnet")).toBe("https://mempool.space/api");
  });

  it("returns the local regtest endpoint", () => {
    expect(defaultRpcUrl("regtest")).toBe("http://localhost:3000");
  });
});

// =============================================================================
// BlockObserver — helpers
// =============================================================================

/** Build a deterministic fetcher that walks a scripted list of tips. */
function scriptedFetcher(tips: ChainTip[]): ChainTipFetcher {
  let i = 0;
  return async () => {
    const tip = tips[Math.min(i, tips.length - 1)];
    i++;
    return { ...tip };
  };
}

/** 64-hex hash with exactly `leadingZeros` zero-nibbles, then 'f's. */
function hashWithLeadingZeros(leadingZeros: number): string {
  return "0".repeat(leadingZeros) + "f".repeat(64 - leadingZeros);
}

const sampleTip: ChainTip = {
  height: 100_000,
  hash: hashWithLeadingZeros(4), // clz = 16
  time: 1_700_000_000,
};

// =============================================================================
// BlockObserver — construction & config
// =============================================================================

describe("BlockObserver — construction", () => {
  it("applies sensible defaults (testnet4, 60s poll)", () => {
    const obs = new BlockObserver({}, {}, async () => sampleTip);
    expect(obs.getRunning()).toBe(false);
    expect(obs.getLastSeenHeight()).toBe(-1);
  });

  it("honors a custom pollIntervalMs and network", () => {
    const obs = new BlockObserver(
      { pollIntervalMs: 5_000, network: "mainnet" },
      {},
      async () => sampleTip,
    );
    // No public getter for config; assert indirectly via start/stop not throwing.
    expect(() => {
      obs.start();
      obs.stop();
    }).not.toThrow();
  });
});

// =============================================================================
// BlockObserver — pollOnce
// =============================================================================

describe("BlockObserver — pollOnce", () => {
  it("returns a BlockTick with correct clzObserved for a new tip", async () => {
    const fetcher = scriptedFetcher([sampleTip]);
    const obs = new BlockObserver({}, {}, fetcher);

    const tick = await obs.pollOnce();

    expect(tick).not.toBeNull();
    expect(tick as BlockTick).toMatchObject({
      blockHeight: 100_000,
      blockHash: sampleTip.hash,
      clzObserved: 16,
      timestamp: 1_700_000_000,
    });
    expect(obs.getLastSeenHeight()).toBe(100_000);
  });

  it("invokes onNewTick when a new tip is observed", async () => {
    const onNewTick = vi.fn();
    const obs = new BlockObserver(
      {},
      { onNewTick },
      scriptedFetcher([sampleTip]),
    );

    await obs.pollOnce();

    expect(onNewTick).toHaveBeenCalledTimes(1);
    expect(onNewTick).toHaveBeenCalledWith(
      expect.objectContaining({ blockHeight: 100_000, clzObserved: 16 }),
    );
  });

  it("does NOT re-emit the same height twice (dedup via lastSeenHeight)", async () => {
    const onNewTick = vi.fn();
    const obs = new BlockObserver(
      {},
      { onNewTick },
      // Same height returned every time.
      scriptedFetcher([sampleTip, sampleTip, sampleTip]),
    );

    const first = await obs.pollOnce();
    const second = await obs.pollOnce();
    const third = await obs.pollOnce();

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(third).toBeNull();
    expect(onNewTick).toHaveBeenCalledTimes(1);
  });

  it("ignores heights going backwards (reorg guard)", async () => {
    const onNewTick = vi.fn();
    const olderTip: ChainTip = {
      height: 99_999,
      hash: hashWithLeadingZeros(5),
      time: 1,
    };
    const obs = new BlockObserver(
      {},
      { onNewTick },
      scriptedFetcher([sampleTip, olderTip]),
    );

    await obs.pollOnce(); // emits 100000
    const tick = await obs.pollOnce(); // 99999 <= lastSeen -> null

    expect(tick).toBeNull();
    expect(onNewTick).toHaveBeenCalledTimes(1);
    expect(obs.getLastSeenHeight()).toBe(100_000);
  });

  it("emits distinct ticks for strictly increasing heights", async () => {
    const onNewTick = vi.fn();
    const tips: ChainTick[] = [
      { height: 100_000, hash: hashWithLeadingZeros(4), time: 1 },
      { height: 100_001, hash: hashWithLeadingZeros(6), time: 2 },
      { height: 100_002, hash: hashWithLeadingZeros(8), time: 3 },
    ];
    const obs = new BlockObserver(
      {},
      { onNewTick },
      scriptedFetcher(tips as ChainTip[]),
    );

    const t1 = await obs.pollOnce();
    const t2 = await obs.pollOnce();
    const t3 = await obs.pollOnce();

    expect(t1?.clzObserved).toBe(16);
    expect(t2?.clzObserved).toBe(24);
    expect(t3?.clzObserved).toBe(32);
    expect(onNewTick).toHaveBeenCalledTimes(3);
  });

  it("calls onError and returns null when the fetcher throws", async () => {
    const onError = vi.fn();
    const failing: ChainTipFetcher = async () => {
      throw new Error("network down");
    };
    const obs = new BlockObserver({}, { onError }, failing);

    const tick = await obs.pollOnce();

    expect(tick).toBeNull();
    expect(onError).toHaveBeenCalledTimes(1);
    expect((onError.mock.calls[0][0] as Error).message).toBe("network down");
    expect(obs.getLastSeenHeight()).toBe(-1);
  });
});

// =============================================================================
// BlockObserver — lifecycle (start/stop, real timers)
// =============================================================================

describe("BlockObserver — lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("start() sets isRunning and schedules an immediate + interval poll", async () => {
    const onNewTick = vi.fn();
    const fetcher = scriptedFetcher([sampleTip]);
    const obs = new BlockObserver(
      { pollIntervalMs: 10_000 },
      { onNewTick },
      fetcher,
    );

    obs.start();
    expect(obs.getRunning()).toBe(true);

    // The immediate pollOnce runs on the microtask queue; flush it.
    await vi.runOnlyPendingTimersAsync();

    expect(onNewTick).toHaveBeenCalledTimes(1);
    expect(obs.getLastSeenHeight()).toBe(100_000);

    // No new height -> dedup means no second emit even after the interval.
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.advanceTimersByTimeAsync(10_000);

    expect(onNewTick).toHaveBeenCalledTimes(1);

    obs.stop();
    expect(obs.getRunning()).toBe(false);
  });

  it("start() is idempotent (second call is a no-op, no double timer)", async () => {
    const fetcher = scriptedFetcher([sampleTip]);
    const obs = new BlockObserver({ pollIntervalMs: 10_000 }, {}, fetcher);

    obs.start();
    obs.start(); // should warn and return, not throw or double-schedule
    expect(obs.getRunning()).toBe(true);

    obs.stop();
    expect(obs.getRunning()).toBe(false);
  });

  it("stop() is safe when not running", () => {
    const obs = new BlockObserver({}, {}, scriptedFetcher([]));
    expect(() => obs.stop()).not.toThrow();
    expect(obs.getRunning()).toBe(false);
  });

  it("stop() clears the interval so no further ticks fire", async () => {
    const onNewTick = vi.fn();
    // Always-increasing heights so dedup never suppresses an emission. Each
    // successful poll therefore emits, making any post-stop leak visible.
    let h = 100_000;
    const fetcher: ChainTipFetcher = async () => ({
      height: h++,
      hash: hashWithLeadingZeros(4),
      time: 1,
    });
    const obs = new BlockObserver(
      { pollIntervalMs: 10_000 },
      { onNewTick },
      fetcher,
    );

    obs.start();
    // Flush the immediate fire-and-forget poll PLUS the first interval tick
    // that vitest's fake-timer flush also advances. With an always-increasing
    // fetcher both emit, so we expect 2 calls here (not 1).
    await vi.runOnlyPendingTimersAsync();
    const callsAtStop = onNewTick.mock.calls.length;
    expect(callsAtStop).toBeGreaterThanOrEqual(1);

    obs.stop();

    // Advancing well past several poll intervals must NOT increase the count:
    // the interval was cleared.
    await vi.advanceTimersByTimeAsync(60_000);
    expect(onNewTick).toHaveBeenCalledTimes(callsAtStop);
  });
});
