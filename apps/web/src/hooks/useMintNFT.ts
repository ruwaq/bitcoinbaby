/**
 * useMintNFT Hook
 *
 * NFT minting hook for testnet4 production.
 * Uses Charms Prover API for real on-chain NFT minting.
 * Requires connected wallet - no demo mode.
 *
 * Flow:
 * 1. Reserve tokenId from server
 * 2. Generate traits (DNA, bloodline, rarity)
 * 3. Get funding UTXO from wallet
 * 4. Submit to prover API
 * 5. Sign commitTx and spellTx
 * 6. Broadcast both transactions
 * 7. Confirm with server
 */

"use client";

import { useState, useCallback, useMemo } from "react";
import {
  useWalletStore,
  usePendingTxStore,
  getApiClient,
} from "@bitcoinbaby/core";
import {
  createMempoolClient,
  type Bloodline,
  type BaseType,
  type RarityTier,
  type BabyNFTState,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export interface MintResult {
  success: boolean;
  nft?: BabyNFTState;
  txid?: string;
  spellTxid?: string;
  commitTxid?: string;
  error?: string;
}

export type MintStep =
  | "idle"
  | "reserving"
  | "generating_traits"
  | "proving"
  | "signing_commit"
  | "signing_spell"
  | "broadcasting_commit"
  | "broadcasting_spell"
  | "confirming"
  | "success"
  | "error";

export interface UseMintNFTReturn {
  isLoading: boolean;
  error: string | null;
  lastMinted: BabyNFTState | null;
  /** Spell transaction ID (NFT location) - also aliased as txid */
  spellTxid: string | null;
  /** @deprecated Use spellTxid instead */
  txid: string | null;
  commitTxid: string | null;
  currentStep: MintStep;
  mint: () => Promise<MintResult>;
  reset: () => void;
  /** Can mint (wallet connected and not loading) */
  canMint: boolean;
  /** Is wallet connected */
  isWalletConnected: boolean;
}

// =============================================================================
// TRAIT GENERATION HELPERS
// =============================================================================

const BLOODLINES: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];

