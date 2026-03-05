"use client";

/**
 * RewardTable - Tabla de recompensas por dificultad
 *
 * Muestra la tabla de rewards usando getRewardTable()
 */

import { getRewardTable, formatTokenAmount } from "@bitcoinbaby/bitcoin";
import { pixelBorders } from "@bitcoinbaby/ui";

interface RewardTableProps {
  currentDifficulty?: number;
}

export function RewardTable({ currentDifficulty }: RewardTableProps) {
  const rewardTable = getRewardTable();

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 mb-4`}
    >
      <h2 className="font-pixel text-pixel-sm text-pixel-primary mb-4">
        REWARD TABLE
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-pixel-text-muted/30">
              <th className="font-pixel text-pixel-2xs text-pixel-text-muted text-left py-2 pr-4">
                DIFFICULTY
              </th>
              <th className="font-pixel text-pixel-2xs text-pixel-text-muted text-right py-2 px-4">
                TOTAL REWARD
              </th>
              <th className="font-pixel text-pixel-2xs text-pixel-text-muted text-right py-2 pl-4">
                MINER (90%)
              </th>
            </tr>
          </thead>
          <tbody>
            {rewardTable.map((row) => {
              const isActive = currentDifficulty === row.difficulty;
              const isMinDifficulty = row.difficulty === 16;
              const isMaxDifficulty = row.difficulty === 32;

              return (
                <tr
                  key={row.difficulty}
                  className={`border-b border-pixel-text-muted/10 transition-colors ${
                    isActive
                      ? "bg-pixel-primary/20"
                      : "hover:bg-pixel-bg-dark/50"
                  }`}
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-pixel text-pixel-xs ${
                          isActive
                            ? "text-pixel-primary"
                            : isMinDifficulty
                              ? "text-pixel-secondary"
                              : isMaxDifficulty
                                ? "text-pixel-warning"
                                : "text-pixel-text"
                        }`}
                      >
                        D{row.difficulty}
                      </span>
                      {isMinDifficulty && (
                        <span className="font-pixel text-pixel-2xs px-1 bg-pixel-secondary/20 text-pixel-secondary">
                          MIN
                        </span>
                      )}
                      {isMaxDifficulty && (
                        <span className="font-pixel text-pixel-2xs px-1 bg-pixel-warning/20 text-pixel-warning">
                          MAX
                        </span>
                      )}
                      {isActive && (
                        <span className="font-pixel text-pixel-2xs px-1 bg-pixel-primary/20 text-pixel-primary animate-pulse">
                          CURRENT
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-pixel text-pixel-xs ${
                        isActive ? "text-pixel-primary" : "text-pixel-text"
                      }`}
                    >
                      {formatTokenAmount(row.totalReward)} BABTC
                    </span>
                  </td>
                  <td className="py-3 pl-4 text-right">
                    <span
                      className={`font-pixel text-pixel-xs ${
                        isActive
                          ? "text-pixel-success"
                          : "text-pixel-success/70"
                      }`}
                    >
                      {formatTokenAmount(row.minerReward)} BABTC
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer note */}
      <div className="mt-4 pt-4 border-t border-pixel-text-muted/20">
        <p className="font-pixel-body text-pixel-xs text-pixel-text-muted">
          Higher difficulty = harder to find valid hash = more reward.
          <br />
          Formula: 1 BABTC × D² ÷ 100 where D = leading zero bits in hash.
        </p>
      </div>
    </div>
  );
}

export default RewardTable;
