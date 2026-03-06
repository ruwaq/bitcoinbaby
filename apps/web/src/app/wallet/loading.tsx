/**
 * Wallet Loading State
 *
 * Shows skeleton placeholder while wallet data loads.
 * Matches the layout of WalletSection to prevent layout shift.
 */

import {
  SkeletonBalance,
  SkeletonStats,
  SkeletonButton,
  Skeleton,
} from "@bitcoinbaby/ui";

export default function WalletLoading() {
  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="w-12 h-12" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>

        {/* Balance Card Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
          <SkeletonBalance />
          <div className="flex justify-center gap-4 mt-6">
            <SkeletonButton />
            <SkeletonButton />
            <SkeletonButton />
          </div>
        </div>

        {/* Stats Skeleton */}
        <SkeletonStats count={4} />

        {/* Address Card Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
