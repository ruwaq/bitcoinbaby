"use client";

/**
 * WithdrawSection Component
 *
 * Complete withdrawal management interface.
 * Displays virtual balance, withdrawal pools, pending requests,
 * and on-chain transaction status.
 */

import { useState, useEffect, useCallback } from "react";
import { PixelCard, PixelButton } from "@bitcoinbaby/ui";
import type { PoolType, WithdrawRequest } from "@bitcoinbaby/core";
import {
  useWalletStore,
  useNetworkStore,
  usePendingTxStore,
} from "@bitcoinbaby/core";
import { validateAddress } from "@bitcoinbaby/bitcoin";
import { useVirtualBalance } from "../../hooks/useVirtualBalance";
import { useWithdrawPool, formatPoolType } from "../../hooks/useWithdrawPool";
import {
  useSystemStatus,
  type SystemStatus,
  type SystemHealth,
} from "../../hooks/useSystemStatus";
import { WithdrawPoolCard } from "./WithdrawPoolCard";
import { formatBalance, formatDate, formatRelativeTime } from "@/utils/format";

/**
 * Success notification for withdrawal
 */
interface WithdrawSuccess {
  amount: bigint;
  poolType: PoolType;
  timestamp: number;
}

/**
 * System Status Alert Component
 * Shows users the current state of the minting pipeline
 */
