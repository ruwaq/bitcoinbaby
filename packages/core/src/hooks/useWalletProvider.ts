/**
 * useWalletProvider Hook
 *
 * React hook for interacting with Bitcoin wallet providers.
 * Supports multiple wallet types (internal, Unisat, XVerse, etc.)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  type WalletProvider,
  type WalletProviderType,
  type WalletAccount,
  type WalletConnectionState,
  type DetectedProvider,
  type SignedMessage,
  type SignedPsbt,
  type ProviderBroadcastResult,
  type SignPsbtOptions,
  type BitcoinNetwork,
  detectWallets,
  getProvider,
  getAvailableProviders,
  getBestProvider,
} from "@bitcoinbaby/bitcoin";
import { useWalletStore } from "../stores/wallet-store";

/**
 * Hook state
 */
interface UseWalletProviderState extends WalletConnectionState {
  availableProviders: DetectedProvider[];
}

/**
 * Hook actions
 */
interface UseWalletProviderActions {
  /**
   * Connect to a specific wallet provider
   */
  connect: (type: WalletProviderType, options?: ConnectParams) => Promise<void>;

  /**
   * Connect to the best available provider
   */
  connectBest: () => Promise<void>;

  /**
   * Disconnect from current wallet
   */
  disconnect: () => Promise<void>;

  /**
   * Sign a message
   */
  signMessage: (message: string) => Promise<SignedMessage>;

  /**
   * Sign a PSBT
   */
  signPsbt: (psbt: string, options?: SignPsbtOptions) => Promise<SignedPsbt>;

  /**
   * Sign and broadcast a transaction
   */
  signAndBroadcast: (psbt: string) => Promise<ProviderBroadcastResult>;

  /**
   * Get balance in satoshis
   */
  getBalance: () => Promise<bigint>;

  /**
   * Switch network (if supported)
   */
  switchNetwork: (network: BitcoinNetwork) => Promise<void>;

  /**
   * Refresh available providers
   */
  refreshProviders: () => void;
}

interface ConnectParams {
  password?: string;
  mnemonic?: string;
}

export type UseWalletProviderReturn = UseWalletProviderState &
  UseWalletProviderActions;

/**
 * React hook for wallet provider management
 */
