/**
 * Prover Client Service
 *
 * Handles communication with the Charms prover API.
 * Includes retry logic, timeout handling, and error classification.
 */

import { claimLogger } from "../lib/logger";
import {
  DEFAULT_PROVER_URL,
  PROVER_ENDPOINTS,
  PROVER_TIMEOUT_MS,
  MAX_PROVER_RETRIES,
  classifyProverError,
  isRetryableError,
  calculateRetryDelay,
  type ProverErrorType,
} from "../config/prover";
import type {
  IProverService,
  ProverRequest,
  ProverResponse,
  ProverStatus,
} from "../interfaces/services";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Raw prover API request format
 */
export interface RawProverRequest {
  spell: string;
  funding_utxo: string;
  funding_utxo_value: number;
  change_address: string;
  chain: string;
  fee_rate: number;
  prev_txs: Array<{ bitcoin: string }>;
  binaries: Record<string, string>;
  app_private_inputs: Record<string, string>;
}

/**
 * Raw prover API response
 */
interface RawProverResponse {
  commitTx: string;
  spellTx: string;
}

/**
 * Prover client configuration
 */
export interface ProverClientConfig {
  proverUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

// =============================================================================
// PROVER CLIENT
// =============================================================================

export class ProverClient implements IProverService {
  private readonly proverUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(config: ProverClientConfig = {}) {
    this.proverUrl = config.proverUrl || DEFAULT_PROVER_URL;
    this.timeoutMs = config.timeoutMs || PROVER_TIMEOUT_MS;
    this.maxRetries = config.maxRetries || MAX_PROVER_RETRIES;
  }

  /**
   * Get the prover endpoint URL
   */
  private getEndpoint(): string {
    // Handle different prover URL formats
    if (this.proverUrl.includes("charms.dev")) {
      return `${this.proverUrl}${PROVER_ENDPOINTS.PROVE}`;
    }
    return `${this.proverUrl}/prove`;
  }

  /**
   * Convert interface request to raw API format
   */
  private toRawRequest(request: ProverRequest): RawProverRequest {
    return {
      spell: request.spell,
      funding_utxo: request.fundingUtxo,
      funding_utxo_value: request.fundingUtxoValue,
      change_address: request.changeAddress,
      chain: request.chain,
      fee_rate: request.feeRate,
      prev_txs: request.prevTxs,
      binaries: request.binaries,
      app_private_inputs: request.appPrivateInputs,
    };
  }

  /**
   * Submit proof request (single attempt)
   */
  async prove(request: ProverRequest): Promise<ProverResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const endpoint = this.getEndpoint();
      const rawRequest = this.toRawRequest(request);

      claimLogger.info("Submitting to prover", {
        endpoint,
        spellLength: request.spell.length,
        hasPrivateInputs: Object.keys(request.appPrivateInputs).length > 0,
        hasBinaries: Object.keys(request.binaries).length > 0,
        hasPrevTxs: request.prevTxs.length > 0,
        changeAddress: request.changeAddress,
        feeRate: request.feeRate,
      });

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby/2.0",
        },
        body: JSON.stringify(rawRequest),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        claimLogger.error("Prover API error response", {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText.substring(0, 500),
        });
        throw new Error(`Prover API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as RawProverResponse;

      if (!data.commitTx || !data.spellTx) {
        throw new Error("Invalid prover response: missing transactions");
      }

      return {
        success: true,
        commitTx: data.commitTx,
        spellTx: data.spellTx,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: `Prover request timeout after ${this.timeoutMs}ms`,
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Submit proof with retry logic
   */
  async proveWithRetry(
    request: ProverRequest,
    maxRetries: number = this.maxRetries,
  ): Promise<ProverResponse> {
    let lastError: string | undefined;
    let lastErrorType: ProverErrorType | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.prove(request);

        if (result.success) {
          return result;
        }

        // Classify the error
        lastError = result.error;
        lastErrorType = classifyProverError(new Error(result.error));

        claimLogger.warn(`Prover attempt ${attempt} failed`, {
          error: lastError,
          errorType: lastErrorType,
          attempt,
          maxRetries,
        });

        // Don't retry non-retryable errors
        if (!isRetryableError(lastErrorType)) {
          break;
        }

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(attempt);
          claimLogger.info(`Waiting ${delay}ms before retry`, { attempt });
          await this.sleep(delay);
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        lastErrorType = classifyProverError(error);

        claimLogger.warn(`Prover attempt ${attempt} threw exception`, {
          error: lastError,
          errorType: lastErrorType,
        });

        if (!isRetryableError(lastErrorType)) {
          break;
        }

        if (attempt < maxRetries) {
          const delay = calculateRetryDelay(attempt);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: `Prover failed after ${maxRetries} attempts: ${lastError}`,
    };
  }

  /**
   * Get prover status
   */
  async getStatus(): Promise<ProverStatus> {
    try {
      // Simple health check - try to reach the prover
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.proverUrl, {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      return {
        available: response.ok || response.status === 404,
      };
    } catch {
      return {
        available: false,
      };
    }
  }

  /**
   * Check if prover is available
   */
  async isAvailable(): Promise<boolean> {
    const status = await this.getStatus();
    return status.available;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let proverClientInstance: ProverClient | null = null;

/**
 * Get or create prover client instance
 */
export function getProverClient(config?: ProverClientConfig): ProverClient {
  if (!proverClientInstance) {
    proverClientInstance = new ProverClient(config);
  }
  return proverClientInstance;
}

/**
 * Create new prover client (for testing or custom config)
 */
export function createProverClient(config: ProverClientConfig): ProverClient {
  return new ProverClient(config);
}
