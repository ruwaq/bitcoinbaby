/**
 * Transaction History Loading State
 */

import { SkeletonTransactions, Skeleton } from "@bitcoinbaby/ui";

export default function HistoryLoading() {
  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-2">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-8 w-24" />
        </div>

        {/* Filter Tabs Skeleton */}
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
        </div>

        {/* Transaction List Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <SkeletonTransactions count={6} />
        </div>
      </div>
    </div>
  );
}
