/**
 * NFTEvolutionPanel
 *
 * Panel showing NFT evolution status and level-up button.
 * Displays XP progress, token cost, and boost gains.
 */

"use client";

import { useState } from "react";
import { cn } from "../../lib/utils";
import type { BabyNFTState, EvolutionStatus } from "./types";

// =============================================================================
// TYPES
// =============================================================================

export interface NFTEvolutionPanelProps {
  nft: BabyNFTState;
  evolutionStatus: EvolutionStatus;
  tokenBalance: bigint;
  onEvolve: (nft: BabyNFTState) => Promise<void>;
  isEvolving?: boolean;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatTokenAmount(amount: bigint): string {
  // Convert from raw units (8 decimals) to display
  const whole = amount / 100_000_000n;
  return whole.toLocaleString();
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NFTEvolutionPanel({
  nft,
  evolutionStatus,
  tokenBalance,
  onEvolve,
  isEvolving = false,
  className,
}: NFTEvolutionPanelProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const {
    currentLevel,
    nextLevel,
    currentXp,
    xpRequired,
    xpProgress,
    canEvolve,
    tokenCost,
    currentBoost,
    nextBoost,
    boostGain,
  } = evolutionStatus;

  const hasEnoughTokens = tokenBalance >= tokenCost;
  const isMaxLevel = currentLevel >= 10;

  const handleEvolveClick = () => {
    if (canEvolve && hasEnoughTokens) {
      setShowConfirm(true);
    }
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    await onEvolve(nft);
  };

  return (
    <div
      className={cn(
        "bg-pixel-bg-medium border-4 border-pixel-border p-4",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-pixel text-[10px] text-pixel-primary uppercase">
          Evolution
        </h3>
        <span className="font-pixel text-[8px] text-pixel-secondary">
          Level {currentLevel}
          {!isMaxLevel && ` -> ${nextLevel}`}
        </span>
      </div>

      {isMaxLevel ? (
        /* Max Level State */
        <div className="text-center py-4">
          <div className="text-4xl mb-2">👑</div>
          <p className="font-pixel text-[9px] text-pixel-legendary uppercase">
            Maximum Level
          </p>
          <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
            This Genesis Baby has reached its full potential!
          </p>
          <div className="mt-3 p-2 bg-pixel-bg-dark border-2 border-pixel-legendary">
            <span className="font-pixel text-[8px] text-pixel-legendary">
              +{currentBoost}% Mining Boost
            </span>
          </div>
        </div>
      ) : (
        <>
          {/* XP Progress */}
          <div className="mb-4">
            <div className="flex justify-between mb-1">
              <span className="font-pixel text-[7px] text-pixel-text-muted uppercase">
                Experience
              </span>
              <span className="font-pixel text-[8px] text-pixel-text">
                {currentXp} / {xpRequired} XP
              </span>
            </div>
            <div className="h-4 bg-pixel-bg-dark border-2 border-pixel-border overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  canEvolve
                    ? "bg-pixel-success animate-pulse"
                    : "bg-pixel-secondary",
                )}
                style={{ width: `${Math.min(xpProgress, 100)}%` }}
              />
            </div>
            {!canEvolve && (
              <p className="font-pixel text-[6px] text-pixel-text-muted mt-1">
                Mine more to gain XP!
              </p>
            )}
          </div>

          {/* Evolution Requirements */}
          <div className="mb-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted uppercase mb-2">
              Level Up Cost
            </p>
            <div className="flex items-center justify-between">
              <span className="font-pixel text-[10px] text-pixel-warning">
                {formatTokenAmount(tokenCost)} $BABY
              </span>
              {hasEnoughTokens ? (
                <span className="font-pixel text-[7px] text-pixel-success">
                  OK
                </span>
              ) : (
                <span className="font-pixel text-[7px] text-pixel-error">
                  Need more
                </span>
              )}
            </div>
            <p className="font-pixel text-[6px] text-pixel-text-muted mt-1">
              Your balance: {formatTokenAmount(tokenBalance)} $BABY
            </p>
          </div>

          {/* Boost Preview */}
          <div className="mb-4 p-3 bg-pixel-bg-dark border-2 border-pixel-success/30">
            <p className="font-pixel text-[7px] text-pixel-text-muted uppercase mb-2">
              Boost Gain
            </p>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[9px] text-pixel-text">
                +{currentBoost}%
              </span>
              <span className="font-pixel text-[9px] text-pixel-success">
                -&gt;
              </span>
              <span className="font-pixel text-[10px] text-pixel-success">
                +{nextBoost}%
              </span>
              <span className="font-pixel text-[7px] text-pixel-success bg-pixel-success/20 px-1">
                (+{boostGain}%)
              </span>
            </div>
          </div>

          {/* Evolve Button */}
          {!showConfirm ? (
            <button
              onClick={handleEvolveClick}
              disabled={!canEvolve || !hasEnoughTokens || isEvolving}
              className={cn(
                "w-full font-pixel text-[9px] uppercase px-4 py-3 border-4 transition-all",
                canEvolve && hasEnoughTokens && !isEvolving
                  ? "bg-pixel-success text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]"
                  : "bg-pixel-bg-dark text-pixel-text-muted border-pixel-border cursor-not-allowed opacity-50",
              )}
            >
              {isEvolving ? (
                <span className="animate-pulse">Evolving...</span>
              ) : !canEvolve ? (
                "Need More XP"
              ) : !hasEnoughTokens ? (
                "Need More $BABY"
              ) : (
                "Evolve to Level " + nextLevel
              )}
            </button>
          ) : (
            /* Confirmation */
            <div className="space-y-2">
              <p className="font-pixel text-[8px] text-pixel-warning text-center">
                Burn {formatTokenAmount(tokenCost)} $BABY to evolve?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 font-pixel text-[8px] uppercase px-3 py-2 bg-pixel-bg-dark text-pixel-text border-2 border-pixel-border hover:border-pixel-error transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isEvolving}
                  className="flex-1 font-pixel text-[8px] uppercase px-3 py-2 bg-pixel-success text-pixel-text-dark border-4 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] transition-transform"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default NFTEvolutionPanel;
