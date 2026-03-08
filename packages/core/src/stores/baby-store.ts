import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Baby, BabyState } from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Persisted baby data uses timestamps instead of Date objects
 * for proper serialization/deserialization
 */
export interface PersistedBaby {
  id: string;
  name: string;
  state: BabyState;
  level: number;
  experience: number;
  createdAt: number; // timestamp
  lastFed: number; // timestamp
}

interface BabyStore {
  baby: PersistedBaby | null;
  setBaby: (baby: Baby | PersistedBaby) => void;
  updateState: (state: BabyState) => void;
  addExperience: (xp: number) => void;
  levelUp: () => void;
  feed: () => void;
  reset: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert Baby (with Date) to PersistedBaby (with timestamps)
 */
function toBabyPersisted(baby: Baby | PersistedBaby): PersistedBaby {
  return {
    id: baby.id,
    name: baby.name,
    state: baby.state,
    level: baby.level,
    experience: baby.experience,
    createdAt:
      typeof baby.createdAt === "number"
        ? baby.createdAt
        : baby.createdAt.getTime(),
    lastFed:
      typeof baby.lastFed === "number" ? baby.lastFed : baby.lastFed.getTime(),
  };
}

// =============================================================================
// STORE
// =============================================================================

export const useBabyStore = create<BabyStore>()(
  persist(
    (set) => ({
      baby: null,

      setBaby: (baby) => set({ baby: toBabyPersisted(baby) }),

      updateState: (state) =>
        set((s) => (s.baby ? { baby: { ...s.baby, state } } : s)),

      addExperience: (xp) =>
        set((s) => {
          if (!s.baby) return s;
          const newXp = s.baby.experience + xp;
          const xpToLevel = s.baby.level * 100;

          if (newXp >= xpToLevel) {
            return {
              baby: {
                ...s.baby,
                experience: newXp - xpToLevel,
                level: s.baby.level + 1,
                state: "evolving" as BabyState,
              },
            };
          }

          return { baby: { ...s.baby, experience: newXp } };
        }),

      levelUp: () =>
        set((s) =>
          s.baby
            ? {
                baby: { ...s.baby, level: s.baby.level + 1, state: "evolving" },
              }
            : s,
        ),

      feed: () =>
        set((s) =>
          s.baby
            ? { baby: { ...s.baby, lastFed: Date.now(), state: "happy" } }
            : s,
        ),

      reset: () => set({ baby: null }),
    }),
    {
      name: "bitcoinbaby-baby-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        baby: state.baby,
      }),
    },
  ),
);
