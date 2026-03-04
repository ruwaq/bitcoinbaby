"use client";

/**
 * MiningStatusBar - Compact mining status indicator
 *
 * Always visible in header showing:
 * - Mining state (running/paused/stopped)
 * - Current hashrate
 * - Shares found
 */

import { clsx } from "clsx";
import {
  useGlobalMining,
  formatHashrate,
  MIN_DIFFICULTY,
} from "@bitcoinbaby/core";
import { SyncStatusIndicator } from "./SyncStatusIndicator";

interface MiningStatusBarProps {
  onClick?: () => void;
  className?: string;
}

export function MiningStatusBar({ onClick, className }: MiningStatusBarProps) {
  const { isRunning, isPaused, hashrate, shares } = useGlobalMining({
    difficulty: MIN_DIFFICULTY,
    minerAddress: "status-bar",
  });

  const status = isRunning ? (isPaused ? "paused" : "mining") : "idle";

  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-2 px-3 py-1.5",
        "border-2 border-black bg-pixel-bg-dark",
        "font-pixel text-[8px] uppercase",
        "hover:bg-pixel-bg-light transition-colors",
        "shadow-[2px_2px_0_0_#000]",
        className,
      )}
    >
      {/* Mining icon with animation */}
      <span
        className={clsx(
          "text-base",
          status === "mining" && "animate-bounce",
          status === "paused" && "opacity-50",
        )}
      >
        ⛏️
      </span>

      {/* Status indicator dot */}
      <span
        className={clsx(
          "w-2 h-2 border border-black",
          status === "mining" && "bg-pixel-success animate-pulse",
          status === "paused" && "bg-pixel-warning",
          status === "idle" && "bg-pixel-text-muted",
        )}
      />

      {/* Hashrate */}
      <span
        className={clsx(
          "min-w-[60px] text-right",
          status === "mining" ? "text-pixel-success" : "text-pixel-text-muted",
        )}
      >
        {formatHashrate(hashrate)}
      </span>

      {/* Shares badge */}
      {shares > 0 && (
        <span className="px-1.5 py-0.5 bg-pixel-primary text-pixel-text-dark border border-black text-[7px]">
          +{shares}
        </span>
      )}

      {/* Sync status indicator */}
      <SyncStatusIndicator />
    </button>
  );
}

export default MiningStatusBar;
