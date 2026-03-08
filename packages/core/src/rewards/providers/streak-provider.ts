/**
 * StreakBonusProvider - Mining streak bonus
 *
 * Rewards continuous mining with increasing multipliers.
 * Max 2.0x at 500+ consecutive shares.
 *
 * Tiers:
 * - 0-9 shares: 1.0x
 * - 10-49 shares: 1.2x
 * - 50-99 shares: 1.5x
 * - 100-249 shares: 1.75x
 * - 250-499 shares: 1.9x
 * - 500+ shares: 2.0x
 */

import type {
  IBonusProvider,
  BonusCalculationContext,
  BonusProviderResult,
  BonusStatus,
  BonusCombineMode,
} from "../bonus-engine";
import {
  STREAK_BONUSES,
  getStreakMultiplier,
} from "../../tokenomics/constants";

// =============================================================================
// CONFIGURATION
// =============================================================================

interface StreakProviderConfig {
  /** Whether streak bonus is enabled */
  enabled: boolean;
  /** Time in ms before streak resets (default: 30 minutes) */
  resetTimeMs: number;
}

const DEFAULT_CONFIG: StreakProviderConfig = {
  enabled: true,
  resetTimeMs: STREAK_BONUSES.resetTimeMs,
};

// =============================================================================
// PROVIDER
// =============================================================================

export class StreakBonusProvider implements IBonusProvider {
  readonly name = "streak";
  readonly priority = 1; // First to apply
  readonly combineMode: BonusCombineMode = "multiplicative";
  readonly maxMultiplier = 2.0;
  readonly minMultiplier = 1.0;

  private config: StreakProviderConfig;

  constructor(config: Partial<StreakProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculate(context: BonusCalculationContext): BonusProviderResult {
    const shares = context.consecutiveShares ?? 0;
    const multiplier = getStreakMultiplier(shares);
    const percentage = (multiplier - 1) * 100;

    // Find current tier and next tier
    const currentTierIndex = this.findCurrentTier(shares);
    const nextTier = this.getNextTier(currentTierIndex);
    const progress = this.calculateProgress(shares, currentTierIndex);

    return {
      name: this.name,
      multiplier,
      percentage,
      status: this.getStatus(),
      metadata: {
        label: `${multiplier.toFixed(1)}x`,
        description: `Mine continuously to build streak (max 2.0x at 500+ shares)`,
        details: {
          shares,
          currentTier: currentTierIndex,
          nextTierAt: nextTier,
          progress,
          tiers: STREAK_BONUSES.tiers,
          multipliers: STREAK_BONUSES.multipliers,
        },
      },
    };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getStatus(): BonusStatus {
    return this.config.enabled ? "active" : "disabled";
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private findCurrentTier(shares: number): number {
    const tiers = STREAK_BONUSES.tiers;
    for (let i = tiers.length - 1; i >= 0; i--) {
      if (shares >= tiers[i]) {
        return i + 1;
      }
    }
    return 0;
  }

  private getNextTier(currentTierIndex: number): number {
    const tiers = STREAK_BONUSES.tiers;
    if (currentTierIndex >= tiers.length) {
      return tiers[tiers.length - 1]; // Already at max
    }
    return tiers[currentTierIndex];
  }

  private calculateProgress(shares: number, currentTierIndex: number): number {
    const tiers = STREAK_BONUSES.tiers;

    if (currentTierIndex >= tiers.length) {
      return 100; // Max tier reached
    }

    const currentThreshold =
      currentTierIndex > 0 ? tiers[currentTierIndex - 1] : 0;
    const nextThreshold = tiers[currentTierIndex];
    const range = nextThreshold - currentThreshold;

    if (range === 0) return 100;

    return Math.min(100, ((shares - currentThreshold) / range) * 100);
  }

  /**
   * Check if streak should reset based on time
   */
  shouldReset(lastShareTime: number | undefined): boolean {
    if (!lastShareTime) return true;
    return Date.now() - lastShareTime > this.config.resetTimeMs;
  }

  /**
   * Get time remaining before streak resets
   */
  getTimeToReset(lastShareTime: number | undefined): number {
    if (!lastShareTime) return 0;
    const elapsed = Date.now() - lastShareTime;
    return Math.max(0, this.config.resetTimeMs - elapsed);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createStreakProvider(
  config?: Partial<StreakProviderConfig>,
): StreakBonusProvider {
  return new StreakBonusProvider(config);
}

export default StreakBonusProvider;
