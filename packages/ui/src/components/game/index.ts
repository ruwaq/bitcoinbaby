/**
 * Game UI Components
 *
 * Tamagotchi-style UI for BitcoinBaby.
 */

export { GameHUD, type GameHUDStats, type GameHUDProgression } from "./GameHUD";
export { ActionButtons, type GameAction } from "./ActionButtons";
export { AchievementPopup, type AchievementData } from "./AchievementPopup";
export { EvolutionModal } from "./EvolutionModal";
export { DeathModal } from "./DeathModal";
export { Tutorial, TutorialTrigger, type TutorialStep } from "./Tutorial";
export {
  LeaderboardTable,
  LeaderboardPagination,
  UserRankSummary,
  type LeaderboardEntry as LeaderboardTableEntry,
  type LeaderboardBadge as LeaderboardTableBadge,
  type LeaderboardCategory as LeaderboardTableCategory,
  type CosmicStatus,
} from "./LeaderboardTable";
export {
  LeaderboardWidget,
  type LeaderboardWidgetEntry,
  type LeaderboardWidgetProps,
  type LeaderboardCategory,
} from "./LeaderboardWidget";
export {
  TransactionConfirmModal,
  createWithdrawTransaction,
  createSendTransaction,
  createMintNFTTransaction,
  createClaimTransaction,
  type TransactionDetails,
} from "./TransactionConfirmModal";
