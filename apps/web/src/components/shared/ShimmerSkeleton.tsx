"use client";

/**
 * ShimmerSkeleton — Loading placeholder with shimmer animation
 * 
 * Uses Motion for smooth hardware-accelerated shimmer effect.
 * Replaces previous CSS animate-pulse with a more polished look.
 */

import { motion } from "motion/react";

interface ShimmerSkeletonProps {
  /** Width class (Tailwind) */
  width?: string;
  /** Height class (Tailwind) */
  height?: string;
  /** Border radius */
  rounded?: "sm" | "md" | "lg" | "full";
  /** Additional classes */
  className?: string;
}

const ROUNDED_MAP = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

export function ShimmerSkeleton({
  width = "w-full",
  height = "h-4",
  rounded = "md",
  className = "",
}: ShimmerSkeletonProps) {
  return (
    <div
      className={`${width} ${height} ${ROUNDED_MAP[rounded]} overflow-hidden bg-pixel-bg-light/20 ${className}`}
    >
      <motion.div
        className="h-full w-full"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)",
        }}
        animate={{
          x: ["-100%", "100%"],
        }}
        transition={{
          duration: 1.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

// =============================================================================
// Composite Skeletons
// =============================================================================

/** NFT Card skeleton matching the NFT card layout */
export function NFTCardSkeleton() {
  return (
    <div className="bg-pixel-bg-medium border-4 border-pixel-border/50 p-3 space-y-2">
      <ShimmerSkeleton height="aspect-square w-full" rounded="md" />
      <ShimmerSkeleton width="w-2/3" height="h-4" rounded="md" />
      <div className="flex justify-between">
        <ShimmerSkeleton width="w-12" height="h-3" rounded="sm" />
        <ShimmerSkeleton width="w-16" height="h-3" rounded="sm" />
      </div>
    </div>
  );
}

/** Marketplace listing skeleton */
export function MarketplaceCardSkeleton() {
  return (
    <div className="bg-pixel-bg-medium border-4 border-pixel-border/50 p-3 space-y-3">
      <ShimmerSkeleton height="aspect-square w-full" rounded="md" />
      <ShimmerSkeleton width="w-2/3" height="h-4" rounded="md" />
      <div className="flex justify-between">
        <ShimmerSkeleton width="w-12" height="h-4" rounded="sm" />
        <ShimmerSkeleton width="w-16" height="h-4" rounded="sm" />
      </div>
      <ShimmerSkeleton width="w-full" height="h-8" rounded="md" />
    </div>
  );
}
