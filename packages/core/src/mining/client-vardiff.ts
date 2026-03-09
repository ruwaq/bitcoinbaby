/**
 * Client-side Variable Difficulty (VarDiff)
 *
 * Automatically adjusts mining difficulty based on local hashrate.
 * This prevents the dependency on server VarDiff responses which can
 * be blocked by circuit breakers during rate limiting.
 *
 * The client VarDiff:
 * 1. Estimates initial difficulty from detected hashrate
 * 2. Continuously monitors share times and adjusts difficulty
 * 3. Works independently of server communication
 */

import { MIN_DIFFICULTY, MAX_DIFFICULTY } from "../tokenomics/constants";

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface ClientVarDiffConfig {
  /** Target time between shares in seconds */
  targetShareTime: number;
  /** Variance allowed before adjustment (0.3 = ±30%) */
  variancePercent: number;
  /** Minimum difficulty */
  minDiff: number;
  /** Maximum difficulty */
  maxDiff: number;
  /** Number of shares before retargeting */
  retargetShares: number;
  /** Minimum samples before adjusting */
  minSamples: number;
  /** Hashrate stability threshold (hashes before trusting hashrate) */
  hashrateStabilityThreshold: number;
}

export const DEFAULT_CLIENT_VARDIFF_CONFIG: ClientVarDiffConfig = {
  targetShareTime: 3, // 1 share every 3 seconds (matches server)
  variancePercent: 0.3, // ±30% acceptable
  minDiff: MIN_DIFFICULTY, // D22
  maxDiff: MAX_DIFFICULTY, // D32
  retargetShares: 5, // Retarget every 5 shares (reduced from 10 for faster warmup)
  minSamples: 3, // Need at least 3 samples
  hashrateStabilityThreshold: 10_000_000, // 10M hashes (~0.2s at 57 MH/s) before trusting hashrate
};

// =============================================================================
// STATE
// =============================================================================

export interface ClientVarDiffState {
  /** Current difficulty */
  currentDiff: number;
  /** Recent share timestamps for timing calculations */
  recentShareTimes: number[];
  /** Shares since last retarget */
  sharesSinceRetarget: number;
  /** Has initial difficulty been set from hashrate? */
  initialDifficultySet: boolean;
  /** Last known stable hashrate */
  lastStableHashrate: number;
  /** Total hashes when hashrate was considered stable */
  hashesAtStabilization: number;
}

