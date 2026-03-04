/**
 * Bitcoin Wallet - HD Wallet Implementation
 *
 * Features:
 * - BIP39 mnemonic generation
 * - BIP32/BIP86 key derivation
 * - Taproot (P2TR) addresses
 * - Secure key management
 *
 * Based on Charms wallet patterns with improvements.
 */

import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import type {
  BitcoinNetwork,
  WalletInfo,
  InternalWallet,
  WalletOptions,
  WalletBalance,
} from "./types";
import {
  InvalidMnemonicError,
  WalletNotFoundError,
  InvalidAddressError,
} from "./errors";
import { secureErase, bytesToHex } from "./crypto";

// Initialize BIP32 with secp256k1
const bip32 = BIP32Factory(ecc);

// Initialize bitcoinjs-lib with secp256k1
bitcoin.initEccLib(ecc);

// Network configurations
const NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet, // Same as testnet for now
  regtest: bitcoin.networks.regtest,
};

// Derivation paths
const DERIVATION_PATHS: Record<string, string> = {
  taproot: "m/86'/0'/0'/0", // BIP86 for Taproot
  segwit: "m/84'/0'/0'/0", // BIP84 for Native SegWit
  legacy: "m/44'/0'/0'/0", // BIP44 for Legacy
};

// Testnet derivation paths (coin type 1)
const TESTNET_DERIVATION_PATHS: Record<string, string> = {
  taproot: "m/86'/1'/0'/0",
  segwit: "m/84'/1'/0'/0",
  legacy: "m/44'/1'/0'/0",
};

/**
 * BitcoinBaby Wallet Class
 *
 * Secure, modular HD wallet implementation.
 */
export class BitcoinWallet {
  private wallet: InternalWallet | null = null;
  private readonly network: BitcoinNetwork;
  private readonly networkConfig: bitcoin.Network;

  constructor(options: WalletOptions = {}) {
    // Default to testnet4 (Bitcoin's current testnet)
    this.network = options.network ?? "testnet4";
    this.networkConfig = NETWORKS[this.network];
  }

  /**
   * Generate a new wallet with a random mnemonic
   */
  async generate(wordCount: 12 | 24 = 12): Promise<WalletInfo> {
    const strength = wordCount === 24 ? 256 : 128;
    const mnemonic = bip39.generateMnemonic(strength);
    return this.fromMnemonic(mnemonic);
  }

  /**
   * Create wallet from existing mnemonic
   */
  async fromMnemonic(
    mnemonic: string,
    options: {
      addressIndex?: number;
      addressType?: "taproot" | "segwit" | "legacy";
    } = {},
  ): Promise<WalletInfo> {
    // Validate mnemonic
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new InvalidMnemonicError("Invalid BIP39 mnemonic phrase");
    }

    const addressIndex = options.addressIndex ?? 0;
    const addressType = options.addressType ?? "taproot";

    // Derive seed from mnemonic
    const seed = await bip39.mnemonicToSeed(mnemonic);

