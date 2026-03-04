"use client";

/**
 * useMiningSubmitter Hook
 *
 * Connects mining proof-of-work results to Bitcoin blockchain via Charms protocol.
 * Handles the complete flow: PoW proof -> Spell -> Bitcoin TX -> Broadcast
 *
 * Features:
 * - Real transaction building and signing
 * - Network-aware (testnet4/mainnet)
 * - Balance checking before submission
 * - Fee estimation
 * - Transaction tracking
 */

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MiningSubmitter,
  createMiningSubmitter,
  type MiningSubmission,
  type SubmissionResult,
  type MiningProof,
} from "@bitcoinbaby/bitcoin";
import {
  useNetworkStore,
  calculateShareReward,
  type NetworkConfig,
} from "@bitcoinbaby/core";
import { useWalletConnection } from "./useWalletConnection";

/**
 * Mining submitter state
 */
interface MiningSubmitterState {
  /** Whether submitter is ready */
  isReady: boolean;
  /** Whether miner has sufficient balance */
  canMine: boolean;
  /** Miner's Bitcoin balance (sats) */
  balance: number;
  /** Number of available UTXOs */
  utxoCount: number;
  /** Largest UTXO value (sats) */
  largestUtxo: number;
  /** Pending submissions */
  pendingSubmissions: MiningSubmission[];
  /** Total pending rewards */
  pendingRewards: bigint;
  /** Total confirmed rewards */
  confirmedRewards: bigint;
  /** Fee estimates */
  feeEstimates: {
    fast: number;
    medium: number;
    slow: number;
    charmsFee: number;
  } | null;
  /** Loading state */
  isLoading: boolean;
  /** Submitting state */
  isSubmitting: boolean;
  /** Error message */
  error: string | null;
}

/**
 * Mining submitter actions
 */
interface MiningSubmitterActions {
  /** Submit a mining proof */
  submitProof: (proof: MiningProof) => Promise<SubmissionResult>;
  /** Sign and broadcast a pending PSBT */
  signAndBroadcast: (
    psbtBase64: string,
  ) => Promise<{ success: boolean; txid?: string; error?: string }>;
  /** Calculate reward for difficulty */
  calculateReward: (difficulty: number) => bigint;
  /** Check confirmation status of a transaction */
  checkConfirmation: (
    txid: string,
  ) => Promise<{ confirmed: boolean; confirmations: number }>;
  /** Refresh balance and fees */
  refresh: () => Promise<void>;
  /** Clear old submissions */
  cleanup: () => void;
}

type UseMiningSubmitterReturn = MiningSubmitterState & MiningSubmitterActions;

/**
 * Options for useMiningSubmitter
 */
