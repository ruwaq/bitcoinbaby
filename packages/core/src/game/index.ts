/**
 * Game Module
 *
 * Complete Tamagotchi game system for BitcoinBaby.
 */

// Constants
export {
  GAME_CONFIG,
  DECAY_RATES,
  SLEEP_RATES,
  ACTION_EFFECTS,
  MINING_REWARDS,
  EVOLUTION_LEVELS,
  MINING_BONUS,
  LEVEL_DECAY,
  STAGE_NAMES,
  STAGE_ORDER,
  XP_PER_LEVEL,
  EGG_INCUBATION_TIME,
  getXPForLevel,
  getSpriteForm,
  getStageVariant,
  type BabyStage,
  type BabySpriteForm,
  type SparkVisualState,
  type GameAction,
} from "./constants";

// Types
export type {
  SparkStats,
  SparkProgression,
  GameSpark,
  EvolutionRecord,
  EvolutionEventData,
  GameMiningStats,
  GameState,
  GameSettings,
  Achievement,
  AchievementRequirement,
  AchievementReward,
  GameEvent,
  GameEventHandler,
} from "./types";
export { DEFAULT_SPARK_STATS, DEFAULT_GAME_STATE } from "./types";

// Mechanics
export {
  calculateDecay,
  calculateOfflineDecay,
  applyAction,
  addXP,
  removeXP,
  getStageForLevel,
  checkEvolution,
  getCriticalStats,
  calculateMiningBonus,
  calculateMiningXP,
  determineVisualState,
  createNewBaby,
  // Level decay system
  calculateLevelDecay,
  isBabyDead,
  reviveBaby,
  getDaysUntilDecay,
} from "./mechanics";

// Achievements
export {
  ACHIEVEMENTS,
  checkAchievements,
  getAchievement,
  getAchievementProgress,
  calculateAchievementRewardXP,
} from "./achievements";

// Engine
export { GameEngine, getGameEngine, createGameEngine } from "./engine";

// Game Loop (unified timing)
export {
  GameLoop,
  getGameLoop,
  initGameLoop,
  destroyGameLoop,
  type LoopTask,
  type GameLoopConfig,
} from "./game-loop";

// Tokenomics (eCash-inspired)
export {
  TOKEN_DISTRIBUTION,
  STAKING_CONFIG,
  STAKING_TIERS,
  CONTRIBUTION_REWARDS,
  calculateDistribution,
  getStakingTier,
  calculateStakingRewards,
  createStakingState,
  stakeTokens,
  unstakeTokens,
  claimRewards,
  getStakingSummary,
  type StakingTier,
  type StakingState,
  type TokenDistribution,
} from "./tokenomics";

// Contributions System
export {
  getContributionReward,
  getContributorLevel,
  getLevelDisplayName,
  getBadgeInfo,
  createContribution,
  calculateBadges,
  calculateContributorSummary,
  validateContribution,
  type ContributionType,
  type ContributionStatus,
  type Contribution,
  type Referral,
  type ContributorSummary,
  type ContributorLevel,
  type ContributorBadge,
} from "./contributions";
