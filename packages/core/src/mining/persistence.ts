/**
 * Mining State Persistence
 *
 * Uses IndexedDB to persist mining state across browser sessions.
 * This allows mining to resume from where it left off after:
 * - Closing and reopening the browser
 * - Page refresh
 * - Tab crash
 *
 * Critical for user experience - no lost progress!
 */

// =============================================================================
// TYPES
// =============================================================================

export interface PersistedMiningState {
  /** Last nonce used in mining */
  lastNonce: number;
  /** Total hashes computed across all sessions */
  totalHashes: number;
  /** Total shares found across all sessions */
  totalShares: number;
  /** Current difficulty setting */
  difficulty: number;
  /** Last block data being mined */
  lastBlockData: string;
  /** Timestamp of last save */
  lastSavedAt: number;
  /** Total session uptime in seconds */
  sessionUptime: number;
  /** Accumulated tokens/rewards */
  tokensEarned: number;
}

export interface PersistedSession {
  /** Unique session ID */
  id: string;
  /** Session start timestamp */
  startedAt: number;
  /** Session end timestamp (null if ongoing) */
  endedAt: number | null;
  /** Hashes in this session */
  hashes: number;
  /** Shares in this session */
  shares: number;
  /** Duration in seconds */
  duration: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

import { MIN_DIFFICULTY } from "../tokenomics/constants";

const DB_NAME = "bitcoinbaby-mining";
const DB_VERSION = 1;
const STORE_STATE = "mining-state";
const STORE_SESSIONS = "mining-sessions";
const STATE_KEY = "current";

// localStorage fallback keys
const LS_STATE_KEY = "bitcoinbaby-mining-state";
const LS_SESSIONS_KEY = "bitcoinbaby-mining-sessions";

// =============================================================================
// PERSISTENCE CLASS
// =============================================================================

export class MiningStatePersistence {
  private db: IDBDatabase | null = null;
  private saveInterval: ReturnType<typeof setInterval> | null = null;
  private isOpen = false;
  private useLocalStorageFallback = false;

  /**
   * Open the IndexedDB database (with localStorage fallback)
   */
  async open(): Promise<void> {
    if (this.isOpen) return;

    // Check if IndexedDB is available
    if (typeof indexedDB === "undefined") {
      console.warn(
        "[Persistence] IndexedDB not available, using localStorage fallback",
      );
      this.useLocalStorageFallback = true;
      this.isOpen = true;
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // State store
          if (!db.objectStoreNames.contains(STORE_STATE)) {
            db.createObjectStore(STORE_STATE);
          }

          // Sessions store
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            const sessionsStore = db.createObjectStore(STORE_SESSIONS, {
              keyPath: "id",
            });
            sessionsStore.createIndex("startedAt", "startedAt", {
              unique: false,
            });
          }
        };

        request.onsuccess = (event) => {
          this.db = (event.target as IDBOpenDBRequest).result;
          this.isOpen = true;
          console.log("[Persistence] IndexedDB opened successfully");
          resolve();
        };

        request.onerror = () => {
          console.warn(
            "[Persistence] IndexedDB failed, using localStorage fallback:",
            request.error,
          );
          this.useLocalStorageFallback = true;
          this.isOpen = true;
          resolve();
        };