interface UseMiningSubmitterOptions {
  /** Token ticker for Charms (default: 'BABY') */
  tokenTicker?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

/**
 * Map network config to Scrolls network type
 */
function getScrollsNetwork(config: NetworkConfig): "main" | "testnet4" {
  return config.scrolls;
}

/**
 * useMiningSubmitter Hook
 *
 * @example
 * ```tsx
 * const {
 *   canMine,
 *   balance,
 *   submitProof,
 *   calculateReward,
 * } = useMiningSubmitter();
 *
 * // Check if mining is possible
 * if (!canMine) {
 *   console.log('Need more sats to mine');
 * }
 *
 * // Submit a proof
 * const result = await submitProof({
 *   hash: '0000abc...',
 *   nonce: 12345,
 *   difficulty: 18,
 *   blockData: '...',
 *   timestamp: Date.now(),
 * });
 *
 * // Calculate expected reward
 * const reward = calculateReward(18);
 * ```
 */
export function useMiningSubmitter(
  options: UseMiningSubmitterOptions = {},
): UseMiningSubmitterReturn {
  const { tokenTicker = "BABY", refreshInterval = 30000 } = options;

  // Dependencies
  const { config } = useNetworkStore();
  const { address, publicKey, isLocked, withPrivateKey } =
    useWalletConnection();

  // Submitter instance
  const submitterRef = useRef<MiningSubmitter | null>(null);

  // State
  const [state, setState] = useState<MiningSubmitterState>({
    isReady: false,
    canMine: false,
    balance: 0,
    utxoCount: 0,
    largestUtxo: 0,
    pendingSubmissions: [],
    pendingRewards: BigInt(0),
    confirmedRewards: BigInt(0),
    feeEstimates: null,
    isLoading: true,
    isSubmitting: false,
    error: null,
  });

  /**
   * Initialize submitter when wallet/network changes
   */
  useEffect(() => {
    if (!address || !publicKey) {
      setState((prev) => ({
        ...prev,
        isReady: false,
        isLoading: false,
      }));
      return;
    }

    // Create submitter instance
    // SECURITY: Private key is no longer stored in submitter
    const submitter = createMiningSubmitter({
      network: getScrollsNetwork(config),
      tokenTicker,
      minerAddress: address,
      minerPublicKey: publicKey, // Required for Taproot PSBT construction
    });

    submitterRef.current = submitter;

    setState((prev) => ({
      ...prev,
      isReady: true,
      isLoading: false,
    }));

    // Clean up old submitter
    return () => {
      submitterRef.current = null;
    };
  }, [address, publicKey, config, tokenTicker]);

  // SECURITY: Private key is now obtained fresh for each signing operation
  // and zeroed immediately after use in finally blocks

  /**
   * Refresh balance and fee estimates
   */
  const refresh = useCallback(async (): Promise<void> => {
    if (!submitterRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [balanceCheck, feeEstimates] = await Promise.all([
        submitterRef.current.checkMinerBalance(),
        submitterRef.current.getFeeEstimates(),
      ]);

      const pendingSubmissions = submitterRef.current.getPendingSubmissions();
      const pendingRewards = submitterRef.current.getTotalPendingRewards();
      const confirmedRewards = submitterRef.current.getTotalConfirmedRewards();

      setState((prev) => ({
        ...prev,
        canMine: balanceCheck.canMine,
        balance: balanceCheck.balance,
        utxoCount: balanceCheck.utxoCount,
        largestUtxo: balanceCheck.largestUtxo,
        feeEstimates,
        pendingSubmissions,
        pendingRewards,
        confirmedRewards,
        isLoading: false,
        error: balanceCheck.error ?? null,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to refresh",
      }));
    }
  }, []);

  /**
   * Auto-refresh balance
   */
  useEffect(() => {
    if (!submitterRef.current || refreshInterval === 0) return;

    // Initial refresh
    refresh();

    // Set up interval
    const intervalId = setInterval(refresh, refreshInterval);
    return () => clearInterval(intervalId);
  }, [refresh, refreshInterval]);

  /**
   * Submit a mining proof
   *
   * When wallet is unlocked, this will:
   * 1. Build the PSBT
   * 2. Automatically sign with wallet's private key (obtained fresh, zeroed after use)
   * 3. Broadcast to the network
   *
   * SECURITY: Private key is obtained fresh for each signing operation
   * and zeroed immediately in a finally block.
   */
  const submitProof = useCallback(
    async (proof: MiningProof): Promise<SubmissionResult> => {
      if (!submitterRef.current) {
        throw new Error("Submitter not initialized");
      }

      if (!state.canMine) {
        throw new Error("Insufficient balance for mining");
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        const result = await submitterRef.current.submitProof(proof);

        // If we got a PSBT back, sign and broadcast it now
        // SECURITY: Uses withPrivateKey which automatically zeros key after use
        if (result.success && result.psbt && !result.txid && !isLocked) {
          const broadcastResult = await withPrivateKey(async (privateKey) => {
            return submitterRef.current!.signAndBroadcast(
              result.psbt!,
              privateKey,
            );
          });

          if (broadcastResult?.success && broadcastResult.txid) {
            // Update the submission with txid
            if (result.submission) {
              result.submission.txid = broadcastResult.txid;
              result.submission.status = "confirmed";
              result.submission.confirmedAt = Date.now();
            }

            // Refresh to get updated state
            await refresh();

            // Return updated result
            setState((prev) => ({
              ...prev,
              pendingSubmissions:
                submitterRef.current?.getPendingSubmissions() ?? [],
              pendingRewards:
                submitterRef.current?.getTotalPendingRewards() ?? BigInt(0),
              confirmedRewards:
                submitterRef.current?.getTotalConfirmedRewards() ?? BigInt(0),
              isSubmitting: false,
              error: null,
            }));

            return {
              ...result,
              txid: broadcastResult.txid,
            };
          } else if (broadcastResult) {
            // Broadcast failed
            console.error(
              "[MiningSubmitter] Broadcast failed:",
              broadcastResult.error,
            );
            setState((prev) => ({
              ...prev,
              isSubmitting: false,
              error: broadcastResult.error ?? "Broadcast failed",
            }));
            return {
              ...result,
              success: false,
              error: broadcastResult.error,
            };
          }
        }

        // Update state with new submission
        setState((prev) => ({
          ...prev,
          pendingSubmissions:
            submitterRef.current?.getPendingSubmissions() ?? [],
          pendingRewards:
            submitterRef.current?.getTotalPendingRewards() ?? BigInt(0),
          confirmedRewards:
            submitterRef.current?.getTotalConfirmedRewards() ?? BigInt(0),
          isSubmitting: false,
          error: result.error ?? null,
        }));

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Submission failed";
        setState((prev) => ({
          ...prev,
          isSubmitting: false,
          error: errorMessage,
        }));
        throw error;
      }
    },
    [state.canMine, isLocked, withPrivateKey, refresh],
  );

  /**
   * Sign and broadcast a pending PSBT
   * SECURITY: Uses withPrivateKey which automatically zeros key after use
   */
  const signAndBroadcast = useCallback(
    async (
      psbtBase64: string,
    ): Promise<{ success: boolean; txid?: string; error?: string }> => {
      if (!submitterRef.current) {
        return { success: false, error: "Submitter not initialized" };
      }

      if (isLocked) {
        return { success: false, error: "Wallet is locked" };
      }

      const result = await withPrivateKey(async (privateKey) => {
        return submitterRef.current!.signAndBroadcast(psbtBase64, privateKey);
      });

      if (!result) {
        return { success: false, error: "Could not get private key" };
      }

      // Refresh after broadcast
      if (result.success) {
        await refresh();
      }

      return result;
    },
    [isLocked, withPrivateKey, refresh],
  );

  /**
   * Calculate reward for difficulty
   * Uses the shared logarithmic formula from tokenomics constants
   */
  const calculateReward = useCallback((difficulty: number): bigint => {
    if (!submitterRef.current) {
      // Use shared reward calculation (logarithmic formula)
      return calculateShareReward(difficulty);
    }

    return submitterRef.current.calculateReward(difficulty);
  }, []);

  /**
   * Check transaction confirmation status
   */
  const checkConfirmation = useCallback(
    async (
      txid: string,
    ): Promise<{ confirmed: boolean; confirmations: number }> => {
      if (!submitterRef.current) {
        return { confirmed: false, confirmations: 0 };
      }

      const result = await submitterRef.current.checkConfirmation(txid);
      return {
        confirmed: result.confirmed,
        confirmations: result.confirmations,
      };
    },
    [],
  );

  /**
   * Clean up old submissions
   */
  const cleanup = useCallback((): void => {
    if (!submitterRef.current) return;

    submitterRef.current.cleanup();

    setState((prev) => ({
      ...prev,
      pendingSubmissions: submitterRef.current?.getPendingSubmissions() ?? [],
      pendingRewards:
        submitterRef.current?.getTotalPendingRewards() ?? BigInt(0),
    }));
  }, []);

  return {
    ...state,
    submitProof,
    signAndBroadcast,
    calculateReward,
    checkConfirmation,
    refresh,
    cleanup,
  };
}

export type {
  MiningSubmitterState,
  MiningSubmitterActions,
  UseMiningSubmitterReturn,
  UseMiningSubmitterOptions,
};
