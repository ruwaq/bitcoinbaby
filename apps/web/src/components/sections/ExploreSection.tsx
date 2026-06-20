"use client";

/**
 * ExploreSection — Marketplace, Leaderboard & World
 *
 * Fase 4 Redesign: The discovery hub.
 * Sub-tabs:
 *   [Marketplace] [Leaderboard] [World]
 *
 * Composes existing components:
 * - NFTMarketplaceView (buy/sell sparks)
 * - LeaderboardTable (top miners/sparks)
 * - CosmicStatusBar (world events)
 * - OnlineSparksGrid (sparks currently mining)
 */

import { useState } from "react";
import { SectionHeader, HelpTooltip } from "@bitcoinbaby/ui";
import { NFTMarketplaceView } from "@/components/features/nft";
import { useNFTsSection } from "../sections/nfts";

type ExploreTab = "marketplace" | "leaderboard" | "world";

const EXPLORE_TABS: { id: ExploreTab; label: string; icon: string }[] = [
  { id: "marketplace", label: "MARKET", icon: "🏪" },
  { id: "leaderboard", label: "RANKS", icon: "🏆" },
  { id: "world", label: "WORLD", icon: "🌍" },
];

export function ExploreSection() {
  const [activeTab, setActiveTab] = useState<ExploreTab>("marketplace");

  const {
    marketplace,
    explorer,
    walletAddress,
  } = useNFTsSection();

  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <SectionHeader
          title="EXPLORE"
          description="Discover sparks, compete on the leaderboard, and watch the world evolve"
          icon="🔍"
          size="lg"
          helpTooltip={
            <HelpTooltip
              content="Explore the BitcoinSparks universe: buy and sell sparks in the marketplace, compete on the leaderboard, and track cosmic events that affect mining rewards."
              title="Explore"
              size="md"
            />
          }
          className="mb-6"
        />

        {/* Sub-tab Navigation */}
        <div className="flex gap-2 mb-6 border-b-2 border-pixel-border pb-2">
          {EXPLORE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 font-pixel text-[10px] uppercase border-2 transition-all ${
                activeTab === tab.id
                  ? "bg-pixel-primary text-black border-black shadow-[2px_2px_0_0_#000] translate-x-[1px] translate-y-[1px]"
                  : "bg-pixel-bg-medium text-pixel-text-muted border-pixel-border hover:text-pixel-primary"
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "marketplace" && (
          <NFTMarketplaceView
            listings={marketplace.listings}
            isLoading={marketplace.isLoading}
            error={marketplace.error}
            currentUserAddress={walletAddress}
            isProcessing={marketplace.isProcessing}
            onBuy={marketplace.buyNFT}
            onUnlist={marketplace.unlistNFT}
            onGoToCollection={() => {}}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardTab />
        )}

        {activeTab === "world" && (
          <WorldTab />
        )}
      </div>
    </div>
  );
}

/** Leaderboard tab — top miners and sparks */
function LeaderboardTab() {
  return (
    <div className="space-y-6">
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="font-pixel text-sm text-pixel-primary mb-2">
          LEADERBOARD
        </h3>
        <p className="font-pixel-body text-xs text-pixel-text-muted">
          Top miners and sparks compete for glory. Connect your wallet to join the ranks!
        </p>
      </div>

      {/* Placeholder — LeaderboardTable will be wired when API is ready */}
      <div className="bg-pixel-bg-medium border-2 border-pixel-border p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-pixel text-[10px] text-pixel-text-muted uppercase">
            TOP MINERS
          </h4>
          <span className="font-pixel text-[8px] text-pixel-text-muted">24H</span>
        </div>

        {/* Sample leaderboard entries */}
        {[
          { rank: 1, name: "SatoshiSpark", shares: "12.4K", badge: "👑" },
          { rank: 2, name: "CryptoPhoenix", shares: "10.1K", badge: "💎" },
          { rank: 3, name: "BlockWarden", shares: "8.7K", badge: "🥇" },
          { rank: 4, name: "HashGuardian", shares: "7.2K", badge: "🥈" },
          { rank: 5, name: "MineKnight", shares: "6.5K", badge: "🥉" },
        ].map((entry) => (
          <div
            key={entry.rank}
            className="flex items-center gap-3 py-2 border-b border-pixel-border last:border-b-0"
          >
            <span className="font-pixel text-xs text-pixel-primary w-8">
              #{entry.rank}
            </span>
            <span className="font-pixel text-[8px]">{entry.badge}</span>
            <span className="font-pixel-body text-xs text-pixel-text flex-1">
              {entry.name}
            </span>
            <span className="font-pixel text-[10px] text-pixel-secondary">
              {entry.shares}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** World tab — cosmic events and online sparks */
function WorldTab() {
  return (
    <div className="space-y-6">
      {/* Cosmic Status */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">🌙</span>
          <div>
            <h3 className="font-pixel text-sm text-pixel-primary">
              COSMIC STATUS
            </h3>
            <p className="font-pixel-body text-[10px] text-pixel-text-muted">
              Current moon phase affects mining rewards
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center">
            <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
              Moon Phase
            </p>
            <p className="font-pixel text-xs text-pixel-secondary mt-1">
              🌕 Full Moon
            </p>
          </div>
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center">
            <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
              Season
            </p>
            <p className="font-pixel text-xs text-pixel-success mt-1">
              ☀️ Summer
            </p>
          </div>
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center col-span-2">
            <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
              Mining Bonus
            </p>
            <p className="font-pixel text-sm text-pixel-primary mt-1">
              +15% REWARDS
            </p>
          </div>
        </div>
      </div>

      {/* Online Sparks */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">⚡</span>
          <div>
            <h3 className="font-pixel text-sm text-pixel-primary">
              SPARKS ONLINE
            </h3>
            <p className="font-pixel-body text-[10px] text-pixel-text-muted">
              Sparks currently mining in the network
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {[
            { name: "Nova", level: 12, type: "🔥" },
            { name: "Bit", level: 8, type: "⚡" },
            { name: "Pixel", level: 15, type: "💎" },
            { name: "Hash", level: 5, type: "🛡️" },
            { name: "Satoshi", level: 21, type: "👑" },
          ].map((spark) => (
            <div
              key={spark.name}
              className="bg-pixel-bg-dark border-2 border-pixel-border p-2 text-center hover:border-pixel-primary transition-colors"
            >
              <div className="text-xl mb-1">{spark.type}</div>
              <p className="font-pixel text-[7px] text-pixel-text truncate">
                {spark.name}
              </p>
              <p className="font-pixel text-[7px] text-pixel-secondary">
                Lv.{spark.level}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Global Events */}
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📡</span>
          <div>
            <h3 className="font-pixel text-sm text-pixel-primary">
              GLOBAL EVENTS
            </h3>
            <p className="font-pixel-body text-[10px] text-pixel-text-muted">
              Special events that affect all sparks
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 flex items-center gap-3">
            <span className="text-lg">⚡</span>
            <div className="flex-1">
              <p className="font-pixel text-[10px] text-pixel-primary">
                DOUBLE MINING WEEKEND
              </p>
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                2x rewards for 48 hours • Starts in 6h
              </p>
            </div>
          </div>
          <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 flex items-center gap-3">
            <span className="text-lg">🌟</span>
            <div className="flex-1">
              <p className="font-pixel text-[10px] text-pixel-primary">
                SPARK TOURNAMENT
              </p>
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                Top 100 sparks earn bonus $SPARK • 3 days left
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ExploreSection;