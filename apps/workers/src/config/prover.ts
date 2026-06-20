/**
 * Prover Configuration
 *
 * Centralized configuration for the Charms prover integration.
 */

// =============================================================================
// PROVER ENDPOINTS
// =============================================================================

/**
 * Default Charms prover URL (v11)
 */
export const DEFAULT_PROVER_URL = "https://v15.charms.dev";

/**
 * Prover API endpoints
 */
export const PROVER_ENDPOINTS = {
  PROVE: "/spells/prove",
  STATUS: "/spells/status",
} as const;

// =============================================================================
// TIMEOUTS AND RETRIES
// =============================================================================

/**
 * Request timeout for prover (2 minutes for proof generation)
 */
export const PROVER_TIMEOUT_MS = 120_000;

/**
 * Maximum retries for prover submission
 */
export const MAX_PROVER_RETRIES = 3;

/**
 * Base delay for retry (exponential backoff)
 * Actual delays: 5s, 10s, 20s
 */
export const RETRY_DELAY_BASE_MS = 5000;

/**
 * Backoff multiplier
 */
export const RETRY_BACKOFF_MULTIPLIER = 2;

// =============================================================================
// PROVER REQUEST DEFAULTS
// =============================================================================

/**
 * Default fee rate for prover transactions (sat/vB)
 */
export const DEFAULT_PROVER_FEE_RATE = 2.0;

/**
 * Default funding UTXO value in satoshis
 */
export const DEFAULT_FUNDING_UTXO_VALUE = 10000;

// =============================================================================
// ERROR CLASSIFICATION
// =============================================================================

/**
 * Prover error types for retry logic
 */
export const PROVER_ERROR_TYPES = {
  /** Server errors (5xx) - retry */
  SERVER_ERROR: "server_error",
  /** Timeout - retry */
  TIMEOUT: "timeout",
  /** Validation errors (4xx) - no retry */
  VALIDATION_ERROR: "validation_error",
  /** Network errors - retry */
  NETWORK_ERROR: "network_error",
  /** Unknown - retry with caution */
  UNKNOWN: "unknown",
} as const;

export type ProverErrorType =
  (typeof PROVER_ERROR_TYPES)[keyof typeof PROVER_ERROR_TYPES];

/**
 * Classify prover error for retry decision
 */
export function classifyProverError(error: unknown): ProverErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes("timeout") || message.includes("abort")) {
      return PROVER_ERROR_TYPES.TIMEOUT;
    }

    if (message.includes("fetch") || message.includes("network")) {
      return PROVER_ERROR_TYPES.NETWORK_ERROR;
    }

    // Check for HTTP status codes in message
    if (/\b5\d{2}\b/.test(message)) {
      return PROVER_ERROR_TYPES.SERVER_ERROR;
    }

    if (/\b4\d{2}\b/.test(message)) {
      return PROVER_ERROR_TYPES.VALIDATION_ERROR;
    }
  }

  return PROVER_ERROR_TYPES.UNKNOWN;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(errorType: ProverErrorType): boolean {
  return (
    errorType === PROVER_ERROR_TYPES.SERVER_ERROR ||
    errorType === PROVER_ERROR_TYPES.TIMEOUT ||
    errorType === PROVER_ERROR_TYPES.NETWORK_ERROR
  );
}

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(attempt: number): number {
  return RETRY_DELAY_BASE_MS * Math.pow(RETRY_BACKOFF_MULTIPLIER, attempt - 1);
}
