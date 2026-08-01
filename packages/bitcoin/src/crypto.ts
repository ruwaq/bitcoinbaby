/**
 * Cryptographic Utilities
 *
 * Secure crypto operations with memory cleanup.
 * Uses WebCrypto where available, falls back to Node crypto.
 */

import * as secp256k1 from "@noble/secp256k1";
import { ripemd160 } from "@noble/hashes/ripemd160";
import { sha256 as nobleSha256 } from "@noble/hashes/sha256";
import { hmac } from "@noble/hashes/hmac";

/**
 * Initialize the synchronous hash backends required by @noble/secp256k1 v3
 * for the synchronous Schnorr sign/verify path.
 *
 * In @noble/secp256k1 v3.0.0, the sync schnorr.sign() / schnorr.verify()
 * functions require `hashes.sha256` and `hashes.hmacSha256` to be plugged in
 * explicitly (the async variants use WebCrypto internally and don't need
 * this). Without this initialization, calling signSchnorr/verifySchnorr
 * throws `Error: hashes.sha256 not set` at runtime.
 *
 * We use @noble/hashes (already a dependency) as the backend, which is the
 * recommended setup in the @noble/secp256k1 README.
 *
 * This module-level side effect runs once at import time and is idempotent.
 */
// NOTE: noble v3 checks `typeof hashes[name] !== 'function'` for the sync path,
// so `sha256` must be assigned the function directly (NOT wrapped in {sync}).
secp256k1.hashes.sha256 = nobleSha256;
secp256k1.hashes.hmacSha256 = (key: Uint8Array, ...msgs: Uint8Array[]) => {
  const h = hmac.create(nobleSha256, key);
  for (const msg of msgs) h.update(msg);
  const digest = h.digest();
  // Release intermediate HMAC state to avoid lingering key material
  h.destroy();
  return digest;
};

/**
 * Securely generate random bytes
 */
export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  if (
    typeof globalThis.crypto !== "undefined" &&
    globalThis.crypto.getRandomValues
  ) {
    // Browser/modern Node
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback (should not happen in modern environments)
    throw new Error("No secure random source available");
  }

  return bytes;
}

/**
 * Securely erase sensitive data from memory
 * Fills the array with zeros to prevent memory inspection
 */
export function secureErase(data: Uint8Array): void {
  if (data && data.length > 0) {
    // Fill with zeros
    data.fill(0);

    // Additional pass with random data to prevent optimization
    if (typeof globalThis.crypto !== "undefined") {
      globalThis.crypto.getRandomValues(data);
    }

    // Final zero fill
    data.fill(0);
  }
}

/**
 * SHA256 hash
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  if (typeof globalThis.crypto !== "undefined" && globalThis.crypto.subtle) {
    // Convert to ArrayBuffer for SubtleCrypto compatibility
    const buffer = new Uint8Array(data).buffer as ArrayBuffer;
    const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
    return new Uint8Array(hashBuffer);
  }

  // Fallback for environments without SubtleCrypto
  throw new Error("WebCrypto not available");
}

/**
 * Double SHA256 (Bitcoin standard)
 */
export async function hash256(data: Uint8Array): Promise<Uint8Array> {
  const first = await sha256(data);
  const second = await sha256(first);
  secureErase(first); // Clean intermediate result
  return second;
}

/**
 * RIPEMD160(SHA256(data)) - Used for Bitcoin addresses
 * This is the standard hash160 used throughout Bitcoin
 */
export async function hash160(data: Uint8Array): Promise<Uint8Array> {
  const sha256Hash = await sha256(data);
  const result = ripemd160(sha256Hash);
  secureErase(sha256Hash); // Clean intermediate result
  return result;
}

/**
 * Derive public key from private key
 */
export function getPublicKey(
  privateKey: Uint8Array,
  compressed = true,
): Uint8Array {
  return secp256k1.getPublicKey(privateKey, compressed);
}

/**
 * Sign message with private key (Schnorr for Taproot/BIP340)
 * Schnorr signatures are required for Taproot spending
 */
export async function signSchnorr(
  message: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  // Use noble/secp256k1's schnorr module for BIP340 Schnorr signatures
  // This is required for Taproot (P2TR) transactions
  const signature = secp256k1.schnorr.sign(message, privateKey);
  return new Uint8Array(signature);
}

/**
 * Verify Schnorr signature (BIP340)
 * For Taproot verification
 */
export function verifySchnorr(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    // Use schnorr.verify for BIP340 Schnorr signature verification
    return secp256k1.schnorr.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * XOR two byte arrays (for key derivation)
 */
export function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) {
    throw new Error("Arrays must have same length");
  }

  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}
