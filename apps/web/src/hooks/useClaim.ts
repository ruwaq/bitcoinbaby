"use client";

/**
 * useClaim Hook - Server-Assisted Claim Flow
 *
 * Simplified claim flow where:
 * 1. Server fetches user's UTXOs and checks funding status
 * 2. Server builds the PSBT
 * 3. User only signs
 * 4. Server broadcasts and handles minting
 *
 * User never sees: UTXOs, OP_RETURN, transaction building, fee calculation
 * User only sees: tokens to claim, fee amount, sign button
 */

import { useState, useCallback, useEffect } from "react";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("Claim");

const WORKERS_API_URL =
  process.env.NEXT_PUBLIC_WORKERS_API_URL ||
  "https://bitcoinbaby-api.andeanlabs-58f.workers.dev";

// =============================================================================
// TYPES
// =============================================================================

export type ClaimStatus =
  | "idle"
  | "loading"
  | "ready"
  | "signing"
  | "completing"
  | "success"
  | "error";

/** User-friendly balance info */
export interface ClaimBalance {
  claimableTokens: string;
  unclaimedWork: string;
  unclaimedProofs: number;
  platformFeePercent: number;
  platformFeeTokens: string;
  netTokens: string;
  userFunds: {
    totalBalance: number;
    availableUtxos: number;
    largestUtxo: number;
    estimatedFee: number;
    canClaim: boolean;
    shortfall: number;
  };
  depositInfo: {
    address: string;
    minimumDeposit: number;
    recommendedDeposit: number;
  };
  canProceed: boolean;
  blockingReason?: string;
}

/** Claim execution result */
interface ClaimExecuteResult {
  claimId: string;
  psbtBase64: string;
  summary: {
    tokensReceiving: string;
    networkFee: string;
    platformFee: string;
  };
}

/** Claim completion result */
interface ClaimCompleteResult {
  txid: string;
  status: string;
  estimatedCompletion: number;
}

export interface UseClaimOptions {
  address: string | null;
  signPsbt: ((psbtHex: string) => Promise<string | null>) | null;
}

export interface UseClaimReturn {
  // State
  status: ClaimStatus;
  balance: ClaimBalance | null;
  error: string | null;

  // Claim in progress
  pendingClaim: ClaimExecuteResult | null;
  completedTxid: string | null;

  // User-friendly derived state
  canClaim: boolean;
  needsDeposit: boolean;
  depositAmount: number;

  // Actions
  refreshBalance: () => Promise<void>;
  executeClaim: () => Promise<boolean>;
  reset: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

function hexToBase64(hex: string): string {
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
  return btoa(String.fromCharCode(...bytes));
}

function base64ToHex(base64: string): string {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// HOOK
// =============================================================================

export function useClaim({
  address,
  signPsbt,
}: UseClaimOptions): UseClaimReturn {
  const [status, setStatus] = useState<ClaimStatus>("idle");
  const [balance, setBalance] = useState<ClaimBalance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingClaim, setPendingClaim] = useState<ClaimExecuteResult | null>(
    null,
  );
  const [completedTxid, setCompletedTxid] = useState<string | null>(null);

  const apiUrl = WORKERS_API_URL;

  // Derived state
  const canClaim = Boolean(
    balance?.canProceed && signPsbt && status === "ready",
  );
  const needsDeposit = Boolean(balance && !balance.userFunds.canClaim);
  const depositAmount = balance?.userFunds.shortfall ?? 0;

  // ==========================================================================
  // API CALLS
  // ==========================================================================

  const refreshBalance = useCallback(async () => {
    if (!address) return;

    setStatus("loading");
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/api/claim/balance/${address}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get balance");
      }

      setBalance(result.data);
      setStatus("ready");
    } catch (err) {
      log.error("Balance error:", { error: err });
      setError(err instanceof Error ? err.message : "Failed to get balance");
      setStatus("error");
    }
  }, [address, apiUrl]);

  const executeClaim = useCallback(async (): Promise<boolean> => {
    if (!address || !signPsbt) {
      setError("Wallet not connected");
      return false;
    }

    if (!balance?.canProceed) {
      setError(balance?.blockingReason || "Cannot claim at this time");
      return false;
    }

    setStatus("signing");
    setError(null);

    try {
      // Step 1: Server builds PSBT
      const executeResponse = await fetch(`${apiUrl}/api/claim/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const executeResult = await executeResponse.json();

      if (!executeResult.success) {
        throw new Error(executeResult.error || "Failed to prepare claim");
      }

      const claimData = executeResult.data as ClaimExecuteResult;
      setPendingClaim(claimData);

      // Step 2: User signs PSBT
      const psbtHex = base64ToHex(claimData.psbtBase64);
      const signedHex = await signPsbt(psbtHex);

      if (!signedHex) {
        throw new Error("Transaction signing was cancelled");
      }

      const signedBase64 = hexToBase64(signedHex);

      // Step 3: Server broadcasts and completes
      setStatus("completing");

      const completeResponse = await fetch(`${apiUrl}/api/claim/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          claimId: claimData.claimId,
          signedPsbtBase64: signedBase64,
          address,
        }),
      });

      const completeResult = await completeResponse.json();

      if (!completeResult.success) {
        throw new Error(completeResult.error || "Failed to broadcast");
      }

      const completion = completeResult.data as ClaimCompleteResult;
      setCompletedTxid(completion.txid);
      setStatus("success");

      // Refresh balance after success
      setTimeout(() => refreshBalance(), 2000);

      return true;
    } catch (err) {
      log.error("Claim error:", { error: err });
      setError(err instanceof Error ? err.message : "Claim failed");
      setStatus("error");
      return false;
    }
  }, [address, signPsbt, balance, apiUrl, refreshBalance]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setPendingClaim(null);
    setCompletedTxid(null);
  }, []);

  // ==========================================================================
  // EFFECTS
  // ==========================================================================

  // Load balance on mount
  useEffect(() => {
    if (address) {
      refreshBalance();
    }
  }, [address, refreshBalance]);

  // Reset when address changes
  useEffect(() => {
    if (!address) {
      reset();
      setBalance(null);
    }
  }, [address, reset]);

  return {
    status,
    balance,
    error,
    pendingClaim,
    completedTxid,
    canClaim,
    needsDeposit,
    depositAmount,
    refreshBalance,
    executeClaim,
    reset,
  };
}

export default useClaim;
