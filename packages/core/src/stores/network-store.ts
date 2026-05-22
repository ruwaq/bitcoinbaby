/**
 * Network Configuration Store
 *
 * Professional network switching between testnet4 and mainnet.
 * Provides centralized network state with persistence.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type SupportedNetwork,
  type ScrollsNetwork,
  type NetworkEndpoints,
  NETWORK_ENDPOINTS,
  toScrollsNetwork,
} from "@bitcoinbaby/bitcoin";

// Re-export types for consumers
export type { SupportedNetwork, ScrollsNetwork };

/**
 * @deprecated Use SupportedNetwork instead
 */
export type BitcoinNetwork = SupportedNetwork;

/**
 * Network configuration with all endpoints
 * Extends shared NetworkEndpoints with additional UI/state properties
 */
export interface NetworkConfig extends NetworkEndpoints {
  /** Bitcoin network identifier */
  bitcoin: SupportedNetwork;
  /** Scrolls API network identifier */
  scrolls: ScrollsNetwork;
  /** Display name for UI */
  displayName: string;
  /** Is this a production network */
  isProduction: boolean;
  /** Minimum confirmations required */
  minConfirmations: number;
  /** BIP44/86 coin type (0 for mainnet, 1 for testnet) */
  coinType: number;
}

/**
 * Build NetworkConfig from shared endpoints
 */
function buildNetworkConfig(
  network: SupportedNetwork,
  displayName: string,
  isProduction: boolean,
  minConfirmations: number,
): NetworkConfig {
  const endpoints = NETWORK_ENDPOINTS[network];
  return {
    ...endpoints,
    bitcoin: network,
    scrolls: toScrollsNetwork(network),
    displayName,
    isProduction,
    minConfirmations,
    coinType: isProduction ? 0 : 1,
  };
}

/**
 * Predefined network configurations (using shared endpoints)
 */
export const NETWORK_CONFIGS: Record<SupportedNetwork, NetworkConfig> = {
  mainnet: buildNetworkConfig("mainnet", "Bitcoin Mainnet", true, 6),
  testnet4: buildNetworkConfig("testnet4", "Bitcoin Testnet4", false, 1),
  regtest: buildNetworkConfig("regtest", "Bitcoin Regtest (Local)", false, 1),
};

/**
 * Network store state
 */
interface NetworkState {
  /** Current active network */
  network: SupportedNetwork;
  /** Current network configuration */
  config: NetworkConfig;
  /** Whether mainnet is allowed (production mode) */
  mainnetAllowed: boolean;
  /** Loading state during network switch */
  isSwitching: boolean;
  /** Error message if switch failed */
  error: string | null;
}

/**
 * Network store actions
 */
interface NetworkActions {
  /** Switch to a different network */
  switchNetwork: (network: SupportedNetwork) => void;
  /** Enable/disable mainnet access */
  setMainnetAllowed: (allowed: boolean) => void;
  /** Get transaction URL for explorer */
  getTxUrl: (txid: string) => string;
  /** Get address URL for explorer */
  getAddressUrl: (address: string) => string;
  /** Reset to default network */
  reset: () => void;
}

type NetworkStore = NetworkState & NetworkActions;

/**
 * Default network (testnet4 for safety)
 */
const DEFAULT_NETWORK: SupportedNetwork = "testnet4";

/**
 * Network configuration store with persistence
 *
 * @example
 * ```tsx
 * const { network, config, switchNetwork } = useNetworkStore();
 *
 * // Switch to mainnet (if allowed)
 * switchNetwork('mainnet');
 *
 * // Get current API endpoints
 * console.log(config.mempoolApi);
 * ```
 */
export const useNetworkStore = create<NetworkStore>()(
  persist(
    (set, get) => ({
      // Initial state
      network: DEFAULT_NETWORK,
      config: NETWORK_CONFIGS[DEFAULT_NETWORK],
      mainnetAllowed: false, // Disabled by default for safety
      isSwitching: false,
      error: null,

      // Switch network
      switchNetwork: (network) => {
        const state = get();

        // Safety check: Don't allow mainnet unless explicitly enabled
        if (network === "mainnet" && !state.mainnetAllowed) {
          set({
            error: "Mainnet is not enabled. Enable production mode first.",
          });
          return;
        }

        // Validate network
        if (!NETWORK_CONFIGS[network]) {
          set({ error: `Unknown network: ${network}` });
          return;
        }

        set({
          network,
          config: NETWORK_CONFIGS[network],
          error: null,
        });
      },

      // Enable/disable mainnet
      setMainnetAllowed: (allowed) => {
        set({ mainnetAllowed: allowed });

        // If disabling mainnet and currently on mainnet, switch to testnet
        if (!allowed && get().network === "mainnet") {
          get().switchNetwork("testnet4");
        }
      },

      // Get transaction explorer URL
      getTxUrl: (txid) => {
        const { config } = get();
        return `${config.explorerUrl}/tx/${txid}`;
      },

      // Get address explorer URL
      getAddressUrl: (address) => {
        const { config } = get();
        return `${config.explorerUrl}/address/${address}`;
      },

      // Reset to defaults
      reset: () =>
        set({
          network: DEFAULT_NETWORK,
          config: NETWORK_CONFIGS[DEFAULT_NETWORK],
          mainnetAllowed: false,
          isSwitching: false,
          error: null,
        }),
    }),
    {
      name: "bitcoinbaby-network",
      storage: createJSONStorage(() => localStorage),
      // Only persist network selection and mainnet flag
      partialize: (state) => ({
        network: state.network,
        mainnetAllowed: state.mainnetAllowed,
      }),
      // Restore config on rehydration with validation
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Validate that the persisted network still exists in config
          const validNetwork = NETWORK_CONFIGS[state.network];
          if (!validNetwork) {
            console.warn(
              `[NetworkStore] Invalid network "${state.network}", resetting to default`,
            );
            state.network = DEFAULT_NETWORK;
            state.config = NETWORK_CONFIGS[DEFAULT_NETWORK];
          } else {
            state.config = validNetwork;
          }
        }
      },
    },
  ),
);

/**
 * Hook to get current network config (convenience)
 */
export function useNetworkConfig(): NetworkConfig {
  return useNetworkStore((state) => state.config);
}

/**
 * Check if currently on mainnet
 */
export function useIsMainnet(): boolean {
  return useNetworkStore((state) => state.network === "mainnet");
}

/**
 * Get network-aware derivation path
 */
export function getDerivationPath(
  addressType: "taproot" | "segwit" | "legacy",
  config: NetworkConfig,
  addressIndex: number = 0,
): string {
  const purpose =
    addressType === "taproot" ? 86 : addressType === "segwit" ? 84 : 44;
  return `m/${purpose}'/${config.coinType}'/0'/0/${addressIndex}`;
}
