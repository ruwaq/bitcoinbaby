/**
 * TransactionPreview - Anti Blind-Signing Component
 *
 * Shows users EXACTLY what they're about to sign before confirmation.
 * This prevents blind signing attacks which have caused billions in losses.
 *
 * @see https://blocktelegraph.io/web3-security-best-practices-developer-insights/
 */

"use client";

import { useState } from "react";
import clsx from "clsx";

// =============================================================================
// TYPES
// =============================================================================

export interface TransactionInput {
  txid: string;
  vout: number;
  value: number; // satoshis
}

export interface TransactionOutput {
  address: string;
  value: number; // satoshis
  type: "recipient" | "change" | "op_return" | "charm";
  label?: string;
}

export interface TransactionPreviewData {
  type: "send" | "mine" | "mint_nft" | "evolve_nft";
  inputs: TransactionInput[];
  outputs: TransactionOutput[];
  fee: number; // satoshis
  feeRate: number; // sat/vB
  virtualSize: number; // vBytes
  network: "mainnet" | "testnet4";
  // Mining specific
  miningReward?: bigint;
  difficulty?: number;
  // NFT specific
  nftName?: string;
  charmSpell?: {
    appId: string;
    action: string;
    data?: Record<string, unknown>;
  };
}

export interface TransactionPreviewProps {
  data: TransactionPreviewData;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  className?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

function formatSatoshis(sats: number): string {
  if (sats >= 100_000_000) {
    return `${(sats / 100_000_000).toFixed(8)} BTC`;
  }
  return `${sats.toLocaleString()} sats`;
}

function truncateTxid(txid: string): string {
  return `${txid.slice(0, 8)}...${txid.slice(-8)}`;
}

function getTransactionTypeInfo(type: TransactionPreviewData["type"]): {
  title: string;
  icon: string;
  color: string;
} {
  switch (type) {
    case "send":
      return { title: "SEND BITCOIN", icon: "↑", color: "text-pixel-error" };
    case "mine":
      return {
        title: "SUBMIT MINING PROOF",
        icon: "⛏",
        color: "text-pixel-success",
      };
    case "mint_nft":
      return { title: "MINT NFT", icon: "+", color: "text-pixel-primary" };
    case "evolve_nft":
      return { title: "EVOLVE NFT", icon: "↑", color: "text-pixel-secondary" };
    default:
      return { title: "TRANSACTION", icon: "→", color: "text-pixel-text" };
  }
}

// =============================================================================
// COMPONENT
// =============================================================================

export function TransactionPreview({
  data,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
  className,
}: TransactionPreviewProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (!isOpen) return null;

  const typeInfo = getTransactionTypeInfo(data.type);
  const totalInput = data.inputs.reduce((sum, i) => sum + i.value, 0);
  const recipientOutputs = data.outputs.filter((o) => o.type === "recipient");
  const changeOutput = data.outputs.find((o) => o.type === "change");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div
        className={clsx(
          "bg-pixel-bg-dark border-4 border-black p-6",
          "shadow-[8px_8px_0_0_#000] max-w-lg w-full max-h-[90vh] overflow-y-auto",
          className,
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-pixel-border">
          <div
            className={clsx(
              "w-12 h-12 flex items-center justify-center",
              "border-4 border-black bg-pixel-bg-medium",
            )}
          >
            <span className={clsx("font-pixel text-2xl", typeInfo.color)}>
              {typeInfo.icon}
            </span>
          </div>
          <div>
            <h2 className={clsx("font-pixel text-sm", typeInfo.color)}>
              {typeInfo.title}
            </h2>
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              {data.network === "mainnet" ? "MAINNET" : "TESTNET4"}
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-pixel-warning/20 border-2 border-pixel-warning p-3 mb-6">
          <p className="font-pixel text-[8px] text-pixel-warning">
            REVIEW CAREFULLY - THIS ACTION CANNOT BE UNDONE
          </p>
        </div>

        {/* Main Summary */}
        <div className="space-y-4 mb-6">
          {/* Recipient(s) */}
          {recipientOutputs.map((output, idx) => (
            <div
              key={idx}
              className="bg-pixel-bg-medium border-2 border-black p-4"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="font-pixel text-[10px] text-pixel-text-muted">
                  {output.label || "SENDING TO"}
                </span>
                <span className="font-pixel text-xs text-pixel-error">
                  -{formatSatoshis(output.value)}
                </span>
              </div>
              <p className="font-pixel-mono text-xs text-pixel-text break-all">
                {output.address}
              </p>
            </div>
          ))}

          {/* Mining Reward (if applicable) */}
          {data.type === "mine" && data.miningReward && (
            <div className="bg-pixel-success/20 border-2 border-pixel-success p-4">
              <div className="flex justify-between items-center">
                <span className="font-pixel text-[10px] text-pixel-success">
                  MINING REWARD
                </span>
                <span className="font-pixel text-sm text-pixel-success">
                  +{data.miningReward.toString()} $BABY
                </span>
              </div>
              {data.difficulty && (
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-1">
                  Difficulty: {data.difficulty}
                </p>
              )}
            </div>
          )}

          {/* Fee Summary */}
          <div className="bg-pixel-bg-light border-2 border-black p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="font-pixel text-[10px] text-pixel-text-muted">
                NETWORK FEE
              </span>
              <span className="font-pixel text-xs text-pixel-text">
                {formatSatoshis(data.fee)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-pixel text-[8px] text-pixel-text-muted">
                Fee Rate
              </span>
              <span className="font-pixel-mono text-[10px] text-pixel-text-muted">
                {data.feeRate} sat/vB
              </span>
            </div>
          </div>

          {/* Change (if any) */}
          {changeOutput && changeOutput.value > 0 && (
            <div className="flex justify-between items-center px-2">
              <span className="font-pixel text-[10px] text-pixel-text-muted">
                Change back to you
              </span>
              <span className="font-pixel text-xs text-pixel-success">
                +{formatSatoshis(changeOutput.value)}
              </span>
            </div>
          )}
        </div>

        {/* Total Summary */}
        <div className="border-t-2 border-pixel-border pt-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="font-pixel text-xs text-pixel-text">
              TOTAL SPENT
            </span>
            <span className="font-pixel text-lg text-pixel-primary">
              {formatSatoshis(totalInput - (changeOutput?.value || 0))}
            </span>
          </div>
        </div>

        {/* Advanced Details (collapsible) */}
        <div className="mb-6">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary"
          >
            {showAdvanced ? "▼ HIDE" : "▶ SHOW"} ADVANCED DETAILS
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-3 bg-pixel-bg-medium p-4 border-2 border-black">
              {/* Inputs */}
              <div>
                <h4 className="font-pixel text-[8px] text-pixel-text-muted mb-2">
                  INPUTS ({data.inputs.length})
                </h4>
                {data.inputs.map((input, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-[10px] mb-1"
                  >
                    <span className="font-pixel-mono text-pixel-text-muted">
                      {truncateTxid(input.txid)}:{input.vout}
                    </span>
                    <span className="font-pixel-mono text-pixel-text">
                      {formatSatoshis(input.value)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Outputs */}
              <div>
                <h4 className="font-pixel text-[8px] text-pixel-text-muted mb-2">
                  OUTPUTS ({data.outputs.length})
                </h4>
                {data.outputs.map((output, idx) => (
                  <div key={idx} className="mb-2">
                    <div className="flex justify-between text-[10px]">
                      <span
                        className={clsx(
                          "font-pixel",
                          output.type === "recipient"
                            ? "text-pixel-error"
                            : output.type === "change"
                              ? "text-pixel-success"
                              : "text-pixel-secondary",
                        )}
                      >
                        [{output.type.toUpperCase()}]
                      </span>
                      <span className="font-pixel-mono text-pixel-text">
                        {formatSatoshis(output.value)}
                      </span>
                    </div>
                    <p className="font-pixel-mono text-[8px] text-pixel-text-muted break-all">
                      {output.address}
                    </p>
                  </div>
                ))}
              </div>

              {/* Charm Spell (if applicable) */}
              {data.charmSpell && (
                <div>
                  <h4 className="font-pixel text-[8px] text-pixel-text-muted mb-2">
                    CHARM SPELL
                  </h4>
                  <div className="bg-pixel-bg-dark p-2 border border-pixel-border">
                    <p className="font-pixel-mono text-[8px] text-pixel-secondary">
                      App: {truncateTxid(data.charmSpell.appId)}
                    </p>
                    <p className="font-pixel-mono text-[8px] text-pixel-text">
                      Action: {data.charmSpell.action}
                    </p>
                  </div>
                </div>
              )}

              {/* TX Size */}
              <div className="flex justify-between text-[10px]">
                <span className="font-pixel text-pixel-text-muted">
                  Virtual Size
                </span>
                <span className="font-pixel-mono text-pixel-text">
                  {data.virtualSize} vB
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className={clsx(
              "flex-1 py-3 font-pixel text-xs",
              "bg-pixel-bg-light text-pixel-text border-4 border-black",
              "shadow-[4px_4px_0_0_#000]",
              "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all",
            )}
          >
            CANCEL
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={clsx(
              "flex-1 py-3 font-pixel text-xs",
              "bg-pixel-primary text-black border-4 border-black",
              "shadow-[4px_4px_0_0_#000]",
              "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000]",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-all",
            )}
          >
            {isLoading ? "SIGNING..." : "CONFIRM & SIGN"}
          </button>
        </div>

        {/* Security Note */}
        <p className="font-pixel text-[8px] text-pixel-text-muted text-center mt-4">
          By clicking Confirm, you authorize this transaction to be signed and
          broadcast.
        </p>
      </div>
    </div>
  );
}

export default TransactionPreview;
