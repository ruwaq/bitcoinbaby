"use client";

/**
 * useMintAttempts Hook
 *
 * Fetches and tracks mint attempts for a user address.
 * Shows pending, failed, and recent successful mints.
 * Supports clearing failed attempts and auto-cleanup after 5 minutes.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { getApiClient, type MintAttempt } from "@bitcoinbaby/core";

// Auto-cleanup failed attempts after this many milliseconds
const FAILED_CLEANUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes

interface UseMintAttemptsOptions {
  address?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  autoCleanupFailed?: boolean;
}

interface UseMintAttemptsReturn {
  attempts: MintAttempt[];
  pendingAttempts: MintAttempt[];
  failedAttempts: MintAttempt[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasPending: boolean;
  hasFailed: boolean;
  clearFailed: () => void;
}

export function useMintAttempts({
  address,
  autoRefresh = true,
  refreshInterval = 30000,
  autoCleanupFailed = true,
}: UseMintAttemptsOptions): UseMintAttemptsReturn {
  const [attempts, setAttempts] = useState<MintAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track manually cleared failed attempt IDs
  const [clearedFailedIds, setClearedFailedIds] = useState<Set<string>>(
    new Set(),
  );

  // Track when failed attempts were first seen (for auto-cleanup)
  const failedFirstSeenRef = useRef<Map<string, number>>(new Map());

  const refresh = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      const result = await apiClient.getMintAttempts(address);

      if (result.success && result.data) {
        const now = Date.now();

        // Track when failed attempts are first seen
        result.data.attempts.forEach((attempt) => {
          if (
            attempt.status === "failed" &&
            !failedFirstSeenRef.current.has(attempt.attemptId)
          ) {
            failedFirstSeenRef.current.set(attempt.attemptId, now);
          }
        });

        // Filter out manually cleared and auto-expired failed attempts
        const filteredAttempts = result.data.attempts.filter((attempt) => {
          // Skip manually cleared
          if (clearedFailedIds.has(attempt.attemptId)) {
            return false;
          }

          // Auto-cleanup old failed attempts
          if (autoCleanupFailed && attempt.status === "failed") {
            const firstSeen = failedFirstSeenRef.current.get(attempt.attemptId);
            if (firstSeen && now - firstSeen > FAILED_CLEANUP_DELAY_MS) {
              return false;
            }
          }

          return true;
        });

        setAttempts(filteredAttempts);
      } else {
        setError(result.error || "Failed to fetch mint attempts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [address, clearedFailedIds, autoCleanupFailed]);

  // Initial fetch
  useEffect(() => {
    if (address) {
      refresh();
    } else {
      setAttempts([]);
    }
  }, [address, refresh]);

  // Auto-refresh when there are pending attempts
  const pendingAttempts = attempts.filter(
    (a) =>
      a.status === "reserved" ||
      a.status === "proving" ||
      a.status === "signing" ||
      a.status === "broadcasting",
  );

  const hasPending = pendingAttempts.length > 0;

  useEffect(() => {
    if (!autoRefresh || !hasPending || !address) return;

    const interval = setInterval(() => {
      refresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, hasPending, address, refreshInterval, refresh]);

  // Also refresh on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && address) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, refresh]);

  const failedAttempts = attempts.filter((a) => a.status === "failed");

  // Clear all failed attempts from view
  const clearFailed = useCallback(() => {
    const newCleared = new Set(clearedFailedIds);
    failedAttempts.forEach((attempt) => {
      newCleared.add(attempt.attemptId);
    });
    setClearedFailedIds(newCleared);

    // Remove from attempts immediately
    setAttempts((prev) =>
      prev.filter((a) => a.status !== "failed" || !newCleared.has(a.attemptId)),
    );
  }, [failedAttempts, clearedFailedIds]);

  return {
    attempts,
    pendingAttempts,
    failedAttempts,
    isLoading,
    error,
    refresh,
    hasPending,
    hasFailed: failedAttempts.length > 0,
    clearFailed,
  };
}

export default useMintAttempts;
