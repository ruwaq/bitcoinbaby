/**
 * Security Middleware - PRODUCTION
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
  return Buffer.from(array).toString("base64");
}

export function middleware(request: NextRequest) {
  // Generate nonce for this request
  const nonce = generateNonce();

  // Clone the request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  // Create the response
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // PRODUCTION CSP - Balanced security for Web3 apps
  // 'wasm-unsafe-eval' required for WebAssembly (bitcoinjs-lib/secp256k1)
  // 'unsafe-inline' needed for Next.js hydration and wallet extensions
  const cspDirectives = [
    "default-src 'self'",
    // Scripts: self + unsafe-inline for Next.js hydration + wasm for crypto
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'`,
    // Styles: self + unsafe-inline for dynamic styles + Google Fonts
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    // Fonts
    "font-src 'self' https://fonts.gstatic.com",
    // Images
    "img-src 'self' data: blob:",
    // API connections - Bitcoin network APIs + Workers API + Charms APIs
    "connect-src 'self' https://mempool.space https://scrolls.charms.dev https://*.workers.dev wss://mempool.space https://charms-explorer-api.fly.dev https://v11.charms.dev",
    // Web Workers for mining
    "worker-src 'self' blob:",
    // Prevent framing (clickjacking protection)
    "frame-ancestors 'none'",
    // Form submissions only to self
    "form-action 'self'",
    // Base URI restriction
    "base-uri 'self'",
    // Upgrade HTTP to HTTPS
    "upgrade-insecure-requests",
  ];

  // Set security headers
  response.headers.set("Content-Security-Policy", cspDirectives.join("; "));
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Store nonce for use in pages
  response.headers.set("x-nonce", nonce);

  return response;
}

// Apply middleware to all routes except static files and API
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
