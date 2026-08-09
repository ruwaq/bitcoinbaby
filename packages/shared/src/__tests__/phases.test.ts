/**
 * Phase Configuration Tests
 *
 * Tests for getPhaseConfig(), PHASE_FEATURES, phaseGate(),
 * visibleTabs, and defaultTab across all phases.
 *
 * The phase module reads process.env.NEXT_PUBLIC_PHASE at
 * import time, so we must reset modules and stub env before
 * each import.
 */

import { describe, it, expect, beforeAll, vi } from "vitest";

// Types we expect from the phase module
interface PhaseFeatures {
  nftMinting: boolean;
  nftMarketplace: boolean;
  nftEvolution: boolean;
  babtcFaucet: boolean;
  mining: boolean;
  miningClaim: boolean;
  leaderboard: boolean;
  game: boolean;
  onChainEvolution: boolean;
}

interface PhaseConfig {
  phase: number;
  name: string;
  features: PhaseFeatures;
  defaultTab: string;
  visibleTabs: string[];
}

interface PhaseGateResult {
  allowed: boolean;
  reason?: string;
}

type PhaseModule = {
  PHASES: Record<string, number>;
  PHASE_FEATURES: PhaseFeatures;
  getPhaseConfig: () => PhaseConfig;
  phaseGate: (minPhase: number) => PhaseGateResult;
  usePhase: () => PhaseConfig;
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Dynamic import of the phases module with a clean module cache.
 * Must be called after vi.stubEnv to set the desired phase.
 */
async function importPhasesModule(): Promise<PhaseModule> {
  // Clear module cache so CURRENT_PHASE is re-evaluated
  vi.resetModules();
  // Dynamic import picks up the stubbed env
  return await import("../config/phases");
}

// =============================================================================
// PHASE 1 TESTS (NFTs + Faucet)
// =============================================================================

describe("Phase 1 (NFTs + Faucet)", () => {
  let mod: PhaseModule;

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "1");
    // Also unset PHASE to ensure NEXT_PUBLIC_PHASE is used
    vi.stubEnv("PHASE", undefined as unknown as string);
    mod = await importPhasesModule();
  });

  // --- getPhaseConfig ---

  describe("getPhaseConfig()", () => {
    it("returns phase=1 with correct name", () => {
      const config = mod.getPhaseConfig();
      expect(config.phase).toBe(1);
      expect(config.name).toBe("NFTs + Faucet");
    });

    it("enables nftMinting, nftMarketplace, nftEvolution", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.nftMinting).toBe(true);
      expect(config.features.nftMarketplace).toBe(true);
      expect(config.features.nftEvolution).toBe(true);
    });

    it("enables babtcFaucet", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.babtcFaucet).toBe(true);
    });

    it("disables mining, miningClaim", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.mining).toBe(false);
      expect(config.features.miningClaim).toBe(false);
    });

    it("disables leaderboard", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.leaderboard).toBe(false);
    });

    it("disables game and onChainEvolution", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.game).toBe(false);
      expect(config.features.onChainEvolution).toBe(false);
    });

    it("sets defaultTab to 'home'", () => {
      const config = mod.getPhaseConfig();
      expect(config.defaultTab).toBe("home");
    });

    it("has correct visibleTabs", () => {
      const config = mod.getPhaseConfig();
      expect(config.visibleTabs).toEqual(["home", "explore", "you"]);
    });
  });

  // --- PHASE_FEATURES ---

  describe("PHASE_FEATURES", () => {
    it("matches getPhaseConfig().features", () => {
      const config = mod.getPhaseConfig();
      expect(mod.PHASE_FEATURES).toEqual(config.features);
    });
  });

  // --- phaseGate ---

  describe("phaseGate()", () => {
    it("allows Phase 1 features (minPhase=1)", () => {
      const result = mod.phaseGate(1);
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("blocks Phase 2 features (minPhase=2)", () => {
      const result = mod.phaseGate(2);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("requires Phase 2");
      expect(result.reason).toContain("Current phase: Phase 1");
    });

    it("blocks Phase 3 features (minPhase=3)", () => {
      const result = mod.phaseGate(3);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("requires Phase 3");
      expect(result.reason).toContain("Current phase: Phase 1");
    });
  });

  // --- usePhase ---

  describe("usePhase()", () => {
    it("returns same config as getPhaseConfig()", () => {
      expect(mod.usePhase()).toEqual(mod.getPhaseConfig());
    });
  });
});

// =============================================================================
// PHASE 2 TESTS (Mining)
// =============================================================================

