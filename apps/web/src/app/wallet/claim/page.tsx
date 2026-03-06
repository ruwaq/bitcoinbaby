"use client";

/**
 * Claim Page
 *
 * User-paid settlement system for converting mining work to on-chain tokens.
 * Users pay their own Bitcoin fees to claim their earned $BABTC tokens.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { pixelBorders } from "@bitcoinbaby/ui";

// Dynamic import to avoid SSR issues
const ClaimSection = dynamic(
  () =>
    import("@/components/claim/ClaimSection").then((mod) => mod.ClaimSection),
  {
    ssr: false,
    loading: () => (
      <div className="animate-pulse p-8">
        <div className="h-32 bg-pixel-bg-medium rounded mb-4" />
        <div className="h-48 bg-pixel-bg-medium rounded" />
      </div>
    ),
  },
);

export default function ClaimPage() {
  return (
    <div className="min-h-screen bg-pixel-bg-dark p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-pixel text-xl text-pixel-primary">
              CLAIM TOKENS
            </h1>
            <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
              Convert mining work to $BABTC
            </p>
          </div>
          <Link
            href="/?tab=wallet"
            className="font-pixel text-[10px] text-pixel-secondary hover:text-pixel-primary transition-colors"
          >
            ← BACK
          </Link>
        </div>

        {/* Claim Section */}
        <ClaimSection />

        {/* Help Text */}
        <div className={`mt-8 p-4 bg-pixel-bg-medium ${pixelBorders.medium}`}>
          <h3 className="font-pixel text-[10px] text-pixel-primary mb-2">
            HOW CLAIMING WORKS
          </h3>
          <ul className="space-y-2 text-sm text-pixel-text-muted">
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">1.</span>
              <span>Mine to earn virtual work points (free, unlimited)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">2.</span>
              <span>
                When ready, prepare your claim (server signs your work)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">3.</span>
              <span>
                Create and broadcast a Bitcoin transaction (~1000 sats)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">4.</span>
              <span>
                After confirmation, your $BABTC tokens are minted on Bitcoin
              </span>
            </li>
          </ul>

          <div className="mt-4 p-3 bg-pixel-bg-dark/50 rounded">
            <p className="text-xs text-pixel-secondary font-pixel mb-1">
              WHY PAY FEES?
            </p>
            <p className="text-xs text-gray-400">
              Unlike games where the team pays transaction fees, BitcoinBaby
              lets you claim when YOU want at YOUR preferred fee rate. This
              makes the game sustainable and gives you full control over your
              tokens.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
