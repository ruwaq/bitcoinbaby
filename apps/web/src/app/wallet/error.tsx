"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

export default function WalletError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Wallet error:", error);
  }, [error]);

  // Determine if this is likely a wallet-related error
  const isWalletCorrupted =
    error.message?.toLowerCase().includes("wallet") ||
    error.message?.toLowerCase().includes("storage") ||
    error.message?.toLowerCase().includes("mnemonic") ||
    error.message?.toLowerCase().includes("address");

  const handleClearWallet = () => {
    setIsClearing(true);
    try {
      localStorage.removeItem("wallet_address");
      localStorage.removeItem("wallet_mnemonic");
      // Clear any other wallet-related data
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith("wallet_") || key.startsWith("btc_")) {
          localStorage.removeItem(key);
        }
      });
      // Reload the page to start fresh
      window.location.reload();
    } catch (e) {
      console.error("Failed to clear wallet data:", e);
      setIsClearing(false);
    }
  };

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark flex items-center justify-center">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-pixel text-xl text-pixel-error">WALLET ERROR</h1>
          <Link
            href="/"
            className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
          >
            &larr; BACK
          </Link>
        </div>

        {/* Error Card */}
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.error} p-6 ${pixelShadows.lg}`}
        >
          {/* Warning Icon - Pixel Art Style */}
          <div className="flex justify-center mb-6">
            <svg
              width="80"
              height="80"
              viewBox="0 0 16 16"
              style={{ imageRendering: "pixelated" }}
            >
              {/* Triangle warning */}
              <rect x="7" y="1" width="2" height="1" fill="#f7931a" />
              <rect x="6" y="2" width="4" height="1" fill="#f7931a" />
              <rect x="5" y="3" width="6" height="1" fill="#f7931a" />
              <rect x="4" y="4" width="8" height="1" fill="#f7931a" />
              <rect x="3" y="5" width="10" height="1" fill="#f7931a" />
              <rect x="2" y="6" width="12" height="1" fill="#f7931a" />
              <rect x="1" y="7" width="14" height="1" fill="#f7931a" />
              <rect x="1" y="8" width="14" height="2" fill="#f7931a" />
              <rect x="1" y="10" width="14" height="2" fill="#f7931a" />
              <rect x="1" y="12" width="14" height="2" fill="#f7931a" />
              {/* Exclamation mark */}
              <rect x="7" y="4" width="2" height="5" fill="#1f2937" />
              <rect x="7" y="10" width="2" height="2" fill="#1f2937" />
            </svg>
          </div>

          {/* Error Badge */}
          <div className="text-center mb-4">
            <span className="inline-block px-3 py-1 font-pixel text-[10px] bg-pixel-error text-white border-2 border-black">
              WALLET MALFUNCTION
            </span>
          </div>

          {/* Error Message */}
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-4 mb-6">
            <p className="font-pixel text-xs text-pixel-text mb-2">
              Error Details:
            </p>
            <p className="font-pixel-mono text-sm text-pixel-text-muted break-words">
              {error.message || "Failed to load wallet data"}
            </p>
            {error.digest && (
              <p className="font-pixel-mono text-[10px] text-pixel-text-muted mt-2">
                ID: {error.digest}
              </p>
            )}
          </div>

          {/* Recovery Options */}
          <div className="space-y-4">
            <h3 className="font-pixel text-xs text-pixel-secondary">
              RECOVERY OPTIONS
            </h3>

            {/* Option 1: Retry */}
            <button
              onClick={reset}
              className={`w-full py-3 font-pixel text-[10px] bg-pixel-primary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`}
            >
              RETRY LOADING WALLET
            </button>

            {/* Option 2: Clear and Reset (if wallet seems corrupted) */}
            {isWalletCorrupted && (
              <button
                onClick={handleClearWallet}
                disabled={isClearing}
                className={`w-full py-3 font-pixel text-[10px] ${pixelBorders.thick} ${pixelShadows.md} transition-all ${
                  isClearing
                    ? "bg-pixel-border text-pixel-text-muted cursor-wait"
                    : `bg-pixel-error text-white hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} active:translate-x-[4px] active:translate-y-[4px] active:shadow-none`
                }`}
              >
                {isClearing ? "CLEARING..." : "CLEAR WALLET DATA & RESTART"}
              </button>
            )}

            {/* Option 3: Manual wallet recovery link */}
            <div className="pt-2 border-t-2 border-pixel-border">
              <p className="font-pixel text-[8px] text-pixel-text-muted mb-3">
                If you have your recovery phrase, you can restore your wallet:
              </p>
              <a
                href="/wallet"
                onClick={(e) => {
                  e.preventDefault();
                  handleClearWallet();
                }}
                className={`block w-full py-3 font-pixel text-[10px] text-center bg-pixel-bg-light text-pixel-text ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
              >
                GENERATE NEW WALLET
              </a>
            </div>
          </div>
        </div>

        {/* Warning Box */}
        <div className="mt-6 p-4 bg-pixel-error/10 border-4 border-dashed border-pixel-error">
          <p className="font-pixel text-[8px] text-pixel-error mb-2">
            IMPORTANT
          </p>
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            If you clear your wallet data, you will need your recovery phrase to
            restore access. Never share your recovery phrase with anyone.
          </p>
        </div>

        {/* Navigation */}
        <div className="mt-6 flex justify-center gap-4">
          <Link
            href="/"
            className="font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
          >
            HOME
          </Link>
          <span className="text-pixel-border">|</span>
          <Link
            href="/characters"
            className="font-pixel text-[10px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
          >
            CHARACTERS
          </Link>
        </div>
      </div>
    </main>
  );
}
