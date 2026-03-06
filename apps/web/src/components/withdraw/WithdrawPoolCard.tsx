"use client";

/**
 * WithdrawPoolCard Component
 *
 * Displays a withdrawal pool option and allows creating withdrawal requests.
 * Part of the batched withdrawal system for minimizing Bitcoin fees.
 */

import { useState, useCallback, useMemo } from "react";
import {
  PixelCard,
  PixelButton,
  TransactionConfirmModal,
  createWithdrawTransaction,
} from "@bitcoinbaby/ui";
import type { PoolType, PoolStatusResponse } from "@bitcoinbaby/core";
import { formatPoolType } from "../../hooks/useWithdrawPool";

/**
 * Safely parse string to BigInt (handles decimals and invalid input)
 */
function safeParseBigInt(value: string): bigint | null {
  if (!value || value.trim() === "") return null;

  // Remove whitespace
  const cleaned = value.trim();

  // Check if it's a valid integer (no decimals, no letters)
  if (!/^\d+$/.test(cleaned)) return null;

  try {
    return BigInt(cleaned);
  } catch {
    return null;
  }
}

interface WithdrawPoolCardProps {
  poolType: PoolType;
  poolInfo: (PoolStatusResponse & { name: string; description: string }) | null;
  availableBalance: bigint;
  onWithdraw: (
    poolType: PoolType,
    amount: bigint,
  ) => Promise<{ success: boolean; error?: string }>;
  isSubmitting?: boolean;
  minAmount?: bigint;
  /** Destination address for display in confirmation modal */
  destinationAddress?: string;
  /** Callback when withdrawal succeeds */
  onSuccess?: (amount: bigint, poolType: PoolType) => void;
}

