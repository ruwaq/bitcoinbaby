/**
 * useMiningSubmission Hook
 *
 * Connects mining PoW results with actual token minting on Bitcoin.
 * This is the bridge between mining work and blockchain transactions.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  createMiningSubmitter,
  type MiningSubmitterOptions,
  type MiningSubmission,
  type SubmissionResult,
  type MiningProof,
} from "@bitcoinbaby/bitcoin";
import { useMiningStore } from "../stores/mining-store";
import { useDeadLetterStore } from "../stores/dead-letter-store";
import type { MiningResult } from "../mining/types";

// =============================================================================
// TYPES
// =============================================================================

export interface UseMiningSubmissionOptions {
  /** Bitcoin network to use */
  network?: "testnet4" | "main";
  /** Miner's Bitcoin address */
  minerAddress: string;
  /** Miner's public key (hex) for Taproot signing */
  minerPublicKey: string;
  /** Token ticker (default: BABY) */
  tokenTicker?: string;
  /** Auto-submit when work is found (requires signTransaction callback) */
  autoSubmit?: boolean;
  /** Callback to sign transaction (receives PSBT, returns signed hex) */
  signTransaction?: (psbtBase64: string) => Promise<string | null>;
  /** Called when submission is successful */
  onSubmissionSuccess?: (txid: string, submission: MiningSubmission) => void;
  /** Called when submission fails */
  onSubmissionError?: (error: string, submission: MiningSubmission) => void;
}

