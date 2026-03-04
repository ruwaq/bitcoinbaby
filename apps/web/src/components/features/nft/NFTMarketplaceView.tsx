"use client";

/**
 * NFTMarketplaceView - Marketplace tab content
 *
 * Shows:
 * - Marketplace header
 * - Listings grid
 * - Buy functionality
 */

import {
  InfoBanner,
  Button,
  pixelShadows,
  pixelBorders,
} from "@bitcoinbaby/ui";
import type { NFTListingWithNFT } from "@bitcoinbaby/core";
import { MarketplaceListing } from "./MarketplaceListing";

interface NFTMarketplaceViewProps {
  listings: NFTListingWithNFT[];
  isLoading: boolean;
  currentUserAddress?: string;
  isProcessing: boolean;
  error: string | null;
  onBuy: (tokenId: number) => Promise<{ success: boolean; error?: string }>;
  onGoToCollection: () => void;
}

export function NFTMarketplaceView({
  listings,
  isLoading,
  currentUserAddress,
  isProcessing,
  error,
  onBuy,
  onGoToCollection,
}: NFTMarketplaceViewProps) {
  return (
    <div className="max-w-4xl mx-auto">
      {/* Marketplace Header */}
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.warning} p-4 mb-6 ${pixelShadows.md}`}
      >
        <h3 className="font-pixel text-[10px] text-pixel-warning uppercase mb-2">
          NFT Marketplace
        </h3>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Buy and sell Genesis Babies with other players. All transactions are
          recorded on-chain.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <InfoBanner variant="error" className="mb-4">
          <span className="font-pixel text-[8px] uppercase">{error}</span>
        </InfoBanner>
      )}

      {/* Listings */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-4xl animate-bounce mb-4">🛒</div>
          <p className="font-pixel text-[9px] text-pixel-text-muted animate-pulse">
            Loading marketplace...
          </p>
        </div>
      ) : listings.length === 0 ? (
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 text-center`}
        >
          <div className="text-6xl mb-4">🏪</div>
          <h3 className="font-pixel text-sm text-pixel-text mb-2">
            No Listings Yet
          </h3>
          <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
            Be the first to list your Genesis Baby for sale!
          </p>
          <Button onClick={onGoToCollection} variant="warning">
            Go to Collection
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((listing) => (
            <MarketplaceListing
              key={listing.tokenId}
              listing={listing}
              onBuy={onBuy}
              currentUserAddress={currentUserAddress}
              isProcessing={isProcessing}
            />
          ))}
        </div>
      )}

      {/* Info */}
      <div className="mt-6 p-4 bg-pixel-bg-dark border-2 border-pixel-border">
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          Note: To list your NFT for sale, go to your Collection and select an
          NFT. Listing feature coming soon!
        </p>
      </div>
    </div>
  );
}

export default NFTMarketplaceView;
