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
  XP_REQUIREMENTS,
  canLevelUp,
  formatTokenAmount,
  getGenesisBabiesConfig,
  getDeploymentConfig,
  type SparkNFTState,
} from "@bitcoinbaby/bitcoin";
import {
  useWalletStore,
  usePendingTxStore,
  useNFTMinting,
  useNetworkStore,
  getApiClient,
} from "@bitcoinbaby/core";
import { createLogger, getPhaseConfig } from "@bitcoinbaby/shared";

const log = createLogger("Evolution");

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
  evolve: (nft: SparkNFTState) => Promise<EvolutionResult>;
  /** Is evolution in progress */
  isEvolving: boolean;
  /** Error message if evolution failed */
  error: string | null;
  /** Check if NFT can evolve */
  canEvolve: (nft: SparkNFTState) => boolean;
  /** Get evolution cost in tokens */
  getEvolutionCost: (nft: SparkNFTState) => bigint;
  /** Get XP required for next level */
  getXPRequired: (nft: SparkNFTState) => number;
  /** Clear error state */
  clearError: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const EVOLUTION_CONFIRM_STORAGE_KEY = "bb_evolution_pending_confirmations";

/** Maximum retry attempts for server confirmation */
const MAX_CONFIRM_RETRIES = 3;
/** Base delay in ms for exponential backoff */
const CONFIRM_RETRY_BASE_MS = 2000;

interface PendingEvolutionConfirmation {
  tokenId: number;
  txid: string;
  newLevel: number;
  address: string;
  timestamp: number;
}

/**
 * Retry confirmEvolution with exponential backoff.
 * On persistent failure, queues the confirmation in localStorage for
 * retry on next app load.
 */
