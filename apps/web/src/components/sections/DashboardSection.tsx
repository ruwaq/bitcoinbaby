"use client";

/**
 * DashboardSection — Tamagotchi-style main screen
 *
 * The baby is the CENTER of the experience. Mining, stats, and actions
 * orbit around the baby sprite. Single scrollable view.
 *
 * Layout:
 *   [Baby Room Background]
 *     [Baby Sprite - large, centered]
 *     [Stats HUD - energy, happiness, hunger, health]
 *     [Action Buttons - FEED, PLAY, LEARN, SLEEP, MINE]
 *     [Mining Status - compact secondary info]
 *     [Narrative Panel - AI stories]
 */

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMining } from "@/hooks/features";
import { useBaby } from "@/hooks/features/useBaby";
import { useGlobalMining } from "@bitcoinbaby/core";
import type { GameBaby } from "@bitcoinbaby/core";
import { BabyDisplay } from "@/components/features/baby/BabyDisplay";
import { CreateBabyForm } from "@/components/features/baby/CreateBabyForm";
import {
  MiningVisualization,
  NotificationsPanel,
  SyncStatusAlert,
} from "@/components/features/mining";
import { NarrativePanel } from "@/components/features/mining/NarrativePanel";
import { useNarrativePipeline } from "@/hooks/useNarrativePipeline";
import { InfoBanner } from "@bitcoinbaby/ui";
import type { GameAction } from "@bitcoinbaby/ui";
import type { SparkNFTState } from "@bitcoinbaby/ai";

/**
 * Build a SparkNFTState from a GameBaby for the NarrativeEngine.
 *
 * When the user has a free baby (no NFT minted), we generate a deterministic
 * "virtual NFT state" from the baby's id. This gives the NarrativeEngine
 * enough context (personality, bloodline, archetype) to generate unique,
 * personalized stories even without an on-chain NFT.
 *
 * The dna is derived from the baby's id via a simple hash — same baby,
 * same personality forever. Different babies get different stories.
 */
function buildNftStateFromBaby(baby: GameBaby): SparkNFTState {
  // Deterministic "dna" from baby id — simple hash for personality seeding
  let hash = 0;
  for (let i = 0; i < baby.id.length; i++) {
    hash = (hash * 31 + baby.id.charCodeAt(i)) & 0xffffffff;
  }

  // Map hash to bloodline and baseType deterministically
  const bloodlines: SparkNFTState["bloodline"][] = [
    "royal",
    "warrior",
    "rogue",
    "mystic",
  ];
  const baseTypes: SparkNFTState["baseType"][] = [
    "human",
    "animal",
    "robot",
    "mystic",
    "alien",
  ];

  return {
    dna: baby.id,
    bloodline: bloodlines[hash % bloodlines.length],
    baseType: baseTypes[(hash >> 4) % baseTypes.length],
    genesisBlock: 0,
    rarityTier: "common",
    tokenId: Math.abs(hash) % 100000,
    level: baby.progression.level,
    xp: baby.progression.xp,
    totalXp: baby.progression.xp, // GameBaby doesn't track cumulative XP separately
    workCount: baby.progression.level * 10,
    lastWorkBlock: 0,
    evolutionCount: baby.evolutionHistory.length,
    tokensEarned: 0n,
    narrativeRoot: "",
    worldStateRoot: "",
  };
}

