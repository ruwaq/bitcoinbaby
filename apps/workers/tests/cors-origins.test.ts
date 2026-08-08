/**
 * CORS Origins Tests
 *
 * Validates the CORS allowlist in apps/workers/src/index.ts.
 *
 * Specifically guards against regressions in the Capacitor WebView origin
 * allowlist. Capacitor 8 uses these default schemes:
 *   - iOS:     capacitor://localhost
 *   - Android: http://localhost (with a port like :8100 or whatever the dev
 *              server uses, but the origin host is always localhost)
 *
 * Without these in the allowlist, the native mobile app (Capacitor) cannot
 * make authenticated requests to the API — fetch() from the WebView fails
 * CORS preflight.
 *
 * Test strategy:
 *   - Import the real app composition (or a faithful sub-app)
 *   - Send OPTIONS preflight requests with various Origin headers
 *   - Assert Access-Control-Allow-Origin is present for allowed origins
 *   - Assert it is absent for disallowed origins (security: no leak)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "../src/lib/types";

// =============================================================================
// CORS ORIGIN POLICY (imported from src/lib/cors.ts — same as production)
// =============================================================================
//
// The allowlist policy lives in src/lib/cors.ts so it can be unit-tested in
// isolation. The test below exercises it end-to-end through a real Hono app
// with the cors() middleware configured exactly like src/index.ts.

import { getAllowedOrigin } from "../src/lib/cors";

/**
 * Build a Hono app with CORS configured exactly like the production one.
 * This is the surface under test.
 */
function buildCorsApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.use(
    "*",
    cors({
      origin: getAllowedOrigin,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: [
        "Content-Type",
        "Authorization",
        "X-Request-Id",
        "X-Wallet-Address",
        "X-Admin-Key",
      ],
      exposeHeaders: ["X-Request-Id"],
      maxAge: 86400,
      credentials: true,
    }),
  );
  app.get("/health", (c) => c.json({ status: "ok" }));
  return app;
}

// =============================================================================
// TESTS
// =============================================================================

describe("CORS origin allowlist", () => {
  let app: Hono<{ Bindings: Partial<Env> }>;

  beforeEach(() => {
    app = buildCorsApp();
  });

  describe("web origins (existing allowlist)", () => {
    it("allows http://localhost:3000 (dev)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "http://localhost:3000" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost:3000",
      );
    });

    it("allows https://bitcoinbaby.app (prod apex)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://bitcoinbaby.app" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://bitcoinbaby.app",
      );
    });

    it("allows https://www.bitcoinbaby.app (prod www)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://www.bitcoinbaby.app" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://www.bitcoinbaby.app",
      );
    });

    it("allows arbitrary bitcoinbaby.app subdomains", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://api.bitcoinbaby.app" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://api.bitcoinbaby.app",
      );
    });
  });

  describe("Capacitor WebView origins (the fix under test)", () => {
    it("allows capacitor://localhost (iOS Capacitor 8 default)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "capacitor://localhost" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "capacitor://localhost",
      );
    });

    it("allows http://localhost (Android Capacitor 8 default)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "http://localhost" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
    });

    it("handles OPTIONS preflight from capacitor://localhost", async () => {
      const res = await app.request("/health", {
        method: "OPTIONS",
        headers: {
          Origin: "capacitor://localhost",
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "Content-Type, Authorization",
        },
      });
      // Preflight must return 2xx (usually 204) with CORS headers present
      expect(res.status).toBeLessThan(300);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "capacitor://localhost",
      );
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    });

    it("handles OPTIONS preflight from http://localhost", async () => {
      const res = await app.request("/health", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost",
          "Access-Control-Request-Method": "POST",
        },
      });
      expect(res.status).toBeLessThan(300);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "http://localhost",
      );
    });
  });

  describe("security: disallowed origins must NOT receive Allow-Origin", () => {
    it("rejects https://evil.example.com", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://evil.example.com" },
      });
      // CORS spec: when origin is not allowed, the server should omit the
      // Access-Control-Allow-Origin header (or return null). Browsers will
      // then block the response.
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("rejects https://bitcoinbaby.evil.com (lookalike domain)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://bitcoinbaby.evil.com" },
      });
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("rejects https://phishing-bitcoinbaby.app (wrong subdomain pattern)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "https://phishing-bitcoinbaby.app" },
      });
      // Regex requires 'subdomain.bitcoinbaby.app' so this should NOT match
      // (it has no dot separator before bitcoinbaby.app)
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("rejects capacitor://evil.com (lookalike Capacitor scheme)", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "capacitor://evil.com" },
      });
      // Only capacitor://localhost is allowed, not arbitrary capacitor hosts
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("credentials header", () => {
    it("sets Access-Control-Allow-Credentials: true for allowed origins", async () => {
      const res = await app.request("/health", {
        headers: { Origin: "http://localhost:3000" },
      });
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    });
  });
});
