import { useState, useEffect, useMemo, useRef } from "react";
import { useMiningWithNFTs, useVirtualBalance } from "@/hooks";
import { useMiningShareSubmission } from "@/hooks/useMiningShareSubmission";
import {
  useWalletStore,
  useNFTStore,
  useNetworkStore,
  MIN_DIFFICULTY,
  useEngagement,
  useThrottledValue,
  useBonusEngine,
  type WalletInfo,
} from "@bitcoinbaby/core";

/**
 * useMining - Unified hook for mining dashboard
 *
 * Combines:
 * - Mining state and controls
 * - Virtual balance tracking
 * - Share submission
 * - NFT boost
 * - Engagement bonuses
 * - Device capabilities
 *
 * @example
 * const { miner, balance, shares, engagement, capabilities } = useMining();
 */

export interface UseMiningOptions {
  /** Auto-start mining on mount */
  autoStart?: boolean;
  /** Throttle interval for display values (ms) */
  throttleMs?: number;
}

export interface UseMiningReturn {
  // Wallet
  wallet: WalletInfo | null;

  // Mining state
  miner: {
    isRunning: boolean;
    isPaused: boolean;
    hashrate: number;
    effectiveHashrate: number;
    displayHashrate: number;
    displayEffectiveHashrate: number;
    totalHashes: number;
    displayHashes: number;
    shares: number;
    displayShares: number;
    difficulty: number;
    minerType: "cpu" | "webgpu";
    nftBoost: number;
    boostMultiplier: number;
    uptime: number;
  };

  // Mining controls
  controls: {
    start: () => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
  };

  // Balance
  balance: {
    virtual: bigint;
    totalMined: bigint;
    onChain: bigint;
    isLoading: boolean;
    error: string | null;
    workersApiAvailable: boolean;
  };

  // Share submission
  shares: {
    session: number;
    submitted: number;
    pending: number;
    failed: number;
    isSubmitting: boolean;
    canSubmitToBlockchain: boolean;
    lastSubmission: ReturnType<
      typeof useMiningShareSubmission
    >["lastSubmission"];
    notifications: ReturnType<typeof useMiningShareSubmission>["notifications"];
    displayNotifications: ReturnType<
      typeof useMiningShareSubmission
    >["notifications"];
    getSyncState: ReturnType<typeof useMiningShareSubmission>["getSyncState"];
    resetAndSync: ReturnType<typeof useMiningShareSubmission>["resetAndSync"];
  };

  // NFT boost
  nft: {
    bestBoost: number;
    stackedBoost: number;
    totalNFTs: number;
  };

  // Engagement
  engagement: {
    multiplier: number;
    breakdown: ReturnType<typeof useEngagement>["multiplier"]["breakdown"];
    status: ReturnType<typeof useEngagement>["multiplier"]["status"];
    state: ReturnType<typeof useEngagement>["state"];
  };

  // Device capabilities
  capabilities: {
    webgpu: boolean;
    webgl: boolean;
    workers: boolean;
    cores: number;
  } | null;

  // Recent reward for animation
  recentReward: bigint | undefined;

  // Bonus engine (centralized calculations)
  bonuses: {
    totalMultiplier: number;
    totalPercentage: number;
    breakdown: Record<
      string,
      { percentage: number; multiplier: number; label: string; status: string }
    >;
    isReady: boolean;
  };
}

