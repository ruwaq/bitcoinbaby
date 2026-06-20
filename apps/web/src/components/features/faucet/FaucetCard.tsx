"use client";

/**
 * FaucetCard - SPARK Faucet UI Component
 *
 * Shows the faucet claim button with cooldown countdown, maxed state,
 * and error handling. Only rendered when phaseConfig.features.babtcFaucet is true.
 *
 * States:
 * - idle: "CLAIM 5 SPARK" button
 * - claiming: Loading spinner
 * - cooldown: Countdown timer
 * - maxed: "Max claims reached (50 SPARK)"
 * - error: Error message with retry button
 */

import type { FC } from "react";
import { useFaucet, type UseFaucetReturn } from "@/hooks/useFaucet";

// =============================================================================
// FORMAT HELPERS
// =============================================================================

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "0:00:00";

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// =============================================================================
// COMPONENT
// =============================================================================

interface FaucetCardProps {
  /** Wallet address */
  address: string | null;
}

export const FaucetCard: FC<FaucetCardProps> = ({ address }) => {
  const faucet: UseFaucetReturn = useFaucet({ address });

  // Don't render if feature is not enabled or no address
  if (!faucet.isEnabled) {
    return null;
  }

  // ---- MAXED STATE ----
  if (faucet.state === "maxed") {
    return (
      <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-border">
        <div className="flex items-center justify-between mb-2">
          <label className="font-pixel text-pixel-2xs text-pixel-text-muted">
            SPARK FAUCET
          </label>
          <span className="font-pixel text-pixel-2xs text-pixel-accent">
            MAXED
          </span>
        </div>
        <p className="font-pixel text-pixel-xs text-pixel-text-muted text-center py-2">
          Max claims reached ({faucet.totalClaimed} SPARK)
        </p>
      </div>
    );
  }

  // ---- ERROR STATE ----
  if (faucet.state === "error") {
    return (
      <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-error">
        <div className="flex items-center justify-between mb-2">
          <label className="font-pixel text-pixel-2xs text-pixel-text-muted">
            SPARK FAUCET
          </label>
          <button
            onClick={faucet.reset}
            className="font-pixel text-pixel-2xs text-pixel-error hover:text-pixel-error/80 underline"
            type="button"
          >
            RETRY
          </button>
        </div>
        <p className="font-pixel text-pixel-2xs text-pixel-error text-center py-2">
          {faucet.error || "Something went wrong. Please try again."}
        </p>
      </div>
    );
  }

  // ---- CLAIMING STATE ----
  if (faucet.state === "claiming") {
    return (
      <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-border">
        <label className="font-pixel text-pixel-2xs text-pixel-text-muted block mb-2">
          SPARK FAUCET
        </label>
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin h-5 w-5 border-2 border-pixel-primary border-t-transparent" />
          <span className="font-pixel text-pixel-xs text-pixel-text-muted ml-2">
            Claiming...
          </span>
        </div>
      </div>
    );
  }

  // ---- COOLDOWN STATE ----
  if (faucet.state === "cooldown") {
    return (
      <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-border">
        <div className="flex items-center justify-between mb-2">
          <label className="font-pixel text-pixel-2xs text-pixel-text-muted">
            SPARK FAUCET
          </label>
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
            {faucet.totalClaimed}/{50} SPARK
          </span>
        </div>
        <div className="text-center py-2">
          <p className="font-pixel text-pixel-2xs text-pixel-text-muted mb-1">
            Next claim in
          </p>
          <p className="font-pixel-mono text-pixel-sm text-pixel-accent">
            {formatCountdown(faucet.cooldownSeconds)}
          </p>
        </div>
      </div>
    );
  }

  // ---- IDLE STATE (default) ----
  return (
    <div className="bg-pixel-bg-dark p-4 border-2 border-pixel-border">
      <div className="flex items-center justify-between mb-2">
        <label className="font-pixel text-pixel-2xs text-pixel-text-muted">
          SPARK FAUCET
        </label>
        <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
          {faucet.totalClaimed}/{50} SPARK
        </span>
      </div>
      <button
        onClick={faucet.claim}
        className="w-full font-pixel text-pixel-xs bg-pixel-primary text-pixel-bg-dark py-3 px-4 border-2 border-pixel-primary hover:bg-pixel-primary/90 active:translate-y-0.5 transition-all"
        type="button"
        disabled={faucet.isLoading}
      >
        CLAIM 5 SPARK
      </button>
      <p className="font-pixel text-pixel-2xs text-pixel-text-muted text-center mt-2">
        5 SPARK per day &middot; Use to evolve NFTs
      </p>
    </div>
  );
};

export default FaucetCard;
