/**
 * NFT Store
 *
 * Zustand store for Genesis Babies NFT state management.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BabyNFTState,
  BabyNFTInfo,
  EvolutionStatus,
} from "@bitcoinbaby/bitcoin";
import {
  getMiningBoost,
  canLevelUp,
  LEVEL_BOOSTS,
  XP_REQUIREMENTS,
  EVOLUTION_COSTS,
} from "@bitcoinbaby/bitcoin";
import { createBigIntStorage } from "./utils/bigint-storage";

// =============================================================================
// TYPES
// =============================================================================

interface NFTStore {
  // State
  ownedNFTs: BabyNFTState[];
  selectedNFT: BabyNFTState | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;

  // Computed (cached)
  bestBoost: number; // Best single NFT boost (for display)
  stackedBoost: number; // Combined boost from all NFTs with diminishing returns
  totalNFTs: number;

  // Actions
  setOwnedNFTs: (nfts: BabyNFTState[]) => void;
  selectNFT: (tokenId: number | null) => void;
  updateNFT: (tokenId: number, updates: Partial<BabyNFTState>) => void;
  addNFT: (nft: BabyNFTState) => void;
  removeNFT: (tokenId: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;

  // Getters
  getNFT: (tokenId: number) => BabyNFTState | undefined;
  getEvolutionStatus: (tokenId: number) => EvolutionStatus | null;
  getNFTInfo: (tokenId: number) => BabyNFTInfo | null;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState = {
  ownedNFTs: [],
  selectedNFT: null,
  isLoading: false,
  error: null,
  lastUpdated: null,
  bestBoost: 0,
  stackedBoost: 0,
  totalNFTs: 0,
};

// =============================================================================
// NFT STACKING WITH DIMINISHING RETURNS
// =============================================================================

/**
 * Diminishing returns multipliers for stacking multiple NFTs
 * 1st NFT: 100% of boost
 * 2nd NFT: 50% of boost
 * 3rd NFT: 25% of boost
 * 4th NFT: 12.5% of boost
 * 5th+ NFT: 5% of boost each
 *
 * This incentivizes collecting multiple NFTs while preventing
 * excessive advantages from owning many.
 */
const STACKING_MULTIPLIERS = [1.0, 0.5, 0.25, 0.125, 0.05];

/**
 * Calculate combined boost from all NFTs with diminishing returns
 * NFTs are sorted by individual boost (highest first)
 */
function calculateStackedBoost(nfts: BabyNFTState[]): number {
  if (nfts.length === 0) return 0;

  // Sort NFTs by boost (highest first)
  const sortedBoosts = nfts
    .map((nft) => getMiningBoost(nft))
    .sort((a, b) => b - a);

  let totalBoost = 0;
  for (let i = 0; i < sortedBoosts.length; i++) {
    // Use diminishing multiplier (5th+ NFTs use last multiplier)
    const multiplier =
      STACKING_MULTIPLIERS[Math.min(i, STACKING_MULTIPLIERS.length - 1)];
    totalBoost += sortedBoosts[i] * multiplier;
  }

  return Math.round(totalBoost * 100) / 100; // Round to 2 decimals
}

// =============================================================================
// STORE
// =============================================================================

