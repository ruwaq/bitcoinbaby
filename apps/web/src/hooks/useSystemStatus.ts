/**
 * useSystemStatus Hook — TanStack Query powered
 *
 * Fetches the Treasury/Signer system status from the Workers API.
 * Used to show users if the claim system is fully operational.
 *
 * Query key: ['system-status']
 * Refetch interval: 5 minutes (system status changes slowly)
 */

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { createLogger, getWorkersApiUrl } from "@bitcoinbaby/shared";

const log = createLogger("SystemStatus");

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

async function fetchSystemHealth(): Promise<SystemHealth> {
  const response = await fetch(
    `${getWorkersApiUrl()}/api/admin/signer/health`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    },
  );

  if (!response.ok) {
    return { ...DEFAULT_HEALTH, message: "System status unavailable" };
  }

  const data = (await response.json()) as {
    success: boolean;
    data: SystemHealth;
  };

  if (data.success && data.data) {
    return data.data;
  }

  return { ...DEFAULT_HEALTH, message: "Invalid response from API" };
}

function deriveStatus(health: SystemHealth | null): SystemStatus {
  if (!health) return "pending_signer";
  if (health.healthy) return "operational";
  if (!health.configuredForSigning) return "pending_signer";
  if (health.treasuryBalance === "0") return "pending_signer";
  if (!health.scrollsApiAvailable) return "maintenance";
  return "error";
}

export function useSystemStatus(): UseSystemStatusResult {
  const {
    data: health,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ["system-status"],
    queryFn: fetchSystemHealth,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    placeholderData: (prev) => prev,
    retry: 1, // Only retry once for system status
  });

  const refresh = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  return {
    status: deriveStatus(health ?? null),
    health: health ?? null,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    refresh,
  };
}
