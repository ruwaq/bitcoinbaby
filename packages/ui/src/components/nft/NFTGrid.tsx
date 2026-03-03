"use client";

/**
 * NFTGrid - Grid Layout for Genesis Baby NFTs
 */

import { type FC, useState, useMemo } from "react";
import { clsx } from "clsx";
import { NFTCard, type NFTCardProps } from "./NFTCard";
import type { BabyNFTState, RarityTier } from "./types";
import { getMiningBoost } from "./types";

export type NFTSortKey = "tokenId" | "level" | "boost" | "xp" | "workCount";
export type NFTSortOrder = "asc" | "desc";

export interface NFTGridFilters {
  rarity?: RarityTier | "all";
}

export interface NFTGridProps {
  nfts: BabyNFTState[];
  columns?: 1 | 2 | 3 | 4;
  onEvolve?: NFTCardProps["onEvolve"];
  onSelect?: (nft: BabyNFTState) => void;
  selectedTokenId?: number | null;
  evolvingIds?: Set<number>;
  isLoading?: boolean;
  skeletonCount?: number;
  showControls?: boolean;
  className?: string;
}

const NFTCardSkeleton: FC = () => (
  <div
    className={clsx(
      "flex flex-col bg-pixel-bg-medium",
      "border-4 border-pixel-border",
      "shadow-[8px_8px_0_0_#000]",
      "animate-pulse",
    )}
  >
    <div className="h-8 bg-pixel-bg-light border-b-2 border-pixel-border" />
    <div className="flex justify-center py-6 px-4">
      <div className="w-24 h-24 bg-pixel-bg-light border-4 border-pixel-border" />
    </div>
    <div className="px-3 pb-3 space-y-2">
      <div className="h-3 bg-pixel-bg-light w-3/4 mx-auto" />
      <div className="h-2 bg-pixel-bg-light w-1/2 mx-auto" />
    </div>
    <div className="px-3 pb-3 space-y-2 border-t-2 border-pixel-border pt-3">
      <div className="h-2 bg-pixel-bg-light w-full" />
      <div className="h-6 bg-pixel-bg-light w-full" />
      <div className="h-8 bg-pixel-bg-light w-full" />
    </div>
  </div>
);

const EmptyState: FC = () => (
  <div
    className={clsx(
      "col-span-full flex flex-col items-center justify-center",
      "py-16 px-4 text-center",
      "border-4 border-dashed border-pixel-border",
    )}
  >
    <svg
      width={64}
      height={64}
      viewBox="0 0 8 8"
      className="mb-4"
      style={{ imageRendering: "pixelated" }}
    >
      <rect width="8" height="8" fill="#1a1a2e" />
      <rect x="2" y="2" width="4" height="4" fill="#374151" />
      <rect x="3" y="3" width="2" height="2" fill="#6b7280" />
      <rect x="3" y="0" width="2" height="2" fill="#374151" />
    </svg>
    <p className="font-pixel text-[10px] text-pixel-text-muted uppercase">
      No NFTs Found
    </p>
    <p className="font-pixel-body text-sm text-pixel-text-muted mt-2">
      Mint your first Genesis Baby to start earning mining boosts.
    </p>
  </div>
);

const RARITY_OPTIONS: Array<{ value: RarityTier | "all"; label: string }> = [
  { value: "all", label: "All Rarities" },
  { value: "common", label: "Common" },
  { value: "uncommon", label: "Uncommon" },
  { value: "rare", label: "Rare" },
  { value: "epic", label: "Epic" },
  { value: "legendary", label: "Legendary" },
  { value: "mythic", label: "Mythic" },
];

const SORT_OPTIONS: Array<{ value: NFTSortKey; label: string }> = [
  { value: "tokenId", label: "Token ID" },
  { value: "level", label: "Level" },
  { value: "boost", label: "Mining Boost" },
  { value: "xp", label: "Total XP" },
  { value: "workCount", label: "Tasks Done" },
];

