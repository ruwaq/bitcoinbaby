"use client";

/**
 * useWallet Hook
 *
 * Comprehensive wallet management hook that integrates:
 * - BitcoinWallet for HD wallet operations
 * - SecureStorage for encrypted mnemonic storage
 * - NetworkStore for testnet4/mainnet switching
 * - Balance tracking via useBalance
 *
 * Follows security best practices for Bitcoin wallet handling.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BitcoinWallet,
  createMempoolClient,
  type WalletInfo as BitcoinWalletInfo,
  type BitcoinNetwork,
} from "@bitcoinbaby/bitcoin";
import {
  SecureStorage,
  useNetworkStore,
  useWalletStore,
  type WalletMetadata,
  type WalletInfo as CoreWalletInfo,
} from "@bitcoinbaby/core";

// Re-export BitcoinWalletInfo as the public WalletInfo type
type WalletInfo = BitcoinWalletInfo;

/**
 * Convert bitcoin WalletInfo to core WalletInfo for store
 */
function toStoreWalletInfo(info: BitcoinWalletInfo): CoreWalletInfo {
  return {
    address: info.address,
    publicKey: info.publicKey,
    balance: BigInt(0), // Will be updated by useBalance
    babyTokens: BigInt(0), // Will be updated by useTokenBalance
  };
}

// =============================================================================
// MODULE-LEVEL WALLET SINGLETON
// =============================================================================
// This persists across component unmounts (tab switching, navigation)
// The wallet instance and info are stored here so they survive React lifecycle

interface WalletSingleton {
  instance: BitcoinWallet | null;
  info: WalletInfo | null;
}

const walletSingleton: WalletSingleton = {
  instance: null,
  info: null,
};

// Custom event name for wallet singleton changes
export const WALLET_SINGLETON_CHANGE_EVENT = "wallet-singleton-change";

/**
 * Dispatch a custom event when wallet singleton changes
 * This allows AppInitializer to react immediately without polling
 */
function dispatchWalletChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WALLET_SINGLETON_CHANGE_EVENT));
  }
}

/**
 * Store wallet in singleton (called when unlocking)
 */
function setWalletSingleton(wallet: BitcoinWallet, info: WalletInfo): void {
  walletSingleton.instance = wallet;
  walletSingleton.info = info;
  dispatchWalletChange();
}

/**
 * Clear wallet singleton completely (called when deleting wallet)
 */
function clearWalletSingleton(): void {
  if (walletSingleton.instance) {
    walletSingleton.instance.clear();
  }
  walletSingleton.instance = null;
  walletSingleton.info = null;
  dispatchWalletChange();
}

/**
 * Clear wallet instance but keep info (called when locking)
 * This allows the wallet to be unlocked again without losing address info
 */
function lockWalletSingleton(): void {
  if (walletSingleton.instance) {
    walletSingleton.instance.clear();
  }
  walletSingleton.instance = null;
  // Keep walletSingleton.info so we can show "locked" state with address
  dispatchWalletChange();
}

/**
 * Get wallet from singleton (called on component mount)
 */
function getWalletSingleton(): WalletSingleton {
  return walletSingleton;
}

/**
 * Check if wallet singleton has wallet info (for external sync)
 * Returns true if we have wallet info (even if locked - instance may be null)
 * This allows other components to check if wallet should be shown as connected
 */
export function isWalletSingletonActive(): boolean {
  return walletSingleton.info !== null;
}

/**
 * Get wallet info from singleton (for sync purposes)
 * Returns null if no wallet is active
 */
export function getWalletSingletonInfo(): WalletInfo | null {
  return walletSingleton.info;
}

/**
 * Wallet state
 */
interface WalletState {
  /** Wallet public info */
  wallet: WalletInfo | null;
  /** Whether wallet is loaded */
  isLoaded: boolean;
  /** Whether a wallet exists in storage */
  hasStoredWallet: boolean;
  /** Wallet metadata from secure storage */
  metadata: WalletMetadata | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Whether wallet is locked (needs password) */
  isLocked: boolean;
}

/**
 * Wallet actions
 */