describe("Phase 2 (Mining)", () => {
  let mod: PhaseModule;

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "2");
    vi.stubEnv("PHASE", undefined as unknown as string);
    mod = await importPhasesModule();
  });

  describe("getPhaseConfig()", () => {
    it("returns phase=2 with correct name", () => {
      const config = mod.getPhaseConfig();
      expect(config.phase).toBe(2);
      expect(config.name).toBe("Mining");
    });

    it("enables Phase 1+ features (NFTs + faucet)", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.nftMinting).toBe(true);
      expect(config.features.nftMarketplace).toBe(true);
      expect(config.features.nftEvolution).toBe(true);
      expect(config.features.babtcFaucet).toBe(true);
    });

    it("enables mining and miningClaim", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.mining).toBe(true);
      expect(config.features.miningClaim).toBe(true);
    });

    it("enables leaderboard", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.leaderboard).toBe(true);
    });

    it("disables game and onChainEvolution", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.game).toBe(false);
      expect(config.features.onChainEvolution).toBe(false);
    });

    it("sets defaultTab to 'home'", () => {
      const config = mod.getPhaseConfig();
      expect(config.defaultTab).toBe("home");
    });

    it("has correct visibleTabs with mining", () => {
      const config = mod.getPhaseConfig();
      expect(config.visibleTabs).toEqual(["home", "explore", "you"]);
    });
  });

  describe("phaseGate()", () => {
    it("allows Phase 1 features (minPhase=1)", () => {
      expect(mod.phaseGate(1).allowed).toBe(true);
    });

    it("allows Phase 2 features (minPhase=2)", () => {
      expect(mod.phaseGate(2).allowed).toBe(true);
    });

    it("blocks Phase 3 features (minPhase=3)", () => {
      const result = mod.phaseGate(3);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("requires Phase 3");
      expect(result.reason).toContain("Current phase: Phase 2");
    });
  });
});

// =============================================================================
// PHASE 3 TESTS (Full Game)
// =============================================================================

describe("Phase 3 (Game)", () => {
  let mod: PhaseModule;

  beforeAll(async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "3");
    vi.stubEnv("PHASE", undefined as unknown as string);
    mod = await importPhasesModule();
  });

  describe("getPhaseConfig()", () => {
    it("returns phase=3 with correct name", () => {
      const config = mod.getPhaseConfig();
      expect(config.phase).toBe(3);
      expect(config.name).toBe("Game");
    });

    it("enables all features", () => {
      const config = mod.getPhaseConfig();
      expect(config.features.nftMinting).toBe(true);
      expect(config.features.nftMarketplace).toBe(true);
      expect(config.features.nftEvolution).toBe(true);
      expect(config.features.babtcFaucet).toBe(true);
      expect(config.features.mining).toBe(true);
      expect(config.features.miningClaim).toBe(true);
      expect(config.features.leaderboard).toBe(true);
      expect(config.features.game).toBe(true);
      expect(config.features.onChainEvolution).toBe(true);
    });

    it("sets defaultTab to 'home'", () => {
      expect(mod.getPhaseConfig().defaultTab).toBe("home");
    });

    it("has all tabs visible", () => {
      const config = mod.getPhaseConfig();
      expect(config.visibleTabs).toEqual(["home", "explore", "you"]);
    });
  });

  describe("phaseGate()", () => {
    it("allows all phases (1, 2, 3)", () => {
      expect(mod.phaseGate(1).allowed).toBe(true);
      expect(mod.phaseGate(2).allowed).toBe(true);
      expect(mod.phaseGate(3).allowed).toBe(true);
    });
  });
});

// =============================================================================
// EDGE CASES
// =============================================================================

describe("Edge Cases", () => {
  it("defaults to Phase 1 when env is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", undefined as unknown as string);
    vi.stubEnv("PHASE", undefined as unknown as string);
    const mod = await importPhasesModule();

    const config = mod.getPhaseConfig();
    expect(config.phase).toBe(1);
    expect(config.name).toBe("NFTs + Faucet");
  });

  it("defaults to Phase 1 for invalid phase value", async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "99");
    vi.stubEnv("PHASE", undefined as unknown as string);
    const mod = await importPhasesModule();

    const config = mod.getPhaseConfig();
    expect(config.phase).toBe(1);
  });

  it("defaults to Phase 1 for non-numeric phase value", async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "not-a-number");
    vi.stubEnv("PHASE", undefined as unknown as string);
    const mod = await importPhasesModule();

    const config = mod.getPhaseConfig();
    expect(config.phase).toBe(1);
  });

  it("uses PHASE env var as fallback when NEXT_PUBLIC_PHASE is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", undefined as unknown as string);
    vi.stubEnv("PHASE", "2");
    const mod = await importPhasesModule();

    const config = mod.getPhaseConfig();
    expect(config.phase).toBe(2);
    expect(config.features.mining).toBe(true);
  });

  it("prefers NEXT_PUBLIC_PHASE over PHASE when both are set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PHASE", "3");
    vi.stubEnv("PHASE", "1");
    const mod = await importPhasesModule();

    const config = mod.getPhaseConfig();
    expect(config.phase).toBe(3);
    expect(config.features.game).toBe(true);
  });

  it("phaseGate reason includes phase names", () => {
    // Use Phase 1 to test gate blocking
    vi.stubEnv("NEXT_PUBLIC_PHASE", "1");
    vi.stubEnv("PHASE", undefined as unknown as string);
    // Re-import to get Phase 1
    return importPhasesModule().then((mod) => {
      const result = mod.phaseGate(2);
      expect(result.reason).toContain("Mining");
      expect(result.reason).toContain("NFTs + Faucet");
    });
  });
});