    // SECURITY: Use try/finally to ensure seed is always zeroed
    try {
      // Create HD wallet root
      // Note: Buffer.from(seed) creates a copy, so we zero both
      const seedBuffer = Buffer.from(seed);
      const root = bip32.fromSeed(seedBuffer, this.networkConfig);

      // Get derivation path
      const isTestnet = this.network !== "mainnet";
      const basePath = isTestnet
        ? TESTNET_DERIVATION_PATHS[addressType]
        : DERIVATION_PATHS[addressType];
      const derivationPath = `${basePath}/${addressIndex}`;

      // Derive child key
      const child = root.derivePath(derivationPath);

      if (!child.privateKey) {
        throw new Error("Failed to derive private key");
      }

      // Generate address based on type
      const { address, publicKey } = this.generateAddress(child, addressType);

      // Store wallet internally
      this.wallet = {
        address,
        publicKey,
        network: this.network,
        derivationPath,
        addressType,
        privateKey: new Uint8Array(child.privateKey),
        mnemonic,
      };

      // SECURITY: Zero the seed buffer copy used by bip32
      seedBuffer.fill(0);

      return this.getInfo();
    } finally {
      // SECURITY: Zero the original seed from bip39
      // Note: While JS engines may have copies, this reduces exposure window
      seed.fill(0);
    }
  }

  /**
   * Generate address from derived key
   */
  private generateAddress(
    node: ReturnType<typeof bip32.fromSeed>,
    addressType: "taproot" | "segwit" | "legacy",
  ): { address: string; publicKey: string } {
    if (!node.publicKey) {
      throw new Error("No public key available");
    }

    let address: string;

    switch (addressType) {
      case "taproot": {
        // Taproot (P2TR) - BIP86
        // Use x-only public key (32 bytes, no prefix)
        const xOnlyPubKey = node.publicKey.slice(1, 33);
        const p2tr = bitcoin.payments.p2tr({
          internalPubkey: Buffer.from(xOnlyPubKey),
          network: this.networkConfig,
        });
        address = p2tr.address!;
        break;
      }

      case "segwit": {
        // Native SegWit (P2WPKH)
        const p2wpkh = bitcoin.payments.p2wpkh({
          pubkey: Buffer.from(node.publicKey),
          network: this.networkConfig,
        });
        address = p2wpkh.address!;
        break;
      }

      case "legacy": {
        // Legacy (P2PKH)
        const p2pkh = bitcoin.payments.p2pkh({
          pubkey: Buffer.from(node.publicKey),
          network: this.networkConfig,
        });
        address = p2pkh.address!;
        break;
      }
    }

    return {
      address,
      publicKey: bytesToHex(node.publicKey),
    };
  }

  /**
   * Get public wallet info (safe to expose)
   */
  getInfo(): WalletInfo {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    return {
      address: this.wallet.address,
      publicKey: this.wallet.publicKey,
      network: this.wallet.network,
      derivationPath: this.wallet.derivationPath,
      addressType: this.wallet.addressType,
    };
  }

  /**
   * Get the mnemonic (SENSITIVE - handle with care)
   * Only use for backup purposes, never log or transmit
   */
  getMnemonic(): string {
    if (!this.wallet?.mnemonic) {
      throw new WalletNotFoundError();
    }
    return this.wallet.mnemonic;
  }

  /**
   * Check if wallet is loaded
   */
  isLoaded(): boolean {
    return this.wallet !== null;
  }

  /**
   * Get current address
   */
  getAddress(): string {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }
    return this.wallet.address;
  }

  /**
   * Sign a message (for verification)
   */
  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    // Use bitcoinjs-lib message signing
    const messageBuffer = Buffer.from(message, "utf8");
    const privateKey = Buffer.from(this.wallet.privateKey);

    // For now, return a placeholder - full implementation would use
    // bitcoin-message library for BIP-322 signed messages
    const signature = ecc.sign(
      Buffer.from(await crypto.subtle.digest("SHA-256", messageBuffer)),
      privateKey,
    );

    return Buffer.from(signature).toString("base64");
  }

  /**
   * Sign a PSBT (Partially Signed Bitcoin Transaction)
   *
   * @param psbt - The PSBT to sign
   * @param inputIndices - Optional specific inputs to sign (default: all)
   * @returns The signed PSBT
   */
  signPSBT(psbt: bitcoin.Psbt, inputIndices?: number[]): bitcoin.Psbt {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    const { signer, cleanup, internalPubKey } = this.createTweakedSigner();
    const indicesToSign = inputIndices ?? psbt.data.inputs.map((_, i) => i);

    try {
      for (const index of indicesToSign) {
        // For Taproot inputs, ensure tapInternalKey is set
        const input = psbt.data.inputs[index];

        if (
          this.wallet.addressType === "taproot" &&
          !input.tapInternalKey &&
          input.witnessUtxo
        ) {
          // Check if this input is for our address (Taproot P2TR)
          const script = input.witnessUtxo.script;
          if (script[0] === 0x51 && script[1] === 0x20) {
            // OP_1 + 32 bytes = P2TR
            psbt.updateInput(index, {
              tapInternalKey: internalPubKey,
            });
          }
        }
        psbt.signInput(index, signer);
      }
      return psbt;
    } finally {
      // SECURITY: Zero the tweaked private key after signing
      cleanup();
    }
  }

  /**
   * Sign and finalize a PSBT, returning the raw transaction hex
   */
  signAndFinalizePSBT(psbt: bitcoin.Psbt): { hex: string; txid: string } {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    // Sign all inputs
    this.signPSBT(psbt);

    // Finalize
    psbt.finalizeAllInputs();

    // Extract transaction
    const tx = psbt.extractTransaction();

    return {
      hex: tx.toHex(),
      txid: tx.getId(),
    };
  }

  /**
   * Get private key for signing (USE WITH EXTREME CAUTION)
   * The returned Uint8Array should be cleared after use
   */
  getPrivateKeyForSigning(): Uint8Array {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    // Return a copy to allow caller to clear it
    return new Uint8Array(this.wallet.privateKey);
  }

  /**
   * Create a tweaked signer for Taproot transactions
   *
   * SECURITY: Returns both signer and cleanup function.
   * Caller MUST call cleanup() after signing is complete to zero the tweaked key.
   */
  private createTweakedSigner(): {
    signer: bitcoin.Signer;
    cleanup: () => void;
    internalPubKey: Buffer;
  } {
    if (!this.wallet) {
      throw new WalletNotFoundError();
    }

    const privateKey = this.wallet.privateKey;

    // Get public key
    const publicKey = ecc.pointFromScalar(privateKey);
    if (!publicKey) {
      throw new Error("Invalid private key");
    }

    // x-only internal public key (32 bytes)
    const xOnlyPubKey = publicKey.slice(1, 33);
    const internalPubKey = Buffer.from(xOnlyPubKey);

    // BIP86/BIP341 Taproot key path tweak
    const tweakHash = bitcoin.crypto.taggedHash("TapTweak", internalPubKey);

    // For Taproot, we need to use xOnlyPointAddTweak which handles parity correctly
    const tweakResult = ecc.xOnlyPointAddTweak(xOnlyPubKey, tweakHash);
    if (!tweakResult) {
      throw new Error("Failed to tweak public key");
    }

    // The tweaked x-only public key (output key)
    const tweakedPubKey = Buffer.from(tweakResult.xOnlyPubkey);

    // Tweak the private key - need to negate if original pubkey has odd Y
    let privKeyToTweak = privateKey;
    if (publicKey[0] === 0x03) {
      // Odd parity - negate private key before tweaking
      privKeyToTweak = ecc.privateNegate(privateKey);
    }

    const tweakedPrivateKey = ecc.privateAdd(privKeyToTweak, tweakHash);

    if (!tweakedPrivateKey) {
      throw new Error("Failed to tweak private key");
    }

    // If the tweaked pubkey has odd parity, we need to negate the tweaked private key
    if (tweakResult.parity === 1) {
      // Note: The private key is already correct for the tweaked point
      // No additional negation needed here - parity is just informational
    }

    // SECURITY: Store as Uint8Array so we can zero it later
    const tweakedKeyArray = new Uint8Array(tweakedPrivateKey);

    return {
      signer: {
        // For Taproot: the publicKey must be the TWEAKED/OUTPUT key (what's in the script)
        publicKey: tweakedPubKey,
        // signSchnorr is required for Taproot inputs
        signSchnorr: (hash: Buffer): Buffer => {
          const signature = ecc.signSchnorr(hash, tweakedKeyArray);
          return Buffer.from(signature);
        },
        // Also provide sign for non-Taproot compatibility
        sign: (hash: Buffer): Buffer => {
          const signature = ecc.sign(hash, tweakedKeyArray);
          return Buffer.from(signature);
        },
      },
      internalPubKey,
      // SECURITY: Cleanup function to zero the tweaked key
      cleanup: () => {
        tweakedKeyArray.fill(0);
      },
    };
  }

  /**
   * Clear wallet from memory securely
   */
  clear(): void {
    if (this.wallet) {
      secureErase(this.wallet.privateKey);
      // Clear mnemonic string (can't truly erase strings in JS)
      if (this.wallet.mnemonic) {
        // Replace with garbage
        (this.wallet as any).mnemonic = "x".repeat(this.wallet.mnemonic.length);
      }
      this.wallet = null;
    }
  }
}