export function useWalletProvider(): UseWalletProviderReturn {
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [account, setAccount] = useState<WalletAccount | null>(null);
  const [network, setNetwork] = useState<BitcoinNetwork>("testnet4");
  const [providerType, setProviderType] = useState<WalletProviderType | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<
    DetectedProvider[]
  >([]);

  // Current provider instance
  const [provider, setProvider] = useState<WalletProvider | null>(null);

  // Store cleanup functions for provider event listeners
  const listenerCleanupRef = useRef<{
    accountChange: (() => void) | null;
    networkChange: (() => void) | null;
  }>({
    accountChange: null,
    networkChange: null,
  });

  // Wallet store sync (for global access to signing functions)
  const storeSetWallet = useWalletStore((s) => s.setWallet);
  const storeDisconnect = useWalletStore((s) => s.disconnect);
  const storeSetSigningFunctions = useWalletStore((s) => s.setSigningFunctions);

  // Detect available providers on mount
  useEffect(() => {
    refreshProviders();
  }, []);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (listenerCleanupRef.current.accountChange) {
        listenerCleanupRef.current.accountChange();
      }
      if (listenerCleanupRef.current.networkChange) {
        listenerCleanupRef.current.networkChange();
      }
    };
  }, []);

  // Refresh available providers
  const refreshProviders = useCallback(() => {
    const detected = detectWallets();
    setAvailableProviders(detected);
  }, []);

  // Connect to a specific provider
  const connect = useCallback(
    async (type: WalletProviderType, options?: ConnectParams) => {
      setIsConnecting(true);
      setError(null);

      try {
        const walletProvider = getProvider(type);
        if (!walletProvider) {
          throw new Error(`Provider ${type} not found`);
        }

        if (!walletProvider.isAvailable()) {
          throw new Error(`Provider ${type} is not available`);
        }

        const connectedAccount = await walletProvider.connect({
          password: options?.password,
          mnemonic: options?.mnemonic,
        });

        const connectedNetwork = await walletProvider.getNetwork();

        setProvider(walletProvider);
        setAccount(connectedAccount);
        setNetwork(connectedNetwork);
        setProviderType(type);
        setIsConnected(true);

        // Sync with global wallet store for cross-component access
        storeSetWallet({
          address: connectedAccount.address,
          publicKey: connectedAccount.publicKey,
          balance: 0n, // Will be updated by balance hook
          babyTokens: 0n, // Will be updated by token balance hook
        });

        // Set up signing functions in store for components like useMintNFT
        storeSetSigningFunctions(
          // signPsbt wrapper that returns signed hex
          async (psbtHex: string) => {
            const result = await walletProvider.signPsbt(psbtHex, {
              finalize: true,
            });
            return result.signedPsbtHex;
          },
          // broadcastTx wrapper (optional)
          async (txHex: string) => {
            const result = await walletProvider.signAndBroadcast(txHex);
            return result.success ? result.txid : null;
          },
        );

        // Set up listeners if available - store cleanup functions for disconnect
        if (walletProvider.onAccountChange) {
          const cleanup = walletProvider.onAccountChange((newAccount) => {
            setAccount(newAccount);
            if (!newAccount) {
              setIsConnected(false);
              setProviderType(null);
            }
          });
          listenerCleanupRef.current.accountChange = cleanup;
        }

        if (walletProvider.onNetworkChange) {
          const cleanup = walletProvider.onNetworkChange((newNetwork) => {
            setNetwork(newNetwork);
          });
          listenerCleanupRef.current.networkChange = cleanup;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Connection failed";
        setError(message);
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [storeSetWallet, storeSetSigningFunctions],
  );

  // Connect to the best available provider
  const connectBest = useCallback(async () => {
    const best = getBestProvider();
    if (!best) {
      throw new Error("No wallet providers available");
    }
    await connect(best.type);
  }, [connect]);

  // Disconnect
  const disconnect = useCallback(async () => {
    // Clean up event listeners to prevent memory leaks
    if (listenerCleanupRef.current.accountChange) {
      listenerCleanupRef.current.accountChange();
      listenerCleanupRef.current.accountChange = null;
    }
    if (listenerCleanupRef.current.networkChange) {
      listenerCleanupRef.current.networkChange();
      listenerCleanupRef.current.networkChange = null;
    }

    if (provider) {
      await provider.disconnect();
    }

    setProvider(null);
    setAccount(null);
    setIsConnected(false);
    setProviderType(null);
    setError(null);

    // Clear global wallet store
    storeDisconnect();
  }, [provider, storeDisconnect]);

  // Sign message
  const signMessage = useCallback(
    async (message: string): Promise<SignedMessage> => {
      if (!provider || !isConnected) {
        throw new Error("Wallet not connected");
      }
      return provider.signMessage(message);
    },
    [provider, isConnected],
  );

  // Sign PSBT
  const signPsbt = useCallback(
    async (psbt: string, options?: SignPsbtOptions): Promise<SignedPsbt> => {
      if (!provider || !isConnected) {
        throw new Error("Wallet not connected");
      }
      return provider.signPsbt(psbt, options);
    },
    [provider, isConnected],
  );

  // Sign and broadcast
  const signAndBroadcast = useCallback(
    async (psbt: string): Promise<ProviderBroadcastResult> => {
      if (!provider || !isConnected) {
        throw new Error("Wallet not connected");
      }
      return provider.signAndBroadcast(psbt);
    },
    [provider, isConnected],
  );

  // Get balance
  const getBalance = useCallback(async (): Promise<bigint> => {
    if (!provider || !isConnected) {
      throw new Error("Wallet not connected");
    }
    if (!provider.getBalance) {
      throw new Error("Provider does not support balance queries");
    }
    return provider.getBalance();
  }, [provider, isConnected]);

  // Switch network
  const switchNetwork = useCallback(
    async (newNetwork: BitcoinNetwork): Promise<void> => {
      if (!provider || !isConnected) {
        throw new Error("Wallet not connected");
      }
      if (!provider.switchNetwork) {
        throw new Error("Provider does not support network switching");
      }
      await provider.switchNetwork(newNetwork);
      setNetwork(newNetwork);
    },
    [provider, isConnected],
  );

  return useMemo(
    () => ({
      // State
      isConnected,
      isConnecting,
      account,
      network,
      providerType,
      error,
      availableProviders,
      // Actions
      connect,
      connectBest,
      disconnect,
      signMessage,
      signPsbt,
      signAndBroadcast,
      getBalance,
      switchNetwork,
      refreshProviders,
    }),
    [
      isConnected,
      isConnecting,
      account,
      network,
      providerType,
      error,
      availableProviders,
      connect,
      connectBest,
      disconnect,
      signMessage,
      signPsbt,
      signAndBroadcast,
      getBalance,
      switchNetwork,
      refreshProviders,
    ],
  );
}

export default useWalletProvider;
