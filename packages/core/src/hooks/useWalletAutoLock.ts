/**
 * useWalletAutoLock - Automatic wallet lock on inactivity
 *
 * Locks the wallet after a period of inactivity for security.
 * Tracks user activity (mouse, keyboard, touch) and resets the timer.
 *
 * Default: 15 minutes (900000ms)
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWalletStore } from "../stores/wallet-store";
import {
  useAutoLockTimeout,
  useAutoLockEnabled,
} from "../stores/settings-store";

// =============================================================================
// TYPES
// =============================================================================

interface UseWalletAutoLockOptions {
  /** Timeout in milliseconds (default: from settings or 15 minutes) */
  timeout?: number;
  /** Whether auto-lock is enabled (default: from settings or true) */
  enabled?: boolean;
  /** Events to track for activity (default: mouse, keyboard, touch) */
  events?: string[];
  /** Callback when wallet is auto-locked */
  onLock?: () => void;
}

interface UseWalletAutoLockReturn {
  /** Time remaining until lock (ms) */
  timeRemaining: number;
  /** Reset the inactivity timer */
  resetTimer: () => void;
  /** Lock the wallet immediately */
  lockNow: () => void;
  /** Whether auto-lock is currently enabled */
  isEnabled: boolean;
  /** Current timeout setting */
  timeout: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const DEFAULT_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const DEFAULT_EVENTS = [
  "mousedown",
  "mousemove",
  "keypress",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
];

// =============================================================================
// HOOK
// =============================================================================

export function useWalletAutoLock(
  options: UseWalletAutoLockOptions = {},
): UseWalletAutoLockReturn {
  // Get settings for auto-lock
  const settingsTimeout = useAutoLockTimeout();
  const settingsEnabled = useAutoLockEnabled();

  const {
    timeout = settingsTimeout || DEFAULT_TIMEOUT,
    enabled = settingsEnabled,
    events = DEFAULT_EVENTS,
    onLock,
  } = options;

  // Wallet state
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLocked = useWalletStore((s) => s.isLocked);
  const setLocked = useWalletStore((s) => s.setLocked);

  // Refs for timer management
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const timeRemainingRef = useRef<number>(timeout);

  // Lock the wallet
  const lockNow = useCallback(() => {
    if (isConnected && !isLocked) {
      setLocked(true);
      onLock?.();
      console.log("[AutoLock] Wallet locked due to inactivity");
    }
  }, [isConnected, isLocked, setLocked, onLock]);

  // Reset the inactivity timer
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    timeRemainingRef.current = timeout;

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer only if connected and not locked
    if (enabled && isConnected && !isLocked) {
      timerRef.current = setTimeout(() => {
        lockNow();
      }, timeout);
    }
  }, [enabled, isConnected, isLocked, timeout, lockNow]);

  // Activity handler
  const handleActivity = useCallback(() => {
    if (enabled && isConnected && !isLocked) {
      resetTimer();
    }
  }, [enabled, isConnected, isLocked, resetTimer]);

  // Set up activity listeners
  useEffect(() => {
    if (!enabled || !isConnected || isLocked) {
      return;
    }

    // Add listeners for all activity events
    events.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Start the initial timer
    resetTimer();

    return () => {
      // Clean up listeners
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });

      // Clear timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, isConnected, isLocked, events, handleActivity, resetTimer]);

  // Update time remaining periodically (for UI display)
  useEffect(() => {
    if (!enabled || !isConnected || isLocked) {
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      timeRemainingRef.current = Math.max(0, timeout - elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled, isConnected, isLocked, timeout]);

  // Reset timer when wallet is unlocked
  useEffect(() => {
    if (!isLocked && isConnected) {
      resetTimer();
    }
  }, [isLocked, isConnected, resetTimer]);

  return {
    timeRemaining: timeRemainingRef.current,
    resetTimer,
    lockNow,
    isEnabled: enabled,
    timeout,
  };
}

export default useWalletAutoLock;
