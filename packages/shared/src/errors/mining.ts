/**
 * Mining-related errors
 */

import { AppError } from "./base";

/**
 * General mining error
 */
export class MiningError extends AppError {
  readonly code = "MINING_ERROR";
  readonly statusCode = 500;
}

/**
 * Invalid mining proof
 */
export class InvalidProofError extends AppError {
  readonly code = "INVALID_PROOF";
  readonly statusCode = 400;

  constructor(
    reason: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(`Invalid mining proof: ${reason}`, {
      isRetryable: false,
      ...options,
    });
  }
}

/**
 * Duplicate proof submission
 */
export class DuplicateProofError extends AppError {
  readonly code = "DUPLICATE_PROOF";
  readonly statusCode = 409;

  constructor(
    hash: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super("This proof has already been submitted", {
      isRetryable: false,
      metadata: { hash, ...options?.metadata },
      ...options,
    });
  }
}

/**
 * Mining rate limit exceeded
 */
export class MiningRateLimitError extends AppError {
  readonly code = "MINING_RATE_LIMIT";
  readonly statusCode = 429;

  constructor(options?: {
    retryAfter?: number;
    cause?: Error;
    metadata?: Record<string, unknown>;
  }) {
    super("Mining rate limit exceeded", {
      isRetryable: true,
      retryAfter: options?.retryAfter ?? 3600000, // Default 1 hour
      ...options,
    });
  }
}

/**
 * Mining backend not available
 */
export class MiningBackendError extends AppError {
  readonly code = "MINING_BACKEND_ERROR";
  readonly statusCode = 503;

  constructor(
    backend: string,
    reason: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(`Mining backend '${backend}' not available: ${reason}`, {
      isRetryable: true,
      metadata: { backend, ...options?.metadata },
      ...options,
    });
  }
}

/**
 * WebGPU not supported
 */
export class WebGPUNotSupportedError extends AppError {
  readonly code = "WEBGPU_NOT_SUPPORTED";
  readonly statusCode = 501;

  constructor(options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super("WebGPU is not supported in this browser", {
      isRetryable: false,
      ...options,
    });
  }
}
