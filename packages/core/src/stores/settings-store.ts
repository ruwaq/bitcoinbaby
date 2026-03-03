/**
 * Settings Store
 *
 * Application-wide settings with persistence.
 * Manages mining, display, security, and network preferences.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Mining difficulty levels
 */
export type MiningDifficulty = "easy" | "medium" | "hard";

/**
 * Miner type preference
 */
export type MinerTypePreference = "auto" | "cpu" | "gpu";

/**
 * Auto-lock timeout options (in milliseconds)
 */
export type AutoLockTimeout = 60000 | 300000 | 900000 | 0; // 1min, 5min, 15min, never

/**
 * Explorer preference
 */
export type ExplorerPreference = "mempool" | "blockstream" | "custom";

/**
 * Theme preference (future-proof)
 */
export type ThemePreference = "dark" | "light" | "system";

/**
 * Mining settings
 */
export interface MiningSettings {
  /** Mining difficulty level */
  difficulty: MiningDifficulty;
  /** Preferred miner type */
  minerType: MinerTypePreference;
  /** Auto-submit mining proofs */
  autoSubmit: boolean;
  /** Allow background mining (future) */
  backgroundMining: boolean;
}

/**
 * Network settings
 */
export interface NetworkSettings {
  /** Custom RPC endpoint (advanced) */
  customRpcUrl: string | null;
  /** Explorer preference */
  explorerPreference: ExplorerPreference;
  /** Custom explorer URL (if explorerPreference is 'custom') */
  customExplorerUrl: string | null;
}

/**
 * Display settings
 */
export interface DisplaySettings {
  /** Theme preference */
  theme: ThemePreference;
  /** Sound effects enabled */
  soundEnabled: boolean;
  /** Notifications enabled */
  notificationsEnabled: boolean;
}

/**
 * Security settings
 */
export interface SecuritySettings {
  /** Auto-lock timeout */
  autoLockTimeout: AutoLockTimeout;
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Complete settings state
 */
export interface SettingsState {
  mining: MiningSettings;
  network: NetworkSettings;
  display: DisplaySettings;
  security: SecuritySettings;
  /** Version for migrations */
  version: number;
}

/**
 * Settings store actions
 */
interface SettingsActions {
  // Mining actions
  setMiningDifficulty: (difficulty: MiningDifficulty) => void;
  setMinerType: (type: MinerTypePreference) => void;
  setAutoSubmit: (enabled: boolean) => void;
  setBackgroundMining: (enabled: boolean) => void;

  // Network actions
  setCustomRpcUrl: (url: string | null) => void;
  setExplorerPreference: (pref: ExplorerPreference) => void;
  setCustomExplorerUrl: (url: string | null) => void;

  // Display actions
  setTheme: (theme: ThemePreference) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;

  // Security actions
  setAutoLockTimeout: (timeout: AutoLockTimeout) => void;
  updateLastActivity: () => void;
  shouldAutoLock: () => boolean;

  // General actions
  resetMiningSettings: () => void;
  resetNetworkSettings: () => void;
  resetDisplaySettings: () => void;
  resetSecuritySettings: () => void;
  resetAllSettings: () => void;
}

type SettingsStore = SettingsState & SettingsActions;

/**
 * Default settings
 */
const defaultMiningSettings: MiningSettings = {
  difficulty: "medium",
  minerType: "auto",
  autoSubmit: true,
  backgroundMining: false,
};

const defaultNetworkSettings: NetworkSettings = {
  customRpcUrl: null,
  explorerPreference: "mempool",
  customExplorerUrl: null,
};

const defaultDisplaySettings: DisplaySettings = {
  theme: "dark",
  soundEnabled: true,
  notificationsEnabled: true,
};

const defaultSecuritySettings: SecuritySettings = {
  autoLockTimeout: 300000, // 5 minutes
  lastActivity: Date.now(),
};

const SETTINGS_VERSION = 1;

/**
 * Settings store with localStorage persistence
 *
 * @example
 * ```tsx
 * const { mining, setMiningDifficulty } = useSettingsStore();
 *
 * // Update difficulty
 * setMiningDifficulty('hard');
 *
 * // Check current settings
 * console.log(mining.difficulty); // 'hard'
 * ```
 */
export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      // Initial state
      mining: defaultMiningSettings,
      network: defaultNetworkSettings,
      display: defaultDisplaySettings,
      security: defaultSecuritySettings,
      version: SETTINGS_VERSION,

