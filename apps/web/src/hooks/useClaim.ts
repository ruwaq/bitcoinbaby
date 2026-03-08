"use client";

/**
 * useClaim Hook
 *
 * Hook for managing the claim flow:
 * 1. Get claimable balance
 * 2. Prepare claim (get signed data)
 * 3. Auto-create and broadcast Bitcoin TX (or manual TXID entry)
 * 4. Confirm claim with txid
 * 5. Trigger minting on server
 */

import { useState, useCallback, useEffect } from "react";
import { createTransactionBuilder, type TxUTXO } from "@bitcoinbaby/bitcoin";

// Workers API URL from environment
const WORKERS_API_URL =
  process.env.NEXT_PUBLIC_WORKERS_API_URL ||
  "https://bitcoinbaby-api.andeanlabs-58f.workers.dev";

// API response types
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
  // Platform fee fields (20% to foundation)
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
  // Platform fee fields (20% to foundation)
  platformFeePercent: number;
  platformFeeTokens: string;
  foundationAddress: string | null;
  netTokens: string;
}

interface ClaimHistoryItem {
  id: string;
  amount: string;
  proofCount: number;
  status: string;
  claimTxid: string | null;
  mintTxid: string | null;
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

  // Claim state
  preparedClaim: ClaimPrepareResponse | null;
  isPreparing: boolean;
  isConfirming: boolean;
  isBroadcasting: boolean;
  isMinting: boolean;
  claimError: string | null;

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
  loadHistory: () => Promise<void>;
  clearPreparedClaim: () => void;
}

