/**
 * API Configuration
 *
 * Centralized API endpoint configuration.
 * Single source of truth for all API URLs.
 */

// =============================================================================
// TYPES
// =============================================================================

export type Environment = "development" | "production" | "test";

export interface ApiEndpoints {
  workers: string;
  prover: string;
}

// =============================================================================
// ENDPOINTS
// =============================================================================

/**
 * Workers API endpoints by environment
 */
export const WORKERS_API = {
  development: "http://localhost:8787",
  production: "https://bitcoinbaby-api.andeanlabs-58f.workers.dev",
  test: "http://localhost:8787",
} as const;

/**
 * Charms Prover endpoints by environment
 */
export const PROVER_API = {
  development: "http://localhost:17784",
  production: "https://v11.charms.dev",
  test: "http://localhost:17784",
} as const;

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

// Safe process.env access that works in all environments
declare const process: { env?: Record<string, string | undefined> } | undefined;

/**
 * Detect current environment from process.env or window
 */
export function detectEnvironment(): Environment {
  // Server-side (Node.js) or bundled client with process.env
  if (typeof process !== "undefined" && process?.env) {
    if (process.env.NODE_ENV === "test") return "test";
    if (process.env.NODE_ENV === "production") return "production";

    // Client-side with NEXT_PUBLIC
    const nextEnv = process.env.NEXT_PUBLIC_ENV;
    if (nextEnv === "production") return "production";
    if (nextEnv === "test") return "test";
  }

  // Default to development
  return "development";
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  return detectEnvironment() === "production";
}

/**
 * Check if running in development
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === "development";
}

// =============================================================================
// ENDPOINT GETTERS
// =============================================================================

/**
 * Get Workers API URL for current environment
 *
 * Respects environment variables for override:
 * - NEXT_PUBLIC_WORKERS_API_URL (client)
 * - WORKERS_API_URL (server)
 */
export function getWorkersApiUrl(): string {
  // Check for environment variable override
  if (typeof process !== "undefined" && process?.env) {
    const override =
      process.env.NEXT_PUBLIC_WORKERS_API_URL || process.env.WORKERS_API_URL;
    if (override) return override;
  }

  return WORKERS_API[detectEnvironment()];
}

/**
 * Get Charms Prover URL for current environment
 *
 * Respects environment variables for override:
 * - NEXT_PUBLIC_PROVER_URL (client)
 * - PROVER_URL or CHARMS_PROVER_URL (server)
 */
export function getProverUrl(): string {
  // Check for environment variable override
  if (typeof process !== "undefined" && process?.env) {
    const override =
      process.env.NEXT_PUBLIC_PROVER_URL ||
      process.env.PROVER_URL ||
      process.env.CHARMS_PROVER_URL;
    if (override) return override;
  }

  return PROVER_API[detectEnvironment()];
}

/**
 * Get all API endpoints for current environment
 */
export function getApiEndpoints(): ApiEndpoints {
  return {
    workers: getWorkersApiUrl(),
    prover: getProverUrl(),
  };
}
