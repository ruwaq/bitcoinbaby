/**
 * Phase Configuration System
 *
 * Controls which features are active based on NEXT_PUBLIC_PHASE env var.
 *
 * Phase 1: NFTs + Faucet (no mining, no game)
 * Phase 2: Mining + Leaderboard
 * Phase 3: Full Game + On-chain Evolution
 *
 * Features are tree-shakeable — when NEXT_PUBLIC_PHASE is inlined at build time,
 * feature flags become compile-time constants and dead code is eliminated.
 *
 * @example
 * import { getPhaseConfig, PHASES, phaseGate, PHASE_FEATURES } from '@bitcoinbaby/shared/config';
 *
 * // Check features (tree-shakeable)
 * if (PHASE_FEATURES.mining) { ... }
 *
 * // Full config object
 * const { phase, features, visibleTabs, defaultTab } = getPhaseConfig();
 *
 * // Server-side route gating
 * const gate = phaseGate(PHASES.MINING);
 * if (!gate.allowed) return new Response(gate.reason, { status: 403 });
 */

// =============================================================================
// PHASE CONSTANTS
// =============================================================================

export const PHASES = {
  NFTS: 1,
  MINING: 2,
  GAME: 3,
} as const;

export type Phase = (typeof PHASES)[keyof typeof PHASES];

// =============================================================================
// TAB TYPE
// =============================================================================

/**
 * Tab identifiers used in the app navigation.
 * Matches the TabType from apps/web TabNavigation component.
 */
export type TabType = "token" | "mining" | "nfts" | "wallet" | "more";

// =============================================================================
// CURRENT PHASE DETECTION
// =============================================================================

// Safe process.env access that works in all environments
declare const process: { env?: Record<string, string | undefined> } | undefined;

/**
 * Read NEXT_PUBLIC_PHASE from environment.
 *
 * In Next.js, NEXT_PUBLIC_* vars are inlined at build time as string literals.
 * This means the result becomes a compile-time constant, enabling tree-shaking
 * of feature-gated code paths.
 *
 * Defaults to Phase 1 (NFTs) if unset or invalid.
 */
function readPhaseEnv(): Phase {
  if (typeof process !== "undefined" && process?.env) {
    const raw = process.env.NEXT_PUBLIC_PHASE || process.env.PHASE;
    if (raw === "1") return PHASES.NFTS;
    if (raw === "2") return PHASES.MINING;
    if (raw === "3") return PHASES.GAME;
    if (raw) {
      console.warn(
        `[PHASES] Invalid NEXT_PUBLIC_PHASE value: "${raw}". ` +
          `Valid values: 1, 2, 3. Defaulting to Phase 1.`,
      );
    }
  }
  return PHASES.NFTS;
}

/**
 * Current phase — evaluated once at module load.
 *
 * When NEXT_PUBLIC_PHASE is inlined by Next.js at build time,
 * this becomes a compile-time constant (1, 2, or 3) and the
 * feature checks below are fully static.
 */
const CURRENT_PHASE: Phase = readPhaseEnv();

// =============================================================================
// FEATURE FLAGS (tree-shakeable)
// =============================================================================

/** Individual features controlled by the phase system */
export interface PhaseFeatures {
  // NFT features (Phase 1+)
  nftMinting: boolean;
  nftMarketplace: boolean;
  /** Virtual evolution in Phase 1, on-chain in Phase 3 */
  nftEvolution: boolean;

  // Faucet (Phase 1+)
  babtcFaucet: boolean;

  // Mining features (Phase 2+)
  mining: boolean;
  miningClaim: boolean;

  // Leaderboard (Phase 2+)
  leaderboard: boolean;

  // Game features (Phase 3+)
  game: boolean;
  /** Full on-chain evolution (Phase 3 only) */
  onChainEvolution: boolean;
}

/**
 * Feature flags derived from the current phase.
 *
 * These are compile-time constants when NEXT_PUBLIC_PHASE is inlined
 * at build time, allowing bundlers to eliminate dead code:
 *
 *   if (PHASE_FEATURES.mining) { ... }  // eliminated in Phase 1
 */
export const PHASE_FEATURES: PhaseFeatures = {
  // Phase 1+ features (always available)
  nftMinting: true,
  nftMarketplace: true,
  nftEvolution: true,
  babtcFaucet: true,

  // Phase 2+ features
  mining: CURRENT_PHASE >= PHASES.MINING,
  miningClaim: CURRENT_PHASE >= PHASES.MINING,
  leaderboard: CURRENT_PHASE >= PHASES.MINING,

  // Phase 3+ features
  game: CURRENT_PHASE >= PHASES.GAME,
  onChainEvolution: CURRENT_PHASE >= PHASES.GAME,
};

