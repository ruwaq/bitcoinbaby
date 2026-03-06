"use client";

/**
 * ExplorerFilters - Filtering and sorting controls for NFT Explorer
 */

import { pixelBorders } from "@bitcoinbaby/ui";
import type { NFTExplorerQuery } from "@bitcoinbaby/core";

interface ExplorerFiltersProps {
  filters: NFTExplorerQuery;
  onFiltersChange: (filters: NFTExplorerQuery) => void;
  stats?: {
    total: number;
    forSale: number;
    byRarity: Record<string, number>;
    byBloodline: Record<string, number>;
  };
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "rarest", label: "Rarest First" },
  { value: "level", label: "Highest Level" },
  { value: "xp", label: "Most XP" },
] as const;

const BLOODLINE_OPTIONS = [
  { value: "all", label: "All Bloodlines" },
  { value: "royal", label: "Royal 👑" },
  { value: "warrior", label: "Warrior ⚔️" },
  { value: "mystic", label: "Mystic 🔮" },
  { value: "rogue", label: "Rogue 🗡️" },
] as const;

const RARITY_OPTIONS = [
  { value: "all", label: "All Rarities" },
  { value: "mythic", label: "Mythic" },
  { value: "legendary", label: "Legendary" },
  { value: "epic", label: "Epic" },
  { value: "rare", label: "Rare" },
  { value: "uncommon", label: "Uncommon" },
  { value: "common", label: "Common" },
] as const;

const SALE_OPTIONS = [
  { value: "all", label: "All NFTs" },
  { value: "true", label: "For Sale" },
  { value: "false", label: "Not Listed" },
] as const;

export function ExplorerFilters({
  filters,
  onFiltersChange,
  stats,
}: ExplorerFiltersProps) {
  const handleChange = (key: keyof NFTExplorerQuery, value: string) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1, // Reset to first page when filters change
    });
  };

  return (
    <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 mb-6`}>
      {/* Stats Bar */}
      {stats && (
        <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-pixel-border">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                TOTAL
              </p>
              <p className="font-pixel text-sm text-pixel-text">
                {stats.total}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <div>
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                FOR SALE
              </p>
              <p className="font-pixel text-sm text-pixel-warning">
                {stats.forSale}
              </p>
            </div>
          </div>
          {/* Rarity breakdown */}
          {stats.byRarity.mythic && (
            <div className="flex items-center gap-1">
              <span className="font-pixel text-[7px] text-red-400">
                {stats.byRarity.mythic} Mythic
              </span>
            </div>
          )}
          {stats.byRarity.legendary && (
            <div className="flex items-center gap-1">
              <span className="font-pixel text-[7px] text-yellow-400">
                {stats.byRarity.legendary} Legendary
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Sort */}
        <div>
          <label className="font-pixel text-[7px] text-pixel-text-muted uppercase block mb-1">
            Sort By
          </label>
          <select
            value={filters.sort || "newest"}
            onChange={(e) => handleChange("sort", e.target.value)}
            className="w-full bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text font-pixel text-[9px] p-2 focus:border-pixel-primary outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bloodline */}
        <div>
          <label className="font-pixel text-[7px] text-pixel-text-muted uppercase block mb-1">
            Bloodline
          </label>
          <select
            value={filters.bloodline || "all"}
            onChange={(e) => handleChange("bloodline", e.target.value)}
            className="w-full bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text font-pixel text-[9px] p-2 focus:border-pixel-primary outline-none"
          >
            {BLOODLINE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Rarity */}
        <div>
          <label className="font-pixel text-[7px] text-pixel-text-muted uppercase block mb-1">
            Rarity
          </label>
          <select
            value={filters.rarity || "all"}
            onChange={(e) => handleChange("rarity", e.target.value)}
            className="w-full bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text font-pixel text-[9px] p-2 focus:border-pixel-primary outline-none"
          >
            {RARITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* For Sale */}
        <div>
          <label className="font-pixel text-[7px] text-pixel-text-muted uppercase block mb-1">
            Status
          </label>
          <select
            value={filters.forSale || "all"}
            onChange={(e) => handleChange("forSale", e.target.value)}
            className="w-full bg-pixel-bg-dark border-2 border-pixel-border text-pixel-text font-pixel text-[9px] p-2 focus:border-pixel-primary outline-none"
          >
            {SALE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

export default ExplorerFilters;
