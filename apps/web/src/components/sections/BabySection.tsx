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

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  useGlobalMining,
  useGameLoop,
  useAchievements,
  MIN_DIFFICULTY,
} from "@bitcoinbaby/core";
import { useBabyState } from "@/hooks/useBabyState";
import {
  LevelSprite,
  GameHUD,
  ActionButtons,
  AchievementPopup,
  EvolutionModal,
  DeathModal,
  MiningStatusBadge,
  HelpTooltip,
  LeaderboardWidget,
  type GameAction,
} from "@bitcoinbaby/ui";
import { useLeaderboard } from "@bitcoinbaby/core";
import { useWallet } from "@/hooks/useWallet";
import { Button, SectionHeader, InfoBanner } from "@bitcoinbaby/ui";
import type { GameEvent } from "@bitcoinbaby/core";
import type { TabType } from "@/components/app/TabNavigation";
import { CreateBabyForm } from "@/components/features/baby";

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
  // Router for navigation
  const router = useRouter();

  // Wallet for user address
  const wallet = useWallet();

  // Leaderboard data for mini-widget
  const leaderboard = useLeaderboard({
    initialCategory: "miners",
    initialPeriod: "alltime",
    pageSize: 3,
    userAddress: wallet.wallet?.address,
  });

  // Game state
  const [evolutionData, setEvolutionData] = useState<{
    isOpen: boolean;
    fromStage: string;
    toStage: string;
    newLevel: number;
    stageName: string;
    miningBonus: number;
  } | null>(null);

  // Game event handler
  const handleGameEvent = useCallback((event: GameEvent) => {
    if (event.type === "evolved") {
      setEvolutionData({
        isOpen: true,
        fromStage: event.data.fromStage,
        toStage: event.data.toStage,
        newLevel: event.data.newLevel,
        stageName: event.data.stageName,
        miningBonus: event.data.miningBonus,
      });
    }
  }, []);

  // Game loop hook
  const game = useGameLoop({
    autoStart: true,
    onEvent: handleGameEvent,
  });

  // Baby state derived values
  const babyState = useBabyState(game.baby);

  // Achievements
  const achievements = useAchievements({
    gameState: game.state,
  });

  // Mining hook - uses global singleton (persistent across navigation)
  // CRITICAL: Keep this for XP tracking even though we don't show full mining UI
  const mining = useGlobalMining({
    difficulty: MIN_DIFFICULTY,
    minerAddress: "baby-miner-001",
  });

  // Track last processed shares/hashes to only award XP for NEW mining progress
  const lastProcessedSharesRef = useRef<number>(mining.shares);
  const lastProcessedHashesRef = useRef<number>(mining.totalHashes);
  const babyIdRef = useRef<string | null>(null);

  // Reset mining progress refs when baby changes
  useEffect(() => {
    const currentBabyId = game.baby?.id ?? null;

    if (currentBabyId !== babyIdRef.current) {
      const baseline = game.baby?.miningSharesBaseline ?? 0;
      lastProcessedSharesRef.current = Math.max(baseline, mining.shares);
      lastProcessedHashesRef.current = mining.totalHashes;
      babyIdRef.current = currentBabyId;
    }
  }, [
    game.baby?.id,
    game.baby?.miningSharesBaseline,
    mining.shares,
    mining.totalHashes,
  ]);

  // Sync mining state with game
  useEffect(() => {
    if (game.baby && !game.isDead) {
      game.setMining(mining.isRunning);
    }
  }, [mining.isRunning, game.baby, game.isDead, game.setMining]);

  // Record mining progress - ONLY for NEW shares/hashes
  useEffect(() => {
    if (!game.baby || game.isDead) {
      return;
    }

    const newShares = mining.shares - lastProcessedSharesRef.current;
    const newHashes = mining.totalHashes - lastProcessedHashesRef.current;

    if (newShares > 0 || newHashes > 0) {
      game.recordMiningProgress(
        newHashes > 0 ? newHashes : 0,
        newShares > 0 ? newShares : 0,
      );

      lastProcessedSharesRef.current = mining.shares;
      lastProcessedHashesRef.current = mining.totalHashes;
    }
  }, [
    mining.shares,
    mining.totalHashes,
    game.baby,
    game.isDead,
    game.recordMiningProgress,
  ]);

  // Handle actions
  const handleAction = (action: GameAction) => {
    if (action === "mine") {
      // Navigate to mining tab for full controls
      setActiveTab("mining");
    } else {
      game.performAction(action);
    }
  };

  // Navigation helpers
  const goToMining = useCallback(() => setActiveTab("mining"), [setActiveTab]);

  // Loading state
  if (game.isLoading) {
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
      {!game.baby ? (
        <div className="max-w-4xl mx-auto">
          <CreateBabyForm
            onCreate={game.createBaby}
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
            <div className="flex flex-col items-center">
              {/* Baby Card */}
              <div className="bg-pixel-bg-medium border-4 border-pixel-border p-8 shadow-[8px_8px_0_0_#000] w-full max-w-sm">
                {/* Name & Stage */}
                <div className="flex justify-between items-center mb-4">
                  <span className="font-pixel text-sm text-pixel-primary">
                    {game.baby.name}
                  </span>
                  <span className="font-pixel text-[10px] text-pixel-text-muted">
                    {babyState?.visualState.toUpperCase() || "IDLE"}
                  </span>
                </div>

                {/* Baby Sprite */}
                <div className="flex justify-center mb-6">
                  <LevelSprite
                    level={babyState?.level || 1}
                    state={babyState?.visualState || "idle"}
                    size={192}
                  />
                </div>

                {/* Stats HUD */}
                {babyState && (
                  <GameHUD
                    stats={{
                      energy: babyState.energy,
                      happiness: babyState.happiness,
                      hunger: babyState.hunger,
                      health: babyState.health,
                    }}
                    progression={{
                      level: babyState.level,
                      xp: babyState.xp,
                      xpToNextLevel: babyState.xpToNextLevel,
                      stageName: babyState.stageName,
                    }}
                    isMining={babyState.isMining}
                    miningBonus={babyState.miningBonus}
                    daysUntilDecay={game.daysUntilDecay ?? undefined}
                  />
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-4 w-full max-w-sm">
                <ActionButtons
                  onAction={handleAction}
                  isSleeping={babyState?.isSleeping}
                  isMining={mining.isRunning}
                  disabled={game.isDead}
                  energy={babyState?.energy}
                />
              </div>
            </div>

            {/* Right: Mining Status & Achievements */}
            <div className="space-y-6">
              {/* Mining Status Badge - Click to go to Mining tab */}
              <MiningStatusBadge
                isRunning={mining.isRunning}
                hashrate={mining.effectiveHashrate}
                shares={mining.shares}
                nftBoost={mining.nftBoost > 0 ? 1 + mining.nftBoost / 100 : 1}
                onClick={goToMining}
              />

              {/* Mini Leaderboard Widget */}
              <LeaderboardWidget
                entries={leaderboard.entries.map((e) => ({
                  address: e.address,
                  score: e.score,
                  rank: e.rank,
                  isCurrentUser: e.isCurrentUser,
                }))}
                category="miners"
                userRank={
                  leaderboard.userRank
                    ? {
                        rank: leaderboard.userRank,
                        score: leaderboard.userScore,
                      }
                    : null
                }
                isLoading={leaderboard.isLoading}
                onViewMore={() => router.push("/leaderboard")}
              />

              {/* Quick Tips */}
              <div className="bg-pixel-bg-medium border-4 border-pixel-border p-4 shadow-[8px_8px_0_0_#000]">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="font-pixel text-xs text-pixel-primary">
                    TIPS
                  </h3>
                  <HelpTooltip
                    content="Quick tips to help your baby grow faster and earn more rewards."
                    size="sm"
                  />
                </div>
                <div className="space-y-3 font-pixel-body text-sm text-pixel-text-muted">
                  <div className="flex items-start gap-2">
                    <span>💡</span>
                    <span>Keep your baby fed and happy to earn bonus XP</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>⛏️</span>
                    <span>Mining earns XP and $BABY tokens</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🌙</span>
                    <span>Mine daily to prevent level decay</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span>🎨</span>
                    <span>Get NFTs in the NFTs tab for mining boosts!</span>
                  </div>
                </div>
              </div>

              {/* Achievement Progress */}
              <div className="bg-pixel-bg-light border-4 border-pixel-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-pixel text-xs text-pixel-primary">
                    ACHIEVEMENTS
                  </h3>
                  <HelpTooltip
                    content="Complete goals to earn achievements and XP bonuses. Unlock all achievements to maximize your baby's potential."
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
                  onClick={() => setActiveTab("mining")}
                  variant="success"
                  size="sm"
                  className="w-full"
                >
                  MINING
                </Button>
                <Button
                  onClick={() => setActiveTab("nfts")}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  NFTs
                </Button>
              </div>
            </div>
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
      {evolutionData?.isOpen && (
        <EvolutionModal
          isOpen={evolutionData.isOpen}
          fromStage={evolutionData.fromStage}
          toStage={evolutionData.toStage}
          newLevel={evolutionData.newLevel}
          stageName={evolutionData.stageName}
          miningBonus={evolutionData.miningBonus}
          onComplete={() => setEvolutionData(null)}
        />
      )}

      {/* Death Modal */}
      <DeathModal
        isOpen={game.isDead}
        babyName={game.baby?.name || "Baby"}
        onRevive={game.revive}
      />
    </div>
  );
}

export default BabySection;
