/**
 * Error Handling Utilities
 *
 * Centralized error types and response builders for consistent
 * error handling across the API.
 */

import type { Context } from "hono";

// =============================================================================
// ERROR CODES
// =============================================================================

/**
 * Application error codes
 */
export const ErrorCode = {
  // General
  INTERNAL_ERROR: "INTERNAL_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",

  // Validation
  INVALID_ADDRESS: "INVALID_ADDRESS",
  INVALID_TXID: "INVALID_TXID",
  INVALID_PROOF: "INVALID_PROOF",
  INVALID_AMOUNT: "INVALID_AMOUNT",

  // Claim specific
  CLAIM_NOT_FOUND: "CLAIM_NOT_FOUND",
  CLAIM_EXPIRED: "CLAIM_EXPIRED",
  CLAIM_ALREADY_COMPLETED: "CLAIM_ALREADY_COMPLETED",
  CLAIM_ALREADY_MINTING: "CLAIM_ALREADY_MINTING",
  CLAIM_MISSING_SIGNATURE: "CLAIM_MISSING_SIGNATURE",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INSUFFICIENT_UTXOS: "INSUFFICIENT_UTXOS",
  MIN_CLAIM_NOT_MET: "MIN_CLAIM_NOT_MET",

  // Transaction
  TX_NOT_FOUND: "TX_NOT_FOUND",
  TX_NOT_CONFIRMED: "TX_NOT_CONFIRMED",
  TX_BROADCAST_FAILED: "TX_BROADCAST_FAILED",

  // Prover
  PROVER_ERROR: "PROVER_ERROR",
  PROVER_TIMEOUT: "PROVER_TIMEOUT",
  PROVER_UNAVAILABLE: "PROVER_UNAVAILABLE",

  // Mining
  PROOF_ALREADY_USED: "PROOF_ALREADY_USED",
  PROOF_RATE_LIMITED: "PROOF_RATE_LIMITED",
  PROOF_INVALID_DIFFICULTY: "PROOF_INVALID_DIFFICULTY",

  // Durable Object
  DO_ERROR: "DO_ERROR",
  DO_UNAVAILABLE: "DO_UNAVAILABLE",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// =============================================================================
// HTTP STATUS MAPPING
// =============================================================================

/**
 * Map error codes to HTTP status codes
 */
export const ErrorStatusMap: Record<ErrorCodeType, number> = {
  // 400 Bad Request
  [ErrorCode.INVALID_REQUEST]: 400,
  [ErrorCode.INVALID_ADDRESS]: 400,
  [ErrorCode.INVALID_TXID]: 400,
  [ErrorCode.INVALID_PROOF]: 400,
  [ErrorCode.INVALID_AMOUNT]: 400,
  [ErrorCode.MIN_CLAIM_NOT_MET]: 400,

  // 401 Unauthorized
  [ErrorCode.UNAUTHORIZED]: 401,

  // 403 Forbidden
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.PROOF_ALREADY_USED]: 403,

  // 404 Not Found
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CLAIM_NOT_FOUND]: 404,
  [ErrorCode.TX_NOT_FOUND]: 404,

  // 409 Conflict
  [ErrorCode.CLAIM_EXPIRED]: 409,
  [ErrorCode.CLAIM_ALREADY_COMPLETED]: 409,
  [ErrorCode.CLAIM_ALREADY_MINTING]: 409,

  // 422 Unprocessable Entity
  [ErrorCode.CLAIM_MISSING_SIGNATURE]: 422,
  [ErrorCode.INSUFFICIENT_BALANCE]: 422,
  [ErrorCode.INSUFFICIENT_UTXOS]: 422,
  [ErrorCode.TX_NOT_CONFIRMED]: 422,

  // 429 Too Many Requests
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.PROOF_RATE_LIMITED]: 429,

  // 500 Internal Server Error
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.DO_ERROR]: 500,
  [ErrorCode.PROOF_INVALID_DIFFICULTY]: 500,

  // 502 Bad Gateway
  [ErrorCode.PROVER_ERROR]: 502,

  // 503 Service Unavailable
  [ErrorCode.PROVER_UNAVAILABLE]: 503,
  [ErrorCode.DO_UNAVAILABLE]: 503,

  // 504 Gateway Timeout
  [ErrorCode.PROVER_TIMEOUT]: 504,
  [ErrorCode.TX_BROADCAST_FAILED]: 504,
};

