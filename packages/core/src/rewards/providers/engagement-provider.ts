/**
 * EngagementBonusProvider - User engagement rewards
 *
 * Rewards active users who care for their baby and play daily.
 * Max +3% bonus.
 *
 * Components:
 * - Baby Care: +1.5% (if health average >= 70)
 * - Daily Streak: +1% (7+ consecutive days)
 * - Play Time: +0.5% (30+ minutes today)
 */

import type {
  IBonusProvider,
  BonusCalculationContext,
  BonusProviderResult,
  BonusStatus,
  BonusCombineMode,
} from "../bonus-engine";

// =============================================================================
// CONSTANTS
// =============================================================================

const ENGAGEMENT_CONFIG = {
  babyCareBonus: 1.5, // +1.5%
  babyCareThreshold: 70, // Health average needed
  babyCarePartialThreshold: 50, // For partial bonus

  dailyStreakBonus: 1.0, // +1%
  dailyStreakDays: 7, // Days for full bonus

  playTimeBonus: 0.5, // +0.5%
  playTimeMinutes: 30, // Minutes for full bonus
  playTimeMinimum: 10, // Minimum for any bonus

  maxBonus: 3.0, // +3% max total
};

// =============================================================================
// CONFIGURATION
// =============================================================================

interface EngagementProviderConfig {
  /** Whether engagement bonus is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: EngagementProviderConfig = {
  enabled: true, // Server-side tracking active
};

// =============================================================================
// PROVIDER
// =============================================================================

export class EngagementBonusProvider implements IBonusProvider {
  readonly name = "engagement";
  readonly priority = 3;
  readonly combineMode: BonusCombineMode = "additive";
  readonly maxMultiplier = 1.03; // Max 3% boost
  readonly minMultiplier = 1.0;

  private config: EngagementProviderConfig;

  constructor(config: Partial<EngagementProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculate(context: BonusCalculationContext): BonusProviderResult {
    const engagement = context.engagement;

    if (!engagement) {
      return this.createEmptyResult();
    }

    // Calculate each component
    const babyCareBonus = this.calculateBabyCareBonus(
      engagement.babyHealthScore,
    );
    const streakBonus = this.calculateDailyStreakBonus(engagement.dailyStreak);
    const playTimeBonus = this.calculatePlayTimeBonus(
      engagement.playTimeMinutes,
    );

    // Sum and cap
    const totalBonus = Math.min(
      babyCareBonus + streakBonus + playTimeBonus,
      ENGAGEMENT_CONFIG.maxBonus,
    );

    const multiplier = 1 + totalBonus / 100;
    const percentage = totalBonus;

    // Determine tier
    const tier = this.determineTier(totalBonus);

    return {
      name: this.name,
      multiplier,
      percentage,
      status: this.getStatus(),
      metadata: {
        label: `+${totalBonus.toFixed(1)}%`,
        description: "Baby care + daily streak + play time",
        details: {
          babyCare: {
            bonus: babyCareBonus,
            max: ENGAGEMENT_CONFIG.babyCareBonus,
            healthScore: engagement.babyHealthScore,
          },
          dailyStreak: {
            bonus: streakBonus,
            max: ENGAGEMENT_CONFIG.dailyStreakBonus,
            days: engagement.dailyStreak,
          },
          playTime: {
            bonus: playTimeBonus,
            max: ENGAGEMENT_CONFIG.playTimeBonus,
            minutes: engagement.playTimeMinutes,
          },
          tier,
          totalBonus,
          maxBonus: ENGAGEMENT_CONFIG.maxBonus,
        },
      },
    };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  getStatus(): BonusStatus {
    if (!this.config.enabled) {
      return "coming_soon";
    }
    return "active";
  }

  // =============================================================================
  // COMPONENT CALCULATIONS
  // =============================================================================

  private calculateBabyCareBonus(healthScore: number): number {
    if (healthScore >= ENGAGEMENT_CONFIG.babyCareThreshold) {
      return ENGAGEMENT_CONFIG.babyCareBonus;
    }
    if (healthScore >= ENGAGEMENT_CONFIG.babyCarePartialThreshold) {
      return ENGAGEMENT_CONFIG.babyCareBonus * 0.5;
    }
    return 0;
  }

  private calculateDailyStreakBonus(days: number): number {
    if (days >= ENGAGEMENT_CONFIG.dailyStreakDays) {
      return ENGAGEMENT_CONFIG.dailyStreakBonus;
    }
    // Linear ramp up to 7 days
    return (
      (days / ENGAGEMENT_CONFIG.dailyStreakDays) *
      ENGAGEMENT_CONFIG.dailyStreakBonus
    );
  }

  private calculatePlayTimeBonus(minutes: number): number {
    if (minutes < ENGAGEMENT_CONFIG.playTimeMinimum) {
      return 0;
    }
    if (minutes >= ENGAGEMENT_CONFIG.playTimeMinutes) {
      return ENGAGEMENT_CONFIG.playTimeBonus;
    }
    // Linear ramp from minimum to full
    const range =
      ENGAGEMENT_CONFIG.playTimeMinutes - ENGAGEMENT_CONFIG.playTimeMinimum;
    const progress = minutes - ENGAGEMENT_CONFIG.playTimeMinimum;
    return (progress / range) * ENGAGEMENT_CONFIG.playTimeBonus;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private determineTier(bonus: number): string {
    if (bonus >= 2.5) return "dedicated";
    if (bonus >= 1.5) return "engaged";
    if (bonus >= 0.5) return "casual";
    return "inactive";
  }

  private createEmptyResult(): BonusProviderResult {
    return {
      name: this.name,
      multiplier: 1.0,
      percentage: 0,
      status: this.getStatus(),
      metadata: {
        label: "0%",
        description: "Care for your baby and play daily (max +3%)",
        details: {
          tier: "inactive",
          totalBonus: 0,
          maxBonus: ENGAGEMENT_CONFIG.maxBonus,
        },
      },
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createEngagementProvider(
  config?: Partial<EngagementProviderConfig>,
): EngagementBonusProvider {
  return new EngagementBonusProvider(config);
}

export default EngagementBonusProvider;
