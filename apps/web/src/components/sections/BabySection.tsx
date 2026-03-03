"use client";

/**
 * BabySection - Baby Care & Onboarding
 *
 * Focused on:
 * - Baby sprite and care actions
 * - Game progression (XP, evolution)
 * - Tutorial/onboarding for new users
 * - Simple mining status badge
 *
 * For full mining controls, see MiningSection.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLeaderboard } from "@bitcoinbaby/core";
import {
  AchievementPopup,
  EvolutionModal,
  DeathModal,
  HelpTooltip,
  SectionHeader,
  type GameAction,
} from "@bitcoinbaby/ui";
import { useWallet } from "@/hooks/useWallet";
import { useBaby } from "@/hooks/features";
import {
  CreateBabyForm,
  BabyDisplay,
  BabySidebar,
} from "@/components/features/baby";
import type { TabType } from "@/components/app/TabNavigation";

// =============================================================================
// PROPS
// =============================================================================

interface BabySectionProps {
  /** Navigate to another tab */
  setActiveTab: (tab: TabType) => void;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function BabySection({ setActiveTab }: BabySectionProps) {
  const router = useRouter();
  const wallet = useWallet();

  // Unified baby hook (game loop, achievements, mining XP tracking)
  const {
    baby,
    babyState,
    isLoading,
    isDead,
    daysUntilDecay,
    actions,
    achievements,
    mining,
    evolutionData,
    clearEvolution,
  } = useBaby();

  // Leaderboard data for mini-widget
  const leaderboard = useLeaderboard({
    initialCategory: "miners",
    initialPeriod: "alltime",
    pageSize: 3,
    userAddress: wallet.wallet?.address,
  });

  // Handle actions
  const handleAction = useCallback(
    (action: GameAction) => {
      if (action === "mine") {
        setActiveTab("mining");
      } else {
        actions.performAction(action);
      }
    },
    [actions, setActiveTab],
  );

  // Navigation helpers
  const goToMining = useCallback(() => setActiveTab("mining"), [setActiveTab]);
  const goToNFTs = useCallback(() => setActiveTab("nfts"), [setActiveTab]);
  const goToLeaderboard = useCallback(
    () => router.push("/leaderboard"),
    [router],
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl animate-bounce mb-4">👶</div>
          <p className="font-pixel text-pixel-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark">
      {/* Main Content */}
      {!baby ? (
        <div className="max-w-4xl mx-auto">
          <CreateBabyForm
            onCreate={actions.createBaby}
            currentMiningShares={mining.shares}
            onGoToMining={goToMining}
          />
        </div>
      ) : (
        <div className="max-w-4xl mx-auto">
          {/* Section Header */}
          <SectionHeader
            title="MY BABY"
            description="Take care of your BitcoinBaby"
            icon="👶"
            size="lg"
            helpTooltip={
              <HelpTooltip
                content="Your BitcoinBaby grows stronger as you mine and care for it. Higher levels unlock better mining bonuses."
                title="Baby Care"
                description="Feed, play, and mine regularly to keep your baby happy and earn XP faster."
                size="md"
              />
            }
            className="mb-6"
          />

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Baby Display */}
            <BabyDisplay
              name={baby.name}
              babyState={babyState}
              daysUntilDecay={daysUntilDecay ?? undefined}
              isMining={mining.isRunning}
              isDead={isDead}
              onAction={handleAction}
            />

            {/* Right: Mining Status & Achievements */}
            <BabySidebar
              mining={{
                isRunning: mining.isRunning,
                hashrate: mining.hashrate,
                shares: mining.shares,
                nftBoost: mining.nftBoost,
              }}
              onGoToMining={goToMining}
              leaderboard={{
                entries: leaderboard.entries.map((e) => ({
                  address: e.address,
                  score: e.score,
                  rank: e.rank,
                  isCurrentUser: e.isCurrentUser,
                })),
                userRank: leaderboard.userRank,
                userScore: leaderboard.userScore,
                isLoading: leaderboard.isLoading,
              }}
              onViewLeaderboard={goToLeaderboard}
              achievements={achievements}
              onGoToNFTs={goToNFTs}
            />
          </div>
        </div>
      )}

      {/* Achievement Popup */}
      {achievements.notification && (
        <AchievementPopup
          achievement={{
            id: achievements.notification.achievement.id,
            name: achievements.notification.achievement.name,
            description: achievements.notification.achievement.description,
            icon: achievements.notification.achievement.icon,
            xpReward: achievements.notification.achievement.reward.xp,
          }}
          onDismiss={achievements.dismissNotification}
        />
      )}

      {/* Evolution Modal */}
      {evolutionData && (
        <EvolutionModal
          isOpen={true}
          fromStage={evolutionData.fromStage}
          toStage={evolutionData.toStage}
          newLevel={evolutionData.newLevel}
          stageName={evolutionData.stageName}
          miningBonus={evolutionData.miningBonus}
          onComplete={clearEvolution}
        />
      )}

      {/* Death Modal */}
      <DeathModal
        isOpen={isDead}
        babyName={baby?.name || "Baby"}
        onRevive={actions.revive}
      />
    </div>
  );
}

export default BabySection;
