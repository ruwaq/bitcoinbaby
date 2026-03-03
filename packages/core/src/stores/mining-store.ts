import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { MiningSession } from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Cumulative stats that persist across sessions
 */
interface PersistedMiningStats {
  lifetimeHashes: number;
  lifetimeTokens: number;
  lifetimeUptime: number; // Total seconds mined
  lastSessionAt: number; // Timestamp
}

interface MiningStore {
  stats: MiningSession;
  isInitialized: boolean;

  // Persisted lifetime stats
  persistedStats: PersistedMiningStats;

  // NFT Boost
  /**
   * @deprecated Use useNFTStore().bestBoost instead.
   * This field is kept for backwards compatibility but is no longer maintained.
   */
  nftBoost: number;
  effectiveHashrate: number; // hashrate * boosts (no longer includes NFT boost)

  // Cosmic Energy Integration
  cosmicMultiplier: number; // From cosmic energy (0.5 - 2.0)
  cosmicStatus: "thriving" | "normal" | "struggling" | "critical";
  activeCosmicEffects: string[];

  // Actions
  startMining: () => void;
  stopMining: () => void;
  updateStats: (stats: Partial<MiningSession>) => void;
  addHashes: (count: number) => void;
  addTokens: (amount: number) => void;
  /**
   * @deprecated NFT boost is now read from NFTStore.bestBoost.
   * This action is a no-op and will be removed in a future version.
   */
  setNFTBoost: (boost: number) => void;
  setCosmicEnergy: (
    multiplier: number,
    status: MiningStore["cosmicStatus"],
    effects: string[],
  ) => void;
  saveLifetimeStats: () => void;
  reset: () => void;
}

const initialStats: MiningSession = {
  hashrate: 0,
  totalHashes: 0,
  tokensEarned: 0,
  difficulty: 1,
  uptime: 0,
  isActive: false,
  minerType: "cpu",
};

const initialPersistedStats: PersistedMiningStats = {
  lifetimeHashes: 0,
  lifetimeTokens: 0,
  lifetimeUptime: 0,
  lastSessionAt: 0,
};

/**
 * Calculate effective hashrate with cosmic multiplier only.
 *
 * Note: NFT boost is applied separately in useGlobalMining hook
 * by reading from NFTStore.bestBoost (single source of truth).
 */
function calculateEffectiveHashrate(
  baseHashrate: number,
  cosmicMultiplier: number,
): number {
  // Cosmic is multiplier (0.5-2.0)
  return baseHashrate * cosmicMultiplier;
}

export const useMiningStore = create<MiningStore>()(
  persist(
    (set, get) => ({
      stats: initialStats,
      isInitialized: false,
      persistedStats: initialPersistedStats,
      nftBoost: 0,
      effectiveHashrate: 0,
      cosmicMultiplier: 1.0,
      cosmicStatus: "normal",
      activeCosmicEffects: [],

      startMining: () =>
        set((s) => ({
          stats: { ...s.stats, isActive: true },
          isInitialized: true,
        })),

      stopMining: () =>
        set((s) => {
          // Save lifetime stats before stopping
          const newLifetime = {
            lifetimeHashes:
              s.persistedStats.lifetimeHashes + s.stats.totalHashes,
            lifetimeTokens:
              s.persistedStats.lifetimeTokens + s.stats.tokensEarned,
            lifetimeUptime: s.persistedStats.lifetimeUptime + s.stats.uptime,
            lastSessionAt: Date.now(),
          };

          return {
            stats: { ...s.stats, isActive: false, hashrate: 0 },
            effectiveHashrate: 0,
            persistedStats: newLifetime,
          };
        }),

      updateStats: (newStats) =>
        set((s) => {
          const updatedStats = { ...s.stats, ...newStats };
          const effectiveHashrate = calculateEffectiveHashrate(
            updatedStats.hashrate,
            s.cosmicMultiplier,
          );

          return {
            stats: updatedStats,
            effectiveHashrate,
          };
        }),

      addHashes: (count) =>
        set((s) => ({
          stats: { ...s.stats, totalHashes: s.stats.totalHashes + count },
        })),

      addTokens: (amount) =>
        set((s) => ({
          stats: { ...s.stats, tokensEarned: s.stats.tokensEarned + amount },
        })),

      setNFTBoost: (_boost) => {
        // No-op: NFT boost is now read from NFTStore.bestBoost
        console.warn(
          "[MiningStore] setNFTBoost() is deprecated. NFT boost is read from NFTStore.bestBoost automatically.",
        );
      },

      setCosmicEnergy: (multiplier, status, effects) =>
        set((s) => ({
          cosmicMultiplier: multiplier,
          cosmicStatus: status,
          activeCosmicEffects: effects,
          effectiveHashrate: calculateEffectiveHashrate(
            s.stats.hashrate,
            multiplier,
          ),
        })),

      saveLifetimeStats: () =>
        set((s) => ({
          persistedStats: {
            lifetimeHashes:
              s.persistedStats.lifetimeHashes + s.stats.totalHashes,
            lifetimeTokens:
              s.persistedStats.lifetimeTokens + s.stats.tokensEarned,
            lifetimeUptime: s.persistedStats.lifetimeUptime + s.stats.uptime,
            lastSessionAt: Date.now(),
          },
        })),

      reset: () =>
        set({
          stats: initialStats,
          isInitialized: false,
          nftBoost: 0,
          effectiveHashrate: 0,
          cosmicMultiplier: 1.0,
          cosmicStatus: "normal",
          activeCosmicEffects: [],
          // Note: persistedStats are NOT reset - they're lifetime stats
        }),
    }),
    {
      name: "bitcoinbaby-mining-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only persist lifetime stats, not session stats
      partialize: (state) => ({
        persistedStats: state.persistedStats,
      }),
    },
  ),
);