// ============================================
// Static utility functions
// ============================================

// NOTE: validateAddress was removed - use the canonical version from validation.ts
// which provides richer error information: { valid: boolean, error?: string }

/**
 * Get address type from address string
 */
export function getAddressType(
  address: string,
): "taproot" | "segwit" | "legacy" | "unknown" {
  // Mainnet
  if (address.startsWith("bc1p")) return "taproot";
  if (address.startsWith("bc1q")) return "segwit";
  if (address.startsWith("1")) return "legacy";
  if (address.startsWith("3")) return "segwit"; // P2SH-wrapped

  // Testnet
  if (address.startsWith("tb1p")) return "taproot";
  if (address.startsWith("tb1q")) return "segwit";
  if (address.startsWith("m") || address.startsWith("n")) return "legacy";
  if (address.startsWith("2")) return "segwit"; // P2SH-wrapped

  return "unknown";
}

/**
 * Format address for display (truncated)
 */
export function formatAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/**
 * Format satoshis to BTC string
 */
export function satsToBtc(sats: number): string {
  return (sats / 100_000_000).toFixed(8);
}

/**
 * Format BTC to satoshis
 */
export function btcToSats(btc: number): number {
  return Math.round(btc * 100_000_000);
}

// ============================================
// Mnemonic utilities
// ============================================

