"use client";

/**
 * useSharedMining - SharedWorker-based Mining Hook
 *
 * Uses a SharedWorker for mining that persists across:
 * - Page navigations
 * - Multiple tabs (shared mining instance)
 *
 * Falls back to main-thread mining on iOS Safari which
 * doesn't support SharedWorker.
 *
 * Note: SharedWorker only supports CPU mining (no WebGPU in workers).
 * For WebGPU mining, use the regular useGlobalMining hook.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { MIN_DIFFICULTY } from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

interface SharedMiningState {
  isRunning: boolean;
  isPaused: boolean;
  hashrate: number;
  totalHashes: number;
  shares: number;
  difficulty: number;
  throttle: number;
  uptime: number;
  isConnected: boolean;
  connectionCount: number;
  supportsSharedWorker: boolean;
}

interface SharedMiningConfig {
  difficulty?: number;
  throttle?: number;
  autoReconnect?: boolean;
}

interface UseSharedMiningReturn extends SharedMiningState {
  start: (config?: { difficulty?: number }) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  setThrottle: (value: number) => void;
  setDifficulty: (value: number) => void;
  reconnect: () => void;
}

interface ShareData {
  hash: string;
  nonce: number;
  difficulty: number;
  zeroBits: number;
}

// =============================================================================
// SHARED WORKER CONNECTION
// =============================================================================

let sharedWorker: SharedWorker | null = null;
let messagePort: MessagePort | null = null;
const listeners = new Set<(state: Partial<SharedMiningState>) => void>();
const shareListeners = new Set<(share: ShareData) => void>();

function getSharedWorker(): SharedWorker | null {
  // Check SharedWorker support
  if (typeof SharedWorker === "undefined") {
    return null;
  }

  if (!sharedWorker) {
    try {
      sharedWorker = new SharedWorker("/workers/mining-shared-worker.js", {
        name: "bitcoinbaby-mining",
      });
      messagePort = sharedWorker.port;

      messagePort.onmessage = (event) => {
        const { type, data } = event.data;

        switch (type) {
          case "state":
            listeners.forEach((listener) =>
              listener({
                isRunning: data.isRunning,
                isPaused: data.isPaused,
                hashrate: data.hashrate,
                totalHashes: data.totalHashes,
                shares: data.shares,
                difficulty: data.difficulty,
                throttle: data.throttle,
                uptime: data.uptime,
                isConnected: true,
              }),
            );
            break;

          case "stats":
            listeners.forEach((listener) =>
              listener({
                hashrate: data.hashrate,
                totalHashes: data.totalHashes,
                shares: data.shares,
                uptime: data.uptime,
              }),
            );
            break;

          case "status":
            listeners.forEach((listener) =>
              listener({
                isRunning: data === "running",
                isPaused: data === "paused",
              }),
            );
            break;

          case "share":
            shareListeners.forEach((listener) => listener(data));
            break;

          case "pong":
            listeners.forEach((listener) => listener({ isConnected: true }));
            break;
        }
      };

      messagePort.onmessageerror = () => {
        listeners.forEach((listener) => listener({ isConnected: false }));
      };

      messagePort.start();

      // Request initial state
      messagePort.postMessage({ type: "getState" });
    } catch (error) {
      console.error("[useSharedMining] Failed to create SharedWorker:", error);
      return null;
    }
  }

  return sharedWorker;
}

function sendMessage(type: string, data?: unknown): void {
  if (messagePort) {
    messagePort.postMessage({ type, data });
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useSharedMining(
  config: SharedMiningConfig = {},
): UseSharedMiningReturn {
  const { autoReconnect = true } = config;
  const reconnectRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [state, setState] = useState<SharedMiningState>({
    isRunning: false,
    isPaused: false,
    hashrate: 0,
    totalHashes: 0,
    shares: 0,
    difficulty: config.difficulty || MIN_DIFFICULTY,
    throttle: config.throttle || 100,
    uptime: 0,
    isConnected: false,
    connectionCount: 0,
    supportsSharedWorker: typeof SharedWorker !== "undefined",
  });

  // Connect to SharedWorker
  useEffect(() => {
    const worker = getSharedWorker();

    if (!worker) {
      console.warn(
        "[useSharedMining] SharedWorker not supported. Use useGlobalMining as fallback.",
      );
      return;
    }

    // Subscribe to state updates
    const listener = (update: Partial<SharedMiningState>) => {
      setState((prev) => ({ ...prev, ...update }));
    };
    listeners.add(listener);

    // Set connected (async to comply with React Compiler)
    const connectTimeout = setTimeout(() => {
      setState((prev) => ({ ...prev, isConnected: true }));
    }, 0);

    // Ping periodically to check connection
    if (autoReconnect) {
      reconnectRef.current = setInterval(() => {
        sendMessage("ping");
      }, 5000);
    }

    return () => {
      clearTimeout(connectTimeout);
      listeners.delete(listener);
      if (reconnectRef.current) {
        clearInterval(reconnectRef.current);
      }
    };
  }, [autoReconnect]);

  // Mining controls
  const start = useCallback(
    (startConfig?: { difficulty?: number }) => {
      sendMessage("start", {
        difficulty:
          startConfig?.difficulty || config.difficulty || MIN_DIFFICULTY,
      });
    },
    [config.difficulty],
  );

  const stop = useCallback(() => {
    sendMessage("stop");
  }, []);

  const pause = useCallback(() => {
    sendMessage("pause");
  }, []);

  const resume = useCallback(() => {
    sendMessage("resume");
  }, []);

  const setThrottle = useCallback((value: number) => {
    sendMessage("setThrottle", value);
    setState((prev) => ({ ...prev, throttle: value }));
  }, []);

  const setDifficulty = useCallback((value: number) => {
    sendMessage("setDifficulty", value);
    setState((prev) => ({ ...prev, difficulty: value }));
  }, []);

  const reconnect = useCallback(() => {
    // Force reconnection by resetting the worker
    sharedWorker = null;
    messagePort = null;
    const worker = getSharedWorker();
    if (worker) {
      setState((prev) => ({ ...prev, isConnected: true }));
    }
  }, []);

  return {
    ...state,
    start,
    stop,
    pause,
    resume,
    setThrottle,
    setDifficulty,
    reconnect,
  };
}

// =============================================================================
// SHARE LISTENER HOOK
// =============================================================================

/**
 * Hook to listen for share events from the SharedWorker
 */
export function useSharedMiningShares(
  onShare: (share: ShareData) => void,
): void {
  useEffect(() => {
    shareListeners.add(onShare);
    return () => {
      shareListeners.delete(onShare);
    };
  }, [onShare]);
}

// =============================================================================
// FEATURE DETECTION
// =============================================================================

/**
 * Check if SharedWorker is supported
 */
export function supportsSharedWorker(): boolean {
  return typeof SharedWorker !== "undefined";
}

export type {
  SharedMiningState,
  SharedMiningConfig,
  UseSharedMiningReturn,
  ShareData,
};
