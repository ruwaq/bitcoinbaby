/**
 * Format Utilities
 *
 * Centralized formatting functions for BTC, sats, tokens, and dates.
 * Eliminates code duplication across wallet components.
 */

// =============================================================================
// CONSTANTS
// =============================================================================

/** Satoshis per Bitcoin (100 million) */
export const SATOSHIS_PER_BTC = 100_000_000;

/** Satoshis per Bitcoin as BigInt for precise calculations */
export const SATOSHIS_PER_BTC_BIGINT = BigInt(SATOSHIS_PER_BTC);

/** Minimum output value (dust threshold for P2TR) */
export const DUST_THRESHOLD = 546;

/** Token decimal places (same as sats) */
export const TOKEN_DECIMALS = 8;

// =============================================================================
// BTC / SATOSHI FORMATTING
// =============================================================================

/**
 * Convert satoshis to BTC string with 8 decimal places
 * Uses BigInt arithmetic to avoid floating point precision issues
 *
 * @example
 * satsToBtc(100000000) // "1.00000000"
 * satsToBtc(12345)     // "0.00012345"
 * satsToBtc(BigInt("9007199254740993")) // "90071992.54740993" (handles large values)
 */
export function satsToBtc(sats: number | bigint): string {
  // Convert to BigInt for precise calculation
  const satsBigInt = typeof sats === "bigint" ? sats : BigInt(Math.floor(sats));

  // Handle negative values (shouldn't happen but be safe)
  if (satsBigInt < 0n) return "0.00000000";

  // Split into whole BTC and fractional sats
  const wholeBtc = satsBigInt / SATOSHIS_PER_BTC_BIGINT;
  const fractionalSats = satsBigInt % SATOSHIS_PER_BTC_BIGINT;

  // Pad fractional part to 8 digits
  const fractionalStr = fractionalSats.toString().padStart(8, "0");

  return `${wholeBtc}.${fractionalStr}`;
}

/**
 * Convert BTC string to satoshis with precise decimal handling
 * Avoids floating point errors by parsing decimals as integers
 *
 * @example
 * btcToSats("1.0")        // 100000000
 * btcToSats("0.00012345") // 12345
 * btcToSats("0.00000001") // 1 (1 satoshi, precise)
 * btcToSats("invalid")    // 0
 */
export function btcToSats(btcString: string): number {
  if (!btcString || typeof btcString !== "string") return 0;

  // Clean input: remove non-numeric except decimal point
  const cleaned = btcString.trim().replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return 0;

  // Split by decimal point
  const parts = cleaned.split(".");

  // Handle multiple decimal points
  if (parts.length > 2) return 0;

  const wholePart = parts[0] || "0";
  let fractionalPart = parts[1] || "";

  // Validate parts are numeric
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) return 0;

  // Pad or truncate fractional part to exactly 8 digits
  fractionalPart = fractionalPart.padEnd(8, "0").slice(0, 8);

  // Combine as integer string and parse
  const satsString = wholePart + fractionalPart;

  // Remove leading zeros and parse
  const sats = parseInt(satsString, 10);

  // Validate result
  if (!Number.isFinite(sats) || sats < 0) return 0;

  // Check for overflow (shouldn't happen with BTC amounts but be safe)
  if (sats > Number.MAX_SAFE_INTEGER) {
    console.warn("[btcToSats] Value exceeds safe integer range:", btcString);
    return Number.MAX_SAFE_INTEGER;
  }

  return sats;
}

/**
 * Convert BTC string to satoshis as BigInt (for large values)
 *
 * @example
 * btcToSatsBigInt("21000000") // 2100000000000000n (all BTC ever)
 */
export function btcToSatsBigInt(btcString: string): bigint {
  if (!btcString || typeof btcString !== "string") return 0n;

  const cleaned = btcString.trim().replace(/[^\d.]/g, "");
  if (!cleaned || cleaned === ".") return 0n;

  const parts = cleaned.split(".");
  if (parts.length > 2) return 0n;

  const wholePart = parts[0] || "0";
  let fractionalPart = parts[1] || "";

  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionalPart)) return 0n;

  fractionalPart = fractionalPart.padEnd(8, "0").slice(0, 8);

  try {
    return BigInt(wholePart + fractionalPart);
  } catch {
    return 0n;
  }
}

/**
 * Format satoshis for display with locale thousands separator
 *
 * @example
 * formatSats(1234567) // "1,234,567"
 */
export function formatSats(sats: number | bigint): string {
  return sats.toLocaleString();
}

/**
 * Format BTC value for display (removes trailing zeros if wanted)
 *
 * @example
 * formatBtc(100000000, true)  // "1"
 * formatBtc(100000000, false) // "1.00000000"
 */
export function formatBtc(
  sats: number | bigint,
  trimZeros: boolean = false,
): string {
  const btc = satsToBtc(sats);
  if (trimZeros) {
    return parseFloat(btc).toString();
  }
  return btc;
}

/**
 * Format BTC with unit suffix
 *
 * @example
 * formatBtcWithUnit(100000000) // "1.00000000 BTC"
 */
export function formatBtcWithUnit(sats: number | bigint): string {
  return `${satsToBtc(sats)} BTC`;
}

// =============================================================================
// TOKEN FORMATTING
// =============================================================================

/**
 * Format token amount (bigint with 8 decimals)
 *
 * @example
 * formatTokenAmount(100_00000000n) // "100"
 * formatTokenAmount(12345678n)     // "0.12345678"
 */
export function formatTokenAmount(amount: bigint): string {
  const divisor = BigInt(10 ** TOKEN_DECIMALS);
  const whole = amount / divisor;
  const fraction = amount % divisor;

  if (fraction === 0n) {
    return whole.toLocaleString();
  }

  const fractionStr = fraction.toString().padStart(TOKEN_DECIMALS, "0");
  // Remove trailing zeros
  const trimmed = fractionStr.replace(/0+$/, "");
  return `${whole.toLocaleString()}.${trimmed}`;
}

/**
 * Format balance (bigint) for display with locale
 *
 * @example
 * formatBalance(1234567890n) // "1,234,567,890"
 */
export function formatBalance(balance: bigint): string {
  return balance.toLocaleString();
}

// =============================================================================
// DATE / TIME FORMATTING
// =============================================================================

/**
 * Format timestamp to locale date string
 *
 * @example
 * formatDate(1699900000000) // "11/13/2023, 5:06:40 PM"
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

/**
 * Format timestamp to short date (without time)
 *
 * @example
 * formatShortDate(1699900000000) // "11/13/2023"
 */
export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Format timestamp to relative time
 *
 * @example
 * formatRelativeTime(Date.now() - 60000) // "1 minute ago"
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "just now";
}

// =============================================================================
// ADDRESS FORMATTING
// =============================================================================

/**
 * Truncate address for display
 *
 * @example
 * truncateAddress("bc1p...abc123def456", 6) // "bc1p...f456"
 */
export function truncateAddress(address: string, chars: number = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Truncate txid for display
 *
 * @example
 * truncateTxid("abc123...xyz789") // "abc123...xyz789"
 */
export function truncateTxid(txid: string, chars: number = 8): string {
  if (txid.length <= chars * 2 + 3) return txid;
  return `${txid.slice(0, chars)}...${txid.slice(-chars)}`;
}
