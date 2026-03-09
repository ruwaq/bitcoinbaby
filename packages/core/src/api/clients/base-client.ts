/**
 * Base API Client
 *
 * Foundation for all domain-specific API clients.
 * Uses HttpClient from @bitcoinbaby/shared for consistent
 * retry, timeout, and error handling.
 */

import {
  HttpClient,
  type HttpClientConfig,
  WORKERS_API,
  HTTP_TIMEOUTS,
  RETRY_CONFIG,
  type Environment,
} from "@bitcoinbaby/shared";
import type { ApiResponse } from "../types";

export type { Environment };

// =============================================================================
// BASE CLIENT
// =============================================================================

export abstract class BaseApiClient {
  protected http: HttpClient;
  protected environment: Environment;

  constructor(
    env: Environment = "development",
    config?: Partial<HttpClientConfig>,
  ) {
    this.environment = env;
    this.http = new HttpClient({
      baseUrl: WORKERS_API[env],
      timeout: HTTP_TIMEOUTS.STANDARD,
      maxRetries: RETRY_CONFIG.MAX_RETRIES,
      ...config,
    });
  }

  /**
   * Set custom base URL
   */
  setBaseUrl(url: string): void {
    this.http.setBaseUrl(url);
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.http.getBaseUrl();
  }

  /**
   * Get current environment
   */
  getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Make GET request and return ApiResponse
   */
  protected async get<T>(path: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.http.get<ApiResponse<T>>(path);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make POST request and return ApiResponse
   */
  protected async post<T>(
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.http.post<ApiResponse<T>>(path, body);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make POST request with custom timeout (for long operations like prover)
   */
  protected async postWithTimeout<T>(
    path: string,
    body: unknown,
    timeoutMs: number,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.http.post<ApiResponse<T>>(path, body, {
        timeout: timeoutMs,
      });
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make PUT request and return ApiResponse
   */
  protected async put<T>(
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.http.put<ApiResponse<T>>(path, body);
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Make DELETE request and return ApiResponse
   */
  protected async delete<T>(
    path: string,
    headers?: Record<string, string>,
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.http.delete<ApiResponse<T>>(path, {
        headers,
      });
      return response.data;
    } catch (error) {
      return this.handleError<T>(error);
    }
  }

  /**
   * Handle errors and return error response
   */
  private handleError<T>(error: unknown): ApiResponse<T> {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[API] Error:`, message);
    return {
      success: false,
      error: message,
    } as ApiResponse<T>;
  }
}
