"use client";

/**
 * TransactionReview Component
 *
 * Anti-Blind-Signing: Shows users EXACTLY what they're about to sign.
 * This prevents blind signing attacks which have caused billions in losses.
 *
 * @see https://blocktelegraph.io/web3-security-best-practices-developer-insights/
 */

import { useState } from "react";
import type { FeeLevel } from "./FeeSelector";
import type { BitcoinNetwork } from "@bitcoinbaby/bitcoin";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import { satsToBtc, formatSats } from "@/utils/format";

interface TransactionReviewProps {
  recipient: string;
  amountSatoshis: number;
  feeLevel: FeeLevel;
  feeRate: number;
  feeSatoshis: number;
  senderAddress: string;
  network: BitcoinNetwork;
  onConfirm: () => void;
  onBack: () => void;
  isLoading?: boolean;
  // Optional: Show input/output details
  inputCount?: number;
  outputCount?: number;
  virtualSize?: number;
  // Optional: Total balance for large transaction warning
  totalBalance?: number;
}

export function TransactionReview({
  recipient,
  amountSatoshis,
  feeLevel,
  feeRate,
  feeSatoshis,
  senderAddress,
  network,
  onConfirm,
  onBack,
  isLoading = false,
  inputCount,
  outputCount,
  virtualSize,
  totalBalance,
}: TransactionReviewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const totalSatoshis = amountSatoshis + feeSatoshis;

  // Check if this is a large transaction (>50% of balance)
  // Guard against division by zero and invalid values
  const hasValidBalance = totalBalance && totalBalance > 0;
  const isLargeTransaction =
    hasValidBalance && totalSatoshis > totalBalance * 0.5;

  // Calculate percentage with bounds checking (0-100%)
  const rawPercentage = hasValidBalance
    ? (totalSatoshis / totalBalance) * 100
    : 0;
  const percentageOfBalance = Math.min(
    100,
    Math.max(0, Math.round(rawPercentage)),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-pixel text-lg text-pixel-primary mb-2">
          REVIEW TRANSACTION
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Verify ALL details before signing
        </p>
      </div>

      {/* Security Warning Banner */}
      <div className="bg-pixel-warning/20 border-2 border-pixel-warning p-3">
        <p className="font-pixel text-[8px] text-pixel-warning text-center">
          REVIEW CAREFULLY - THIS ACTION CANNOT BE UNDONE
        </p>
      </div>

      {/* Large Transaction Warning */}
      {isLargeTransaction && (
        <div className="bg-pixel-error/20 border-2 border-pixel-error p-3">
          <div className="flex items-center justify-center gap-2">
            <span className="font-pixel text-lg text-pixel-error">!!</span>
            <div className="text-center">
              <p className="font-pixel text-[10px] text-pixel-error">
                LARGE TRANSACTION WARNING
              </p>
              <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                This is {percentageOfBalance}% of your total balance
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Transaction details */}
      <div className={`bg-pixel-bg-dark ${pixelBorders.medium} p-4 space-y-4`}>
        {/* From */}
        <div>
          <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
            FROM
          </label>
          <p className="font-pixel-body text-sm text-pixel-text break-all">
            {senderAddress}
          </p>
        </div>

        {/* Arrow */}
        <div className="text-center py-2">
          <span className="font-pixel text-2xl text-pixel-secondary">V</span>
        </div>

        {/* To */}
        <div>
          <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
            TO
          </label>
          <p className="font-pixel-body text-sm text-pixel-text break-all">
            {recipient}
          </p>
        </div>
      </div>

      {/* Amount breakdown */}
      <div className={`bg-pixel-bg-light ${pixelBorders.medium} p-4 space-y-3`}>
        {/* Amount */}
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[10px] text-pixel-text-muted">
            AMOUNT
          </span>
          <div className="text-right">
            <span className="font-pixel text-lg text-pixel-text">
              {satsToBtc(amountSatoshis)} BTC
            </span>
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              {formatSats(amountSatoshis)} sats
            </p>
          </div>
        </div>

        {/* Fee */}
        <div className="flex items-center justify-between">
          <span className="font-pixel text-[10px] text-pixel-text-muted">
            NETWORK FEE ({feeLevel.toUpperCase()})
          </span>
          <div className="text-right">
            <span className="font-pixel text-sm text-pixel-secondary">
              {satsToBtc(feeSatoshis)} BTC
            </span>
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              {feeRate} sat/vB
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-2 border-dashed border-pixel-border pt-3">
          <div className="flex items-center justify-between">
            <span className="font-pixel text-xs text-pixel-text-muted">
              TOTAL
            </span>
            <div className="text-right">
              <span className="font-pixel text-xl text-pixel-primary">
                {satsToBtc(totalSatoshis)} BTC
              </span>
              <p className="font-pixel text-[8px] text-pixel-text-muted">
                {formatSats(totalSatoshis)} sats
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Network warning for mainnet */}
      {network === "mainnet" && (
        <div className="bg-pixel-error/20 border-4 border-pixel-error p-4">
          <p className="font-pixel text-[10px] text-pixel-error text-center">
            MAINNET TRANSACTION - REAL BITCOIN!
          </p>
          <p className="font-pixel-body text-xs text-pixel-text-muted text-center mt-1">
            This transaction cannot be reversed
          </p>
        </div>
      )}

      {/* Testnet notice */}
      {network !== "mainnet" && (
        <div className="bg-pixel-secondary/20 border-2 border-pixel-secondary p-3">
          <p className="font-pixel text-[8px] text-pixel-secondary text-center">
            TESTNET4 - No real value
          </p>
        </div>
      )}

      {/* Advanced Details (collapsible) */}
      {(inputCount || outputCount || virtualSize) && (
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary"
          >
            {showAdvanced ? "- HIDE" : "+ SHOW"} TECHNICAL DETAILS
          </button>

          {showAdvanced && (
            <div className="mt-3 bg-pixel-bg-dark p-3 border-2 border-pixel-border space-y-2">
              {inputCount && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-pixel text-pixel-text-muted">
                    Inputs
                  </span>
                  <span className="font-pixel-mono text-pixel-text">
                    {inputCount}
                  </span>
                </div>
              )}
              {outputCount && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-pixel text-pixel-text-muted">
                    Outputs
                  </span>
                  <span className="font-pixel-mono text-pixel-text">
                    {outputCount}
                  </span>
                </div>
              )}
              {virtualSize && (
                <div className="flex justify-between text-[10px]">
                  <span className="font-pixel text-pixel-text-muted">
                    Virtual Size
                  </span>
                  <span className="font-pixel-mono text-pixel-text">
                    {virtualSize} vB
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="font-pixel text-pixel-text-muted">
                  Fee Rate
                </span>
                <span className="font-pixel-mono text-pixel-text">
                  {feeRate} sat/vB
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={isLoading}
          className={`flex-1 py-4 font-pixel text-sm text-pixel-text bg-pixel-bg-light ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all disabled:opacity-50`}
        >
          BACK
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={`flex-1 py-4 font-pixel text-sm text-black bg-pixel-success ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all disabled:opacity-50`}
        >
          {isLoading ? "SIGNING..." : "CONFIRM & SEND"}
        </button>
      </div>

      {/* Security notice */}
      <p className="font-pixel text-[6px] text-pixel-text-muted text-center">
        Your private key never leaves this device
      </p>
    </div>
  );
}