// =============================================================================
// PHASE CONFIG
// =============================================================================

export interface PhaseConfig {
  /** Current active phase number */
  phase: Phase;
  /** Human-readable name for the current phase */
  name: string;
  /** Feature flags (same as PHASE_FEATURES for convenience) */
  features: PhaseFeatures;
  /** Default tab when app loads */
  defaultTab: TabType;
  /** Tabs visible in the navigation for this phase */
  visibleTabs: TabType[];
}

// =============================================================================
// PHASE DEFINITIONS
// =============================================================================

const PHASE_CONFIGS: Record<Phase, Omit<PhaseConfig, "features">> = {
  [PHASES.NFTS]: {
    phase: PHASES.NFTS,
    name: "NFTs + Faucet",
    defaultTab: "nfts",
    visibleTabs: ["token", "nfts", "wallet", "more"],
  },
  [PHASES.MINING]: {
    phase: PHASES.MINING,
    name: "Mining",
    defaultTab: "token",
    visibleTabs: ["token", "mining", "nfts", "wallet", "more"],
  },
  [PHASES.GAME]: {
    phase: PHASES.GAME,
    name: "Game",
    defaultTab: "token",
    visibleTabs: ["token", "mining", "nfts", "wallet", "more"],
  },
};

// =============================================================================
// CONFIGURATION GETTER
// =============================================================================

/**
 * Get the full phase configuration.
 *
 * Combines static phase metadata with the feature flags derived
 * from NEXT_PUBLIC_PHASE.
 *
 * @example
 * const { phase, features, visibleTabs, defaultTab } = getPhaseConfig();
 * if (features.mining) { ... }
 */
export function getPhaseConfig(): PhaseConfig {
  const base = PHASE_CONFIGS[CURRENT_PHASE];
  return {
    ...base,
    features: PHASE_FEATURES,
  };
}

// =============================================================================
// CLIENT-SIDE HOOK
// =============================================================================

/**
 * React hook for accessing phase configuration on the client.
 *
 * Returns the same static config as getPhaseConfig(). In Next.js,
 * NEXT_PUBLIC_PHASE is inlined at build time so the result is constant.
 *
 * For memoization in hot-module-replacement scenarios, wrap with useMemo:
 *   const config = useMemo(() => usePhase(), []);
 *
 * @example
 * import { usePhase } from '@bitcoinbaby/shared/config';
 *
 * function MyComponent() {
 *   const { features, visibleTabs } = usePhase();
 *   if (!features.mining) return null;
 *   return <MiningPanel />;
 * }
 */
export function usePhase(): PhaseConfig {
  return getPhaseConfig();
}

// =============================================================================
// SERVER-SIDE PHASE GATE
// =============================================================================

export interface PhaseGateResult {
  /** Whether the request is allowed for the current phase */
  allowed: boolean;
  /** Human-readable reason if not allowed */
  reason?: string;
}

/**
 * Server-side route gating — check if the current phase meets the minimum required.
 *
 * Use in API routes or middleware to block access to features not yet launched.
 *
 * @param minPhase - Minimum phase required for the route/feature
 * @returns PhaseGateResult with allowed flag and optional reason
 *
 * @example
 * import { phaseGate, PHASES } from '@bitcoinbaby/shared/config';
 *
 * export async function POST(request: Request) {
 *   const gate = phaseGate(PHASES.MINING);
 *   if (!gate.allowed) {
 *     return Response.json({ error: gate.reason }, { status: 403 });
 *   }
 *   // ... mining logic
 * }
 */
export function phaseGate(minPhase: Phase): PhaseGateResult {
  if (CURRENT_PHASE >= minPhase) {
    return { allowed: true };
  }

  const phaseNames: Record<Phase, string> = {
    [PHASES.NFTS]: "NFTs + Faucet",
    [PHASES.MINING]: "Mining",
    [PHASES.GAME]: "Game",
  };

  return {
    allowed: false,
    reason:
      `This feature requires Phase ${minPhase} (${phaseNames[minPhase]}). ` +
      `Current phase: Phase ${CURRENT_PHASE} (${phaseNames[CURRENT_PHASE]}).`,
  };
}
