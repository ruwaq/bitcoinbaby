"use client";

/**
 * Withdraw Page
 *
 * Allows users to withdraw their virtual $BABY balance to Bitcoin.
 * Supports batched withdrawals via weekly/monthly pools for lower fees.
 */

import dynamic from "next/dynamic";
import Link from "next/link";
import { pixelBorders } from "@bitcoinbaby/ui";

// Dynamic import to avoid SSR issues
const WithdrawSection = dynamic(
  () =>
    import("@/components/withdraw/WithdrawSection").then(
      (mod) => mod.WithdrawSection,
    ),
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

export default function WithdrawPage() {
  return (
    <div className="min-h-screen bg-pixel-bg-dark p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-pixel text-xl text-pixel-primary">WITHDRAW</h1>
            <p className="font-pixel-body text-sm text-pixel-text-muted mt-1">
              Convert $BABY to Bitcoin
            </p>
          </div>
          <Link
            href="/?tab=wallet"
            className="font-pixel text-[10px] text-pixel-secondary hover:text-pixel-primary transition-colors"
          >
            ← BACK
          </Link>
        </div>

        {/* Withdraw Section */}
        <WithdrawSection />

        {/* Help Text */}
        <div className={`mt-8 p-4 bg-pixel-bg-medium ${pixelBorders.medium}`}>
          <h3 className="font-pixel text-[10px] text-pixel-primary mb-2">
            HOW IT WORKS
          </h3>
          <ul className="space-y-2 text-sm text-pixel-text-muted">
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">1.</span>
              <span>
                Your mining rewards accumulate as virtual $BABY tokens
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">2.</span>
              <span>Choose a withdrawal pool (Monthly = lowest fees)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">3.</span>
              <span>
                Your withdrawal is batched with others to minimize Bitcoin fees
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-pixel-success">4.</span>
              <span>When the pool processes, you receive $BABY on Bitcoin</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
