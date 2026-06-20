/**
 * NFTStats - Collection Stats Panel
 */

import { type FC, useMemo } from "react";
import { clsx } from "clsx";
import type { SparkNFTState, RarityTier } from "./types";
import { getMiningBoost, MAX_LEVEL } from "./types";

export interface NFTStatsProps {
  nfts: SparkNFTState[];
  showRarityBreakdown?: boolean;
  isLoading?: boolean;
  className?: string;
}

interface CollectionStats {
  total: number;
  bestBoost: number;
  combinedBoost: number;
  avgLevel: number;
  maxLevelCount: number;
  totalWorkCount: number;
  tokensEarned: bigint;
  rarityDist: Record<RarityTier, number>;
}

function computeStats(nfts: SparkNFTState[]): CollectionStats {
  const empty: CollectionStats = {
    total: 0,
    bestBoost: 0,
    combinedBoost: 0,
    avgLevel: 0,
    maxLevelCount: 0,
    totalWorkCount: 0,
    tokensEarned: 0n,
    rarityDist: {
      common: 0,
      uncommon: 0,
      rare: 0,
      epic: 0,
      legendary: 0,
      mythic: 0,
    },
  };

  if (nfts.length === 0) return empty;

  let bestBoost = 0;
  let combinedBoost = 0;
  let levelSum = 0;
  let maxLevelCount = 0;
  let totalWorkCount = 0;
  let tokensEarned = 0n;
  const rarityDist: Record<RarityTier, number> = { ...empty.rarityDist };

  for (const nft of nfts) {
    const boost = getMiningBoost(nft);
    bestBoost = Math.max(bestBoost, boost);
    combinedBoost += boost;
    levelSum += nft.level;
    if (nft.level >= MAX_LEVEL) maxLevelCount++;
    totalWorkCount += nft.workCount;
    tokensEarned += nft.tokensEarned;
    rarityDist[nft.rarityTier]++;
  }

  return {
    total: nfts.length,
    bestBoost,
    combinedBoost,
    avgLevel: Math.round((levelSum / nfts.length) * 10) / 10,
    maxLevelCount,
    totalWorkCount,
    tokensEarned,
    rarityDist,
  };
}

function formatBabtc(amount: bigint): string {
  if (amount === 0n) return "0";
  const whole = amount / 100_000_000n;
  if (whole >= 1_000_000n) return `${(Number(whole) / 1_000_000).toFixed(1)}M`;
  if (whole >= 1_000n) return `${(Number(whole) / 1_000).toFixed(1)}K`;
  return whole.toString();
}

interface StatBoxProps {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}

const StatBox: FC<StatBoxProps> = ({ label, value, subValue, color }) => (
  <div className="flex flex-col p-3 border-2 border-black bg-pixel-bg-light">
    <span className="font-pixel text-[7px] text-pixel-text-muted uppercase mb-1">
      {label}
    </span>
    <span
      className="font-pixel-mono text-2xl leading-none"
      style={{ color: color ?? "var(--pixel-text)" }}
    >
      {value}
    </span>
    {subValue && (
      <span className="font-pixel text-[7px] text-pixel-text-muted mt-0.5">
        {subValue}
      </span>
    )}
  </div>
);

const RARITY_ORDER: RarityTier[] = [
  "mythic",
  "legendary",
  "epic",
  "rare",
  "uncommon",
  "common",
];

const RARITY_DISPLAY: Record<RarityTier, { bar: string; label: string }> = {
  common: { bar: "#6b7280", label: "Common" },
  uncommon: { bar: "#22c55e", label: "Uncommon" },
  rare: { bar: "#3b82f6", label: "Rare" },
  epic: { bar: "#a855f7", label: "Epic" },
  legendary: { bar: "#f59e0b", label: "Legendary" },
  mythic: { bar: "#ec4899", label: "Mythic" },
};

const RarityBar: FC<{
  dist: Record<RarityTier, number>;
  total: number;
}> = ({ dist, total }) => (
  <div className="space-y-1.5">
    <p className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
      Rarity Distribution
    </p>
    {RARITY_ORDER.map((tier) => {
      const count = dist[tier];
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;
      const { bar, label } = RARITY_DISPLAY[tier];

      return (
        <div key={tier} className="flex items-center gap-2">
          <span
            className="font-pixel text-[7px] uppercase w-20 shrink-0"
            style={{ color: bar }}
          >
            {label}
          </span>
          <div className="flex-1 h-3 bg-pixel-bg-dark border-2 border-pixel-border overflow-hidden">
            <div
              className="h-full transition-[width] duration-300 [transition-timing-function:steps(10)]"
              style={{ width: `${pct}%`, background: bar }}
            />
          </div>
          <span className="font-pixel-mono text-sm text-pixel-text w-5 text-right shrink-0">
            {count}
          </span>
        </div>
      );
    })}
  </div>
);

const StatsSkeleton: FC = () => (
  <div className="animate-pulse space-y-3">
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          className="h-20 bg-pixel-bg-light border-2 border-pixel-border"
        />
      ))}
    </div>
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 2 }, (_, i) => (
        <div
          key={i}
          className="h-20 bg-pixel-bg-light border-2 border-pixel-border"
        />
      ))}
    </div>
    <div className="h-36 bg-pixel-bg-light border-2 border-pixel-border" />
  </div>
);

export const NFTStats: FC<NFTStatsProps> = ({
  nfts,
  showRarityBreakdown = true,
  isLoading = false,
  className,
}) => {
  const stats = useMemo(() => computeStats(nfts), [nfts]);

  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium border-4 border-pixel-border",
        "shadow-[8px_8px_0_0_#000,inset_-4px_-4px_0_0_rgba(0,0,0,0.3),inset_4px_4px_0_0_rgba(255,255,255,0.05)]",
        className,
      )}
    >
      <div className="px-4 py-3 border-b-2 border-pixel-border bg-pixel-bg-dark">
        <h2 className="font-pixel text-[10px] text-pixel-primary uppercase">
          Collection Stats
        </h2>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <StatsSkeleton />
        ) : stats.total === 0 ? (
          <p className="font-pixel text-[9px] text-pixel-text-muted text-center py-6 uppercase">
            No NFTs in collection
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label="Total NFTs"
                value={stats.total.toString()}
                subValue={`${stats.maxLevelCount} at LV${MAX_LEVEL}`}
              />
              <StatBox
                label="Best Boost"
                value={`+${stats.bestBoost}%`}
                subValue="single NFT peak"
                color="#fbbf24"
              />
              <StatBox
                label="Combined Boost"
                value={`+${stats.combinedBoost}%`}
                subValue="total mining power"
                color="var(--pixel-success)"
              />
              <StatBox
                label="Avg Level"
                value={stats.avgLevel.toFixed(1)}
                subValue={`max ${MAX_LEVEL}`}
                color="var(--pixel-secondary)"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatBox
                label="Total Tasks"
                value={
                  stats.totalWorkCount >= 1000
                    ? `${(stats.totalWorkCount / 1000).toFixed(1)}K`
                    : stats.totalWorkCount.toString()
                }
                subValue="PoUW completed"
              />
              <StatBox
                label="BABTC Earned"
                value={formatBabtc(stats.tokensEarned)}
                subValue="lifetime tokens"
                color="var(--pixel-primary)"
              />
            </div>

            {showRarityBreakdown && (
              <div className="pt-2 border-t-2 border-pixel-border">
                <RarityBar dist={stats.rarityDist} total={stats.total} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NFTStats;
