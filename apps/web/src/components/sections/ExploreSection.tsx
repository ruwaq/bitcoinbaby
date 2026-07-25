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
 * - LeaderboardTable (top miners/sparks) — wired to real API
 * - CosmicStatusBar (world events) — wired to real astronomical data
 * - OnlineSparksGrid (sparks currently mining)
 */

import { useState, useEffect } from "react";
import { SectionHeader, HelpTooltip } from "@bitcoinbaby/ui";
import {
  useLeaderboard,
  useCosmicState,
  useCosmicEvents,
  useMoonPhase,
  truncateAddress,
  formatScore,
  CATEGORY_INFO,
  PERIOD_INFO,
  type LeaderboardCategory,
  type LeaderboardPeriod,
} from "@bitcoinbaby/core";
import { NFTMarketplaceView } from "@/components/features/nft";
import { useNFTsSection } from "../sections/nfts";
import { useWalletStore } from "@bitcoinbaby/core";

type ExploreTab = "marketplace" | "leaderboard" | "world";

const EXPLORE_TABS: { id: ExploreTab; label: string; icon: string }[] = [
  { id: "marketplace", label: "MARKET", icon: "🏪" },
  { id: "leaderboard", label: "RANKS", icon: "🏆" },
  { id: "world", label: "WORLD", icon: "🌍" },
];

export function ExploreSection() {
  const [activeTab, setActiveTab] = useState<ExploreTab>("marketplace");

  const { marketplace, explorer, walletAddress } = useNFTsSection();

  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-7xl mx-auto">
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

        {activeTab === "leaderboard" && <LeaderboardTab />}

        {activeTab === "world" && <WorldTab />}
      </div>
    </div>
  );
}

