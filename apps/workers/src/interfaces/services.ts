/**
 * Service Interfaces
 *
 * Abstract interfaces for external service integrations.
 * Allows mocking for testing and swapping implementations.
 */

import type { BitcoinNetwork } from "../config/bitcoin";
import type { UTXO } from "../lib/bitcoin-utils";

// =============================================================================
// MEMPOOL SERVICE
// =============================================================================

/**
 * Transaction verification result
 */
export interface TxVerificationResult {
  exists: boolean;
  confirmed: boolean;
  confirmations: number;
  blockHeight?: number;
  fee?: number;
  size?: number;
  error?: string;
}

/**
 * Fee estimates (sat/vB)
 */
export interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Mempool service interface
 */
export interface IMempoolService {
  /**
   * Get network this service is configured for
   */
  readonly network: BitcoinNetwork;

  /**
   * Verify a transaction exists and its confirmation status
   */
  verifyTransaction(txid: string): Promise<TxVerificationResult>;

  /**
   * Get raw transaction hex
   */
  getTransactionHex(txid: string): Promise<string | null>;

  /**
   * Get UTXOs for an address
   */
  getAddressUtxos(address: string): Promise<UTXO[]>;

  /**
   * Get address balance
   */
  getAddressBalance(address: string): Promise<{
    confirmed: number;
    unconfirmed: number;
  }>;

  /**
   * Get current block height
   */
  getCurrentBlockHeight(): Promise<number>;

  /**
   * Get fee estimates
   */
  getFeeEstimates(): Promise<FeeEstimates>;

  /**
   * Broadcast a raw transaction
   */
  broadcastTransaction(txHex: string): Promise<string>;
}

// =============================================================================
// PROVER SERVICE
// =============================================================================

/**
 * Prover request for claim minting
 */
export interface ProverRequest {
  spell: string;
  fundingUtxo: string;
  fundingUtxoValue: number;
  changeAddress: string;
  chain: string;
  feeRate: number;
  prevTxs: Array<{ bitcoin: string }>;
  binaries: Record<string, string>;
  appPrivateInputs: Record<string, string>;
}

/**
 * Prover response
 */
export interface ProverResponse {
  success: boolean;
  commitTx?: string;
  spellTx?: string;
  error?: string;
}

/**
 * Prover status
 */
export interface ProverStatus {
  available: boolean;
  queueDepth?: number;
  estimatedWaitTime?: number;
}

/**
 * Prover service interface
 */
export interface IProverService {
  /**
   * Submit proof request
   */
  prove(request: ProverRequest): Promise<ProverResponse>;

  /**
   * Submit proof with retry logic
   */
  proveWithRetry(
    request: ProverRequest,
    maxRetries?: number,
  ): Promise<ProverResponse>;

  /**
   * Get prover status
   */
  getStatus(): Promise<ProverStatus>;

  /**
   * Check if prover is available
   */
  isAvailable(): Promise<boolean>;
}

// =============================================================================
// PSBT BUILDER SERVICE
// =============================================================================

/**
 * PSBT build request
 */
export interface PsbtBuildRequest {
  address: string;
  opReturnData: string;
  feeRate?: number;
}

/**
 * PSBT build result
 */
export interface PsbtBuildResult {
  success: boolean;
  psbtBase64?: string;
  psbtHex?: string;
  fee?: number;
  inputUtxo?: UTXO;
  error?: string;
}

/**
 * PSBT builder service interface
 */
export interface IPsbtBuilderService {
  /**
   * Build unsigned PSBT for claim
   */
  buildClaimPsbt(request: PsbtBuildRequest): Promise<PsbtBuildResult>;

  /**
   * Finalize and extract raw transaction from signed PSBT
   */
  finalizePsbt(signedPsbtBase64: string): Promise<{
    success: boolean;
    txHex?: string;
    txid?: string;
    error?: string;
  }>;
}

// =============================================================================
// NOTIFICATION SERVICE
// =============================================================================

/**
 * Notification types
 */
export type NotificationType =
  | "claim_prepared"
  | "claim_broadcast"
  | "claim_confirmed"
  | "claim_minting"
  | "claim_completed"
  | "claim_failed";

/**
 * Notification payload
 */
export interface NotificationPayload {
  type: NotificationType;
  address: string;
  claimId: string;
  data?: Record<string, unknown>;
}

/**
 * Notification service interface
 */
export interface INotificationService {
  /**
   * Send notification to user
   */
  notify(payload: NotificationPayload): Promise<void>;

  /**
   * Send webhook notification
   */
  sendWebhook(url: string, payload: NotificationPayload): Promise<boolean>;
}
