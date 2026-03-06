/**
 * useSystemStatus Hook
 *
 * Fetches the Treasury/Signer system status from the Workers API.
 * Used to show users if withdrawals are fully operational.
 */

import { useState, useEffect, useCallback } from "react";

// Workers API URL from environment or default
const WORKERS_API_URL =
  process.env.NEXT_PUBLIC_WORKERS_API_URL ||
  "https://bitcoinbaby-api.workers.dev";

export type SystemStatus =
  | "operational"
  | "pending_signer"
  | "maintenance"
  | "error";

export interface SystemHealth {
  healthy: boolean;
  treasuryAddress: string | null;
  treasuryBalance: string;
  configuredForSigning: boolean;
  scrollsApiAvailable: boolean;
  readyBatchCount: number;
  message: string;
}

interface UseSystemStatusResult {
  status: SystemStatus;
  health: SystemHealth | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const DEFAULT_HEALTH: SystemHealth = {
  healthy: false,
  treasuryAddress: null,
  treasuryBalance: "0",
  configuredForSigning: false,
  scrollsApiAvailable: false,
  readyBatchCount: 0,
  message: "Loading...",
};

export function useSystemStatus(): UseSystemStatusResult {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to fetch from the signer health endpoint
      // This endpoint doesn't require auth for read-only status
      const response = await fetch(
        `${WORKERS_API_URL}/api/admin/signer/health`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        // API might not have this endpoint yet or requires auth
        // Fall back to pending_signer status
        setHealth({
          ...DEFAULT_HEALTH,
          message: "System status unavailable",
        });
        return;
      }

      const data = (await response.json()) as {
        success: boolean;
        data: SystemHealth;
      };

      if (data.success && data.data) {
        setHealth(data.data);
      } else {
        setHealth({
          ...DEFAULT_HEALTH,
          message: "Invalid response from API",
        });
      }
    } catch (err) {
      // Network error or API not available
      setError("Could not fetch system status");
      setHealth({
        ...DEFAULT_HEALTH,
        message: "Unable to check system status",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // Refresh every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Determine status from health data
  const getStatus = (): SystemStatus => {
    if (!health) {
      return "pending_signer";
    }

    if (health.healthy) {
      return "operational";
    }

    // Check specific conditions
    if (!health.configuredForSigning) {
      return "pending_signer";
    }

    if (health.treasuryBalance === "0") {
      return "pending_signer";
    }

    if (!health.scrollsApiAvailable) {
      return "maintenance";
    }

    return "error";
  };

  return {
    status: getStatus(),
    health,
    isLoading,
    error,
    refresh: fetchStatus,
  };
}
