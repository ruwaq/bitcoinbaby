/**
 * Utilities Module
 *
 * @example
 * import { sleep, retry, formatHashrate } from '@bitcoinbaby/shared/utils';
 */

// Timing
export { sleep, withTimeout, debounce, throttle, retry } from "./timing";

// JSON
export {
  safeJsonParse,
  parseJsonWithBigInt,
  safeParseJsonWithBigInt,
  stringifyWithBigInt,
  deepClone,
  isValidJson,
} from "./json";

// Formatting
export {
  formatNumber,
  formatHashrate,
  formatBytes,
  formatBtc,
  formatSatoshis,
  formatDuration,
  truncate,
  formatAddress,
  formatTxid,
  formatRelativeTime,
} from "./format";

// Hashing (Bitcoin standard double SHA-256)
export {
  hash256,
  countLeadingZeroBits,
  meetsDifficulty,
  HASH256_TEST_VECTORS,
  verifyHash256Implementation,
} from "./hash256";
