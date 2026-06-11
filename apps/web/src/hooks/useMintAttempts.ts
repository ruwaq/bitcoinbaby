"use client";

/**
 * useMintAttempts Hook — TanStack Query powered
 *
 * Fetches and tracks mint attempts for a user address.
 * Shows pending, failed, and recent successful mints.
 * Supports clearing failed attempts and auto-cleanup after 5 minutes.
 *
 * Query key: ['mint-attempts', address]
 * Refetch interval: 30s when there are pending attempts, disabled otherwise
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getApiClient, type MintAttempt } from "@bitcoinbaby/core";

const FAILED_CLEANUP_DELAY_MS = 5 * 60 * 1000;

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

async function fetchMintAttempts(address: string): Promise<MintAttempt[]> {
  const apiClient = getApiClient();
  const result = await apiClient.getMintAttempts(address);
  if (result.success && result.data) {
    return result.data.attempts;
  }
  throw new Error(result.error || "Failed to fetch mint attempts");
}

export function useMintAttempts({
  address,
  autoRefresh = true,
  refreshInterval = 30000,
  autoCleanupFailed = true,
}: UseMintAttemptsOptions): UseMintAttemptsReturn {
  const queryClient = useQueryClient();

  // Track manually cleared failed attempt IDs
  const [clearedFailedIds, setClearedFailedIds] = useState<Set<string>>(
    new Set(),
  );

  // Track when failed attempts were first seen (for auto-cleanup)
  const failedFirstSeenRef = useRef<Map<string, number>>(new Map());

  // ---- TanStack Query ----
  const {
    data: rawAttempts = [],
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["mint-attempts", address],
    queryFn: async () => {
      if (!address) return [];
      const attempts = await fetchMintAttempts(address);

      // Track first-seen timestamps for auto-cleanup
      const now = Date.now();
      attempts.forEach((attempt) => {
        if (
          attempt.status === "failed" &&
          !failedFirstSeenRef.current.has(attempt.attemptId)
        ) {
          failedFirstSeenRef.current.set(attempt.attemptId, now);
        }
      });

      return attempts;
    },
    enabled: !!address,
    // Only poll when there are pending attempts
    refetchInterval: false, // We handle conditional polling below
    placeholderData: (prev) => prev,
  });

  // Filter attempts: remove manually cleared and auto-expired
  const attempts = rawAttempts.filter((attempt) => {
    if (clearedFailedIds.has(attempt.attemptId)) return false;

    if (autoCleanupFailed && attempt.status === "failed") {
      const firstSeen = failedFirstSeenRef.current.get(attempt.attemptId);
      if (firstSeen && Date.now() - firstSeen > FAILED_CLEANUP_DELAY_MS) {
        return false;
      }
    }

    return true;
  });

  const pendingAttempts = attempts.filter(
    (a) =>
      a.status === "reserved" ||
      a.status === "proving" ||
      a.status === "signing" ||
      a.status === "broadcasting",
  );

  const hasPending = pendingAttempts.length > 0;

  // Conditional polling: only poll when there are pending attempts
  useEffect(() => {
    if (!autoRefresh || !hasPending || !address) return;

    const interval = setInterval(() => {
      refetch();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, hasPending, address, refreshInterval, refetch]);

  // Refresh on visibility change (tab becomes visible)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && address) {
        refetch();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, refetch]);

  const refresh = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  const failedAttempts = attempts.filter((a) => a.status === "failed");

  const clearFailed = useCallback(() => {
    const newCleared = new Set(clearedFailedIds);
    failedAttempts.forEach((attempt) => {
      newCleared.add(attempt.attemptId);
    });
    setClearedFailedIds(newCleared);
  }, [failedAttempts, clearedFailedIds]);

  return {
    attempts,
    pendingAttempts,
    failedAttempts,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refresh,
    hasPending,
    hasFailed: failedAttempts.length > 0,
    clearFailed,
  };
}

export default useMintAttempts;
