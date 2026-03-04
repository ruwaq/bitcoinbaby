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
    } catch (error) {
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

/**
 * Simple in-memory rate limiter
 *
 * Note: For production, use Cloudflare's built-in rate limiting
 * or a distributed solution like Redis.
 */
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(options: {
  windowMs: number;
  max: number;
  keyGenerator?: (c: Context) => string;
}) {
  const { windowMs, max, keyGenerator } = options;

  return createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const key = keyGenerator
      ? keyGenerator(c)
      : c.req.header("CF-Connecting-IP") || "anonymous";

    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetAt) {
      rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
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
          timestamp: Date.now(),
        },
        429,
      );
    }

    record.count++;
    await next();
  });
}

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
