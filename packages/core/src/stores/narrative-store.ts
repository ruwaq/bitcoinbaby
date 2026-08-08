import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  NarrativeEvent,
  NarrativeState,
  PersonalityTraits,
  Mood,
  Relationship,
  Item,
} from "@bitcoinbaby/ai";

// =============================================================================
// STORE TYPE
// =============================================================================

interface NarrativeStoreState {
  /** Map of tokenId → NarrativeState. Supports users with multiple NFTs. */
  states: Record<number, NarrativeState>;
  /** Currently active tokenId (the baby being viewed/mined) */
  activeTokenId: number | null;

  // Actions
  /** Initialize or get narrative state for a tokenId */
  getOrCreate: (tokenId: number, initState: NarrativeState) => NarrativeState;
  /** Get state for active baby */
  getActive: () => NarrativeState | null;
  /** Add a narrative event */
  addEvent: (tokenId: number, event: NarrativeEvent) => void;
  /** Update personality after trait impacts */
  updatePersonality: (tokenId: number, traits: PersonalityTraits) => void;
  /** Update mood */
  updateMood: (tokenId: number, mood: Mood) => void;
  /** Set the active baby */
  setActive: (tokenId: number | null) => void;
  /** Add a relationship */
  addRelationship: (tokenId: number, rel: Relationship) => void;
  /** Add an item */
  addItem: (tokenId: number, item: Item) => void;
  /** Get recent events for a baby */
  getRecentEvents: (tokenId: number, count?: number) => NarrativeEvent[];
  /** Reset all narrative data */
  reset: () => void;
}

// =============================================================================
// STORE
// =============================================================================

export const useNarrativeStore = create<NarrativeStoreState>()(
  persist(
    (set, get) => ({
      states: {},
      activeTokenId: null,

      getOrCreate: (tokenId, initState) => {
        const existing = get().states[tokenId];
        if (existing) return existing;
        set((s) => ({
          states: { ...s.states, [tokenId]: initState },
          activeTokenId: s.activeTokenId ?? tokenId,
        }));
        return initState;
      },

      getActive: () => {
        const { states, activeTokenId } = get();
        if (activeTokenId === null) return null;
        return states[activeTokenId] ?? null;
      },

      addEvent: (tokenId, event) => {
        set((s) => {
          const current = s.states[tokenId];
          if (!current) return s;
          // FIFO cap at 200 events to prevent localStorage QuotaExceededError
          const events =
            current.events.length >= 200
              ? [...current.events.slice(-199), event]
              : [...current.events, event];
          return {
            states: {
              ...s.states,
              [tokenId]: { ...current, events },
            },
          };
        });
      },

      updatePersonality: (tokenId, traits) => {
        set((s) => {
          const current = s.states[tokenId];
          if (!current) return s;
          return {
            states: {
              ...s.states,
              [tokenId]: { ...current, personality: traits },
            },
          };
        });
      },

      updateMood: (tokenId, mood) => {
        set((s) => {
          const current = s.states[tokenId];
          if (!current) return s;
          return {
            states: {
              ...s.states,
              [tokenId]: { ...current, mood },
            },
          };
        });
      },

      setActive: (tokenId) => {
        set({ activeTokenId: tokenId });
      },

      addRelationship: (tokenId, rel) => {
        set((s) => {
          const current = s.states[tokenId];
          if (!current) return s;
          const existing = current.relationships.filter(
            (r) => r.targetTokenId !== rel.targetTokenId,
          );
          return {
            states: {
              ...s.states,
              [tokenId]: {
                ...current,
                relationships: [...existing, rel],
              },
            },
          };
        });
      },

      addItem: (tokenId, item) => {
        set((s) => {
          const current = s.states[tokenId];
          if (!current) return s;
          return {
            states: {
              ...s.states,
              [tokenId]: {
                ...current,
                inventory: [...current.inventory, item],
              },
            },
          };
        });
      },

      getRecentEvents: (tokenId, count = 10) => {
        const state = get().states[tokenId];
        if (!state) return [];
        return state.events.slice(-count);
      },

      reset: () => {
        set({ states: {}, activeTokenId: null });
      },
    }),
    {
      name: "bb-narrative-store",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        states: state.states,
        activeTokenId: state.activeTokenId,
      }),
    },
  ),
);
