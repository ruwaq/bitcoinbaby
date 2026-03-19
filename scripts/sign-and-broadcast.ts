#!/usr/bin/env npx tsx
/**
 * Sign and broadcast a transaction from Charms prover output
 *
 * Usage:
 *   MNEMONIC="..." TX_HEX="..." npx tsx scripts/sign-and-broadcast.ts
 */

import * as bip39 from "bip39";
import { BIP32Factory, BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

const NETWORK = bitcoin.networks.testnet;
const DERIVATION_PATH = "m/86'/1'/0'/0/0";
const MEMPOOL_API = "https://mempool.space/testnet4/api";

// secp256k1 curve order
const CURVE_ORDER = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

interface WalletKeys {
  address: string;
  privateKey: Uint8Array;
  internalKey: Uint8Array;
  output: Buffer;
  keyPair: BIP32Interface;
}

async function deriveWallet(mnemonic: string): Promise<WalletKeys> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, NETWORK);
  const keyPair = root.derivePath(DERIVATION_PATH);

  if (!keyPair.privateKey) {
    throw new Error("Failed to derive private key");
  }

  const internalKey = keyPair.publicKey.subarray(1, 33);
  const { address, output } = bitcoin.payments.p2tr({
    internalPubkey: internalKey,
    network: NETWORK,
  });

  return {
    address: address!,
    privateKey: keyPair.privateKey,
    internalKey,
    output: output!,
    keyPair,
  };
}

async function getUtxoValue(txid: string, vout: number): Promise<number> {
  const response = await fetch(`${MEMPOOL_API}/tx/${txid}`);
  const tx = await response.json();
  return tx.vout[vout].value;
}

async function broadcast(txHex: string): Promise<string> {
  const response = await fetch(`${MEMPOOL_API}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: txHex,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }

  return response.text();
}

// BIP340/341 compliant Taproot key path signing
function getTweakedPrivateKey(
  privateKey: Uint8Array,
  internalPubKey: Uint8Array,
): Uint8Array {
  // Get the full compressed public key
  const fullPubKey = ecc.pointFromScalar(privateKey, true);
  if (!fullPubKey) throw new Error("Failed to get public key");

  // Check if the public key has odd Y (prefix 0x03)
  // If so, we need to negate the private key
  let privKey = privateKey;
  if (fullPubKey[0] === 0x03) {
    // Negate the private key
    const privKeyBigInt = BigInt(
      "0x" + Buffer.from(privateKey).toString("hex"),
    );
    const negated = CURVE_ORDER - privKeyBigInt;
    privKey = new Uint8Array(
      Buffer.from(negated.toString(16).padStart(64, "0"), "hex"),
    );
  }

  // Compute the tweak: H_TapTweak(internalPubKey)
  const tweak = bitcoin.crypto.taggedHash(
    "TapTweak",
    Buffer.from(internalPubKey),
  );

  // Add tweak to private key
  const tweakedPrivKey = ecc.privateAdd(privKey, tweak);
  if (!tweakedPrivKey) throw new Error("Failed to tweak private key");

  // Check if tweaked public key has odd Y
  const tweakedPubKey = ecc.pointFromScalar(tweakedPrivKey, true);
  if (!tweakedPubKey) throw new Error("Failed to get tweaked public key");

  // If tweaked pubkey has odd Y, negate again
  if (tweakedPubKey[0] === 0x03) {
    const privKeyBigInt = BigInt(
      "0x" + Buffer.from(tweakedPrivKey).toString("hex"),
    );
    const negated = CURVE_ORDER - privKeyBigInt;
    return new Uint8Array(
      Buffer.from(negated.toString(16).padStart(64, "0"), "hex"),
    );
  }

  return tweakedPrivKey;
}

async function main() {
  const mnemonic = process.env.MNEMONIC;
  const txHex = process.env.TX_HEX;

  if (!mnemonic) {
    console.error("Error: MNEMONIC environment variable required");
    process.exit(1);
  }

  if (!txHex) {
    console.error("Error: TX_HEX environment variable required");
    console.log("Paste the hex from charms spell prove output");
    process.exit(1);
  }

  console.log("[1/4] Deriving wallet...");
  const wallet = await deriveWallet(mnemonic);
  console.log(`  Address: ${wallet.address}`);

  console.log("\n[2/4] Parsing transaction...");
  const tx = bitcoin.Transaction.fromHex(txHex);
  console.log(`  Inputs: ${tx.ins.length}`);
  console.log(`  Outputs: ${tx.outs.length}`);

  // Get input value for signing
  const inputTxid = Buffer.from(tx.ins[0].hash).reverse().toString("hex");
  const inputVout = tx.ins[0].index;
  console.log(`  Input UTXO: ${inputTxid}:${inputVout}`);

  const inputValue = await getUtxoValue(inputTxid, inputVout);
  console.log(`  Input value: ${inputValue} sats`);

  console.log("\n[3/4] Signing transaction...");

  // Get the tweaked private key (BIP341 compliant)
  const tweakedPrivKey = getTweakedPrivateKey(
    wallet.privateKey,
    wallet.internalKey,
  );

  // Verify the tweaked public key matches the output script
  const tweakedPubKey = ecc.pointFromScalar(tweakedPrivKey, true);
  if (!tweakedPubKey) throw new Error("Failed to compute tweaked public key");
  console.log(
    `  Tweaked pubkey: ${Buffer.from(tweakedPubKey).toString("hex")}`,
  );

  // Create the sighash for Taproot key path spend
  const sighashType = bitcoin.Transaction.SIGHASH_DEFAULT;

  // Compute the sighash for input 0
  const prevOutScripts = [wallet.output];
  const prevOutValues = [inputValue];

  const sighash = tx.hashForWitnessV1(
    0, // input index
    prevOutScripts,
    prevOutValues,
    sighashType,
  );
  console.log(`  Sighash: ${sighash.toString("hex")}`);

  // Sign with Schnorr
  const signature = ecc.signSchnorr(sighash, tweakedPrivKey);
  console.log(
    `  Signature: ${Buffer.from(signature).toString("hex").substring(0, 40)}...`,
  );

  // Verify the signature locally before broadcast
  const x_only_tweaked = tweakedPubKey.slice(1);
  const valid = ecc.verifySchnorr(sighash, x_only_tweaked, signature);
  console.log(`  Signature valid: ${valid}`);

  if (!valid) {
    console.error("  [ERROR] Local signature verification failed!");
    process.exit(1);
  }

  // Set the witness (just the signature for key path spend)
  tx.setWitness(0, [Buffer.from(signature)]);

  const signedHex = tx.toHex();
  console.log(`  Signed TX: ${signedHex.substring(0, 60)}...`);

  console.log("\n[4/4] Broadcasting transaction...");
  try {
    const txid = await broadcast(signedHex);
    console.log(`\n[SUCCESS] Transaction broadcast!`);
    console.log(`  TXID: ${txid}`);
    console.log(`  Explorer: https://mempool.space/testnet4/tx/${txid}`);
  } catch (error) {
    console.error(`\n[ERROR] ${error}`);
    console.log("\nSigned TX hex (for manual broadcast):");
    console.log(signedHex);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
