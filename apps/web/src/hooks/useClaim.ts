"use client";

/**
 * useClaim Hook - Optimized Version
 *
 * Hook for managing the claim flow with:
 * - State machine for clear status tracking
 * - Optimistic updates with rollback
 * - Exponential backoff for polling
 * - Better error handling
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { createTransactionBuilder, type TxUTXO } from "@bitcoinbaby/bitcoin";

// Workers API URL from environment
const WORKERS_API_URL =
  process.env.NEXT_PUBLIC_WORKERS_API_URL ||
  "https://bitcoinbaby-api.andeanlabs-58f.workers.dev";

// =============================================================================
// TYPES
// =============================================================================

/** Claim operation status - single source of truth */
export type ClaimStatus =
  | "idle"
  | "loading-balance"
  | "preparing"
  | "ready-to-broadcast"
  | "broadcasting"
  | "waiting-confirmation"
  | "confirming"
  | "minting"
  | "completed"
  | "error";

interface ClaimableBalance {
  address: string;
  unclaimedWork: string;
  unclaimedProofs: number;
  claimableTokens: string;
  lastProofAt: number;
  totalClaimed: string;
  claimCount: number;
  estimatedFee: number;
  feeRate: number;
  platformFeePercent: number;
  platformFeeTokens: string;
  foundationAddress: string | null;
  netTokens: string;
}

interface ClaimData {
  proof: {
    address: string;
    totalWork: string;
    proofCount: number;
    merkleRoot: string;
    tokenAmount: string;
    timestamp: number;
    nonce: string;
  };
  serverSignature: string;
  opReturnData: string;
  estimatedFee: number;
}

interface ClaimPrepareResponse {
  claimData: ClaimData;
  totalWork: string;
  proofCount: number;
  tokenAmount: string;
  estimatedFee: number;
  expiresAt: number;
  platformFeePercent: number;
  platformFeeTokens: string;
  foundationAddress: string | null;
  netTokens: string;
}

export interface ClaimHistoryItem {
  id: string;
  amount: string;
  proofCount: number;
  status: string;
  claimTxid: string | null;
  mintTxid: string | null;
  error: string | null;
  preparedAt: number;
  confirmedAt: number | null;
  mintedAt: number | null;
}

interface UseClaimOptions {
  address?: string;
  publicKey?: string;
  utxos?: TxUTXO[];
  signAndBroadcast?: (
    psbtHex: string,
  ) => Promise<{ success: boolean; txid: string }>;
}

interface UseClaimReturn {
  // Balance state
  claimableBalance: ClaimableBalance | null;
  isLoadingBalance: boolean;
  balanceError: string | null;

  // Claim state (unified)
  status: ClaimStatus;
  preparedClaim: ClaimPrepareResponse | null;
  claimError: string | null;

  // Legacy boolean flags (for backward compatibility)
  isPreparing: boolean;
  isConfirming: boolean;
  isBroadcasting: boolean;
  isMinting: boolean;

  // History
  claimHistory: ClaimHistoryItem[];
  isLoadingHistory: boolean;

  // Capabilities
  canAutoBroadcast: boolean;

  // Actions
  refreshBalance: () => Promise<void>;
  prepareClaim: () => Promise<ClaimPrepareResponse | null>;
  broadcastClaimTx: () => Promise<string | null>;
  confirmClaim: (claimId: string, claimTxid: string) => Promise<boolean>;
  triggerMint: (claimId: string, claimTxid: string) => Promise<boolean>;
  loadHistory: () => Promise<boolean>;
  clearPreparedClaim: () => void;
}

// =============================================================================
// EXPONENTIAL BACKOFF CONFIG
// =============================================================================

const BACKOFF_CONFIG = {
  initialDelay: 5000, // 5 seconds
  maxDelay: 60000, // 60 seconds max
  multiplier: 2,
  maxAttempts: 20,
};

function getBackoffDelay(attempt: number): number {
  const delay =
    BACKOFF_CONFIG.initialDelay * Math.pow(BACKOFF_CONFIG.multiplier, attempt);
  return Math.min(delay, BACKOFF_CONFIG.maxDelay);
}

// =============================================================================
// HOOK
// =============================================================================

