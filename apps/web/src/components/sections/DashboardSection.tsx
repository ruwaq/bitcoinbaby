"use client";

/**
 * DashboardSection — Mining + Narrative main screen.
 *
 * World Mode (no NFT): AI generates world lore, rules, factions.
 * Baby Mode (with NFT): AI generates stories about the NFT baby.
 *
 * Layout:
 *   [Mining Visualization]
 *   [Notifications]
 *   [Narrative Panel — AI stories as speech bubbles]
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMining } from "@/hooks/features";
import { useGlobalMining } from "@bitcoinbaby/core";
import {
  MiningVisualization,
  NotificationsPanel,
  SyncStatusAlert,
} from "@/components/features/mining";
import { NarrativePanel } from "@/components/features/mining/NarrativePanel";
import { useNarrativePipeline } from "@/hooks/useNarrativePipeline";

export function DashboardSection() {
  const router = useRouter();
  const narrative = useNarrativePipeline({ nftState: null });

  const { wallet, miner, controls, balance, shares, capabilities } = useMining({
    onAIProof: narrative.handleAIProof,
  });
  const miningState = useGlobalMining();
  const isMining = miningState.isRunning;

  // ---- No wallet ----
  if (!wallet) {
    return (
      <div className="min-h-screen-safe bg-pixel-bg-dark flex flex-col items-center justify-center p-4">
        <div className="text-6xl mb-6 animate-pixel-float">⛏️</div>
        <h1 className="font-pixel text-pixel-lg text-pixel-primary text-center mb-4">
          Start Mining
        </h1>
        <p className="font-pixel-body text-body-sm text-pixel-text-muted text-center mb-8 max-w-sm">
          Mine with AI to generate stories and earn $SPARK. Create a wallet to
          begin!
        </p>
        <button
          onClick={() => router.push("/?tab=you", { scroll: false })}
          className="px-8 py-4 font-pixel text-pixel-xs bg-pixel-primary text-black border-4 border-black shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none"
        >
          CREATE WALLET
        </button>
      </div>
    );
  }

  // ---- Dashboard ----
  return (
    <div className="min-h-screen-safe bg-pixel-bg-dark">
      <div className="px-4 pt-4 pb-2">
        <div className="max-w-sm mx-auto space-y-3">
          {/* Sync alerts */}
          <SyncStatusAlert
            getSyncState={shares.getSyncState}
            pendingShares={shares.pending}
            failedShares={shares.failed}
            onForceSync={shares.resetAndSync}
          />

          {/* Mining — main interaction */}
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

      {/* Quick Stats */}
      <div className="flex justify-center gap-3 px-4 mb-4">
        <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
          <p className="font-pixel text-[7px] text-pixel-text-muted">SHARES</p>
          <p className="font-pixel text-pixel-xs text-pixel-primary">
            {shares.session}
          </p>
        </div>
        <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
          <p className="font-pixel text-[7px] text-pixel-text-muted">
            SUBMITTED
          </p>
          <p className="font-pixel text-pixel-xs text-pixel-secondary">
            {shares.submitted}
          </p>
        </div>
        <div className="bg-pixel-bg-dark border-2 border-pixel-border px-3 py-1 text-center">
          <p className="font-pixel text-[7px] text-pixel-text-muted">BALANCE</p>
          <p className="font-pixel text-pixel-xs text-pixel-primary">
            {balance.virtual || "0"}
          </p>
        </div>
      </div>

      {/* Narrative Panel — AI stories */}
      <div className="px-4 pb-24">
        <div className="max-w-sm mx-auto">
          <NarrativePanel tokenId={null} latestEvent={narrative.latestEvent} />
        </div>
      </div>
    </div>
  );
}

export default DashboardSection;
