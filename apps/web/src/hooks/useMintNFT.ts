/**
 * useMintNFT Hook
 *
 * NFT minting hook for testnet4 production, using the unified /mint flow (D6).
 *
 * Flow:
 * 1. Get funding UTXO from wallet
 * 2. POST /api/nft/mint/prepare — server derives tokenId + traits and builds
 *    an atomic spell (NFT coin + treasury payment in the same Bitcoin tx).
 *    Returns unsigned commitTxHex + spellTxHex.
 * 3. Sign commitTx and spellTx with the wallet
 * 4. Broadcast commit, wait for confirmation, broadcast spell
 * 5. POST /api/nft/mint/finalize — server verifies the spell on-chain and
 *    persists the NFT.
 *
 * Traits are generated server-side (never by the client) — this closes the
 * mythic-always bug (#2) and the free-mint bug (#1).
 */

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  useWalletStore,
  usePendingTxStore,
  useNetworkStore,
  getApiClient,
} from "@bitcoinbaby/core";
import {
  createMempoolClient,
  rawTxToPsbt,
  Psbt,
  type SparkNFTState,
} from "@bitcoinbaby/bitcoin";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("MintNFT");

// =============================================================================
// CONFIGURABLE TIMEOUT
// =============================================================================

const CONFIRMATION_TIMEOUT_MS =
  (typeof process !== "undefined" && process.env?.CONFIRMATION_TIMEOUT_MS
    ? parseInt(process.env.CONFIRMATION_TIMEOUT_MS, 10)
    : 600000) || 600000;

/** Minimum funding UTXO value to cover price (5000) + dust (330) + fee reserve
 *  (1000), matching the server's check in routes/nft/mint.ts. */
const MIN_FUNDING_SATS = 6330;

// =============================================================================
// PERSISTENT FINALIZE QUEUE (localStorage)
// =============================================================================
// If finalizeMint fails (network error, server restart, etc.), the NFT is
// already on-chain but the indexer doesn't know yet. We persist the spellTxid
// so we can retry finalize on the next app load.

interface PendingFinalize {
  spellTxid: string;
  address: string;
  tokenId: number;
  timestamp: number;
  retryCount: number;
}

const FINALIZE_QUEUE_KEY = "bb_pending_finalizes";

