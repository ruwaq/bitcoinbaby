/**
 * Store Selectors
 *
 * Granular selectors for Zustand stores to prevent unnecessary re-renders.
 * Use these instead of selecting entire state objects.
 *
 * @example
 * // Instead of:
 * const { hashrate, isActive } = useMiningStore();
 *
 * // Use:
 * const hashrate = useMiningStore(selectHashrate);
 * const isActive = useMiningStore(selectIsMining);
 */

import { useMiningStore } from "./mining-store";
import { useWalletStore } from "./wallet-store";
import { useNFTStore } from "./nft-store";
import { useBabyStore } from "./baby-store";

// =============================================================================
// MINING SELECTORS
// =============================================================================

type MiningState = ReturnType<typeof useMiningStore.getState>;

/** Select current hashrate */
export const selectHashrate = (s: MiningState) => s.stats.hashrate;

/** Select if mining is active */
export const selectIsMining = (s: MiningState) => s.stats.isActive;

/** Select total hashes in current session */
export const selectTotalHashes = (s: MiningState) => s.stats.totalHashes;

/** Select tokens earned in current session */
export const selectTokensEarned = (s: MiningState) => s.stats.tokensEarned;

/** Select current difficulty */
export const selectDifficulty = (s: MiningState) => s.stats.difficulty;

/** Select uptime in current session */
export const selectUptime = (s: MiningState) => s.stats.uptime;

/** Select miner type (cpu/webgpu) */
export const selectMinerType = (s: MiningState) => s.stats.minerType;

/** Select effective hashrate (with boosts applied) */
export const selectEffectiveHashrate = (s: MiningState) => s.effectiveHashrate;

/** Select cosmic multiplier */
export const selectCosmicMultiplier = (s: MiningState) => s.cosmicMultiplier;

/** Select cosmic status */
export const selectCosmicStatus = (s: MiningState) => s.cosmicStatus;

/** Select lifetime stats */
export const selectLifetimeStats = (s: MiningState) => s.persistedStats;

/** Select mining start action */
export const selectStartMining = (s: MiningState) => s.startMining;

/** Select mining stop action */
export const selectStopMining = (s: MiningState) => s.stopMining;

/** Select updateStats action */
export const selectUpdateStats = (s: MiningState) => s.updateStats;

// =============================================================================
// WALLET SELECTORS
// =============================================================================

type WalletState = ReturnType<typeof useWalletStore.getState>;

/** Select wallet address */
export const selectWalletAddress = (s: WalletState) =>
  s.wallet?.address ?? null;

/** Select wallet public key */
export const selectWalletPublicKey = (s: WalletState) =>
  s.wallet?.publicKey ?? null;

/** Select if wallet is connected */
export const selectIsWalletConnected = (s: WalletState) => s.wallet !== null;

/** Select wallet balance in satoshis */
export const selectWalletBalance = (s: WalletState) => s.wallet?.balance ?? 0n;

/** Select baby tokens balance */
export const selectBabyTokens = (s: WalletState) => s.wallet?.babyTokens ?? 0n;

/** Select sign PSBT function */
export const selectSignPsbt = (s: WalletState) => s.signPsbt;

/** Select broadcast transaction function */
export const selectBroadcastTx = (s: WalletState) => s.broadcastTx;

/** Select setWallet action */
export const selectSetWallet = (s: WalletState) => s.setWallet;

/** Select disconnect action */
export const selectDisconnect = (s: WalletState) => s.disconnect;

// =============================================================================
// NFT SELECTORS
// =============================================================================

type NFTState = ReturnType<typeof useNFTStore.getState>;

/** Select owned NFTs */
export const selectOwnedNFTs = (s: NFTState) => s.ownedNFTs;

/** Select selected NFT */
export const selectSelectedNFTState = (s: NFTState) => s.selectedNFT;

/** Select NFT loading state */
export const selectNFTLoading = (s: NFTState) => s.isLoading;

/** Select best NFT boost (single source of truth) */
export const selectNFTBoost = (s: NFTState) => s.bestBoost;

/** Select stacked boost (all NFTs with diminishing returns) */
export const selectStackedBoost = (s: NFTState) => s.stackedBoost;

/** Select total NFT count */
export const selectTotalNFTCount = (s: NFTState) => s.totalNFTs;

/** Select NFT error */
export const selectNFTError = (s: NFTState) => s.error;

/** Select setOwnedNFTs action */
export const selectSetOwnedNFTs = (s: NFTState) => s.setOwnedNFTs;

/** Select selectNFT action */
export const selectSelectNFT = (s: NFTState) => s.selectNFT;

// =============================================================================
// BABY SELECTORS
// =============================================================================

type BabyStoreState = ReturnType<typeof useBabyStore.getState>;

/** Select baby object */
export const selectBaby = (s: BabyStoreState) => s.baby;

/** Select baby level */
export const selectBabyLevel = (s: BabyStoreState) => s.baby?.level ?? 0;

/** Select baby XP */
export const selectBabyXP = (s: BabyStoreState) => s.baby?.experience ?? 0;

/** Select baby name */
export const selectBabyName = (s: BabyStoreState) => s.baby?.name ?? null;

/** Select baby state */
export const selectBabyState = (s: BabyStoreState) => s.baby?.state ?? null;

/** Select setBaby action */
export const selectSetBaby = (s: BabyStoreState) => s.setBaby;

/** Select addExperience action */
export const selectAddExperience = (s: BabyStoreState) => s.addExperience;

/** Select feed action */
export const selectFeed = (s: BabyStoreState) => s.feed;

/** Select levelUp action */
export const selectLevelUp = (s: BabyStoreState) => s.levelUp;

// =============================================================================
// COMPOSED SELECTORS
// =============================================================================

/**
 * Mining display data (for UI components)
 * Groups commonly used together values
 */
export const selectMiningDisplay = (s: MiningState) => ({
  hashrate: s.stats.hashrate,
  effectiveHashrate: s.effectiveHashrate,
  isActive: s.stats.isActive,
  totalHashes: s.stats.totalHashes,
  tokensEarned: s.stats.tokensEarned,
});

/**
 * Wallet display data (for header/navbar)
 */
export const selectWalletDisplay = (s: WalletState) => ({
  address: s.wallet?.address ?? null,
  balance: s.wallet?.balance ?? 0n,
  isConnected: s.wallet !== null,
});

/**
 * Baby status data (for status bar)
 */
export const selectBabyStatus = (s: BabyStoreState) => ({
  level: s.baby?.level ?? 0,
  xp: s.baby?.experience ?? 0,
  name: s.baby?.name ?? null,
  state: s.baby?.state ?? null,
});
