/**
 * Application Identifiers
 *
 * Centralized IDs for apps, tokens, and NFT collections.
 */

/**
 * NFT Collection App IDs
 */
export const NFT_APP_IDS = {
  /** Genesis Babies collection */
  genesisBabies: "genesis-babies",
} as const;

/**
 * Token App IDs
 * These are the Charms app identifiers for tokens
 */
export const TOKEN_APP_IDS = {
  /** BABY token */
  baby: "baby-token",
} as const;

/**
 * Miner identifiers
 * Used to track which component initiated mining
 */
export const MINER_IDS = {
  /** Main mining section */
  main: "main-miner",

  /** Baby care section (for XP tracking) */
  babyCare: "baby-care-miner",

  /** Status bar indicator */
  statusBar: "status-bar-miner",

  /** Background mining */
  background: "background-miner",
} as const;

/**
 * Default app ID for NFT boost calculation
 */
export const DEFAULT_NFT_APP_ID = NFT_APP_IDS.genesisBabies;
