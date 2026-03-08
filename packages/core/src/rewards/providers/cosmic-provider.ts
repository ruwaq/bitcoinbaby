/**
 * CosmicBonusProvider - Cosmic energy effects
 *
 * Moon phases, seasons, and cosmic events affect mining rewards.
 * Range: 0.95x to 1.10x (-5% to +10%)
 *
 * Factors:
 * - Moon Phase: ±3% based on baby type
 * - Season: ±2% based on baby type
 * - Cosmic Events: Up to ±5% (eclipses, etc.)
 * - Day/Night: Small adjustments
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

const MOON_PHASE_EFFECTS: Record<string, Record<string, number>> = {
  new: { mystic: 3, alien: 1, human: 0, animal: -1, robot: 0 },
  waxing_crescent: { mystic: 2, alien: 1, human: 0.5, animal: 0, robot: 0 },
  first_quarter: { mystic: 1, alien: 0.5, human: 1, animal: 1, robot: 0 },
  waxing_gibbous: { mystic: 0.5, alien: 0, human: 1, animal: 2, robot: 0.5 },
  full: { mystic: 3, alien: 2, human: 1, animal: 3, robot: -1 },
  waning_gibbous: { mystic: 1, alien: 1, human: 0.5, animal: 2, robot: 0 },
  last_quarter: { mystic: 0.5, alien: 0.5, human: 0, animal: 1, robot: 0.5 },
  waning_crescent: { mystic: 2, alien: 1, human: -0.5, animal: 0, robot: 1 },
};

const SEASON_EFFECTS: Record<string, Record<string, number>> = {
  spring: { animal: 2, human: 1, mystic: 0.5, robot: 0, alien: -0.5 },
  summer: { human: 2, animal: 1, mystic: 0, robot: -1, alien: -1.5 },
  autumn: { mystic: 1.5, human: 0.5, animal: 0, robot: 1, alien: 0.5 },
  winter: { robot: 2, alien: 1, mystic: 0, human: -0.5, animal: -1 },
};

const COSMIC_EVENT_EFFECTS: Record<string, Record<string, number>> = {
  eclipse_lunar: { mystic: 5, alien: 3, human: 2, animal: 2, robot: -2 },
  eclipse_solar: { robot: 5, alien: 5, mystic: 2, human: -1, animal: -2 },
  solstice: { mystic: 2, human: 1, animal: 1, robot: 0, alien: 0 },
  equinox: { human: 2, alien: 1, mystic: 1, animal: 0, robot: 0 },
  meteor_shower: { alien: 3, mystic: 2, robot: 1, human: 0, animal: 0 },
};

// =============================================================================
// CONFIGURATION
// =============================================================================

interface CosmicProviderConfig {
  /** Whether cosmic effects are enabled */
  enabled: boolean;
  /** Maximum bonus percentage */
  maxBonus: number;
  /** Maximum penalty percentage */
  maxPenalty: number;
}

const DEFAULT_CONFIG: CosmicProviderConfig = {
  enabled: true, // Server-side calculation active
  maxBonus: 10, // +10% max
  maxPenalty: 5, // -5% max
};

// =============================================================================
// PROVIDER
// =============================================================================

export class CosmicBonusProvider implements IBonusProvider {
  readonly name = "cosmic";
  readonly priority = 4;
  readonly combineMode: BonusCombineMode = "multiplicative";
  readonly maxMultiplier = 1.1; // +10%
  readonly minMultiplier = 0.95; // -5%

  private config: CosmicProviderConfig;

  constructor(config: Partial<CosmicProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculate(context: BonusCalculationContext): BonusProviderResult {
    const cosmic = context.cosmic;

    if (!cosmic) {
      return this.createNormalResult();
    }

    const babyType = cosmic.babyType?.toLowerCase() ?? "human";

    // Calculate each effect
    const moonEffect = this.calculateMoonEffect(cosmic.moonPhase, babyType);
    const seasonEffect = this.calculateSeasonEffect(cosmic.season, babyType);
    const eventEffect = this.calculateEventEffect(
      cosmic.activeEvents,
      babyType,
    );

    // Sum effects
    let totalEffect = moonEffect + seasonEffect + eventEffect;

    // Clamp to limits
    totalEffect = Math.max(
      -this.config.maxPenalty,
      Math.min(this.config.maxBonus, totalEffect),
    );

    const multiplier = 1 + totalEffect / 100;
    const percentage = totalEffect;

    // Determine status
    const status = this.determineStatus(totalEffect);

    return {
      name: this.name,
      multiplier,
      percentage,
      status: this.getStatus(),
      metadata: {
        label:
          totalEffect >= 0
            ? `+${totalEffect.toFixed(1)}%`
            : `${totalEffect.toFixed(1)}%`,
        description: "Moon phases, seasons, and cosmic events",
        details: {
          status,
          moonPhase: cosmic.moonPhase,
          season: cosmic.season,
          activeEvents: cosmic.activeEvents,
          babyType,
          effects: {
            moon: moonEffect,
            season: seasonEffect,
            events: eventEffect,
          },
          totalEffect,
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
  // EFFECT CALCULATIONS
  // =============================================================================

  private calculateMoonEffect(
    phase: string | undefined,
    babyType: string,
  ): number {
    if (!phase) return 0;
    const phaseEffects = MOON_PHASE_EFFECTS[phase.toLowerCase()];
    return phaseEffects?.[babyType] ?? 0;
  }

  private calculateSeasonEffect(
    season: string | undefined,
    babyType: string,
  ): number {
    if (!season) return 0;
    const seasonEffects = SEASON_EFFECTS[season.toLowerCase()];
    return seasonEffects?.[babyType] ?? 0;
  }

  private calculateEventEffect(
    events: string[] | undefined,
    babyType: string,
  ): number {
    if (!events || events.length === 0) return 0;

    let total = 0;
    for (const event of events) {
      const eventEffects = COSMIC_EVENT_EFFECTS[event.toLowerCase()];
      total += eventEffects?.[babyType] ?? 0;
    }
    return total;
  }

  // =============================================================================
  // HELPERS
  // =============================================================================

  private determineStatus(effect: number): string {
    if (effect >= 3) return "thriving";
    if (effect >= 0) return "normal";
    if (effect >= -2) return "struggling";
    return "critical";
  }

  private createNormalResult(): BonusProviderResult {
    return {
      name: this.name,
      multiplier: 1.0,
      percentage: 0,
      status: this.getStatus(),
      metadata: {
        label: "+0.0%",
        description: "Status: normal",
        details: {
          status: "normal",
          totalEffect: 0,
        },
      },
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createCosmicProvider(
  config?: Partial<CosmicProviderConfig>,
): CosmicBonusProvider {
  return new CosmicBonusProvider(config);
}

export default CosmicBonusProvider;