export function useMining(options: UseMiningOptions = {}): UseMiningReturn {
  const { autoStart = false, throttleMs = 500 } = options;

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const isLocked = useWalletStore((s) => s.isLocked);

  // Network - track changes to stop mining when network switches
  const network = useNetworkStore((s) => s.network);
  const previousNetworkRef = useRef(network);

  // NFT store
  const { bestBoost, stackedBoost, totalNFTs } = useNFTStore();

  // Uptime counter
  const [uptime, setUptime] = useState(0);

  // Virtual balance from Workers API
  const {
    virtualBalance,
    totalMined,
    onChainBalance,
    isLoading: virtualBalanceLoading,
    error: virtualBalanceError,
    workersApiAvailable,
  } = useVirtualBalance({
    address: wallet?.address,
  });

  // Mining with NFT boost
  const mining = useMiningWithNFTs({
    difficulty: MIN_DIFFICULTY,
    minerAddress: wallet?.address || "",
    autoStart,
  });

  // Unified share submission
  const shareSubmission = useMiningShareSubmission({
    strategy: "virtual-first",
  });

  // Engagement tracking
  const { multiplier: engagementResult, state: engagementState } =
    useEngagement();

  // Bonus engine (centralized calculations)
  const bonusEngine = useBonusEngine();

  // Throttle rapidly changing values for smoother UX
  const displayHashrate = useThrottledValue(mining.hashrate, throttleMs);
  const displayEffectiveHashrate = useThrottledValue(
    mining.effectiveHashrate,
    throttleMs,
  );
  const displayHashes = useThrottledValue(mining.totalHashes, throttleMs);
  const displayShares = useThrottledValue(mining.shares, throttleMs * 2);

  // Limit notifications to prevent layout shifts (max 2)
  const displayNotifications = useMemo(
    () => shareSubmission.notifications.slice(0, 2),
    [shareSubmission.notifications],
  );

  // Recent reward for animation
  const recentReward = shareSubmission.lastSubmission?.success
    ? shareSubmission.lastSubmission.credited
    : undefined;

  // Uptime counter
  useEffect(() => {
    if (!mining.isRunning) {
      const timeout = setTimeout(() => setUptime(0), 0);
      return () => clearTimeout(timeout);
    }

    if (!mining.isPaused) {
      const interval = setInterval(() => {
        setUptime((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [mining.isRunning, mining.isPaused]);

  // CRITICAL: Stop mining when wallet locks, disconnects, or network changes
  // This prevents mining to wrong address or submitting proofs on wrong network
  useEffect(() => {
    // Check if network changed
    if (previousNetworkRef.current !== network) {
      previousNetworkRef.current = network;
      if (mining.isRunning) {
        console.log("[useMining] Network changed, stopping mining for safety");
        mining.stop();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Using specific mining properties to avoid infinite loops
  }, [network, mining.isRunning, mining.stop]);

  // Stop mining when wallet locks or disconnects
  useEffect(() => {
    if ((isLocked || !wallet?.address) && mining.isRunning) {
      console.log("[useMining] Wallet locked or disconnected, stopping mining");
      mining.stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Using specific mining properties to avoid infinite loops
  }, [isLocked, wallet?.address, mining.isRunning, mining.stop]);

  return {
    wallet,

    miner: {
      isRunning: mining.isRunning,
      isPaused: mining.isPaused,
      hashrate: mining.hashrate,
      effectiveHashrate: mining.effectiveHashrate,
      displayHashrate,
      displayEffectiveHashrate,
      totalHashes: mining.totalHashes,
      displayHashes,
      shares: mining.shares,
      displayShares,
      difficulty: mining.difficulty,
      minerType: mining.minerType ?? "cpu",
      nftBoost: mining.nftBoost,
      boostMultiplier: mining.boostMultiplier,
      uptime,
    },

    controls: {
      start: () => mining.start(),
      stop: mining.stop,
      pause: mining.pause,
      resume: mining.resume,
    },

    balance: {
      virtual: virtualBalance,
      totalMined,
      onChain: onChainBalance,
      isLoading: virtualBalanceLoading,
      error: virtualBalanceError,
      workersApiAvailable,
    },

    shares: {
      session: shareSubmission.sessionShares,
      submitted: shareSubmission.submittedShares,
      pending: shareSubmission.pendingShares,
      failed: shareSubmission.failedShares,
      isSubmitting: shareSubmission.isSubmitting,
      canSubmitToBlockchain: shareSubmission.canSubmitToBlockchain,
      lastSubmission: shareSubmission.lastSubmission,
      notifications: shareSubmission.notifications,
      displayNotifications,
      getSyncState: shareSubmission.getSyncState,
      resetAndSync: shareSubmission.resetAndSync,
    },

    nft: {
      bestBoost,
      stackedBoost,
      totalNFTs,
    },

    engagement: {
      multiplier: engagementResult.multiplier,
      breakdown: engagementResult.breakdown,
      status: engagementResult.status,
      state: engagementState,
    },

    capabilities: mining.capabilities,

    recentReward,

    bonuses: {
      totalMultiplier: bonusEngine.totalMultiplier,
      totalPercentage: bonusEngine.totalPercentage,
      breakdown: Object.fromEntries(
        Object.entries(bonusEngine.breakdown).map(([key, value]) => [
          key,
          {
            percentage: value.percentage,
            multiplier: value.multiplier,
            label: value.metadata?.label ?? "",
            status: value.status,
          },
        ]),
      ),
      isReady: bonusEngine.isReady,
    },
  };
}

export default useMining;
