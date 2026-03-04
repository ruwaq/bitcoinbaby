/**
 * Base Error System
 *
 * Unified error hierarchy for all BitcoinBaby packages.
 * Provides consistent error handling, serialization, and recovery hints.
 */

export interface ErrorContext {
  /** Error code for programmatic handling */
  code: string;
  /** HTTP status code */
  statusCode: number;
  /** Whether the operation can be retried */
  isRetryable: boolean;
  /** Suggested retry delay in ms */
  retryAfter?: number;
  /** Additional context data */
  metadata?: Record<string, unknown>;
}

/**
 * Base application error class
 *
 * All errors in the system should extend this class.
 */
export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  readonly isRetryable: boolean;
  readonly retryAfter?: number;
  readonly timestamp: number;
  readonly metadata: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      isRetryable?: boolean;
      retryAfter?: number;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, { cause: options?.cause });
    this.name = this.constructor.name;
    this.isRetryable = options?.isRetryable ?? false;
    this.retryAfter = options?.retryAfter;
    this.timestamp = Date.now();
    this.metadata = options?.metadata ?? {};

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON-serializable object
   */
  toJSON(): ErrorContext & { message: string; name: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      isRetryable: this.isRetryable,
      retryAfter: this.retryAfter,
      metadata: this.metadata,
    };
  }

  /**
   * Get user-friendly error message
   */
  toUserMessage(): string {
    return this.message;
  }

  /**
   * Check if error is of specific type
   */
  static is<T extends AppError>(
    error: unknown,
    ErrorClass: new (...args: unknown[]) => T,
  ): error is T {
    return error instanceof ErrorClass;
  }
}

/**
 * Wrap any error into an AppError
 */
export function wrapError(
  error: unknown,
  fallbackMessage = "Unknown error",
): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new UnknownError(error.message, { cause: error });
  }

  if (typeof error === "string") {
    return new UnknownError(error);
  }

  return new UnknownError(fallbackMessage, {
    metadata: { originalError: String(error) },
  });
}

/**
 * Unknown/unclassified error
 */
export class UnknownError extends AppError {
  readonly code = "UNKNOWN_ERROR";
  readonly statusCode = 500;
}
