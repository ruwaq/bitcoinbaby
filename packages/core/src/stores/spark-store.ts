import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Spark, SparkState } from "../types";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Persisted spark data uses timestamps instead of Date objects
 * for proper serialization/deserialization
 */
export interface PersistedSpark {
  id: string;
  name: string;
  state: SparkState;
  level: number;
  experience: number;
  createdAt: number; // timestamp
  lastFed: number; // timestamp
}

interface SparkStore {
  spark: PersistedSpark | null;
  setSpark: (spark: Spark | PersistedSpark) => void;
  updateState: (state: SparkState) => void;
  addExperience: (xp: number) => void;
  levelUp: () => void;
  feed: () => void;
  reset: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert Spark (with Date) to PersistedSpark (with timestamps)
 */
function toSparkPersisted(spark: Spark | PersistedSpark): PersistedSpark {
  return {
    id: spark.id,
    name: spark.name,
    state: spark.state,
    level: spark.level,
    experience: spark.experience,
    createdAt:
      typeof spark.createdAt === "number"
        ? spark.createdAt
        : spark.createdAt.getTime(),
    lastFed:
      typeof spark.lastFed === "number" ? spark.lastFed : spark.lastFed.getTime(),
  };
}

// =============================================================================
// STORE
// =============================================================================

export const useSparkStore = create<SparkStore>()(
  persist(
    (set) => ({
      spark: null,

      setSpark: (spark) => set({ spark: toSparkPersisted(spark) }),

      updateState: (state) =>
        set((s) => (s.spark ? { spark: { ...s.spark, state } } : s)),

      addExperience: (xp) =>
        set((s) => {
          if (!s.spark) return s;
          const newXp = s.spark.experience + xp;
          const xpToLevel = s.spark.level * 100;

          if (newXp >= xpToLevel) {
            return {
              spark: {
                ...s.spark,
                experience: newXp - xpToLevel,
                level: s.spark.level + 1,
                state: "evolving" as SparkState,
              },
            };
          }

          return { spark: { ...s.spark, experience: newXp } };
        }),

      levelUp: () =>
        set((s) =>
          s.spark
            ? {
                spark: { ...s.spark, level: s.spark.level + 1, state: "evolving" },
              }
            : s,
        ),

      feed: () =>
        set((s) =>
          s.spark
            ? { spark: { ...s.spark, lastFed: Date.now(), state: "happy" } }
            : s,
        ),

      reset: () => set({ spark: null }),
    }),
    {
      name: "bitcoinsparks-spark-store",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        spark: state.spark,
      }),
    },
  ),
);
