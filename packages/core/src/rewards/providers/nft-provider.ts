/**
 * NFTBonusProvider - Genesis Babies NFT mining boost
 *
 * NFTs provide mining boosts based on level and rarity.
 * Multiple NFTs stack with diminishing returns.
 *
 * Level Boosts:
 * - Level 1: 0%
 * - Level 10: 4%
 *
 * Rarity Boosts:
 * - Common: 0.5%
 * - Mythic: 8%
 *
 * Stacking (diminishing returns):
 * - 1st NFT: 100% of boost
 * - 2nd NFT: 50% of boost
 * - 3rd NFT: 25% of boost
 * - 4th NFT: 12.5% of boost
 * - 5th+: 5% each
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

const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 0.25,
  3: 0.5,
  4: 0.75,
  5: 1,
  6: 1.5,
  7: 2,
  8: 2.5,
  9: 3,
  10: 4,
};

const RARITY_BOOSTS: Record<string, number> = {
  common: 0.5,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 5,
  mythic: 8,
};

const STACKING_MULTIPLIERS = [1.0, 0.5, 0.25, 0.125, 0.05];

// =============================================================================
// CONFIGURATION
// =============================================================================

interface NFTProviderConfig {
  /** Whether NFT boost is enabled */
  enabled: boolean;
  /** Maximum total boost percentage */
  maxBoostPercent: number;
}

const DEFAULT_CONFIG: NFTProviderConfig = {
  enabled: true, // Server-side validation active
  maxBoostPercent: 50, // Max 50% total boost
};

// =============================================================================
// PROVIDER
// =============================================================================

export class NFTBonusProvider implements IBonusProvider {
  readonly name = "nft";
  readonly priority = 2;
  readonly combineMode: BonusCombineMode = "additive";
  readonly maxMultiplier = 1.5; // Max 50% boost
  readonly minMultiplier = 1.0;

  private config: NFTProviderConfig;

  constructor(config: Partial<NFTProviderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  calculate(context: BonusCalculationContext): BonusProviderResult {
    const nfts = context.nfts ?? [];

    if (nfts.length === 0) {
      return {
        name: this.name,
        multiplier: 1.0,
        percentage: 0,
        status: this.getStatus(),
        metadata: {
          label: "No NFTs",
          description: "Mint Genesis Babies to boost mining!",
          details: {
            totalNFTs: 0,
            bestBoost: 0,
            stackedBoost: 0,
          },
        },
      };
    }

    // Calculate individual boosts
    const boosts = nfts.map((nft) => this.calculateNFTBoost(nft));

    // Sort by boost (highest first)
    boosts.sort((a, b) => b - a);

    // Apply stacking with diminishing returns
    const stackedBoost = this.calculateStackedBoost(boosts);
    const bestBoost = boosts[0] ?? 0;

    // Clamp to max
    const finalBoost = Math.min(stackedBoost, this.config.maxBoostPercent);
    const multiplier = 1 + finalBoost / 100;
    const percentage = finalBoost;

    return {
      name: this.name,
      multiplier,
      percentage,
      status: this.getStatus(),
      metadata: {
        label: `+${finalBoost.toFixed(1)}%`,
        description: `${nfts.length} NFT${nfts.length > 1 ? "s" : ""} equipped`,
        details: {
          totalNFTs: nfts.length,
          bestBoost,
          stackedBoost: finalBoost,
          individualBoosts: boosts,
          nfts: nfts.map((nft, i) => ({
            level: nft.level,
            rarity: nft.rarityTier,
            boost: boosts[i],
          })),
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
  // HELPERS
  // =============================================================================

  private calculateNFTBoost(nft: {
    level: number;
    rarityTier: string;
    boost?: number;
  }): number {
    // If pre-calculated boost exists, use it
    if (typeof nft.boost === "number") {
      return nft.boost;
    }

    const levelBoost = LEVEL_BOOSTS[nft.level] ?? 0;
    const rarityBoost = RARITY_BOOSTS[nft.rarityTier?.toLowerCase()] ?? 0;

    return levelBoost + rarityBoost;
  }

  private calculateStackedBoost(boosts: number[]): number {
    let total = 0;

    for (let i = 0; i < boosts.length; i++) {
      const stackMultiplier =
        i < STACKING_MULTIPLIERS.length
          ? STACKING_MULTIPLIERS[i]
          : STACKING_MULTIPLIERS[STACKING_MULTIPLIERS.length - 1];

      total += boosts[i] * stackMultiplier;
    }

    return total;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createNFTProvider(
  config?: Partial<NFTProviderConfig>,
): NFTBonusProvider {
  return new NFTBonusProvider(config);
}

export default NFTBonusProvider;
