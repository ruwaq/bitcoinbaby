/**
 * BIP-86 Test Vectors (Taproot BIP86 derivation)
 *
 * Source: https://github.com/bitcoin/bips/blob/master/bip-0086.mediawiki
 *
 * Validates that our BitcoinWallet produces the canonical BIP-86 addresses and
 * x-only internal pubkeys for the standard test mnemonic. This is the
 * regression guard for any future change to wallet derivation (paths,
 * internal key extraction, p2tr wrapping).
 *
 * The BIP-86 spec uses the mnemonic:
 *   "abandon abandon abandon abandon abandon abandon
 *    abandon abandon abandon abandon abandon about"
 *
 * First receiving address (m/86'/0'/0'/0/0):
 *   bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr
 */

import { describe, it, expect } from "vitest";
import { BitcoinWallet } from "../src/wallet";

/**
 * Canonical BIP-86 test vectors.
 * Source: bips/bip-0086.mediawiki (Test Vectors section).
 *
 * Each row corresponds to derivation path m/86'/0'/0'/0/<index>.
 */
interface Bip86Vector {
  index: number;
  /** BIP-86 spec: P2TR address (bech32m-encoded Taproot output) */
  address: string;
  /**
   * Internal key used to derive the Taproot output (x-only, 32 bytes hex).
   * Note: the BIP-86 spec calls this "internal_key". For the spec's test
   * mnemonic at path m/86'/0'/0'/0/0, the value below is computed locally
   * via bip32 derivePath and verified to produce the canonical address.
   */
  internalPubkey: string;
}

const BIP86_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/**
 * The BIP-86 spec publishes ONLY the canonical P2TR address for index 0
 * (bc1p5cyxnuxm...) as the regression anchor. The internal_key below is the
 * value our reference bip32 derivation produces for that path; the address
 * test is the strict one (it pins the end-to-end derivation including
 * TapTweak + bech32m encoding).
 */
const CANONICAL_VECTOR_0: Bip86Vector = {
  index: 0,
  address:
    "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
  internalPubkey:
    "cc8a4bc64d897bddc5fbc2f670f7a8ba0b386779106cf1223c6fc5d7cd6fc115",
};

describe("BIP-86 Taproot derivation", () => {
  it("derives the canonical BIP-86 address for m/86'/0'/0'/0/0", async () => {
    const wallet = new BitcoinWallet({ network: "mainnet" });
    const info = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });

    expect(info.address).toBe(CANONICAL_VECTOR_0.address);
  });

  it("derives the canonical x-only internal pubkey for index 0", async () => {
    const wallet = new BitcoinWallet({ network: "mainnet" });
    const info = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });

    // BitcoinWallet.getInfo() returns publicKey as compressed hex (33 bytes).
    // BIP-86 internal pubkey = compressed.slice(1, 33) (x-only).
    expect(info.publicKey.length).toBe(66); // 33 bytes hex
    const xOnlyInternal = info.publicKey.slice(2); // strip 1-byte prefix
    expect(xOnlyInternal.toLowerCase()).toBe(CANONICAL_VECTOR_0.internalPubkey);
  });

  it("uses the BIP86 derivation path m/86'/0'/0'/0/<index>", async () => {
    const wallet = new BitcoinWallet({ network: "mainnet" });
    const info = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });

    expect(info.derivationPath).toBe("m/86'/0'/0'/0/0");
  });

  it("derives testnet addresses with tb1p prefix (path m/86'/1'/0'/0/<i>)", async () => {
    const wallet = new BitcoinWallet({ network: "testnet" });
    const info = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });

    expect(info.address.startsWith("tb1p")).toBe(true);
    expect(info.derivationPath).toBe("m/86'/1'/0'/0/0");
  });

  it("derives testnet4 addresses with tb1p prefix", async () => {
    const wallet = new BitcoinWallet({ network: "testnet4" });
    const info = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });

    expect(info.address.startsWith("tb1p")).toBe(true);
  });

  it("derives distinct addresses for sequential indices (no collision)", async () => {
    const wallet = new BitcoinWallet({ network: "mainnet" });
    const info0 = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 0,
      addressType: "taproot",
    });
    const info1 = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 1,
      addressType: "taproot",
    });
    const info2 = await wallet.fromMnemonic(BIP86_MNEMONIC, {
      addressIndex: 2,
      addressType: "taproot",
    });

    const addresses = new Set([info0.address, info1.address, info2.address]);
    expect(addresses.size).toBe(3); // all distinct
  });
});
