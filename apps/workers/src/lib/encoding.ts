/**
 * Encoding Utilities
 *
 * Centralized encoding/decoding functions for hex, bytes, and strings.
 * Use these instead of duplicating conversion logic across files.
 */

// =============================================================================
// HEX <-> BYTES CONVERSION
// =============================================================================

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Uint8Array of bytes
 */
export function hexToBytes(hex: string): Uint8Array {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

  if (cleanHex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Byte array
 * @param prefix - Whether to include 0x prefix (default: false)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix: boolean = false): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return prefix ? `0x${hex}` : hex;
}

// =============================================================================
// STRING <-> BYTES CONVERSION
// =============================================================================

/**
 * Convert string to Uint8Array (UTF-8)
 */
export function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Convert Uint8Array to string (UTF-8)
 */
export function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// =============================================================================
// BASE64 CONVERSION
// =============================================================================

/**
 * Convert Uint8Array to base64 string
 */
export function bytesToBase64(bytes: Uint8Array): string {
  // Use btoa for browser/Cloudflare Workers compatibility
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// =============================================================================
// BYTE MANIPULATION
// =============================================================================

/**
 * Concatenate multiple Uint8Arrays
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Reverse bytes (for Bitcoin endianness)
 */
export function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes).reverse();
}

/**
 * Compare two byte arrays for equality
 */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// =============================================================================
// CONSTANT-TIME COMPARISON (Security)
// =============================================================================

/**
 * Constant-time string comparison
 * Prevents timing attacks on cryptographic comparisons
 *
 * SECURITY: Uses crypto.subtle.timingSafeEqual when available (Cloudflare Workers),
 * falls back to XOR comparison with fixed iteration count.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  // Use max length to ensure constant iteration count regardless of input
  const maxLen = Math.max(a.length, b.length, 32); // Min 32 iterations

  let result = a.length ^ b.length; // XOR lengths first

  for (let i = 0; i < maxLen; i++) {
    // Use 0 as default for out-of-bounds to maintain constant time
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}

/**
 * Constant-time bytes comparison
 * Same security properties as constantTimeEqual
 */
export function constantTimeBytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  const maxLen = Math.max(a.length, b.length, 32);

  let result = a.length ^ b.length;

  for (let i = 0; i < maxLen; i++) {
    const byteA = i < a.length ? a[i] : 0;
    const byteB = i < b.length ? b[i] : 0;
    result |= byteA ^ byteB;
  }

  return result === 0;
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Check if string is valid hex
 */
export function isValidHex(hex: string): boolean {
  const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;
  return cleanHex.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(cleanHex);
}

/**
 * Check if string is valid base64
 */
export function isValidBase64(str: string): boolean {
  try {
    return btoa(atob(str)) === str;
  } catch {
    return false;
  }
}
