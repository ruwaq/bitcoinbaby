"use client";

/**
 * ClaimSection Component
 *
 * Complete claim management interface.
 * Displays claimable work, prepares claims, and tracks claim history.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  PixelCard,
  PixelButton,
  TransactionConfirmModal,
  createClaimTransaction,
} from "@bitcoinbaby/ui";
import { useNetworkStore } from "@bitcoinbaby/core";
import { TransactionBuilder } from "@bitcoinbaby/bitcoin";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useClaim, type ClaimStatus } from "@/hooks/useClaim";
import { useBalance } from "@/hooks/useBalance";
import { useTokenBalance } from "@/hooks/useTokenBalance";
import { formatBalance, formatDate } from "@/utils/format";

// =============================================================================
// CLAIM PROGRESS STEPPER
// =============================================================================

interface ClaimStep {
  id: string;
  label: string;
  description: string;
}

const CLAIM_STEPS: ClaimStep[] = [
  { id: "prepare", label: "Prepare", description: "Aggregating proofs" },
  { id: "sign", label: "Sign", description: "Sign transaction" },
  { id: "broadcast", label: "Broadcast", description: "Send to network" },
  { id: "confirm", label: "Confirm", description: "Wait for block" },
  { id: "mint", label: "Mint", description: "ZK proof generation" },
];

function getStepFromStatus(status: ClaimStatus): number {
  switch (status) {
    case "idle":
    case "loading-balance":
      return -1;
    case "preparing":
      return 0;
    case "ready-to-broadcast":
      return 1;
    case "broadcasting":
      return 2;
    case "waiting-confirmation":
    case "confirming":
      return 3;
    case "minting":
      return 4;
    case "completed":
      return 5;
    case "error":
      return -2;
    default:
      return -1;
  }
}

function ClaimProgressStepper({
  status,
  error,
}: {
  status: ClaimStatus;
  error?: string | null;
}) {
  const currentStep = getStepFromStatus(status);

  if (currentStep < 0 && status !== "error") return null;

  return (
    <div className="bg-pixel-bg-dark/50 rounded p-4 mb-4">
      <p className="text-xs text-gray-400 mb-3 font-pixel">CLAIM PROGRESS</p>

      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-pixel-bg-dark rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              status === "error"
                ? "bg-red-500"
                : status === "completed"
                  ? "bg-green-500"
                  : "bg-pixel-primary"
            }`}
            style={{
              width: `${Math.max(0, Math.min(100, (currentStep / CLAIM_STEPS.length) * 100))}%`,
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="flex justify-between">
        {CLAIM_STEPS.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isPending = index > currentStep;

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center text-center ${
                isActive ? "scale-110" : ""
              } transition-transform`}
            >
              {/* Step indicator */}
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-pixel mb-1
                  ${
                    isCompleted
                      ? "bg-green-500 text-white"
                      : isActive
                        ? "bg-pixel-primary text-white animate-pulse"
                        : "bg-pixel-bg-dark text-gray-500"
                  }
                `}
              >
                {isCompleted ? "✓" : index + 1}
              </div>

              {/* Label */}
              <span
                className={`text-[10px] font-pixel ${
                  isActive
                    ? "text-pixel-primary"
                    : isCompleted
                      ? "text-green-400"
                      : "text-gray-500"
                }`}
              >
                {step.label}
              </span>

              {/* Description (only for active step) */}
              {isActive && (
                <span className="text-[9px] text-pixel-secondary animate-pulse mt-0.5">
                  {step.description}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Error state */}
      {status === "error" && error && (
        <div className="mt-3 p-2 bg-red-500/20 rounded text-xs text-red-400">
          <span className="font-pixel">ERROR:</span> {error}
        </div>
      )}

      {/* Completed state */}
      {status === "completed" && (
        <div className="mt-3 p-2 bg-green-500/20 rounded text-xs text-green-400 text-center">
          <span className="font-pixel">TOKENS MINTED!</span>
          <p className="text-[10px] text-gray-400 mt-1">
            Check your wallet balance above
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Format work as a readable number
 */
function formatWork(work: string): string {
  const num = BigInt(work);
  if (num >= 1_000_000n) {
    return `${(Number(num) / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000n) {
    return `${(Number(num) / 1_000).toFixed(2)}K`;
  }
  return num.toString();
}

