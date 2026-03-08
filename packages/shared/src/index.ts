/**
 * @bitcoinbaby/shared
 *
 * Shared utilities, types, and base classes for all BitcoinBaby packages.
 *
 * @example
 * // Import from submodules for tree-shaking
 * import { NetworkError, ValidationError } from '@bitcoinbaby/shared/errors';
 * import { HttpClient } from '@bitcoinbaby/shared/http';
 * import { createLogger } from '@bitcoinbaby/shared/logging';
 * import { normalizeNetwork, getNetworkEndpoints } from '@bitcoinbaby/shared/network';
 * import { sleep, formatHashrate } from '@bitcoinbaby/shared/utils';
 * import { bitcoinAddressSchema, validate } from '@bitcoinbaby/shared/validation';
 *
 * // Or import everything from main
 * import * as shared from '@bitcoinbaby/shared';
 */

// Types (Single Source of Truth)
export * from "./types";

// Errors
export * from "./errors";

// HTTP
export * from "./http";

// Logging
export * from "./logging";

// Network
export * from "./network";

// Stores
export * from "./stores";

// Utils
export * from "./utils";

// Validation
export * from "./validation";

// Configuration
export * from "./config";
