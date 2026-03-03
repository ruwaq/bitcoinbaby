/**
 * useLeaderboard - Hook for leaderboard data
 *
 * Fetches leaderboard entries from the Workers API.
 * Supports filtering by category and time period with pagination.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { getApiClient } from "../api/client";
import type {
  LeaderboardCategory,
  LeaderboardPeriod,
  LeaderboardEntry as ApiLeaderboardEntry,
} from "../api/types";

// Re-export types for convenience
export type { LeaderboardCategory, LeaderboardPeriod };

/**
 * Leaderboard entry with UI-specific fields
 */
export interface LeaderboardEntry {
  rank: number;
  address: string;
  displayName?: string;
  score: number;
  badge?: LeaderboardBadge;
  isCurrentUser: boolean;
}

export type LeaderboardBadge =
  | "whale"
  | "diamond"
  | "gold"
  | "silver"
  | "bronze"
  | "newbie"
  | "veteran";

export interface UseLeaderboardOptions {
  /** Initial category to display */
  initialCategory?: LeaderboardCategory;
  /** Initial time period */
  initialPeriod?: LeaderboardPeriod;
  /** Number of entries per page */
  pageSize?: number;
  /** User's wallet address (for highlighting) */
  userAddress?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

export interface UseLeaderboardReturn {
  // Data
  entries: LeaderboardEntry[];
  totalEntries: number;
  userRank: number | null;
  userScore: number;

  // Filters
  category: LeaderboardCategory;
  period: LeaderboardPeriod;
  setCategory: (category: LeaderboardCategory) => void;
  setPeriod: (period: LeaderboardPeriod) => void;

  // Pagination
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // State
  isLoading: boolean;
  error: string | null;
  /** True if data loaded successfully but no entries exist */
  isEmpty: boolean;
  /** True if this is the first load (no previous data) */
  isInitialLoad: boolean;

  // Actions
  refresh: () => void;

  // Helpers
  formatScore: (score: number) => string;
  truncateAddress: (address: string, chars?: number) => string;
}

/**
 * Get badge based on rank
 */
function getBadgeForRank(rank: number): LeaderboardBadge | undefined {
  if (rank <= 10) return "whale";
  if (rank <= 50) return "diamond";
  if (rank <= 100) return "gold";
  if (rank <= 500) return "silver";
  if (rank <= 1000) return "bronze";
  return undefined;
}

/**
 * Truncate address for display
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format score for display
 */
export function formatScore(
  score: number,
  category: LeaderboardCategory,
): string {
  if (category === "babies") {
    return `Lv.${score}`;
  }

  if (score >= 1e12) {
    return `${(score / 1e12).toFixed(2)}T`;
  }
  if (score >= 1e9) {
    return `${(score / 1e9).toFixed(2)}B`;
  }
  if (score >= 1e6) {
    return `${(score / 1e6).toFixed(2)}M`;
  }
  if (score >= 1e3) {
    return `${(score / 1e3).toFixed(2)}K`;
  }
  return score.toLocaleString();
}

export function useLeaderboard(
  options: UseLeaderboardOptions = {},
): UseLeaderboardReturn {
  const {
    initialCategory = "miners",
    initialPeriod = "alltime",
    pageSize = 10,
    userAddress,
    refreshInterval = 0,
  } = options;

  // Local state
  const [category, setCategory] =
    useState<LeaderboardCategory>(initialCategory);
  const [period, setPeriod] = useState<LeaderboardPeriod>(initialPeriod);
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Data state
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [userScore, setUserScore] = useState(0);

  // API client
  const client = useMemo(() => getApiClient(), []);

  // Transform API entries to UI entries
  const transformEntries = useCallback(
    (apiEntries: ApiLeaderboardEntry[]): LeaderboardEntry[] => {
      return apiEntries.map((entry) => ({
        rank: entry.rank,
        address: entry.address,
        score: entry.score,
        badge: getBadgeForRank(entry.rank),
        isCurrentUser: userAddress
          ? entry.address.toLowerCase() === userAddress.toLowerCase()
          : false,
      }));
    },
    [userAddress],
  );

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch leaderboard
      const response = await client.getLeaderboard(
        category,
        period,
        pageSize,
        page * pageSize,
      );

      if (response.success && response.data) {
        setEntries(transformEntries(response.data.entries));
        setTotalEntries(response.data.totalEntries);
        setHasLoadedOnce(true);
      } else {
        setError(response.error || "Failed to load leaderboard");
      }

      // Fetch user rank if address provided
      if (userAddress) {
        const rankResponse = await client.getUserRank(
          userAddress,
          category,
          period,
        );
        if (rankResponse.success && rankResponse.data) {
          setUserRank(rankResponse.data.rank);
          setUserScore(rankResponse.data.score);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load leaderboard",
      );
    } finally {
      setIsLoading(false);
    }
  }, [client, category, period, page, pageSize, userAddress, transformEntries]);

  // Initial fetch and refresh on filter change
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchLeaderboard();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, fetchLeaderboard]);

  // Reset page when category or period changes
  useEffect(() => {
    setPage(0);
  }, [category, period]);

  // Calculate total pages
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));

  // Navigation helpers
  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages - 1));
  }, [totalPages]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 0));
  }, []);

  // Refresh function
  const refresh = useCallback(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Format score helper
  const formatScoreHelper = useCallback(
    (score: number) => formatScore(score, category),
    [category],
  );

  // Derived states
  const isEmpty = !isLoading && !error && entries.length === 0 && hasLoadedOnce;
  const isInitialLoad = isLoading && !hasLoadedOnce;

  return {
    // Data
    entries,
    totalEntries,
    userRank,
    userScore,

    // Filters
    category,
    period,
    setCategory,
    setPeriod,

    // Pagination
    page,
    totalPages,
    setPage,
    nextPage,
    prevPage,

    // State
    isLoading,
    error,
    isEmpty,
    isInitialLoad,

    // Actions
    refresh,

    // Helpers
    formatScore: formatScoreHelper,
    truncateAddress,
  };
}

/**
 * Category display info
 */
export const CATEGORY_INFO: Record<
  LeaderboardCategory,
  { label: string; description: string; icon: string }
> = {
  miners: {
    label: "TOP MINERS",
    description: "Most hashes computed",
    icon: "H",
  },
  babies: {
    label: "TOP BABIES",
    description: "Highest baby levels",
    icon: "B",
  },
  earners: {
    label: "TOP EARNERS",
    description: "Most $BABY earned",
    icon: "$",
  },
};

/**
 * Period display info
 */
export const PERIOD_INFO: Record<
  LeaderboardPeriod,
  { label: string; shortLabel: string }
> = {
  daily: { label: "Daily", shortLabel: "24H" },
  weekly: { label: "Weekly", shortLabel: "7D" },
  alltime: { label: "All Time", shortLabel: "ALL" },
};

export default useLeaderboard;
