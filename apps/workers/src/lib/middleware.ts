/**
 * Hono Middleware for Workers API
 *
 * Provides validation, rate limiting, and error handling.
 */

import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { Context } from "hono";
import type { Env, ApiResponse } from "./types";
import { Logger, createRequestLogger } from "./logger";

const apiLogger = new Logger("API");
import {
  bitcoinAddressSchema as sharedBitcoinAddressSchema,
  miningProofSchema as sharedMiningProofSchema,
  aiProofSchema as sharedAIProofSchema,
  poolTypeSchema as sharedPoolTypeSchema,
  leaderboardCategorySchema as sharedLeaderboardCategorySchema,
  leaderboardPeriodSchema as sharedLeaderboardPeriodSchema,
  txidSchema as sharedTxidSchema,
  bloodlineSchema as sharedBloodlineSchema,
  rarityTierSchema as sharedRarityTierSchema,
  tokenIdSchema as sharedTokenIdSchema,
} from "@bitcoinbaby/shared/validation";

// =============================================================================
// VALIDATION MIDDLEWARE
// =============================================================================

/**
 * Create validation middleware for request body
 *
 * @example
 * ```typescript
 * const creditSchema = z.object({
 *   hash: z.string().length(64),
 *   nonce: z.number().int().min(0),
 *   difficulty: z.number().int().min(16).max(32),
 * });
 *
 * router.post("/credit", validateBody(creditSchema), async (c) => {
 *   const data = c.get("validatedBody"); // Typed!
 *   // ...
 * });
 * ```
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: { validatedBody: z.infer<T> };
  }>(async (c, next) => {
    try {
      const body = await c.req.json();
      const result = schema.safeParse(body);

      if (!result.success) {
        const errors = result.error.flatten();
        return c.json<ApiResponse>(
          {
            success: false,
            error: "Validation failed",
            timestamp: Date.now(),
            details: errors.fieldErrors,
          },
          400,
        );
      }

      c.set("validatedBody", result.data);
      await next();
    } catch {
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid JSON body",
          timestamp: Date.now(),
        },
        400,
      );
    }
  });
}

/**
 * Create validation middleware for query parameters
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: { validatedQuery: z.infer<T> };
  }>(async (c, next) => {
    const query: Record<string, string> = {};
    for (const [key, value] of Object.entries(c.req.query())) {
      if (value !== undefined) {
        query[key] = value;
      }
    }

    const result = schema.safeParse(query);

    if (!result.success) {
      const errors = result.error.flatten();
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid query parameters",
          timestamp: Date.now(),
          details: errors.fieldErrors,
        },
        400,
      );
    }

    c.set("validatedQuery", result.data);
    await next();
  });
}

/**
 * Create validation middleware for URL parameters
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return createMiddleware<{
    Bindings: Env;
    Variables: { validatedParams: z.infer<T> };
  }>(async (c, next) => {
    const params = c.req.param();
    const result = schema.safeParse(params);

    if (!result.success) {
      const errors = result.error.flatten();
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Invalid URL parameters",
          timestamp: Date.now(),
          details: errors.fieldErrors,
        },
        400,
      );
    }

    c.set("validatedParams", result.data);
    await next();
  });
}

// =============================================================================
// COMMON SCHEMAS (re-exported from @bitcoinbaby/shared)
// =============================================================================

// Re-export validation schemas from shared package for consistency
export const bitcoinAddressSchema = sharedBitcoinAddressSchema;
export const miningProofSchema = sharedMiningProofSchema;
export const aiProofSchema = sharedAIProofSchema;
export const poolTypeSchema = sharedPoolTypeSchema;
export const leaderboardCategorySchema = sharedLeaderboardCategorySchema;
export const leaderboardPeriodSchema = sharedLeaderboardPeriodSchema;
export const txidSchema = sharedTxidSchema;
export const bloodlineSchema = sharedBloodlineSchema;
export const rarityTierSchema = sharedRarityTierSchema;
export const tokenIdSchema = sharedTokenIdSchema;

/**
 * Withdrawal request schema (workers-specific with flexible amount)
 */
export const withdrawRequestSchema = z.object({
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  amount: z.union([
    z.string().regex(/^\d+$/, "Amount must be numeric"),
    z.number().int().positive(),
  ]),
  maxFeeRate: z.number().min(1).max(10000).optional(),
});

/**
 * Leaderboard query schema (workers-specific with defaults)
 */
