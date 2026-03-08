/**
 * useBonusEngine - React hook for bonus calculations
 *
 * Provides access to the bonus engine with automatic context from stores.
 *
 * @example
 * ```typescript
 * const { result, breakdown, calculate } = useBonusEngine();
 *
 * // Get current bonuses
 * console.log(result.totalMultiplier); // 1.85
 * console.log(breakdown.streak.percentage); // 50%
 *
 * // Recalculate with custom context
 * calculate({ consecutiveShares: 100 });
 * ```
 */

"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
  getBonusEngine,
  type BonusCalculationContext,
  type BonusCalculationResult,
} from "./bonus-engine";
import {
  createStreakProvider,
  createNFTProvider,
  createEngagementProvider,
  createCosmicProvider,
} from "./providers";
import { useNFTStore } from "../stores/nft-store";
import { useMiningStore } from "../stores/mining-store";
import { BASE_REWARD_PER_SHARE } from "../tokenomics/constants";
import { getMiningBoost } from "@bitcoinbaby/bitcoin";

// =============================================================================
// INITIALIZATION
// =============================================================================

let isInitialized = false;

/**
 * Initialize the bonus engine with all providers
 * Call this once at app startup
 */
export function initializeBonusEngine(options?: {
  enableNFT?: boolean;
  enableEngagement?: boolean;
  enableCosmic?: boolean;
}): void {
  if (isInitialized) return;

  const engine = getBonusEngine();

  // Register all providers
  engine.register(createStreakProvider({ enabled: true }));
  engine.register(createNFTProvider({ enabled: options?.enableNFT ?? true }));
  engine.register(
    createEngagementProvider({ enabled: options?.enableEngagement ?? true }),
  );
  engine.register(
    createCosmicProvider({ enabled: options?.enableCosmic ?? true }),
  );

  isInitialized = true;
  console.log(
    "[BonusEngine] Initialized with providers:",
    engine.listProviders(),
  );
}

// =============================================================================
// HOOK
// =============================================================================

interface UseBonusEngineReturn {
  /** Latest calculation result */
  result: BonusCalculationResult | null;
  /** Breakdown by provider */
  breakdown: BonusCalculationResult["breakdown"];
  /** Total multiplier */
  totalMultiplier: number;
  /** Total percentage bonus */
  totalPercentage: number;
  /** Calculate bonuses with given context */
  calculate: (
    context: Partial<BonusCalculationContext>,
  ) => BonusCalculationResult;
  /** List of active providers */
  activeProviders: string[];
  /** Provider statuses */
  providerStatus: Record<string, string>;
  /** Is engine initialized */
  isReady: boolean;
}

/**
 * Hook to use the bonus engine in React components
 */
export function useBonusEngine(): UseBonusEngineReturn {
  const [result, setResult] = useState<BonusCalculationResult | null>(null);

  // Get data from stores
  const nfts = useNFTStore((s) => s.ownedNFTs);
  const miningStats = useMiningStore((s) => s.stats);

  // Initialize engine if not done
  useEffect(() => {
    if (!isInitialized) {
      initializeBonusEngine();
    }
  }, []);

  // Build context from stores
  const buildContext = useCallback(
    (overrides?: Partial<BonusCalculationContext>): BonusCalculationContext => {
      return {
        difficulty: miningStats?.difficulty || 22,
        hashrate: miningStats?.hashrate || 0,
        baseReward: BASE_REWARD_PER_SHARE,
        consecutiveShares: 0, // Tracked server-side in VirtualBalance
        nfts: nfts.map((nft) => ({
          level: nft.level,
          rarityTier: nft.rarityTier,
          boost: getMiningBoost(nft),
        })),
        ...overrides,
      };
    },
    [miningStats, nfts],
  );

  // Calculate function
  const calculate = useCallback(
    (overrides?: Partial<BonusCalculationContext>): BonusCalculationResult => {
      const engine = getBonusEngine();
      const context = buildContext(overrides);
      const calcResult = engine.calculate(context);
      setResult(calcResult);
      return calcResult;
    },
    [buildContext],
  );

  // Auto-calculate on store changes
  useEffect(() => {
    if (isInitialized) {
      calculate();
    }
  }, [calculate]);

  // Memoized values
  const breakdown = useMemo(() => result?.breakdown ?? {}, [result]);
  const totalMultiplier = useMemo(
    () => result?.totalMultiplier ?? 1.0,
    [result],
  );
  const totalPercentage = useMemo(() => result?.totalPercentage ?? 0, [result]);
  const activeProviders = useMemo(
    () => result?.activeProviders ?? [],
    [result],
  );

  const providerStatus = useMemo(() => {
    const engine = getBonusEngine();
    return engine.getStatus();
  }, []);

  return {
    result,
    breakdown,
    totalMultiplier,
    totalPercentage,
    calculate,
    activeProviders,
    providerStatus,
    isReady: isInitialized,
  };
}

export default useBonusEngine;
