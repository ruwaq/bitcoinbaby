/**
 * Hooks
 *
 * React hooks for BitcoinBaby functionality.
 */

export {
  useTokenBalance,
  useOwnedNFTs,
  useMiningBoost,
  useBTCBalance,
  useFeeEstimates,
  useBlockHeight,
  useDashboard,
} from "./useCharms";

// Cosmic hooks
export {
  useCosmicState,
  useCosmicEnergy,
  useMoonPhase,
  useCosmicEvents,
  useBabyCosmicStatus,
  useBitcoinCosmic,
} from "./useCosmic";

// Mining + Cosmic integration
export {
  useMiningCosmic,
  useCosmicMiningMultiplier,
  useCosmicMiningConditions,
} from "./useMiningCosmic";

// Mining XP integration (cosmic multipliers affect baby XP)
export { useMiningXPIntegration } from "./useMiningXPIntegration";

// Global mining hook (persists across navigation)
export {
  useGlobalMining,
  type UseGlobalMiningOptions,
  type UseGlobalMiningReturn,
} from "./useGlobalMining";

// Mining with NFT boost hook (global mining + Genesis Babies boost)
export {
  useMiningWithNFTs,
  type UseMiningWithNFTsOptions,
  type UseMiningWithNFTsReturn,
} from "./useMiningWithNFTs";

// Mining features hook (persistence, tab coordination, wake lock)
export {
  useMiningFeatures,
  type MiningFeatures,
  type LifetimeStats,
  type UseMiningFeaturesOptions,
  type UseMiningFeaturesReturn,
} from "./useMiningFeatures";

// Wallet provider hook (multi-wallet support)
export {
  useWalletProvider,
  type UseWalletProviderReturn,
} from "./useWalletProvider";

// Wallet auto-lock hook (security timeout)
export { useWalletAutoLock } from "./useWalletAutoLock";

// Mining submission hook (connects mining to blockchain)
export {
  useMiningSubmission,
  type UseMiningSubmissionOptions,
  type UseMiningSubmissionReturn,
} from "./useMiningSubmission";

// NFT minting hook (Genesis Babies operations)
export {
  useNFTMinting,
  type UseNFTMintingOptions,
  type UseNFTMintingReturn,
  type NFTMintResult,
} from "./useNFTMinting";

// NFT sale hook (purchase NFTs at $50 USD in BTC)
export {
  useNFTSale,
  type UseNFTSaleOptions,
  type UseNFTSaleReturn,
} from "./useNFTSale";

// =============================================================================
// GAME HOOKS
// =============================================================================

// Game loop hook (engine lifecycle)
export {
  useGameLoop,
  type UseGameLoopOptions,
  type UseGameLoopReturn,
} from "./useGameLoop";

// Achievement tracking hook
export {
  useAchievements,
  type UseAchievementsOptions,
  type UseAchievementsReturn,
  type AchievementNotification,
} from "./useAchievements";

// Leaderboard hook
export {
  useLeaderboard,
  type UseLeaderboardOptions,
  type UseLeaderboardReturn,
  CATEGORY_INFO,
  PERIOD_INFO,
} from "./useLeaderboard";

// =============================================================================
// API HOOKS (Cloudflare Workers)
// =============================================================================

// Balance hook (virtual balance from Workers)
export { useBalance } from "./use-api";

// Unified balance hook (combines all balance sources)
export {
  useUnifiedBalance,
  type UnifiedBalanceOptions,
  type BTCBalanceInfo,
  type TokenBalanceInfo,
  type VirtualBalanceInfo,
  type UseUnifiedBalanceReturn,
} from "./useUnifiedBalance";

// Pool status hook (withdrawal pools)
export { usePoolStatus } from "./use-api";

// Withdraw hook (manage withdrawal requests)
export { useWithdraw } from "./use-api";

// Game state hook (real-time sync via WebSocket)
export { useGameState } from "./use-api";

// =============================================================================
// ENGAGEMENT HOOKS
// =============================================================================

// Engagement tracking hook (bonuses for baby care, streaks, playtime)
export {
  useEngagement,
  type UseEngagementOptions,
  type UseEngagementReturn,
} from "./useEngagement";

// =============================================================================
// UTILITY HOOKS
// =============================================================================

// Throttled value hook (for performance with rapidly changing values)
export { useThrottledValue } from "./useThrottledValue";