export const useNFTStore = create<NFTStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ===========================================================================
      // SETTERS
      // ===========================================================================

      setOwnedNFTs: (nfts) => {
        const boosts = nfts.map((n) => ({
          tokenId: n.tokenId,
          level: n.level,
          rarityTier: n.rarityTier,
          boost: getMiningBoost(n),
        }));
        const bestBoost =
          nfts.length > 0 ? Math.max(...boosts.map((b) => b.boost)) : 0;
        const stackedBoost = calculateStackedBoost(nfts);

        console.log("[NFTStore] setOwnedNFTs called:", {
          count: nfts.length,
          boosts,
          bestBoost,
          stackedBoost,
        });

        set({
          ownedNFTs: nfts,
          totalNFTs: nfts.length,
          bestBoost,
          stackedBoost,
          lastUpdated: Date.now(),
          error: null,
        });
      },

      selectNFT: (tokenId) => {
        if (tokenId === null) {
          set({ selectedNFT: null });
          return;
        }

        const nft = get().ownedNFTs.find((n) => n.tokenId === tokenId);
        set({ selectedNFT: nft || null });
      },

      updateNFT: (tokenId, updates) => {
        set((state) => {
          const nfts = state.ownedNFTs.map((nft) =>
            nft.tokenId === tokenId ? { ...nft, ...updates } : nft,
          );

          const bestBoost =
            nfts.length > 0
              ? Math.max(...nfts.map((n) => getMiningBoost(n)))
              : 0;
          const stackedBoost = calculateStackedBoost(nfts);

          const selectedNFT =
            state.selectedNFT?.tokenId === tokenId
              ? { ...state.selectedNFT, ...updates }
              : state.selectedNFT;

          return {
            ownedNFTs: nfts,
            selectedNFT,
            bestBoost,
            stackedBoost,
            lastUpdated: Date.now(),
          };
        });
      },

      addNFT: (nft) => {
        set((state) => {
          const nfts = [...state.ownedNFTs, nft];
          const bestBoost = Math.max(...nfts.map((n) => getMiningBoost(n)));
          const stackedBoost = calculateStackedBoost(nfts);

          return {
            ownedNFTs: nfts,
            totalNFTs: nfts.length,
            bestBoost,
            stackedBoost,
            lastUpdated: Date.now(),
          };
        });
      },

      removeNFT: (tokenId) => {
        set((state) => {
          const nfts = state.ownedNFTs.filter((n) => n.tokenId !== tokenId);
          const bestBoost =
            nfts.length > 0
              ? Math.max(...nfts.map((n) => getMiningBoost(n)))
              : 0;
          const stackedBoost = calculateStackedBoost(nfts);

          const selectedNFT =
            state.selectedNFT?.tokenId === tokenId ? null : state.selectedNFT;

          return {
            ownedNFTs: nfts,
            totalNFTs: nfts.length,
            selectedNFT,
            bestBoost,
            stackedBoost,
            lastUpdated: Date.now(),
          };
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),

      setError: (error) => set({ error }),

      reset: () => set(initialState),

      // ===========================================================================
      // GETTERS
      // ===========================================================================

      getNFT: (tokenId) => {
        return get().ownedNFTs.find((n) => n.tokenId === tokenId);
      },

      getEvolutionStatus: (tokenId) => {
        const nft = get().getNFT(tokenId);
        if (!nft) return null;

        const nextLevel = nft.level + 1;
        const canEvolve = canLevelUp(nft);
        const xpRequired = XP_REQUIREMENTS[nextLevel] || 0;
        const tokenCost = EVOLUTION_COSTS[nextLevel] || 0n;
        const currentBoost = getMiningBoost(nft);
        const nextBoost = LEVEL_BOOSTS[nextLevel] || currentBoost;

        return {
          currentLevel: nft.level,
          nextLevel: canEvolve ? nextLevel : nft.level,
          currentXp: nft.xp,
          xpRequired,
          xpProgress: xpRequired > 0 ? (nft.xp / xpRequired) * 100 : 100,
          canEvolve,
          tokenCost,
          currentBoost,
          nextBoost,
          boostGain: nextBoost - currentBoost,
        };
      },

      getNFTInfo: (tokenId) => {
        const nft = get().getNFT(tokenId);
        if (!nft) return null;

        return {
          tokenId: nft.tokenId,
          name: `Genesis Baby #${nft.tokenId}`,
          level: nft.level,
          xp: nft.xp,
          rarityTier: nft.rarityTier,
          baseType: nft.baseType,
          boost: getMiningBoost(nft),
          imageUri: `/nfts/${nft.tokenId}.png`, // Placeholder
        };
      },
    }),
    {
      name: "bitcoinbaby-nft-store",
      // Use BigInt-safe storage (handles serialization internally)
      storage: createBigIntStorage() as never,
      partialize: (state) => ({
        ownedNFTs: state.ownedNFTs,
        selectedNFT: state.selectedNFT,
        lastUpdated: state.lastUpdated,
      }),
      // Recalculate derived fields after rehydration from localStorage
      onRehydrateStorage: () => (state) => {
        if (state && state.ownedNFTs.length > 0) {
          // Recalculate bestBoost, stackedBoost, and totalNFTs from rehydrated NFTs
          const boosts = state.ownedNFTs.map((n) => getMiningBoost(n));
          state.bestBoost = Math.max(...boosts, 0);
          state.stackedBoost = calculateStackedBoost(state.ownedNFTs);
          state.totalNFTs = state.ownedNFTs.length;
          console.log(
            `[NFTStore] Rehydrated ${state.totalNFTs} NFTs, bestBoost: ${state.bestBoost}%, stackedBoost: ${state.stackedBoost}%`,
          );
        }
      },
    },
  ),
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get best single NFT boost percentage (for display)
 */
export const selectBestBoost = (state: NFTStore) => state.bestBoost;

/**
 * Get combined stacked boost from all NFTs (for mining calculations)
 * This is the actual boost applied to mining rewards
 */
export const selectStackedBoost = (state: NFTStore) => state.stackedBoost;

/**
 * Get total owned NFTs
 */
export const selectTotalNFTs = (state: NFTStore) => state.totalNFTs;

/**
 * Get selected NFT
 */
export const selectSelectedNFT = (state: NFTStore) => state.selectedNFT;

/**
 * Get NFTs sorted by boost (highest first)
 */
export const selectNFTsByBoost = (state: NFTStore) =>
  [...state.ownedNFTs].sort((a, b) => getMiningBoost(b) - getMiningBoost(a));

/**
 * Get NFTs that can level up
 */
export const selectNFTsCanLevelUp = (state: NFTStore) =>
  state.ownedNFTs.filter((nft) => canLevelUp(nft));
