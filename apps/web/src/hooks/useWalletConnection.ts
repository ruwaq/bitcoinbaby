"use client";

/**
 * useWalletConnection Hook
 *
 * Unified wallet connection interface for the entire app.
 * Provides consistent access to:
 * - Wallet state (address, balance, connection status)
 * - Global signing functions (signPsbt, broadcastTx)
 * - Secure private key operations (for specialized use cases)
 *
 * Architecture:
 * - useWalletStore: Global state (address, signPsbt, broadcastTx)
 * - useWallet: Internal wallet management (create, import, unlock)
 * - This hook: Unified interface for components
 *
 * Usage:
 * ```tsx
 * const { isConnected, address, signPsbt, withPrivateKey } = useWalletConnection();
 *
 * // For most signing operations (NFT mint, simple transfers)
 * const signedHex = await signPsbt(psbtHex);
 *
 * // For operations requiring direct key access (mining submission)
 * await withPrivateKey(async (privateKey) => {
 *   // Use privateKey - it will be zeroed automatically after
 *   await submitter.signAndBroadcast(psbt, privateKey);
 * });
 * ```
 */

import { useCallback, useMemo } from "react";
import { useWalletStore } from "@bitcoinbaby/core";
import { useWallet } from "./useWallet";

// =============================================================================
// TYPES
// =============================================================================

export interface WalletConnectionState {
  /** Whether wallet is connected and ready */
  isConnected: boolean;
  /** Whether wallet is locked (needs password) */
  isLocked: boolean;
  /** Whether wallet is loading */
  isLoading: boolean;
  /** Wallet address */
  address: string | null;
  /** Wallet public key (hex) */
  publicKey: string | null;
  /** Error message if any */
  error: string | null;
}

export interface WalletConnectionActions {
  /**
   * Sign a PSBT and return the signed hex
   * Uses the global signing function from wallet store
   * Returns null if signing failed or was cancelled
   */
  signPsbt: (psbtHex: string) => Promise<string | null>;

  /**
   * Sign and broadcast a transaction
   * Returns the txid on success, null on failure
   */
  signAndBroadcast: (psbtHex: string) => Promise<string | null>;

  /**
   * Execute a function with secure private key access
   * Key is automatically zeroed after callback completes
   *
   * Use this ONLY when you need direct private key access
   * (e.g., MiningSubmitter which requires key for Charms protocol)
   *
   * @param callback - Function to execute with private key
   * @param timeoutMs - Timeout in ms (default 30000) to prevent indefinite key exposure
   * @returns Result of the callback, or null if key not available or timeout
   */
  withPrivateKey: <T>(
    callback: (privateKey: Uint8Array) => Promise<T>,
    timeoutMs?: number,
  ) => Promise<T | null>;

  /**
   * Check if signing is available
   * (wallet connected + unlocked + signPsbt function set)
   */
  canSign: boolean;
}

export type UseWalletConnectionReturn = WalletConnectionState &
  WalletConnectionActions;

// =============================================================================
// HOOK
// =============================================================================

export function useWalletConnection(): UseWalletConnectionReturn {
  // Global store state
  const storeWallet = useWalletStore((s) => s.wallet);
  const storeSignPsbt = useWalletStore((s) => s.signPsbt);
  const storeBroadcastTx = useWalletStore((s) => s.broadcastTx);
  const storeIsConnected = useWalletStore((s) => s.isConnected);

  // Internal wallet state
  const {
    wallet: internalWallet,
    isLocked,
    isLoading,
    error,
    getPrivateKeyForSigning,
  } = useWallet();

  // Computed state
  const isConnected = storeIsConnected && !isLocked;
  const address = storeWallet?.address ?? internalWallet?.address ?? null;
  const publicKey = storeWallet?.publicKey ?? internalWallet?.publicKey ?? null;
  const canSign = isConnected && storeSignPsbt !== null;

  /**
   * Sign PSBT using global signing function
   */
  const signPsbt = useCallback(
    async (psbtHex: string): Promise<string | null> => {
      if (!storeSignPsbt) {
        console.error("[WalletConnection] signPsbt not available");
        return null;
      }

      try {
        return await storeSignPsbt(psbtHex);
      } catch (err) {
        console.error("[WalletConnection] signPsbt failed:", err);
        return null;
      }
    },
    [storeSignPsbt],
  );

  /**
   * Sign and broadcast transaction
   */
  const signAndBroadcast = useCallback(
    async (psbtHex: string): Promise<string | null> => {
      // If we have a dedicated broadcast function, use sign + broadcast
      if (storeSignPsbt && storeBroadcastTx) {
        try {
          const signedHex = await storeSignPsbt(psbtHex);
          if (!signedHex) return null;

          // Extract raw tx from signed PSBT
          const { Psbt } = await import("@bitcoinbaby/bitcoin");
          const psbt = Psbt.fromHex(signedHex);

          // Finalize PSBT if not already finalized
          try {
            psbt.finalizeAllInputs();
          } catch {
            // Already finalized or partial - continue
          }

          const rawTxHex = psbt.extractTransaction().toHex();

          return await storeBroadcastTx(rawTxHex);
        } catch (err) {
          console.error("[WalletConnection] signAndBroadcast failed:", err);
          return null;
        }
      }

      // Fallback: sign only, let caller handle broadcast
      console.warn(
        "[WalletConnection] broadcastTx not available, returning signed PSBT",
      );
      return signPsbt(psbtHex);
    },
    [storeSignPsbt, storeBroadcastTx, signPsbt],
  );

  /**
   * Execute callback with secure private key access
   * Key is zeroed automatically in finally block
   *
   * SECURITY: Includes 30 second timeout to prevent indefinite key exposure
   * if callback hangs or never resolves
   */
  const withPrivateKey = useCallback(
    async <T>(
      callback: (privateKey: Uint8Array) => Promise<T>,
      timeoutMs = 30000,
    ): Promise<T | null> => {
      if (isLocked) {
        console.error("[WalletConnection] Wallet is locked");
        return null;
      }

      const privateKey = getPrivateKeyForSigning();
      if (!privateKey) {
        console.error("[WalletConnection] Could not get private key");
        return null;
      }

      // Create timeout promise to prevent indefinite key exposure
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Private key operation timed out"));
        }, timeoutMs);
      });

      try {
        // Race between callback and timeout
        return await Promise.race([callback(privateKey), timeoutPromise]);
      } catch (err) {
        console.error("[WalletConnection] withPrivateKey error:", err);
        return null;
      } finally {
        // CRITICAL: Always zero the private key, even on timeout
        privateKey.fill(0);
      }
    },
    [isLocked, getPrivateKeyForSigning],
  );

  return useMemo(
    () => ({
      // State
      isConnected,
      isLocked,
      isLoading,
      address,
      publicKey,
      error,
      // Actions
      signPsbt,
      signAndBroadcast,
      withPrivateKey,
      canSign,
    }),
    [
      isConnected,
      isLocked,
      isLoading,
      address,
      publicKey,
      error,
      signPsbt,
      signAndBroadcast,
      withPrivateKey,
      canSign,
    ],
  );
}

export default useWalletConnection;
