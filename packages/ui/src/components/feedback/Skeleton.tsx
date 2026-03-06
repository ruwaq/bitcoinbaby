/**
 * Skeleton Components
 *
 * Loading placeholders that match the pixel art aesthetic.
 * Best Practice: Skeletons should match the layout of actual content
 * to prevent layout shift when content loads.
 */

import { cn } from "../../lib/utils";

interface SkeletonProps {
  className?: string;
}

/**
 * Base skeleton with pixel art pulse animation
 */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-pixel-bg-light/50 border-2 border-pixel-border/30",
        className,
      )}
    />
  );
}

/**
 * Text skeleton - single line
 */
export function SkeletonText({
  className,
  width = "w-full",
}: SkeletonProps & { width?: string }) {
  return <Skeleton className={cn("h-4 rounded", width, className)} />;
}

/**
 * Title skeleton - larger text
 */
export function SkeletonTitle({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-6 w-48 rounded", className)} />;
}

/**
 * Avatar/Icon skeleton - square
 */
export function SkeletonAvatar({
  className,
  size = "md",
}: SkeletonProps & { size?: "sm" | "md" | "lg" }) {
  const sizes = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };
  return <Skeleton className={cn(sizes[size], className)} />;
}

/**
 * Button skeleton
 */
export function SkeletonButton({ className }: SkeletonProps) {
  return <Skeleton className={cn("h-10 w-24 rounded", className)} />;
}

/**
 * Card skeleton - full card placeholder
 */
export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-pixel-bg-medium border-4 border-pixel-border p-4 space-y-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="md" />
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-1/2" />
          <SkeletonText width="w-3/4" />
        </div>
      </div>
      <Skeleton className="h-20" />
      <div className="flex gap-2">
        <SkeletonButton />
        <SkeletonButton />
      </div>
    </div>
  );
}

/**
 * Stats grid skeleton
 */
export function SkeletonStats({
  className,
  count = 4,
}: SkeletonProps & { count?: number }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-pixel-bg-dark/50 border-2 border-pixel-border/30 p-3 text-center space-y-2"
        >
          <SkeletonText width="w-16 mx-auto" />
          <Skeleton className="h-8 w-20 mx-auto" />
        </div>
      ))}
    </div>
  );
}

/**
 * Balance display skeleton
 */
export function SkeletonBalance({ className }: SkeletonProps) {
  return (
    <div className={cn("text-center space-y-2", className)}>
      <Skeleton className="h-10 w-40 mx-auto" />
      <SkeletonText width="w-24 mx-auto" />
    </div>
  );
}

/**
 * List item skeleton
 */
export function SkeletonListItem({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 bg-pixel-bg-dark/50 border-2 border-pixel-border/30",
        className,
      )}
    >
      <SkeletonAvatar size="sm" />
      <div className="flex-1 space-y-1">
        <SkeletonText width="w-1/3" />
        <SkeletonText width="w-1/2" className="h-3" />
      </div>
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

/**
 * Leaderboard skeleton
 */
export function SkeletonLeaderboard({
  className,
  rows = 5,
}: SkeletonProps & { rows?: number }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListItem key={i} />
      ))}
    </div>
  );
}

/**
 * NFT grid skeleton
 */
export function SkeletonNFTGrid({
  className,
  count = 4,
}: SkeletonProps & { count?: number }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-pixel-bg-medium border-4 border-pixel-border p-3 space-y-2"
        >
          <Skeleton className="aspect-square w-full" />
          <SkeletonText width="w-2/3" />
          <SkeletonText width="w-1/2" className="h-3" />
        </div>
      ))}
    </div>
  );
}

/**
 * Transaction history skeleton
 */
export function SkeletonTransactions({
  className,
  count = 3,
}: SkeletonProps & { count?: number }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-3 bg-pixel-bg-dark/50 border-2 border-pixel-border/30"
        >
          <div className="flex items-center gap-3">
            <Skeleton className="w-8 h-8" />
            <div className="space-y-1">
              <SkeletonText width="w-24" />
              <SkeletonText width="w-16" className="h-3" />
            </div>
          </div>
          <div className="text-right space-y-1">
            <SkeletonText width="w-20" />
            <SkeletonText width="w-12" className="h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
