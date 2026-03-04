/**
 * Validation-related errors
 */

import { AppError } from "./base";

/**
 * Input validation error
 */
export class ValidationError extends AppError {
  readonly code: string = "VALIDATION_ERROR";
  readonly statusCode = 400;
  readonly field?: string;
  readonly errors: Array<{ field?: string; message: string }>;

  constructor(
    message: string,
    options?: {
      field?: string;
      errors?: Array<{ field?: string; message: string }>;
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(message, {
      isRetryable: false, // Validation errors require user action
      ...options,
    });
    this.field = options?.field;
    this.errors = options?.errors ?? [{ field: options?.field, message }];
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      errors: this.errors,
    };
  }
}

/**
 * Invalid format error
 */
export class FormatError extends ValidationError {
  override readonly code = "FORMAT_ERROR";

  constructor(
    fieldName: string,
    expectedFormat: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(`Invalid ${fieldName} format. Expected: ${expectedFormat}`, {
      field: fieldName,
      ...options,
    });
  }
}

/**
 * Missing required field error
 */
export class RequiredFieldError extends ValidationError {
  override readonly code = "REQUIRED_FIELD_ERROR";

  constructor(
    fieldName: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    super(`${fieldName} is required`, {
      field: fieldName,
      ...options,
    });
  }
}

/**
 * Value out of range error
 */
export class RangeError extends ValidationError {
  override readonly code = "RANGE_ERROR";

  constructor(
    fieldName: string,
    min?: number,
    max?: number,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
    },
  ) {
    const range =
      min !== undefined && max !== undefined
        ? `between ${min} and ${max}`
        : min !== undefined
          ? `at least ${min}`
          : `at most ${max}`;

    super(`${fieldName} must be ${range}`, {
      field: fieldName,
      metadata: { min, max, ...options?.metadata },
      ...options,
    });
  }
}