async function confirmEvolutionWithRetry(
  tokenId: number,
  txid: string,
  newLevel: number,
  address: string,
): Promise<boolean> {
  const apiClient = getApiClient();

  for (let attempt = 1; attempt <= MAX_CONFIRM_RETRIES; attempt++) {
    try {
      const result = await apiClient.confirmEvolution(
        tokenId,
        txid,
        newLevel,
        address,
      );
      if (result.success) {
        return true;
      }
      log.warn(
        `Server confirm failed (attempt ${attempt}/${MAX_CONFIRM_RETRIES}):`,
        { error: result.error },
      );
    } catch (err) {
      log.warn(
        `Server notification failed (attempt ${attempt}/${MAX_CONFIRM_RETRIES}):`,
        { error: err },
      );
    }

    if (attempt < MAX_CONFIRM_RETRIES) {
      const delay = CONFIRM_RETRY_BASE_MS * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted — queue for later retry in localStorage
  log.warn(
    `Server confirmation exhausted all ${MAX_CONFIRM_RETRIES} retries. Queuing for later.`,
  );
  queueFailedConfirmation({
    tokenId,
    txid,
    newLevel,
    address,
    timestamp: Date.now(),
  });
  return false;
}

/**
 * Queue a failed confirmation in localStorage for retry on next app load.
 */
function queueFailedConfirmation(
  confirmation: PendingEvolutionConfirmation,
): void {
  try {
    const stored = localStorage.getItem(EVOLUTION_CONFIRM_STORAGE_KEY);
    const queue: PendingEvolutionConfirmation[] = stored
      ? JSON.parse(stored)
      : [];
    // Avoid duplicates by txid
    if (!queue.some((c) => c.txid === confirmation.txid)) {
      queue.push(confirmation);
      localStorage.setItem(
        EVOLUTION_CONFIRM_STORAGE_KEY,
        JSON.stringify(queue),
      );
    }
  } catch {
    // localStorage may be unavailable (SSR, private browsing, etc.)
  }
}

// =============================================================================
// VIRTUAL EVOLUTION (Phase 1)
// =============================================================================

/**
 * Execute a virtual (server-side) evolution.
 *
 * Used in Phase 1 when mining is disabled. Calls POST /api/nft/evolve which:
 * 1. Validates ownership and level
 * 2. Checks virtual SPARK balance in VirtualBalanceDO
 * 3. Debits the evolution cost
 * 4. Updates NFT level in Redis
 *
 * No wallet, no on-chain transactions, no PSBT signing required.
 *
 * @param nft - The NFT to evolve
 * @param ownerAddress - The owner's Bitcoin address (for server ownership validation)
 */
async function evolveVirtual(
  nft: SparkNFTState,
  ownerAddress: string,
): Promise<EvolutionResult> {
  const apiClient = getApiClient();

  try {
    log.info(
      `Virtual evolution for NFT #${nft.tokenId} (level ${nft.level} → ${nft.level + 1})`,
    );

    const result = await apiClient.evolveNFT(
      nft.tokenId,
      ownerAddress,
      nft.level,
    );

    if (!result.success) {
      const errorMsg = result.error || "Virtual evolution failed";
      log.error(errorMsg);
      return { success: false, error: errorMsg };
    }

    const { newLevel } = result.data!;
    log.info(`NFT #${nft.tokenId} evolved to level ${newLevel}`);

    return {
      success: true,
      newLevel,
      txid: undefined, // No blockchain txid for virtual evolution
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Virtual evolution failed";
    log.error("Virtual evolution error:", { message });
    return { success: false, error: message };
  }
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

  // Network
  const { network, config } = useNetworkStore();

  // Network-aware app configs
  const genesisBabiesConfig = getGenesisBabiesConfig(network);
  const babtcConfig = getDeploymentConfig(network);

  // Pending transactions
  const addTransaction = usePendingTxStore((s) => s.addTransaction);
  const startTracking = usePendingTxStore((s) => s.startTracking);

  // Clients
  const charmsClient = useMemo(
    () => createCharmsClient({ network: config.scrolls }),
    [config.scrolls],
  );

  const mempoolClient = useMemo(
    () => createMempoolClient({ network }),
    [network],
  );

  // NFT Minting hook (has levelUp method)
  const { levelUp, checkCanLevelUp } = useNFTMinting({
    ownerAddress: wallet?.address ?? "",
    ownerPublicKey: wallet?.publicKey ?? "",
    nftAppId: genesisBabiesConfig.appId,
    nftAppVk: genesisBabiesConfig.appVk,
    tokenAppId: babtcConfig.appId,
    tokenAppVk: babtcConfig.appVk,
    network: config.scrolls,
  });

  /**
   * Check if NFT can evolve
   */
  const canEvolveNFT = useCallback((nft: SparkNFTState): boolean => {
    return canLevelUp(nft);
  }, []);

  /**
   * Get evolution cost for next level
   */
  const getEvolutionCost = useCallback((_nft: SparkNFTState): bigint => {
    return 0n;
  }, []);

  /**
   * Get XP required for next level
   */
  const getXPRequired = useCallback((nft: SparkNFTState): number => {
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
   *
   * In Phase 1 (mining disabled): uses virtual evolution via API — debits
   * virtual SPARK server-side without requiring on-chain transactions.
   *
   * In Phase 2+ (mining enabled): uses on-chain PSBT flow with real SPARK.
   */
  const evolve = useCallback(
    async (nft: SparkNFTState): Promise<EvolutionResult> => {
      // ── Phase 1: Virtual Evolution ──
      const phaseConfig = getPhaseConfig();
      const useVirtual =
        phaseConfig.features.nftEvolution && !phaseConfig.features.mining;

      if (useVirtual) {
        // Virtual evolution doesn't need a full wallet but we need an owner address
        const ownerAddr = wallet?.address;
        if (!ownerAddr) {
          return {
            success: false,
            error:
              "Please connect your wallet first (address needed for ownership validation)",
          };
        }
        return evolveVirtual(nft, ownerAddr);
      }

      // ── Phase 2+: On-chain Evolution ──
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
        log.info(`Finding NFT UTXO for token #${nft.tokenId}`);
        const charms = await charmsClient.extractCharmsForWallet(
          wallet.address,
          genesisBabiesConfig.appId,
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
        log.info(`Found NFT UTXO: ${nftUtxo.txid}:${nftUtxo.vout}`);

        // 2. Get token UTXOs
        const tokenCost = getEvolutionCost(nft);
        log.info(`Evolution cost: ${formatTokenAmount(tokenCost)} SPARK`);

        const tokenCharms = charms.filter(
          (c) => c.appId === babtcConfig.appId && c.appType === "t",
        );

        if (tokenCharms.length === 0) {
          throw new Error("No SPARK tokens found in your wallet");
        }

        const totalTokens = tokenCharms.reduce((sum, c) => sum + c.amount, 0n);
        if (totalTokens < tokenCost) {
          throw new Error(
            `Insufficient SPARK: Have ${formatTokenAmount(totalTokens)}, need ${formatTokenAmount(tokenCost)}`,
          );
        }

        // Coin selection: sort UTXOs by amount descending, then pick the
        // smallest UTXO that meets or exceeds the cost. If no single UTXO
        // is large enough, use the largest one as best-effort fallback.
        const sortedTokenCharms = [...tokenCharms].sort((a, b) =>
          b.amount > a.amount ? 1 : b.amount < a.amount ? -1 : 0,
        );

        // Find smallest UTXO that meets or exceeds the cost (iterate reversed)
        let selectedCharm = sortedTokenCharms[sortedTokenCharms.length - 1]; // smallest
        for (let i = sortedTokenCharms.length - 1; i >= 0; i--) {
          if (sortedTokenCharms[i].amount >= tokenCost) {
            selectedCharm = sortedTokenCharms[i];
            break;
          }
        }

        if (selectedCharm.amount < tokenCost) {
          log.warn(
            `No single UTXO has enough tokens (need ${formatTokenAmount(tokenCost)}). ` +
              `Using largest UTXO (${formatTokenAmount(sortedTokenCharms[0].amount)}). ` +
              `Consider consolidating tokens.`,
          );
          selectedCharm = sortedTokenCharms[0];
        }

        const tokenUtxo = {
          txid: selectedCharm.txid,
          vout: selectedCharm.vout,
        };
        log.info(
          `Using token UTXO: ${tokenUtxo.txid}:${tokenUtxo.vout} (${formatTokenAmount(selectedCharm.amount)})`,
        );

        // 3. Create PSBT via levelUp
        log.info(`Creating evolution PSBT...`);
        const result = await levelUp(nft, nftUtxo, tokenUtxo, totalTokens);

        if (!result.success || !result.psbt) {
          throw new Error(
            result.error || "Failed to create evolution transaction",
          );
        }

        // 4. Sign PSBT with wallet
        log.info(`Signing PSBT...`);
        const signedPsbtHex = await signPsbt(result.psbt);
        if (!signedPsbtHex) {
          throw new Error("Transaction was cancelled or failed to sign");
        }

        // 5. Extract and broadcast
        log.info(`Broadcasting transaction...`);

        // Detect PSBT format: hex vs base64 (uses PSBT magic bytes)
        // Hex: "70736274ff" | Base64: "cHNidP8"
        const isHexPsbt = signedPsbtHex.toLowerCase().startsWith("70736274ff");
        const isBase64Psbt = signedPsbtHex.startsWith("cHNidP8");
        const isPsbtFormat = isHexPsbt || isBase64Psbt;

        let rawTxHex: string;
        if (isPsbtFormat) {
          const signedPsbt = isHexPsbt
            ? Psbt.fromHex(signedPsbtHex)
            : Psbt.fromBase64(signedPsbtHex);
          signedPsbt.finalizeAllInputs();
          rawTxHex = signedPsbt.extractTransaction().toHex();
        } else {
          // Wallet returned a raw transaction directly (already finalized)
          rawTxHex = signedPsbtHex;
          log.info("Wallet returned raw tx (not PSBT), broadcasting directly");
        }

        const txid = await mempoolClient.broadcastTransaction(rawTxHex);

        if (!txid) {
          throw new Error("Failed to broadcast transaction to the network");
        }

        // 6. Track pending transaction
        startTracking();
        addTransaction(
          txid,
          "nft_evolution",
          `Genesis Spark #${nft.tokenId} evolved to level ${nft.level + 1}`,
        );

        // 7. Notify server of evolution (with retry and exponential backoff)
        const newLevel = nft.level + 1;
        confirmEvolutionWithRetry(
          nft.tokenId,
          txid,
          newLevel,
          wallet.address,
        ).then((confirmed) => {
          if (confirmed) {
            log.info(`Server confirmed level ${newLevel}`);
          }
        });

        log.info(`Success! TXID: ${txid}`);
        return {
          success: true,
          txid,
          newLevel: nft.level + 1,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Evolution failed";
        setError(message);
        log.error("Error:", { message });
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
      genesisBabiesConfig,
      babtcConfig,
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
