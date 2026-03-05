"use client";

/**
 * MiningSection - Full mining dashboard
 *
 * THE single source of truth for all mining operations:
 * - Mining visualization and controls
 * - Balance tracking (virtual + on-chain)
 * - NFT boost display
 * - Device capabilities
 * - Share submission and notifications
 */

import { WithdrawButton } from "@/components/withdraw";
import {
  MiningStatsGrid,
  NFTBoostPanel,
  EngagementBonusPanel,
  RewardsBreakdownPanel,
  SectionHeader,
  InfoBanner,
  pixelBorders,
} from "@bitcoinbaby/ui";
import { useMining } from "@/hooks/features";
import {
  BalancePanel,
  MiningVisualization,
  DeviceCapabilities,
  NotificationsPanel,
  SyncStatusAlert,
  RewardInfoPanel,
} from "@/components/features/mining";

export function MiningSection() {
  const {
    wallet,
    miner,
    controls,
    balance,
    shares,
    nft,
    engagement,
    capabilities,
    recentReward,
  } = useMining();

  return (
    <div className="p-responsive safe-x bg-pixel-bg-dark min-h-screen-safe">
      <div className="max-w-4xl mx-auto">
        {/* Section Header */}
        <SectionHeader
          title="Mining"
          description="Earn $BABY tokens with Proof of Useful Work"
          icon="&#9935;"
          size="lg"
        />

        {/* PoUW Info Banner */}
        <InfoBanner variant="highlight" icon="&#129504;" className="mb-6">
          <h3 className="font-pixel text-pixel-xs text-pixel-primary uppercase mb-1">
            Proof of Useful Work
          </h3>
          <p className="font-pixel-body text-sm text-pixel-text leading-relaxed">
            Your computing power is not wasted on meaningless algorithms. We are
            building a system where mining energy{" "}
            <span className="text-pixel-secondary font-semibold">
              trains artificial intelligence
            </span>
            . Every hash contributes to a collective AI model.
          </p>
          <p className="font-pixel text-pixel-2xs text-pixel-text-muted mt-2">
            Current phase: Traditional mining | Next phase: AI Training
          </p>
        </InfoBanner>

        {/* Connection Warning */}
        {!wallet && (
          <InfoBanner variant="warning" icon="&#128274;" className="mb-6">
            <p className="font-pixel text-pixel-xs uppercase mb-1">
              Wallet Not Connected
            </p>
            <p className="font-pixel-body text-sm text-pixel-text-muted">
              Connect your wallet to start earning $BABY tokens.{" "}
              <span className="text-pixel-primary">
                Go to Wallet tab to connect.
              </span>
            </p>
          </InfoBanner>
        )}

        {/* Virtual Balance Error Alert */}
        {balance.error && (
          <InfoBanner variant="error" icon="&#9888;" className="mb-4">
            <p className="font-pixel text-pixel-xs uppercase">
              Balance Sync Error
            </p>
            <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
              {balance.error}. Mining rewards are still being tracked locally.
            </p>
          </InfoBanner>
        )}

        {/* Workers API Warning */}
        {wallet && !balance.workersApiAvailable && !balance.isLoading && (
          <InfoBanner variant="warning" icon="&#9888;" className="mb-4">
            <p className="font-pixel text-pixel-xs uppercase">Offline Mode</p>
            <p className="font-pixel-body text-xs text-pixel-text-muted mt-1">
              Cannot connect to balance server. Mining locally only.
            </p>
          </InfoBanner>
        )}

        {/* Sync Status Alert - Circuit Breaker, Failed Shares, etc. */}
        {wallet && (
          <SyncStatusAlert
            getSyncState={shares.getSyncState}
            pendingShares={shares.pending}
            failedShares={shares.failed}
            onForceSync={shares.resetAndSync}
          />
        )}

        {/* Balance Panel */}
        {wallet && (
          <BalancePanel
            virtualBalance={balance.virtual}
            virtualBalanceLoading={balance.isLoading}
            virtualBalanceError={balance.error}
            totalMined={balance.totalMined}
            onChainBalance={balance.onChain}
            sessionShares={shares.session}
            submittedShares={shares.submitted}
            pendingShares={shares.pending}
            failedShares={shares.failed}
            isSubmitting={shares.isSubmitting}
            getSyncState={shares.getSyncState}
            onForceSync={shares.resetAndSync}
            recentReward={recentReward}
          />
        )}

        {/* Withdraw Button - Shows when user has virtual balance */}
        {wallet && balance.virtual > 0n && (
          <div className="mb-6 flex justify-center">
            <WithdrawButton
              virtualBalance={balance.virtual}
              isLoading={balance.isLoading}
              size="md"
              showBalance={true}
            />
          </div>
        )}

        {/* Recent Notifications */}
        <NotificationsPanel notifications={shares.displayNotifications} />

        {/* Mining Visualization */}
        <MiningVisualization
          isRunning={miner.isRunning}
          isPaused={miner.isPaused}
          disabled={!wallet}
          hashrate={miner.displayHashrate}
          effectiveHashrate={miner.displayEffectiveHashrate}
          nftBoost={miner.nftBoost}
          minerType={miner.minerType}
          webgpuAvailable={capabilities?.webgpu}
          onStart={controls.start}
          onStop={controls.stop}
          onPause={controls.pause}
          onResume={controls.resume}
        />

        {/* Stats Grid */}
        <div className="mb-6">
          <MiningStatsGrid
            stats={{
              uptime: miner.uptime,
              totalHashes: miner.displayHashes,
              shares: miner.displayShares,
              difficulty: miner.difficulty,
              hashrate: miner.displayEffectiveHashrate,
              minerType:
                miner.minerType === "webgpu"
                  ? "WebGPU"
                  : `CPU (${capabilities?.cores || "?"} cores)`,
            }}
            variant="grid"
            className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4`}
          />
        </div>

        {/* Reward Info Panel - Shows reward tiers by difficulty */}
        <div className="mb-6">
          <RewardInfoPanel
            currentDifficulty={miner.difficulty}
            defaultExpanded={false}
          />
        </div>

        {/* NFT Boost Panel - COMING SOON (not yet applied server-side) */}
        <div className="mb-6">
          <NFTBoostPanel
            bestBoost={nft.bestBoost}
            stackedBoost={nft.stackedBoost}
            totalNFTs={nft.totalNFTs}
            variant="panel"
            isActive={false} // TODO: Enable when server-side NFT validation ready
          />
        </div>

        {/* Engagement Bonus Panel - COMING SOON (not yet tracked server-side) */}
        <div className="mb-6">
          <EngagementBonusPanel
            multiplier={engagement.multiplier}
            breakdown={engagement.breakdown}
            status={engagement.status}
            streakDays={engagement.state.dailyStreak}
            playTimeMinutes={engagement.state.playTimeToday}
            babyHealth={engagement.state.babyHealthScore}
            isActive={false} // TODO: Enable when server-side engagement tracking ready
          />
        </div>

        {/* Rewards Breakdown - Complete overview of all multipliers */}
        <div className="mb-6">
          <RewardsBreakdownPanel
            baseReward={10}
            streakMultiplier={miner.boostMultiplier}
            streakCount={shares.session}
            nftBoostPercent={nft.stackedBoost}
            nftCount={nft.totalNFTs}
            engagementMultiplier={engagement.multiplier}
            cosmicMultiplier={1.0} // TODO: Get from cosmic hook when ready
            cosmicStatus="normal"
          />
        </div>

        {/* Device Capabilities */}
        {capabilities && (
          <DeviceCapabilities
            capabilities={capabilities}
            canSubmitToBlockchain={shares.canSubmitToBlockchain}
          />
        )}
      </div>
    </div>
  );
}

export default MiningSection;