/**
 * Generate mnemonic from custom entropy
 *
 * SECURITY: User-provided entropy is XOR'd with system CSPRNG to ensure
 * the resulting mnemonic has at least as much entropy as the CSPRNG,
 * even if the user entropy is weak (e.g., minimal mouse movement).
 *
 * @param userEntropy - 16 bytes (128 bits) for 12 words, 32 bytes (256 bits) for 24 words
 * @returns BIP39 mnemonic phrase
 */
export function generateMnemonicFromEntropy(userEntropy: Uint8Array): string {
  // Validate entropy length
  if (userEntropy.length !== 16 && userEntropy.length !== 32) {
    throw new Error(
      "Invalid entropy length. Must be 16 bytes (12 words) or 32 bytes (24 words)",
    );
  }

  // SECURITY: Generate CSPRNG entropy of the same length
  const csprngEntropy = new Uint8Array(userEntropy.length);
  crypto.getRandomValues(csprngEntropy);

  // SECURITY: XOR user entropy with CSPRNG entropy
  // This ensures the result has at least as much entropy as CSPRNG
  // even if user entropy is weak or predictable
  const combinedEntropy = new Uint8Array(userEntropy.length);
  for (let i = 0; i < userEntropy.length; i++) {
    combinedEntropy[i] = userEntropy[i] ^ csprngEntropy[i];
  }

  // Convert to Buffer for bip39 compatibility
  const entropyBuffer = Buffer.from(combinedEntropy);

  // Generate mnemonic from combined entropy
  const mnemonic = bip39.entropyToMnemonic(entropyBuffer);

  // SECURITY: Zero out entropy arrays
  csprngEntropy.fill(0);
  combinedEntropy.fill(0);
  entropyBuffer.fill(0);

  return mnemonic;
}

/**
 * Validate a BIP39 mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return bip39.validateMnemonic(mnemonic);
}

/**
 * Generate a random mnemonic (using system CSPRNG)
 *
 * @param wordCount - 12 or 24 words
 * @returns BIP39 mnemonic phrase
 */
export function generateRandomMnemonic(wordCount: 12 | 24 = 12): string {
  const strength = wordCount === 24 ? 256 : 128;
  return bip39.generateMnemonic(strength);
}

// Legacy exports for compatibility
export type { WalletInfo, WalletOptions, WalletBalance };
