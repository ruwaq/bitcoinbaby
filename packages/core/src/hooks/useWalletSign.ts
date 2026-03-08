/**
 * useWalletSign Hook
 *
 * Provides consistent access to wallet signing capabilities from the global store.
 * Use this hook when you need to:
 * - Check if wallet can sign (is connected and unlocked)
 * - Access signPsbt and broadcastTx functions
 * - Get wallet address/publicKey
 *
 * This is the "core" version - for full wallet management including
 * create/import/unlock, use the app-specific useWalletConnection hook.
 *
 * @example
 * ```tsx
 * const { canSign, address, signPsbt } = useWalletSign();
 *
 * if (canSign) {
 *   const signedHex = await signPsbt(psbtHex);
 * }
 * ```
 */

import { useMemo } from "react";
import { useWalletStore } from "../stores/wallet-store";

export interface UseWalletSignReturn {
  /** Whether wallet is connected */
  isConnected: boolean;
  /** Whether wallet is locked (needs password) */
  isLocked: boolean;
  /** Whether wallet can sign (connected + unlocked + signPsbt available) */
  canSign: boolean;
  /** Wallet address (null if not connected) */
  address: string | null;
  /** Wallet public key hex (null if not connected) */
  publicKey: string | null;
  /** Sign a PSBT and return signed hex (null if failed) */
  signPsbt: ((psbtHex: string) => Promise<string | null>) | null;
  /** Broadcast a transaction (null if not available) */
  broadcastTx: ((txHex: string) => Promise<string | null>) | null;
}

export function useWalletSign(): UseWalletSignReturn {
  const wallet = useWalletStore((s) => s.wallet);
  const isConnected = useWalletStore((s) => s.isConnected);
  const isLocked = useWalletStore((s) => s.isLocked);
  const signPsbt = useWalletStore((s) => s.signPsbt);
  const broadcastTx = useWalletStore((s) => s.broadcastTx);

  return useMemo(
    () => ({
      isConnected,
      isLocked,
      canSign: isConnected && !isLocked && signPsbt !== null,
      address: wallet?.address ?? null,
      publicKey: wallet?.publicKey ?? null,
      signPsbt,
      broadcastTx,
    }),
    [isConnected, isLocked, wallet, signPsbt, broadcastTx],
  );
}

export default useWalletSign;
