/**
 * Cryptographic Utilities for Workers
 *
 * Signature verification for authenticated endpoints.
 * Uses BIP340 Schnorr signatures for Bitcoin compatibility.
 */

import * as secp256k1 from "@noble/secp256k1";

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/^0x/, "");
  if (cleanHex.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < cleanHex.length; i += 2) {
    bytes[i / 2] = parseInt(cleanHex.substring(i, i + 2), 16);
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
 * SHA256 hash using WebCrypto
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hashBuffer);
}

/**
 * Verify Schnorr signature (BIP340)
 *
 * @param signature - 64-byte Schnorr signature (hex)
 * @param message - Message that was signed (string)
 * @param publicKey - 32-byte x-only public key (hex)
 * @returns true if signature is valid
 */
export async function verifySchnorrSignature(
  signature: string,
  message: string,
  publicKey: string,
): Promise<boolean> {
  try {
    const sigBytes = hexToBytes(signature);
    const pubKeyBytes = hexToBytes(publicKey);

    // Hash the message (BIP340 uses raw message hash)
    const messageBytes = new TextEncoder().encode(message);
    const messageHash = await sha256(messageBytes);

    // Verify using noble/secp256k1
    return secp256k1.schnorr.verify(sigBytes, messageHash, pubKeyBytes);
  } catch (error) {
    console.error("[Crypto] Signature verification error:", error);
    return false;
  }
}

/**
 * Derive x-only public key from Bitcoin address
 *
 * For Taproot (P2TR) addresses, the public key is embedded in the address.
 * For other address types, we can't derive the public key directly.
 *
 * @param address - Bitcoin address (tb1p... for testnet Taproot)
 * @returns x-only public key (32 bytes) or null if not derivable
 */
export function getPublicKeyFromTaprootAddress(
  address: string,
): Uint8Array | null {
  // Taproot addresses start with bc1p (mainnet) or tb1p (testnet)
  if (!address.startsWith("tb1p") && !address.startsWith("bc1p")) {
    return null;
  }

  try {
    // Bech32m decode to get witness program
    // For Taproot, witness program is the tweaked public key
    // This is a simplified implementation - full bech32m decoding
    // would be more complex
    const BECH32M_ALPHABET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

    // Remove prefix
    const withoutPrefix = address.slice(4); // Remove tb1p or bc1p

    // Decode bech32m data part
    const data: number[] = [];
    for (const char of withoutPrefix) {
      const idx = BECH32M_ALPHABET.indexOf(char);
      if (idx === -1) return null;
      data.push(idx);
    }

    // Remove checksum (last 6 characters)
    const payload = data.slice(0, -6);

    // Convert 5-bit groups to 8-bit bytes
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];

    for (const d of payload) {
      value = (value << 5) | d;
      bits += 5;
      while (bits >= 8) {
        bits -= 8;
        bytes.push((value >> bits) & 0xff);
      }
    }

    // Should be 32 bytes for x-only public key
    if (bytes.length !== 32) return null;

    return new Uint8Array(bytes);
  } catch {
    return null;
  }
}

/**
 * Create a message to sign for authenticated actions
 *
 * Format: action:tokenId:timestamp:nonce
 * Timestamp must be within 5 minutes of current time.
 */
export function createAuthMessage(
  action: string,
  tokenId: number,
  timestamp: number,
  nonce?: string,
): string {
  return `${action}:${tokenId}:${timestamp}${nonce ? `:${nonce}` : ""}`;
}

/**
 * Validate timestamp is within acceptable window (5 minutes)
 */
export function isTimestampValid(
  timestamp: number,
  windowMs: number = 5 * 60 * 1000,
): boolean {
  const now = Date.now();
  return Math.abs(now - timestamp) <= windowMs;
}
