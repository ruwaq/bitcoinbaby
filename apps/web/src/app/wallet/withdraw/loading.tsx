/**
 * Withdraw Loading State
 *
 * Shows skeleton while withdrawal data loads.
 */

import {
  SkeletonBalance,
  SkeletonStats,
  SkeletonCard,
  Skeleton,
} from "@bitcoinbaby/ui";

export default function WithdrawLoading() {
  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Balance Overview Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <SkeletonBalance />
          <SkeletonStats count={4} className="mt-4" />
        </div>

        {/* Destination Address Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>

        {/* Pool Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  );
}
