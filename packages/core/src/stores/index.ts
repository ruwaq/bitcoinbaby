export { useSparkStore } from "./spark-store";
export { useMiningStore } from "./mining-store";
export {
  useWalletStore,
  type SignPsbtFn,
  type BroadcastTxFn,
  type CleanupFn,
  type UnregisterFn,
} from "./wallet-store";
export {
  useNFTStore,
  selectBestBoost,
  selectTotalNFTs,
  selectSelectedNFT,
  selectNFTsByBoost,
  selectNFTsCanLevelUp,
} from "./nft-store";
export {
  useNetworkStore,
  useNetworkConfig,
  useIsMainnet,
  getDerivationPath,
  NETWORK_CONFIGS,
  type BitcoinNetwork,
  type SupportedNetwork,
  type ScrollsNetwork,
  type NetworkConfig,
} from "./network-store";
export {
  useSettingsStore,
  useMiningSettings,
  useDisplaySettings,
  useSecuritySettings,
  getDifficultyValue,
  DIFFICULTY_VALUES,
  AUTO_LOCK_LABELS,
  type MiningDifficulty,
  type MinerTypePreference,
  type AutoLockTimeout,
  type ExplorerPreference,
  type ThemePreference,
  type MiningSettings,
  type NetworkSettings,
  type DisplaySettings,
  type SecuritySettings,
  type SettingsState,
} from "./settings-store";
export {
  useLeaderboardStore,
  truncateAddress,
  formatScore,
  getLeaderboardBadgeInfo,
  type LeaderboardEntry,
  type LeaderboardBadge,
  type LeaderboardCategory,
  type LeaderboardPeriod,
  type UserLeaderboardStats,
} from "./leaderboard-store";
export {
  useTutorialStore,
  useShouldShowTutorial,
  TUTORIAL_STEPS,
  type TutorialStep,
} from "./tutorial-store";
export {
  usePendingTxStore,
  usePendingTxCount,
  cleanupStuckTransactions,
  type TransactionType,
  type PendingTransaction,
} from "./pending-tx-store";
export {
  useOverlayStore,
  // Sheet overlays
  useWithdrawOverlay,
  useSendOverlay,
  useReceiveOverlay,
  useSettingsOverlay,
  useHistoryOverlay,
  // Modal overlays
  useUnlockModal,
  useConfirmModal,
  useResetModal,
  useRecoveryPhraseModal,
  useChangePasswordModal,
  useDeleteWalletModal,
  // Utilities
  getOverlayMode,
  // Types
  type OverlayType,
  type SheetType,
  type ModalType,
  type OverlayMode,
  type OverlayData,
} from "./overlay-store";
export {
  useDeadLetterStore,
  selectRetryableCount,
  selectExhaustedProofs,
  selectHasFailedProofs,
  selectTokensAtRisk,
} from "./dead-letter-store";
export { useNarrativeStore } from "./narrative-store";

// Granular selectors for performance optimization
export {
  // Mining selectors
  selectHashrate,
  selectIsMining,
  selectTotalHashes,
  selectTokensEarned,
  selectDifficulty,
  selectUptime,
  selectMinerType,
  selectEffectiveHashrate,
  selectCosmicMultiplier,
  selectCosmicStatus,
  selectLifetimeStats,
  selectStartMining,
  selectStopMining,
  selectUpdateStats,
  // Wallet selectors
  selectWalletAddress,
  selectWalletPublicKey,
  selectIsWalletConnected,
  selectWalletBalance,
  selectSparkTokens,
  selectSignPsbt,
  selectBroadcastTx,
  selectSetWallet,
  selectDisconnect,
  // NFT selectors (additional)
  selectOwnedNFTs,
  selectSelectedNFTState,
  selectNFTLoading,
  selectNFTBoost,
  selectStackedBoost,
  selectTotalNFTCount,
  selectNFTError,
  selectSetOwnedNFTs,
  selectSelectNFT,
  // Spark selectors
  selectSpark,
  selectSparkLevel,
  selectSparkXP,
  selectSparkName,
  selectSparkState,
  selectSetSpark,
  selectAddExperience,
  selectFeed,
  selectLevelUp,
  // Composed selectors
  selectMiningDisplay,
  selectWalletDisplay,
  selectSparkStatus,
} from "./selectors";
