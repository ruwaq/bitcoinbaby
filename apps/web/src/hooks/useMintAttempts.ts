"use client";

/**
 * useMintAttempts Hook
 *
 * Fetches and tracks mint attempts for a user address.
 * Shows pending, failed, and recent successful mints.
 */

import { useState, useCallback, useEffect } from "react";
import { getApiClient, type MintAttempt } from "@bitcoinbaby/core";

interface UseMintAttemptsOptions {
  address?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
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
}

export function useMintAttempts({
  address,
  autoRefresh = true,
  refreshInterval = 30000,
}: UseMintAttemptsOptions): UseMintAttemptsReturn {
  const [attempts, setAttempts] = useState<MintAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiClient = getApiClient();
      const result = await apiClient.getMintAttempts(address);

      if (result.success && result.data) {
        setAttempts(result.data.attempts);
      } else {
        setError(result.error || "Failed to fetch mint attempts");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [address]);

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

  return {
    attempts,
    pendingAttempts,
    failedAttempts,
    isLoading,
    error,
    refresh,
    hasPending,
    hasFailed: failedAttempts.length > 0,
  };
}

export default useMintAttempts;
