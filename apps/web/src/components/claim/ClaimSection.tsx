"use client";

/**
 * ClaimSection Component
 *
 * Simplified claim interface using Server-Assisted flow.
 * User never sees: UTXOs, OP_RETURN, transaction building details.
 * User only sees: tokens to claim, fee, and one button.
 */

import { PixelCard, PixelButton } from "@bitcoinbaby/ui";
import { useWalletSign } from "@bitcoinbaby/core";
import { useClaim, type ClaimStatus } from "@/hooks/useClaim";

// =============================================================================
// FORMATTERS
// =============================================================================

function formatTokens(amount: string): string {
  const num = BigInt(amount);
  if (num >= 1_000_000n) {
    return `${(Number(num) / 1_000_000).toFixed(2)}M`;
  }
  if (num >= 1_000n) {
    return `${(Number(num) / 1_000).toFixed(2)}K`;
  }
  return num.toString();
}

function formatSats(sats: number): string {
  if (sats >= 100_000) {
    return `${(sats / 100_000).toFixed(3)} mBTC`;
  }
  return `${sats.toLocaleString()} sats`;
}

// =============================================================================
// STATUS INDICATOR
// =============================================================================

function StatusIndicator({ status }: { status: ClaimStatus }) {
  const statusConfig: Record<
    ClaimStatus,
    { label: string; color: string; animate: boolean }
  > = {
    idle: { label: "", color: "", animate: false },
    loading: { label: "Loading...", color: "text-gray-400", animate: true },
    ready: { label: "Ready to claim", color: "text-green-400", animate: false },
    signing: {
      label: "Sign in wallet...",
      color: "text-yellow-400",
      animate: true,
    },
    completing: {
      label: "Broadcasting...",
      color: "text-blue-400",
      animate: true,
    },
    success: {
      label: "Claim complete!",
      color: "text-green-400",
      animate: false,
    },
    error: { label: "Error", color: "text-red-400", animate: false },
  };

  const config = statusConfig[status];
  if (!config.label) return null;

  return (
    <div
      className={`text-center text-sm font-pixel ${config.color} ${config.animate ? "animate-pulse" : ""}`}
    >
      {config.label}
    </div>
  );
}

// =============================================================================
// DEPOSIT PROMPT
// =============================================================================

function DepositPrompt({
  address,
  shortfall,
  recommended,
}: {
  address: string;
  shortfall: number;
  recommended: number;
}) {
  const copyAddress = () => {
    navigator.clipboard.writeText(address);
  };

  return (
    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
      <h4 className="text-yellow-400 font-pixel text-sm mb-2">
        Deposit Required
      </h4>
      <p className="text-xs text-gray-300 mb-3">
        You need at least{" "}
        <span className="text-white font-bold">{formatSats(shortfall)}</span> to
        pay the network fee. We recommend depositing{" "}
        <span className="text-white font-bold">{formatSats(recommended)}</span>{" "}
        for future claims.
      </p>

      <div className="bg-pixel-bg-dark rounded p-2 flex items-center justify-between gap-2">
        <code className="text-xs text-pixel-primary truncate flex-1">
          {address}
        </code>
        <button
          onClick={copyAddress}
          className="text-xs text-pixel-secondary hover:text-white px-2 py-1 rounded bg-pixel-bg-dark/50"
        >
          Copy
        </button>
      </div>

      <p className="text-[10px] text-gray-500 mt-2 text-center">
        Send testnet4 Bitcoin to this address
      </p>
    </div>
  );
}

// =============================================================================
// CLAIM SUMMARY
// =============================================================================

