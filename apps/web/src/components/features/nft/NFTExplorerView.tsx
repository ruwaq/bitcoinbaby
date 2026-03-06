"use client";

/**
 * NFTExplorerView - Browse all minted NFTs
 *
 * Features:
 * - View all minted NFTs (not just yours)
 * - See owner address for each NFT
 * - See if NFT is for sale and price
 * - Link to blockchain explorer
 * - Filter by rarity, bloodline
 * - Sort by newest, rarest, level, xp
 * - Pagination
 */

import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { NFTRecordWithListing, NFTExplorerQuery } from "@bitcoinbaby/core";
import { ExplorerNFTCard } from "./ExplorerNFTCard";
import { ExplorerFilters } from "./ExplorerFilters";

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
}: NFTExplorerViewProps) {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Explorer Header */}
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.accent} p-4 mb-6 ${pixelShadows.md}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🔍</span>
          <h3 className="font-pixel text-[11px] text-pixel-primary uppercase">
            NFT Explorer
          </h3>
        </div>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Browse all Genesis Babies in the collection. View ownership, rarity,
          and find NFTs for sale.
        </p>
      </div>

      {/* Filters */}
      <ExplorerFilters
        filters={filters}
        onFiltersChange={onFiltersChange}
        stats={stats}
      />

      {/* Error Display */}
      {error && (
        <div className={`bg-pixel-error/10 ${pixelBorders.error} p-4 mb-4`}>
          <span className="font-pixel text-[8px] text-pixel-error uppercase">
            {error}
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-4xl animate-bounce mb-4">🔍</div>
          <p className="font-pixel text-[9px] text-pixel-text-muted animate-pulse">
            Searching the blockchain...
          </p>
        </div>
      ) : nfts.length === 0 ? (
        /* Empty State */
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 text-center`}
        >
          <div className="text-6xl mb-4">👶</div>
          <h3 className="font-pixel text-sm text-pixel-text mb-2">
            No NFTs Found
          </h3>
          <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
            {filters.bloodline !== "all" ||
            filters.rarity !== "all" ||
            filters.forSale !== "all"
              ? "Try adjusting your filters to see more results."
              : "No Genesis Babies have been minted yet. Be the first!"}
          </p>
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div className="flex items-center justify-between mb-4">
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              Showing {(page - 1) * (filters.limit || 20) + 1}-
              {Math.min(page * (filters.limit || 20), total)} of {total} NFTs
            </p>
          </div>

          {/* NFT Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            {nfts.map((nft) => (
              <ExplorerNFTCard
                key={nft.tokenId}
                nft={nft}
                onBuy={onBuy}
                currentUserAddress={currentUserAddress}
                isProcessing={isProcessing}
              />
            ))}
          </div>

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
                {/* First page */}
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

                {/* Page numbers around current */}
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

                {/* Last page */}
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
        </>
      )}

      {/* Info Footer */}
      <div className="mt-6 p-4 bg-pixel-bg-dark border-2 border-pixel-border">
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          All NFT data is indexed from the Bitcoin testnet4 blockchain.
          Ownership and listings are verified on-chain.
        </p>
      </div>
    </div>
  );
}

export default NFTExplorerView;
