"use client";

/**
 * MiningStatsGrid - Mining statistics display
 *
 * Shows mining stats in various layouts: list, grid, or compact.
 * Used in MiningSection for detailed stats display.
 */

import { clsx } from "clsx";

export interface MiningStats {
  /** Mining session uptime in seconds */
  uptime?: number;
  /** Total words/tokens learned */
  totalHashes: number;
  /** Valid shares found */
  shares: number;
  /** Current difficulty */
  difficulty: number;
  /** Miner type (CPU, WebGPU, etc.) */
  minerType?: string;
  /** Current speed in T/s */
  hashrate?: number;
}

export interface MiningStatsGridProps {
  /** Mining statistics */
  stats: MiningStats;
  /** Display variant */
  variant?: "list" | "grid" | "compact";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format uptime for display
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format speed (tokens/s) for display
 */
function formatHashrate(hashrate: number): string {
  if (hashrate >= 1_000_000) {
    return `${(hashrate / 1_000_000).toFixed(2)} MT/s`;
  }
  if (hashrate >= 1_000) {
    return `${(hashrate / 1_000).toFixed(2)} KT/s`;
  }
  return `${hashrate.toFixed(1)} T/s`;
}

/**
 * Format large numbers
 */
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(2)}B`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(2)}K`;
  }
  return num.toLocaleString();
}

/**
 * Format difficulty
 */
function formatDifficulty(difficulty: number): string {
  if (difficulty >= 1_000_000) {
    return `${(difficulty / 1_000_000).toFixed(2)}M`;
  }
  if (difficulty >= 1_000) {
    return `${(difficulty / 1_000).toFixed(2)}K`;
  }
  return difficulty.toString();
}

interface StatItemProps {
  label: string;
  value: string;
  variant: "list" | "grid" | "compact";
  highlight?: boolean;
}

function StatItem({ label, value, variant, highlight }: StatItemProps) {
  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2">
        <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
          {label}:
        </span>
        <span
          className={clsx(
            "font-pixel-mono text-[10px]",
            highlight ? "text-pixel-success" : "text-pixel-text",
          )}
        >
          {value}
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "p-2",
        "border-2 border-black",
        "bg-pixel-bg-light",
        variant === "list" && "flex items-center justify-between",
      )}
    >
      <div className="font-pixel text-[6px] text-pixel-text-muted uppercase">
        {label}
      </div>
      <div
        className={clsx(
          "font-pixel-mono",
          variant === "grid" ? "text-sm mt-1" : "text-[10px]",
          highlight ? "text-pixel-success" : "text-pixel-text",
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function MiningStatsGrid({
  stats,
  variant = "grid",
  className,
}: MiningStatsGridProps) {
  const items = [
    {
      label: "Uptime",
      value: stats.uptime !== undefined ? formatUptime(stats.uptime) : "--",
    },
    {
      label: "Words Learned",
      value: formatNumber(stats.totalHashes),
    },
    {
      label: "Shares",
      value: stats.shares.toLocaleString(),
      highlight: true,
    },
    {
      label: "Difficulty",
      value: formatDifficulty(stats.difficulty),
    },
  ];

  // Add optional stats
  if (stats.hashrate !== undefined) {
    items.unshift({
      label: "Speed",
      value: formatHashrate(stats.hashrate),
      highlight: true,
    });
  }

  if (stats.minerType) {
    items.push({
      label: "Model",
      value: stats.minerType === "webgpu" ? "Gemma 4 E2B (WebGPU)" : "Gemma 4 E2B (CPU)",
    });
  }

  if (variant === "compact") {
    return (
      <div className={clsx("flex flex-wrap gap-3", className)}>
        {items.map((item) => (
          <StatItem
            key={item.label}
            label={item.label}
            value={item.value}
            variant="compact"
            highlight={item.highlight}
          />
        ))}
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={clsx("space-y-2", className)}>
        {items.map((item) => (
          <StatItem
            key={item.label}
            label={item.label}
            value={item.value}
            variant="list"
            highlight={item.highlight}
          />
        ))}
      </div>
    );
  }

  // Grid variant (default)
  return (
    <div className={clsx("grid grid-cols-2 gap-2", className)}>
      {items.map((item) => (
        <StatItem
          key={item.label}
          label={item.label}
          value={item.value}
          variant="grid"
          highlight={item.highlight}
        />
      ))}
    </div>
  );
}
