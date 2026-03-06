#!/usr/bin/env tsx
/**
 * Treasury Wallet Generator
 *
 * Generates a new BIP39 mnemonic and derives the Treasury wallet address.
 * Run once to create the Treasury wallet, then store the mnemonic securely.
 *
 * Usage:
 *   tsx scripts/signer/generate-wallet.ts
 *
 * Output:
 *   - Mnemonic (12 words)
 *   - Taproot address (testnet4)
 *   - Derivation path
 *
 * SECURITY:
 *   - Run this in a secure environment
 *   - Store mnemonic in password manager (1Password, Bitwarden)
 *   - NEVER commit mnemonic to git
 *   - NEVER share mnemonic via email/chat
 */

import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// Configuration
const NETWORK = bitcoin.networks.testnet; // testnet4 uses testnet params
const DERIVATION_PATH = "m/86'/1'/0'/0/0"; // BIP86 Taproot, testnet

async function generateWallet() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║           BITCOINBABY TREASURY WALLET GENERATOR              ║",
  );
  console.log(
    "╠══════════════════════════════════════════════════════════════╣",
  );
  console.log(
    "║  ⚠️  SECURITY WARNING                                         ║",
  );
  console.log(
    "║  Store the mnemonic in a secure password manager.            ║",
  );
  console.log(
    "║  NEVER share or commit to git!                               ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );
  console.log();

  // Generate mnemonic (12 words = 128 bits entropy)
  const mnemonic = bip39.generateMnemonic(128);

  // Derive wallet
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, NETWORK);
  const keyPair = root.derivePath(DERIVATION_PATH);

  // Get internal key for Taproot (x-only pubkey)
  const internalKey = keyPair.publicKey.subarray(1, 33);

  // Generate Taproot address
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: internalKey,
    network: NETWORK,
  });

  // Output
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ MNEMONIC (12 words) - SAVE SECURELY!                         │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(`│ ${mnemonic}`);
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
  console.log();

  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ TREASURY ADDRESS (Taproot/P2TR)                              │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(`│ ${address}`);
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
  console.log();

  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ CONFIGURATION                                                │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(`│ Network:         testnet4`);
  console.log(`│ Derivation Path: ${DERIVATION_PATH}`);
  console.log(`│ Address Type:    Taproot (P2TR)`);
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
  console.log();

  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ NEXT STEPS                                                   │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(
    "│ 1. Save mnemonic in password manager (1Password, Bitwarden)  │",
  );
  console.log(
    "│ 2. Set environment variables:                                │",
  );
  console.log(
    "│    wrangler secret put TREASURY_ADDRESS --env production     │",
  );
  console.log(
    "│    wrangler secret put BATCH_WALLET_SEED --env production    │",
  );
  console.log(
    "│ 3. Fund treasury with testnet4 BTC for fees:                 │",
  );
  console.log(
    "│    https://mempool.space/testnet4/faucet                     │",
  );
  console.log(
    "│ 4. Mint initial BABTC tokens to treasury                     │",
  );
  console.log(
    "│ 5. Deploy and start the signer service                       │",
  );
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
  console.log();

  // Verification
  console.log(
    "┌──────────────────────────────────────────────────────────────┐",
  );
  console.log(
    "│ VERIFICATION COMMANDS                                        │",
  );
  console.log(
    "├──────────────────────────────────────────────────────────────┤",
  );
  console.log(`│ # Check address balance:`);
  console.log(`│ curl https://mempool.space/testnet4/api/address/${address}`);
  console.log(`│`);
  console.log(`│ # Check Charms balance (after minting):`);
  console.log(`│ curl https://scrolls.charms.dev/api/v1/balances/${address}`);
  console.log(
    "└──────────────────────────────────────────────────────────────┘",
  );
}

generateWallet().catch(console.error);