/**
 * Status badge for claims with explanations
 */
function ClaimStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    prepared: "bg-yellow-500/20 text-yellow-400",
    broadcast: "bg-blue-500/20 text-blue-400",
    confirmed: "bg-purple-500/20 text-purple-400",
    minting: "bg-cyan-500/20 text-cyan-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    expired: "bg-gray-500/20 text-gray-400",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-pixel ${colors[status] || colors.prepared}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

/**
 * Get human-readable explanation for claim status
 */
function getStatusExplanation(
  status: string,
  error?: string | null,
): {
  message: string;
  action?: string;
  errorDetail?: string;
} {
  switch (status) {
    case "prepared":
      return {
        message: "Claim prepared, waiting for TX broadcast",
        action: "Broadcast the transaction to complete",
      };
    case "broadcast":
      return {
        message: "TX sent, waiting for blockchain confirmation (~10-30 min)",
        action: "Click 'Mint Now' once confirmed",
      };
    case "confirmed":
      return {
        message: "TX confirmed on blockchain, ready to mint",
        action: "Click 'Mint Now' to receive tokens",
      };
    case "minting":
      return {
        message: "Minting in progress with Charms prover...",
      };
    case "completed":
      return {
        message: "Tokens successfully minted to your wallet as BABTC",
      };
    case "failed": {
      // Parse error to give user-friendly message
      let errorDetail = error || "Unknown error";
      let friendlyMessage = "Minting failed";

      if (
        error?.includes("502") ||
        error?.includes("timeout") ||
        error?.includes("Timeout")
      ) {
        friendlyMessage = "Prover server temporarily unavailable";
        errorDetail =
          "The Charms prover is overloaded or down. This is a temporary issue.";
      } else if (error?.includes("400")) {
        friendlyMessage = "Invalid request";
        errorDetail =
          "The claim data may be corrupted. Try preparing a new claim.";
      } else if (error?.includes("Prover failed")) {
        friendlyMessage = "Prover service error";
        errorDetail =
          "The ZK proof generation failed. This is usually temporary.";
      }

      return {
        message: friendlyMessage,
        action: "Click 'Retry' to try again (prover may be available now)",
        errorDetail,
      };
    }
    case "expired":
      return {
        message: "Claim expired (not broadcast within time limit)",
        action: "Prepare a new claim",
      };
    default:
      return { message: "Unknown status" };
  }
}

