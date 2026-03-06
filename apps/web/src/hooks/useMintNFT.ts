/**
 * useMintNFT Hook
 *
 * NFT minting hook for testnet4 production.
 * Uses useNFTMinting from core for correct Charms protocol integration.
 * Requires connected wallet - no demo mode.
 */

"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import {
  useNFTMinting,
  useWalletStore,
  usePendingTxStore,
  getApiClient,
} from "@bitcoinbaby/core";
import {
  Psbt,
  createMempoolClient,
  GENESIS_BABIES_TESTNET4,
  BABTC_TESTNET4,
  type BabyNFTState,
  type Bloodline,
  type BaseType,
} from "@bitcoinbaby/bitcoin";

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
// BLOODLINE HELPERS
// =============================================================================

const BLOODLINES: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
const BASE_TYPES: BaseType[] = ["human", "animal", "robot", "mystic", "alien"];

function rollBloodline(dna: string): Bloodline {
  const roll = parseInt(dna.substring(4, 6), 16) % 4;
  return BLOODLINES[roll];
}

function rollBaseType(dna: string): BaseType {
  const roll = parseInt(dna.substring(6, 10), 16) % 100;
  if (roll < 1) return "alien"; // 1%
  if (roll < 6) return "robot"; // 5%
  if (roll < 15) return "mystic"; // 9%
  if (roll < 30) return "animal"; // 15%
  return "human"; // 70%
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

  // Mempool client for broadcasting
  const mempoolClient = useMemo(
    () => createMempoolClient({ network: "testnet4" }),
    [],
  );

  // Core NFT minting hook (uses correct Charms witness data)
  const nftMinting = useNFTMinting({
    network: "testnet4",
    ownerAddress: wallet?.address ?? "",
    ownerPublicKey: wallet?.publicKey ?? "",
    nftAppId: GENESIS_BABIES_TESTNET4.appId,
    nftAppVk: GENESIS_BABIES_TESTNET4.appVk,
    tokenAppId: BABTC_TESTNET4.appId,
    tokenAppVk: BABTC_TESTNET4.appVk,
  });

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

    // Track reserved token ID for cleanup on error
    let reservedTokenId: number | null = null;
    const apiClient = getApiClient();

    try {
      // Reserve next NFT ID from server (atomic counter)
      const reserveResult = await apiClient.reserveNFT();

      if (!reserveResult.success || !reserveResult.data) {
        throw new Error(
          reserveResult.error ||
            "Failed to reserve NFT ID - max supply reached?",
        );
      }

      reservedTokenId = reserveResult.data.tokenId;
      console.log(
        `[MintNFT] Reserved token ID: ${reservedTokenId} (total minted: ${reserveResult.data.totalMinted})`,
      );

      // Generate NFT traits
      const dna = await nftMinting.generateDNA();
      const bloodline = rollBloodline(dna);
      const baseType = rollBaseType(dna);
      const rarityTier = nftMinting.rollRarity();

      // Create PSBT using core hook (uses witness data, not OP_RETURN)
      const mintResult = await nftMinting.mintGenesis({
        tokenId: reservedTokenId,
        dna,
        bloodline,
        baseType,
        rarityTier,
      });

      if (!mintResult.success || !mintResult.psbt) {
        throw new Error(mintResult.error || "Failed to create transaction");
      }

      // Sign PSBT with wallet
      const signedPsbtHex = await signPsbt(mintResult.psbt);
      if (!signedPsbtHex) {
        throw new Error("Transaction was cancelled or failed to sign");
      }

      // Extract raw transaction from finalized PSBT
      const signedPsbt = Psbt.fromBase64(signedPsbtHex);
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
        `Genesis Baby #${mintResult.nftState?.tokenId ?? "?"} mint`,
      );

      // Confirm the mint with server (non-blocking)
      const nftData = mintResult.nftState
        ? {
            dna: mintResult.nftState.dna,
            bloodline: mintResult.nftState.bloodline,
            baseType: mintResult.nftState.baseType,
            rarityTier: mintResult.nftState.rarityTier,
            level: mintResult.nftState.level,
            xp: mintResult.nftState.xp,
            totalXp: mintResult.nftState.totalXp,
            workCount: mintResult.nftState.workCount,
            evolutionCount: mintResult.nftState.evolutionCount,
          }
        : undefined;

      apiClient
        .confirmNFTMint(reservedTokenId, broadcastTxid, wallet.address, nftData)
        .catch((err) => console.warn("[MintNFT] Failed to confirm mint:", err));

      // Clear reservedTokenId on success (no cleanup needed)
      reservedTokenId = null;

      setLastMinted(mintResult.nftState!);
      setTxid(broadcastTxid);

      return { success: true, nft: mintResult.nftState, txid: broadcastTxid };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      setError(message);

      // Release reserved token ID if mint failed after reservation
      if (reservedTokenId !== null) {
        console.log(
          `[MintNFT] Releasing reserved token ID ${reservedTokenId} due to error`,
        );
        apiClient
          .releaseNFT(reservedTokenId)
          .catch((releaseErr) =>
            console.warn(
              `[MintNFT] Failed to release token ${reservedTokenId}:`,
              releaseErr,
            ),
          );
      }

      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [
    wallet,
    signPsbt,
    nftMinting,
    mempoolClient,
    addTransaction,
    startTracking,
  ]);

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