function loadFinalizeQueue(): PendingFinalize[] {
  try {
    const raw = localStorage.getItem(FINALIZE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingFinalize[];
  } catch {
    return [];
  }
}

function saveFinalizeQueue(queue: PendingFinalize[]): void {
  try {
    localStorage.setItem(FINALIZE_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    log.warn("Failed to persist finalize queue");
  }
}

/**
 * Retry a single pending finalize with exponential backoff.
 * Returns true if successful, false if should remain queued.
 */
async function retryFinalize(
  apiClient: ReturnType<typeof getApiClient>,
  item: PendingFinalize,
): Promise<boolean> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await apiClient.finalizeMint({
        spellTxid: item.spellTxid,
        address: item.address,
      });
      if (result.success) {
        log.info(`Retry finalize succeeded for token ${item.tokenId}:`, {
          attempt: attempt + 1,
        });
        return true;
      }
      // A 409 means the spell tx was already finalized — treat as success.
      lastError = result.error;
    } catch (err) {
      lastError = err;
    }
    if (attempt < 2) {
      const delay = 2000 * 2 ** attempt; // 2s, 4s
      log.warn(
        `Retry finalize attempt ${attempt + 1}/3 failed for token ${item.tokenId}, retrying in ${delay}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  log.error(`All retry attempts failed for token ${item.tokenId}:`, {
    error: lastError,
  });
  return false;
}

/**
 * Process the persistent finalize queue (called on app load and after new
 * mints). Items that succeed are removed. Items that exhaust all retries are
 * kept for the next load.
 */
async function processFinalizeQueue(): Promise<void> {
  const queue = loadFinalizeQueue();
  if (queue.length === 0) return;

  log.info(`Processing ${queue.length} pending finalizes from queue`);
  const apiClient = getApiClient();
  const remaining: PendingFinalize[] = [];

  for (const item of queue) {
    const success = await retryFinalize(apiClient, item);
    if (!success) {
      remaining.push({ ...item, retryCount: item.retryCount + 1 });
    }
  }

  saveFinalizeQueue(remaining);
  if (remaining.length > 0) {
    log.warn(`${remaining.length} finalizes still pending after retry`);
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface MintResult {
  success: boolean;
  nft?: SparkNFTState;
  txid?: string;
  spellTxid?: string;
  commitTxid?: string;
  error?: string;
}

export type MintStep =
  | "idle"
  | "checking_prover"
  | "preparing"
  | "signing_commit"
  | "signing_spell"
  | "broadcasting_commit"
  | "broadcasting_spell"
  | "finalizing"
  | "success"
  | "error";

export interface UseMintNFTReturn {
  isLoading: boolean;
  error: string | null;
  suggestedAction: string | null;
  lastMinted: SparkNFTState | null;
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
// PSBT HELPERS
// =============================================================================

/**
 * Check if string is a PSBT (vs raw transaction)
 * PSBT magic bytes: 0x70736274ff ("psbt" + 0xff)
 * Can be hex encoded or base64 encoded
 */
function isPsbt(data: string): boolean {
  if (data.toLowerCase().startsWith("70736274ff")) return true;
  if (data.startsWith("cHNidP8")) return true;
  return false;
}

/**
 * Extract raw transaction hex from a signed/finalized PSBT.
 * After signing, the wallet returns a PSBT in hex format.
 * We need to extract the final transaction to broadcast.
 */
function extractRawTxFromPsbt(psbtHex: string): string {
  const psbt = Psbt.fromHex(psbtHex);
  return psbt.extractTransaction().toHex();
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Map raw error messages to user-friendly suggested actions.
 * Helps guide users toward resolution instead of just showing raw errors.
 */
function getSuggestedAction(errorMessage: string): string {
  const lower = errorMessage.toLowerCase();

  if (
    lower.includes("no utxos") ||
    lower.includes("fund your wallet") ||
    lower.includes("no utxo")
  ) {
    return `Fund your wallet first — you need at least ${MIN_FUNDING_SATS.toLocaleString()} sats to cover the mint price + dust + fee.`;
  }

  if (
    lower.includes("cancelled") ||
    lower.includes("rejected") ||
    lower.includes("denied")
  ) {
    return "Transaction was cancelled. Try again when you're ready to sign.";
  }

  if (
    lower.includes("prover") ||
    lower.includes("unavailable") ||
    lower.includes("health")
  ) {
    return "Charms prover is temporarily unavailable. Please wait a few minutes and try again.";
  }

  if (
    lower.includes("broadcast") ||
    lower.includes("mempool") ||
    lower.includes("network")
  ) {
    return "Network issue detected. Check your connection and mempool status, then try again.";
  }

  if (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("confirmation")
  ) {
    return "Transaction is taking longer than expected. Check the mempool for your transaction, or try minting again.";
  }

  if (
    lower.includes("max supply") ||
    lower.includes("supply") ||
    lower.includes("below the minimum")
  ) {
    return "NFT supply may be exhausted, or your UTXO is too small. Check the explorer and your wallet balance.";
  }

  if (lower.includes("wallet") || lower.includes("connect")) {
    return "Connect your wallet first, then try minting again.";
  }

  if (lower.includes("insufficient") || lower.includes("balance")) {
    return "Insufficient balance. Add funds to your wallet and try again.";
  }

  if (lower.includes("sign") || lower.includes("psbt")) {
    return "Transaction signing failed. Make sure your wallet supports PSBT signing.";
  }

  return "Try again. If the issue persists, check your wallet balance and connection.";
}

export function useMintNFT(): UseMintNFTReturn {
  // State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestedAction, setSuggestedAction] = useState<string | null>(null);
  const [lastMinted, setLastMinted] = useState<SparkNFTState | null>(null);
  const [spellTxid, setSpellTxid] = useState<string | null>(null);
  const [commitTxid, setCommitTxid] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<MintStep>("idle");

  // Wallet
  const wallet = useWalletStore((s) => s.wallet);
  const signPsbt = useWalletStore((s) => s.signPsbt);

  // Network
  const { network } = useNetworkStore();

  // Pending transactions
  const addTransaction = usePendingTxStore((s) => s.addTransaction);
  const startTracking = usePendingTxStore((s) => s.startTracking);

  // Mempool client for broadcasting
  const mempoolClient = useMemo(
    () => createMempoolClient({ network }),
    [network],
  );

  // Wallet connection check
  const isWalletConnected = Boolean(wallet?.address && signPsbt);

  // Process any pending finalizes from previous sessions on mount
  useEffect(() => {
    processFinalizeQueue().catch((err) =>
      log.warn("Failed to process finalize queue:", { error: err }),
    );
  }, []);

  /**
   * Mint NFT using the unified /mint flow.
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

    // Step 0: Check prover health before starting
    setCurrentStep("checking_prover");
    const apiClient = getApiClient();

    try {
      const healthResult = await apiClient.checkProverHealth();
      if (!healthResult.success || !healthResult.data?.available) {
        const errorMsg =
          healthResult.data?.error ||
          "Charms prover is currently unavailable. Please try again later.";
        setError(errorMsg);
        setSuggestedAction(getSuggestedAction(errorMsg));
        setCurrentStep("error");
        setIsLoading(false);
        return {
          success: false,
          error: errorMsg,
        };
      }
      log.info(`Prover health OK (latency: ${healthResult.data.latencyMs}ms)`);
    } catch {
      log.warn("Prover health check failed, proceeding anyway");
    }

    // Fetch UTXOs from mempool
    const utxos = await mempoolClient.getUTXOs(wallet.address);

    if (!utxos || utxos.length === 0) {
      setIsLoading(false);
      setCurrentStep("error");
      setError("No UTXOs available. Please fund your wallet.");
      return {
        success: false,
        error: "No UTXOs available. Please fund your wallet.",
      };
    }

    // Find a suitable funding UTXO covering price + dust + fee
    const fundingUtxo = utxos.find(
      (u: { value: number }) => u.value >= MIN_FUNDING_SATS,
    );
    if (!fundingUtxo) {
      setIsLoading(false);
      setCurrentStep("error");
      setError(
        `No UTXO with at least ${MIN_FUNDING_SATS} sats available (price + dust + fee)`,
      );
      return {
        success: false,
        error: `No UTXO with at least ${MIN_FUNDING_SATS} sats available (price + dust + fee)`,
      };
    }

    try {
      // Step 1: prepare the atomic mint server-side. The server picks the
      // tokenId, derives the traits, and builds the atomic spell (NFT coin +
      // treasury payment in the same tx). We get back the unsigned hexes.
      setCurrentStep("preparing");

      log.info("Calling /mint/prepare...", {
        address: wallet.address,
        fundingUtxo: {
          txid: fundingUtxo.txid,
          vout: fundingUtxo.vout,
          value: fundingUtxo.value,
        },
      });

      const prepareResult = await apiClient.prepareMint({
        address: wallet.address,
        fundingUtxo: {
          txid: fundingUtxo.txid,
          vout: fundingUtxo.vout,
          value: fundingUtxo.value,
        },
      });

      if (!prepareResult.success || !prepareResult.data) {
        throw new Error(prepareResult.error || "Failed to prepare NFT mint");
      }

      const { tokenId, traits, commitTxHex, spellTxHex } = prepareResult.data;

      log.info("Mint prepared:", {
        tokenId,
        traits: {
          bloodline: traits.bloodline,
          baseType: traits.baseType,
          rarityTier: traits.rarityTier,
        },
        priceSats: prepareResult.data.priceSats,
        treasuryAddress: prepareResult.data.treasuryAddress,
      });

      if (!spellTxHex) {
        throw new Error("Server did not return spell transaction");
      }

      // Step 2: Sign the commit + spell transactions
      const commitIsPsbt = commitTxHex ? isPsbt(commitTxHex) : false;
      const spellIsPsbt = isPsbt(spellTxHex);

      let finalCommitHex: string | null = null;
      let finalSpellHex: string = spellTxHex;

      // 2a. Commit transaction (if present)
      if (commitTxHex) {
        if (commitIsPsbt) {
          setCurrentStep("signing_commit");
          log.info("Signing commit PSBT...");
          const signed = await signPsbt(commitTxHex);
          if (!signed) {
            throw new Error("Commit transaction signing was cancelled");
          }
          finalCommitHex = signed;
        } else {
          log.info("Commit is raw TX, skipping signing");
          finalCommitHex = commitTxHex;
        }
      } else {
        log.info("No commit transaction from prepare, skipping commit");
      }

      // 2b. Spell transaction
      if (spellIsPsbt) {
        setCurrentStep("signing_spell");
        log.info("Signing spell PSBT...");
        const signed = await signPsbt(spellTxHex);
        if (!signed) {
          throw new Error("Spell transaction signing was cancelled");
        }
        finalSpellHex = signed;
      } else {
        // Raw transaction from the prover — convert to PSBT and sign
        setCurrentStep("signing_spell");
        log.info("Converting raw TX to PSBT for signing...");
        try {
          const psbtHex = await rawTxToPsbt(
            spellTxHex,
            fundingUtxo,
            wallet.address,
            mempoolClient,
            network,
          );
          log.info("PSBT created, requesting wallet signature...");
          const signed = await signPsbt(psbtHex);
          if (!signed) {
            throw new Error("Spell transaction signing was cancelled");
          }
          finalSpellHex = signed;
          log.info("Spell transaction signed successfully");
        } catch (convertError) {
          log.error("Failed to convert/sign raw TX:", { error: convertError });
          throw new Error(
            `Failed to sign transaction: ${convertError instanceof Error ? convertError.message : "Unknown error"}`,
          );
        }
      }

      // Step 3: Broadcast commit transaction (if present)
      let broadcastCommitTxid: string | null = null;
      if (finalCommitHex) {
        setCurrentStep("broadcasting_commit");

        log.info("Broadcasting commit transaction...");
        const commitRawTx = isPsbt(finalCommitHex)
          ? extractRawTxFromPsbt(finalCommitHex)
          : finalCommitHex;

        broadcastCommitTxid =
          await mempoolClient.broadcastTransaction(commitRawTx);
        if (!broadcastCommitTxid) {
          throw new Error("Failed to broadcast commit transaction");
        }
        setCommitTxid(broadcastCommitTxid);
        log.info("Commit TX broadcast:", { txid: broadcastCommitTxid });

        // Wait for commit confirmation before broadcasting spell. Without
        // this, the spell references a UTXO that may not exist yet in the
        // mempool — resulting in a rejected spell (C1 fix).
        log.info(
          `Polling for commit confirmation (timeout: ${CONFIRMATION_TIMEOUT_MS}ms)...`,
        );
        const commitConfirmed = await new Promise<boolean>((resolve) => {
          const startTime = Date.now();
          let resolved = false;

          const poll = async () => {
            if (resolved) return;
            try {
              const tx = await mempoolClient.getTransaction(
                broadcastCommitTxid!,
              );
              if (tx && tx.status && tx.status.confirmed === true) {
                resolved = true;
                log.info("Commit confirmed in block:", {
                  txid: broadcastCommitTxid,
                  elapsed: Date.now() - startTime,
                });
                resolve(true);
                return;
              }
            } catch {
              // Transaction not found yet or not confirmed — expected during polling
            }

            if (Date.now() - startTime >= CONFIRMATION_TIMEOUT_MS) {
              resolved = true;
              log.error("Commit confirmation timed out:", {
                txid: broadcastCommitTxid,
                elapsed: Date.now() - startTime,
              });
              resolve(false);
              return;
            }

            const elapsed = Date.now() - startTime;
            const nextDelay = Math.min(Math.max(1000, elapsed / 2), 16000);
            setTimeout(poll, nextDelay);
          };

          setTimeout(poll, 1000);
        });

        if (!commitConfirmed) {
          throw new Error(
            `Commit transaction ${broadcastCommitTxid} not confirmed in mempool after ${CONFIRMATION_TIMEOUT_MS}ms`,
          );
        }
      } else {
        log.info("Skipping commit broadcast (single-tx flow)");
      }

      // Step 4: Broadcast spell transaction
      setCurrentStep("broadcasting_spell");

      const spellRawTx = isPsbt(finalSpellHex)
        ? extractRawTxFromPsbt(finalSpellHex)
        : finalSpellHex;

      log.info("Broadcasting spell transaction...", {
        isPsbt: isPsbt(finalSpellHex),
        rawTxPrefix: spellRawTx.slice(0, 20),
      });

      let broadcastSpellTxid: string;
      try {
        broadcastSpellTxid =
          await mempoolClient.broadcastTransaction(spellRawTx);
        if (!broadcastSpellTxid) {
          throw new Error("Failed to broadcast spell transaction");
        }
      } catch (broadcastError) {
        log.error("Spell broadcast failed:", {
          error:
            broadcastError instanceof Error
              ? broadcastError.message
              : broadcastError,
        });
        throw broadcastError;
      }
      setSpellTxid(broadcastSpellTxid);
      log.info("Spell TX broadcast:", { txid: broadcastSpellTxid });

      // Track pending transactions
      startTracking();
      if (broadcastCommitTxid) {
        addTransaction(
          broadcastCommitTxid,
          "nft_mint",
          `Genesis Spark #${tokenId} commit`,
        );
      }
      addTransaction(
        broadcastSpellTxid,
        "nft_mint",
        `Genesis Spark #${tokenId} spell`,
      );

      // Step 5: Finalize with server (verify on-chain + persist).
      // Robust finalize with retry + persistent fallback queue: if the call
      // fails (network error, server restart, etc.), the NFT is already
      // on-chain and we queue the finalize for the next app load.
      setCurrentStep("finalizing");

      const pendingItem: PendingFinalize = {
        spellTxid: broadcastSpellTxid,
        address: wallet.address,
        tokenId,
        timestamp: Date.now(),
        retryCount: 0,
      };

      (async () => {
        const success = await retryFinalize(apiClient, pendingItem);
        if (!success) {
          log.warn(
            "NFT minted on blockchain but server sync pending (queued for retry):",
            { tokenId, spellTxid: broadcastSpellTxid },
          );
          const queue = loadFinalizeQueue();
          queue.push(pendingItem);
          saveFinalizeQueue(queue);
        } else {
          log.info("Finalize succeeded:", { tokenId });
        }
      })();

      // Build the displayable NFT state from the server-generated traits.
      const blockHeight = await mempoolClient.getBlockHeight();
      const nftState: SparkNFTState = {
        dna: traits.dna,
        bloodline: traits.bloodline as SparkNFTState["bloodline"],
        baseType: traits.baseType as SparkNFTState["baseType"],
        genesisBlock: blockHeight,
        rarityTier: traits.rarityTier as SparkNFTState["rarityTier"],
        tokenId,
        heritage: 0,
        level: 1,
        xp: 0,
        totalXp: 0,
        workCount: 0,
        lastWorkBlock: blockHeight,
        evolutionCount: 0,
        tokensEarned: 0n,
        narrativeRoot: "",
        worldStateRoot: "",
        lastSettleBlock: 0,
        settleCount: 0,
      };

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
      setSuggestedAction(getSuggestedAction(message));
      setCurrentStep("error");

      return { success: false, error: message };
    } finally {
      setIsLoading(false);
    }
  }, [wallet, signPsbt, mempoolClient, addTransaction, startTracking, network]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setSuggestedAction(null);
    setLastMinted(null);
    setSpellTxid(null);
    setCommitTxid(null);
    setCurrentStep("idle");
  }, []);

  return {
    isLoading,
    error,
    suggestedAction,
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