interface WalletActions {
  /** Create a new wallet (optionally with pre-generated mnemonic from entropy) */
  createWallet: (
    password: string,
    wordCount?: 12 | 24,
    preGeneratedMnemonic?: string,
  ) => Promise<string>;
  /** Import wallet from mnemonic */
  importWallet: (mnemonic: string, password: string) => Promise<void>;
  /** Unlock wallet with password */
  unlock: (password: string) => Promise<void>;
  /** Lock wallet (clear from memory) */
  lock: () => void;
  /** Delete wallet from storage */
  deleteWallet: () => Promise<void>;
  /** Change wallet password */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  /** Get private key for signing (USE WITH CAUTION) */
  getPrivateKeyForSigning: () => Uint8Array | null;
  /** Sign a PSBT */
  signPSBT: (psbtBase64: string) => Promise<string>;
  /** Export backup */
  exportBackup: () => Promise<string | null>;
  /** Import backup */
  importBackup: (backup: string, password: string) => Promise<void>;
  /** Refresh wallet state */
  refresh: () => Promise<void>;
}

type UseWalletReturn = WalletState & WalletActions;

/**
 * Map network store type to bitcoin package type
 */
function mapNetwork(network: "mainnet" | "testnet4"): BitcoinNetwork {
  return network;
}

/**
 * useWallet Hook
 *
 * @example
 * ```tsx
 * const {
 *   wallet,
 *   isLoaded,
 *   isLocked,
 *   createWallet,
 *   unlock,
 *   lock,
 * } = useWallet();
 *
 * // Create new wallet
 * const mnemonic = await createWallet('myPassword123');
 *
 * // Unlock existing wallet
 * await unlock('myPassword123');
 *
 * // Lock wallet when done
 * lock();
 * ```
 */
