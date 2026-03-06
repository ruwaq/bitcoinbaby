"use client";

/**
 * WithdrawSection Component
 *
 * Complete withdrawal management interface.
 * Displays virtual balance, withdrawal pools, and pending requests.
 */

import { useState, useEffect, useCallback } from "react";
import { PixelCard, PixelButton } from "@bitcoinbaby/ui";
import type { PoolType, WithdrawRequest } from "@bitcoinbaby/core";
import { useWalletStore, useNetworkStore } from "@bitcoinbaby/core";
import { validateAddress } from "@bitcoinbaby/bitcoin";
import { useVirtualBalance } from "../../hooks/useVirtualBalance";
import { useWithdrawPool, formatPoolType } from "../../hooks/useWithdrawPool";
import { WithdrawPoolCard } from "./WithdrawPoolCard";
import { formatBalance, formatDate } from "@/utils/format";

/**
 * Success notification for withdrawal
 */
interface WithdrawSuccess {
  amount: bigint;
  poolType: PoolType;
  timestamp: number;
}

/**
 * Status badge component
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

export function WithdrawSection() {
  // Use wallet store directly for consistent state across app
  const wallet = useWalletStore((s) => s.wallet);
  const address = wallet?.address ?? null;
  const { config, network } = useNetworkStore();

  const [destinationAddress, setDestinationAddress] = useState("");
  const [addressValidation, setAddressValidation] = useState<{
    valid: boolean;
    error?: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<"pools" | "requests">("pools");
  const [successNotification, setSuccessNotification] =
    useState<WithdrawSuccess | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
      await Promise.all([refreshBalance(), refreshPools()]);
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
                <div className="bg-pixel-bg-dark/50 rounded p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Virtual</p>
                  <p className="font-pixel text-sm text-green-400">
                    {formatBalance(virtualBalance)}
                  </p>
                </div>
                <div className="bg-pixel-bg-dark/50 rounded p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">On-Chain</p>
                  <p className="font-pixel text-sm text-blue-400">
                    {formatBalance(onChainBalance)}
                  </p>
                </div>
                <div className="bg-pixel-bg-dark/50 rounded p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Pending</p>
                  <p className="font-pixel text-sm text-yellow-400">
                    {formatBalance(pendingWithdraw)}
                  </p>
                </div>
                <div className="bg-pixel-bg-dark/50 rounded p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Available</p>
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
      <div className="flex gap-2">
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
              <p className="text-center text-gray-400 py-8">
                No withdrawal requests yet
              </p>
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

      {/* Info */}
      <div className="text-xs text-gray-400 text-center space-y-1">
        <p>Withdrawals are batched to minimize Bitcoin transaction fees.</p>
        <p>
          Monthly pool has the lowest fees. Immediate pool processes within 1
          hour.
        </p>
      </div>
    </div>
  );
}

export default WithdrawSection;
