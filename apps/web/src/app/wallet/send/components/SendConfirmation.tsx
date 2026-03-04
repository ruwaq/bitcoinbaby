"use client";

/**
 * SendConfirmation Component
 *
 * Success/error feedback after broadcast with txid link.
 */

import { useState, useCallback } from "react";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

interface SendConfirmationProps {
  status: "success" | "error";
  txid?: string;
  errorMessage?: string;
  explorerUrl: string;
  amountSatoshis: number;
  recipient: string;
  onSendAnother: () => void;
  onViewWallet: () => void;
}

export function SendConfirmation({
  status,
  txid,
  errorMessage,
  explorerUrl,
  amountSatoshis,
  recipient,
  onSendAnother,
  onViewWallet,
}: SendConfirmationProps) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const handleCopyTxid = useCallback(async () => {
    if (!txid) return;

    try {
      await navigator.clipboard.writeText(txid);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy TXID:", error);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 2000);
    }
  }, [txid]);
  const formatBtc = (sats: number): string => {
    return (sats / 100_000_000).toFixed(8);
  };

  if (status === "success" && txid) {
    return (
      <div className="text-center space-y-6">
        {/* Success icon */}
        <div className="w-24 h-24 mx-auto flex items-center justify-center bg-pixel-success/20 border-4 border-pixel-success">
          <span className="font-pixel text-4xl text-pixel-success">OK</span>
        </div>

        {/* Success message */}
        <div>
          <h2 className="font-pixel text-xl text-pixel-success mb-2">
            TRANSACTION SENT!
          </h2>
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            Your Bitcoin is on its way
          </p>
        </div>

        {/* Transaction details */}
        <div
          className={`bg-pixel-bg-dark ${pixelBorders.medium} p-4 space-y-4 text-left`}
        >
          {/* Amount */}
          <div>
            <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
              AMOUNT SENT
            </label>
            <p className="font-pixel text-lg text-pixel-primary">
              {formatBtc(amountSatoshis)} BTC
            </p>
          </div>

          {/* Recipient */}
          <div>
            <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
              TO
            </label>
            <p className="font-pixel-body text-sm text-pixel-text break-all">
              {recipient}
            </p>
          </div>

          {/* Transaction ID */}
          <div>
            <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
              TRANSACTION ID
            </label>
            <p className="font-pixel-body text-xs text-pixel-secondary break-all">
              {txid}
            </p>
          </div>
        </div>

        {/* Explorer link */}
        <a
          href={`${explorerUrl}/tx/${txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block w-full py-4 font-pixel text-sm text-black bg-pixel-secondary ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all text-center`}
        >
          VIEW ON EXPLORER
        </a>

        {/* Copy TXID button */}
        <button
          type="button"
          onClick={handleCopyTxid}
          className={`w-full py-3 font-pixel text-[10px] ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all ${
            copyStatus === "copied"
              ? "bg-pixel-success text-black"
              : copyStatus === "error"
                ? "bg-pixel-error text-white"
                : "bg-pixel-bg-light text-pixel-text"
          }`}
        >
          {copyStatus === "copied"
            ? "COPIED!"
            : copyStatus === "error"
              ? "COPY FAILED"
              : "COPY TRANSACTION ID"}
        </button>

        {/* Action buttons */}
        <div className="flex gap-3 pt-4 border-t-2 border-pixel-border">
          <button
            type="button"
            onClick={onSendAnother}
            className={`flex-1 py-3 font-pixel text-[10px] text-pixel-text bg-pixel-bg-light ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
          >
            SEND ANOTHER
          </button>
          <button
            type="button"
            onClick={onViewWallet}
            className={`flex-1 py-3 font-pixel text-[10px] text-black bg-pixel-primary ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
          >
            VIEW WALLET
          </button>
        </div>

        {/* Confirmation notice */}
        <p className="font-pixel text-[6px] text-pixel-text-muted">
          Transaction will be confirmed in the next block(s)
        </p>
      </div>
    );
  }

  // Error state
  return (
    <div className="text-center space-y-6">
      {/* Error icon */}
      <div className="w-24 h-24 mx-auto flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
        <span className="font-pixel text-4xl text-pixel-error">X</span>
      </div>

      {/* Error message */}
      <div>
        <h2 className="font-pixel text-xl text-pixel-error mb-2">
          TRANSACTION FAILED
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Your Bitcoin was not sent
        </p>
      </div>

      {/* Error details */}
      <div className="bg-pixel-error/10 border-4 border-pixel-error p-4">
        <label className="font-pixel text-[8px] text-pixel-error block mb-2">
          ERROR DETAILS
        </label>
        <p className="font-pixel-body text-sm text-pixel-text break-all">
          {errorMessage || "Unknown error occurred"}
        </p>
      </div>

      {/* Troubleshooting tips */}
      <div className={`bg-pixel-bg-dark ${pixelBorders.medium} p-4 text-left`}>
        <h3 className="font-pixel text-[10px] text-pixel-secondary mb-3">
          TROUBLESHOOTING
        </h3>
        <ul className="space-y-2 font-pixel-body text-sm text-pixel-text-muted">
          <li>- Check your internet connection</li>
          <li>- Verify recipient address is correct</li>
          <li>- Ensure sufficient balance for amount + fee</li>
          <li>- Wait a moment and try again</li>
        </ul>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSendAnother}
          className={`flex-1 py-4 font-pixel text-sm text-black bg-pixel-primary ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
        >
          TRY AGAIN
        </button>
        <button
          type="button"
          onClick={onViewWallet}
          className={`flex-1 py-4 font-pixel text-sm text-pixel-text bg-pixel-bg-light ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
        >
          BACK TO WALLET
        </button>
      </div>
    </div>
  );
}