        // Handle blocked scenario (e.g., private browsing)
        request.onblocked = () => {
          console.warn(
            "[Persistence] IndexedDB blocked, using localStorage fallback",
          );
          this.useLocalStorageFallback = true;
          this.isOpen = true;
          resolve();
        };
      } catch (err) {
        // Catch any sync errors (e.g., SecurityError in private mode)
        console.warn(
          "[Persistence] IndexedDB exception, using localStorage fallback:",
          err,
        );
        this.useLocalStorageFallback = true;
        this.isOpen = true;
        resolve();
      }
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.stopAutoSave();
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isOpen = false;
    }
  }

  /**
   * Save mining state
   */
  async saveState(state: PersistedMiningState): Promise<void> {
    const stateToSave = { ...state, lastSavedAt: Date.now() };

    // Use localStorage fallback
    if (this.useLocalStorageFallback) {
      try {
        localStorage.setItem(LS_STATE_KEY, JSON.stringify(stateToSave));
      } catch (err) {
        console.warn("[Persistence] localStorage save failed:", err);
      }
      return;
    }

    if (!this.db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(STORE_STATE, "readwrite");
        const store = tx.objectStore(STORE_STATE);
        const request = store.put(stateToSave, STATE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          // Fallback to localStorage on IndexedDB error
          console.warn(
            "[Persistence] IndexedDB save failed, trying localStorage",
          );
          try {
            localStorage.setItem(LS_STATE_KEY, JSON.stringify(stateToSave));
            resolve();
          } catch (lsErr) {
            reject(lsErr);
          }
        };
      } catch (err) {
        // Fallback to localStorage on exception
        try {
          localStorage.setItem(LS_STATE_KEY, JSON.stringify(stateToSave));
        } catch (lsErr) {
          reject(lsErr);
        }
      }
    });
  }

  /**
   * Load mining state
   */
  async loadState(): Promise<PersistedMiningState | null> {
    // Use localStorage fallback
    if (this.useLocalStorageFallback) {
      return this.loadStateFromLocalStorage();
    }

    if (!this.db) {
      // Try localStorage as last resort
      return this.loadStateFromLocalStorage();
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_STATE, "readonly");
        const store = tx.objectStore(STORE_STATE);
        const request = store.get(STATE_KEY);

        request.onsuccess = () => {
          const result = request.result ?? null;
          // If IndexedDB is empty, check localStorage (migration)
          if (!result) {
            const lsState = this.loadStateFromLocalStorage();
            if (lsState) {
              console.log(
                "[Persistence] Migrating state from localStorage to IndexedDB",
              );
              this.saveState(lsState);
            }
            resolve(lsState);
          } else {
            resolve(result);
          }
        };
        request.onerror = () => {
          console.warn(
            "[Persistence] IndexedDB load failed, trying localStorage",
          );
          resolve(this.loadStateFromLocalStorage());
        };
      } catch (err) {
        console.warn(
          "[Persistence] Exception during load, trying localStorage:",
          err,
        );
        resolve(this.loadStateFromLocalStorage());
      }
    });
  }

  /**
   * Load state from localStorage (fallback)
   */
  private loadStateFromLocalStorage(): PersistedMiningState | null {
    try {
      const data = localStorage.getItem(LS_STATE_KEY);
      if (data) {
        return JSON.parse(data) as PersistedMiningState;
      }
    } catch (err) {
      console.warn("[Persistence] localStorage load failed:", err);
    }
    return null;
  }

  /**
   * Clear saved state
   */
  async clearState(): Promise<void> {
    // Always clear localStorage (for migration cleanup)
    try {
      localStorage.removeItem(LS_STATE_KEY);
    } catch {
      // Ignore localStorage errors
    }

    // Use localStorage fallback only
    if (this.useLocalStorageFallback || !this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(STORE_STATE, "readwrite");
        const store = tx.objectStore(STORE_STATE);
        const request = store.delete(STATE_KEY);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Start auto-saving state at regular intervals
   */
  startAutoSave(
    getState: () => Partial<PersistedMiningState>,
    intervalMs: number = 10_000,
  ): void {
    this.stopAutoSave();

    this.saveInterval = setInterval(async () => {
      try {
        const currentState = getState();
        const savedState = (await this.loadState()) || this.getDefaultState();

        await this.saveState({
          ...savedState,
          ...currentState,
          lastSavedAt: Date.now(),
        });
      } catch (err) {
        console.warn("[Persistence] Auto-save failed:", err);
      }
    }, intervalMs);

    console.log(
      `[Persistence] Auto-save started (every ${intervalMs / 1000}s)`,
    );
  }

  /**
   * Stop auto-saving
   */
  stopAutoSave(): void {
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
      console.log("[Persistence] Auto-save stopped");
    }
  }

  /**
   * Save a completed mining session
   */
  async saveSession(session: PersistedSession): Promise<void> {
    // Use localStorage fallback
    if (this.useLocalStorageFallback || !this.db) {
      try {
        const sessions = this.loadSessionsFromLocalStorage();
        sessions.push(session);
        // Keep only last 100 sessions in localStorage to avoid quota issues
        const trimmed = sessions.slice(-100);
        localStorage.setItem(LS_SESSIONS_KEY, JSON.stringify(trimmed));
      } catch (err) {
        console.warn("[Persistence] localStorage session save failed:", err);
      }
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db!.transaction(STORE_SESSIONS, "readwrite");
        const store = tx.objectStore(STORE_SESSIONS);
        const request = store.add(session);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          // Fallback to localStorage
          try {
            const sessions = this.loadSessionsFromLocalStorage();
            sessions.push(session);
            localStorage.setItem(
              LS_SESSIONS_KEY,
              JSON.stringify(sessions.slice(-100)),
            );
            resolve();
          } catch (lsErr) {
            reject(lsErr);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Load sessions from localStorage (fallback)
   */
  private loadSessionsFromLocalStorage(): PersistedSession[] {
    try {
      const data = localStorage.getItem(LS_SESSIONS_KEY);
      if (data) {
        return JSON.parse(data) as PersistedSession[];
      }
    } catch (err) {
      console.warn("[Persistence] localStorage sessions load failed:", err);
    }
    return [];
  }

  /**
   * Get recent mining sessions
   */
  async getRecentSessions(limit: number = 10): Promise<PersistedSession[]> {
    // Use localStorage fallback
    if (this.useLocalStorageFallback || !this.db) {
      const sessions = this.loadSessionsFromLocalStorage();
      // Sort by startedAt descending and limit
      return sessions.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit);
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db!.transaction(STORE_SESSIONS, "readonly");
        const store = tx.objectStore(STORE_SESSIONS);
        const index = store.index("startedAt");
        const request = index.openCursor(null, "prev");
        const sessions: PersistedSession[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>)
            .result;
          if (cursor && sessions.length < limit) {
            sessions.push(cursor.value);
            cursor.continue();
          } else {
            // Merge with localStorage sessions if any (migration)
            const lsSessions = this.loadSessionsFromLocalStorage();
            if (lsSessions.length > 0 && sessions.length === 0) {
              resolve(
                lsSessions
                  .sort((a, b) => b.startedAt - a.startedAt)
                  .slice(0, limit),
              );
            } else {
              resolve(sessions);
            }
          }
        };

        request.onerror = () => {
          console.warn(
            "[Persistence] IndexedDB sessions load failed, using localStorage",
          );
          const lsSessions = this.loadSessionsFromLocalStorage();
          resolve(
            lsSessions
              .sort((a, b) => b.startedAt - a.startedAt)
              .slice(0, limit),
          );
        };
      } catch (err) {
        console.warn("[Persistence] Exception loading sessions:", err);
        const lsSessions = this.loadSessionsFromLocalStorage();
        resolve(
          lsSessions.sort((a, b) => b.startedAt - a.startedAt).slice(0, limit),
        );
      }
    });
  }

  /**
   * Get lifetime mining statistics
   */
  async getLifetimeStats(): Promise<{
    totalHashes: number;
    totalShares: number;
    totalDuration: number;
    sessionCount: number;
  }> {
    const sessions = await this.getRecentSessions(1000);
    const state = await this.loadState();

    return {
      totalHashes:
        sessions.reduce((sum, s) => sum + s.hashes, 0) +
        (state?.totalHashes || 0),
      totalShares:
        sessions.reduce((sum, s) => sum + s.shares, 0) +
        (state?.totalShares || 0),
      totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
      sessionCount: sessions.length,
    };
  }

  /**
   * Get default state
   */
  private getDefaultState(): PersistedMiningState {
    return {
      lastNonce: 0,
      totalHashes: 0,
      totalShares: 0,
      difficulty: MIN_DIFFICULTY,
      lastBlockData: "",
      lastSavedAt: Date.now(),
      sessionUptime: 0,
      tokensEarned: 0,
    };
  }

  /**
   * Check if persistence is available
   */
  isAvailable(): boolean {
    return (
      typeof indexedDB !== "undefined" || typeof localStorage !== "undefined"
    );
  }

  /**
   * Get the current storage backend being used
   */
  getStorageBackend(): "indexeddb" | "localstorage" | "none" {
    if (this.useLocalStorageFallback) {
      return typeof localStorage !== "undefined" ? "localstorage" : "none";
    }
    return this.db ? "indexeddb" : "none";
  }

  /**
   * Check if using fallback storage
   */
  isUsingFallback(): boolean {
    return this.useLocalStorageFallback;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let persistenceInstance: MiningStatePersistence | null = null;

export function getMiningPersistence(): MiningStatePersistence {
  if (!persistenceInstance) {
    persistenceInstance = new MiningStatePersistence();
  }
  return persistenceInstance;
}

export async function initMiningPersistence(): Promise<MiningStatePersistence> {
  const persistence = getMiningPersistence();
  await persistence.open();
  return persistence;
}
