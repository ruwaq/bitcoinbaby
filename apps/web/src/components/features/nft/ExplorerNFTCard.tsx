"use client";

/**
 * ExplorerNFTCard - NFT card for the Explorer view
 *
 * Shows NFT info with:
 * - Owner address
 * - Listing status and price
 * - Link to blockchain explorer
 * - Rarity and traits
 */

import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import type { NFTRecordWithListing } from "@bitcoinbaby/core";

interface ExplorerNFTCardProps {
  nft: NFTRecordWithListing;
  onBuy?: (tokenId: number) => void;
  currentUserAddress?: string;
  isProcessing?: boolean;
}

// Rarity colors
const RARITY_COLORS: Record<string, string> = {
  common: "text-gray-400 border-gray-400/30",
  uncommon: "text-green-400 border-green-400/30",
  rare: "text-blue-400 border-blue-400/30",
  epic: "text-purple-400 border-purple-400/30",
  legendary: "text-yellow-400 border-yellow-400/30",
  mythic: "text-red-400 border-red-400/30",
};

// Bloodline emojis
const BLOODLINE_EMOJI: Record<string, string> = {
  royal: "👑",
  warrior: "⚔️",
  mystic: "🔮",
  rogue: "🗡️",
};

export function ExplorerNFTCard({
  nft,
  onBuy,
  currentUserAddress,
  isProcessing = false,
}: ExplorerNFTCardProps) {
  const isOwner = nft.address === currentUserAddress;
  const rarityColor = RARITY_COLORS[nft.rarityTier] || RARITY_COLORS.common;
  const bloodlineEmoji = BLOODLINE_EMOJI[nft.bloodline] || "👶";

  // Truncate address for display
  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 ${pixelShadows.md} hover:border-pixel-primary/50 transition-colors`}
    >
      {/* Header: Token ID + Rarity */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-[10px] text-pixel-text">
          #{nft.tokenId.toString().padStart(4, "0")}
        </span>
        <span
          className={`font-pixel text-[7px] uppercase px-2 py-1 bg-pixel-bg-dark border ${rarityColor}`}
        >
          {nft.rarityTier}
        </span>
      </div>

      {/* Bloodline + Type */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">{bloodlineEmoji}</span>
        <div>
          <p className="font-pixel text-[8px] text-pixel-secondary capitalize">
            {nft.bloodline}
          </p>
          <p className="font-pixel text-[7px] text-pixel-text-muted capitalize">
            {nft.baseType}
          </p>
        </div>
      </div>

      {/* Stats: Level + XP */}
      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
        <div className="bg-pixel-bg-dark p-2 border border-pixel-border">
          <p className="font-pixel text-[6px] text-pixel-text-muted">LEVEL</p>
          <p className="font-pixel text-sm text-pixel-primary">{nft.level}</p>
        </div>
        <div className="bg-pixel-bg-dark p-2 border border-pixel-border">
          <p className="font-pixel text-[6px] text-pixel-text-muted">XP</p>
          <p className="font-pixel text-sm text-pixel-secondary">
            {nft.totalXp}
          </p>
        </div>
      </div>

      {/* Owner */}
      <div className="mb-3 p-2 bg-pixel-bg-dark border border-pixel-border">
        <p className="font-pixel text-[6px] text-pixel-text-muted uppercase mb-1">
          Owner
        </p>
        <p className="font-pixel text-[8px] text-pixel-text truncate">
          {isOwner ? (
            <span className="text-pixel-success">You</span>
          ) : (
            truncateAddress(nft.address)
          )}
        </p>
      </div>

      {/* Listing Status */}
      {nft.isListed && nft.listingPrice && (
        <div className="mb-3 p-2 bg-pixel-warning/10 border-2 border-pixel-warning/30 text-center">
          <p className="font-pixel text-[6px] text-pixel-warning uppercase">
            For Sale
          </p>
          <p className="font-pixel text-xs text-pixel-warning">
            {(nft.listingPrice / 100_000_000).toFixed(8)} BTC
          </p>
          <p className="font-pixel text-[6px] text-pixel-text-muted">
            ({nft.listingPrice.toLocaleString()} sats)
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {/* Blockchain Link */}
        <a
          href={nft.blockchainUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1"
        >
          <Button variant="secondary" size="sm" className="w-full">
            <span className="text-[8px]">View TX</span>
          </Button>
        </a>

        {/* Buy Button (if listed and not owner) */}
        {nft.isListed && !isOwner && onBuy && (
          <Button
            onClick={() => onBuy(nft.tokenId)}
            disabled={isProcessing || !currentUserAddress}
            variant="success"
            size="sm"
            className="flex-1"
          >
            <span className="text-[8px]">{isProcessing ? "..." : "Buy"}</span>
          </Button>
        )}
      </div>
    </div>
  );
}

export default ExplorerNFTCard;
