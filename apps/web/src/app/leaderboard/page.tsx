"use client";

/**
 * Leaderboard Page
 *
 * Displays rankings for top miners, babies, and earners.
 * Features time period tabs, category switching, and pagination.
 */

import { useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { pixelShadows, pixelBorders } from "@bitcoinbaby/ui";
import {
  LeaderboardTable,
  LeaderboardPagination,
  UserRankSummary,
  NetworkBadge,
  WalletStatusCompact,
} from "@bitcoinbaby/ui";
import {
  useNetworkStore,
  useLeaderboard,
  useCosmicMiningMultiplier,
  CATEGORY_INFO,
  PERIOD_INFO,
  type LeaderboardCategory,
  type LeaderboardPeriod,
} from "@bitcoinbaby/core";
import { useWallet } from "../../hooks/useWallet";

/**
 * Tab button component
 */
function TabButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-4 py-2 font-pixel text-xs",
        "border-2 border-black transition-all",
        active
          ? "bg-pixel-primary text-pixel-text-dark shadow-[2px_2px_0_0_#000]"
          : "bg-pixel-bg-light text-pixel-text-muted hover:bg-pixel-bg-medium shadow-[2px_2px_0_0_#000] hover:text-pixel-text",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Category card component
 */
function CategoryCard({
  info,
  active,
  onClick,
}: {
  category?: LeaderboardCategory; // Unused but kept for API compatibility
  info: { label: string; description: string; icon: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex-1 p-4 text-left",
        "border-4 transition-all",
        active
          ? "bg-pixel-bg-medium border-pixel-primary shadow-[4px_4px_0_0_#000]"
          : "bg-pixel-bg-dark border-pixel-border shadow-[4px_4px_0_0_#000] hover:border-pixel-text-muted",
      )}
    >
      <div className="flex items-center gap-3 mb-2">
        <span
          className={clsx(
            "w-8 h-8 flex items-center justify-center",
            "font-pixel text-sm border-2 border-black",
            active
              ? "bg-pixel-primary text-pixel-text-dark"
              : "bg-pixel-bg-light text-pixel-text-muted",
          )}
        >
          {info.icon}
        </span>
        <span
          className={clsx(
            "font-pixel text-xs",
            active ? "text-pixel-primary" : "text-pixel-text",
          )}
        >
          {info.label}
        </span>
      </div>
      <p className="font-pixel-body text-sm text-pixel-text-muted">
        {info.description}
      </p>
    </button>
  );
}