export function DashboardSection() {
  const router = useRouter();
  const { wallet, miner, controls, balance, shares, capabilities } =
    useMining();
  const {
    baby,
    babyState,
    isDead,
    daysUntilDecay,
    actions,
    achievements,
    mining,
  } = useBaby({ autoStart: true });
  const miningState = useGlobalMining();
  const isMining = miningState.isRunning;

  // Build NFT state from the real baby so NarrativeEngine has context
  // (personality, bloodline, archetype) to generate personalized stories
  const nftState = useMemo<SparkNFTState | null>(() => {
    if (!baby) return null;
    return buildNftStateFromBaby(baby);
  }, [baby]);

  const narrative = useNarrativePipeline({ nftState });

  const handleAction = useCallback(
    (action: GameAction) => {
      actions.performAction(action);
    },
    [actions],
  );

  const handleCreateBaby = useCallback(
    (name: string, miningSharesBaseline?: number) => {
      actions.createBaby(name, miningSharesBaseline ?? mining.shares);
    },
    [actions, mining.shares],
  );

  // ---- No wallet ----
  if (!wallet) {
    return (
      <div className="min-h-screen-safe bg-pixel-bg-dark flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-6 animate-pixel-float">👶</div>
        <h1 className="font-pixel text-pixel-lg text-pixel-primary text-center mb-4">
          Welcome to BitcoinBaby
        </h1>
        <p className="font-pixel-body text-body-sm text-pixel-text-muted text-center mb-8 max-w-sm">
          Raise your AI-powered pixel baby while mining Bitcoin. Create a wallet
          to begin!
        </p>
        <button
          onClick={() => router.push("/?tab=wallet", { scroll: false })}
          className="px-8 py-4 font-pixel text-pixel-xs bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          CREATE WALLET
        </button>
      </div>
    );
  }

  // ---- No baby yet ----
  if (!baby) {
    return (
      <div className="min-h-screen-safe bg-pixel-bg-dark p-4">
        <div className="max-w-md mx-auto space-y-6">
          <div className="text-center">
            <div className="text-5xl mb-4 animate-pixel-float">👶</div>
            <h2 className="font-pixel text-pixel-sm text-pixel-primary mb-2">
              Create Your Baby
            </h2>
            <p className="font-pixel-body text-body-xs text-pixel-text-muted">
              Your AI-powered companion — FREE!
            </p>
          </div>
          <CreateBabyForm
            onCreate={handleCreateBaby}
            currentMiningShares={mining.shares}
            onGoToMining={() => {}}
          />
          {wallet && (
            <div className="pt-4 border-t-2 border-pixel-border">
              <MiningVisualization
                isRunning={miner.isRunning}
                isPaused={miner.isPaused}
                disabled={false}
                hashrate={miner.displayHashrate}
                effectiveHashrate={miner.displayEffectiveHashrate}
                nftBoost={miner.nftBoost}
                minerType={miner.minerType}
                webgpuAvailable={capabilities?.webgpu}
                aiStatus={miner.aiStatus}
                onStart={controls.start}
                onStop={controls.stop}
                onPause={controls.pause}
                onResume={controls.resume}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---- Full Tamagotchi Dashboard ----
  return (
    <div className="min-h-screen-safe bg-pixel-bg-dark">
      {/* Baby Room: wall + floor background */}
      <div className="relative px-4 pt-4 pb-2">
        <div className="absolute inset-0 top-0 bottom-1/2 bg-[#1a1a2e]" />
        <div className="absolute inset-0 top-1/2 bottom-0 bg-[#2d2818] border-t-4 border-[#5c3d2e]" />

        <div className="relative z-10 flex flex-col items-center">
          {/* Sync alerts */}
          {wallet && (
            <div className="w-full max-w-sm mb-3">
              <SyncStatusAlert
                getSyncState={shares.getSyncState}
                pendingShares={shares.pending}
                failedShares={shares.failed}
                onForceSync={shares.resetAndSync}
              />
            </div>
          )}

          {/* Baby — the centerpiece */}
          <BabyDisplay
            name={baby.name || "Baby"}
            babyState={babyState}
            daysUntilDecay={daysUntilDecay ?? undefined}
            isMining={isMining}
            isDead={isDead}
            onAction={handleAction}
          />

          {/* Quick Stats */}
          <div className="flex gap-3 mt-3 mb-4">
            <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                SHARES
              </p>
              <p className="font-pixel text-pixel-xs text-pixel-primary">
                {mining.shares}
              </p>
            </div>
            <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                ACHIEVE
              </p>
              <p className="font-pixel text-pixel-xs text-pixel-secondary">
                {achievements.unlockedAchievements.length}/
                {achievements.totalAchievements}
              </p>
            </div>
            <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                BALANCE
              </p>
              <p className="font-pixel text-pixel-xs text-pixel-primary">
                {balance.virtual || "0"}
              </p>
            </div>
          </div>

          {/* Dead baby */}
          {isDead && (
            <div className="w-full max-w-sm bg-pixel-error/20 border-4 border-pixel-error p-4 text-center mb-4">
              <p className="font-pixel text-xs text-pixel-error mb-2">
                BABY NEEDS REVIVAL
              </p>
              <button
                onClick={actions.revive}
                className="px-6 py-2 font-pixel text-[10px] bg-pixel-primary text-black border-2 border-black"
              >
                REVIVE BABY
              </button>
            </div>
          )}

          {/* Decay warning */}
          {!isDead &&
            daysUntilDecay !== null &&
            daysUntilDecay !== undefined &&
            daysUntilDecay <= 3 && (
              <div className="w-full max-w-sm mb-4">
                <InfoBanner variant="warning" icon="⚠️">
                  <p className="font-pixel text-pixel-2xs uppercase">
                    Baby needs care in {daysUntilDecay} day
                    {daysUntilDecay === 1 ? "" : "s"}!
                  </p>
                </InfoBanner>
              </div>
            )}
        </div>
      </div>

      {/* Mining — secondary, below the baby room */}
      <div className="relative z-10 px-4 pb-4 space-y-3">
        <div className="max-w-sm mx-auto space-y-3">
          <MiningVisualization
            isRunning={miner.isRunning}
            isPaused={miner.isPaused}
            disabled={false}
            hashrate={miner.displayHashrate}
            effectiveHashrate={miner.displayEffectiveHashrate}
            nftBoost={miner.nftBoost}
            minerType={miner.minerType}
            webgpuAvailable={capabilities?.webgpu}
            aiStatus={miner.aiStatus}
            onStart={controls.start}
            onStop={controls.stop}
            onPause={controls.pause}
            onResume={controls.resume}
          />
          <NotificationsPanel notifications={shares.displayNotifications} />
        </div>
      </div>

      {/* Narrative */}
      <div className="relative z-10 px-4 pb-24">
        <div className="max-w-sm mx-auto">
          <NarrativePanel
            tokenId={nftState?.tokenId ?? null}
            latestEvent={narrative.latestEvent}
          />
        </div>
      </div>
    </div>
  );
}

export default DashboardSection;