function generateDNA(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

function rollRarity(dna: string): RarityTier {
  const roll = parseInt(dna.substring(0, 4), 16) % 1000;
  if (roll < 5) return "mythic"; // 0.5%
  if (roll < 30) return "legendary"; // 2.5%
  if (roll < 100) return "epic"; // 7%
  if (roll < 250) return "rare"; // 15%
  if (roll < 500) return "uncommon"; // 25%
  return "common"; // 50%
}

// =============================================================================
// HOOK
// =============================================================================

export function useMintNFT(): UseMintNFTReturn {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMinted, setLastMinted] = useState<BabyNFTState | null>(null);
  const [spellTxid, setSpellTxid] = useState<string | null>(null);
  const [commitTxid, setCommitTxid] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<MintStep>("idle");

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

  // Wallet connection check
  const isWalletConnected = Boolean(wallet?.address && signPsbt);

  /**
   * Mint NFT using Charms Prover
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
    setCurrentStep("reserving");

    // Fetch UTXOs from mempool
    const utxos = await mempoolClient.getUTXOs(wallet.address);

    // Check UTXOs
    if (!utxos || utxos.length === 0) {
      setIsLoading(false);
      setCurrentStep("error");
      setError("No UTXOs available. Please fund your wallet.");
      return {
        success: false,
        error: "No UTXOs available. Please fund your wallet.",
      };
    }

    // Find a suitable funding UTXO (at least 2000 sats for fees)
    const fundingUtxo = utxos.find((u: { value: number }) => u.value >= 2000);
    if (!fundingUtxo) {
      setIsLoading(false);
      setCurrentStep("error");
      setError("No UTXO with at least 2000 sats available");
      return {
        success: false,
        error: "No UTXO with at least 2000 sats available",
      };
    }

    // Track reserved token ID for cleanup on error
    let reservedTokenId: number | null = null;
    const apiClient = getApiClient();

    try {
      // Step 1: Reserve next NFT ID from server
      const reserveResult = await apiClient.reserveNFT();

      if (!reserveResult.success || !reserveResult.data) {
        throw new Error(
          reserveResult.error ||
            "Failed to reserve NFT ID - max supply reached?",
        );
      }

      reservedTokenId = reserveResult.data.tokenId;
      console.log(
        `[MintNFT] Reserved token ID: ${reservedTokenId} (total: ${reserveResult.data.totalMinted})`,
      );

      // Step 2: Generate NFT traits
      setCurrentStep("generating_traits");
      const dna = generateDNA();
      const bloodline = rollBloodline(dna);
      const baseType = rollBaseType(dna);
      const rarityTier = rollRarity(dna);

      // Get current block height for genesisBlock
      const blockHeight = await mempoolClient.getBlockHeight();

      const nftState: BabyNFTState = {
        dna,
        bloodline,
        baseType,
        genesisBlock: blockHeight,
        rarityTier,
        tokenId: reservedTokenId,
        level: 1,
        xp: 0,
        totalXp: 0,
        workCount: 0,
        lastWorkBlock: blockHeight,
        evolutionCount: 0,
        tokensEarned: 0n,
      };

      console.log("[MintNFT] Generated traits:", {
        tokenId: reservedTokenId,
        bloodline,
        baseType,
        rarityTier,
      });

      // Step 3: Submit to prover API
      setCurrentStep("proving");
      console.log("[MintNFT] Submitting to prover...", {
        tokenId: reservedTokenId,
        address: wallet.address,
        fundingUtxo: {
          txid: fundingUtxo.txid,
          vout: fundingUtxo.vout,
          value: fundingUtxo.value,
        },
      });

      let proveResult;
      try {
        proveResult = await apiClient.proveNFT({
          tokenId: reservedTokenId,
          address: wallet.address,
          nftState: {
            ...nftState,
            // API expects tokensEarned as string
            tokensEarned: nftState.tokensEarned.toString(),
          },
          fundingUtxo: {
            txid: fundingUtxo.txid,
            vout: fundingUtxo.vout,
            value: fundingUtxo.value,
          },
        });
        console.log("[MintNFT] Prover response received:", proveResult);
      } catch (proveError) {
        console.error("[MintNFT] Prover request failed:", proveError);
        throw proveError;
      }

      if (!proveResult.success || !proveResult.data) {
        console.error("[MintNFT] Prover returned error:", proveResult);
        throw new Error(
          proveResult.error || "Failed to generate NFT proof from prover",
        );
      }

      const { commitTxHex, spellTxHex } = proveResult.data;

      console.log("[MintNFT] Prover returned transactions:", {
        commitTxid: proveResult.data.commitTxid,
        spellTxid: proveResult.data.spellTxid,
        hasCommitTx: Boolean(commitTxHex),
        hasSpellTx: Boolean(spellTxHex),
      });

      if (!spellTxHex) {
        throw new Error("Prover did not return spell transaction");
      }

      let signedCommitHex: string | null = null;
      let broadcastCommitTxid: string | null = null;

      // Step 4: Sign commit transaction (if present)
      // Some prover responses only include the spell transaction
      if (commitTxHex) {
        setCurrentStep("signing_commit");
        console.log("[MintNFT] Signing commit transaction...");

        signedCommitHex = await signPsbt(commitTxHex);
        if (!signedCommitHex) {
          throw new Error("Commit transaction signing was cancelled");
        }
      } else {
        console.log(
          "[MintNFT] No commit transaction from prover, skipping commit signing",
        );
      }

      // Step 5: Sign spell transaction
      setCurrentStep("signing_spell");
      console.log("[MintNFT] Signing spell transaction...");

      const signedSpellHex = await signPsbt(spellTxHex);
      if (!signedSpellHex) {
        throw new Error("Spell transaction signing was cancelled");
      }

      // Step 6: Broadcast commit transaction (if present)
      if (signedCommitHex) {
        setCurrentStep("broadcasting_commit");
        console.log("[MintNFT] Broadcasting commit transaction...");

        broadcastCommitTxid =
          await mempoolClient.broadcastTransaction(signedCommitHex);
        if (!broadcastCommitTxid) {
          throw new Error("Failed to broadcast commit transaction");
        }
        setCommitTxid(broadcastCommitTxid);
        console.log("[MintNFT] Commit TX broadcast:", broadcastCommitTxid);
      } else {
        console.log("[MintNFT] Skipping commit broadcast (single-tx flow)");
      }

      // Step 7: Broadcast spell transaction
      setCurrentStep("broadcasting_spell");
      console.log("[MintNFT] Broadcasting spell transaction...");

      const broadcastSpellTxid =
        await mempoolClient.broadcastTransaction(signedSpellHex);
      if (!broadcastSpellTxid) {
        throw new Error("Failed to broadcast spell transaction");
      }
      setSpellTxid(broadcastSpellTxid);

      console.log("[MintNFT] Spell TX broadcast:", broadcastSpellTxid);

      // Track pending transactions
      startTracking();
      if (broadcastCommitTxid) {
        addTransaction(
          broadcastCommitTxid,
          "nft_mint",
          `Genesis Baby #${reservedTokenId} commit`,
        );
      }
      addTransaction(
        broadcastSpellTxid,
        "nft_mint",
        `Genesis Baby #${reservedTokenId} spell`,
      );

      // Step 8: Confirm the mint with server
      setCurrentStep("confirming");

      const nftData = {
        dna: nftState.dna,
        bloodline: nftState.bloodline,
        baseType: nftState.baseType,
        rarityTier: nftState.rarityTier,
        level: nftState.level,
        xp: nftState.xp,
        totalXp: nftState.totalXp,
        workCount: nftState.workCount,
        evolutionCount: nftState.evolutionCount,
      };

      // Non-blocking confirmation
      apiClient
        .confirmNFTMint(
          reservedTokenId,
          broadcastSpellTxid,
          wallet.address,
          nftData,
        )
        .catch((err) => console.warn("[MintNFT] Failed to confirm mint:", err));

      // Clear reservedTokenId on success (no cleanup needed)
      reservedTokenId = null;

      setLastMinted(nftState);
      setCurrentStep("success");

      return {
        success: true,
        nft: nftState,
        txid: broadcastSpellTxid,
        spellTxid: broadcastSpellTxid,
        commitTxid: broadcastCommitTxid || undefined,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Mint failed";
      setError(message);
      setCurrentStep("error");

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
  }, [wallet, signPsbt, mempoolClient, addTransaction, startTracking]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setLastMinted(null);
    setSpellTxid(null);
    setCommitTxid(null);
    setCurrentStep("idle");
  }, []);

  return {
    isLoading,
    error,
    lastMinted,
    spellTxid,
    txid: spellTxid, // Alias for backward compatibility
    commitTxid,
    currentStep,
    mint,
    reset,
    canMint: isWalletConnected && !isLoading,
    isWalletConnected,
  };
}

export default useMintNFT;
