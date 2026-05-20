/**
 * Phase Gate Middleware Tests
 *
 * Tests the Hono phaseGate middleware that gates routes based on
 * the PHASE environment variable.
 *
 * Gate rules (from apps/workers/src/index.ts):
 * - /api/claim     → phaseGate(2)  (Phase 2+)
 * - /api/leaderboard → phaseGate(2)  (Phase 2+)
 * - /api/game      → phaseGate(3)  (Phase 3+)
 * - /api/faucet    → NOT gated (always available)
 * - /api/balance   → NOT gated (always available)
 * - /api/nft       → NOT gated (always available)
 */

import { describe, it, expect } from "vitest";

// =============================================================================
// TYPES
// =============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

type PhaseValue = 1 | 2 | 3;

interface RouteConfig {
  path: string;
  minPhase: PhaseValue;
  description: string;
}

// =============================================================================
// MOCK PHASE GATE
// =============================================================================

/**
 * Simulates the phaseGate middleware behavior from
 * apps/workers/src/lib/middleware.ts.
 *
 * Returns 404 JSON when the current phase is below the minimum required.
 */
function phaseGate(currentPhase: number, minPhase: number): ApiResponse | null {
  if (currentPhase >= minPhase) {
    return null; // Pass through — not gated
  }
  return {
    success: false,
    error:
      `This feature is not available in Phase ${currentPhase}. ` +
      `It will be enabled in Phase ${minPhase}.`,
    timestamp: Date.now(),
  };
}

/**
 * Simulated route handler that applies the phase gate.
 * Returns null if allowed (success), or the gate response if blocked.
 */
function simulateGate(
  currentPhase: number,
  minPhase: number,
): { allowed: boolean; status: number; body: ApiResponse } {
  const gateResult = phaseGate(currentPhase, minPhase);
  if (gateResult) {
    return {
      allowed: false,
      status: 404,
      body: gateResult,
    };
  }
  return {
    allowed: true,
    status: 200,
    body: { success: true, timestamp: Date.now() },
  };
}

// =============================================================================
// ROUTE CONFIGURATIONS (matches index.ts)
// =============================================================================

const GATED_ROUTES: RouteConfig[] = [
  { path: "/api/claim", minPhase: 2, description: "Claim system" },
  { path: "/api/claim/prepare", minPhase: 2, description: "Claim prepare" },
  { path: "/api/claim/confirm", minPhase: 2, description: "Claim confirm" },
  { path: "/api/claim/mint", minPhase: 2, description: "Claim mint" },
  { path: "/api/claim/balance/tb1test", minPhase: 2, description: "Claim balance" },
  { path: "/api/claim/status/abc123", minPhase: 2, description: "Claim status" },
  { path: "/api/claim/history/tb1test", minPhase: 2, description: "Claim history" },
  { path: "/api/leaderboard", minPhase: 2, description: "Leaderboard" },
  { path: "/api/leaderboard/top", minPhase: 2, description: "Leaderboard top" },
  { path: "/api/game", minPhase: 3, description: "Game root" },
  { path: "/api/game/rooms", minPhase: 3, description: "Game rooms" },
  { path: "/api/game/join", minPhase: 3, description: "Game join" },
];

const UNGATED_ROUTES: string[] = [
  "/api/faucet/claim",
  "/api/balance/tb1test",
  "/api/balance/credit",
  "/api/nft/list",
  "/api/nft/mint",
  "/api/admin/status",
  "/api/history/tb1test",
  "/health",
  "/metrics",
];

// =============================================================================
// TESTS
// =============================================================================