export function useClaim({
  address,
  publicKey,
  utxos,
  signAndBroadcast,
}: UseClaimOptions): UseClaimReturn {
  // Balance state
  const [claimableBalance, setClaimableBalance] =
    useState<ClaimableBalance | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Claim state
  const [preparedClaim, setPreparedClaim] =
    useState<ClaimPrepareResponse | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  // History state
  const [claimHistory, setClaimHistory] = useState<ClaimHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const apiUrl = WORKERS_API_URL;

  // Check if we can auto-broadcast (have signing function and UTXOs)
  const canAutoBroadcast = Boolean(
    signAndBroadcast && utxos && utxos.length > 0 && publicKey,
  );

  // Refresh claimable balance
  const refreshBalance = useCallback(async () => {
    if (!address) return;

    setIsLoadingBalance(true);
    setBalanceError(null);

    try {
      const response = await fetch(`${apiUrl}/api/claim/balance/${address}`);
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Failed to get balance");
      }

      setClaimableBalance(result.data);
    } catch (error) {
      console.error("Failed to get claimable balance:", error);
      setBalanceError(
        error instanceof Error ? error.message : "Failed to get balance",
      );
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, apiUrl]);

  // Prepare claim (get signed data)
  const prepareClaim =
    useCallback(async (): Promise<ClaimPrepareResponse | null> => {
      if (!address) return null;

      setIsPreparing(true);
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
        return result.data;
      } catch (error) {
        console.error("Failed to prepare claim:", error);
        setClaimError(
          error instanceof Error ? error.message : "Failed to prepare claim",
        );
        return null;
      } finally {
        setIsPreparing(false);
      }
    }, [address, apiUrl]);

  // Broadcast claim TX automatically using wallet
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

    setIsBroadcasting(true);
    setClaimError(null);

    try {
      // Build the claim transaction with OP_RETURN
      const txBuilder = createTransactionBuilder({
        network: "testnet4",
        feeRate: preparedClaim.claimData.estimatedFee > 0 ? 5 : 5, // Use API fee rate
        enableRBF: true,
      });

      // Build TX with OP_RETURN containing claim data
      const unsignedTx = txBuilder.buildMiningTxWithOpReturn(
        utxos,
        address,
        preparedClaim.claimData.opReturnData,
        700, // Spell output sats
      );

      // Build PSBT
      const psbt = txBuilder.buildPSBT(unsignedTx);
      const psbtHex = psbt.toHex();

      // Sign and broadcast using wallet provider
      const result = await signAndBroadcast(psbtHex);

      if (!result.success || !result.txid) {
        throw new Error("Transaction broadcast failed");
      }

      console.log("Claim TX broadcast:", result.txid);

      // Auto-confirm the claim with the txid
      const claimId = preparedClaim.claimData.proof.nonce;
      try {
        const confirmResponse = await fetch(`${apiUrl}/api/claim/confirm`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, claimTxid: result.txid, address }),
        });

        const confirmResult = await confirmResponse.json();

        if (confirmResult.success) {
          // Clear prepared claim after confirmation
          setPreparedClaim(null);
          // Trigger balance refresh (non-blocking)
          refreshBalance().catch(console.error);
        }
      } catch (confirmError) {
        console.error("Failed to confirm claim:", confirmError);
        // TX was still broadcast, so return txid
      }

      return result.txid;
    } catch (error) {
      console.error("Failed to broadcast claim TX:", error);
      setClaimError(
        error instanceof Error
          ? error.message
          : "Failed to broadcast transaction",
      );
      return null;
    } finally {
      setIsBroadcasting(false);
    }
  }, [
    preparedClaim,
    address,
    signAndBroadcast,
    utxos,
    publicKey,
    apiUrl,
    refreshBalance,
  ]);

  // Trigger minting after TX is confirmed
  const triggerMint = useCallback(
    async (claimId: string, claimTxid: string): Promise<boolean> => {
      if (!address) return false;

      setIsMinting(true);
      setClaimError(null);

      try {
        const response = await fetch(`${apiUrl}/api/claim/mint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ claimId, claimTxid, address }),
        });

        const result = await response.json();

        if (!result.success) {
          // If TX not confirmed yet, that's expected
          if (result.data?.status === "broadcast") {
            console.log("TX in mempool, waiting for confirmation...");
            return true; // Not an error, just waiting
          }
          throw new Error(result.error || "Failed to mint tokens");
        }

        // Refresh balance after successful mint
        await refreshBalance();

        return true;
      } catch (error) {
        console.error("Failed to trigger mint:", error);
        setClaimError(
          error instanceof Error ? error.message : "Failed to mint tokens",
        );
        return false;
      } finally {
        setIsMinting(false);
      }
    },
    [address, apiUrl, refreshBalance],
  );

  // Confirm claim with txid
  const confirmClaim = useCallback(
    async (claimId: string, claimTxid: string): Promise<boolean> => {
      if (!address) return false;

      setIsConfirming(true);
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

        // Clear prepared claim after confirmation
        setPreparedClaim(null);

        // Refresh balance and history
        await Promise.all([refreshBalance(), loadHistory()]);

        return true;
      } catch (error) {
        console.error("Failed to confirm claim:", error);
        setClaimError(
          error instanceof Error ? error.message : "Failed to confirm claim",
        );
        return false;
      } finally {
        setIsConfirming(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadHistory defined below, would cause circular dependency
    [address, apiUrl, refreshBalance],
  );

  // Load claim history
  const loadHistory = useCallback(async () => {
    if (!address) return;

    setIsLoadingHistory(true);

    try {
      const response = await fetch(`${apiUrl}/api/claim/history/${address}`);
      const result = await response.json();

      if (result.success && result.data?.claims) {
        setClaimHistory(result.data.claims);
      }
    } catch (error) {
      console.error("Failed to load claim history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [address, apiUrl]);

  // Clear prepared claim
  const clearPreparedClaim = useCallback(() => {
    setPreparedClaim(null);
    setClaimError(null);
  }, []);

  // Load balance on mount
  useEffect(() => {
    if (address) {
      refreshBalance();
      loadHistory();
    }
  }, [address, refreshBalance, loadHistory]);

  return {
    claimableBalance,
    isLoadingBalance,
    balanceError,
    preparedClaim,
    isPreparing,
    isConfirming,
    isBroadcasting,
    isMinting,
    claimError,
    canAutoBroadcast,
    claimHistory,
    isLoadingHistory,
    refreshBalance,
    prepareClaim,
    broadcastClaimTx,
    confirmClaim,
    triggerMint,
    loadHistory,
    clearPreparedClaim,
  };
}
