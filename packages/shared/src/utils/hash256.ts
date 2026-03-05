/**
 * Shared hash256 implementation
 *
 * This is the canonical implementation of double SHA-256 (hash256)
 * used throughout BitcoinBaby. Both client and server should use
 * this exact algorithm to ensure consistency.
 *
 * CRITICAL: The second SHA-256 must be performed on the 32 BYTES
 * of the first hash, NOT on the 64-character hex string representation!
 */

/**
 * SHA-256 returning raw bytes
 * Works in both browser (crypto.subtle) and Node.js (crypto) environments
 */
async function sha256Bytes(data: BufferSource): Promise<Uint8Array> {
  // Browser environment
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hashBuffer);
  }

  // Node.js environment (for workers/server)
  const nodeCrypto = await import("crypto");
  const buffer =
    data instanceof Uint8Array
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array((data as ArrayBufferView).buffer);
  const hash = nodeCrypto.createHash("sha256").update(buffer).digest();
  return new Uint8Array(hash);
}

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Double SHA-256 (Bitcoin standard hash256)
 *
 * hash256(data) = SHA256(SHA256(data))
 *
 * @param message - The string message to hash
 * @returns The hash as a lowercase hex string
 *
 * @example
 * ```ts
 * const hash = await hash256("block123:bc1q...:42");
 * // Returns something like "00000abc..."
 * ```
 */
export async function hash256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);

  // First SHA256 -> 32 bytes
  const firstHash = await sha256Bytes(data);

  // Second SHA256 on the 32 BYTES (not hex string!)
  // Cast buffer to ArrayBuffer to satisfy TypeScript
  const secondHash = await sha256Bytes(firstHash.buffer as ArrayBuffer);

  // Return as lowercase hex string
  return bytesToHex(secondHash);
}

/**
 * Count leading zero bits in a hex string
 *
 * Used to determine if a hash meets the required difficulty.
 * Each hex character represents 4 bits:
 * - 0 = 0000 (4 zeros)
 * - 1 = 0001 (3 zeros)
 * - 2-3 = 001x (2 zeros)
 * - 4-7 = 01xx (1 zero)
 * - 8-f = 1xxx (0 zeros)
 *
 * @param hexString - The hash as a hex string
 * @returns Number of leading zero bits
 *
 * @example
 * ```ts
 * countLeadingZeroBits("00000abc...") // Returns 20 (5 zeros * 4 bits)
 * countLeadingZeroBits("0000007f...") // Returns 21 (5 zeros * 4 + 1)
 * ```
 */
export function countLeadingZeroBits(hexString: string): number {
  let zeroBits = 0;

  for (const char of hexString.toLowerCase()) {
    const nibble = parseInt(char, 16);

    if (nibble === 0) {
      zeroBits += 4;
    } else if (nibble === 1) {
      zeroBits += 3;
      break;
    } else if (nibble <= 3) {
      zeroBits += 2;
      break;
    } else if (nibble <= 7) {
      zeroBits += 1;
      break;
    } else {
      break;
    }
  }

  return zeroBits;
}

/**
 * Verify that a hash meets the required difficulty
 *
 * @param hash - The hash as a hex string
 * @param difficulty - Required number of leading zero bits
 * @returns true if the hash has at least `difficulty` leading zero bits
 */
export function meetsDifficulty(hash: string, difficulty: number): boolean {
  return countLeadingZeroBits(hash) >= difficulty;
}

/**
 * Test vectors for hash256 verification
 *
 * These can be used to verify that any implementation of hash256
 * produces the correct output.
 */
export const HASH256_TEST_VECTORS = [
  {
    input: "test",
    expected:
      "954d5a49fd70d9b8bcdb35d252267829957f7ef7fa6c74f88419bdc5e82209f4",
  },
  {
    input: "hello world",
    expected:
      "bc62d4b80d9e36da29c16c5d4d9f11731f36052c72401a76c23c0fb5a9b74423",
  },
  {
    input: "block123:bc1qtest:42",
    expected:
      "ef9b67e80ff34a86c1ba0c9a2cc9160e22b6bd4f33739a5bb1ae7cdca95ffeaa",
  },
] as const;

/**
 * Verify hash256 implementation against test vectors
 *
 * @returns Array of failed test cases (empty if all pass)
 */
export async function verifyHash256Implementation(): Promise<
  Array<{ input: string; expected: string; actual: string }>
> {
  const failures: Array<{ input: string; expected: string; actual: string }> =
    [];

  for (const vector of HASH256_TEST_VECTORS) {
    const actual = await hash256(vector.input);
    if (actual !== vector.expected) {
      failures.push({
        input: vector.input,
        expected: vector.expected,
        actual,
      });
    }
  }

  return failures;
}