export function WithdrawPoolCard({
  poolType,
  poolInfo,
  availableBalance,
  onWithdraw,
  isSubmitting = false,
  minAmount = 100n,
  destinationAddress,
  onSuccess,
}: WithdrawPoolCardProps) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingAmount, setPendingAmount] = useState<bigint>(0n);

  // Live validation of amount input
  const validation = useMemo(() => {
    if (!amount || amount.trim() === "") {
      return { valid: false, error: null, amount: 0n };
    }

    // Check for decimals
    if (amount.includes(".") || amount.includes(",")) {
      return { valid: false, error: "Only whole numbers allowed", amount: 0n };
    }

    const parsed = safeParseBigInt(amount);

    if (parsed === null) {
      return { valid: false, error: "Invalid number", amount: 0n };
    }

    if (parsed < minAmount) {
      return {
        valid: false,
        error: `Minimum: ${minAmount.toLocaleString()} tokens`,
        amount: parsed,
      };
    }

    if (parsed > availableBalance) {
      return {
        valid: false,
        error: `Max: ${availableBalance.toLocaleString()} tokens`,
        amount: parsed,
      };
    }

    return { valid: true, error: null, amount: parsed };
  }, [amount, minAmount, availableBalance]);

  // Handle input change - only allow digits
  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      // Only allow digits (no decimals, no negative)
      if (value === "" || /^\d+$/.test(value)) {
        setAmount(value);
        setError(null); // Clear submit error on change
      }
    },
    [],
  );

  // Validate and show confirmation modal
  const handleWithdraw = () => {
    if (!validation.valid) {
      setError(validation.error || "Invalid amount");
      return;
    }

    // Store pending amount and show confirmation modal
    setPendingAmount(validation.amount);
    setShowConfirmModal(true);
  };

  // Execute withdrawal after user confirms
  const handleConfirmWithdraw = async () => {
    setShowConfirmModal(false);

    const result = await onWithdraw(poolType, pendingAmount);

    if (!result.success) {
      setError(result.error ?? "Withdrawal failed");
    } else {
      const withdrawnAmount = pendingAmount;
      setAmount("");
      setPendingAmount(0n);
      // Notify parent of success
      onSuccess?.(withdrawnAmount, poolType);
    }
  };

  // Cancel confirmation
  const handleCancelConfirm = () => {
    setShowConfirmModal(false);
    setPendingAmount(0n);
  };

  const handleMaxClick = () => {
    setAmount(availableBalance.toString());
  };

  // Pool icons
  const poolIcons: Record<PoolType, string> = {
    weekly: "W",
    monthly: "M",
    low_fee: "$",
    immediate: "!",
  };

  // Pool colors
  const poolColors: Record<PoolType, string> = {
    weekly: "border-green-500",
    monthly: "border-blue-500",
    low_fee: "border-yellow-500",
    immediate: "border-red-500",
  };

  if (!poolInfo) {
    return (
      <PixelCard className={`opacity-50 ${poolColors[poolType]}`}>
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl font-pixel">{poolIcons[poolType]}</span>
            <span className="font-pixel text-sm">
              {formatPoolType(poolType)}
            </span>
          </div>
          <p className="text-xs text-gray-500">Loading...</p>
        </div>
      </PixelCard>
    );
  }

  const estimatedFee = poolInfo.estimatedFeePerUser;
  const nextProcessing = new Date(
    poolInfo.nextProcessingTime,
  ).toLocaleDateString();
  const usersInPool = poolInfo.pendingRequests;

  return (
    <PixelCard className={`${poolColors[poolType]} hover:border-opacity-100`}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-pixel">{poolIcons[poolType]}</span>
            <div>
              <h3 className="font-pixel text-sm">{poolInfo.name}</h3>
              <p className="text-xs text-gray-400">{poolInfo.description}</p>
            </div>
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-pixel-secondary hover:underline"
          >
            {showDetails ? "Hide" : "Details"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-3 text-center">
          <div className="bg-pixel-bg-dark/50 rounded p-2">
            <p className="text-xs text-gray-400">Fee Est.</p>
            <p className="font-pixel text-sm text-pixel-primary">
              {estimatedFee} sat
            </p>
          </div>
          <div className="bg-pixel-bg-dark/50 rounded p-2">
            <p className="text-xs text-gray-400">In Pool</p>
            <p className="font-pixel text-sm">{usersInPool}</p>
          </div>
          <div className="bg-pixel-bg-dark/50 rounded p-2">
            <p className="text-xs text-gray-400">Next</p>
            <p className="font-pixel text-xs">{nextProcessing}</p>
          </div>
        </div>

        {/* Details Panel */}
        {showDetails && (
          <div className="mb-3 p-2 bg-pixel-bg-dark/30 rounded text-xs">
            <p className="text-gray-400 mb-1">How it works:</p>
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              {poolType === "weekly" && (
                <>
                  <li>Withdrawals batched every Sunday</li>
                  <li>Share fees with other users</li>
                  <li>Lowest fees when pool is full</li>
                </>
              )}
              {poolType === "monthly" && (
                <>
                  <li>Withdrawals batched on 1st of month</li>
                  <li>Maximum fee savings</li>
                  <li>Best for large amounts</li>
                </>
              )}
              {poolType === "low_fee" && (
                <>
                  <li>Triggered when Bitcoin fees drop</li>
                  <li>Opportunistic processing</li>
                  <li>May process anytime</li>
                </>
              )}
              {poolType === "immediate" && (
                <>
                  <li>Processed within 1 hour</li>
                  <li>Higher individual fees</li>
                  <li>Best for urgent needs</li>
                </>
              )}
            </ul>
            <p className="mt-2 text-gray-400">
              Total in pool: {BigInt(poolInfo.totalAmount).toLocaleString()}{" "}
              tokens
            </p>
          </div>
        )}

        {/* Withdraw Form */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount}
              onChange={handleAmountChange}
              placeholder="Amount (whole numbers)"
              className={`flex-1 px-3 py-2 bg-pixel-bg-dark border rounded font-pixel text-sm outline-none transition-colors ${
                amount && !validation.valid
                  ? "border-red-500"
                  : amount && validation.valid
                    ? "border-green-500"
                    : "border-pixel-primary/30 focus:border-pixel-primary"
              }`}
              disabled={isSubmitting}
            />
            <button
              onClick={handleMaxClick}
              className="px-2 py-1 text-xs text-pixel-secondary hover:bg-pixel-secondary/10 rounded"
              disabled={isSubmitting}
            >
              MAX
            </button>
          </div>

          {/* Live validation error */}
          {amount && validation.error && (
            <p className="text-xs text-red-400">{validation.error}</p>
          )}

          {/* Submit error (from API) */}
          {error && !validation.error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          {/* Valid amount indicator */}
          {amount && validation.valid && (
            <p className="text-xs text-green-400">
              {validation.amount.toLocaleString()} tokens ready
            </p>
          )}

          <PixelButton
            onClick={handleWithdraw}
            disabled={isSubmitting || !amount || !validation.valid}
            className="w-full"
            size="sm"
          >
            {isSubmitting
              ? "Processing..."
              : `Withdraw to ${formatPoolType(poolType)}`}
          </PixelButton>
        </div>
      </div>

      {/* Confirmation Modal */}
      <TransactionConfirmModal
        isOpen={showConfirmModal}
        transaction={createWithdrawTransaction({
          amount: pendingAmount,
          toAddress: destinationAddress ?? "Your wallet",
          poolType: formatPoolType(poolType),
        })}
        isLoading={isSubmitting}
        onConfirm={handleConfirmWithdraw}
        onCancel={handleCancelConfirm}
      />
    </PixelCard>
  );
}

export default WithdrawPoolCard;
