/**
 * ============================================================================
 * BITCOINBABY CENTRALIZED CONSTANTS
 * ============================================================================
 *
 * This is the SINGLE SOURCE OF TRUTH for configuration values.
 * All hardcoded values should be defined here, not scattered in code.
 *
 * GUIDE: Where to find what
 * -------------------------
 *
 * 1. RETRY & BACKOFF (retry-config.ts)
 *    - RETRY_DELAYS: API retry timing [1s, 2s, 5s...]
 *    - CIRCUIT_BREAKER_DELAYS: Service outage backoff
 *    - getRetryDelay(): Helper to get delay for attempt N
 *    - exponentialBackoff(): Calculate backoff with jitter
 *
 * 2. POLLING & TIMING (polling.ts)
 *    - SYNC_INTERVALS: Background sync timing (shares, balance, NFTs)
 *    - UI_TIMING: Toast duration, copy feedback, debounce
 *    - TIMEOUTS: API requests, transactions, WebSocket
 *
 * 3. APP IDENTIFIERS (app-ids.ts)
 *    - NFT_APP_IDS: Collection identifiers ("genesis-babies")
 *    - TOKEN_APP_IDS: Token identifiers
 *    - MINER_IDS: Component miner identifiers
 *    - DEFAULT_NFT_APP_ID: Default for hooks
 *
 * 4. MINING CONFIG (mining.ts)
 *    - THROTTLE_LEVELS: Power management (100%, 50%, 25%)
 *    - BATCH_CONFIG: WebGPU batch timing
 *    - RECOVERY_CONFIG: Error recovery backoff
 *    - STATS_CONFIG: UI update throttling
 *    - TAB_COORDINATION: Multi-tab leadership
 *
 * 5. TOKENOMICS (../tokenomics/constants.ts)
 *    - MIN_DIFFICULTY: Minimum mining difficulty (D22)
 *    - BASE_REWARD_PER_SHARE: Base reward (100 $BABY)
 *    - calculateShareReward(): Reward for difficulty
 *    - STREAK_BONUSES: Consecutive mining bonuses
 *
 * USAGE EXAMPLE:
 * ```typescript
 * import {
 *   RETRY_DELAYS,
 *   SYNC_INTERVALS,
 *   MIN_DIFFICULTY,
 *   DEFAULT_NFT_APP_ID,
 * } from "@bitcoinbaby/core";
 *
 * // Use centralized values instead of magic numbers
 * const delay = RETRY_DELAYS.standard[attempt];
 * setInterval(refresh, SYNC_INTERVALS.balanceRefresh);
 * ```
 *
 * ADDING NEW CONSTANTS:
 * 1. Choose the appropriate file based on category
 * 2. Add with JSDoc documentation
 * 3. Export from this index
 * 4. Update this guide if adding new category
 *
 * ============================================================================
 */

// Retry & Backoff Configuration
export {
  RETRY_DELAYS,
  CIRCUIT_BREAKER_DELAYS,
  getRetryDelay,
  exponentialBackoff,
} from "./retry-config";

// Polling & Timing Configuration
export { SYNC_INTERVALS, UI_TIMING, TIMEOUTS } from "./polling";

// Application Identifiers
export {
  NFT_APP_IDS,
  TOKEN_APP_IDS,
  MINER_IDS,
  DEFAULT_NFT_APP_ID,
} from "./app-ids";

// Mining Configuration
export {
  THROTTLE_LEVELS,
  BATCH_CONFIG,
  RECOVERY_CONFIG,
  STATS_CONFIG,
  PERSISTENCE_CONFIG,
  TAB_COORDINATION,
} from "./mining";

// Tokenomics Constants (re-exported for convenience)
// Primary source: ../tokenomics/constants.ts
export {
  MIN_DIFFICULTY,
  BASE_REWARD_PER_SHARE,
  calculateShareReward,
  calculateRewardWithStreak,
  getStreakMultiplier,
  STREAK_BONUSES,
  TOTAL_SUPPLY,
  DECIMALS,
} from "../tokenomics/constants";
