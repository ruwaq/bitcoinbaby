"use client";

/**
 * TestnetBanner - Prominent banner indicating testnet mode
 *
 * Shows:
 * - Clear testnet indicator
 * - Link to faucet for getting test BTC
 * - Dismissable (but reappears on reload)
 */

import { useState } from "react";
import { useNetworkStore } from "@bitcoinbaby/core";
import { clsx } from "clsx";

// Testnet4 faucet URL (constant)
const TESTNET4_FAUCET_URL = "https://mempool.space/testnet4/faucet";

interface TestnetBannerProps {
  className?: string;
}

export function TestnetBanner({ className }: TestnetBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const { config } = useNetworkStore();

  // Only show on testnet (not production)
  if (config.isProduction || isDismissed) {
    return null;
  }

  const faucetUrl = TESTNET4_FAUCET_URL;

  return (
    <div
      className={clsx(
        "bg-gradient-to-r from-amber-900/30 via-orange-900/20 to-amber-900/30",
        "border-b-2 border-amber-500/30",
        "px-4 py-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        {/* Left: Testnet indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-amber-500/20 border border-amber-500/50 rounded">
            <span className="font-pixel text-[8px] text-amber-400">T</span>
          </span>
          <p className="font-pixel text-[8px] sm:text-[10px] text-amber-200 truncate">
            <span className="text-amber-400 font-bold">TESTNET4</span>
            <span className="hidden sm:inline">
              {" "}
              - Tokens are for testing only
            </span>
          </p>
        </div>

        {/* Right: Faucet link + dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {faucetUrl && (
            <a
              href={faucetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={clsx(
                "px-2 py-1 font-pixel text-[8px] uppercase",
                "bg-amber-500/20 text-amber-300",
                "border border-amber-500/50",
                "hover:bg-amber-500/30 hover:text-amber-200",
                "transition-colors",
              )}
            >
              Get Test BTC
            </a>
          )}
          <button
            onClick={() => setIsDismissed(true)}
            className="p-1 text-amber-500/50 hover:text-amber-400 transition-colors"
            aria-label="Dismiss banner"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestnetBanner;
