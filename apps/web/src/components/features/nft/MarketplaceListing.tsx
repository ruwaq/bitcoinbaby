"use client";

/**
 * MarketplaceListing - NFT marketplace listing card
 *
 * Displays a single NFT listing with traits, price, and buy button.
 */

import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { NFTListingWithNFT } from "@bitcoinbaby/core";

interface MarketplaceListingProps {
  listing: NFTListingWithNFT;
  onBuy: (tokenId: number) => void;
  currentUserAddress?: string;
  isProcessing: boolean;
}

export function MarketplaceListing({
  listing,
  onBuy,
  currentUserAddress,
  isProcessing,
}: MarketplaceListingProps) {
  const isOwnListing = listing.sellerAddress === currentUserAddress;
  const isWalletConnected = !!currentUserAddress;

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 ${pixelShadows.md}`}
    >
      {/* NFT Info */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-[9px] text-pixel-text">
          #{listing.tokenId.toString().padStart(4, "0")}
        </span>
        <span className="font-pixel text-[7px] text-pixel-text-muted uppercase px-2 py-1 bg-pixel-bg-dark border border-pixel-border">
          {listing.nft.rarityTier}
        </span>
      </div>

      {/* Traits */}
      <div className="mb-3 space-y-1">
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          Type:{" "}
          <span className="text-pixel-secondary capitalize">
            {listing.nft.baseType}
          </span>
        </p>
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          Bloodline:{" "}
          <span className="text-pixel-secondary capitalize">
            {listing.nft.bloodline}
          </span>
        </p>
        <p className="font-pixel text-[7px] text-pixel-text-muted">
          Level:{" "}
          <span className="text-pixel-secondary">{listing.nft.level}</span>
        </p>
      </div>

      {/* Price */}
      <div className="mb-3 p-2 bg-pixel-bg-dark border-2 border-pixel-warning/30 text-center">
        <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
          Price
        </p>
        <p className="font-pixel text-sm text-pixel-warning">
          {(listing.price / 100_000_000).toFixed(8)} BTC
        </p>
        <p className="font-pixel text-[6px] text-pixel-text-muted">
          ({listing.price.toLocaleString()} sats)
        </p>
      </div>

      {/* Seller */}
      <p className="font-pixel text-[6px] text-pixel-text-muted mb-3 truncate">
        Seller: {listing.sellerAddress.slice(0, 12)}...
      </p>

      {/* Buy Button */}
      <Button
        onClick={() => onBuy(listing.tokenId)}
        disabled={!isWalletConnected || isProcessing || isOwnListing}
        variant="success"
        size="sm"
        className="w-full"
      >
        {isOwnListing
          ? "Your Listing"
          : isProcessing
            ? "Processing..."
            : "Buy Now"}
      </Button>
    </div>
  );
}

export default MarketplaceListing;
