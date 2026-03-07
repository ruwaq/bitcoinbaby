"use client";

/**
 * RewardInfoPanel - Mining Reward Information
 *
 * Shows BRO-style reward tiers based on difficulty:
 * - Current difficulty reward
 * - Reward table by difficulty
 * - Distribution breakdown
 */

import { useState } from "react";
import { HelpTooltip, pixelBorders } from "@bitcoinbaby/ui";

interface RewardInfoPanelProps {
  /** Current mining difficulty (leading zeros) */
  currentDifficulty?: number;
  /** Whether panel is expanded by default */
  defaultExpanded?: boolean;
}

// Token config (matches packages/bitcoin/src/charms/token.ts)
const BABTC_CONFIG = {
  ticker: "BABTC",
  rewards: {
    baseReward: 100_00000000n, // 100 BABTC
    minDifficulty: 22,
    maxDifficulty: 32,
    difficultyFactor: 100n,
  },
  distribution: {
    miner: 90,
    dev: 5,
    staking: 5,
  },
};

function calculateReward(difficulty: number): {
  total: bigint;
  minerShare: bigint;
} {
  const { baseReward, minDifficulty, maxDifficulty, difficultyFactor } =
    BABTC_CONFIG.rewards;

  const clampedDiff = Math.max(
    minDifficulty,
    Math.min(maxDifficulty, difficulty),
  );
  const clzSquared = BigInt(clampedDiff * clampedDiff);
  const total = (baseReward * clzSquared) / difficultyFactor;
  const minerShare = (total * BigInt(BABTC_CONFIG.distribution.miner)) / 100n;

  return { total, minerShare };
}

function formatReward(amount: bigint): string {
  const whole = amount / 100_000_000n;
  const fraction = amount % 100_000_000n;
  const fractionStr = fraction
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "")
    .padEnd(2, "0");
  return `${whole}.${fractionStr}`;
}

export function RewardInfoPanel({
  currentDifficulty = 22,
  defaultExpanded = false,
}: RewardInfoPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const currentReward = calculateReward(currentDifficulty);
  const { minDifficulty, maxDifficulty } = BABTC_CONFIG.rewards;

  // Generate reward table
  const rewardTable = [];
  for (let d = minDifficulty; d <= maxDifficulty; d += 2) {
    const reward = calculateReward(d);
    rewardTable.push({
      difficulty: d,
      minerReward: reward.minerShare,
      isCurrent: d === currentDifficulty,
    });
  }

  return (
    <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3`}>
      {/* Header row - button and tooltip side by side to avoid nesting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2"
          >
            <span className="font-pixel text-pixel-2xs text-pixel-primary uppercase">
              Reward Info
            </span>
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
              {expanded ? "▲" : "▼"}
            </span>
          </button>
          <HelpTooltip
            content="Rewards are based on mining difficulty (leading zeros). Harder work = more reward. No halving schedule."
            title="BRO-style Rewards"
            size="sm"
          />
        </div>
      </div>

      {/* Summary row - always visible */}
      <div className="flex items-center justify-between mt-2 text-pixel-xs">
        <span className="text-pixel-text-muted">
          D{currentDifficulty} Reward:
        </span>
        <span className="font-pixel text-pixel-success">
          {formatReward(currentReward.minerShare)} $BABY
        </span>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-pixel-bg-dark space-y-3">
          {/* Formula explanation */}
          <div className="text-pixel-2xs text-pixel-text-muted">
            <span className="text-pixel-secondary">Formula:</span> 100 × D² ÷
            100 = reward
          </div>

          {/* Reward Table */}
          <div>
            <span className="text-pixel-2xs text-pixel-text-muted">
              Reward by Difficulty:
            </span>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5">
              {rewardTable.map(({ difficulty, minerReward, isCurrent }) => (
                <div
                  key={difficulty}
                  className={`flex justify-between text-pixel-3xs ${
                    isCurrent
                      ? "text-pixel-warning font-pixel"
                      : "text-pixel-text-muted"
                  }`}
                >
                  <span>
                    {isCurrent ? "→ " : "  "}D{difficulty}
                  </span>
                  <span>{formatReward(minerReward)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Distribution */}
          <div className="text-pixel-2xs">
            <span className="text-pixel-text-muted">Distribution:</span>
            <div className="flex gap-3 mt-1 text-pixel-3xs">
              <span className="text-pixel-success">
                {BABTC_CONFIG.distribution.miner}% Miner
              </span>
              <span className="text-pixel-text-muted">
                {BABTC_CONFIG.distribution.dev}% Dev
              </span>
              <span className="text-pixel-text-muted">
                {BABTC_CONFIG.distribution.staking}% Staking
              </span>
            </div>
          </div>

          {/* Info text */}
          <div className="text-pixel-3xs text-pixel-text-muted italic">
            Harder work (more leading zeros) = exponentially more reward
          </div>
        </div>
      )}
    </div>
  );
}

export default RewardInfoPanel;
