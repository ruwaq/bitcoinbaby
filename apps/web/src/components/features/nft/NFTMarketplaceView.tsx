"use client";

/**
 * NFTMarketplaceView - Marketplace tab content
 *
 * Shows:
 * - Marketplace header (animated)
 * - Listings grid with Motion stagger
 * - Buy functionality
 * - Motion-powered empty/loading/error states
 */

import { motion, AnimatePresence } from "motion/react";
import {
  InfoBanner,
  Button,
  pixelShadows,
  pixelBorders,
} from "@bitcoinbaby/ui";
import type { NFTListingWithNFT } from "@bitcoinbaby/core";
import { MarketplaceListing } from "./MarketplaceListing";
import { MarketplaceCardSkeleton } from "@/components/shared/ShimmerSkeleton";
import { fadeInUp, staggerContainer } from "@/utils/animations";

interface NFTMarketplaceViewProps {
  listings: NFTListingWithNFT[];
  isLoading: boolean;
  currentUserAddress?: string;
  isProcessing: boolean;
  error: string | null;
  onBuy: (tokenId: number) => Promise<{ success: boolean; error?: string }>;
  onGoToCollection: () => void;
  onRetry?: () => void;
  onDismissError?: () => void;
}

export function NFTMarketplaceView({
  listings,
  isLoading,
  currentUserAddress,
  isProcessing,
  error,
  onBuy,
  onGoToCollection,
  onRetry,
  onDismissError,
}: NFTMarketplaceViewProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Marketplace Header */}
      <motion.div
        className={`bg-pixel-bg-medium ${pixelBorders.warning} p-4 mb-6 ${pixelShadows.md}`}
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <h3 className="font-pixel text-[10px] text-pixel-warning uppercase mb-2">
          NFT Marketplace
        </h3>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Buy and sell Genesis Babies with other players. All transactions are
          recorded on-chain.
        </p>
      </motion.div>

      {/* Error Display */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="mb-4"
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <InfoBanner
              variant="error"
              action={
                <div className="flex gap-2">
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
                      Dismiss
                    </button>
                  )}
                </div>
              }
              onDismiss={onDismissError ? () => onDismissError() : undefined}
            >
              <span className="font-pixel text-[8px] uppercase">{error}</span>
            </InfoBanner>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading State */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div key={i} variants={fadeInUp}>
                <MarketplaceCardSkeleton />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty State */}
        {!isLoading && !error && listings.length === 0 && (
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
                🏪
              </motion.span>
              <motion.span
                className="absolute -top-2 -right-3 text-lg"
                animate={{ opacity: [0.3, 1, 0.3], y: [-2, 2, -2] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                ✦
              </motion.span>
              <motion.span
                className="absolute -top-1 left-0 text-xs"
                animate={{ opacity: [0.2, 1, 0.2], y: [2, -2, 2] }}
                transition={{ duration: 1.2, delay: 0.6, repeat: Infinity }}
              >
                ✧
              </motion.span>
            </div>
            <h3 className="font-pixel text-sm text-pixel-text mb-2">
              No Listings Yet
            </h3>
            <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
              Be the first to list your Genesis Baby for sale!
            </p>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button onClick={onGoToCollection} variant="warning">
                Go to Collection
              </Button>
            </motion.div>
          </motion.div>
        )}

        {/* Listings Grid */}
        {!isLoading && !error && listings.length > 0 && (
          <motion.div
            key="listings"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {listings.map((listing) => (
              <motion.div key={listing.tokenId} variants={fadeInUp}>
                <MarketplaceListing
                  listing={listing}
                  onBuy={onBuy}
                  currentUserAddress={currentUserAddress}
                  isProcessing={isProcessing}
                />
              </motion.div>
            ))}
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
          Note: To list your NFT for sale, go to your Collection and select an
          NFT. Listing feature coming soon!
        </p>
      </motion.div>
    </div>
  );
}

export default NFTMarketplaceView;
