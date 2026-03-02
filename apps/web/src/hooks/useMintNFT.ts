/**
 * useMintNFT Hook
 *
 * NFT minting hook for testnet4 production.
 * Requires connected wallet - no demo mode.
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  createNFTMintService,
  createMempoolClient,
  Psbt,
  type BabyNFTState,
} from "@bitcoinbaby/bitcoin";
import {
  useWalletStore,
  usePendingTxStore,
  getApiClient,
} from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface MintResult {
  success: boolean;
  nft?: BabyNFTState;
  txid?: string;
  error?: string;
}

export interface UseMintNFTReturn {
  isLoading: boolean;
  error: string | null;
  lastMinted: BabyNFTState | null;
  txid: string | null;
  mint: () => Promise<MintResult>;
  reset: () => void;
  /** Can mint (wallet connected and not loading) */
  canMint: boolean;
  /** Is wallet connected */
  isWalletConnected: boolean;
}

// =============================================================================
// HOOK
// =============================================================================

export function useMintNFT(): UseMintNFTReturn {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMinted, setLastMinted] = useState<BabyNFTState | null>(null);
  const [txid, setTxid] = useState<string | null>(null);

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const signPsbt = useWalletStore((s) => s.signPsbt);

  // Pending transactions
  const addTransaction = usePendingTxStore((s) => s.addTransaction);
  const startTracking = usePendingTxStore((s) => s.startTracking);

  // Services - testnet4 production
  const mintService = useMemo(
    () => createNFTMintService({ network: "testnet4" }),
    [],
  );

  const mempoolClient = useMemo(
    () => createMempoolClient({ network: "testnet4" }),
    [],
  );

  // Wallet connection check
  const isWalletConnected = Boolean(wallet?.address && signPsbt);

  /**
   * Mint NFT - requires wallet connection
   */
  const mint = useCallback(async (): Promise<MintResult> => {
    // Require wallet
    if (!wallet?.address || !signPsbt) {
      return {
        success: false,
        error: "Please connect your wallet first",
      };
    }

    setIsLoading(true);
    setError(null);

    try {
      // Reserve next NFT ID from server (atomic counter)
      // Uses centralized API client for proper environment handling
      const apiClient = getApiClient();
      const reserveResult = await apiClient.reserveNFT();

      if (!reserveResult.success || !reserveResult.data) {
        throw new Error(
          reserveResult.error ||
            "Failed to reserve NFT ID - max supply reached?",
        );
      }

      const reservedTokenId = reserveResult.data.tokenId;
      console.log(
        `[MintNFT] Reserved token ID: ${reservedTokenId} (total minted: ${reserveResult.data.totalMinted})`,
      );

      // Set the minted count so the service creates the correct tokenId
      mintService.setMintedCount(reservedTokenId - 1);

      // Get UTXOs for the transaction
      const utxos = await mempoolClient.getUTXOs(wallet.address);

      if (!utxos || utxos.length === 0) {
        throw new Error(
          "No tBTC available. Get testnet coins from the faucet first.",
        );
      }

      // Create mint transaction
      const mintResult = await mintService.createMintPSBT({
        buyerAddress: wallet.address,
        utxos,
        feeRate: 10,
      });

      if (!mintResult.success || !mintResult.psbtHex) {
        throw new Error(mintResult.error || "Failed to create transaction");
      }

      // Sign PSBT with wallet
      const signedPsbtHex = await signPsbt(mintResult.psbtHex);
      if (!signedPsbtHex) {
        throw new Error("Transaction was cancelled or failed to sign");
      }

      // Extract raw transaction from finalized PSBT
      const signedPsbt = Psbt.fromHex(signedPsbtHex);
      const rawTxHex = signedPsbt.extractTransaction().toHex();

      // Broadcast to network
      const broadcastTxid = await mempoolClient.broadcastTransaction(rawTxHex);
      if (!broadcastTxid) {
        throw new Error("Failed to broadcast transaction to the network");
      }

      // Track pending transaction
      startTracking();
      addTransaction(
        broadcastTxid,
        "nft_mint",
        `Genesis Baby #${mintResult.nft?.tokenId ?? "?"} mint`,
      );

      // Confirm the mint with server (non-blocking)
      // Send full NFT data for server-side indexing
      const nftData = mintResult.nft
        ? {
            dna: mintResult.nft.dna,
            bloodline: mintResult.nft.bloodline,
            baseType: mintResult.nft.baseType,
            rarityTier: mintResult.nft.rarityTier,
            level: mintResult.nft.level,
            xp: mintResult.nft.xp,
            totalXp: mintResult.nft.totalXp,
            workCount: mintResult.nft.workCount,
            evolutionCount: mintResult.nft.evolutionCount,
          }
        : undefined;

      apiClient
        .confirmNFTMint(reservedTokenId, broadcastTxid, wallet.address, nftData)
        .catch((err) => console.warn("[MintNFT] Failed to confirm mint:", err));

      setLastMinted(mintResult.nft!);
      setTxid(broadcastTxid);

      return { success: true, nft: mintResult.nft, txid: broadcastTxid };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      setError(message);
      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [wallet, signPsbt, mintService, mempoolClient]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastMinted(null);
    setTxid(null);
  }, []);

  return {
    isLoading,
    error,
    lastMinted,
    txid,
    mint,
    reset,
    canMint: isWalletConnected && !isLoading,
    isWalletConnected,
  };
}

export default useMintNFT;
