/**
 * Settings Loading State
 */

import { Skeleton, SkeletonCard } from "@bitcoinbaby/ui";

export default function SettingsLoading() {
  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Skeleton */}
        <div className="space-y-2 mb-6">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>

        {/* Settings Cards Skeleton */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-pixel-bg-medium border-4 border-pixel-border p-4 space-y-4"
          >
            <Skeleton className="h-5 w-24" />
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-6 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-6 w-12" />
              </div>
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-8 w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
