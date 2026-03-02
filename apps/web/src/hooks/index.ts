// =============================================================================
// APP-SPECIFIC HOOKS
// These hooks are specific to the web app with features like caching,
// pending balance tracking, and integration with app-specific stores.
// For shared/general hooks, see @bitcoinbaby/core
// =============================================================================

// Blockchain hooks
export {
  useBalance,
  type BalanceState,
  type UseBalanceOptions,
} from "./useBalance";
export {
  useWallet,
  type WalletState,
  type WalletActions,
  type UseWalletReturn,
} from "./useWallet";
export {
  useWalletConnection,
  type WalletConnectionState,
  type WalletConnectionActions,
  type UseWalletConnectionReturn,
} from "./useWalletConnection";
export {
  useMiningSubmitter,
  type MiningSubmitterState,
  type MiningSubmitterActions,
  type UseMiningSubmitterReturn,
  type UseMiningSubmitterOptions,
} from "./useMiningSubmitter";
export {
  useTokenBalance,
  formatTokenBalance,
  clearBalanceCache,
  clearAddressBalanceCache,
  type TokenBalanceState,
  type TokenBalanceActions,
  type UseTokenBalanceReturn,
  type UseTokenBalanceOptions,
  type TokenInfo,
} from "./useTokenBalance";
export {
  useTransactionHistory,
  type TransactionHistoryState,
  type TransactionHistoryActions,
  type UseTransactionHistoryReturn,
  type UseTransactionHistoryOptions,
} from "./useTransactionHistory";

// =============================================================================
// WORKERS API HOOKS (Virtual Balance & Withdrawal Pools)
// =============================================================================
export {
  useVirtualBalance,
  type VirtualBalanceState,
  type VirtualBalanceActions,
  type UseVirtualBalanceReturn,
  type UseVirtualBalanceOptions,
} from "./useVirtualBalance";
export {
  useWithdrawPool,
  formatPoolType,
  getPoolDescription,
  type WithdrawPoolState,
  type WithdrawPoolActions,
  type UseWithdrawPoolReturn,
  type UseWithdrawPoolOptions,
  type PoolInfo,
} from "./useWithdrawPool";

// Game hooks - re-exported from @bitcoinbaby/core
// Local versions deprecated, use from core
export { useBabyState } from "./useBabyState";

// NFT hooks
/**
 * @deprecated Use `useNFTMinting` from `@bitcoinbaby/core` for full blockchain integration.
 */
export {
  useMintNFT,
  type MintResult,
  type UseMintNFTReturn,
} from "./useMintNFT";
export {
  useNFTSync,
  useInvalidateNFTs,
  type UseNFTSyncReturn,
} from "./useNFTSync";
export {
  useClaimNFT,
  type ClaimResult,
  type UseClaimNFTReturn,
} from "./useClaimNFT";

// Platform hooks
export { useCapacitor, type UseCapacitorReturn } from "./useCapacitor";
export { usePlatform, type Platform, type PlatformInfo } from "./usePlatform";

// SharedWorker mining (persists across tabs/navigation)
export {
  useSharedMining,
  useSharedMiningShares,
  supportsSharedWorker,
  type SharedMiningState,
  type SharedMiningConfig,
  type UseSharedMiningReturn,
  type ShareData,
} from "./useSharedMining";

// =============================================================================
// RE-EXPORTS FROM @bitcoinbaby/core
// These are the shared hooks from core package for convenience
// =============================================================================
export {
  // Cosmic hooks
  useCosmicState,
  useCosmicEnergy,
  useMoonPhase,
  useCosmicEvents,
  useBabyCosmicStatus,
  // Mining + Cosmic
  useMiningCosmic,
  useCosmicMiningMultiplier,
  useCosmicMiningConditions,
  // Global mining (singleton pattern)
  useGlobalMining,
  type UseGlobalMiningOptions,
  type UseGlobalMiningReturn,
  // Game hooks (centralized)
  useGameLoop,
  type UseGameLoopOptions,
  type UseGameLoopReturn,
  useAchievements,
  type UseAchievementsOptions,
  type UseAchievementsReturn,
  type AchievementNotification,
  useLeaderboard,
  type UseLeaderboardOptions,
  type UseLeaderboardReturn,
  CATEGORY_INFO,
  PERIOD_INFO,
  // Mining with NFT boost (centralized)
  useMiningWithNFTs,
  type UseMiningWithNFTsOptions,
  type UseMiningWithNFTsReturn,
  // NFT minting (centralized)
  useNFTMinting,
  type UseNFTMintingOptions,
  type UseNFTMintingReturn,
  type NFTMintResult,
} from "@bitcoinbaby/core";
