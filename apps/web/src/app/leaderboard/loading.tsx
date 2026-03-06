/**
 * Leaderboard Loading State
 */

import { SkeletonLeaderboard, Skeleton, SkeletonStats } from "@bitcoinbaby/ui";

export default function LeaderboardLoading() {
  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="text-center space-y-2 mb-6">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
        </div>

        {/* Period Tabs Skeleton */}
        <div className="flex justify-center gap-2 mb-6">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Top 3 Podium Skeleton */}
        <div className="flex justify-center items-end gap-4 mb-8">
          <div className="text-center space-y-2">
            <Skeleton className="w-16 h-16 mx-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>
          <div className="text-center space-y-2">
            <Skeleton className="w-20 h-20 mx-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>
          <div className="text-center space-y-2">
            <Skeleton className="w-14 h-14 mx-auto" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-6 w-24 mx-auto" />
          </div>
        </div>

        {/* Your Stats Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <SkeletonStats count={3} />
        </div>

        {/* Leaderboard List Skeleton */}
        <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <SkeletonLeaderboard rows={10} />
        </div>
      </div>
    </div>
  );
}
