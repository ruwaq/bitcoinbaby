"use client";

/**
 * BabySidebar - Secondary info panel for BabySection
 *
 * Contains:
 * - Mining status badge
 * - Mini leaderboard widget
 * - Quick tips
 * - Achievement progress
 * - Quick action buttons
 */

import {
  MiningStatusBadge,
  LeaderboardWidget,
  HelpTooltip,
  Button,
  pixelCard,
  pixelBorders,
} from "@bitcoinbaby/ui";
import type { UseAchievementsReturn } from "@bitcoinbaby/core";

// Tips data
const BABY_TIPS = [
  { emoji: "💡", text: "Keep your baby fed and happy to earn bonus XP" },
  { emoji: "⛏️", text: "Mining earns XP and $BABY tokens" },
  { emoji: "🌙", text: "Mine daily to prevent level decay" },
  { emoji: "🎨", text: "Get NFTs in the NFTs tab for mining boosts!" },
];

interface LeaderboardEntry {
  address: string;
  score: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface BabySidebarProps {
  // Mining status
  mining: {
    isRunning: boolean;
    hashrate: number;
    shares: number;
    nftBoost: number;
  };
  onGoToMining: () => void;

  // Leaderboard
  leaderboard: {
    entries: LeaderboardEntry[];
    userRank: number | null;
    userScore: number;
    isLoading: boolean;
  };
  onViewLeaderboard: () => void;

  // Achievements
  achievements: UseAchievementsReturn;

  // Navigation
  onGoToNFTs: () => void;
}

export function BabySidebar({
  mining,
  onGoToMining,
  leaderboard,
  onViewLeaderboard,
  achievements,
  onGoToNFTs,
}: BabySidebarProps) {
  return (
    <div className="space-y-6">
      {/* Mining Status Badge */}
      <MiningStatusBadge
        isRunning={mining.isRunning}
        hashrate={mining.hashrate}
        shares={mining.shares}
        nftBoost={mining.nftBoost > 0 ? 1 + mining.nftBoost / 100 : 1}
        onClick={onGoToMining}
      />

      {/* Mini Leaderboard Widget */}
      <LeaderboardWidget
        entries={leaderboard.entries}
        category="miners"
        userRank={
          leaderboard.userRank
            ? { rank: leaderboard.userRank, score: leaderboard.userScore }
            : null
        }
        isLoading={leaderboard.isLoading}
        onViewMore={onViewLeaderboard}
      />

      {/* Quick Tips */}
      <div className={`${pixelCard.primary} p-4`}>
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-pixel text-xs text-pixel-primary">TIPS</h3>
          <HelpTooltip
            content="Quick tips to help your baby grow faster and earn more rewards."
            size="sm"
          />
        </div>
        <div className="space-y-3 font-pixel-body text-sm text-pixel-text-muted">
          {BABY_TIPS.map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span>{tip.emoji}</span>
              <span>{tip.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Achievement Progress */}
      <div className={`bg-pixel-bg-light ${pixelBorders.medium} p-4`}>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-pixel text-xs text-pixel-primary">
            ACHIEVEMENTS
          </h3>
          <HelpTooltip
            content="Complete goals to earn achievements and XP bonuses."
            title="Achievements"
            size="sm"
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="font-pixel text-[10px] text-pixel-text-muted">
            {achievements.unlockedAchievements.length}/
            {achievements.totalAchievements}
          </span>
          <div className="flex gap-1">
            {achievements.unlockedAchievements.slice(-5).map((a) => (
              <span key={a.id} className="text-lg" title={a.name}>
                {a.icon}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          onClick={onGoToMining}
          variant="success"
          size="sm"
          className="w-full"
        >
          MINING
        </Button>
        <Button
          onClick={onGoToNFTs}
          variant="secondary"
          size="sm"
          className="w-full"
        >
          NFTs
        </Button>
      </div>
    </div>
  );
}

export default BabySidebar;
