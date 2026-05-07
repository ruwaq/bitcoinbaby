/**
 * Safe JSON Utilities
 *
 * Centralized JSON parsing with proper error handling and BigInt support.
 */

/**
 * Safely parse JSON with error handling
 *
 * @param text - JSON string to parse
 * @param fallback - Fallback value if parsing fails
 */
export function safeJsonParse<T>(text: string, fallback: T): T;
export function safeJsonParse<T>(text: string): T | null;
export function safeJsonParse<T>(text: string, fallback?: T): T | null {
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback ?? null;
  }
}

/**
 * Parse JSON with BigInt support
 *
 * Converts large numeric strings (16+ digits) back to BigInt.
 * Compatible with the bitcoin package's BigInt serialization format.
 */
export function parseJsonWithBigInt<T>(text: string): T {
  return JSON.parse(text, (_, value) => {
    // Match the bitcoin package format: plain numeric strings with 16+ digits
    if (typeof value === "string" && /^-?\d{16,}$/.test(value) && !isNaN(Number(value))) {
      return BigInt(value);
    }
    return value;
  }) as T;
}

/**
 * Safely parse JSON with BigInt support
 */
export function safeParseJsonWithBigInt<T>(text: string, fallback: T): T;
export function safeParseJsonWithBigInt<T>(text: string): T | null;
export function safeParseJsonWithBigInt<T>(
  text: string,
  fallback?: T,
): T | null {
  try {
    return parseJsonWithBigInt<T>(text);
  } catch {
    return fallback ?? null;
  }
}

/**
 * Stringify JSON with BigInt support
 *
 * Converts BigInt values to plain number strings (e.g. "1000000000000000000").
 * Compatible with the bitcoin package's BigInt serialization format.
 */
export function stringifyWithBigInt(value: unknown, space?: number): string {
  return JSON.stringify(
    value,
    (_, v) => {
      if (typeof v === "bigint") {
        return v.toString();
      }
      return v;
    },
    space,
  );
}

/**
 * Deep clone an object using JSON (BigInt safe)
 */
export function deepClone<T>(value: T): T {
  return parseJsonWithBigInt(stringifyWithBigInt(value));
}

/**
 * Check if a string is valid JSON
 */
export function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}
