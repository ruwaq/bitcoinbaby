"use client";

/**
 * NFTExplorerView - Browse all minted NFTs
 *
 * Features:
 * - View all minted NFTs (not just yours) with Motion stagger
 * - See owner address for each NFT
 * - See if NFT is for sale and price
 * - Link to blockchain explorer
 * - Filter by rarity, bloodline
 * - Sort by newest, rarest, level, xp
 * - Pagination
 */

import { motion, AnimatePresence } from "motion/react";
import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { NFTRecordWithListing, NFTExplorerQuery } from "@bitcoinbaby/core";
import { ExplorerNFTCard } from "./ExplorerNFTCard";
import { ExplorerFilters } from "./ExplorerFilters";
import { NFTCardSkeleton } from "@/components/shared/ShimmerSkeleton";
import { fadeInUp, staggerContainer } from "@/utils/animations";

interface NFTExplorerViewProps {
  nfts: NFTRecordWithListing[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: string | null;
  filters: NFTExplorerQuery;
  stats?: {
    total: number;
    forSale: number;
    byRarity: Record<string, number>;
    byBloodline: Record<string, number>;
  };
  currentUserAddress?: string;
  isProcessing?: boolean;
  onFiltersChange: (filters: NFTExplorerQuery) => void;
  onPageChange: (page: number) => void;
  onBuy?: (tokenId: number) => Promise<{ success: boolean; error?: string }>;
  onRetry?: () => void;
  onDismissError?: () => void;
}

export function NFTExplorerView({
  nfts,
  total,
  page,
  totalPages,
  isLoading,
  error,
  filters,
  stats,
  currentUserAddress,
  isProcessing = false,
  onFiltersChange,
  onPageChange,
  onBuy,
  onRetry,
  onDismissError,
}: NFTExplorerViewProps) {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Explorer Header */}
      <motion.div
        className={`bg-pixel-bg-medium ${pixelBorders.accent} p-4 mb-6 ${pixelShadows.md}`}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.span
            className="text-2xl"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            🔍
          </motion.span>
          <h3 className="font-pixel text-[11px] text-pixel-primary uppercase">
            NFT Explorer
          </h3>
        </div>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Browse all Genesis Sparks in the collection. View ownership, rarity,
          and find NFTs for sale.
        </p>
      </motion.div>