export const leaderboardQuerySchema = z.object({
  category: z.enum(["miners", "babies", "earners"]).default("miners"),
  period: z.enum(["daily", "weekly", "alltime"]).default("alltime"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * NFT mint schema
 */
export const nftMintSchema = z.object({
  address: z.string().min(1),
  bloodline: z.enum(["royal", "warrior", "rogue", "mystic"]).optional(),
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/)
    .optional(),
});

/**
 * NFT claim schema
 */
export const nftClaimSchema = z.object({
  address: bitcoinAddressSchema,
  txid: z
    .string()
    .length(64)
    .regex(/^[a-fA-F0-9]+$/),
  tokenId: z.number().int().positive(),
});

/**
 * NFT listing schema
 */
export const nftListingSchema = z.object({
  tokenId: z.number().int().positive(),
  sellerAddress: bitcoinAddressSchema,
  priceInSats: z.union([
    z.string().regex(/^\d+$/),
    z.number().int().positive(),
  ]),
});

// =============================================================================
// ERROR HANDLING MIDDLEWARE
// =============================================================================

/**
 * Global error handler middleware
 */
export const errorHandler = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    try {
      await next();
    } catch (error) {
      apiLogger.error("Unhandled error", error);

      // Don't expose internal errors to clients in production
      const isDev = c.env.ENVIRONMENT === "development";
      const message =
        error instanceof Error && isDev
          ? error.message
          : "Internal server error";

      return c.json<ApiResponse>(
        {
          success: false,
          error: message,
          timestamp: Date.now(),
        },
        500,
      );
    }
  },
);

// =============================================================================
// RATE LIMITING MIDDLEWARE
// =============================================================================

/** In-memory fallback cache for when KV is unavailable */
const rateLimitMemCache = new Map<string, { count: number; resetAt: number }>();
const MEM_CACHE_MAX_SIZE = 10000;

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
  /** Custom key generator (default: CF-Connecting-IP) */
  keyGenerator?: (c: Context) => string;
  /** Prefix for KV keys */
  prefix?: string;
  /** Skip rate limiting in development */
  skipInDev?: boolean;
}

/**
 * Distributed rate limiter using KV with in-memory fallback
 *
 * Features:
 * - Uses KV for distributed rate limiting across workers
 * - Falls back to in-memory when KV unavailable
 * - Supports custom key generators for per-address limits
 * - Automatically cleans up expired entries
 */
export function rateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    keyGenerator,
    prefix = "rl:",
    skipInDev = false,
  } = options;

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    // Skip in development if configured
    if (skipInDev && c.env.ENVIRONMENT === "development") {
      await next();
      return;
    }

    const ip = c.req.header("CF-Connecting-IP") || "anonymous";
    const key = keyGenerator ? keyGenerator(c) : ip;
    const kvKey = `${prefix}${key}`;
    const now = Date.now();
    const windowEnd = now + windowMs;

    // Try KV first (distributed)
    const kv = c.env.CACHE;
    if (kv) {
      try {
        const cached = await kv.get<{ count: number; resetAt: number }>(
          kvKey,
          "json",
        );

        if (!cached || now > cached.resetAt) {
          // New window
          await kv.put(
            kvKey,
            JSON.stringify({ count: 1, resetAt: windowEnd }),
            { expirationTtl: Math.ceil(windowMs / 1000) + 60 },
          );
          await next();
          return;
        }

        if (cached.count >= max) {
          const retryAfter = Math.ceil((cached.resetAt - now) / 1000);
          c.header("Retry-After", String(retryAfter));
          c.header("X-RateLimit-Limit", String(max));
          c.header("X-RateLimit-Remaining", "0");
          c.header(
            "X-RateLimit-Reset",
            String(Math.ceil(cached.resetAt / 1000)),
          );

          apiLogger.warn("Rate limit exceeded", {
            ip,
            key,
            count: cached.count,
          });

          return c.json<ApiResponse>(
            {
              success: false,
              error: "Rate limit exceeded. Please try again later.",
              timestamp: now,
            },
            429,
          );
        }

        // Increment counter
        await kv.put(
          kvKey,
          JSON.stringify({ count: cached.count + 1, resetAt: cached.resetAt }),
          { expirationTtl: Math.ceil((cached.resetAt - now) / 1000) + 60 },
        );

        c.header("X-RateLimit-Limit", String(max));
        c.header("X-RateLimit-Remaining", String(max - cached.count - 1));
        c.header("X-RateLimit-Reset", String(Math.ceil(cached.resetAt / 1000)));

        await next();
        return;
      } catch (kvError) {
        apiLogger.warn("KV rate limit error, falling back to memory", {
          error: kvError,
        });
        // Fall through to memory-based rate limiting
      }
    }

    // In-memory fallback (single worker only)
    const record = rateLimitMemCache.get(kvKey);

    if (!record || now > record.resetAt) {
      // Cleanup old entries periodically
      if (rateLimitMemCache.size > MEM_CACHE_MAX_SIZE) {
        const entries = Array.from(rateLimitMemCache.entries());
        const toDelete = entries
          .filter(([, v]) => now > v.resetAt)
          .slice(0, 1000);
        toDelete.forEach(([k]) => rateLimitMemCache.delete(k));
      }

      rateLimitMemCache.set(kvKey, { count: 1, resetAt: windowEnd });
      await next();
      return;
    }

    if (record.count >= max) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfter));
      return c.json<ApiResponse>(
        {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          timestamp: now,
        },
        429,
      );
    }

    record.count++;
    await next();
  });
}