function SystemStatusAlert({
  status,
  onDismiss,
}: {
  status: SystemStatus;
  onDismiss?: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const configs: Record<
    SystemStatus,
    {
      bg: string;
      border: string;
      icon: string;
      title: string;
      message: string;
      details: string;
    }
  > = {
    operational: {
      bg: "bg-green-500/10",
      border: "border-green-500/30",
      icon: "✓",
      title: "System Operational",
      message: "All systems running normally.",
      details:
        "Your mining rewards are being tracked and withdrawals are processing normally.",
    },
    pending_signer: {
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/30",
      icon: "⏳",
      title: "Treasury Setup In Progress",
      message:
        "Your mining rewards are being tracked. On-chain transfers coming soon.",
      details:
        "We're setting up the Treasury system for efficient token distribution. Your Virtual Balance shows your earned rewards - these are securely recorded and will be transferable to your wallet once the Treasury is funded. This is a one-time setup process.",
    },
    maintenance: {
      bg: "bg-blue-500/10",
      border: "border-blue-500/30",
      icon: "🔧",
      title: "Scheduled Maintenance",
      message: "Withdrawals temporarily paused for maintenance.",
      details:
        "We're performing scheduled maintenance to improve the system. Your balance is safe and withdrawals will resume shortly.",
    },
    error: {
      bg: "bg-red-500/10",
      border: "border-red-500/30",
      icon: "⚠",
      title: "Service Disruption",
      message: "We're experiencing technical difficulties.",
      details:
        "Our team is working to resolve the issue. Your balance is safe. Please try again later.",
    },
  };

  const config = configs[status];

  return (
    <div className={`${config.bg} border-2 ${config.border} rounded p-3`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span className="text-lg">{config.icon}</span>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-pixel text-xs">{config.title}</p>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[8px] text-gray-400 hover:text-white underline"
              >
                {isExpanded ? "Less" : "More info"}
              </button>
            </div>
            <p className="text-xs text-gray-300 mt-1">{config.message}</p>
            {isExpanded && (
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                {config.details}
              </p>
            )}
          </div>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-white text-sm"
            aria-label="Dismiss alert"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Balance Tooltip Component
 * Explains what each balance type means
 */
function BalanceTooltip({
  type,
  isOpen,
  onClose,
}: {
  type: "virtual" | "onchain" | "pending" | "available";
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const tooltips: Record<string, { title: string; description: string }> = {
    virtual: {
      title: "Virtual Balance",
      description:
        "Rewards from mining that are tracked in our system. These are your earned $BABY tokens waiting to be transferred to the blockchain.",
    },
    onchain: {
      title: "On-Chain Balance",
      description:
        "Tokens that exist on the Bitcoin blockchain via Charms protocol. These are fully yours and can be transferred to any wallet.",
    },
    pending: {
      title: "Pending Withdraw",
      description:
        "Amount you've requested to withdraw. This is reserved from your virtual balance and waiting to be processed in a batch.",
    },
    available: {
      title: "Available to Withdraw",
      description:
        "The amount you can withdraw right now. This is your virtual balance minus any pending withdrawals.",
    },
  };

  const tooltip = tooltips[type];

  return (
    <div className="absolute z-10 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-pixel-bg-dark border-2 border-pixel-border rounded shadow-lg">
      <p className="font-pixel text-[8px] text-pixel-secondary mb-1">
        {tooltip.title}
      </p>
      <p className="text-[10px] text-gray-300 leading-relaxed">
        {tooltip.description}
      </p>
      <button
        onClick={onClose}
        className="absolute top-1 right-1 text-gray-400 hover:text-white text-xs"
      >
        ×
      </button>
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-4 border-transparent border-t-pixel-border" />
    </div>
  );
}

/**
 * Status badge component for withdraw requests
 */
function StatusBadge({ status }: { status: WithdrawRequest["status"] }) {
  const colors: Record<WithdrawRequest["status"], string> = {
    pending: "bg-yellow-500/20 text-yellow-400",
    processing: "bg-blue-500/20 text-blue-400",
    broadcast: "bg-purple-500/20 text-purple-400",
    confirmed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    cancelled: "bg-gray-500/20 text-gray-400",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-pixel ${colors[status]}`}
    >
      {status.toUpperCase()}
    </span>
  );
}

/**
 * Transaction status badge for on-chain transactions
 */
function TxStatusBadge({
  status,
}: {
  status:
    | "pending"
    | "mempool"
    | "confirming"
    | "confirmed"
    | "failed"
    | "replaced";
}) {
  const config: Record<
    string,
    { bg: string; text: string; label: string; icon: string }
  > = {
    pending: {
      bg: "bg-yellow-500/20",
      text: "text-yellow-400",
      label: "BROADCASTING",
      icon: "📡",
    },
    mempool: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      label: "IN MEMPOOL",
      icon: "⏳",
    },
    confirming: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      label: "CONFIRMING",
      icon: "⛏️",
    },
    confirmed: {
      bg: "bg-green-500/20",
      text: "text-green-400",
      label: "CONFIRMED",
      icon: "✓",
    },
    failed: {
      bg: "bg-red-500/20",
      text: "text-red-400",
      label: "FAILED",
      icon: "✗",
    },
    replaced: {
      bg: "bg-gray-500/20",
      text: "text-gray-400",
      label: "REPLACED",
      icon: "↻",
    },
  };

  const c = config[status] || config.pending;

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-pixel ${c.bg} ${c.text}`}
    >
      {c.icon} {c.label}
    </span>
  );
}

export function WithdrawSection() {
  // Use wallet store directly for consistent state across app
  const wallet = useWalletStore((s) => s.wallet);
  const address = wallet?.address ?? null;
  const { config, network } = useNetworkStore();

  // Pending transactions store
  const pendingTransactions = usePendingTxStore((s) => s.transactions);
  const refreshTxStore = usePendingTxStore((s) => s.refresh);
  const isTrackingTx = usePendingTxStore((s) => s.isTracking);

  // Filter withdraw-related transactions
  const withdrawTransactions = pendingTransactions.filter(
    (tx) => tx.type === "withdraw",
  );
  const pendingTxCount = withdrawTransactions.filter(
    (tx) =>
      tx.status === "pending" ||
      tx.status === "mempool" ||
      tx.status === "confirming",
  ).length;

  const [destinationAddress, setDestinationAddress] = useState("");
  const [addressValidation, setAddressValidation] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<
    "pools" | "requests" | "transactions"
  >("pools");
  const [successNotification, setSuccessNotification] =
    useState<WithdrawSuccess | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSystemAlert, setShowSystemAlert] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<
    "virtual" | "onchain" | "pending" | "available" | null
  >(null);

  // System status from API
  const { status: systemStatus, health: systemHealth } = useSystemStatus();

  // Validate destination address on change
  const handleAddressChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.trim();
      setDestinationAddress(value);

      if (value === "") {
        setAddressValidation(null);
        return;
      }

      const result = validateAddress(value, network);
      setAddressValidation(result);
    },
    [network],
  );

  // Check if destination is valid (empty = use wallet address, or valid custom address)
  const isDestinationValid =
    destinationAddress === "" || (addressValidation?.valid ?? false);

  // Virtual balance from Workers API
  const {
    totalBalance,
    virtualBalance,
    pendingWithdraw,
    availableToWithdraw,
    onChainBalance,
    totalMined,
    totalWithdrawn,
    isLoading: balanceLoading,
    error: balanceError,
    refresh: refreshBalance,
  } = useVirtualBalance({ address: address ?? undefined });

  // Withdrawal pools
  const {
    pools,
    requests,
    isSubmitting,
    error: poolsError,
    createWithdrawRequest,
    cancelRequest,
    refresh: refreshPools,
  } = useWithdrawPool({ address: address ?? undefined });

  // Handle withdrawal
  const handleWithdraw = async (
    poolType: PoolType,
    amount: bigint,
  ): Promise<{ success: boolean; error?: string }> => {
    // Validate destination address
    if (!isDestinationValid) {
      return {
        success: false,
        error: addressValidation?.error || "Invalid destination address",
      };
    }

    const toAddress = destinationAddress || address;

    if (!toAddress) {
      return { success: false, error: "No destination address" };
    }

    const result = await createWithdrawRequest(poolType, toAddress, amount);

    if (result.success) {
      // Refresh balance to reflect reserved amount
      await refreshBalance();
    }

    return result;
  };

  // Handle cancel
  const handleCancel = async (request: WithdrawRequest) => {
    const result = await cancelRequest(request.poolType, request.id);

    if (result.success) {
      await refreshBalance();
    }
  };

  // Handle withdrawal success
  const handleWithdrawSuccess = (amount: bigint, poolType: PoolType) => {
    // Show success notification
    setSuccessNotification({ amount, poolType, timestamp: Date.now() });

    // Switch to requests tab to show the new request
    setActiveTab("requests");

    // Refresh pools to show updated request list
    refreshPools();
  };

  // Auto-dismiss success notification after 10 seconds
  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => {
        setSuccessNotification(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  // Refresh all with loading state
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refreshBalance(), refreshPools(), refreshTxStore()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!address) {
    return (
      <PixelCard>
        <div className="p-6 text-center">
          <p className="font-pixel text-lg mb-2">Connect Wallet</p>
          <p className="text-sm text-gray-400">
            Create or unlock your wallet to manage withdrawals
          </p>
        </div>
      </PixelCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* System Status Alert */}
      {showSystemAlert && systemStatus !== "operational" && (
        <SystemStatusAlert
          status={systemStatus}
          onDismiss={() => setShowSystemAlert(false)}
        />
      )}

      {/* Success Notification */}
      {successNotification && (
        <div className="bg-green-500/20 border-2 border-green-500 rounded p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✓</span>
              <div>
                <p className="font-pixel text-sm text-green-400">
                  Withdrawal Request Created!
                </p>
                <p className="text-xs text-gray-300 mt-1">
                  {formatBalance(successNotification.amount)} $BABY queued for{" "}
                  {formatPoolType(successNotification.poolType)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSuccessNotification(null)}
              className="text-gray-400 hover:text-white text-lg"
            >
              ×
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Your withdrawal is now pending. Check the &quot;My Requests&quot;
            tab for status updates.
          </p>
        </div>
      )}

      {/* Balance Overview */}
      <PixelCard>
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-pixel text-lg">$BABY Balance</h2>
            <PixelButton
              onClick={handleRefresh}
              size="sm"
              variant="secondary"
              disabled={isRefreshing}
            >
              {isRefreshing ? (
                <span className="flex items-center gap-1">
                  <span className="animate-spin">↻</span>
                  <span>Loading...</span>
                </span>
              ) : (
                "Refresh"
              )}
            </PixelButton>
          </div>

          {balanceLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 bg-pixel-bg-dark rounded" />
              <div className="h-4 bg-pixel-bg-dark rounded w-1/2" />
            </div>
          ) : (
            <>
              {/* Main Balance */}
              <div className="text-center mb-4">
                <p className="text-4xl font-pixel text-pixel-primary">
                  {formatBalance(totalBalance)}
                </p>
                <p className="text-sm text-gray-400">Total $BABY</p>
              </div>

              {/* Balance Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div
                  className="bg-pixel-bg-dark/50 rounded p-3 text-center relative cursor-help"
                  onClick={() =>
                    setActiveTooltip(
                      activeTooltip === "virtual" ? null : "virtual",
                    )
                  }
                >
                  <BalanceTooltip
                    type="virtual"
                    isOpen={activeTooltip === "virtual"}
                    onClose={() => setActiveTooltip(null)}
                  />
                  <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
                    Virtual
                    <span className="text-[8px] text-gray-500">ⓘ</span>
                  </p>
                  <p className="font-pixel text-sm text-green-400">
                    {formatBalance(virtualBalance)}
                  </p>
                </div>
                <div
                  className="bg-pixel-bg-dark/50 rounded p-3 text-center relative cursor-help"
                  onClick={() =>
                    setActiveTooltip(
                      activeTooltip === "onchain" ? null : "onchain",
                    )
                  }
                >
                  <BalanceTooltip
                    type="onchain"
                    isOpen={activeTooltip === "onchain"}
                    onClose={() => setActiveTooltip(null)}
                  />
                  <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
                    On-Chain
                    <span className="text-[8px] text-gray-500">ⓘ</span>
                  </p>
                  <p className="font-pixel text-sm text-blue-400">
                    {formatBalance(onChainBalance)}
                  </p>
                </div>
                <div
                  className="bg-pixel-bg-dark/50 rounded p-3 text-center relative cursor-help"
                  onClick={() =>
                    setActiveTooltip(
                      activeTooltip === "pending" ? null : "pending",
                    )
                  }
                >
                  <BalanceTooltip
                    type="pending"
                    isOpen={activeTooltip === "pending"}
                    onClose={() => setActiveTooltip(null)}
                  />
                  <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
                    Pending
                    <span className="text-[8px] text-gray-500">ⓘ</span>
                  </p>
                  <p className="font-pixel text-sm text-yellow-400">
                    {formatBalance(pendingWithdraw)}
                  </p>
                </div>
                <div
                  className="bg-pixel-bg-dark/50 rounded p-3 text-center relative cursor-help"
                  onClick={() =>
                    setActiveTooltip(
                      activeTooltip === "available" ? null : "available",
                    )
                  }
                >
                  <BalanceTooltip
                    type="available"
                    isOpen={activeTooltip === "available"}
                    onClose={() => setActiveTooltip(null)}
                  />
                  <p className="text-xs text-gray-400 mb-1 flex items-center justify-center gap-1">
                    Available
                    <span className="text-[8px] text-gray-500">ⓘ</span>
                  </p>
                  <p className="font-pixel text-sm text-pixel-secondary">
                    {formatBalance(availableToWithdraw)}
                  </p>
                </div>
              </div>

              {/* Lifetime Stats */}
              <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
                <span>
                  Mined:{" "}
                  <span className="text-white">
                    {formatBalance(totalMined)}
                  </span>
                </span>
                <span>
                  Withdrawn:{" "}
                  <span className="text-white">
                    {formatBalance(totalWithdrawn)}
                  </span>
                </span>
              </div>

              {balanceError && (
                <p className="text-xs text-red-400 text-center mt-2">
                  {balanceError}
                </p>
              )}
            </>
          )}
        </div>
      </PixelCard>

      {/* Destination Address */}
      <PixelCard>
        <div className="p-4">
          <label className="block text-sm font-pixel mb-2">
            Destination Address (optional)
          </label>
          <div className="relative">
            <input
              type="text"
              value={destinationAddress}
              onChange={handleAddressChange}
              placeholder={address ?? ""}
              aria-label="Bitcoin destination address"
              aria-invalid={
                addressValidation && !addressValidation.valid ? "true" : "false"
              }
              className={`w-full px-3 py-2 pr-10 bg-pixel-bg-dark border-2 rounded font-mono text-sm outline-none transition-colors ${
                destinationAddress === ""
                  ? "border-pixel-primary/30 focus:border-pixel-primary"
                  : addressValidation?.valid
                    ? "border-pixel-success"
                    : "border-pixel-error"
              }`}
            />
            {/* Validation indicator */}
            {destinationAddress && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {addressValidation?.valid ? (
                  <span className="font-pixel text-pixel-success text-xs">
                    OK
                  </span>
                ) : (
                  <span className="font-pixel text-pixel-error text-xs">X</span>
                )}
              </div>
            )}
          </div>
          {/* Error message */}
          {addressValidation && !addressValidation.valid && (
            <p className="text-xs text-pixel-error mt-1">
              {addressValidation.error || "Invalid address"}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Leave empty to withdraw to your wallet address
          </p>
        </div>
      </PixelCard>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <PixelButton
          onClick={() => setActiveTab("pools")}
          variant={activeTab === "pools" ? "default" : "secondary"}
          size="sm"
        >
          Withdrawal Pools
        </PixelButton>
        <PixelButton
          onClick={() => setActiveTab("requests")}
          variant={activeTab === "requests" ? "default" : "secondary"}
          size="sm"
        >
          My Requests ({requests.length})
        </PixelButton>
        <PixelButton
          onClick={() => setActiveTab("transactions")}
          variant={activeTab === "transactions" ? "default" : "secondary"}
          size="sm"
        >
          Transactions{" "}
          {pendingTxCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400 rounded text-[8px]">
              {pendingTxCount}
            </span>
          )}
        </PixelButton>
      </div>

      {/* Pool Selection */}
      {activeTab === "pools" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(["monthly", "weekly", "low_fee", "immediate"] as PoolType[]).map(
            (poolType) => (
              <WithdrawPoolCard
                key={poolType}
                poolType={poolType}
                poolInfo={pools[poolType]}
                availableBalance={availableToWithdraw}
                onWithdraw={handleWithdraw}
                isSubmitting={isSubmitting}
                destinationAddress={destinationAddress || address || undefined}
                onSuccess={handleWithdrawSuccess}
              />
            ),
          )}
        </div>
      )}

      {/* Pending Requests */}
      {activeTab === "requests" && (
        <PixelCard>
          <div className="p-4">
            <h3 className="font-pixel text-sm mb-4">Withdrawal Requests</h3>

            {requests.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-4xl">📋</div>
                <p className="text-gray-400">No withdrawal requests yet</p>
                <div className="text-xs text-gray-500 space-y-1">
                  <p>Requests appear here when you submit a withdrawal.</p>
                  <p>
                    Select a pool from the{" "}
                    <button
                      onClick={() => setActiveTab("pools")}
                      className="text-pixel-secondary hover:underline"
                    >
                      Withdrawal Pools
                    </button>{" "}
                    tab to get started.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div
                    key={request.id}
                    className="bg-pixel-bg-dark/50 rounded p-3 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-pixel text-sm">
                          {formatBalance(BigInt(request.amount))} $BABY
                        </span>
                        <StatusBadge status={request.status} />
                      </div>
                      <div className="text-xs text-gray-400">
                        <span>{formatPoolType(request.poolType)}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(request.requestedAt)}</span>
                      </div>
                      {request.txid && (
                        <a
                          href={`${config.explorerUrl}/tx/${request.txid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-pixel-secondary hover:underline"
                        >
                          View TX
                        </a>
                      )}
                      {request.error && (
                        <p className="text-xs text-red-400 mt-1">
                          {request.error}
                        </p>
                      )}
                    </div>

                    {request.status === "pending" && (
                      <PixelButton
                        onClick={() => handleCancel(request)}
                        size="sm"
                        variant="secondary"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </PixelButton>
                    )}
                  </div>
                ))}
              </div>
            )}

            {poolsError && (
              <p className="text-xs text-red-400 text-center mt-2">
                {poolsError}
              </p>
            )}
          </div>
        </PixelCard>
      )}

      {/* On-Chain Transactions */}
      {activeTab === "transactions" && (
        <PixelCard>
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-pixel text-sm">On-Chain Transactions</h3>
              <div className="flex items-center gap-2">
                {isTrackingTx ? (
                  <span className="text-[8px] text-green-400 flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    TRACKING
                  </span>
                ) : (
                  <span className="text-[8px] text-gray-500">NOT TRACKING</span>
                )}
              </div>
            </div>

            {withdrawTransactions.length === 0 ? (
              <div className="text-center py-8 space-y-4">
                <div className="text-4xl">📦</div>
                <p className="text-gray-400">No transactions yet</p>
                <div className="text-xs text-gray-500 space-y-2 max-w-sm mx-auto">
                  <p>
                    When your withdrawal is broadcast to the Bitcoin network, it
                    will appear here with real-time status updates.
                  </p>
                  <div className="bg-pixel-bg-dark/50 rounded p-3 text-left">
                    <p className="font-pixel text-[8px] text-pixel-secondary mb-2">
                      TRANSACTION LIFECYCLE:
                    </p>
                    <div className="space-y-1 text-[10px]">
                      <p>📡 Broadcasting → Sending to network</p>
                      <p>⏳ In Mempool → Waiting for miner</p>
                      <p>⛏️ Confirming → In a block, getting confirmations</p>
                      <p>✓ Confirmed → Complete!</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {withdrawTransactions.map((tx) => (
                  <div
                    key={tx.txid}
                    className={`rounded p-3 border-2 ${
                      tx.status === "confirmed"
                        ? "bg-green-500/10 border-green-500/30"
                        : tx.status === "failed"
                          ? "bg-red-500/10 border-red-500/30"
                          : "bg-pixel-bg-dark/50 border-pixel-border"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <TxStatusBadge status={tx.status} />
                          {tx.confirmations > 0 && (
                            <span className="text-[8px] text-gray-400">
                              {tx.confirmations} conf
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-300 mb-1">
                          {tx.description}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono truncate">
                          {tx.txid}
                        </p>
                        <p className="text-[8px] text-gray-500 mt-1">
                          {formatRelativeTime(tx.submittedAt)}
                        </p>
                      </div>
                      <a
                        href={tx.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2 py-1 text-[8px] font-pixel text-pixel-secondary border border-pixel-secondary/30 rounded hover:bg-pixel-secondary/10"
                      >
                        VIEW
                      </a>
                    </div>
                    {tx.error && (
                      <p className="text-xs text-red-400 mt-2 p-2 bg-red-500/10 rounded">
                        Error: {tx.error}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PixelCard>
      )}

      {/* Info */}
      <PixelCard>
        <div className="p-4">
          <h3 className="font-pixel text-xs text-pixel-secondary mb-3">
            How Withdrawals Work
          </h3>
          <div className="space-y-3 text-xs text-gray-400">
            <div className="flex gap-2">
              <span className="text-green-400">1.</span>
              <p>
                <strong className="text-gray-300">Mine $BABY</strong> - Your
                mining rewards are tracked as Virtual Balance
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-blue-400">2.</span>
              <p>
                <strong className="text-gray-300">Request Withdraw</strong> -
                Choose a pool based on your urgency and fee preference
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-purple-400">3.</span>
              <p>
                <strong className="text-gray-300">Batch Processing</strong> -
                Withdrawals are grouped to minimize Bitcoin fees
              </p>
            </div>
            <div className="flex gap-2">
              <span className="text-pixel-primary">4.</span>
              <p>
                <strong className="text-gray-300">On-Chain Tokens</strong> -
                Receive $BABY tokens via Charms protocol on Bitcoin
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-pixel-border/30">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="text-yellow-400">TIP:</span>
              <p className="text-gray-400">
                Monthly pool has the lowest fees (~2%). Immediate pool processes
                within 1 hour but has higher fees (~10%).
              </p>
            </div>
          </div>
        </div>
      </PixelCard>
    </div>
  );
}

export default WithdrawSection;
