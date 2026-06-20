/**
 * Game Storage
 *
 * IndexedDB-based persistence for game state.
 * Falls back to localStorage if IndexedDB is unavailable.
 */

import type { GameState, GameSpark, SparkProgression } from "../game/types";
import { DEFAULT_GAME_STATE } from "../game/types";
import { getXPForLevel } from "../game/constants";
import { getStageForLevel } from "../game/mechanics";

const DB_NAME = "bitcoinbaby";
const DB_VERSION = 1;
const STORE_NAME = "gameState";
const STATE_KEY = "current";

// localStorage fallback key
const LS_KEY = "bitcoinbaby_game_state";

/**
 * Check if IndexedDB is available
 */
function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Open IndexedDB connection
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Serialize BigInt values for JSON storage
 */
function serializeState(state: GameState): string {
  return JSON.stringify(state, (_, value) =>
    typeof value === "bigint" ? { __bigint__: value.toString() } : value,
  );
}

/**
 * Deserialize BigInt values from JSON storage
 */
function deserializeState(json: string): GameState {
  return JSON.parse(json, (_, value) => {
    if (value && typeof value === "object" && "__bigint__" in value) {
      return BigInt(value.__bigint__);
    }
    return value;
  });
}

/**
 * Save game state to IndexedDB
 */
async function saveToIndexedDB(state: GameState): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const serialized = serializeState(state);
    const request = store.put(serialized, STATE_KEY);

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
    request.onsuccess = () => resolve();

    transaction.oncomplete = () => db.close();
    transaction.onerror = () => db.close();
  });
}

/**
 * Load game state from IndexedDB
 */