// =============================================================================
// APP ERROR CLASS
// =============================================================================

/**
 * Application error with code and details
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = ErrorStatusMap[code] || 500;
    this.details = details;
  }

  /**
   * Create JSON response object
   */
  toJSON(): {
    error: { code: string; message: string; details?: Record<string, unknown> };
  } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      },
    };
  }
}

// =============================================================================
// ERROR FACTORY FUNCTIONS
// =============================================================================

/**
 * Create an AppError for invalid address
 */
export function invalidAddressError(address?: string): AppError {
  return new AppError(
    ErrorCode.INVALID_ADDRESS,
    "Invalid Bitcoin address format",
    address ? { address } : undefined,
  );
}

/**
 * Create an AppError for claim not found
 */
export function claimNotFoundError(claimId: string): AppError {
  return new AppError(ErrorCode.CLAIM_NOT_FOUND, "Claim not found", {
    claimId,
  });
}

/**
 * Create an AppError for expired claim
 */
export function claimExpiredError(claimId: string): AppError {
  return new AppError(ErrorCode.CLAIM_EXPIRED, "Claim has expired", {
    claimId,
  });
}

/**
 * Create an AppError for insufficient balance
 */
export function insufficientBalanceError(
  required: string,
  available: string,
): AppError {
  return new AppError(
    ErrorCode.INSUFFICIENT_BALANCE,
    "Insufficient balance for claim",
    {
      required,
      available,
    },
  );
}

/**
 * Create an AppError for insufficient UTXOs
 */
export function insufficientUtxosError(
  required: number,
  available: number,
): AppError {
  return new AppError(
    ErrorCode.INSUFFICIENT_UTXOS,
    "Insufficient UTXOs for transaction fee",
    { required, available },
  );
}

/**
 * Create an AppError for prover timeout
 */
export function proverTimeoutError(): AppError {
  return new AppError(
    ErrorCode.PROVER_TIMEOUT,
    "Prover request timed out. Please try again.",
  );
}

/**
 * Create an AppError for prover error
 */
export function proverError(message: string): AppError {
  return new AppError(ErrorCode.PROVER_ERROR, message);
}

// =============================================================================
// RESPONSE BUILDERS
// =============================================================================

/**
 * Create error response for Hono context
 */
export function createErrorResponse<E extends Record<string, unknown>>(
  c: Context<E>,
  error: AppError | string,
  statusCode?: number,
): Response {
  if (error instanceof AppError) {
    return c.json(error.toJSON(), error.statusCode as 400);
  }

  return c.json(
    {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message:
          typeof error === "string" ? error : "An unexpected error occurred",
      },
    },
    (statusCode || 500) as 500,
  );
}

/**
 * Create success response for Hono context
 */
export function createSuccessResponse<E extends Record<string, unknown>, T>(
  c: Context<E>,
  data: T,
  statusCode: number = 200,
): Response {
  return c.json(data, statusCode as 200);
}

// =============================================================================
// ERROR HANDLING UTILITIES
// =============================================================================

/**
 * Wrap async handler with error catching
 */
export function catchErrors<E extends Record<string, unknown>>(
  handler: (c: Context<E>) => Promise<Response>,
): (c: Context<E>) => Promise<Response> {
  return async (c) => {
    try {
      return await handler(c);
    } catch (error) {
      if (error instanceof AppError) {
        return createErrorResponse(c, error);
      }

      console.error("Unexpected error:", error);
      return createErrorResponse(
        c,
        new AppError(
          ErrorCode.INTERNAL_ERROR,
          error instanceof Error
            ? error.message
            : "An unexpected error occurred",
        ),
      );
    }
  };
}

/**
 * Assert condition or throw AppError
 */
export function assertOrThrow(
  condition: boolean,
  code: ErrorCodeType,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw new AppError(code, message, details);
  }
}
