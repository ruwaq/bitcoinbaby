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
  type Bloodline,
  type BaseType,
  type RarityTier,
  type BabyNFTState,
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

// =============================================================================
// PERSISTENT CONFIRMATION QUEUE (localStorage)
// =============================================================================

interface PendingConfirmation {
  tokenId: number;
  spellTxid: string;
  address: string;
  nftData: {
    dna: string;
    bloodline: string;
    baseType: string;
    rarityTier: string;
    level: number;
    xp: number;
    totalXp: number;
    workCount: number;
    evolutionCount: number;
  };
  attemptId: string | null;
  commitTxid: string | null;
  timestamp: number;
  retryCount: number;
}

const CONFIRMATION_QUEUE_KEY = "bb_pending_confirmations";

function loadConfirmationQueue(): PendingConfirmation[] {
  try {
    const raw = localStorage.getItem(CONFIRMATION_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PendingConfirmation[];
  } catch {
    return [];
  }
}

function saveConfirmationQueue(queue: PendingConfirmation[]): void {
  try {
    localStorage.setItem(CONFIRMATION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // localStorage full or unavailable - log but don't throw
    log.warn("Failed to persist confirmation queue");
  }
}

/**
 * Retry a single pending confirmation with exponential backoff.
 * Returns true if successful, false if should remain queued.
 */
async function retryConfirmation(
  apiClient: ReturnType<typeof getApiClient>,
  item: PendingConfirmation,
): Promise<boolean> {
  const { tokenId, spellTxid, address, nftData, attemptId, commitTxid } = item;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await apiClient.confirmNFTMint(tokenId, spellTxid, address, nftData);
      if (attemptId) {
        await apiClient.updateMintAttempt(attemptId, "confirmed", {
          commitTxid: commitTxid || undefined,
          spellTxid,
        });
      }
      log.info(`Retry confirmation succeeded for token ${tokenId}:`, {
        attempt: attempt + 1,
      });
      return true;
    } catch (err) {
      lastError = err;
      if (attempt < 2) {
        const delay = 2000 * 2 ** attempt; // 2s, 4s, 8s
        log.warn(
          `Retry confirmation attempt ${attempt + 1}/3 failed for token ${tokenId}, retrying in ${delay}ms`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  log.error(`All retry attempts failed for token ${tokenId}:`, {
    error: lastError,
  });
  return false;
}

/**
 * Process the persistent confirmation queue (called on app load and after new mints).
 * Items that succeed are removed. Items that exhaust all retries are kept for next load.
 */
async function processConfirmationQueue(): Promise<void> {
  const queue = loadConfirmationQueue();
  if (queue.length === 0) return;

  log.info(`Processing ${queue.length} pending confirmations from queue`);
  const apiClient = getApiClient();
  const remaining: PendingConfirmation[] = [];

  for (const item of queue) {
    const success = await retryConfirmation(apiClient, item);
    if (!success) {
      const updated = { ...item, retryCount: item.retryCount + 1 };
      remaining.push(updated);
    }
  }

  saveConfirmationQueue(remaining);
  if (remaining.length > 0) {
    log.warn(
      `${remaining.length} confirmations still pending after retry`,
    );
  }
}

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
  | "checking_prover"
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
  suggestedAction: string | null;
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

/**
 * Check if string is a PSBT (vs raw transaction)
 * PSBT magic bytes: 0x70736274ff ("psbt" + 0xff)
 * Can be hex encoded or base64 encoded
 */
function isPsbt(data: string): boolean {
  // Check hex format: 70736274ff
  if (data.toLowerCase().startsWith("70736274ff")) {
    return true;
  }
  // Check base64 format: cHNidP8 (base64 of "psbt\xff")
  if (data.startsWith("cHNidP8")) {
    return true;
  }
  return false;
}

/**
 * Extract raw transaction hex from a signed/finalized PSBT
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
    return "Fund your wallet first — you need at least 2,000 sats to cover fees.";
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
    lower.includes("reserve") ||
    lower.includes("supply")
  ) {
    return "NFT supply may be exhausted. Check the explorer to see available NFTs.";
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
  const [lastMinted, setLastMinted] = useState<BabyNFTState | null>(null);
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

  // Process any pending confirmations from previous sessions on mount
  useEffect(() => {
    processConfirmationQueue().catch((err) =>
      log.warn("Failed to process confirmation queue:", { error: err }),
    );
  }, []);

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
      log.info(
        `Prover health OK (latency: ${healthResult.data.latencyMs}ms)`,
      );
    } catch (healthError) {
      log.warn("Prover health check failed, proceeding anyway");
      // Don't block on health check failure - prover might still work
    }

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

    // Track reserved token ID and attempt ID for cleanup on error
    let reservedTokenId: number | null = null;
    let attemptId: string | null = null;

    try {
      // Step 1: Reserve next NFT ID from server (now tracks attempt)
      const reserveResult = await apiClient.reserveNFT(wallet.address);

      if (!reserveResult.success || !reserveResult.data) {
        throw new Error(
          reserveResult.error ||
            "Failed to reserve NFT ID - max supply reached?",
        );
      }

      reservedTokenId = reserveResult.data.tokenId;
      attemptId = reserveResult.data.attemptId;
      log.info(
        `Reserved token ID: ${reservedTokenId} (total: ${reserveResult.data.totalMinted}, attemptId: ${attemptId})`,
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

      log.info("Generated traits:", {
        tokenId: reservedTokenId,
        bloodline,
        baseType,
        rarityTier,
      });

      // Step 3: Submit to prover API
      setCurrentStep("proving");

      // Update attempt status to proving
      if (attemptId) {
        apiClient
          .updateMintAttempt(attemptId, "proving")
          .catch((err) =>
            log.warn("Failed to update attempt:", { error: err }),
          );
      }

      log.info("Submitting to prover...", {
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
        log.info("Prover response received:", { result: proveResult });
      } catch (proveError) {
        log.error("Prover request failed:", { error: proveError });
        throw proveError;
      }

      if (!proveResult.success || !proveResult.data) {
        log.error("Prover returned error:", { result: proveResult });
        throw new Error(
          proveResult.error || "Failed to generate NFT proof from prover",
        );
      }

      const { commitTxHex, spellTxHex } = proveResult.data;

      log.info("Prover returned transactions:", {
        commitTxid: proveResult.data.commitTxid,
        spellTxid: proveResult.data.spellTxid,
        hasCommitTx: Boolean(commitTxHex),
        hasSpellTx: Boolean(spellTxHex),
        spellTxPrefix: spellTxHex?.slice(0, 20),
        spellTxLength: spellTxHex?.length,
      });

      if (!spellTxHex) {
        throw new Error("Prover did not return spell transaction");
      }

      // Detect if prover returned PSBT or raw transaction
      const commitIsPsbt = commitTxHex ? isPsbt(commitTxHex) : false;
      const spellIsPsbt = isPsbt(spellTxHex);

      log.info("Transaction formats:", {
        commitIsPsbt,
        spellIsPsbt,
        // Log first 40 chars for debugging
        spellPrefix: spellTxHex.slice(0, 40),
      });

      let finalCommitHex: string | null = null;
      let finalSpellHex: string = spellTxHex;
      let broadcastCommitTxid: string | null = null;

      // Step 4: Handle commit transaction (if present)
      if (commitTxHex) {
        if (commitIsPsbt) {
          // PSBT needs signing
          setCurrentStep("signing_commit");

          // Update attempt status to signing
          if (attemptId) {
            apiClient
              .updateMintAttempt(attemptId, "signing")
              .catch((err) =>
                log.warn("Failed to update attempt:", { error: err }),
              );
          }

          log.info("Signing commit PSBT...");

          const signed = await signPsbt(commitTxHex);
          if (!signed) {
            throw new Error("Commit transaction signing was cancelled");
          }
          finalCommitHex = signed;
        } else {
          // Raw transaction - ready to broadcast
          log.info("Commit is raw TX, skipping signing");
          finalCommitHex = commitTxHex;
        }
      } else {
        log.info(
          "No commit transaction from prover, skipping commit",
        );
      }

      // Step 5: Handle spell transaction
      if (spellIsPsbt) {
        // Already a PSBT - sign directly
        setCurrentStep("signing_spell");
        log.info("Signing spell PSBT...");

        const signed = await signPsbt(spellTxHex);
        if (!signed) {
          throw new Error("Spell transaction signing was cancelled");
        }
        finalSpellHex = signed;
      } else {
        // Raw transaction from V11 prover - convert to PSBT and sign
        setCurrentStep("signing_spell");
        log.info("Converting raw TX to PSBT for signing...");

        try {
          const psbtHex = await rawTxToPsbt(
            spellTxHex,
            fundingUtxo,
            wallet.address,
            mempoolClient,
          );
          log.info("PSBT created, requesting wallet signature...");

          const signed = await signPsbt(psbtHex);
          if (!signed) {
            throw new Error("Spell transaction signing was cancelled");
          }
          finalSpellHex = signed;
          log.info("Spell transaction signed successfully");
        } catch (convertError) {
          log.error(
            "Failed to convert/sign raw TX:",
            { error: convertError },
          );
          throw new Error(
            `Failed to sign transaction: ${convertError instanceof Error ? convertError.message : "Unknown error"}`,
          );
        }
      }

      // Step 6: Broadcast commit transaction (if present)
      if (finalCommitHex) {
        setCurrentStep("broadcasting_commit");

        // Update attempt status to broadcasting
        if (attemptId) {
          apiClient
            .updateMintAttempt(attemptId, "broadcasting")
            .catch((err) =>
              log.warn("Failed to update attempt:", { error: err }),
            );
        }

        log.info("Broadcasting commit transaction...");

        // Extract raw transaction from signed PSBT if needed
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

        // C1 FIX: Wait for commit confirmation before broadcasting spell.
        // Without this, the spell references a UTXO that may not exist yet in
        // the mempool — resulting in a rejected spell or orphan risk.
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
              if (tx && tx.txid) {
                resolved = true;
                log.info("Commit confirmed in mempool:", {
                  txid: broadcastCommitTxid,
                  elapsed: Date.now() - startTime,
                });
                resolve(true);
                return;
              }
            } catch {
              // Transaction not found yet — this is expected during polling
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

            // Exponential backoff polling: 1s, 2s, 4s, 8s, 16s (capped)
            const elapsed = Date.now() - startTime;
            const nextDelay = Math.min(
              Math.max(1000, elapsed / 2),
              16000,
            );
            setTimeout(poll, nextDelay);
          };

          // Start first poll after 1 second (give mempool time to propagate)
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

      // Step 7: Broadcast spell transaction
      setCurrentStep("broadcasting_spell");

      // Extract raw transaction from signed PSBT
      // The wallet returns a finalized PSBT in hex, but mempool needs raw TX
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
        log.error(
          "Spell broadcast failed:",
          { error: broadcastError instanceof Error
            ? broadcastError.message
            : broadcastError },
        );
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

      // C2 FIX: Robust confirmation with retry + persistent fallback queue.
      // If confirmNFTMint or updateMintAttempt fail (network error, server
      // restart, etc.), we retry with exponential backoff, and if all retries
      // are exhausted we queue the confirmation in localStorage so it can be
      // retried on the next app load.

      // Build confirmation payload
      const confirmationNftData = {
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

      const pendingItem: PendingConfirmation = {
        tokenId: reservedTokenId,
        spellTxid: broadcastSpellTxid,
        address: wallet.address,
        nftData: confirmationNftData,
        attemptId: attemptId || null,
        commitTxid: broadcastCommitTxid || null,
        timestamp: Date.now(),
        retryCount: 0,
      };

      // Fire non-blocking confirmation with retry + persistent queue
      (async () => {
        const success = await retryConfirmation(apiClient, pendingItem);
        if (!success) {
          // All retries exhausted — persist for next app load
          log.warn(
            "NFT minted on blockchain but server sync pending (queued for retry):",
            { tokenId: reservedTokenId, spellTxid: broadcastSpellTxid },
          );
          const queue = loadConfirmationQueue();
          queue.push(pendingItem);
          saveConfirmationQueue(queue);
          // TODO: surface this warning to the user via some UI mechanism
          // (e.g. toast: "NFT minted on blockchain but server sync pending")
        } else {
          log.info("Confirmation succeeded:", { tokenId: reservedTokenId });
        }
      })();

      // Clear reservedTokenId on success (no cleanup needed)
      reservedTokenId = null;
      attemptId = null;

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

      // Update attempt status to failed
      if (attemptId) {
        apiClient
          .updateMintAttempt(attemptId, "failed", { error: message })
          .catch((updateErr) =>
            log.warn("Failed to update attempt:", { error: updateErr }),
          );
      }

      // Release reserved token ID if mint failed after reservation
      if (reservedTokenId !== null) {
        log.info(
          `Releasing reserved token ID ${reservedTokenId} due to error`,
        );
        apiClient
          .releaseNFT(reservedTokenId)
          .catch((releaseErr) =>
            log.warn(
              `Failed to release token ${reservedTokenId}:`,
              { error: releaseErr },
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