      {/* Filters */}
      <ExplorerFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        stats={stats}
      />

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className={`bg-pixel-error/10 ${pixelBorders.error} p-4 mb-4 ${pixelShadows.md}`}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <motion.span
                  className="text-xl flex-shrink-0"
                  animate={{ rotate: [0, -8, 8, -8, 0] }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                >
                  ⚠️
                </motion.span>
                <div>
                  <p className="font-pixel text-[8px] text-pixel-error uppercase mb-1">
                    Failed to Load NFTs
                  </p>
                  <p className="font-pixel-body text-xs text-pixel-text-muted">
                    {error}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onRetry && (
                  <Button onClick={onRetry} variant="secondary" size="sm">
                    Try Again
                  </Button>
                )}
                {onDismissError && (
                  <button
                    onClick={onDismissError}
                    className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-error transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            className="space-y-4"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="text-center py-6">
              <motion.div
                className="inline-block relative"
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
              >
                <span className="text-4xl">🔍</span>
                <motion.span
                  className="absolute -top-1 -right-2 text-xs"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ✦
                </motion.span>
              </motion.div>
              <p className="font-pixel text-[9px] text-pixel-text-muted mt-2">
                Searching the blockchain...
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  variants={fadeInUp}
                  custom={i}
                >
                  <NFTCardSkeleton />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && !error && nfts.length === 0 && (
          <motion.div
            key="empty"
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 text-center ${pixelShadows.md}`}
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <div className="relative inline-block mb-6">
              <motion.span
                className="text-6xl"
                style={{ imageRendering: "pixelated" }}
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              >
                👶
              </motion.span>
              <motion.span
                className="absolute -top-2 -right-2 text-base"
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.1, 0.8] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                ❓
              </motion.span>
            </div>
            <h3 className="font-pixel text-sm text-pixel-text mb-2">
              No NFTs Found
            </h3>
            <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
              {filters.bloodline !== "all" ||
              filters.rarity !== "all" ||
              filters.forSale !== "all"
                ? "Try adjusting your filters to see more results."
                : "No Genesis Sparks have been minted yet. Be the first!"}
            </p>
            {filters.bloodline !== "all" ||
            filters.rarity !== "all" ||
            filters.forSale !== "all" ? (
              <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                <Button
                  onClick={() =>
                    onFiltersChange({
                      ...filters,
                      bloodline: "all",
                      rarity: "all",
                      forSale: "all",
                      page: 1,
                    })
                  }
                  variant="secondary"
                  size="sm"
                >
                  Clear Filters
                </Button>
              </motion.div>
            ) : null}
          </motion.div>
        )}

        {/* Results */}
        {!isLoading && !error && nfts.length > 0 && (
          <motion.div
            key="results"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
          >
            {/* Results Count */}
            <div className="flex items-center justify-between mb-4">
              <p className="font-pixel text-[8px] text-pixel-text-muted">
                Showing {(page - 1) * (filters.limit || 20) + 1}-
                {Math.min(page * (filters.limit || 20), total)} of {total} NFTs
              </p>
            </div>

            {/* NFT Grid */}
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6"
              variants={staggerContainer}
            >
              {nfts.map((nft) => (
                <motion.div key={nft.tokenId} variants={fadeInUp}>
                  <ExplorerNFTCard
                    nft={nft}
                    onBuy={onBuy}
                    currentUserAddress={currentUserAddress}
                    isProcessing={isProcessing}
                  />
                </motion.div>
              ))}
            </motion.div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  onClick={() => onPageChange(page - 1)}
                  disabled={page <= 1}
                  variant="secondary"
                  size="sm"
                >
                  <span className="text-[8px]">Prev</span>
                </Button>

                <div className="flex items-center gap-1">
                  {page > 3 && (
                    <>
                      <button
                        onClick={() => onPageChange(1)}
                        className="font-pixel text-[8px] px-2 py-1 bg-pixel-bg-dark border border-pixel-border hover:border-pixel-primary"
                      >
                        1
                      </button>
                      {page > 4 && (
                        <span className="font-pixel text-[8px] text-pixel-text-muted">
                          ...
                        </span>
                      )}
                    </>
                  )}

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum =
                      Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                    if (pageNum < 1 || pageNum > totalPages) return null;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => onPageChange(pageNum)}
                        className={`font-pixel text-[8px] px-2 py-1 border ${
                          pageNum === page
                            ? "bg-pixel-primary border-pixel-primary text-pixel-bg-dark"
                            : "bg-pixel-bg-dark border-pixel-border hover:border-pixel-primary text-pixel-text"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {page < totalPages - 2 && (
                    <>
                      {page < totalPages - 3 && (
                        <span className="font-pixel text-[8px] text-pixel-text-muted">
                          ...
                        </span>
                      )}
                      <button
                        onClick={() => onPageChange(totalPages)}
                        className="font-pixel text-[8px] px-2 py-1 bg-pixel-bg-dark border border-pixel-border hover:border-pixel-primary"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                <Button
                  onClick={() => onPageChange(page + 1)}
                  disabled={page >= totalPages}
                  variant="secondary"
                  size="sm"
                >
                  <span className="text-[8px]">Next</span>
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Footer */}
      <motion.div
        className="mt-6 p-4 bg-pixel-bg-dark border-2 border-pixel-border"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          All NFT data is indexed from the Bitcoin testnet4 blockchain.
          Ownership and listings are verified on-chain.
        </p>
      </motion.div>
    </div>
  );
}

export default NFTExplorerView;
