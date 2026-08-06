/**
 * Taproot (BIP-340/341/86) Tweaked Signer
 *
 * Single canonical implementation of Taproot key-path tweak + Schnorr signer
 * construction. Previously this logic was duplicated (and slightly divergent)
 * in wallet.ts and transactions/builder.ts; both now delegate here.
 *
 * Algorithm (BIP-341 key-path spend + BIP-340 signing):
 *   1. Derive compressed public key from the private key.
 *   2. Extract the x-only internal public key (bytes [1..33]).
 *   3. Compute tweakHash = TaggedHash("TapTweak", internalPubKey).
 *   4. If the compressed public key has odd Y parity (0x03 prefix), negate
 *      the private key before tweaking (BIP-341 requirement).
 *   5. tweakedPrivateKey = privateAdd(privKeyToTweak, tweakHash).
 *   6. Compute the tweaked x-only output key via xOnlyPointAddTweak.
 *   7. Build a bitcoinjs-lib Signer whose publicKey is the TWEAKED output key
 *      (so it matches the key embedded in the P2TR output script) and whose
 *      signSchnorr signs with the tweaked private key.
 *
 * SECURITY: The tweaked private key is held in a Uint8Array so the caller can
 * zero it via the returned cleanup() once signing is done.
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";

/**
 * Result of creating a Taproot tweaked signer.
 */
export interface TweakedSignerResult {
  /**
   * bitcoinjs-lib Signer exposing both sign() (ECDSA, original key) and
   * signSchnorr() (BIP-340, tweaked key). publicKey is the tweaked output key.
   */
  signer: bitcoin.Signer & {
    signSchnorr: (hash: Buffer) => Buffer;
  };
  /** The x-only INTERNAL public key (32 bytes). Used to populate tapInternalKey. */
  internalPubKey: Buffer;
  /** Zeroes the tweaked private key. MUST be called after signing. */
  cleanup: () => void;
}

/**
 * Create a Taproot key-path signer for the given private key.
 *
 * @param privateKey - 32-byte private key (secp256k1 scalar)
 * @returns Tweaked signer + internal pubkey + cleanup callback
 * @throws {Error} if the private key is invalid or tweaking fails
 */
export function createTweakedSigner(
  privateKey: Uint8Array,
): TweakedSignerResult {
  // Get compressed public key (33 bytes: 02/03 prefix + 32 byte x-coordinate)
  const publicKey = ecc.pointFromScalar(privateKey);
  if (!publicKey) {
    throw new Error("Invalid private key");
  }

  // x-only internal public key (32 bytes)
  const xOnlyPubKey = publicKey.slice(1, 33);
  const internalPubKey = Buffer.from(xOnlyPubKey);

  // BIP86/BIP341 Taproot key path tweak
  const tweakHash = bitcoin.crypto.taggedHash("TapTweak", internalPubKey);

  // BIP-341: handle parity — if the public key has odd Y coordinate (0x03),
  // negate the private key before tweaking.
  let privKeyToTweak: Uint8Array = privateKey;
  if (publicKey[0] === 0x03) {
    privKeyToTweak = ecc.privateNegate(privateKey);
  }

  const tweakedPrivateKey = ecc.privateAdd(privKeyToTweak, tweakHash);
  if (!tweakedPrivateKey) {
    throw new Error("Failed to tweak private key");
  }

  // Compute the tweaked x-only public key (the output key in the P2TR script).
  // xOnlyPointAddTweak returns parity so callers could enforce has_even_y(P),
  // but tiny-secp256k1's signSchnorr handles the final BIP-340 negation
  // internally — no manual post-tweak negation needed here.
  const tweakResult = ecc.xOnlyPointAddTweak(xOnlyPubKey, tweakHash);
  if (!tweakResult) {
    throw new Error("Failed to compute tweaked public key");
  }
  const tweakedPubKey = Buffer.from(tweakResult.xOnlyPubkey);

  // SECURITY: hold the tweaked key in a Uint8Array so cleanup() can zero it.
  const tweakedKeyArray = new Uint8Array(tweakedPrivateKey);

  const signer = {
    // publicKey must be the TWEAKED/OUTPUT key so bitcoinjs-lib can match it
    // against the key in the witnessUtxo script (NOT tapInternalKey).
    publicKey: tweakedPubKey,
    // ECDSA signing with the ORIGINAL key (for non-Taproot inputs).
    sign: (hash: Buffer): Buffer => {
      const signature = ecc.sign(hash, privateKey);
      return Buffer.from(signature);
    },
    // BIP-340 Schnorr signing with the TWEAKED key (for Taproot inputs).
    signSchnorr: (hash: Buffer): Buffer => {
      const signature = ecc.signSchnorr(hash, tweakedKeyArray);
      return Buffer.from(signature);
    },
  };

  const cleanup = (): void => {
    tweakedKeyArray.fill(0);
  };

  return { signer, internalPubKey, cleanup };
}
