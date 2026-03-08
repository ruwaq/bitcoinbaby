/**
 * Rewards System - Centralized bonus calculations
 *
 * This module provides a unified system for calculating mining rewards
 * with all applicable bonuses (streak, NFT, engagement, cosmic).
 *
 * @example
 * ```typescript
 * import { useBonusEngine, initializeBonusEngine } from '@bitcoinbaby/core/rewards';
 *
 * // Initialize with all providers
 * initializeBonusEngine();
 *
 * // Use in component
 * const { calculateRewards, breakdown } = useBonusEngine();
 * ```
 */

// Engine
export {
  BonusCalculationEngine,
  getBonusEngine,
  resetBonusEngine,
  type IBonusProvider,
  type BonusCalculationContext,
  type BonusCalculationResult,
  type BonusProviderResult,
  type BonusStatus,
  type BonusCombineMode,
  type BonusEngineConfig,
} from "./bonus-engine";

// Providers
export {
  StreakBonusProvider,
  createStreakProvider,
  NFTBonusProvider,
  createNFTProvider,
  EngagementBonusProvider,
  createEngagementProvider,
  CosmicBonusProvider,
  createCosmicProvider,
} from "./providers";

// Hook
export { useBonusEngine, initializeBonusEngine } from "./use-bonus-engine";