      // Mining actions
      setMiningDifficulty: (difficulty) =>
        set((state) => ({
          mining: { ...state.mining, difficulty },
        })),

      setMinerType: (minerType) =>
        set((state) => ({
          mining: { ...state.mining, minerType },
        })),

      setAutoSubmit: (autoSubmit) =>
        set((state) => ({
          mining: { ...state.mining, autoSubmit },
        })),

      setBackgroundMining: (backgroundMining) =>
        set((state) => ({
          mining: { ...state.mining, backgroundMining },
        })),

      // Network actions
      setCustomRpcUrl: (customRpcUrl) =>
        set((state) => ({
          network: { ...state.network, customRpcUrl },
        })),

      setExplorerPreference: (explorerPreference) =>
        set((state) => ({
          network: { ...state.network, explorerPreference },
        })),

      setCustomExplorerUrl: (customExplorerUrl) =>
        set((state) => ({
          network: { ...state.network, customExplorerUrl },
        })),

      // Display actions
      setTheme: (theme) =>
        set((state) => ({
          display: { ...state.display, theme },
        })),

      setSoundEnabled: (soundEnabled) =>
        set((state) => ({
          display: { ...state.display, soundEnabled },
        })),

      setNotificationsEnabled: (notificationsEnabled) =>
        set((state) => ({
          display: { ...state.display, notificationsEnabled },
        })),

      // Security actions
      setAutoLockTimeout: (autoLockTimeout) =>
        set((state) => ({
          security: { ...state.security, autoLockTimeout },
        })),

      updateLastActivity: () =>
        set((state) => ({
          security: { ...state.security, lastActivity: Date.now() },
        })),

      shouldAutoLock: () => {
        const { security } = get();
        if (security.autoLockTimeout === 0) return false;
        return Date.now() - security.lastActivity > security.autoLockTimeout;
      },

      // Reset actions
      resetMiningSettings: () => set({ mining: defaultMiningSettings }),

      resetNetworkSettings: () => set({ network: defaultNetworkSettings }),

      resetDisplaySettings: () => set({ display: defaultDisplaySettings }),

      resetSecuritySettings: () => set({ security: defaultSecuritySettings }),

      resetAllSettings: () =>
        set({
          mining: defaultMiningSettings,
          network: defaultNetworkSettings,
          display: defaultDisplaySettings,
          security: defaultSecuritySettings,
        }),
    }),
    {
      name: "bitcoinbaby-settings",
      storage: createJSONStorage(() => localStorage),
      version: SETTINGS_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<SettingsState>;
        // Handle migrations if needed in the future
        if (version === 0) {
          // Migration from version 0 to 1
          return {
            mining: state.mining ?? defaultMiningSettings,
            network: state.network ?? defaultNetworkSettings,
            display: state.display ?? defaultDisplaySettings,
            security: state.security ?? defaultSecuritySettings,
            version: SETTINGS_VERSION,
          } as SettingsState;
        }
        return persistedState as SettingsState;
      },
    },
  ),
);

/**
 * Difficulty to numeric value mapping
 */
export const DIFFICULTY_VALUES: Record<MiningDifficulty, number> = {
  easy: 12,
  medium: 16,
  hard: 20,
};

/**
 * Auto-lock timeout labels
 */
export const AUTO_LOCK_LABELS: Record<AutoLockTimeout, string> = {
  60000: "1 minute",
  300000: "5 minutes",
  900000: "15 minutes",
  0: "Never",
};

/**
 * Get difficulty numeric value
 */
export function getDifficultyValue(difficulty: MiningDifficulty): number {
  return DIFFICULTY_VALUES[difficulty];
}

/**
 * Hook for mining settings only
 */
export function useMiningSettings(): MiningSettings {
  return useSettingsStore((state) => state.mining);
}

/**
 * Hook for display settings only
 */
export function useDisplaySettings(): DisplaySettings {
  return useSettingsStore((state) => state.display);
}

/**
 * Hook for security settings only
 */
export function useSecuritySettings(): SecuritySettings {
  return useSettingsStore((state) => state.security);
}

/**
 * Get auto-lock timeout value
 */
export function useAutoLockTimeout(): number {
  return useSettingsStore((state) => state.security.autoLockTimeout);
}

/**
 * Get auto-lock enabled status (0 means disabled)
 */
export function useAutoLockEnabled(): boolean {
  return useSettingsStore((state) => state.security.autoLockTimeout !== 0);
}
