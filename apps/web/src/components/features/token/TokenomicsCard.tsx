"use client";

/**
 * TokenomicsCard - Tokenomics del $BABTC
 *
 * Muestra:
 * - Distribucion: 90% Miners, 5% Dev, 5% Staking
 * - Formula de recompensa
 * - Rango de dificultad
 */

import { BABTC_CONFIG } from "@bitcoinbaby/bitcoin";
import { pixelBorders } from "@bitcoinbaby/ui";

export function TokenomicsCard() {
  const { distribution, rewards } = BABTC_CONFIG;

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 mb-4`}
    >
      <h2 className="font-pixel text-pixel-sm text-pixel-primary mb-4">
        TOKENOMICS
      </h2>

      {/* Distribution Visual */}
      <div className="mb-6">
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted mb-2">
          DISTRIBUTION PER MINT
        </div>
        <div className="flex gap-1 h-8 rounded overflow-hidden">
          <div
            className="bg-pixel-success flex items-center justify-center"
            style={{ width: `${distribution.miner}%` }}
          >
            <span className="font-pixel text-pixel-2xs text-pixel-bg-dark">
              {distribution.miner}%
            </span>
          </div>
          <div
            className="bg-pixel-primary flex items-center justify-center"
            style={{ width: `${distribution.dev}%` }}
          >
            <span className="font-pixel text-pixel-2xs text-pixel-bg-dark">
              {distribution.dev}%
            </span>
          </div>
          <div
            className="bg-pixel-secondary flex items-center justify-center"
            style={{ width: `${distribution.staking}%` }}
          >
            <span className="font-pixel text-pixel-2xs text-pixel-bg-dark">
              {distribution.staking}%
            </span>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-pixel text-pixel-2xs text-pixel-success">
            MINERS
          </span>
          <span className="font-pixel text-pixel-2xs text-pixel-primary">
            DEV FUND
          </span>
          <span className="font-pixel text-pixel-2xs text-pixel-secondary">
            STAKING
          </span>
        </div>
      </div>

      {/* Reward Formula */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={`bg-pixel-bg-dark ${pixelBorders.thin} p-4`}>
          <div className="font-pixel text-pixel-2xs text-pixel-text-muted mb-2">
            REWARD FORMULA
          </div>
          <div className="font-pixel text-pixel-sm text-pixel-primary mb-2">
            BASE x D² / 100
          </div>
          <div className="font-pixel-body text-pixel-xs text-pixel-text-muted">
            Where D = difficulty (leading zero bits). Higher difficulty =
            exponentially more reward.
          </div>
        </div>

        <div className={`bg-pixel-bg-dark ${pixelBorders.thin} p-4`}>
          <div className="font-pixel text-pixel-2xs text-pixel-text-muted mb-2">
            DIFFICULTY RANGE
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-pixel text-pixel-sm text-pixel-secondary">
              D{rewards.minDifficulty}
            </span>
            <span className="font-pixel text-pixel-xs text-pixel-text-muted">
              to
            </span>
            <span className="font-pixel text-pixel-sm text-pixel-warning">
              D{rewards.maxDifficulty}
            </span>
          </div>
          <div className="font-pixel-body text-pixel-xs text-pixel-text-muted">
            Minimum D16 required. Max reward at D32.
          </div>
        </div>
      </div>

      {/* No Halving Badge */}
      <div className="mt-4 flex items-center gap-2">
        <span className="font-pixel text-pixel-2xs px-2 py-1 bg-pixel-success/20 text-pixel-success border border-pixel-success">
          NO HALVING
        </span>
        <span className="font-pixel-body text-pixel-xs text-pixel-text-muted">
          BRO-style rewards based on work done, not time
        </span>
      </div>
    </div>
  );
}

export default TokenomicsCard;
