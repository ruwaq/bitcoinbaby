"use client";

/**
 * ClaimSection Component
 *
 * Complete claim management interface.
 * Displays claimable work, prepares claims, and tracks claim history.
 */

import { useState, useMemo, useCallback } from "react";
import {
  PixelCard,
  PixelButton,
  TransactionConfirmModal,
  createClaimTransaction,
} from "@bitcoinbaby/ui";
import { useNetworkStore } from "@bitcoinbaby/core";
import { TransactionBuilder } from "@bitcoinbaby/bitcoin";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { useClaim } from "@/hooks/useClaim";
import { useBalance } from "@/hooks/useBalance";
import { formatBalance, formatDate } from "@/utils/format";

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
 * Status badge for claims
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
  } | null>(null);

  const {
    claimableBalance,
    isLoadingBalance,
    balanceError,
    preparedClaim,
    isPreparing,
    isConfirming,
    isBroadcasting,
    claimError,
    claimHistory,
    isLoadingHistory,
    canAutoBroadcast,
    refreshBalance,
    prepareClaim,
    broadcastClaimTx,
    confirmClaim,
    loadHistory,
    clearPreparedClaim,
  } = useClaim({
    address: address ?? undefined,
    publicKey: publicKey ?? undefined,
    utxos: txUtxos,
    // Use unified wallet connection - canSign ensures wallet is unlocked and ready
    signAndBroadcast: canSign ? adaptedSignAndBroadcast : undefined,
  });

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
    const txid = await broadcastClaimTx();
    if (txid) {
      setTxidInput("");
      setBroadcastResult({ success: true, txid });
    } else {
      setBroadcastResult({ success: false });
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
      {/* Balance Overview */}
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
            <h3 className="font-pixel text-sm mb-4">Claim History</h3>

            {isLoadingHistory ? (
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
                {claimHistory.map((claim) => (
                  <div
                    key={claim.id}
                    className="bg-pixel-bg-dark/50 rounded p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-pixel text-sm">
                        {formatBalance(BigInt(claim.amount))} $BABTC
                      </span>
                      <ClaimStatusBadge status={claim.status} />
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <p>{claim.proofCount} proofs</p>
                      <p>Prepared: {formatDate(claim.preparedAt)}</p>
                      {claim.claimTxid && (
                        <a
                          href={`${config.explorerUrl}/tx/${claim.claimTxid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pixel-secondary hover:underline block"
                        >
                          View TX
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </PixelCard>
      )}

      {/* Info Notice */}
      <PixelCard>
        <div className="p-4 text-center">
          <p className="text-xs text-pixel-secondary font-pixel mb-2">
            HOW IT WORKS
          </p>
          <p className="text-xs text-gray-400">
            Your mining proofs are aggregated into a claim. With a connected
            wallet, click &quot;Claim Tokens&quot; to automatically create and
            broadcast the transaction. You pay the Bitcoin network fee (~1000
            sats). A 20% platform fee goes to the foundation to support ongoing
            development.
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