export interface UseMiningSubmissionReturn {
  /** Pending submissions waiting for confirmation */
  pendingSubmissions: MiningSubmission[];
  /** Total pending rewards (bigint as string) */
  totalPendingRewards: string;
  /** Whether a submission is in progress */
  isSubmitting: boolean;
  /** Last submission error */
  error: string | null;
  /** Submit a mining result for token minting */
  submit: (result: MiningResult) => Promise<SubmissionResult>;
  /** Sign and broadcast a pending PSBT */
  signAndBroadcast: (
    psbtBase64: string,
    privateKey: Uint8Array,
  ) => Promise<{ success: boolean; txid?: string; error?: string }>;
  /** Check miner's balance and readiness */
  checkReadiness: () => Promise<{
    canMine: boolean;
    balance: number;
    error?: string;
  }>;
  /** Get fee estimates */
  getFeeEstimates: () => Promise<{
    fast: number;
    medium: number;
    slow: number;
    charmsFee: number;
  }>;
  /** Clear all pending submissions */
  clearPending: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

export function useMiningSubmission(
  options: UseMiningSubmissionOptions,
): UseMiningSubmissionReturn {
  const {
    network = "testnet4",
    minerAddress,
    minerPublicKey,
    tokenTicker = "BABY",
    autoSubmit = false,
    signTransaction,
    onSubmissionSuccess,
    onSubmissionError,
  } = options;

  // State
  const [pendingSubmissions, setPendingSubmissions] = useState<
    MiningSubmission[]
  >([]);
  const [totalPendingRewards, setTotalPendingRewards] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zustand stores
  const { addTokens } = useMiningStore();
  const { addFailedProof, isInitialized: dlqInitialized } =
    useDeadLetterStore();

  // Submitter ref (persist across renders)
  const submitterRef = useRef<ReturnType<typeof createMiningSubmitter> | null>(
    null,
  );

  // Initialize submitter
  useEffect(() => {
    if (!minerAddress || !minerPublicKey) return;

    submitterRef.current = createMiningSubmitter({
      network,
      minerAddress,
      minerPublicKey,
      tokenTicker,
    });

    return () => {
      submitterRef.current = null;
    };
  }, [network, minerAddress, minerPublicKey, tokenTicker]);

  // Submit mining result
  const submit = useCallback(
    async (result: MiningResult): Promise<SubmissionResult> => {
      if (!submitterRef.current) {
        return {
          success: false,
          submission: {} as MiningSubmission,
          error: "Submitter not initialized",
        };
      }

      setIsSubmitting(true);
      setError(null);

      try {
        // Convert MiningResult to MiningProof
        const proof: MiningProof = {
          hash: result.hash,
          nonce: result.nonce,
          difficulty: result.difficulty,
          timestamp: result.timestamp,
          blockData: result.blockData || "",
        };

        const submissionResult = await submitterRef.current.submitProof(proof);

        if (submissionResult.success) {
          // Update pending list
          setPendingSubmissions((prev) => [
            ...prev,
            submissionResult.submission,
          ]);

          // Update total rewards
          const total = submitterRef.current.getTotalPendingRewards();
          setTotalPendingRewards(total.toString());

          // Auto-submit if configured and have signing capability
          if (autoSubmit && signTransaction && submissionResult.psbt) {
            try {
              const signedPsbt = await signTransaction(submissionResult.psbt);
              if (signedPsbt) {
                // Note: This flow is for external wallet signing
                // For internal wallet, use signAndBroadcast directly
                console.log(
                  "[useMiningSubmission] Auto-submission signed, ready for broadcast",
                );
              }
            } catch (signError) {
              console.error(
                "[useMiningSubmission] Auto-sign failed:",
                signError,
              );
            }
          }
        } else {
          const errorMsg = submissionResult.error || "Submission failed";
          setError(errorMsg);
          onSubmissionError?.(errorMsg, submissionResult.submission);

          // Add to dead letter queue for retry
          if (dlqInitialized) {
            addFailedProof(
              result,
              errorMsg,
              "SUBMISSION_FAILED",
              submissionResult.submission?.reward
                ? Number(submissionResult.submission.reward)
                : undefined,
            );
          }
        }

        return submissionResult;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);

        // Add to dead letter queue for retry
        if (dlqInitialized) {
          addFailedProof(result, message, "EXCEPTION");
        }

        return {
          success: false,
          submission: {} as MiningSubmission,
          error: message,
        };
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      autoSubmit,
      signTransaction,
      onSubmissionError,
      dlqInitialized,
      addFailedProof,
    ],
  );

  // Sign and broadcast
  const signAndBroadcast = useCallback(
    async (
      psbtBase64: string,
      privateKey: Uint8Array,
    ): Promise<{ success: boolean; txid?: string; error?: string }> => {
      if (!submitterRef.current) {
        return { success: false, error: "Submitter not initialized" };
      }

      setIsSubmitting(true);

      try {
        const result = await submitterRef.current.signAndBroadcast(
          psbtBase64,
          privateKey,
        );

        if (result.success && result.txid) {
          // Update pending submissions status
          setPendingSubmissions((prev) =>
            prev.map((s) =>
              s.status === "submitted" ? { ...s, txid: result.txid } : s,
            ),
          );

          // Notify success
          const submission = pendingSubmissions.find(
            (s) => s.status === "submitted",
          );
          if (submission) {
            onSubmissionSuccess?.(result.txid, submission);

            // Add tokens to store (converted from bigint)
            if (submission.reward) {
              addTokens(Number(submission.reward));
            }
          }
        } else {
          setError(result.error || "Broadcast failed");
        }

        return result;
      } finally {
        setIsSubmitting(false);
      }
    },
    [pendingSubmissions, onSubmissionSuccess, addTokens],
  );

  // Check readiness
  const checkReadiness = useCallback(async () => {
    if (!submitterRef.current) {
      return { canMine: false, balance: 0, error: "Submitter not initialized" };
    }

    const result = await submitterRef.current.checkMinerBalance();
    return {
      canMine: result.canMine,
      balance: result.balance,
      error: result.error,
    };
  }, []);

  // Get fee estimates
  const getFeeEstimates = useCallback(async () => {
    if (!submitterRef.current) {
      return { fast: 0, medium: 0, slow: 0, charmsFee: 0 };
    }

    return submitterRef.current.getFeeEstimates();
  }, []);

  // Clear pending
  const clearPending = useCallback(() => {
    submitterRef.current?.cleanup(0); // Clear all
    setPendingSubmissions([]);
    setTotalPendingRewards("0");
    setError(null);
  }, []);

  return {
    pendingSubmissions,
    totalPendingRewards,
    isSubmitting,
    error,
    submit,
    signAndBroadcast,
    checkReadiness,
    getFeeEstimates,
    clearPending,
  };
}

export default useMiningSubmission;
