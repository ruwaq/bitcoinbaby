/**
 * LeaderboardWidget - Compact Mini-Leaderboard
 *
 * A small, embeddable widget showing top players and user rank.
 * Designed for sidebars, dashboards, and the main Baby page.
 */

import { type FC } from "react";
import { clsx } from "clsx";

export type LeaderboardCategory = "miners" | "babies" | "earners";

export interface LeaderboardWidgetEntry {
  address: string;
  score: number;
  rank: number;
  isCurrentUser?: boolean;
}

export interface LeaderboardWidgetProps {
  /** Top entries to display (default: 3) */
  entries: LeaderboardWidgetEntry[];
  /** Category for score formatting */
  category?: LeaderboardCategory;
  /** User's current rank (shown at bottom) */
  userRank?: {
    rank: number;
    score: number;
  } | null;
  /** Whether data is loading */
  isLoading?: boolean;
  /** Callback when "View More" is clicked */
  onViewMore?: () => void;
  /** Title override */
  title?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format score based on category
 */
function formatScore(score: number, category: LeaderboardCategory): string {
  if (category === "babies") {
    return `Lv.${score}`;
  }

  if (score >= 1e9) {
    return `${(score / 1e9).toFixed(1)}B`;
  }
  if (score >= 1e6) {
    return `${(score / 1e6).toFixed(1)}M`;
  }
  if (score >= 1e3) {
    return `${(score / 1e3).toFixed(1)}K`;
  }
  return score.toLocaleString();
}

/**
 * Truncate address for display
 */
function truncateAddress(address: string): string {
  if (address.length <= 11) return address;
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
}

/**
 * Get rank display (medal or number)
 */
function getRankDisplay(rank: number): { text: string; color: string } {
  if (rank === 1) return { text: "1ST", color: "text-pixel-primary" };
  if (rank === 2) return { text: "2ND", color: "text-pixel-text-muted" };
  if (rank === 3) return { text: "3RD", color: "text-pixel-primary-dark" };
  return { text: `#${rank}`, color: "text-pixel-text" };
}

/**
 * Category labels
 */
const categoryLabels: Record<LeaderboardCategory, string> = {
  miners: "TOP MINERS",
  babies: "TOP BABIES",
  earners: "TOP EARNERS",
};

/**
 * Loading skeleton
 */
const SkeletonEntry: FC = () => (
  <div className="flex justify-between items-center py-1 animate-pulse">
    <div className="flex items-center gap-2">
      <div className="w-6 h-4 bg-pixel-border" />
      <div className="w-16 h-4 bg-pixel-border" />
    </div>
    <div className="w-12 h-4 bg-pixel-border" />
  </div>
);

export const LeaderboardWidget: FC<LeaderboardWidgetProps> = ({
  entries,
  category = "miners",
  userRank,
  isLoading = false,
  onViewMore,
  title,
  className,
}) => {
  return (
    <div
      className={clsx(
        "bg-pixel-bg-medium border-4 border-pixel-border p-3",
        "shadow-[4px_4px_0_0_#000]",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-[10px] text-pixel-primary">
          {title || categoryLabels[category]}
        </h3>
        {onViewMore && (
          <button
            onClick={onViewMore}
            className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-secondary transition-colors"
          >
            VER MAS {">"}
          </button>
        )}
      </div>

      {/* Entries */}
      <div className="space-y-1">
        {isLoading ? (
          <>
            <SkeletonEntry />
            <SkeletonEntry />
            <SkeletonEntry />
          </>
        ) : entries.length === 0 ? (
          <div className="py-4 text-center">
            <div className="font-pixel text-lg text-pixel-border mb-2">[?]</div>
            <span className="font-pixel text-[8px] text-pixel-text-muted block">
              No rankings yet
            </span>
            <span className="font-pixel text-[6px] text-pixel-text-muted block mt-1">
              {category === "miners" && "Be the first to mine!"}
              {category === "babies" && "Raise a baby first!"}
              {category === "earners" && "Start earning $BABY!"}
            </span>
          </div>
        ) : (
          entries.slice(0, 5).map((entry) => {
            const rankDisplay = getRankDisplay(entry.rank);

            return (
              <div
                key={`${entry.address}-${entry.rank}`}
                className={clsx(
                  "flex justify-between items-center py-1",
                  "border-b border-pixel-border last:border-0",
                  entry.isCurrentUser && "bg-pixel-primary/10 -mx-1 px-1",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={clsx(
                      "font-pixel text-[8px] w-6",
                      rankDisplay.color,
                    )}
                  >
                    {rankDisplay.text}
                  </span>
                  <span
                    className={clsx(
                      "font-pixel-mono text-[10px]",
                      entry.isCurrentUser
                        ? "text-pixel-primary"
                        : "text-pixel-text",
                    )}
                  >
                    {truncateAddress(entry.address)}
                  </span>
                </div>
                <span className="font-pixel-mono text-[10px] text-pixel-success">
                  {formatScore(entry.score, category)}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* User Rank Section */}
      {userRank && userRank.rank > 0 && (
        <div className="mt-3 pt-2 border-t-2 border-pixel-border">
          <div className="flex justify-between items-center">
            <span className="font-pixel text-[8px] text-pixel-secondary">
              TU POSICION
            </span>
            <div className="flex items-center gap-2">
              <span className="font-pixel text-[10px] text-pixel-primary">
                #{userRank.rank}
              </span>
              <span className="font-pixel-mono text-[10px] text-pixel-success">
                {formatScore(userRank.score, category)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaderboardWidget;
