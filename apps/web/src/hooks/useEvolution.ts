"use client";

/**
 * useEvolution Hook
 *
 * Handles NFT evolution (level up) with real blockchain transactions.
 * Connects to the existing useNFTMinting hook's levelUp method.
 *
 * Flow:
 * 1. Get NFT UTXO from Charms extraction
 * 2. Get token UTXOs for evolution cost
 * 3. Create PSBT via useNFTMinting.levelUp
 * 4. Sign with wallet
 * 5. Broadcast to network
 */

import { useState, useCallback, useMemo } from "react";
import {
  createCharmsClient,
  createMempoolClient,
  Psbt,
  EVOLUTION_COSTS,
  XP_REQUIREMENTS,
  canLevelUp,
  formatTokenAmount,
  GENESIS_BABIES_TESTNET4,
  BABTC_TESTNET4,
  type BabyNFTState,
} from "@bitcoinbaby/bitcoin";
import {
  useWalletStore,
  usePendingTxStore,
  useNFTMinting,
  getApiClient,
} from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface EvolutionResult {
  success: boolean;
  txid?: string;
  newLevel?: number;
  error?: string;
}

export interface UseEvolutionReturn {
  /** Execute evolution for an NFT */
  evolve: (nft: BabyNFTState) => Promise<EvolutionResult>;
  /** Is evolution in progress */
  isEvolving: boolean;
  /** Error message if evolution failed */
  error: string | null;
  /** Check if NFT can evolve */
  canEvolve: (nft: BabyNFTState) => boolean;
  /** Get evolution cost in tokens */
  getEvolutionCost: (nft: BabyNFTState) => bigint;
  /** Get XP required for next level */
  getXPRequired: (nft: BabyNFTState) => number;
  /** Clear error state */
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useEvolution(): UseEvolutionReturn {
  // State
  const [isEvolving, setIsEvolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const signPsbt = useWalletStore((s) => s.signPsbt);

  // Pending transactions
  const addTransaction = usePendingTxStore((s) => s.addTransaction);
  const startTracking = usePendingTxStore((s) => s.startTracking);

  // Clients
  const charmsClient = useMemo(
    () => createCharmsClient({ network: "testnet4" }),
    [],
  );

  const mempoolClient = useMemo(
    () => createMempoolClient({ network: "testnet4" }),
    [],
  );

  // NFT Minting hook (has levelUp method)
  const { levelUp, checkCanLevelUp } = useNFTMinting({
    ownerAddress: wallet?.address ?? "",
    ownerPublicKey: wallet?.publicKey ?? "",
    nftAppId: GENESIS_BABIES_TESTNET4.appId,
    nftAppVk: GENESIS_BABIES_TESTNET4.appVk,
    tokenAppId: BABTC_TESTNET4.appId,
    tokenAppVk: BABTC_TESTNET4.appVk,
    network: "testnet4",
  });

  /**
   * Check if NFT can evolve
   */
  const canEvolveNFT = useCallback((nft: BabyNFTState): boolean => {
    return canLevelUp(nft);
  }, []);

  /**
   * Get evolution cost for next level
   */
  const getEvolutionCost = useCallback((nft: BabyNFTState): bigint => {
    const nextLevel = nft.level + 1;
    return EVOLUTION_COSTS[nextLevel] ?? 0n;
  }, []);

  /**
   * Get XP required for next level
   */
  const getXPRequired = useCallback((nft: BabyNFTState): number => {
    const nextLevel = nft.level + 1;
    return XP_REQUIREMENTS[nextLevel] ?? 0;
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Execute evolution
   */
  const evolve = useCallback(
    async (nft: BabyNFTState): Promise<EvolutionResult> => {
      // Require wallet
      if (!wallet?.address || !signPsbt) {
        return {
          success: false,
          error: "Please connect your wallet first",
        };
      }

      // Check can level up
      const levelCheck = checkCanLevelUp(nft);
      if (!levelCheck.canLevel) {
        const xpNeeded = levelCheck.xpRequired - levelCheck.currentXp;
        return {
          success: false,
          error: `Cannot evolve: Need ${xpNeeded} more XP`,
        };
      }

      setIsEvolving(true);
      setError(null);

      try {
        // 1. Get NFT UTXO from Charms
        console.log(`[Evolution] Finding NFT UTXO for token #${nft.tokenId}`);
        const charms = await charmsClient.extractCharmsForWallet(
          wallet.address,
          GENESIS_BABIES_TESTNET4.appId,
        );

        const nftCharm = charms.find(
          (c) =>
            c.appType === "n" &&
            c.state &&
            typeof c.state === "object" &&
            "tokenId" in c.state &&
            c.state.tokenId === nft.tokenId,
        );

        if (!nftCharm) {
          throw new Error(`NFT #${nft.tokenId} not found in your wallet`);
        }

        const nftUtxo = {
          txid: nftCharm.txid,
          vout: nftCharm.vout,
        };
        console.log(
          `[Evolution] Found NFT UTXO: ${nftUtxo.txid}:${nftUtxo.vout}`,
        );

        // 2. Get token UTXOs
        const tokenCost = getEvolutionCost(nft);
        console.log(
          `[Evolution] Evolution cost: ${formatTokenAmount(tokenCost)} BABTC`,
        );

        const tokenCharms = charms.filter(
          (c) => c.appId === BABTC_TESTNET4.appId && c.appType === "t",
        );

        if (tokenCharms.length === 0) {
          throw new Error("No BABTC tokens found in your wallet");
        }

        const totalTokens = tokenCharms.reduce((sum, c) => sum + c.amount, 0n);
        if (totalTokens < tokenCost) {
          throw new Error(
            `Insufficient BABTC: Have ${formatTokenAmount(totalTokens)}, need ${formatTokenAmount(tokenCost)}`,
          );
        }

        // Use first token UTXO (simplified - could optimize coin selection)
        const tokenUtxo = {
          txid: tokenCharms[0].txid,
          vout: tokenCharms[0].vout,
        };
        console.log(
          `[Evolution] Using token UTXO: ${tokenUtxo.txid}:${tokenUtxo.vout}`,
        );

        // 3. Create PSBT via levelUp
        console.log(`[Evolution] Creating evolution PSBT...`);
        const result = await levelUp(nft, nftUtxo, tokenUtxo, totalTokens);

        if (!result.success || !result.psbt) {
          throw new Error(
            result.error || "Failed to create evolution transaction",
          );
        }

        // 4. Sign PSBT with wallet
        console.log(`[Evolution] Signing PSBT...`);
        const signedPsbtHex = await signPsbt(result.psbt);
        if (!signedPsbtHex) {
          throw new Error("Transaction was cancelled or failed to sign");
        }

        // 5. Extract and broadcast
        console.log(`[Evolution] Broadcasting transaction...`);
        const signedPsbt = Psbt.fromBase64(signedPsbtHex);
        const rawTxHex = signedPsbt.extractTransaction().toHex();
        const txid = await mempoolClient.broadcastTransaction(rawTxHex);

        if (!txid) {
          throw new Error("Failed to broadcast transaction to the network");
        }

        // 6. Track pending transaction
        startTracking();
        addTransaction(
          txid,
          "nft_evolution",
          `Genesis Baby #${nft.tokenId} evolved to level ${nft.level + 1}`,
        );

        // 7. Notify server of evolution (non-blocking)
        const newLevel = nft.level + 1;
        getApiClient()
          .confirmEvolution(nft.tokenId, txid, newLevel, wallet.address)
          .then((result) => {
            if (result.success) {
              console.log(`[Evolution] Server confirmed level ${newLevel}`);
            } else {
              console.warn(`[Evolution] Server confirm failed:`, result.error);
            }
          })
          .catch((err) => {
            console.warn(`[Evolution] Server notification failed:`, err);
          });

        console.log(`[Evolution] Success! TXID: ${txid}`);
        return {
          success: true,
          txid,
          newLevel: nft.level + 1,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Evolution failed";
        setError(message);
        console.error("[Evolution] Error:", message);
        return { success: false, error: message };
      } finally {
        setIsEvolving(false);
      }
    },
    [
      wallet,
      signPsbt,
      charmsClient,
      mempoolClient,
      levelUp,
      checkCanLevelUp,
      getEvolutionCost,
      addTransaction,
      startTracking,
    ],
  );

  return {
    evolve,
    isEvolving,
    error,
    canEvolve: canEvolveNFT,
    getEvolutionCost,
    getXPRequired,
    clearError,
  };
}

export default useEvolution;