export function useClaim({
  address,
  publicKey,
  utxos,
  signAndBroadcast,
}: UseClaimOptions): UseClaimReturn {
  // Unified status state machine
  const [status, setStatus] = useState<ClaimStatus>("idle");

  // Balance state
  const [claimableBalance, setClaimableBalance] =
    useState<ClaimableBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Claim state
  const [preparedClaim, setPreparedClaim] =
    useState<ClaimPrepareResponse | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // History state with optimistic updates support
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Refs for cleanup and polling control
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const pollingAttemptRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const apiUrl = WORKERS_API_URL;

  // Derived states for backward compatibility
  const isLoadingBalance = status === "loading-balance";
  const isPreparing = status === "preparing";
  const isBroadcasting = status === "broadcasting";
  const isConfirming =
    status === "confirming" || status === "waiting-confirmation";
  const isMinting = status === "minting";

  // Check if we can auto-broadcast
  const canAutoBroadcast = Boolean(
    signAndBroadcast && utxos && utxos.length > 0 && publicKey,
  );

  // ==========================================================================
  // POLLING WITH EXPONENTIAL BACKOFF
  // ==========================================================================

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current);
      pollingRef.current = null;
    }
    pollingAttemptRef.current = 0;
  }, []);

  const startPollingWithBackoff = useCallback(
    (onPoll: () => Promise<boolean>) => {
      stopPolling();

      const poll = async () => {
        const shouldContinue = await onPoll();

        if (
          shouldContinue &&
          pollingAttemptRef.current < BACKOFF_CONFIG.maxAttempts
        ) {
          const delay = getBackoffDelay(pollingAttemptRef.current);
          pollingAttemptRef.current++;
          pollingRef.current = setTimeout(poll, delay);
        } else {
          stopPolling();
        }
      };

      poll();
    },
    [stopPolling],
  );

  // ==========================================================================
  // OPTIMISTIC UPDATE HELPERS
  // ==========================================================================

  const addOptimisticClaim = useCallback(
    (
      claimId: string,
      amount: string,
      proofCount: number,
      claimTxid: string,
    ) => {
      const optimisticItem: ClaimHistoryItem = {
        id: claimId,
        amount,
        proofCount,
        status: "broadcast",
        claimTxid,
        mintTxid: null,
        error: null,
        preparedAt: Date.now(),
        confirmedAt: null,
        mintedAt: null,
      };

      setClaimHistory((prev) => [
        optimisticItem,
        ...prev.filter((c) => c.id !== claimId),
      ]);
    },
    [],
  );

  const updateOptimisticClaim = useCallback(
    (claimId: string, updates: Partial<ClaimHistoryItem>) => {
      setClaimHistory((prev) =>
        prev.map((c) => (c.id === claimId ? { ...c, ...updates } : c)),
      );
    },
    [],
  );

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  const refreshBalance = useCallback(async () => {
    if (!address) return;

    setStatus("loading-balance");
    setBalanceError(null);

    try {
      const response = await fetch(`${apiUrl}/api/claim/balance/${address}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get balance");
      }

      setClaimableBalance(result.data);
      setStatus("idle");
    } catch (error) {
      console.error("Failed to get claimable balance:", error);
      setBalanceError(
        error instanceof Error ? error.message : "Failed to get balance",
      );
      setStatus("error");
    }
  }, [address, apiUrl]);

  const prepareClaim =
    useCallback(async (): Promise<ClaimPrepareResponse | null> => {
      if (!address) return null;

      setStatus("preparing");
      setClaimError(null);

      try {
        const response = await fetch(`${apiUrl}/api/claim/prepare`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to prepare claim");
        }

        setPreparedClaim(result.data);
        setStatus("ready-to-broadcast");
        return result.data;
      } catch (error) {
        console.error("Failed to prepare claim:", error);
        setClaimError(
          error instanceof Error ? error.message : "Failed to prepare claim",
        );
        setStatus("error");
        return null;
      }
    }, [address, apiUrl]);

  const broadcastClaimTx = useCallback(async (): Promise<string | null> => {
    if (
      !preparedClaim ||
      !address ||
      !signAndBroadcast ||
      !utxos ||
      !publicKey
    ) {
      setClaimError("Missing required data for auto-broadcast");
      return null;
    }

    setStatus("broadcasting");
    setClaimError(null);

    try {
      // Build the claim transaction
      const feeRate = claimableBalance?.feeRate ?? 5;
      const txBuilder = createTransactionBuilder({
        network: "testnet4",
        feeRate,
        enableRBF: true,
      });

      const unsignedTx = txBuilder.buildMiningTxWithOpReturn(
        utxos,
        address,
        preparedClaim.claimData.opReturnData,
        700,
      );

      const psbt = txBuilder.buildPSBT(unsignedTx);
      const psbtHex = psbt.toHex();

      // Sign and broadcast
      const result = await signAndBroadcast(psbtHex);

      if (!result.success || !result.txid) {
        throw new Error("Transaction broadcast failed");
      }

      console.log("Claim TX broadcast:", result.txid);

      // Optimistic update - add to history immediately
      const claimId = preparedClaim.claimData.proof.nonce;
      addOptimisticClaim(
        claimId,
        preparedClaim.tokenAmount,
        preparedClaim.proofCount,
        result.txid,
      );

      setStatus("waiting-confirmation");

      // Confirm with server (non-blocking for UX)
      try {
        const confirmResponse = await fetch(`${apiUrl}/api/claim/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, claimTxid: result.txid, address }),
        });

        const confirmResult = await confirmResponse.json();

        if (confirmResult.success) {
          setPreparedClaim(null);
          updateOptimisticClaim(claimId, { status: "confirmed" });
          refreshBalance().catch(console.error);
        } else {
          console.error("Confirm API error:", confirmResult.error);
        }
      } catch (confirmError) {
        console.error("Failed to confirm claim:", confirmError);
      }

      return result.txid;
    } catch (error) {
      console.error("Failed to broadcast claim TX:", error);
      setClaimError(
        error instanceof Error
          ? error.message
          : "Failed to broadcast transaction",
      );
      setStatus("error");
      return null;
    }
  }, [
    preparedClaim,
    address,
    signAndBroadcast,
    utxos,
    publicKey,
    apiUrl,
    claimableBalance,
    addOptimisticClaim,
    updateOptimisticClaim,
    refreshBalance,
  ]);

  // Load claim history - extracted as separate function for reuse
  const loadHistory = useCallback(async (): Promise<boolean> => {
    if (!address) return false;

    setIsLoadingHistory(true);

    try {
      const response = await fetch(`${apiUrl}/api/claim/history/${address}`);
      const result = await response.json();

      if (result.success && result.data?.claims) {
        setClaimHistory(result.data.claims);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to load claim history:", error);
      return false;
    } finally {
      setIsLoadingHistory(false);
    }
  }, [address, apiUrl]);

  const triggerMint = useCallback(
    async (claimId: string, claimTxid: string): Promise<boolean> => {
      if (!address) return false;

      setStatus("minting");
      setClaimError(null);

      // Optimistic update
      updateOptimisticClaim(claimId, { status: "minting" });

      try {
        const response = await fetch(`${apiUrl}/api/claim/mint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, claimTxid, address }),
        });

        const result = await response.json();

        if (!result.success) {
          // TX not confirmed yet - expected, start polling
          if (result.data?.status === "broadcast") {
            console.log("TX in mempool, starting polling...");
            updateOptimisticClaim(claimId, { status: "broadcast" });

            // Start polling with exponential backoff
            startPollingWithBackoff(async () => {
              const pollResult = await loadHistory();
              const claim = claimHistory.find((c) => c.id === claimId);
              // Continue polling if still broadcast/confirmed
              return (
                claim?.status === "broadcast" || claim?.status === "confirmed"
              );
            });

            setStatus("waiting-confirmation");
            return true;
          }

          // Actual error
          const errorMsg = result.error || "Failed to mint tokens";
          updateOptimisticClaim(claimId, { status: "failed", error: errorMsg });
          throw new Error(errorMsg);
        }

        // Success!
        updateOptimisticClaim(claimId, {
          status: "completed",
          mintTxid: result.data?.mintTxid,
          mintedAt: Date.now(),
        });

        await refreshBalance();
        setStatus("completed");

        // Reset to idle after showing success
        setTimeout(() => setStatus("idle"), 3000);

        return true;
      } catch (error) {
        console.error("Failed to trigger mint:", error);
        const errorMsg =
          error instanceof Error ? error.message : "Failed to mint tokens";
        setClaimError(errorMsg);
        setStatus("error");
        return false;
      }
    },
    [
      address,
      apiUrl,
      updateOptimisticClaim,
      startPollingWithBackoff,
      claimHistory,
      refreshBalance,
      loadHistory,
    ],
  );

  const confirmClaim = useCallback(
    async (claimId: string, claimTxid: string): Promise<boolean> => {
      if (!address) return false;

      setStatus("confirming");
      setClaimError(null);

      try {
        const response = await fetch(`${apiUrl}/api/claim/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, claimTxid, address }),
        });

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Failed to confirm claim");
        }

        setPreparedClaim(null);
        await Promise.all([refreshBalance(), loadHistory()]);
        setStatus("idle");

        return true;
      } catch (error) {
        console.error("Failed to confirm claim:", error);
        setClaimError(
          error instanceof Error ? error.message : "Failed to confirm claim",
        );
        setStatus("error");
        return false;
      }
    },
    [address, apiUrl, refreshBalance],
  );

  const clearPreparedClaim = useCallback(() => {
    setPreparedClaim(null);
    setClaimError(null);
    setStatus("idle");
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Load balance on mount
  useEffect(() => {
    if (address) {
      refreshBalance();
      loadHistory();
    }
  }, [address, refreshBalance, loadHistory]);

  // Auto-polling for pending claims with exponential backoff
  useEffect(() => {
    const hasPendingClaims = claimHistory.some(
      (c) =>
        c.status === "broadcast" ||
        c.status === "confirmed" ||
        c.status === "minting",
    );

    if (hasPendingClaims && address) {
      startPollingWithBackoff(async () => {
        await loadHistory();
        // Check if still has pending claims
        const stillPending = claimHistory.some(
          (c) =>
            c.status === "broadcast" ||
            c.status === "confirmed" ||
            c.status === "minting",
        );
        return stillPending;
      });
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [
    claimHistory,
    address,
    startPollingWithBackoff,
    stopPolling,
    loadHistory,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [stopPolling]);

  return {
    // Balance
    claimableBalance,
    isLoadingBalance,
    balanceError,

    // Status (new unified state)
    status,
    preparedClaim,
    claimError,

    // Legacy flags
    isPreparing,
    isConfirming,
    isBroadcasting,
    isMinting,

    // History
    claimHistory,
    isLoadingHistory,

    // Capabilities
    canAutoBroadcast,

    // Actions
    refreshBalance,
    prepareClaim,
    broadcastClaimTx,
    confirmClaim,
    triggerMint,
    loadHistory,
    clearPreparedClaim,
  };
}
