/**
 * Deterministic Random Number Generator
 *
 * Creates a seeded RNG based on a hex string (typically a txid).
 * Ensures NFT trait generation is deterministic and verifiable —
 * same seed always produces same traits.
 *
 * Algorithm: xorshift variant with byte mixing
 */

/**
 * Create a seeded random number generator based on a hex seed.
 * Returns a function that, when called, produces a number in [0, 1).
 *
 * @param seed - Hex string (e.g., txid) used as entropy source
 * @returns Function returning pseudo-random numbers in [0, 1)
 */
export function createSeededRandom(seed: string): () => number {
  const bytes: number[] = [];
  for (let i = 0; i < seed.length; i += 2) {
    bytes.push(parseInt(seed.slice(i, i + 2), 16) || 0);
  }
  let index = 0;
  let state = bytes.reduce((a, b) => (a * 31 + b) >>> 0, 0);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state = state >>> 0;
    if (index < bytes.length) state = (state + bytes[index++]) >>> 0;
    return state / 0xffffffff;
  };
}