async function loadFromIndexedDB(): Promise<GameState | null> {
  try {
    const db = await openDB();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(deserializeState(result));
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/**
 * Save to localStorage (fallback)
 */
function saveToLocalStorage(state: GameState): void {
  try {
    localStorage.setItem(LS_KEY, serializeState(state));
  } catch (error) {
    console.error("Failed to save to localStorage:", error);
  }
}

/**
 * Load from localStorage (fallback)
 */
function loadFromLocalStorage(): GameState | null {
  try {
    const data = localStorage.getItem(LS_KEY);
    if (data) {
      return deserializeState(data);
    }
  } catch (error) {
    console.error("Failed to load from localStorage:", error);
  }
  return null;
}

/**
 * Game Storage API
 */
export const GameStorage = {
  /**
   * Save game state
   */
  async save(state: GameState): Promise<void> {
    const stateToSave: GameState = {
      ...state,
      lastSaved: Date.now(),
    };

    if (isIndexedDBAvailable()) {
      try {
        await saveToIndexedDB(stateToSave);
        return;
      } catch (error) {
        console.warn(
          "IndexedDB save failed, falling back to localStorage:",
          error,
        );
      }
    }

    saveToLocalStorage(stateToSave);
  },

  /**
   * Load game state
   */
  async load(): Promise<GameState> {
    let state: GameState | null = null;

    if (isIndexedDBAvailable()) {
      try {
        state = await loadFromIndexedDB();
      } catch (error) {
        console.warn("IndexedDB load failed, trying localStorage:", error);
      }
    }

    if (!state) {
      state = loadFromLocalStorage();
    }

    if (!state) {
      return { ...DEFAULT_GAME_STATE };
    }

    // Migrate if needed
    return migrateState(state);
  },

  /**
   * Clear all saved data
   */
  async clear(): Promise<void> {
    if (isIndexedDBAvailable()) {
      try {
        const db = await openDB();
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        store.delete(STATE_KEY);
        transaction.oncomplete = () => db.close();
      } catch (error) {
        console.warn("IndexedDB clear failed:", error);
      }
    }

    try {
      localStorage.removeItem(LS_KEY);
    } catch (error) {
      console.warn("localStorage clear failed:", error);
    }
  },

  /**
   * Check if saved data exists
   */
  async exists(): Promise<boolean> {
    const state = await this.load();
    return state.baby !== null;
  },
};

/**
 * Validate and repair baby progression
 *
 * Ensures:
 * - Level is within valid range (1-21)
 * - XP is non-negative and less than xpToNextLevel
 * - xpToNextLevel matches getXPForLevel(level + 1)
 * - Stage matches getStageForLevel(level)
 *
 * This prevents corrupted data from causing instant legend bug.
 */
function validateSparkProgression(
  progression: SparkProgression,
): SparkProgression {
  // Validate level (1-21, default to 1 if invalid)
  let level = progression.level;
  if (
    typeof level !== "number" ||
    level < 1 ||
    level > 21 ||
    !isFinite(level)
  ) {
    console.warn(`[GameStorage] Invalid level ${level}, resetting to 1`);
    level = 1;
  }

  // Calculate correct values based on level
  const correctXpToNext = getXPForLevel(level + 1);
  const correctStage = getStageForLevel(level);

  // Validate XP
  let xp = progression.xp;
  if (typeof xp !== "number" || xp < 0 || !isFinite(xp)) {
    console.warn(`[GameStorage] Invalid XP ${xp}, resetting to 0`);
    xp = 0;
  }
  // Cap XP to prevent overflow
  if (xp >= correctXpToNext) {
    console.warn(
      `[GameStorage] XP ${xp} exceeds xpToNextLevel ${correctXpToNext}, capping`,
    );
    xp = correctXpToNext - 1;
  }

  // Validate xpToNextLevel
  let xpToNextLevel = progression.xpToNextLevel;
  if (xpToNextLevel !== correctXpToNext) {
    console.warn(
      `[GameStorage] xpToNextLevel mismatch: ${xpToNextLevel} vs ${correctXpToNext}`,
    );
    xpToNextLevel = correctXpToNext;
  }

  // Validate stage
  let stage = progression.stage;
  if (stage !== correctStage) {
    console.warn(
      `[GameStorage] Stage mismatch for level ${level}: ${stage} vs ${correctStage}`,
    );
    stage = correctStage;
  }

  return {
    level,
    xp,
    xpToNextLevel,
    stage,
  };
}

/**
 * Validate and repair baby data
 */
function validateBaby(baby: GameSpark): GameSpark {
  // Validate progression
  const validatedProgression = validateSparkProgression(baby.progression);

  // Validate timestamps (ensure they exist and are valid)
  const now = Date.now();
  const createdAt =
    typeof baby.createdAt === "number" && baby.createdAt > 0
      ? baby.createdAt
      : now;
  const lastUpdated =
    typeof baby.lastUpdated === "number" && baby.lastUpdated > 0
      ? baby.lastUpdated
      : now;
  const lastMined =
    typeof baby.lastMined === "number" && baby.lastMined > 0
      ? baby.lastMined
      : createdAt;

  // Ensure miningSharesBaseline exists (migration for old babies)
  // Default to 0 for existing babies - they've already earned their XP legitimately
  const miningSharesBaseline =
    typeof baby.miningSharesBaseline === "number" &&
    baby.miningSharesBaseline >= 0
      ? baby.miningSharesBaseline
      : 0;

  return {
    ...baby,
    progression: validatedProgression,
    createdAt,
    lastUpdated,
    lastMined,
    miningSharesBaseline,
    // Ensure arrays exist
    evolutionHistory: Array.isArray(baby.evolutionHistory)
      ? baby.evolutionHistory
      : [],
    unlockedAchievements: Array.isArray(baby.unlockedAchievements)
      ? baby.unlockedAchievements
      : [],
  };
}

/**
 * Migrate old state to current version
 */
function migrateState(state: GameState): GameState {
  // Handle migrations between versions
  if (!state.version) {
    state.version = 1;
  }

  // Ensure all required fields exist
  if (!state.miningStats) {
    state.miningStats = DEFAULT_GAME_STATE.miningStats;
  }

  if (!state.settings) {
    state.settings = DEFAULT_GAME_STATE.settings;
  }

  // Ensure BigInt fields are proper BigInts
  if (typeof state.miningStats.totalTokensEarned !== "bigint") {
    const tokenValue = state.miningStats.totalTokensEarned as unknown;
    state.miningStats.totalTokensEarned = BigInt(
      tokenValue?.toString?.() || "0",
    );
  }

  // CRITICAL: Validate baby progression to prevent instant legend bug
  if (state.baby) {
    state.baby = validateBaby(state.baby);
  }

  return state;
}

export default GameStorage;
