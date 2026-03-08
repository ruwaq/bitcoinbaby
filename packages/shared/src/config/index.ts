/**
 * Shared Configuration
 *
 * Centralized configuration for the BitcoinBaby ecosystem.
 * Import from here instead of hardcoding values.
 *
 * @example
 * import { getWorkersApiUrl, HTTP_TIMEOUTS, getCachedConfig } from '@bitcoinbaby/shared/config';
 *
 * const apiUrl = getWorkersApiUrl();
 * const timeout = HTTP_TIMEOUTS.STANDARD;
 * const config = getCachedConfig();
 */

// API Configuration
export {
  type Environment,
  type ApiEndpoints,
  WORKERS_API,
  PROVER_API,
  detectEnvironment,
  isProduction,
  isDevelopment,
  getWorkersApiUrl,
  getProverUrl,
  getApiEndpoints,
} from "./api";

// HTTP Configuration
export {
  HTTP_TIMEOUTS,
  RETRY_CONFIG,
  NO_RETRY,
  RATE_LIMIT,
  POLL_INTERVALS,
  CACHE_TTL,
  DEFAULT_HTTP_CONFIG,
  ATOMIC_HTTP_CONFIG,
  LONG_HTTP_CONFIG,
} from "./http";

// Environment Configuration
export {
  type EnvironmentConfig,
  isProduction as isProd,
  isDevelopment as isDev,
  isTest,
  getEnvironmentConfig,
  getConfig,
  getCachedConfig,
  clearConfigCache,
} from "./environment";

// Mining Configuration
export {
  MIN_DIFFICULTY,
  MAX_DIFFICULTY,
  BASE_REWARD_PER_SHARE,
  MAX_REWARD_PER_SHARE,
  MAX_SHARES_PER_HOUR,
  MIN_SHARE_INTERVAL_MS,
  MAX_PROOF_AGE_MS,
  STREAK_RESET_MS,
  STREAK_TIERS,
  STREAK_MULTIPLIERS,
  getStreakMultiplier,
  VARDIFF_CONFIG,
} from "./mining";