/**
 * Pre-configured rate limits for common use cases
 */
export const rateLimits = {
  /** General API: 100 req/min */
  general: rateLimit({ windowMs: 60_000, max: 100 }),

  /** Mining credit: 60 req/min (1/sec target rate) */
  miningCredit: rateLimit({
    windowMs: 60_000,
    max: 60,
    prefix: "rl:mine:",
    skipInDev: true, // Allow tests to pass in development
    keyGenerator: (c) => {
      const address =
        c.req.param("address") || c.req.header("X-Wallet-Address");
      const ip = c.req.header("CF-Connecting-IP") || "anon";
      return address || ip;
    },
  }),

  /** Claim operations: 10 req/min */
  claim: rateLimit({
    windowMs: 60_000,
    max: 10,
    prefix: "rl:claim:",
    skipInDev: true, // Allow tests to pass in development
    keyGenerator: (c) => {
      const ip = c.req.header("CF-Connecting-IP") || "anon";
      return ip;
    },
  }),

  /** Admin operations: 30 req/min */
  admin: rateLimit({
    windowMs: 60_000,
    max: 30,
    prefix: "rl:admin:",
  }),
};

// =============================================================================
// METRICS MIDDLEWARE
// =============================================================================

import { recordRequest } from "./metrics";

/**
 * Metrics collection middleware
 *
 * Records request count, latency, and status for all routes.
 */
export const metricsMiddleware = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const start = Date.now();
    const method = c.req.method;

    // Normalize path for metrics (remove IDs)
    let endpoint = c.req.path;
    endpoint = endpoint
      .replace(/\/[a-fA-F0-9]{64}/g, "/:txid")
      .replace(/\/tb1[a-zA-HJ-NP-Z0-9]{25,62}/g, "/:address")
      .replace(/\/bc1[a-zA-HJ-NP-Z0-9]{25,62}/g, "/:address")
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/:uuid",
      );

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    recordRequest(endpoint, method, status, duration);
  },
);

// =============================================================================
// LOGGING MIDDLEWARE
// =============================================================================

/**
 * Request logging middleware with timing
 */
export const requestLogger = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const start = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const requestId = c.res.headers.get("X-Request-Id") || crypto.randomUUID();

    await next();

    const duration = Date.now() - start;
    const status = c.res.status;

    // Log in structured format
    const requestLogger = createRequestLogger("Request", requestId);
    requestLogger.info("Request completed", {
      method,
      path,
      status,
      duration,
    });
  },
);

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================

/**
 * Security headers middleware
 */
export const securityHeaders = createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    await next();

    // Add security headers
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-XSS-Protection", "1; mode=block");
    c.res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  },
);

// =============================================================================
// PHASE GATING MIDDLEWARE
// =============================================================================

/**
 * Phase-gating middleware factory for Hono.
 *
 * Reads c.env.PHASE (default "1") and compares against minPhase.
 * Returns 404 JSON if the current phase is below the minimum required,
 * so features not yet launched are invisible rather than forbidden.
 *
 * @param minPhase - Minimum phase number required (1, 2, or 3)
 * @returns Hono middleware that gates the route
 *
 * @example
 * import { phaseGate } from "../lib/middleware";
 * claimRouter.use("*", phaseGate(2));
 */
export function phaseGate(minPhase: number) {
  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const currentPhase = parseInt(c.env.PHASE || "1", 10);
    if (currentPhase >= minPhase) {
      await next();
      return;
    }
    return c.json<ApiResponse>(
      {
        success: false,
        error: `This feature is not available in Phase ${currentPhase}. It will be enabled in Phase ${minPhase}.`,
        timestamp: Date.now(),
      },
      404,
    );
  });
}