export function useWallet(): UseWalletReturn {
  // Network configuration
  const { network } = useNetworkStore();
  const {
    setWallet: setStoreWallet,
    disconnect: disconnectStore,
    setLocked: setStoreLocked,
    setSigningFunctions: storeSetSigningFunctions,
  } = useWalletStore();

  // Internal wallet instance
  const walletRef = useRef<BitcoinWallet | null>(null);

  // Track initial network to prevent locking on mount
  const initialNetworkRef = useRef<string | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Set up signing functions in global store
   * Must be called after wallet is ready
   */
  const setupSigningFunctions = useCallback(() => {
    if (!walletRef.current) return;

    const signPsbtFn = async (psbtHex: string): Promise<string | null> => {
      if (!walletRef.current) return null;

      try {
        const { Psbt } = await import("@bitcoinbaby/bitcoin");
        const psbt = Psbt.fromHex(psbtHex);
        const signedPsbt = walletRef.current.signPSBT(psbt);
        signedPsbt.finalizeAllInputs();
        return signedPsbt.toHex();
      } catch (error) {
        console.error("Failed to sign PSBT:", error);
        return null;
      }
    };

    // Broadcast transaction to mempool
    const broadcastTxFn = async (txHex: string): Promise<string | null> => {
      try {
        const mempoolClient = createMempoolClient({ network });
        const txid = await mempoolClient.broadcastTransaction(txHex);
        console.log("[Wallet] Transaction broadcast:", txid);
        return txid;
      } catch (error) {
        console.error("[Wallet] Failed to broadcast transaction:", error);
        return null;
      }
    };

    storeSetSigningFunctions(signPsbtFn, broadcastTxFn);
  }, [storeSetSigningFunctions, network]);

  // State
  const [state, setState] = useState<WalletState>({
    wallet: null,
    isLoaded: false,
    hasStoredWallet: false,
    metadata: null,
    isLoading: true,
    error: null,
    isLocked: true,
  });

  /**
   * Initialize - check for stored wallet and restore from singleton
   */
  useEffect(() => {
    async function init() {
      try {
        // Store initial network to prevent false "network change" triggers
        initialNetworkRef.current = network;

        const metadata = await SecureStorage.getMetadata();

        // Check if wallet singleton has a valid wallet (survives component remount)
        const singleton = getWalletSingleton();

        // Case 1: Full wallet in singleton (unlocked, navigated between tabs)
        if (singleton.instance && singleton.info) {
          // Restore walletRef from singleton
          walletRef.current = singleton.instance;

          setState({
            wallet: singleton.info,
            isLoaded: true,
            hasStoredWallet: metadata.exists,
            metadata,
            isLoading: false,
            error: null,
            isLocked: false,
          });

          // CRITICAL: Sync wallet info to global store
          // This ensures components using useWalletStore directly see the wallet as connected
          setStoreWallet(toStoreWalletInfo(singleton.info));

          // Re-setup signing functions
          setupSigningFunctions();
          // Mark as initialized AFTER restore
          isInitializedRef.current = true;
          return;
        }

        // Case 2: Only info in singleton (was locked, navigated between tabs)
        // Show as connected but locked so user can see their address
        if (singleton.info && metadata.exists) {
          setState({
            wallet: singleton.info,
            isLoaded: true,
            hasStoredWallet: true,
            metadata,
            isLoading: false,
            error: null,
            isLocked: true,
          });

          // Sync to store as connected but locked
          setStoreWallet(toStoreWalletInfo(singleton.info));
          setStoreLocked(true);

          // Mark as initialized
          isInitializedRef.current = true;
          return;
        }

        setState((prev) => ({
          ...prev,
          hasStoredWallet: metadata.exists,
          metadata,
          isLoading: false,
        }));

        // Mark as initialized
        isInitializedRef.current = true;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to initialize",
        }));
        isInitializedRef.current = true;
      }
    }

    init();
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Handle network changes - re-derive address if unlocked
   * Only triggers on ACTUAL network changes, not on initial mount/hydration
   */
  useEffect(() => {
    // Skip if not initialized yet (prevents locking during hydration)
    if (!isInitializedRef.current) {
      return;
    }

    // Skip if network hasn't actually changed from what we started with
    if (initialNetworkRef.current === network) {
      return;
    }

    // Update the reference for future comparisons
    initialNetworkRef.current = network;

    if (walletRef.current && state.isLoaded && !state.isLocked) {
      // Network changed while unlocked - need to re-derive
      // For now, just lock the wallet to force re-unlock with new network
      lock();
    }
    // Intentionally only depends on network:
    // - state.isLoaded/isLocked are guards, not triggers
    // - lock is stable (only depends on disconnectStore)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [network]);

  /**
   * Create a new wallet
   * @param password - Password for encryption
   * @param wordCount - Number of mnemonic words (12 or 24)
   * @param preGeneratedMnemonic - Optional pre-generated mnemonic from entropy collection
   */
  const createWallet = useCallback(
    async (
      password: string,
      wordCount: 12 | 24 = 12,
      preGeneratedMnemonic?: string,
    ): Promise<string> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create wallet instance for current network
        const wallet = new BitcoinWallet({ network: mapNetwork(network) });

        // Use pre-generated mnemonic if provided, otherwise generate new one
        let info;
        let mnemonic: string;

        if (preGeneratedMnemonic) {
          info = await wallet.fromMnemonic(preGeneratedMnemonic);
          mnemonic = preGeneratedMnemonic;
        } else {
          info = await wallet.generate(wordCount);
          mnemonic = wallet.getMnemonic();
        }

        // Store encrypted mnemonic
        await SecureStorage.storeMnemonic(mnemonic, password, network);

        // Update refs, state, and singleton
        walletRef.current = wallet;
        setWalletSingleton(wallet, info);

        const metadata = await SecureStorage.getMetadata();

        setState({
          wallet: info,
          isLoaded: true,
          hasStoredWallet: true,
          metadata,
          isLoading: false,
          error: null,
          isLocked: false,
        });

        // Update global store
        setStoreWallet(toStoreWalletInfo(info));

        // Set up signing functions for global access
        setupSigningFunctions();

        // Return mnemonic for user to backup
        return mnemonic;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to create wallet",
        }));
        throw error;
      }
    },
    [network, setStoreWallet, setupSigningFunctions],
  );

  /**
   * Import wallet from mnemonic
   */
  const importWallet = useCallback(
    async (mnemonic: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Create wallet instance and import
        const wallet = new BitcoinWallet({ network: mapNetwork(network) });
        const info = await wallet.fromMnemonic(mnemonic);

        // Store encrypted mnemonic
        await SecureStorage.storeMnemonic(mnemonic, password, network);

        // Update refs, state, and singleton
        walletRef.current = wallet;
        setWalletSingleton(wallet, info);

        const metadata = await SecureStorage.getMetadata();

        setState({
          wallet: info,
          isLoaded: true,
          hasStoredWallet: true,
          metadata,
          isLoading: false,
          error: null,
          isLocked: false,
        });

        // Update global store
        setStoreWallet(toStoreWalletInfo(info));

        // Set up signing functions for global access
        setupSigningFunctions();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to import wallet",
        }));
        throw error;
      }
    },
    [network, setStoreWallet, setupSigningFunctions],
  );

  /**
   * Unlock wallet with password
   */
  const unlock = useCallback(
    async (password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        // Get mnemonic from secure storage
        const mnemonic = await SecureStorage.getMnemonic(password);

        // Create wallet instance
        const wallet = new BitcoinWallet({ network: mapNetwork(network) });
        const info = await wallet.fromMnemonic(mnemonic);

        // Update refs, state, and singleton
        walletRef.current = wallet;
        setWalletSingleton(wallet, info);

        setState((prev) => ({
          ...prev,
          wallet: info,
          isLoaded: true,
          isLoading: false,
          error: null,
          isLocked: false,
        }));

        // Update global store
        setStoreWallet(toStoreWalletInfo(info));

        // Set up signing functions for global access
        setupSigningFunctions();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to unlock wallet",
        }));
        throw error;
      }
    },
    [network, setStoreWallet, setupSigningFunctions],
  );

  /**
   * Lock wallet (clear private keys from memory, keep address info)
   *
   * This performs a "soft lock" that:
   * 1. Clears private key material from memory (security)
   * 2. Keeps wallet address/pubkey in store (UX - shows locked state)
   * 3. Marks wallet as locked (requires password to unlock)
   * 4. KEEPS singleton info so unlock can work on remount
   *
   * For full disconnect (clear everything), use disconnect() instead.
   */
  const lock = useCallback((): void => {
    // Clear wallet instance (contains private keys) but keep address info
    if (walletRef.current) {
      walletRef.current.clear();
    }
    walletRef.current = null;

    // Clear instance from singleton but keep info for display
    lockWalletSingleton();

    setState((prev) => ({
      ...prev,
      // Keep wallet info for display but mark as locked
      isLocked: true,
    }));

    // Soft lock in store - just mark as locked, don't disconnect
    // This keeps the wallet address visible and shows "Wallet Locked" state
    setStoreLocked(true);
  }, [setStoreLocked]);

  /**
   * Delete wallet from storage
   * This performs a FULL cleanup unlike lock() which keeps address info
   */
  const deleteWallet = useCallback(async (): Promise<void> => {
    // Clear wallet instance
    if (walletRef.current) {
      walletRef.current.clear();
    }
    walletRef.current = null;

    // CRITICAL: Clear singleton completely (not just lock)
    // This prevents AppInitializer from re-syncing the deleted wallet
    clearWalletSingleton();

    // Clear secure storage
    await SecureStorage.clear();

    // Disconnect from global store completely
    disconnectStore();

    setState({
      wallet: null,
      isLoaded: false,
      hasStoredWallet: false,
      metadata: null,
      isLoading: false,
      error: null,
      isLocked: true,
    });
  }, [disconnectStore]);

  /**
   * Change wallet password
   */
  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await SecureStorage.changePassword(currentPassword, newPassword);

        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to change password",
        }));
        throw error;
      }
    },
    [],
  );

  /**
   * Get private key for signing (USE WITH CAUTION)
   * Caller is responsible for clearing the key after use
   */
  const getPrivateKeyForSigning = useCallback((): Uint8Array | null => {
    if (!walletRef.current || state.isLocked) {
      return null;
    }

    try {
      return walletRef.current.getPrivateKeyForSigning();
    } catch {
      return null;
    }
  }, [state.isLocked]);

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   */
  const signPSBT = useCallback(
    async (psbtBase64: string): Promise<string> => {
      if (!walletRef.current || state.isLocked) {
        throw new Error("Wallet is locked");
      }

      try {
        // Import PSBT from base64
        const { Psbt } = await import("@bitcoinbaby/bitcoin");
        const psbt = Psbt.fromBase64(psbtBase64);

        // Sign with wallet
        const signedPsbt = walletRef.current.signPSBT(psbt);

        return signedPsbt.toBase64();
      } catch (error) {
        throw new Error(
          `Failed to sign PSBT: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
    [state.isLocked],
  );

  /**
   * Export encrypted backup
   */
  const exportBackup = useCallback(async (): Promise<string | null> => {
    return SecureStorage.exportBackup();
  }, []);

  /**
   * Import encrypted backup
   */
  const importBackup = useCallback(
    async (backup: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        await SecureStorage.importBackup(backup, password);

        const metadata = await SecureStorage.getMetadata();

        setState((prev) => ({
          ...prev,
          hasStoredWallet: true,
          metadata,
          isLoading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to import backup",
        }));
        throw error;
      }
    },
    [],
  );

  /**
   * Refresh wallet state
   */
  const refresh = useCallback(async (): Promise<void> => {
    try {
      const metadata = await SecureStorage.getMetadata();

      setState((prev) => ({
        ...prev,
        hasStoredWallet: metadata.exists,
        metadata,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to refresh",
      }));
    }
  }, []);

  return {
    ...state,
    createWallet,
    importWallet,
    unlock,
    lock,
    deleteWallet,
    changePassword,
    getPrivateKeyForSigning,
    signPSBT,
    exportBackup,
    importBackup,
    refresh,
  };
}

export type { WalletState, WalletActions, UseWalletReturn };
