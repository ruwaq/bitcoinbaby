/**
 * useWorkProof Hook
 *
 * Submits work proofs (mining shares) to gain XP for equipped NFTs.
 *
 * When a user mines a valid share, their equipped NFT gains XP based on:
 * - Base XP (100)
 * - Bloodline multiplier (Royal: 1.5x, Warrior: 1.2x, Mystic: 1.3x, Rogue: 1.0x)
 * - Difficulty bonus (higher difficulty = more XP)
 */

"use client";

import { useCallback, useState } from "react";
import { getApiClient, type WorkProofResult } from "@bitcoinbaby/core";

// =============================================================================
// TYPES
// =============================================================================

export interface WorkProofParams {
  /** Token ID of the equipped NFT */
  tokenId: number;
  /** Owner's Bitcoin address */
  ownerAddress: string;
  /** Mining share hash (proof of work) */
  shareHash: string;
  /** Difficulty of the share */
  difficulty: number;
  /** Timestamp when share was found */
  timestamp: number;
}

export interface UseWorkProofReturn {
  /** Submit a work proof to gain XP */
  submitWorkProof: (params: WorkProofParams) => Promise<WorkProofResult | null>;
  /** Is currently submitting */
  isSubmitting: boolean;
  /** Last result from submission */
  lastResult: WorkProofResult | null;
  /** Error message if submission failed */
  error: string | null;
  /** Clear the error */
  clearError: () => void;
}

// =============================================================================
// HOOK
// =============================================================================

export function useWorkProof(): UseWorkProofReturn {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<WorkProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit a work proof to gain XP
   */
  const submitWorkProof = useCallback(
    async (params: WorkProofParams): Promise<WorkProofResult | null> => {
      setIsSubmitting(true);
      setError(null);

      try {
        const apiClient = getApiClient();
        const response = await apiClient.submitWorkProof(params.tokenId, {
          ownerAddress: params.ownerAddress,
          shareHash: params.shareHash,
          difficulty: params.difficulty,
          timestamp: params.timestamp,
        });

        if (!response.success || !response.data) {
          throw new Error(response.error || "Failed to submit work proof");
        }

        setLastResult(response.data);
        return response.data;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to submit work proof";
        setError(message);
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  /**
   * Clear the error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    submitWorkProof,
    isSubmitting,
    lastResult,
    error,
    clearError,
  };
}

export default useWorkProof;