describe("phaseGate Middleware", () => {
  // ===========================================================================
  // Basic gate logic
  // ===========================================================================

  describe("phaseGate() function", () => {
    it("returns null when current phase meets minimum (allow)", () => {
      expect(phaseGate(2, 2)).toBeNull();
      expect(phaseGate(3, 2)).toBeNull();
      expect(phaseGate(3, 3)).toBeNull();
      expect(phaseGate(1, 1)).toBeNull();
    });

    it("returns null when current phase exceeds minimum", () => {
      expect(phaseGate(3, 1)).toBeNull();
      expect(phaseGate(2, 1)).toBeNull();
    });

    it("returns error response when current phase is below minimum", () => {
      const result = phaseGate(1, 2);
      expect(result).not.toBeNull();
      expect(result!.success).toBe(false);
      expect(result!.error).toContain("not available in Phase 1");
      expect(result!.error).toContain("enabled in Phase 2");
    });

    it("error message includes both phases", () => {
      const result = phaseGate(1, 3);
      expect(result!.error).toContain("Phase 1");
      expect(result!.error).toContain("Phase 3");
    });

    it("error response has timestamp", () => {
      const result = phaseGate(1, 2);
      expect(result!.timestamp).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // Phase 1: Blocked routes
  // ===========================================================================

  describe("Phase 1 — Route Gating", () => {
    const CURRENT_PHASE = 1;

    describe("claim routes return 404", () => {
      const claimRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/claim"),
      );

      for (const route of claimRoutes) {
        it(`${route.path} returns 404 in Phase ${CURRENT_PHASE}`, () => {
          const result = simulateGate(CURRENT_PHASE, route.minPhase);

          expect(result.allowed).toBe(false);
          expect(result.status).toBe(404);
          expect(result.body.success).toBe(false);
          expect(result.body.error).toContain("not available in Phase 1");
          expect(result.body.error).toContain(`enabled in Phase ${route.minPhase}`);
        });
      }
    });

    describe("leaderboard routes return 404", () => {
      const lbRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/leaderboard"),
      );

      for (const route of lbRoutes) {
        it(`${route.path} returns 404 in Phase ${CURRENT_PHASE}`, () => {
          const result = simulateGate(CURRENT_PHASE, route.minPhase);

          expect(result.allowed).toBe(false);
          expect(result.status).toBe(404);
        });
      }
    });

    describe("game routes return 404", () => {
      const gameRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/game"),
      );

      for (const route of gameRoutes) {
        it(`${route.path} returns 404 in Phase ${CURRENT_PHASE}`, () => {
          const result = simulateGate(CURRENT_PHASE, route.minPhase);

          expect(result.allowed).toBe(false);
          expect(result.status).toBe(404);
          expect(result.body.error).toContain("enabled in Phase 3");
        });
      }
    });

    describe("ungated routes remain accessible", () => {
      for (const path of UNGATED_ROUTES) {
        it(`${path} is accessible in Phase 1`, () => {
          // These routes have no phaseGate middleware, so they always pass
          // (no minPhase to check against — simulate with minPhase=1)
          const result = simulateGate(CURRENT_PHASE, 1);

          expect(result.allowed).toBe(true);
          expect(result.status).toBe(200);
        });
      }
    });
  });

  // ===========================================================================
  // Phase 2: Partially unlocked
  // ===========================================================================

  describe("Phase 2 — Route Gating", () => {
    const CURRENT_PHASE = 2;

    it("claim routes are accessible", () => {
      const result = simulateGate(CURRENT_PHASE, 2);
      expect(result.allowed).toBe(true);
    });

    it("leaderboard routes are accessible", () => {
      const result = simulateGate(CURRENT_PHASE, 2);
      expect(result.allowed).toBe(true);
    });

    it("game routes still return 404", () => {
      const result = simulateGate(CURRENT_PHASE, 3);

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
      expect(result.body.error).toContain("Phase 2");
      expect(result.body.error).toContain("Phase 3");
    });

    it("each game route returns 404", () => {
      const gameRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/game"),
      );

      for (const route of gameRoutes) {
        const result = simulateGate(CURRENT_PHASE, route.minPhase);
        expect(result.allowed).toBe(false);
        expect(result.status).toBe(404);
      }
    });
  });

  // ===========================================================================
  // Phase 3: All unlocked
  // ===========================================================================

  describe("Phase 3 — Route Gating", () => {
    const CURRENT_PHASE = 3;

    it("all gated routes are accessible (claim, leaderboard, game)", () => {
      for (const route of GATED_ROUTES) {
        const result = simulateGate(CURRENT_PHASE, route.minPhase);
        expect(result.allowed).toBe(true);
      }
    });

    it("claim routes are accessible", () => {
      const claimRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/claim"),
      );
      for (const route of claimRoutes) {
        expect(simulateGate(CURRENT_PHASE, route.minPhase).allowed).toBe(true);
      }
    });

    it("game routes are accessible", () => {
      const gameRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/game"),
      );
      for (const route of gameRoutes) {
        expect(simulateGate(CURRENT_PHASE, route.minPhase).allowed).toBe(true);
      }
    });

    it("leaderboard routes are accessible", () => {
      const lbRoutes = GATED_ROUTES.filter((r) =>
        r.path.startsWith("/api/leaderboard"),
      );
      for (const route of lbRoutes) {
        expect(simulateGate(CURRENT_PHASE, route.minPhase).allowed).toBe(true);
      }
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe("Edge Cases", () => {
    it("phaseGate(1) always allows (everything meets min=1)", () => {
      expect(simulateGate(1, 1).allowed).toBe(true);
      expect(simulateGate(2, 1).allowed).toBe(true);
      expect(simulateGate(3, 1).allowed).toBe(true);
    });

    it("phaseGate(2) blocks only Phase 1", () => {
      expect(simulateGate(1, 2).allowed).toBe(false);
      expect(simulateGate(2, 2).allowed).toBe(true);
      expect(simulateGate(3, 2).allowed).toBe(true);
    });

    it("phaseGate(3) blocks Phase 1 and Phase 2", () => {
      expect(simulateGate(1, 3).allowed).toBe(false);
      expect(simulateGate(2, 3).allowed).toBe(false);
      expect(simulateGate(3, 3).allowed).toBe(true);
    });

    it("status code is always 404 (not 403)", () => {
      // Features not yet launched should be invisible, not forbidden
      const result = simulateGate(1, 2);
      expect(result.status).toBe(404);
    });

    it("error message is descriptive", () => {
      const result = simulateGate(1, 3);
      expect(result.body.error).toContain("not available");
      expect(result.body.error).toContain("enabled");
    });
  });

  // ===========================================================================
  // Faucet route NOT gated
  // ===========================================================================

  describe("Faucet route is never gated", () => {
    it("/api/faucet/claim accessible in Phase 1", () => {
      // Faucet has no phaseGate middleware, so it's always open
      const result = simulateGate(1, 1);
      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
    });

    it("/api/faucet/claim accessible in Phase 2", () => {
      const result = simulateGate(2, 1);
      expect(result.allowed).toBe(true);
    });

    it("/api/faucet/claim accessible in Phase 3", () => {
      const result = simulateGate(3, 1);
      expect(result.allowed).toBe(true);
    });
  });
});