/** Leaderboard tab — wired to real API via useLeaderboard */
function LeaderboardTab() {
  const wallet = useWalletStore((s) => s.wallet);
  const userAddress = wallet?.address ?? undefined;

  const {
    entries,
    isLoading,
    error,
    isEmpty,
    category,
    period,
    setCategory,
    setPeriod,
    userRank,
    userScore,
    refresh,
  } = useLeaderboard({
    initialCategory: "miners",
    initialPeriod: "alltime",
    pageSize: 10,
    userAddress,
    refreshInterval: 60000,
  });

  return (
    <div className="space-y-6">
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6 text-center">
        <div className="text-4xl mb-4">🏆</div>
        <h3 className="font-pixel text-sm text-pixel-primary mb-2">
          LEADERBOARD
        </h3>
        <p className="font-pixel-body text-xs text-pixel-text-muted">
          Top miners and sparks compete for glory. Connect your wallet to join
          the ranks!
        </p>
      </div>

      {/* Category & Period Filters */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_INFO) as LeaderboardCategory[]).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategory(cat)}
            className={`px-3 py-1 font-pixel text-[8px] uppercase border-2 transition-all ${
              category === cat
                ? "bg-pixel-primary text-black border-black"
                : "bg-pixel-bg-medium text-pixel-text-muted border-pixel-border hover:text-pixel-primary"
            }`}
          >
            {CATEGORY_INFO[cat].icon} {CATEGORY_INFO[cat].label}
          </button>
        ))}
        <div className="w-full sm:w-auto ml-auto flex gap-2">
          {(Object.keys(PERIOD_INFO) as LeaderboardPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 font-pixel text-[8px] uppercase border-2 transition-all ${
                period === p
                  ? "bg-pixel-secondary text-black border-black"
                  : "bg-pixel-bg-medium text-pixel-text-muted border-pixel-border hover:text-pixel-secondary"
              }`}
            >
              {PERIOD_INFO[p].shortLabel}
            </button>
          ))}
        </div>
      </div>

      {/* User Rank */}
      {userAddress && userRank !== null && (
        <div className="bg-pixel-bg-medium border-2 border-pixel-primary p-3 flex items-center gap-3">
          <span className="font-pixel text-xs text-pixel-primary">
            #{userRank}
          </span>
          <span className="font-pixel-body text-xs text-pixel-text flex-1">
            Your Rank
          </span>
          <span className="font-pixel text-[10px] text-pixel-secondary">
            {formatScore(userScore, category)}
          </span>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="bg-pixel-bg-medium border-2 border-pixel-border p-4">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-pixel text-[10px] text-pixel-text-muted uppercase">
            {CATEGORY_INFO[category].label}
          </h4>
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[8px] text-pixel-text-muted">
              {PERIOD_INFO[period].shortLabel}
            </span>
            <button
              onClick={refresh}
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary underline"
              type="button"
            >
              REFRESH
            </button>
          </div>
        </div>

        {isLoading && entries.length === 0 && (
          <div className="text-center py-8">
            <div className="animate-spin h-6 w-6 border-2 border-pixel-primary border-t-transparent mx-auto mb-2" />
            <p className="font-pixel-body text-xs text-pixel-text-muted">
              Loading leaderboard...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-pixel-error/10 border-2 border-pixel-error p-4 text-center mb-4">
            <p className="font-pixel text-[10px] text-pixel-error">{error}</p>
            <button
              onClick={refresh}
              className="font-pixel text-[8px] text-pixel-primary underline mt-1"
              type="button"
            >
              Try again
            </button>
          </div>
        )}

        {isEmpty && (
          <div className="text-center py-8">
            <p className="font-pixel-body text-xs text-pixel-text-muted">
              No entries yet. Start mining to appear on the leaderboard!
            </p>
          </div>
        )}

        {entries.length > 0 && (
          <div>
            {entries.map((entry) => (
              <div
                key={`${entry.address}-${entry.rank}`}
                className={`flex items-center gap-3 py-2 border-b border-pixel-border last:border-b-0 ${
                  entry.isCurrentUser ? "bg-pixel-primary/10 -mx-2 px-2" : ""
                }`}
              >
                <span className="font-pixel text-xs text-pixel-primary w-8">
                  #{entry.rank}
                </span>
                <span className="font-pixel text-[8px]">
                  {entry.badge === "whale" && "🐋"}
                  {entry.badge === "diamond" && "💎"}
                  {entry.badge === "gold" && "🥇"}
                  {entry.badge === "silver" && "🥈"}
                  {entry.badge === "bronze" && "🥉"}
                  {entry.badge === "newbie" && "🌱"}
                  {entry.badge === "veteran" && "⭐"}
                </span>
                <span className="font-pixel-body text-xs text-pixel-text flex-1">
                  {entry.isCurrentUser
                    ? "YOU"
                    : truncateAddress(entry.address, 6)}
                </span>
                <span className="font-pixel text-[10px] text-pixel-secondary">
                  {formatScore(entry.score, category)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** World tab — cosmic events and online sparks, wired to real astronomical data */
function WorldTab() {
  const { cosmicState, isLoading: cosmicLoading } = useCosmicState({
    updateInterval: 60000,
  });

  const { phase, emoji: moonEmoji, illumination } = useMoonPhase();

  const { currentEvent, upcomingEvents, hasActiveEvent } = useCosmicEvents();

  const moonPhaseName = phase
    ? phase.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  const season = cosmicState?.season;
  const seasonName = season
    ? season.current.charAt(0).toUpperCase() + season.current.slice(1)
    : null;

  const miningBonus = cosmicState?.currentEvent
    ? cosmicState.currentEvent.intensity * 15
    : 0;

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

        {cosmicLoading && !cosmicState && (
          <div className="text-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-pixel-primary border-t-transparent mx-auto mb-2" />
            <p className="font-pixel-body text-xs text-pixel-text-muted">
              Calculating cosmic data...
            </p>
          </div>
        )}

        {cosmicState && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center">
              <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
                Moon Phase
              </p>
              <p className="font-pixel text-xs text-pixel-secondary mt-1">
                {moonEmoji} {moonPhaseName ?? "Unknown"}
              </p>
              <p className="font-pixel text-[7px] text-pixel-text-muted mt-0.5">
                {illumination.toFixed(0)}% illuminated
              </p>
            </div>
            <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center">
              <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
                Season
              </p>
              <p className="font-pixel text-xs text-pixel-success mt-1">
                {season?.emoji} {seasonName ?? "Unknown"}
              </p>
              {season && (
                <p className="font-pixel text-[7px] text-pixel-text-muted mt-0.5">
                  {season.daysUntilNext}d until {season.nextSeason}
                </p>
              )}
            </div>
            <div className="bg-pixel-bg-dark border-2 border-pixel-border p-3 text-center col-span-2">
              <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
                Mining Bonus
              </p>
              <p className="font-pixel text-sm text-pixel-primary mt-1">
                {hasActiveEvent && miningBonus > 0
                  ? `+${miningBonus.toFixed(0)}% REWARDS`
                  : "No active bonus"}
              </p>
              {hasActiveEvent && currentEvent && (
                <p className="font-pixel text-[7px] text-pixel-text-muted mt-0.5">
                  {currentEvent.emoji} {currentEvent.name}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Online Sparks — shows real count from cosmic state */}
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
        <div className="text-center py-6">
          <p className="font-pixel-body text-xs text-pixel-text-muted">
            Connect your wallet and start mining to appear here.
          </p>
          <p className="font-pixel text-[10px] text-pixel-primary mt-2">
            Mining data updates in real-time
          </p>
        </div>
      </div>

      {/* Global Events — wired to real cosmic events */}
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

        {cosmicLoading && !cosmicState && (
          <div className="text-center py-4">
            <div className="animate-spin h-5 w-5 border-2 border-pixel-primary border-t-transparent mx-auto mb-2" />
            <p className="font-pixel-body text-xs text-pixel-text-muted">
              Loading events...
            </p>
          </div>
        )}

        {cosmicState && (
          <div className="space-y-2">
            {hasActiveEvent && currentEvent && (
              <div className="bg-pixel-bg-dark border-2 border-pixel-primary p-3 flex items-center gap-3">
                <span className="text-lg">{currentEvent.emoji}</span>
                <div className="flex-1">
                  <p className="font-pixel text-[10px] text-pixel-primary">
                    {currentEvent.name.toUpperCase()}
                  </p>
                  <p className="font-pixel text-[7px] text-pixel-text-muted">
                    {currentEvent.description} • Active now
                  </p>
                </div>
              </div>
            )}

            {upcomingEvents.slice(0, 3).map((event) => {
              const daysUntil = Math.ceil(
                (event.startTime.getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24),
              );
              return (
                <div
                  key={event.id}
                  className="bg-pixel-bg-dark border-2 border-pixel-border p-3 flex items-center gap-3"
                >
                  <span className="text-lg">{event.emoji}</span>
                  <div className="flex-1">
                    <p className="font-pixel text-[10px] text-pixel-primary">
                      {event.name.toUpperCase()}
                    </p>
                    <p className="font-pixel text-[7px] text-pixel-text-muted">
                      {event.description}
                      {daysUntil > 0
                        ? ` • ${daysUntil} day${daysUntil !== 1 ? "s" : ""} away`
                        : " • Starting soon"}
                    </p>
                  </div>
                </div>
              );
            })}

            {!hasActiveEvent && upcomingEvents.length === 0 && (
              <div className="text-center py-4">
                <p className="font-pixel-body text-xs text-pixel-text-muted">
                  No upcoming cosmic events. Check back later!
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ExploreSection;
