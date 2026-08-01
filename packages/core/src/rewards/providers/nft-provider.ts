/**
 * NFTBonusProvider - Genesis Sparks NFT mining boost
 *
 * NFTs provide mining boosts based on level only.
 * Rarity is visual/cosmetic — no gameplay impact.
 * Multiple NFTs: best boost is used (simple, fair).
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

/** Level boost: fair 0→10% across 21 levels */
const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.2,
  4: 0.3,
  5: 0.5,
  6: 1,
  7: 1.25,
  8: 1.5,
  9: 1.75,
  10: 2,
  11: 2.5,
  12: 3,
  13: 3.5,
  14: 4,
  15: 4.5,
  16: 5,
  17: 5.5,
  18: 6,
  19: 7,
  20: 8,
  21: 10,
};

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
          description: "Mint Genesis Sparks to boost mining!",
          details: { totalNFTs: 0, bestBoost: 0 },
        },
      };
    }

    // Best boost wins — simple and fair
    const boosts = nfts.map((nft) => this.calculateNFTBoost(nft));
    const bestBoost = Math.max(...boosts);

    const finalBoost = Math.min(bestBoost, this.config.maxBoostPercent);
    const multiplier = 1 + finalBoost / 100;

    return {
      name: this.name,
      multiplier,
      percentage: finalBoost,
      status: this.getStatus(),
      metadata: {
        label: `+${finalBoost.toFixed(1)}%`,
        description: `${nfts.length} NFT${nfts.length > 1 ? "s" : ""} equipped`,
        details: {
          totalNFTs: nfts.length,
          bestBoost: finalBoost,
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

  private calculateNFTBoost(nft: { level: number; boost?: number }): number {
    if (typeof nft.boost === "number") {
      return nft.boost;
    }
    return LEVEL_BOOSTS[nft.level] ?? 0;
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
