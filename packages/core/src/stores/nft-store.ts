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
  RarityTier,
  EvolutionStatus,
} from "@bitcoinbaby/bitcoin";
import {
  getMiningBoost,
  canLevelUp,
  LEVEL_BOOSTS,
  XP_REQUIREMENTS,
  EVOLUTION_COSTS,
  GENESIS_BABIES_CONFIG,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// BIGINT SERIALIZATION HELPERS
// =============================================================================

// Marker prefix for BigInt values to distinguish from regular strings
const BIGINT_MARKER = "__bigint__:";

/**
 * Serialize BigInt values with a marker prefix
 * This ensures ALL BigInt values are properly restored, regardless of size
 */
function serializeWithBigIntMarker(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return `${BIGINT_MARKER}${obj.toString()}`;
  if (Array.isArray(obj)) return obj.map(serializeWithBigIntMarker);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeWithBigIntMarker(value);
    }
    return result;
  }
  return obj;
}

/**
 * Deserialize values with BigInt marker back to BigInt
 */
function deserializeWithBigIntMarker(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string" && obj.startsWith(BIGINT_MARKER)) {
    return BigInt(obj.slice(BIGINT_MARKER.length));
  }
  if (Array.isArray(obj)) return obj.map(deserializeWithBigIntMarker);
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      result[key] = deserializeWithBigIntMarker(value);
    }
    return result;
  }
  return obj;
}

// =============================================================================
// CUSTOM STORAGE (BigInt-safe)
// =============================================================================

/**
 * Custom storage adapter that handles BigInt serialization properly.
 *
 * IMPORTANT: This storage does NOT use Zustand's createJSONStorage because
 * createJSONStorage calls JSON.stringify BEFORE passing to setItem, which fails
 * with BigInt values. Instead, we implement the full StorageValue interface
 * and handle serialization ourselves.
 */
const bigIntSafeStorage = {
  getItem: (name: string) => {
    const value = localStorage.getItem(name);
    if (!value) return null;

    try {
      // Parse and convert BigInt markers back to BigInt
      const parsed = JSON.parse(value);
      const deserialized = deserializeWithBigIntMarker(parsed);
      return deserialized;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: unknown): void => {
    try {
      // Serialize with BigInt markers before storing
      const serialized = serializeWithBigIntMarker(value);
      localStorage.setItem(name, JSON.stringify(serialized));
    } catch (e) {
      console.error("[NFTStore] Failed to save:", e);
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

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
  bestBoost: number;
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
  totalNFTs: 0,
};

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
        const bestBoost =
          nfts.length > 0 ? Math.max(...nfts.map((n) => getMiningBoost(n))) : 0;

        set({
          ownedNFTs: nfts,
          totalNFTs: nfts.length,
          bestBoost,
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

          const selectedNFT =
            state.selectedNFT?.tokenId === tokenId
              ? { ...state.selectedNFT, ...updates }
              : state.selectedNFT;

          return {
            ownedNFTs: nfts,
            selectedNFT,
            bestBoost,
            lastUpdated: Date.now(),
          };
        });
      },

      addNFT: (nft) => {
        set((state) => {
          const nfts = [...state.ownedNFTs, nft];
          const bestBoost = Math.max(...nfts.map((n) => getMiningBoost(n)));

          return {
            ownedNFTs: nfts,
            totalNFTs: nfts.length,
            bestBoost,
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

          const selectedNFT =
            state.selectedNFT?.tokenId === tokenId ? null : state.selectedNFT;

          return {
            ownedNFTs: nfts,
            totalNFTs: nfts.length,
            selectedNFT,
            bestBoost,
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
      // Use custom storage that handles BigInt serialization internally
      // NOT using createJSONStorage because it calls JSON.stringify before setItem
      storage: bigIntSafeStorage as never,
      partialize: (state) => ({
        ownedNFTs: state.ownedNFTs,
        selectedNFT: state.selectedNFT,
        lastUpdated: state.lastUpdated,
      }),
    },
  ),
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get best boost percentage
 */
export const selectBestBoost = (state: NFTStore) => state.bestBoost;

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
