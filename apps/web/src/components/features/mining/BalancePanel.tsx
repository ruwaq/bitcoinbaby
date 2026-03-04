"use client";

/**
 * BalancePanel - Mining balance cards grid
 *
 * Shows:
 * - Virtual $BABY balance (primary)
 * - Total mined (lifetime)
 * - Session shares with sync status
 * - On-chain $BABY balance
 */

import { useState } from "react";
import {
  AnimatedTokenCounter,
  HelpTooltip,
  pixelBorders,
} from "@bitcoinbaby/ui";
import { SyncDebugPanel } from "./SyncDebugPanel";

interface BalancePanelProps {
  // Virtual balance
  virtualBalance: bigint;
  virtualBalanceLoading: boolean;
  virtualBalanceError: string | null;

  // Totals
  totalMined: bigint;
  onChainBalance: bigint;

  // Session shares
  sessionShares: number;
  submittedShares: number;
  pendingShares: number;
  failedShares: number;
  isSubmitting: boolean;

  // Sync
  getSyncState: () => {
    isOnline: boolean;
    apiHealthy: boolean;
    circuitBreakerActive: boolean;
    circuitBreakerUntil: number;
    consecutiveFailures: number;
  };
  onForceSync: () => void;

  // Animation
  recentReward?: bigint;
}

export function BalancePanel({
  virtualBalance,
  virtualBalanceLoading,
  virtualBalanceError,
  totalMined,
  onChainBalance,
  sessionShares,
  submittedShares,
  pendingShares,
  failedShares,
  isSubmitting,
  getSyncState,
  onForceSync,
  recentReward,
}: BalancePanelProps) {
  const [showSyncDebug, setShowSyncDebug] = useState(false);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {/* Virtual Balance (Primary) - Animated Counter */}
      <div
        className={`bg-pixel-bg-medium border-4 p-3 sm:p-4 ${virtualBalanceError ? "border-pixel-warning" : "border-pixel-success"}`}
      >
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            $BABY Balance
          </span>
          <HelpTooltip
            content="Tokens earned from mining, stored in your virtual account. You can withdraw these to your Bitcoin wallet anytime."
            title="Virtual Balance"
            size="sm"
          />
        </div>
        {virtualBalanceLoading ? (
          <div className="font-pixel text-pixel-base text-pixel-text-muted animate-pulse">
            ---
          </div>
        ) : (
          <AnimatedTokenCounter
            value={virtualBalance}
            recentReward={recentReward}
            size="lg"
            showParticles={true}
            showGlow={true}
            className={
              virtualBalanceError ? "text-pixel-warning" : "text-pixel-success"
            }
          />
        )}
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1 truncate">
          {virtualBalanceError ? "Last known balance" : "Available to withdraw"}
        </div>
      </div>

      {/* Total Mined */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            Total Mined
          </span>
          <HelpTooltip
            content="All $BABY tokens you've ever earned from mining. This includes both withdrawn and available balance."
            title="Lifetime Earnings"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-primary">
          {totalMined.toLocaleString()}
        </div>
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          All-time earnings
        </div>
      </div>

      {/* Session Shares */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            Session Shares
          </span>
          <HelpTooltip
            content="Valid mining proofs found this session. Each share earns 100 $BABY tokens (plus streak bonuses)."
            title="Mining Shares"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-secondary">
          {sessionShares}
        </div>
        <button
          onClick={() => setShowSyncDebug(!showSyncDebug)}
          className={`font-pixel text-pixel-2xs hover:text-pixel-primary cursor-pointer underline truncate max-w-full ${
            failedShares > 0
              ? "text-pixel-error"
              : pendingShares > 0
                ? "text-pixel-warning"
                : "text-pixel-text-muted"
          }`}
        >
          {isSubmitting
            ? "Syncing..."
            : failedShares > 0
              ? `${failedShares} failed, ${pendingShares} pending`
              : pendingShares > 0
                ? `${pendingShares.toLocaleString()} pending sync`
                : `${submittedShares} synced`}
        </button>

        {/* Sync Debug Panel */}
        {showSyncDebug && (
          <SyncDebugPanel
            getSyncState={getSyncState}
            onForceSync={onForceSync}
          />
        )}
      </div>

      {/* On-Chain Balance */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            On-Chain $BABY
          </span>
          <HelpTooltip
            content="Tokens you've withdrawn to your Bitcoin wallet. These are stored on the blockchain as Charms tokens."
            title="On-Chain Balance"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-warning">
          {onChainBalance.toLocaleString()}
        </div>
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          Withdrawn to Bitcoin
        </div>
      </div>
    </div>
  );
}

export default BalancePanel;
