/**
 * CORS Origin Allowlist
 *
 * Single source of truth for the CORS allowlist used by the Workers API.
 *
 * Extracted from src/index.ts so the policy is unit-testable without having
 * to mount the entire app composition. The function is pure (no side effects)
 * and returns the exact origin string to echo back, or null to deny.
 *
 * SECURITY INVARIANTS enforced here:
 *   1. No wildcards. Each origin must be listed explicitly (or matched by a
 *      strict regex). This prevents malicious actors from registering
 *      lookalike Vercel projects or subdomains that would bypass CORS.
 *   2. Credentials are always enabled on the API, so the origin returned here
 *      is sent back verbatim in Access-Control-Allow-Origin (the spec forbids
 *      "*" with credentials).
 *   3. Capacitor WebView schemes are explicitly allowlisted. The native
 *      mobile app cannot call the API without them.
 */

/**
 * Evaluate whether a request Origin should be allowed by CORS.
 *
 * @param origin - The Origin header value (may be undefined for same-origin
 *                 requests or non-browser clients).
 * @returns The origin string to echo back, or null to deny the request.
 *          When `origin` is empty/undefined, returns a safe default
 *          (the first entry in the allowlist).
 */
export function getAllowedOrigin(origin: string): string | null {
  const allowedOrigins = [
    // Web app (local dev + production)
    "http://localhost:3000",
    "http://localhost:3001",
    "https://bitcoinbaby.app",
    "https://www.bitcoinbaby.app",
    "https://bitcoinbaby.vercel.app",
    // Capacitor WebView origins — required for the native mobile app.
    // Capacitor 8 uses these default schemes for its WebView, verified
    // via apps/web/capacitor.config.ts and the native Android/iOS
    // manifests (no custom scheme is configured).
    "capacitor://localhost", // iOS Capacitor WebView default scheme
    "http://localhost", // Android Capacitor WebView default androidScheme
  ];

  // Same-origin requests and non-browser clients (curl, server-to-server)
  // have no Origin header. Echo the first allowlist entry as a safe default.
  if (!origin) return allowedOrigins[0];

  // Explicit allowlist (exact match only)
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  // Allow any bitcoinbaby.app subdomain (production infra flexibility)
  if (/^https:\/\/[a-z0-9-]+\.bitcoinbaby\.app$/.test(origin)) {
    return origin;
  }

  // Vercel preview deployments — explicit allowlist only.
  // SECURITY: Do NOT use a broad regex pattern. Only allow known preview URLs
  // to prevent malicious actors from creating similarly-named Vercel projects
  // that would bypass CORS.
  const vercelPreviewAllowlist = [
    "https://bitcoinbaby-git-main-andeanlabs-projects.vercel.app",
    "https://bitcoinbaby.vercel.app",
  ];
  if (vercelPreviewAllowlist.includes(origin)) {
    return origin;
  }

  // Deny everything else
  return null;
}
