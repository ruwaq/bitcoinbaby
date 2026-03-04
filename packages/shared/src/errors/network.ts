/**
 * Network-related errors
 */

import { AppError } from "./base";

/**
 * Network communication error
 */
export class NetworkError extends AppError {
  readonly code = "NETWORK_ERROR";
  readonly statusCode = 503;

  constructor(
    message: string,
    options?: {
      isRetryable?: boolean;
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: options?.isRetryable ?? true, // Network errors are usually retryable
      ...options,
    });
  }
}

/**
 * Request timeout error
 */
export class TimeoutError extends AppError {
  readonly code = "TIMEOUT_ERROR";
  readonly statusCode = 408;

  constructor(
    message = "Request timed out",
    options?: {
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: true,
      ...options,
    });
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitError extends AppError {
  readonly code = "RATE_LIMIT_ERROR";
  readonly statusCode = 429;

  constructor(
    message = "Rate limit exceeded",
    options?: {
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: true,
      retryAfter: options?.retryAfter ?? 60000, // Default 1 minute
      ...options,
    });
  }
}

/**
 * API error from external service
 */
export class ApiError extends AppError {
  readonly code = "API_ERROR";
  readonly statusCode: number;

  constructor(
    message: string,
    statusCode: number,
    options?: {
      isRetryable?: boolean;
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: options?.isRetryable ?? statusCode >= 500,
      ...options,
    });
    this.statusCode = statusCode;
  }
}

/**
 * Connection refused error
 */
export class ConnectionError extends AppError {
  readonly code = "CONNECTION_ERROR";
  readonly statusCode = 503;

  constructor(
    message = "Connection failed",
    options?: {
      isRetryable?: boolean;
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: true,
      ...options,
    });
  }
}