export default function LeaderboardPage() {
  // Wallet hook for user address
  const wallet = useWallet();
  const { network } = useNetworkStore();

  // Cosmic status for user's mining bonus
  const cosmic = useCosmicMiningMultiplier();

  // Leaderboard hook
  const leaderboard = useLeaderboard({
    initialCategory: "miners",
    initialPeriod: "alltime",
    pageSize: 10,
    userAddress: wallet.wallet?.address,
  });

  // Loading skeleton for initial load
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  if (!leaderboard.isLoading && !hasLoadedOnce) {
    setHasLoadedOnce(true);
  }

  return (
    <main className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-pixel-primary border-2 border-black flex items-center justify-center">
                <span className="font-pixel text-pixel-text-dark text-xs">
                  B
                </span>
              </div>
              <h1 className="font-pixel text-lg md:text-xl text-pixel-primary">
                BITCOIN<span className="text-pixel-secondary">BABY</span>
              </h1>
            </Link>
          </div>

          <nav className="flex items-center gap-2">
            {/* Network Badge */}
            <NetworkBadge network={network} />

            <Link
              href="/"
              className="px-3 py-2 font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary transition-colors"
            >
              HOME
            </Link>

            {/* Wallet Status */}
            {wallet.wallet ? (
              <WalletStatusCompact
                address={wallet.wallet.address}
                isLocked={wallet.isLocked}
                onClick={() => (window.location.href = "/wallet")}
              />
            ) : (
              <Link
                href="/wallet"
                className="px-3 py-2 font-pixel text-[8px] bg-pixel-primary text-pixel-text-dark border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] transition-all"
              >
                CONNECT
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Page Title */}
      <div className="max-w-4xl mx-auto mb-8">
        <h2 className="font-pixel text-2xl text-pixel-primary mb-2">
          LEADERBOARD
        </h2>
        <p className="font-pixel-body text-pixel-text-muted">
          Compete with other players and climb the ranks!
        </p>
      </div>

      {/* Time Period Tabs */}
      <div className="max-w-4xl mx-auto mb-6">
        <div className="flex gap-2">
          {(Object.keys(PERIOD_INFO) as LeaderboardPeriod[]).map((period) => (
            <TabButton
              key={period}
              active={leaderboard.period === period}
              onClick={() => leaderboard.setPeriod(period)}
            >
              {PERIOD_INFO[period].label.toUpperCase()}
            </TabButton>
          ))}
        </div>
      </div>

      {/* Category Cards */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row gap-4">
          {(Object.keys(CATEGORY_INFO) as LeaderboardCategory[]).map(
            (category) => (
              <CategoryCard
                key={category}
                category={category}
                info={CATEGORY_INFO[category]}
                active={leaderboard.category === category}
                onClick={() => leaderboard.setCategory(category)}
              />
            ),
          )}
        </div>
      </div>

      {/* User Rank Summary */}
      {wallet.wallet && leaderboard.userRank !== null && (
        <div className="max-w-4xl mx-auto mb-6">
          <UserRankSummary
            rank={leaderboard.userRank}
            totalPlayers={leaderboard.totalEntries}
            score={leaderboard.userScore}
            category={leaderboard.category}
            formatScore={leaderboard.formatScore}
            cosmicStatus={cosmic.status}
            cosmicMultiplier={cosmic.multiplier}
          />
        </div>
      )}

      {/* No Wallet Message */}
      {!wallet.wallet && (
        <div className="max-w-4xl mx-auto mb-6">
          <div
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 ${pixelShadows.md}`}
          >
            <p className="font-pixel text-xs text-pixel-text-muted text-center">
              Connect your wallet to see your rank and compete!
            </p>
            <div className="flex justify-center mt-3">
              <Link
                href="/wallet"
                className="px-4 py-2 font-pixel text-xs bg-pixel-primary text-pixel-text-dark border-2 border-black shadow-[2px_2px_0_0_#000] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000] transition-all"
              >
                CONNECT WALLET
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {leaderboard.error && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-pixel-error/20 border-4 border-pixel-error p-4">
            <p className="font-pixel text-xs text-pixel-error text-center">
              {leaderboard.error}
            </p>
            <div className="flex justify-center mt-3">
              <button
                onClick={leaderboard.refresh}
                className="px-4 py-2 font-pixel text-xs bg-pixel-error text-white border-2 border-black shadow-[2px_2px_0_0_#000]"
              >
                RETRY
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="max-w-4xl mx-auto mb-6">
        <LeaderboardTable
          entries={leaderboard.entries}
          category={leaderboard.category}
          isLoading={leaderboard.isLoading && !hasLoadedOnce}
          emptyMessage="No players found. Start mining to join the leaderboard!"
          formatScore={leaderboard.formatScore}
          truncateAddress={leaderboard.truncateAddress}
        />
      </div>

      {/* Pagination */}
      <div className="max-w-4xl mx-auto mb-8">
        <LeaderboardPagination
          currentPage={leaderboard.page}
          totalPages={leaderboard.totalPages}
          onPageChange={leaderboard.setPage}
        />
      </div>

      {/* Legend */}
      <div className="max-w-4xl mx-auto">
        <div
          className={`bg-pixel-bg-dark ${pixelBorders.medium} p-4 ${pixelShadows.md}`}
        >
          <h3 className="font-pixel text-xs text-pixel-text-muted mb-3">
            RANK BADGES
          </h3>
          <div className="flex flex-wrap gap-4">
            {[
              {
                badge: "W",
                label: "Whale (Top 10)",
                color: "bg-pixel-secondary",
              },
              {
                badge: "D",
                label: "Diamond (Top 50)",
                color: "bg-pixel-secondary-light",
              },
              {
                badge: "G",
                label: "Gold (Top 100)",
                color: "bg-pixel-primary",
              },
              {
                badge: "S",
                label: "Silver (Top 500)",
                color: "bg-pixel-text-muted",
              },
              {
                badge: "B",
                label: "Bronze (Top 1000)",
                color: "bg-pixel-primary-dark",
              },
            ].map((item) => (
              <div key={item.badge} className="flex items-center gap-2">
                <span
                  className={clsx(
                    "w-6 h-6 flex items-center justify-center",
                    "font-pixel text-[8px] border-2 border-black text-pixel-text-dark",
                    item.color,
                  )}
                >
                  {item.badge}
                </span>
                <span className="font-pixel-body text-xs text-pixel-text-muted">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto mt-12 pt-6 border-t-2 border-pixel-border">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-pixel-body text-sm text-pixel-text-muted">
            Built on Bitcoin with Charms Protocol
          </p>
          <div className="flex gap-4">
            <Link
              href="/help"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
            >
              HELP
            </Link>
            <Link
              href="/technology"
              className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
            >
              TECHNOLOGY
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
