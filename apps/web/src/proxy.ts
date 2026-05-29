/**
 * Security Middleware (Proxy) - PRODUCTION
 *
 * Balanced CSP for Web3 applications:
 * - 'unsafe-inline' for Next.js hydration compatibility
 * - 'wasm-unsafe-eval' for crypto libraries (secp256k1)
 * - Allows wallet extensions to function
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

export function proxy(request: NextRequest) {
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

  // Script-src: in development React needs 'unsafe-eval' for hot reload and
  // stack trace reconstruction (Turbopack). Never used in production.
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'`
    : `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`;

  // connect-src: allow localhost ports for local API worker development/testing
  const connectSrc =
    "connect-src 'self' http://localhost:* ws://localhost:* https://mempool.space wss://mempool.space https://scrolls.charms.dev https://*.workers.dev https://charms-explorer-api.fly.dev https://v14.charms.dev https://api.cloudflare.com https://huggingface.co https://*.huggingface.co https://hf.co https://*.hf.co https://*.xethub.hf.co https://cas-bridge.xethub.hf.co https://cdn.jsdelivr.net";

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
