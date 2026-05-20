"use client";

/**
 * NFTCollectionView - Collection tab content
 *
 * Shows:
 * - NFT grid with owned NFTs (Motion-animated)
 * - Stats sidebar
 * - Selected NFT evolution panel
 * - Pending transactions
 * - Mint CTA
 */

import { AnimatePresence, motion } from "motion/react";
import {
  NFTGrid,
  NFTStats,
  NFTEvolutionPanel,
  PendingTransactions,
  Button,
  getEvolutionStatus,
  pixelBorders,
  pixelShadows,
  type BabyNFTState,
} from "@bitcoinbaby/ui";
import type { PendingTransaction } from "@bitcoinbaby/core";
import { NFTCardSkeleton } from "@/components/shared/ShimmerSkeleton";
import { fadeInUp, staggerContainer } from "@/utils/animations";

interface NFTCollectionViewProps {
  nfts: BabyNFTState[];
  isLoading: boolean;
  error: string | null;
  selectedNFT: BabyNFTState | null;
  onSelectNFT: (nft: BabyNFTState) => void;
  onClearSelection: () => void;
  evolvingIds: Set<number>;
  listingIds: Set<number>;
  tokenBalance: bigint;
  onEvolve: (nft: BabyNFTState) => Promise<void>;
  onList: (nft: BabyNFTState, price: number) => Promise<void>;
  onMintClick: () => void;
  onRetry: () => void;
  formattedPrice: string;
  pendingTransactions: PendingTransaction[];
  onRefreshTransactions: () => void;
  onClearCompletedTransactions: () => void;
}

export function NFTCollectionView({
  nfts,
  isLoading,
  error,
  selectedNFT,
  onSelectNFT,
  onClearSelection,
  evolvingIds,
  listingIds,
  tokenBalance,
  onEvolve,
  onList,
  onMintClick,
  onRetry,
  formattedPrice,
  pendingTransactions,
  onRefreshTransactions,
  onClearCompletedTransactions,
}: NFTCollectionViewProps) {
  const nftTransactions = pendingTransactions.filter(
    (tx) => tx.type === "nft_mint" || tx.type === "nft_purchase",
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Stats Panel (Sidebar) */}
      <div className="lg:col-span-1 order-2 lg:order-1">
        <AnimatePresence mode="wait">
          {selectedNFT && (
            <motion.div
              className="mb-6"
              key="evolution-panel"
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-pixel text-[9px] text-pixel-primary uppercase">
                  Selected: #{selectedNFT.tokenId}
                </h3>
                <button
                  onClick={onClearSelection}
                  className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-error transition-colors"
                >
                  x Close
                </button>
              </div>
              <NFTEvolutionPanel
                nft={selectedNFT}
                evolutionStatus={getEvolutionStatus(selectedNFT)}
                tokenBalance={tokenBalance}
                onEvolve={onEvolve}
                isEvolving={evolvingIds.has(selectedNFT.tokenId)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <NFTStats
          nfts={nfts}
          isLoading={isLoading}
          showRarityBreakdown={true}
          className={selectedNFT ? "" : "sticky top-4"}
        />

        {nftTransactions.length > 0 && (
          <PendingTransactions
            transactions={nftTransactions}
            onRefresh={onRefreshTransactions}
            onClearCompleted={onClearCompletedTransactions}
            className="mt-6"
          />
        )}

        <motion.div
          className={`mt-6 bg-pixel-bg-medium ${pixelBorders.medium} p-4`}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
        >
          <h3 className="font-pixel text-[8px] text-pixel-secondary uppercase mb-3">
            Expand Collection
          </h3>
          <Button
            onClick={onMintClick}
            variant="success"
            size="sm"
            className="w-full"
          >
            Mint New Baby
          </Button>
          <p className="mt-2 font-pixel text-[7px] text-pixel-text-muted text-center">
            {formattedPrice}
          </p>
        </motion.div>
      </div>

      {/* NFT Grid (Main Content) */}
      <div className="lg:col-span-3 order-1 lg:order-2">
        <AnimatePresence mode="wait">
          {/* Error State */}
          {error && !isLoading && (
            <motion.div
              key="error"
              className={`bg-pixel-error/10 ${pixelBorders.error} p-8 text-center mb-4 ${pixelShadows.md}`}
              variants={fadeInUp}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <motion.div
                className="text-5xl mb-3"
                animate={{ rotate: [0, -5, 5, -5, 0] }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                ⚠️
              </motion.div>
              <h3 className="font-pixel text-[10px] text-pixel-error uppercase mb-2">
                Failed to Load Collection
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                {error}
              </p>
              <Button onClick={onRetry} variant="secondary" size="sm">
                Try Again
              </Button>
            </motion.div>
          )}

          {/* Loading State */}
          {isLoading && (
            <motion.div
              key="loading"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <motion.div key={i} variants={fadeInUp}>
                  <NFTCardSkeleton />
                </motion.div>
              ))}
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
                <motion.div
                  className="text-6xl"
                  style={{ imageRendering: "pixelated" }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  👶
                </motion.div>
                {(["✦", "✦", "✦", "✧"] as const).map((char, i) => (
                  <motion.span
                    key={i}
                    className="absolute text-sm"
                    style={{
                      top: `${-2 + (i % 2) * 5}px`,
                      left: `${-3 + (i * 8)}px`,
                    }}
                    animate={{
                      y: [-2, 2, -2],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 1,
                      delay: i * 0.25,
                      repeat: Infinity,
                    }}
                  >
                    {char}
                  </motion.span>
                ))}
              </div>
              <h3 className="font-pixel text-sm text-pixel-text mb-2">
                No NFTs Yet
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                Mint your first Genesis Baby to start earning mining boosts!
              </p>
              <Button onClick={onMintClick} variant="success">
                Mint Your First Baby
              </Button>
            </motion.div>
          )}

          {/* Content — NFT Grid */}
          {!isLoading && !error && nfts.length > 0 && (
            <motion.div
              key="content"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <NFTGrid
                nfts={nfts}
                columns={3}
                onEvolve={onEvolve}
                onSelect={onSelectNFT}
                onList={onList}
                selectedTokenId={selectedNFT?.tokenId}
                evolvingIds={evolvingIds}
                listingIds={listingIds}
                isLoading={false}
                skeletonCount={6}
                showControls={true}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default NFTCollectionView;
