/**
 * Worker Helpers
 *
 * Shared utility functions for all routes.
 */

import type { Context } from "hono";
import type { Env, ApiResponse, PoolType } from "./types";
import { Logger } from "./logger";

const helpersLogger = new Logger("Helpers");

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate a Bitcoin address (testnet or mainnet)
 */
export function isValidBitcoinAddress(address: string): boolean {
  if (!address || typeof address !== "string") {
    return false;
  }

  const patterns = [
    // Testnet4/Testnet addresses
    /^tb1[a-zA-HJ-NP-Z0-9]{39,59}$/, // Testnet bech32 (segwit/taproot)
    /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Testnet P2PKH
    /^2[a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Testnet P2SH
    // Mainnet addresses
    /^bc1[a-zA-HJ-NP-Z0-9]{39,59}$/, // Mainnet bech32 (segwit/taproot)
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Mainnet P2PKH/P2SH
  ];

  return patterns.some((p) => p.test(address));
}

/**
 * Validate pool type
 */
export function isValidPoolType(poolType: string): poolType is PoolType {
  return ["weekly", "monthly", "low_fee", "immediate"].includes(poolType);
}

/**
 * Validate transaction ID (hex, 64 chars)
 */
export function isValidTxid(txid: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(txid);
}

/**
 * Validate leaderboard category
 */
export function isValidLeaderboardCategory(
  category: string,
): category is "miners" | "babies" | "earners" {
  return ["miners", "babies", "earners"].includes(category);
}

/**
 * Validate leaderboard period
 */
export function isValidLeaderboardPeriod(
  period: string,
): period is "daily" | "weekly" | "alltime" {
  return ["daily", "weekly", "alltime"].includes(period);
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

/**
 * Create a standardized error response
 */
export function errorResponse<C extends Context>(
  c: C,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500 | 503 = 400,
): Response {
  return c.json<ApiResponse>(
    {
      success: false,
      error: message,
      timestamp: Date.now(),
    },
    status,
  );
}

/**
 * Create a standardized success response
 */
export function successResponse<C extends Context, T>(
  c: C,
  data: T,
  status: 200 | 201 = 200,
): Response {
  return c.json<ApiResponse<T>>(
    {
      success: true,
      data,
      timestamp: Date.now(),
    },
    status,
  );
}

// =============================================================================
// DURABLE OBJECT HELPERS
// =============================================================================

/**
 * Get a Durable Object stub by address
 */
export function getVirtualBalanceStub(env: Env, address: string) {
  const id = env.VIRTUAL_BALANCE.idFromName(address);
  return env.VIRTUAL_BALANCE.get(id);
}

/**
 * Get a Withdraw Pool stub by pool type
 */
export function getWithdrawPoolStub(env: Env, poolType: PoolType) {
  const id = env.WITHDRAW_POOL.idFromName(poolType);
  return env.WITHDRAW_POOL.get(id);
}

/**
 * Get a Game Room stub by room ID
 */
export function getGameRoomStub(env: Env, roomId: string) {
  const id = env.GAME_ROOM.idFromName(roomId);
  return env.GAME_ROOM.get(id);
}

/**
 * Forward a request to a Durable Object
 */
export async function forwardToDO(
  stub: DurableObjectStub,
  path: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
  } = {},
): Promise<Response> {
  const { method = "GET", body } = options;

  const init: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return stub.fetch(new Request(`http://internal${path}`, init));
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

/**
 * Wrap a DO call with error handling
 */
export async function safeDOCall<C extends Context>(
  c: C,
  operation: () => Promise<Response>,
  context: string,
): Promise<Response> {
  try {
    const response = await operation();

    // Handle DO internal errors gracefully
    if (!response.ok && response.status >= 500) {
      helpersLogger.error("DO error", undefined, {
        context,
        status: response.status,
      });
      return errorResponse(
        c,
        "Service temporarily unavailable. Please try again later.",
        503,
      );
    }

    return response;
  } catch (error) {
    helpersLogger.error("Operation error", error, { context });
    return errorResponse(
      c,
      "Service temporarily unavailable. Please try again later.",
      503,
    );
  }
}

// =============================================================================
// PAGINATION
// =============================================================================

/**
 * Parse pagination params from query string
 */
export function parsePagination(
  c: Context,
  defaults: { limit?: number; offset?: number } = {},
): { limit: number; offset: number } {
  const limitStr = c.req.query("limit");
  const offsetStr = c.req.query("offset");

  const limit = Math.min(
    Math.max(parseInt(limitStr || String(defaults.limit || 50), 10), 1),
    100,
  );
  const offset = Math.max(
    parseInt(offsetStr || String(defaults.offset || 0), 10),
    0,
  );

  return { limit, offset };
}

// =============================================================================
// CACHING
// =============================================================================

/**
 * Create a cached response
 */
export function cachedResponse<T>(data: T, cacheTTL: number = 60): Response {
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": `public, max-age=${cacheTTL}`,
      "X-Cache-TTL": String(cacheTTL),
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

// =============================================================================
// EXTERNAL API HELPERS
// =============================================================================

/**
 * Custom error for timeout
 */
export class TimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Fetch with timeout using AbortController
 *
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns Promise<Response>
 * @throws TimeoutError if request times out
 *
 * @example
 * ```typescript
 * const response = await fetchWithTimeout(
 *   `https://mempool.space/api/tx/${txid}`,
 *   { method: 'GET' },
 *   5000 // 5 second timeout
 * );
 * ```
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 10000,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new TimeoutError(
        `Request to ${url} timed out after ${timeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * External API configuration
 */
export const EXTERNAL_API = {
  MEMPOOL_TESTNET4: "https://mempool.space/testnet4/api",
  MEMPOOL_MAINNET: "https://mempool.space/api",
  DEFAULT_TIMEOUT_MS: 10000,
  TX_LOOKUP_TIMEOUT_MS: 15000,
  FEE_ESTIMATE_TIMEOUT_MS: 5000,
} as const;