export function createInitialClientVarDiffState(): ClientVarDiffState {
  return {
    currentDiff: MIN_DIFFICULTY,
    recentShareTimes: [],
    sharesSinceRetarget: 0,
    initialDifficultySet: false,
    lastStableHashrate: 0,
    hashesAtStabilization: 0,
  };
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Estimate optimal difficulty based on hashrate
 *
 * Formula: D = log2(hashrate * targetTime)
 *
 * For hashrate H and target time T seconds:
 * - Expected hashes per share at difficulty D = 2^D
 * - Shares per second = H / 2^D
 * - Time per share = 2^D / H
 * - We want time per share = T
 * - So 2^D / H = T → D = log2(H * T)
 *
 * @param hashrate - Hashrate in H/s
 * @param targetTime - Target time between shares in seconds
 * @param config - VarDiff configuration
 * @returns Estimated optimal difficulty
 */
export function estimateDifficultyFromHashrate(
  hashrate: number,
  targetTime: number = DEFAULT_CLIENT_VARDIFF_CONFIG.targetShareTime,
  config: ClientVarDiffConfig = DEFAULT_CLIENT_VARDIFF_CONFIG,
): number {
  if (hashrate <= 0) return config.minDiff;

  // D = log2(hashrate * targetTime)
  const estimatedDiff = Math.log2(hashrate * targetTime);

  // Round and clamp to valid range
  const clampedDiff = Math.max(
    config.minDiff,
    Math.min(config.maxDiff, Math.round(estimatedDiff)),
  );

  return clampedDiff;
}

/**
 * Check if hashrate is stable enough to trust for difficulty estimation
 *
 * @param totalHashes - Total hashes mined so far
 * @param config - VarDiff configuration
 * @returns true if hashrate should be trusted
 */
export function isHashrateStable(
  totalHashes: number,
  config: ClientVarDiffConfig = DEFAULT_CLIENT_VARDIFF_CONFIG,
): boolean {
  return totalHashes >= config.hashrateStabilityThreshold;
}

/**
 * Process a new share and determine if difficulty should change
 *
 * @param state - Current VarDiff state
 * @param shareTime - Timestamp of the share
 * @param config - VarDiff configuration
 * @returns Updated state and adjustment info
 */
export function processShareForVarDiff(
  state: ClientVarDiffState,
  shareTime: number,
  config: ClientVarDiffConfig = DEFAULT_CLIENT_VARDIFF_CONFIG,
): {
  state: ClientVarDiffState;
  adjustment: {
    changed: boolean;
    newDifficulty: number;
    reason: string;
    averageShareTime: number;
  };
} {
  const newState = { ...state };
  newState.recentShareTimes = [...state.recentShareTimes, shareTime].slice(-20);
  newState.sharesSinceRetarget = state.sharesSinceRetarget + 1;

  // Default: no change
  const noChange = {
    state: newState,
    adjustment: {
      changed: false,
      newDifficulty: state.currentDiff,
      reason: "Not enough data",
      averageShareTime: config.targetShareTime,
    },
  };

  // Need at least minSamples to calculate
  if (newState.recentShareTimes.length < config.minSamples) {
    return noChange;
  }

  // Only retarget every N shares
  if (newState.sharesSinceRetarget < config.retargetShares) {
    return noChange;
  }

  // Calculate time differences between shares
  const timeDiffs: number[] = [];
  for (let i = 1; i < newState.recentShareTimes.length; i++) {
    const diff =
      (newState.recentShareTimes[i] - newState.recentShareTimes[i - 1]) / 1000;
    if (diff > 0 && diff < 300) {
      // Ignore outliers > 5 minutes
      timeDiffs.push(diff);
    }
  }

  if (timeDiffs.length < config.minSamples) {
    return noChange;
  }

  // Use median for robustness against outliers
  timeDiffs.sort((a, b) => a - b);
  const medianTime = timeDiffs[Math.floor(timeDiffs.length / 2)];

  // Check if we're within acceptable variance
  const minAcceptable = config.targetShareTime * (1 - config.variancePercent);
  const maxAcceptable = config.targetShareTime * (1 + config.variancePercent);

  let newDiff = state.currentDiff;
  let reason = "Within target range";
  let changed = false;

  if (medianTime < minAcceptable) {
    // Shares too fast → increase difficulty
    const ratio = config.targetShareTime / medianTime;
    const diffIncrease = Math.log2(ratio);
    // Allow up to +4 per adjustment for faster warmup (was +2)
    newDiff = Math.min(
      config.maxDiff,
      state.currentDiff + Math.min(Math.ceil(diffIncrease), 4),
    );
    if (newDiff !== state.currentDiff) {
      changed = true;
      reason = `Shares too fast (${medianTime.toFixed(2)}s avg, target ${config.targetShareTime}s)`;
    }
  } else if (medianTime > maxAcceptable) {
    // Shares too slow → decrease difficulty
    const ratio = medianTime / config.targetShareTime;
    const diffDecrease = Math.log2(ratio);
    // Keep -2 max for decreasing (conservative)
    newDiff = Math.max(
      config.minDiff,
      state.currentDiff - Math.min(Math.ceil(diffDecrease), 2),
    );
    if (newDiff !== state.currentDiff) {
      changed = true;
      reason = `Shares too slow (${medianTime.toFixed(2)}s avg, target ${config.targetShareTime}s)`;
    }
  }

  // Reset retarget counter if we made a decision
  newState.sharesSinceRetarget = 0;
  newState.currentDiff = newDiff;

  return {
    state: newState,
    adjustment: {
      changed,
      newDifficulty: newDiff,
      reason,
      averageShareTime: medianTime,
    },
  };
}

/**
 * Update state with hashrate-based initial difficulty
 *
 * Called when hashrate becomes stable to set a good starting difficulty.
 * This is crucial for high-hashrate miners (GPU) to avoid rate limiting.
 *
 * @param state - Current VarDiff state
 * @param hashrate - Detected hashrate in H/s
 * @param totalHashes - Total hashes mined so far
 * @param config - VarDiff configuration
 * @returns Updated state with initial difficulty
 */
export function setInitialDifficultyFromHashrate(
  state: ClientVarDiffState,
  hashrate: number,
  totalHashes: number,
  config: ClientVarDiffConfig = DEFAULT_CLIENT_VARDIFF_CONFIG,
): {
  state: ClientVarDiffState;
  newDifficulty: number;
  changed: boolean;
} {
  // Already set or hashrate not stable
  if (state.initialDifficultySet || !isHashrateStable(totalHashes, config)) {
    return {
      state,
      newDifficulty: state.currentDiff,
      changed: false,
    };
  }

  const optimalDiff = estimateDifficultyFromHashrate(
    hashrate,
    config.targetShareTime,
    config,
  );

  // Only update if significantly different from current
  if (Math.abs(optimalDiff - state.currentDiff) < 2) {
    return {
      state: {
        ...state,
        initialDifficultySet: true,
        lastStableHashrate: hashrate,
        hashesAtStabilization: totalHashes,
      },
      newDifficulty: state.currentDiff,
      changed: false,
    };
  }

  const newState: ClientVarDiffState = {
    ...state,
    currentDiff: optimalDiff,
    initialDifficultySet: true,
    lastStableHashrate: hashrate,
    hashesAtStabilization: totalHashes,
    // Reset share times since difficulty changed
    recentShareTimes: [],
    sharesSinceRetarget: 0,
  };

  return {
    state: newState,
    newDifficulty: optimalDiff,
    changed: true,
  };
}

// =============================================================================
// DEVICE PRESETS (for quick estimation without measuring)
// =============================================================================

export const DEVICE_HASHRATE_PRESETS = {
  /** Low-end phone: ~500 H/s to 1 KH/s */
  phone_low: 500,
  /** Mid-range phone: ~5-10 KH/s */
  phone_mid: 7_500,
  /** High-end phone: ~10-30 KH/s */
  phone_high: 20_000,
  /** Laptop CPU: ~50-200 KH/s */
  laptop: 100_000,
  /** Desktop CPU: ~200-500 KH/s */
  desktop: 350_000,
  /** Entry GPU (integrated/low-end): ~1-5 MH/s */
  gpu_low: 3_000_000,
  /** Mid-range GPU: ~10-30 MH/s */
  gpu_mid: 20_000_000,
  /** High-end GPU: ~50-100+ MH/s */
  gpu_high: 70_000_000,
} as const;

/**
 * Get difficulty recommendation for device type
 */
export function getDifficultyForDevice(
  device: keyof typeof DEVICE_HASHRATE_PRESETS,
): number {
  return estimateDifficultyFromHashrate(DEVICE_HASHRATE_PRESETS[device]);
}

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Calculate expected shares per hour at given hashrate and difficulty
 */
export function expectedSharesPerHour(
  hashrate: number,
  difficulty: number,
): number {
  const hashesPerShare = Math.pow(2, difficulty);
  const sharesPerSecond = hashrate / hashesPerShare;
  return sharesPerSecond * 3600;
}

/**
 * Check if hashrate/difficulty combo will hit rate limits
 */
export function willHitRateLimit(
  hashrate: number,
  difficulty: number,
  maxSharesPerHour: number = 1500,
): boolean {
  return expectedSharesPerHour(hashrate, difficulty) > maxSharesPerHour;
}

/**
 * Get minimum safe difficulty for hashrate to avoid rate limits
 */
export function getMinSafeDifficulty(
  hashrate: number,
  maxSharesPerHour: number = 1500,
): number {
  // shares/hr = (hashrate * 3600) / 2^D
  // maxShares = (hashrate * 3600) / 2^D
  // 2^D = (hashrate * 3600) / maxShares
  // D = log2((hashrate * 3600) / maxShares)

  const minDiff = Math.ceil(Math.log2((hashrate * 3600) / maxSharesPerHour));

  return Math.max(MIN_DIFFICULTY, minDiff);
}
