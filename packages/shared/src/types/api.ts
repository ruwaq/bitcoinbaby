/**
 * API Types - Single Source of Truth
 *
 * Common API response types used across packages.
 *
 * @example
 * import { ApiResponse, ApiError, PaginatedResponse } from '@bitcoinbaby/shared';
 */

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Standard API success response
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp?: number;
}

/**
 * Standard API error response (data structure)
 * Note: For error class, use ApiError from @bitcoinbaby/shared/errors
 */
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp?: number;
}

/**
 * Union type for API responses
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Type guard for successful API response
 */
export function isApiSuccess<T>(
  result: ApiResult<T>,
): result is ApiResponse<T> {
  return result.success === true;
}

/**
 * Type guard for API error response
 */
export function isApiError<T>(
  result: ApiResult<T>,
): result is ApiErrorResponse {
  return result.success === false;
}

/**
 * Extract data from API result or throw
 */
export function unwrapApiResult<T>(result: ApiResult<T>): T {
  if (isApiSuccess(result)) {
    return result.data;
  }
  throw new Error(result.error.message);
}