function ClaimSummary({
  netTokens,
  platformFee,
  platformFeePercent,
  networkFee,
}: {
  netTokens: string;
  platformFee: string;
  platformFeePercent: number;
  networkFee: number;
}) {
  return (
    <div className="space-y-2 mb-4">
      {/* Main amount */}
      <div className="text-center py-3">
        <p className="text-xs text-gray-400 font-pixel mb-1">
          YOU WILL RECEIVE
        </p>
        <p className="text-3xl font-pixel text-pixel-primary">
          {formatTokens(netTokens)}
        </p>
        <p className="text-xs text-gray-500">BABTC tokens</p>
      </div>

      {/* Fee breakdown */}
      <div className="bg-pixel-bg-dark/30 rounded p-3 space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">
            Platform fee ({platformFeePercent}%)
          </span>
          <span className="text-gray-300">
            -{formatTokens(platformFee)} BABTC
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">Network fee</span>
          <span className="text-gray-300">~{formatSats(networkFee)}</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function ClaimSection() {
  const { address, signPsbt, isConnected, isLocked } = useWalletSign();

  const {
    status,
    balance,
    error,
    completedTxid,
    canClaim,
    needsDeposit,
    executeClaim,
    refreshBalance,
    reset,
  } = useClaim({
    address,
    signPsbt,
  });

  // Not connected state
  if (!isConnected) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-400 font-pixel text-sm mb-2">CLAIM TOKENS</p>
          <p className="text-xs text-gray-500">
            Connect your wallet to claim mined tokens
          </p>
        </div>
      </PixelCard>
    );
  }

  // Wallet locked state
  if (isLocked) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-400 font-pixel text-sm mb-2">WALLET LOCKED</p>
          <p className="text-xs text-gray-500">
            Unlock your wallet to claim tokens
          </p>
        </div>
      </PixelCard>
    );
  }

  // Loading state
  if (status === "loading" && !balance) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-8">
          <div className="animate-spin w-8 h-8 border-2 border-pixel-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400 font-pixel text-sm">Loading balance...</p>
        </div>
      </PixelCard>
    );
  }

  // No balance data
  if (!balance) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-400 font-pixel text-sm mb-2">NO DATA</p>
          <p className="text-xs text-gray-500 mb-4">
            Could not load claim balance
          </p>
          <PixelButton variant="secondary" size="sm" onClick={refreshBalance}>
            Retry
          </PixelButton>
        </div>
      </PixelCard>
    );
  }

  // No tokens to claim
  const hasTokens = BigInt(balance.claimableTokens) > 0n;
  if (!hasTokens) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-8">
          <p className="text-gray-400 font-pixel text-sm mb-2">
            NO TOKENS TO CLAIM
          </p>
          <p className="text-xs text-gray-500 mb-1">
            Mine more to accumulate claimable tokens
          </p>
          <p className="text-xs text-gray-600">
            Proofs submitted: {balance.unclaimedProofs}
          </p>
        </div>
      </PixelCard>
    );
  }

  // Success state
  if (status === "success" && completedTxid) {
    return (
      <PixelCard className="p-4">
        <div className="text-center py-6">
          <div className="text-4xl mb-3">✓</div>
          <p className="text-green-400 font-pixel text-lg mb-2">
            CLAIM SUCCESSFUL!
          </p>
          <p className="text-xs text-gray-400 mb-4">
            Your tokens are being processed
          </p>
          <p className="text-[10px] text-gray-500 mb-4 break-all">
            TX: {completedTxid}
          </p>
          <PixelButton variant="secondary" size="sm" onClick={reset}>
            Claim More
          </PixelButton>
        </div>
      </PixelCard>
    );
  }

  return (
    <PixelCard className="p-4">
      <h3 className="text-pixel-primary font-pixel text-sm mb-4 text-center">
        CLAIM TOKENS
      </h3>

      {/* Deposit prompt if needed */}
      {needsDeposit && address && (
        <DepositPrompt
          address={address}
          shortfall={balance.userFunds.shortfall}
          recommended={balance.depositInfo.recommendedDeposit}
        />
      )}

      {/* Claim summary */}
      <ClaimSummary
        netTokens={balance.netTokens}
        platformFee={balance.platformFeeTokens}
        platformFeePercent={balance.platformFeePercent}
        networkFee={balance.userFunds.estimatedFee}
      />

      {/* Status indicator */}
      <StatusIndicator status={status} />

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4 text-center">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Blocking reason */}
      {balance.blockingReason && status !== "error" && (
        <p className="text-xs text-yellow-400 text-center mb-4">
          {balance.blockingReason}
        </p>
      )}

      {/* Action button */}
      <PixelButton
        onClick={executeClaim}
        disabled={!canClaim || status === "signing" || status === "completing"}
        className="w-full"
        size="lg"
      >
        {status === "signing"
          ? "Sign in Wallet..."
          : status === "completing"
            ? "Broadcasting..."
            : needsDeposit
              ? "Deposit Required"
              : `Claim ${formatTokens(balance.netTokens)} BABTC`}
      </PixelButton>

      {/* Refresh button */}
      <button
        onClick={refreshBalance}
        disabled={status === "loading"}
        className="w-full text-xs text-gray-500 hover:text-gray-300 mt-3 py-1"
      >
        {status === "loading" ? "Refreshing..." : "Refresh Balance"}
      </button>
    </PixelCard>
  );
}

export default ClaimSection;
