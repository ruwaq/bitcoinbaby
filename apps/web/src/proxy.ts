/**
 * Security Proxy — Next.js 16 file convention (replaces middleware.ts)
 *
 * CSP with nonce-based script-src for strong XSS protection.
 * Dev mode adds unsafe-inline/unsafe-eval for Turbopack HMR.
 * wasm-unsafe-eval for crypto libraries (secp256k1).
 *
 * Rate limiting:
 * - In-memory token bucket per IP for basic DoS protection
 * - Edge-compatible (no KV/Redis needed at this layer)
 * - Backend Workers handle distributed rate limiting for API calls
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// =============================================================================
// RATE LIMITER (In-Memory Token Bucket)
// =============================================================================
// Edge Runtime runs without KV/Redis at this layer.
// This in-memory rate limiter provides basic DoS protection per Edge instance.
// For distributed rate limiting, the Workers API handles it at the backend layer.

interface RateLimitEntry {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

/** Maximum requests per window per IP */
const MAX_REQUESTS = 200;
/** Time window in ms (1 minute) */
const WINDOW_MS = 60_000;
/** Max entries before cleanup triggers */
const MAX_STORE_SIZE = 10_000;

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);

  if (!entry) {
    // First request from this IP — create new bucket
    rateLimitStore.set(ip, { tokens: MAX_REQUESTS - 1, lastRefill: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  // Refill tokens based on elapsed time (token bucket algorithm)
  const elapsed = now - entry.lastRefill;
  const refillAmount = Math.floor((elapsed / WINDOW_MS) * MAX_REQUESTS);

  if (refillAmount > 0) {
    entry.tokens = Math.min(MAX_REQUESTS, entry.tokens + refillAmount);
    entry.lastRefill = now;
  }

  if (entry.tokens <= 0) {
    return { allowed: false, remaining: 0 };
  }

  entry.tokens--;
  return { allowed: true, remaining: entry.tokens };
}

/** Periodic cleanup to prevent memory leaks */
function cleanupRateLimitStore(): void {
  if (rateLimitStore.size > MAX_STORE_SIZE) {
    const now = Date.now();
    const staleThreshold = now - WINDOW_MS * 2;
    for (const [ip, entry] of rateLimitStore) {
      if (entry.lastRefill < staleThreshold) {
        rateLimitStore.delete(ip);
      }
    }
  }
}

// =============================================================================
// NONCE GENERATION
// =============================================================================

/**
 * Generate a cryptographically secure random nonce
 */
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  // Convert Uint8Array to base64 safely without using Node's Buffer (which is not available in Edge Runtime)
  let binary = "";
  const len = array.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(array[i]);
  }
  return btoa(binary);
}

// =============================================================================
// PROXY HANDLER
// =============================================================================

export function proxy(request: NextRequest) {
  // ---- Rate Limiting ----
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";
  const { allowed, remaining } = checkRateLimit(ip);

  // Periodic cleanup (best-effort, runs inline)
  cleanupRateLimitStore();

  if (!allowed) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Limit": String(MAX_REQUESTS),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // Generate nonce for this request
  const nonce = generateNonce();
  const isDev = process.env.NODE_ENV !== "production";

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Create the response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Script-src: use nonce for production (no unsafe-inline needed).
  // Dev needs unsafe-eval for React HMR stack traces. unsafe-inline in dev for Turbopack.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval'`;

  // connect-src: restrict localhost to dev only
  const baseConnectSrc =
    "connect-src 'self' https://mempool.space wss://mempool.space https://scrolls.charms.dev https://*.workers.dev https://charms-explorer-api.fly.dev https://v15.charms.dev https://api.cloudflare.com https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://*.xethub.hf.co https://cas-bridge.xethub.hf.co https://cdn.jsdelivr.net";
  const connectSrc = isDev
    ? `connect-src 'self' http://localhost:* ws://localhost:* https://mempool.space wss://mempool.space https://scrolls.charms.dev https://*.workers.dev https://charms-explorer-api.fly.dev https://v15.charms.dev https://api.cloudflare.com https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://*.xethub.hf.co https://cas-bridge.xethub.hf.co https://cdn.jsdelivr.net`
    : baseConnectSrc;

  const cspDirectives = [
    "default-src 'self'",
    // Scripts: self + unsafe-inline for Next.js hydration + wasm for crypto
    // In dev: also unsafe-eval for React stack traces and Turbopack HMR
    scriptSrc,
    // Styles: self + unsafe-inline for dynamic styles + Google Fonts
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Fonts
    "font-src 'self' https://fonts.gstatic.com",
    // Images
    "img-src 'self' data: blob:",
    // API connections - Bitcoin network APIs + Workers API + Charms APIs
    connectSrc,
    // Web Workers for mining
    "worker-src 'self' blob:",
    // Prevent framing (clickjacking protection)
    "frame-ancestors 'none'",
    // Form submissions only to self
    "form-action 'self'",
    // Base URI restriction
    "base-uri 'self'",
    // Upgrade HTTP to HTTPS (production only)
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];

  // Set security headers
  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Store nonce for use in pages
  response.headers.set("x-nonce", nonce);

  // Rate limit headers (informational)
  response.headers.set("X-RateLimit-Limit", String(MAX_REQUESTS));
  response.headers.set("X-RateLimit-Remaining", String(remaining));

  return response;
}

// Apply proxy to all routes except static files and API
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - API routes that need different CSP
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