interface GridControlsProps {
  sortKey: NFTSortKey;
  sortOrder: NFTSortOrder;
  filters: NFTGridFilters;
  total: number;
  onSortKey: (key: NFTSortKey) => void;
  onSortOrder: (order: NFTSortOrder) => void;
  onFilter: (f: NFTGridFilters) => void;
}

const GridControls: FC<GridControlsProps> = ({
  sortKey,
  sortOrder,
  filters,
  total,
  onSortKey,
  onSortOrder,
  onFilter,
}) => {
  const selectBase = clsx(
    "font-pixel text-[8px] uppercase",
    "bg-pixel-bg-dark text-pixel-text",
    "border-2 border-pixel-border",
    "px-2 py-1",
    "focus:border-pixel-primary focus:outline-none",
    "cursor-pointer",
  );

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="font-pixel text-[8px] text-pixel-text-muted mr-auto">
        {total} NFT{total !== 1 ? "s" : ""}
      </span>

      <select
        className={selectBase}
        value={filters.rarity ?? "all"}
        onChange={(e) =>
          onFilter({ ...filters, rarity: e.target.value as RarityTier | "all" })
        }
      >
        {RARITY_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <select
        className={selectBase}
        value={sortKey}
        onChange={(e) => onSortKey(e.target.value as NFTSortKey)}
      >
        {SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            Sort: {opt.label}
          </option>
        ))}
      </select>

      <button
        className={clsx(
          "font-pixel text-[8px] uppercase",
          "bg-pixel-bg-dark text-pixel-text",
          "border-2 border-pixel-border px-2 py-1",
          "hover:border-pixel-primary transition-colors cursor-pointer",
        )}
        onClick={() => onSortOrder(sortOrder === "asc" ? "desc" : "asc")}
      >
        {sortOrder === "asc" ? "ASC" : "DESC"}
      </button>
    </div>
  );
};

const GRID_COLS: Record<NonNullable<NFTGridProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export const NFTGrid: FC<NFTGridProps> = ({
  nfts,
  columns,
  onEvolve,
  onSelect,
  selectedTokenId,
  evolvingIds = new Set(),
  isLoading = false,
  skeletonCount = 6,
  showControls = true,
  className,
}) => {
  const [sortKey, setSortKey] = useState<NFTSortKey>("tokenId");
  const [sortOrder, setSortOrder] = useState<NFTSortOrder>("asc");
  const [filters, setFilters] = useState<NFTGridFilters>({ rarity: "all" });

  const filtered = useMemo(
    () =>
      nfts.filter((nft) => {
        if (filters.rarity && filters.rarity !== "all") {
          return nft.rarityTier === filters.rarity;
        }
        return true;
      }),
    [nfts, filters],
  );

  const sorted = useMemo(() => {
    const dir = sortOrder === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "tokenId":
          return (a.tokenId - b.tokenId) * dir;
        case "level":
          return (a.level - b.level) * dir;
        case "boost":
          return (getMiningBoost(a) - getMiningBoost(b)) * dir;
        case "xp":
          return (a.totalXp - b.totalXp) * dir;
        case "workCount":
          return (a.workCount - b.workCount) * dir;
        default:
          return 0;
      }
    });
  }, [filtered, sortKey, sortOrder]);

  const colsClass =
    columns !== undefined
      ? GRID_COLS[columns]
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <div className={clsx("w-full", className)}>
      {showControls && !isLoading && (
        <GridControls
          sortKey={sortKey}
          sortOrder={sortOrder}
          filters={filters}
          total={sorted.length}
          onSortKey={setSortKey}
          onSortOrder={setSortOrder}
          onFilter={setFilters}
        />
      )}

      <div className={clsx("grid gap-6", colsClass)}>
        {isLoading ? (
          Array.from({ length: skeletonCount }, (_, i) => (
            <NFTCardSkeleton key={i} />
          ))
        ) : sorted.length === 0 ? (
          <EmptyState />
        ) : (
          sorted.map((nft) => (
            <NFTCard
              key={nft.tokenId}
              nft={nft}
              onEvolve={onEvolve}
              onSelect={onSelect}
              isEvolving={evolvingIds.has(nft.tokenId)}
              isSelected={selectedTokenId === nft.tokenId}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default NFTGrid;
