/**
 * Environment Configuration
 *
 * Centralized environment variable access with type safety
 * and fallback handling.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface EnvironmentConfig {
  // API URLs
  workersApiUrl: string;
  proverUrl: string;

  // Smart Contract IDs
  babtcAppId: string;
  gbabyAppId: string;
  babtcAppVk: string;
  gbabyAppVk: string;

  // Feature flags
  isProduction: boolean;
  isDevelopment: boolean;
  isTest: boolean;

  // Debug
  enableDebug: boolean;
}

// =============================================================================
// ENVIRONMENT GETTERS
// =============================================================================

// Safe process.env access that works in all environments
declare const process: { env?: Record<string, string | undefined> } | undefined;

/**
 * Get environment variable with fallback
 * Handles both NEXT_PUBLIC_ and server-side variants
 */
function getEnv(
  key: string,
  fallback: string = "",
  options?: { required?: boolean },
): string {
  if (typeof process === "undefined" || !process?.env) {
    return fallback;
  }

  // Try NEXT_PUBLIC_ variant first (for client-side)
  const nextPublicKey = `NEXT_PUBLIC_${key}`;
  const value = process.env[nextPublicKey] || process.env[key];

  if (!value && options?.required) {
    console.warn(`[ENV] Missing required environment variable: ${key}`);
  }

  return value || fallback;
}

/**
 * Get boolean environment variable
 */
function getBoolEnv(key: string, fallback: boolean = false): boolean {
  const value = getEnv(key);
  if (!value) return fallback;
  return value.toLowerCase() === "true" || value === "1";
}

// =============================================================================
// DEFAULT VALUES
// =============================================================================

const DEFAULTS = {
  WORKERS_API_DEV: "http://localhost:8787",
  WORKERS_API_PROD: "https://bitcoinbaby-api.andeanlabs-58f.workers.dev",
  PROVER_DEV: "http://localhost:17784",
  PROVER_PROD: "https://v11.charms.dev",

  // Testnet4 app IDs (default for development)
  BABTC_APP_ID: "genesis_babies_nft",
  GBABY_APP_ID: "genesis_babies_nft",
  BABTC_APP_VK: "",
  GBABY_APP_VK: "",
} as const;

// =============================================================================
// ENVIRONMENT DETECTION
// =============================================================================

/**
 * Detect if running in production
 */
export function isProduction(): boolean {
  return getEnv("NODE_ENV") === "production";
}

/**
 * Detect if running in development
 */
export function isDevelopment(): boolean {
  const env = getEnv("NODE_ENV");
  return env === "development" || env === "";
}

/**
 * Detect if running in test
 */
export function isTest(): boolean {
  return getEnv("NODE_ENV") === "test" || getEnv("CI") === "true";
}

// =============================================================================
// CONFIG BUILDER
// =============================================================================

/**
 * Get full environment configuration
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const isProd = isProduction();
  const isDev = isDevelopment();

  return {
    // API URLs
    workersApiUrl: getEnv(
      "WORKERS_API_URL",
      isProd ? DEFAULTS.WORKERS_API_PROD : DEFAULTS.WORKERS_API_DEV,
    ),
    proverUrl: getEnv(
      "PROVER_URL",
      isProd ? DEFAULTS.PROVER_PROD : DEFAULTS.PROVER_DEV,
    ),

    // Smart Contract IDs
    babtcAppId: getEnv("BABTC_APP_ID", DEFAULTS.BABTC_APP_ID),
    gbabyAppId: getEnv("GBABY_APP_ID", DEFAULTS.GBABY_APP_ID),
    babtcAppVk: getEnv("BABTC_APP_VK", DEFAULTS.BABTC_APP_VK),
    gbabyAppVk: getEnv("GBABY_APP_VK", DEFAULTS.GBABY_APP_VK),

    // Feature flags
    isProduction: isProd,
    isDevelopment: isDev,
    isTest: isTest(),

    // Debug
    enableDebug: getBoolEnv("DEBUG", isDev),
  };
}

/**
 * Get specific environment config value
 */
export function getConfig<K extends keyof EnvironmentConfig>(
  key: K,
): EnvironmentConfig[K] {
  return getEnvironmentConfig()[key];
}

// =============================================================================
// SINGLETON CONFIG
// =============================================================================

let cachedConfig: EnvironmentConfig | null = null;

/**
 * Get cached environment config (for performance)
 */
export function getCachedConfig(): EnvironmentConfig {
  if (!cachedConfig) {
    cachedConfig = getEnvironmentConfig();
  }
  return cachedConfig;
}

/**
 * Clear cached config (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}
