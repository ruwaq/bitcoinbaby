"use client";

/**
 * MintAttemptsPanel - Shows pending and failed mint attempts
 *
 * Displays mint attempt status so users know what happened to their mints.
 */

import { PixelCard, PixelButton } from "@bitcoinbaby/ui";
import { useNetworkStore, type MintAttempt } from "@bitcoinbaby/core";

interface MintAttemptsPanelProps {
  attempts: MintAttempt[];
  pendingAttempts: MintAttempt[];
  failedAttempts: MintAttempt[];
  isLoading: boolean;
  onRefresh: () => void;
  hasPending: boolean;
}

// Status display info
function getStatusInfo(status: MintAttempt["status"]): {
  label: string;
  color: string;
  message: string;
} {
  switch (status) {
    case "reserved":
      return {
        label: "Reserved",
        color: "text-yellow-400 bg-yellow-500/20",
        message: "Token ID reserved, waiting for traits generation...",
      };
    case "proving":
      return {
        label: "Proving",
        color: "text-cyan-400 bg-cyan-500/20",
        message: "Submitting to Charms prover (this may take 1-2 minutes)...",
      };
    case "signing":
      return {
        label: "Signing",
        color: "text-blue-400 bg-blue-500/20",
        message: "Waiting for wallet signature...",
      };
    case "broadcasting":
      return {
        label: "Broadcasting",
        color: "text-purple-400 bg-purple-500/20",
        message: "Broadcasting transaction to Bitcoin network...",
      };
    case "confirmed":
      return {
        label: "Confirmed",
        color: "text-green-400 bg-green-500/20",
        message: "NFT minted successfully!",
      };
    case "failed":
      return {
        label: "Failed",
        color: "text-red-400 bg-red-500/20",
        message: "Mint failed - check details below",
      };
    default:
      return {
        label: "Unknown",
        color: "text-gray-400 bg-gray-500/20",
        message: "Unknown status",
      };
  }
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function MintAttemptsPanel({
  attempts,
  pendingAttempts,
  failedAttempts,
  isLoading,
  onRefresh,
  hasPending,
}: MintAttemptsPanelProps) {
  const { config } = useNetworkStore();

  // Don't show if no attempts
  if (attempts.length === 0) {
    return null;
  }

  // Filter to show only recent or relevant attempts
  const relevantAttempts = attempts.filter((a) => {
    // Always show non-confirmed statuses
    if (a.status !== "confirmed") {
      return true;
    }
    // Show confirmed from last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    return a.lastUpdatedAt > oneHourAgo;
  });

  if (relevantAttempts.length === 0) {
    return null;
  }

  return (
    <PixelCard className="mb-6">
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="font-pixel text-sm text-pixel-text">
              Mint Activity
            </h3>
            {hasPending && (
              <span className="font-pixel text-[8px] text-pixel-secondary animate-pulse">
                Auto-refresh active
              </span>
            )}
          </div>
          <PixelButton
            onClick={onRefresh}
            size="sm"
            variant="secondary"
            disabled={isLoading}
          >
            {isLoading ? "..." : "Refresh"}
          </PixelButton>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 mb-4">
          {pendingAttempts.length > 0 && (
            <span className="font-pixel text-[8px] px-2 py-1 bg-blue-500/20 text-blue-400 border border-blue-500/30">
              {pendingAttempts.length} Pending
            </span>
          )}
          {failedAttempts.length > 0 && (
            <span className="font-pixel text-[8px] px-2 py-1 bg-red-500/20 text-red-400 border border-red-500/30">
              {failedAttempts.length} Failed
            </span>
          )}
        </div>

        {/* Attempts list */}
        <div className="space-y-3">
          {relevantAttempts.map((attempt) => {
            const statusInfo = getStatusInfo(attempt.status);
            return (
              <div
                key={attempt.attemptId}
                className={`border-2 border-pixel-border p-3 bg-pixel-bg-dark border-l-2 ${
                  attempt.status === "failed"
                    ? "border-l-red-500"
                    : attempt.status === "confirmed"
                      ? "border-l-green-500"
                      : "border-l-blue-500"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-pixel text-sm text-pixel-text">
                    Token #{attempt.tokenId}
                  </span>
                  <span
                    className={`font-pixel text-[8px] px-2 py-0.5 rounded ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Status message */}
                <p className="font-pixel-body text-xs text-pixel-text-muted mb-2">
                  {statusInfo.message}
                </p>

                {/* Error message for failed */}
                {attempt.status === "failed" && attempt.error && (
                  <div className="p-2 bg-red-500/10 border border-red-500/30 rounded mb-2">
                    <p className="font-pixel text-[8px] text-red-400">
                      {attempt.error}
                    </p>
                  </div>
                )}

                {/* Timestamps and links */}
                <div className="flex items-center justify-between text-[10px] text-pixel-text-muted">
                  <span>Started: {formatTimeAgo(attempt.reservedAt)}</span>
                  <div className="flex gap-2">
                    {attempt.commitTxid && (
                      <a
                        href={`${config.explorerUrl}/tx/${attempt.commitTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-pixel-secondary hover:underline"
                      >
                        Commit TX
                      </a>
                    )}
                    {attempt.spellTxid && (
                      <a
                        href={`${config.explorerUrl}/tx/${attempt.spellTxid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-400 hover:underline"
                      >
                        NFT TX
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PixelCard>
  );
}

export default MintAttemptsPanel;
