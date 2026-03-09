/**
 * Unified HTTP Client
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Request timeout handling
 * - Rate limiting via queue
 * - Consistent error handling
 * - Request/response logging
 */

import {
  NetworkError,
  TimeoutError,
  RateLimitError,
  ApiError,
  wrapError,
} from "../errors";

// =============================================================================
// TYPES
// =============================================================================

export interface HttpClientConfig {
  /** Base URL for all requests */
  baseUrl: string;
  /** Request timeout in ms (default: 10000) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in ms (default: 1000) */
  retryDelay?: number;
  /** Maximum retry delay in ms (default: 30000) */
  maxRetryDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Rate limit requests per second (default: 10) */
  rateLimitPerSecond?: number;
  /** Default headers for all requests */
  headers?: Record<string, string>;
  /** Enable request logging (default: false) */
  debug?: boolean;
}

export interface RequestOptions extends Omit<RequestInit, "signal"> {
  /** Request-specific timeout override */
  timeout?: number;
  /** Request-specific retry override */
  maxRetries?: number;
  /** Skip retry logic */
  noRetry?: boolean;
  /** Request ID for tracing */
  requestId?: string;
}

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Headers;
  requestId?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * JSON replacer that handles bigint serialization
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Serialize body to JSON with bigint support
 */
function serializeBody(body: unknown): string {
  return JSON.stringify(body, bigIntReplacer);
}

// =============================================================================
// IMPLEMENTATION
// =============================================================================

export class HttpClient {
  private config: Required<HttpClientConfig>;
  private requestQueue: Array<() => Promise<unknown>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;

  constructor(config: HttpClientConfig) {
    this.config = {
      timeout: 10000,
      maxRetries: 3,
      retryDelay: 1000,
      maxRetryDelay: 30000,
      backoffFactor: 2,
      rateLimitPerSecond: 10,
      headers: {},
      debug: false,
      ...config,
    };
  }

  /**
   * Make a GET request
   */
  async get<T>(
    path: string,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: "GET" });
  }

  /**
   * Make a POST request
   */
  async post<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: "POST",
      body: body ? serializeBody(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }

  /**
   * Make a PUT request
   */
  async put<T>(
    path: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, {
      ...options,
      method: "PUT",
      body: body ? serializeBody(body) : undefined,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(
    path: string,
    options?: RequestOptions,
  ): Promise<HttpResponse<T>> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }

  /**
   * Core request method with retry and rate limiting
   */
  async request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    return this.enqueue(() => this.executeRequest<T>(path, options));
  }

  /**
   * Execute a single request with retry logic
   */
  private async executeRequest<T>(
    path: string,
    options: RequestOptions,
  ): Promise<HttpResponse<T>> {
    const timeout = options.timeout ?? this.config.timeout;
    const maxRetries = options.noRetry
      ? 0
      : (options.maxRetries ?? this.config.maxRetries);
    const requestId = options.requestId ?? this.generateRequestId();

    let lastError: Error | null = null;
    let delay = this.config.retryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        if (this.config.debug) {
          console.log(
            `[HTTP] ${options.method ?? "GET"} ${path} (attempt ${attempt + 1})`,
          );
        }

        const url = path.startsWith("http")
          ? path
          : `${this.config.baseUrl}${path}`;
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            ...this.config.headers,
            ...options.headers,
            "X-Request-Id": requestId,
          },
        });

        clearTimeout(timeoutId);

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(
            response.headers.get("Retry-After") ?? "60",
            10,
          );
          throw new RateLimitError("Rate limit exceeded", {
            retryAfter: retryAfter * 1000,
            metadata: { path, requestId },
          });
        }

        // Handle client errors (no retry)
        if (response.status >= 400 && response.status < 500) {
          const errorBody = await this.parseResponseBody(response);
          throw new ApiError(
            typeof errorBody === "object" && errorBody && "error" in errorBody
              ? String((errorBody as { error: unknown }).error)
              : `Request failed with status ${response.status}`,
            response.status,
            {
              isRetryable: false,
              metadata: { path, requestId, body: errorBody },
            },
          );
        }

        // Handle server errors (retry)
        if (response.status >= 500) {
          throw new ApiError(
            `Server error: ${response.status}`,
            response.status,
            {
              isRetryable: true,
              metadata: { path, requestId },
            },
          );
        }

        // Parse successful response
        const data = await this.parseResponseBody<T>(response);

        return {
          data,
          status: response.status,
          headers: response.headers,
          requestId,
        };
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort (timeout)
        if (error instanceof Error && error.name === "AbortError") {
          lastError = new TimeoutError(`Request timed out after ${timeout}ms`, {
            metadata: { path, timeout, attempt, requestId },
          });
        } else {
          lastError = wrapError(error);
        }

        // Check if retryable
        const shouldRetry =
          attempt < maxRetries &&
          (lastError instanceof NetworkError ||
            lastError instanceof TimeoutError ||
            (lastError instanceof ApiError && lastError.isRetryable));

        if (shouldRetry) {
          if (this.config.debug) {
            console.warn(
              `[HTTP] Retry ${attempt + 1}/${maxRetries} in ${delay}ms: ${lastError.message}`,
            );
          }
          await this.sleep(delay);
          delay = Math.min(
            delay * this.config.backoffFactor,
            this.config.maxRetryDelay,
          );
          continue;
        }

        throw lastError;
      }
    }

    throw lastError ?? new NetworkError("Request failed");
  }

  /**
   * Parse response body based on content type
   */
  private async parseResponseBody<T>(response: Response): Promise<T> {
    const contentType = response.headers.get("Content-Type") ?? "";
    const text = await response.text();

    if (!text) {
      return {} as T;
    }

    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text) as T;
      } catch {
        throw new ApiError("Invalid JSON response", 500, {
          metadata: { body: text.slice(0, 200) },
        });
      }
    }

    return text as unknown as T;
  }

  /**
   * Rate limiting via request queue
   */
  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          resolve(await fn());
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  /**
   * Process queued requests with rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    const minInterval = 1000 / this.config.rateLimitPerSecond;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;

      if (elapsed < minInterval) {
        await this.sleep(minInterval - elapsed);
      }

      const request = this.requestQueue.shift();
      if (request) {
        this.lastRequestTime = Date.now();
        await request();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Update base URL
   */
  setBaseUrl(url: string): void {
    this.config.baseUrl = url;
  }

  /**
   * Get current base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

const clients = new Map<string, HttpClient>();

/**
 * Get or create an HTTP client for a specific base URL
 */
export function getHttpClient(config: HttpClientConfig): HttpClient {
  const key = config.baseUrl;
  let client = clients.get(key);

  if (!client) {
    client = new HttpClient(config);
    clients.set(key, client);
  }

  return client;
}

/**
 * Clear all cached clients (useful for testing)
 */
export function clearHttpClients(): void {
  clients.clear();
}