export function ClaimSection() {
  // Unified wallet connection - handles both internal and external wallets
  const { address, publicKey, signAndBroadcast, canSign } =
    useWalletConnection();

  const { config } = useNetworkStore();

  // Get UTXOs for building transactions
  const { utxos: rawUtxos } = useBalance({
    address: address ?? undefined,
    network: "testnet4",
    autoRefresh: true,
  });

  // Convert UTXOs to TxUTXO format with tapInternalKey
  const txUtxos = useMemo(() => {
    if (!rawUtxos || !address || !publicKey) return [];

    // Extract x-only pubkey (32 bytes) from compressed pubkey (33 bytes)
    const pubKeyBytes = publicKey.startsWith("0x")
      ? publicKey.slice(2)
      : publicKey;
    const xOnlyPubKey =
      pubKeyBytes.length === 66
        ? new Uint8Array(Buffer.from(pubKeyBytes.slice(2), "hex"))
        : undefined;

    return TransactionBuilder.convertUTXOs(
      rawUtxos,
      address,
      "testnet4",
      xOnlyPubKey,
    );
  }, [rawUtxos, address, publicKey]);

  // Adapt signAndBroadcast to useClaim expected format
  const adaptedSignAndBroadcast = useCallback(
    async (psbtHex: string): Promise<{ success: boolean; txid: string }> => {
      const txid = await signAndBroadcast(psbtHex);
      if (!txid) {
        // Explicit failure - don't return empty string
        return { success: false, txid: "" };
      }
      return { success: true, txid };
    },
    [signAndBroadcast],
  );

  const [activeTab, setActiveTab] = useState<"claim" | "history">("claim");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [txidInput, setTxidInput] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<{
    success: boolean;
    txid?: string;
    claimId?: string;
  } | null>(null);
  const [mintingClaimId, setMintingClaimId] = useState<string | null>(null);

  // Get BABTC balance (tokens already claimed to wallet)
  const {
    confirmedBalance: babtcBalance,
    isLoading: babtcLoading,
    refresh: refreshBabtc,
  } = useTokenBalance({
    address: address ?? undefined,
    tokenTicker: "BABTC",
    refreshInterval: 60000,
  });

  const {
    claimableBalance,
    isLoadingBalance,
    balanceError,
    status,
    preparedClaim,
    isPreparing,
    isConfirming,
    isBroadcasting,
    isMinting,
    claimError,
    claimHistory,
    isLoadingHistory,
    canAutoBroadcast,
    refreshBalance,
    prepareClaim,
    broadcastClaimTx,
    confirmClaim,
    triggerMint,
    loadHistory,
    clearPreparedClaim,
  } = useClaim({
    address: address ?? undefined,
    publicKey: publicKey ?? undefined,
    utxos: txUtxos,
    // Use unified wallet connection - canSign ensures wallet is unlocked and ready
    signAndBroadcast: canSign ? adaptedSignAndBroadcast : undefined,
  });

  // Auto-refresh history when there are pending/broadcast claims
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);
  const hasPendingClaims = claimHistory.some(
    (c) =>
      c.status === "broadcast" ||
      c.status === "confirmed" ||
      c.status === "minting",
  );

  useEffect(() => {
    // Auto-refresh every 30 seconds if there are pending claims
    if (hasPendingClaims && activeTab === "history") {
      autoRefreshRef.current = setInterval(() => {
        loadHistory();
      }, 30000);
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [hasPendingClaims, activeTab, loadHistory]);

  // Refresh on tab visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && address) {
        loadHistory();
        refreshBalance();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [address, loadHistory, refreshBalance]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshBalance(), loadHistory()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle prepare claim
  const handlePrepareClaim = async () => {
    await prepareClaim();
  };

  // Show confirmation modal before broadcasting
  const handleShowConfirmModal = () => {
    setBroadcastResult(null);
    setShowConfirmModal(true);
  };

  // Handle confirmed broadcast (after user confirms in modal)
  const handleConfirmedBroadcast = async () => {
    setShowConfirmModal(false);
    const claimId = preparedClaim?.claimData.proof.nonce;
    const txid = await broadcastClaimTx();
    if (txid && claimId) {
      setTxidInput("");
      setBroadcastResult({ success: true, txid, claimId });
      // Refresh history to show new claim
      await loadHistory();
    } else {
      setBroadcastResult({ success: false });
    }
  };

  // Trigger mint for a broadcast claim
  const handleTriggerMint = async (claimId: string, claimTxid: string) => {
    setMintingClaimId(claimId);
    try {
      const success = await triggerMint(claimId, claimTxid);
      if (success) {
        await loadHistory();
      }
    } finally {
      setMintingClaimId(null);
    }
  };

  // Close modal without broadcasting
  const handleCancelModal = () => {
    setShowConfirmModal(false);
  };

  // Clear broadcast result and start fresh
  const handleDismissResult = () => {
    setBroadcastResult(null);
  };

  // Handle confirm claim (manual txid entry)
  const handleConfirmClaim = async () => {
    if (!preparedClaim || !txidInput) return;

    const claimId = preparedClaim.claimData.proof.nonce;
    const success = await confirmClaim(claimId, txidInput);

    if (success) {
      setTxidInput("");
    }
  };

  if (!address) {
    return (
      <PixelCard>
        <div className="p-6 text-center">
          <p className="font-pixel text-lg mb-2">Connect Wallet</p>
          <p className="text-sm text-gray-400">
            Create or unlock your wallet to claim tokens
          </p>
        </div>
      </PixelCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Your BABTC Wallet Balance */}
      <PixelCard>
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-pixel text-lg text-pixel-secondary">
              Your Wallet
            </h2>
            <PixelButton
              onClick={refreshBabtc}
              size="sm"
              variant="secondary"
              disabled={babtcLoading}
            >
              {babtcLoading ? "..." : "Refresh"}
            </PixelButton>
          </div>
          <div className="bg-pixel-bg-dark/50 rounded p-4 text-center border-2 border-pixel-secondary/30">
            <p className="text-xs text-gray-400 mb-1">
              BABTC Balance (On-Chain)
            </p>
            <p className="font-pixel text-3xl text-pixel-secondary">
              {babtcLoading ? "---" : formatBalance(babtcBalance)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Tokens claimed to your Bitcoin wallet as Charms
            </p>
          </div>
        </div>
      </PixelCard>

      {/* Claimable Work Overview */}
      <PixelCard>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-pixel text-lg">Claimable Work</h2>
            <PixelButton
              onClick={handleRefresh}
              size="sm"
              variant="secondary"
              disabled={isRefreshing}
            >
              {isRefreshing ? "..." : "Refresh"}
            </PixelButton>
          </div>

          {isLoadingBalance ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-pixel-bg-dark rounded" />
              <div className="h-4 bg-pixel-bg-dark rounded w-1/2" />
            </div>
          ) : claimableBalance ? (
            <>
              {/* Main Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-pixel-bg-dark/50 rounded p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">Total Work</p>
                  <p className="font-pixel text-2xl text-pixel-primary">
                    {formatWork(claimableBalance.unclaimedWork)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {claimableBalance.unclaimedProofs} proofs
                  </p>
                </div>
                <div className="bg-pixel-bg-dark/50 rounded p-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">You Will Receive</p>
                  <p className="font-pixel text-2xl text-green-400">
                    {formatBalance(
                      BigInt(
                        claimableBalance.netTokens ||
                          claimableBalance.claimableTokens,
                      ),
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">$BABTC</p>
                </div>
              </div>

              {/* Platform Fee Breakdown */}
              {claimableBalance.platformFeePercent > 0 && (
                <div className="bg-pixel-bg-dark/30 rounded p-3 mb-4 border border-pixel-warning/30">
                  <p className="text-xs text-pixel-warning font-pixel mb-2">
                    FEE BREAKDOWN
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400">Gross</p>
                      <p className="text-white">
                        {formatBalance(
                          BigInt(claimableBalance.claimableTokens),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">
                        Platform ({claimableBalance.platformFeePercent}%)
                      </p>
                      <p className="text-pixel-warning">
                        -
                        {formatBalance(
                          BigInt(claimableBalance.platformFeeTokens || "0"),
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-400">Net</p>
                      <p className="text-green-400">
                        {formatBalance(
                          BigInt(
                            claimableBalance.netTokens ||
                              claimableBalance.claimableTokens,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Platform fee supports development and infrastructure
                  </p>
                </div>
              )}

              {/* Fee Estimate */}
              <div className="bg-pixel-bg-dark/30 rounded p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Estimated Claim Fee</p>
                  <p className="text-sm text-white">
                    ~{claimableBalance.estimatedFee} sats
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Fee Rate</p>
                  <p className="text-sm text-white">
                    {claimableBalance.feeRate} sat/vB
                  </p>
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
                <span>
                  Total Claimed:{" "}
                  <span className="text-white">
                    {formatBalance(BigInt(claimableBalance.totalClaimed))}
                  </span>
                </span>
                <span>
                  Claims:{" "}
                  <span className="text-white">
                    {claimableBalance.claimCount}
                  </span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-center text-gray-400">No claimable work yet</p>
          )}

          {balanceError && (
            <p className="text-xs text-red-400 text-center mt-2">
              {balanceError}
            </p>
          )}
        </div>
      </PixelCard>

      {/* Tabs */}
      <div className="flex gap-2">
        <PixelButton
          onClick={() => setActiveTab("claim")}
          variant={activeTab === "claim" ? "default" : "secondary"}
          size="sm"
        >
          Claim Tokens
        </PixelButton>
        <PixelButton
          onClick={() => setActiveTab("history")}
          variant={activeTab === "history" ? "default" : "secondary"}
          size="sm"
        >
          History ({claimHistory.length})
        </PixelButton>
      </div>

      {/* Claim Tab */}
      {activeTab === "claim" && (
        <PixelCard>
          <div className="p-4">
            {/* Progress Stepper - shows during active claim flow */}
            <ClaimProgressStepper status={status} error={claimError} />

            {!preparedClaim ? (
              <>
                <h3 className="font-pixel text-sm mb-4">Prepare Claim</h3>
                <p className="text-sm text-gray-400 mb-4">
                  When you prepare a claim, we aggregate all your mining proofs
                  and create signed claim data. You then create a Bitcoin
                  transaction to claim your tokens.
                </p>

                <PixelButton
                  onClick={handlePrepareClaim}
                  disabled={
                    isPreparing ||
                    !claimableBalance ||
                    BigInt(claimableBalance.claimableTokens) === 0n
                  }
                  className="w-full"
                >
                  {isPreparing ? "Preparing..." : "Prepare Claim"}
                </PixelButton>

                {BigInt(claimableBalance?.claimableTokens || "0") === 0n && (
                  <p className="text-xs text-yellow-400 text-center mt-2">
                    Mine more to accumulate claimable tokens
                  </p>
                )}
              </>
            ) : (
              <>
                <h3 className="font-pixel text-sm mb-4 text-green-400">
                  Claim Ready!
                </h3>

                <div className="space-y-4">
                  {/* Claim Summary */}
                  <div className="bg-pixel-bg-dark/50 rounded p-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-gray-400">You Receive</p>
                        <p className="text-green-400 font-pixel">
                          {formatBalance(
                            BigInt(
                              preparedClaim.netTokens ||
                                preparedClaim.tokenAmount,
                            ),
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Proofs</p>
                        <p className="text-white">{preparedClaim.proofCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Network Fee</p>
                        <p className="text-white">
                          ~{preparedClaim.estimatedFee} sats
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Expires</p>
                        <p className="text-white">
                          {formatDate(preparedClaim.expiresAt)}
                        </p>
                      </div>
                    </div>
                    {/* Platform Fee Note */}
                    {preparedClaim.platformFeePercent > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-400">
                        <span>
                          Gross:{" "}
                          {formatBalance(BigInt(preparedClaim.tokenAmount))} |{" "}
                          Platform fee: {preparedClaim.platformFeePercent}% (
                          {formatBalance(
                            BigInt(preparedClaim.platformFeeTokens || "0"),
                          )}
                          )
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Broadcast Success Result */}
                  {broadcastResult?.success && broadcastResult.txid && (
                    <div className="bg-green-500/20 border border-green-500/50 rounded p-4">
                      <p className="text-sm text-green-400 font-pixel mb-2">
                        TRANSACTION BROADCAST
                      </p>
                      <p className="text-xs text-gray-300 mb-3">
                        Your claim transaction has been broadcast to the Bitcoin
                        network. Tokens will be minted after confirmation
                        (~10-30 min).
                      </p>
                      <div className="bg-pixel-bg-dark/50 rounded p-2 mb-3">
                        <p className="text-xs text-gray-400 mb-1">
                          Transaction ID:
                        </p>
                        <a
                          href={`${config.explorerUrl}/tx/${broadcastResult.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-pixel-secondary hover:underline font-mono break-all"
                        >
                          {broadcastResult.txid}
                        </a>
                      </div>
                      <PixelButton
                        onClick={handleDismissResult}
                        variant="secondary"
                        className="w-full"
                      >
                        Done
                      </PixelButton>
                    </div>
                  )}

                  {/* Broadcast Failed Result */}
                  {broadcastResult && !broadcastResult.success && (
                    <div className="bg-red-500/20 border border-red-500/50 rounded p-4">
                      <p className="text-sm text-red-400 font-pixel mb-2">
                        BROADCAST FAILED
                      </p>
                      <p className="text-xs text-gray-300 mb-3">
                        The transaction could not be broadcast. Please try again
                        or check your wallet connection.
                      </p>
                      <PixelButton
                        onClick={handleDismissResult}
                        variant="secondary"
                        className="w-full"
                      >
                        Try Again
                      </PixelButton>
                    </div>
                  )}

                  {/* Auto-broadcast option (preferred) */}
                  {canAutoBroadcast && !broadcastResult && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
                      <p className="text-xs text-green-400 font-pixel mb-2">
                        ONE-CLICK CLAIM
                      </p>
                      <p className="text-xs text-gray-300 mb-3">
                        Click the button below to review and confirm your claim
                        transaction.
                      </p>
                      <PixelButton
                        onClick={handleShowConfirmModal}
                        disabled={isBroadcasting || isConfirming}
                        className="w-full"
                      >
                        {isBroadcasting
                          ? "Broadcasting..."
                          : isConfirming
                            ? "Confirming..."
                            : "Claim Tokens"}
                      </PixelButton>
                    </div>
                  )}

                  {/* Manual instructions (fallback) */}
                  {!canAutoBroadcast && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                      <p className="text-xs text-blue-400 font-pixel mb-2">
                        MANUAL CLAIM
                      </p>
                      <ol className="text-xs text-gray-300 space-y-1 list-decimal list-inside">
                        <li>
                          Create a Bitcoin TX with OP_RETURN containing the
                          claim data
                        </li>
                        <li>Broadcast the transaction</li>
                        <li>Enter the TXID below and confirm</li>
                      </ol>
                    </div>
                  )}

                  {/* OP_RETURN Data (for manual flow) */}
                  {!canAutoBroadcast && (
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        OP_RETURN Data (hex):
                      </p>
                      <div className="bg-pixel-bg-dark rounded p-2 font-mono text-xs text-gray-300 break-all">
                        {preparedClaim.claimData.opReturnData}
                      </div>
                    </div>
                  )}

                  {/* TXID Input (for manual flow) */}
                  {!canAutoBroadcast && (
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">
                        Transaction ID (after broadcast):
                      </label>
                      <input
                        type="text"
                        value={txidInput}
                        onChange={(e) => setTxidInput(e.target.value.trim())}
                        placeholder="Enter 64-character txid..."
                        className="w-full px-3 py-2 bg-pixel-bg-dark border-2 border-pixel-primary/30 rounded font-mono text-sm outline-none focus:border-pixel-primary"
                      />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!canAutoBroadcast && (
                      <PixelButton
                        onClick={handleConfirmClaim}
                        disabled={
                          isConfirming || !txidInput || txidInput.length !== 64
                        }
                        className="flex-1"
                      >
                        {isConfirming ? "Confirming..." : "Confirm Claim"}
                      </PixelButton>
                    )}
                    <PixelButton
                      onClick={clearPreparedClaim}
                      variant="secondary"
                    >
                      Cancel
                    </PixelButton>
                  </div>
                </div>
              </>
            )}

            {claimError && (
              <p className="text-xs text-red-400 text-center mt-2">
                {claimError}
              </p>
            )}
          </div>
        </PixelCard>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <PixelCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-pixel text-sm">Claim History</h3>
              <div className="flex items-center gap-2">
                {hasPendingClaims && (
                  <span className="text-[10px] text-pixel-secondary animate-pulse">
                    Auto-refresh active
                  </span>
                )}
                <PixelButton
                  onClick={() => loadHistory()}
                  size="sm"
                  variant="secondary"
                  disabled={isLoadingHistory}
                >
                  {isLoadingHistory ? "..." : "Refresh"}
                </PixelButton>
              </div>
            </div>

            {isLoadingHistory && claimHistory.length === 0 ? (
              <div className="animate-pulse space-y-2">
                <div className="h-16 bg-pixel-bg-dark rounded" />
                <div className="h-16 bg-pixel-bg-dark rounded" />
              </div>
            ) : claimHistory.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-400">No claims yet</p>
                <p className="text-xs text-gray-500 mt-1">
                  Your claim history will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {claimHistory.map((claim) => {
                  const statusInfo = getStatusExplanation(
                    claim.status,
                    claim.error,
                  );
                  return (
                    <div
                      key={claim.id}
                      className={`bg-pixel-bg-dark/50 rounded p-3 border-l-2 ${
                        claim.status === "completed"
                          ? "border-l-green-500"
                          : claim.status === "failed"
                            ? "border-l-red-500"
                            : claim.status === "minting"
                              ? "border-l-cyan-500"
                              : claim.status === "broadcast" ||
                                  claim.status === "confirmed"
                                ? "border-l-blue-500"
                                : "border-l-yellow-500"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-pixel text-sm">
                          {formatBalance(BigInt(claim.amount))} $BABTC
                        </span>
                        <ClaimStatusBadge status={claim.status} />
                      </div>

                      {/* Status explanation */}
                      <div className="mb-2 p-2 bg-pixel-bg-dark/50 rounded text-xs">
                        <p className="text-gray-300">{statusInfo.message}</p>
                        {statusInfo.errorDetail && (
                          <p className="text-red-400/80 mt-1 text-[10px]">
                            {statusInfo.errorDetail}
                          </p>
                        )}
                        {statusInfo.action && (
                          <p className="text-pixel-secondary mt-1 font-medium">
                            {statusInfo.action}
                          </p>
                        )}
                      </div>

                      <div className="text-xs text-gray-400 space-y-1">
                        <p>{claim.proofCount} proofs</p>
                        <p>Prepared: {formatDate(claim.preparedAt)}</p>
                        {claim.confirmedAt && (
                          <p>Confirmed: {formatDate(claim.confirmedAt)}</p>
                        )}
                        {claim.mintedAt && (
                          <p>Minted: {formatDate(claim.mintedAt)}</p>
                        )}
                        {claim.claimTxid && (
                          <a
                            href={`${config.explorerUrl}/tx/${claim.claimTxid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-pixel-secondary hover:underline block"
                          >
                            View Claim TX
                          </a>
                        )}
                        {claim.mintTxid && (
                          <a
                            href={`${config.explorerUrl}/tx/${claim.mintTxid}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:underline block"
                          >
                            View Mint TX
                          </a>
                        )}

                        {/* Action buttons based on status */}
                        {(claim.status === "broadcast" ||
                          claim.status === "confirmed") &&
                          claim.claimTxid && (
                            <PixelButton
                              onClick={() =>
                                handleTriggerMint(claim.id, claim.claimTxid!)
                              }
                              disabled={
                                mintingClaimId === claim.id || isMinting
                              }
                              size="sm"
                              className="mt-2 w-full"
                            >
                              {mintingClaimId === claim.id
                                ? "Minting..."
                                : "Mint Now"}
                            </PixelButton>
                          )}

                        {/* Retry button for failed claims */}
                        {claim.status === "failed" && claim.claimTxid && (
                          <PixelButton
                            onClick={() =>
                              handleTriggerMint(claim.id, claim.claimTxid!)
                            }
                            disabled={mintingClaimId === claim.id || isMinting}
                            variant="secondary"
                            size="sm"
                            className="mt-2 w-full"
                          >
                            {mintingClaimId === claim.id
                              ? "Retrying..."
                              : "Retry Mint"}
                          </PixelButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </PixelCard>
      )}

      {/* Info Notice */}
      <PixelCard>
        <div className="p-4">
          <p className="text-xs text-pixel-secondary font-pixel mb-3 text-center">
            HOW CLAIMING WORKS
          </p>
          <div className="space-y-3 text-xs text-gray-400">
            <div className="flex gap-3">
              <span className="text-pixel-primary font-pixel">1.</span>
              <p>
                <strong className="text-white">Mine</strong> - Earn $BABY tokens
                by mining (shown in &quot;Claimable Work&quot;)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-pixel-primary font-pixel">2.</span>
              <p>
                <strong className="text-white">Claim</strong> - Click
                &quot;Claim Tokens&quot; to create a Bitcoin transaction (~1000
                sats fee)
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-pixel-primary font-pixel">3.</span>
              <p>
                <strong className="text-white">Mint</strong> - After TX
                confirms, tokens are minted via Charms ZK prover
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-pixel-secondary font-pixel">4.</span>
              <p>
                <strong className="text-pixel-secondary">Receive</strong> -
                BABTC tokens appear in &quot;Your Wallet&quot; above
              </p>
            </div>
          </div>
          <p className="text-[10px] text-gray-500 mt-3 text-center">
            20% platform fee supports development. Tokens are stored on Bitcoin
            as Charms.
          </p>
        </div>
      </PixelCard>

      {/* Transaction Confirmation Modal */}
      {preparedClaim && (
        <TransactionConfirmModal
          isOpen={showConfirmModal}
          transaction={createClaimTransaction({
            tokenAmount: formatBalance(BigInt(preparedClaim.tokenAmount)),
            netTokens: preparedClaim.netTokens
              ? formatBalance(BigInt(preparedClaim.netTokens))
              : undefined,
            proofCount: preparedClaim.proofCount,
            networkFee: preparedClaim.estimatedFee,
            feeRate: preparedClaim.claimData.estimatedFee > 0 ? 5 : undefined,
            platformFeePercent: preparedClaim.platformFeePercent,
            platformFeeTokens: preparedClaim.platformFeeTokens
              ? formatBalance(BigInt(preparedClaim.platformFeeTokens))
              : undefined,
            fromAddress: address ?? "",
          })}
          isLoading={isBroadcasting}
          onConfirm={handleConfirmedBroadcast}
          onCancel={handleCancelModal}
        />
      )}
    </div>
  );
}

export default ClaimSection;
