#!/usr/bin/env npx tsx
/**
 * BABTC Token Minting Script (Standalone V11)
 *
 * Complete standalone script - no workspace imports needed.
 * Run from monorepo root with: npx tsx scripts/mint-babtc-standalone.ts
 *
 * Environment:
 *   MNEMONIC="your twelve word mnemonic phrase here"
 */

import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { createHash } from "crypto";
import * as cbor from "cbor2";
import * as fs from "fs";
import * as path from "path";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// =============================================================================
// CONFIG
// =============================================================================

const BABTC_APP_ID =
  "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b";
const BABTC_APP_VK =
  "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d";
const DEV_FUND_ADDRESS =
  "tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3";
const STAKING_POOL_ADDRESS =
  "tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc";
// Use local prover for development (custom apps not registered on hosted prover)
const PROVER_URL =
  process.env.PROVER_URL || "http://localhost:17784/spells/prove";
const MEMPOOL_API = "https://mempool.space/testnet4/api";
const NETWORK = bitcoin.networks.testnet;
const DERIVATION_PATH = "m/86'/1'/0'/0/0";
const MIN_DIFFICULTY = 16;
const MIN_SPELL_SATS = 700;

// Path to WASM binary
const WASM_PATH =
  "./packages/bitcoin/contracts/babtc/target/wasm32-wasip1/release/babtc-contract.wasm";

// =============================================================================
// TYPES
// =============================================================================

interface WalletInfo {
  address: string;
  publicKey: string;
  privateKey: Uint8Array;
  internalKey: Uint8Array;
}

interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: { confirmed: boolean };
}

// =============================================================================
// HELPERS
// =============================================================================

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function addressToScriptPubKey(address: string): string {
  const script = bitcoin.address.toOutputScript(address, NETWORK);
  return Buffer.from(script).toString("hex");
}

function utxoIdToBytes(utxoStr: string): Uint8Array {
  const [txidHex, indexStr] = utxoStr.split(":");
  const index = parseInt(indexStr, 10);
  const bytes = new Uint8Array(36);
  // Reverse txid bytes (Bitcoin display order)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(txidHex.substring((31 - i) * 2, (31 - i) * 2 + 2), 16);
  }
  // Index as little-endian u32
  bytes[32] = index & 0xff;
  bytes[33] = (index >> 8) & 0xff;
  bytes[34] = (index >> 16) & 0xff;
  bytes[35] = (index >> 24) & 0xff;
  return bytes;
}

// =============================================================================
// WALLET
// =============================================================================

async function deriveWallet(mnemonic: string): Promise<WalletInfo> {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Invalid mnemonic phrase");
  }

  const seed = await bip39.mnemonicToSeed(mnemonic);
  const root = bip32.fromSeed(seed, NETWORK);
  const keyPair = root.derivePath(DERIVATION_PATH);

  if (!keyPair.privateKey) {
    throw new Error("Failed to derive private key");
  }

  const internalKey = keyPair.publicKey.subarray(1, 33);
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: internalKey,
    network: NETWORK,
  });

  if (!address) {
    throw new Error("Failed to derive address");
  }

  return {
    address,
    publicKey: Buffer.from(keyPair.publicKey).toString("hex"),
    privateKey: new Uint8Array(keyPair.privateKey),
    internalKey: new Uint8Array(internalKey),
  };
}

// =============================================================================
// BLOCKCHAIN
// =============================================================================

async function getUTXOs(address: string): Promise<UTXO[]> {
  const response = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
  if (!response.ok)
    throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
  return response.json();
}

async function getBalance(address: string): Promise<number> {
  const utxos = await getUTXOs(address);
  return utxos.reduce((sum, u) => sum + u.value, 0);
}

async function getTxHex(txid: string): Promise<string> {
  const response = await fetch(`${MEMPOOL_API}/tx/${txid}/hex`);
  if (!response.ok)
    throw new Error(`Failed to fetch tx: ${response.statusText}`);
  return response.text();
}

// =============================================================================
// MINING
// =============================================================================

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function countLeadingZeroBits(hash: string): number {
  let count = 0;
  for (const char of hash) {
    const nibble = parseInt(char, 16);
    if (nibble === 0) {
      count += 4;
    } else {
      if (nibble < 8) count += 1;
      if (nibble < 4) count += 1;
      if (nibble < 2) count += 1;
      break;
    }
  }
  return count;
}

function mine(
  challenge: string,
  targetDifficulty: number,
): {
  hash: string;
  nonce: string;
  difficulty: number;
} {
  console.log(`\n[MINING] Difficulty ${targetDifficulty}...`);
  console.log(`  Challenge: ${challenge.substring(0, 50)}...`);

  let nonce = 0;
  const startTime = Date.now();
  let lastReport = startTime;

  while (true) {
    const nonceHex = nonce.toString(16).padStart(8, "0");
    const data = `${challenge}:${nonceHex}`;
    const hash = sha256(data);
    const difficulty = countLeadingZeroBits(hash);

    if (difficulty >= targetDifficulty) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n[FOUND] Valid hash in ${elapsed}s!`);
      console.log(`  Nonce: ${nonceHex}`);
      console.log(`  Hash: ${hash}`);
      console.log(`  Difficulty: ${difficulty} bits`);
      return { hash, nonce: nonceHex, difficulty };
    }

    nonce++;

    if (Date.now() - lastReport > 2000) {
      const hashrate = Math.floor(nonce / ((Date.now() - startTime) / 1000));
      process.stdout.write(
        `\r  Hashes: ${nonce.toLocaleString()} (${hashrate} H/s)`,
      );
      lastReport = Date.now();
    }
  }
}

// =============================================================================
// V11 SPELL & PROVER
// =============================================================================

function calculateReward(difficulty: number): {
  miner: number;
  dev: number;
  staking: number;
} {
  const exponent = Math.max(0, difficulty - MIN_DIFFICULTY);
  const total = Math.pow(2, exponent) * 1000;
  const miner = Math.floor(total * 0.7);
  const dev = Math.floor(total * 0.2);
  const staking = total - miner - dev;
  return { miner, dev, staking };
}

function createSpellV11(
  minerAddress: string,
  challenge: string,
  nonce: string,
  difficulty: number,
  inputUtxo: { txid: string; vout: number },
) {
  const reward = calculateReward(difficulty);
  const appKey = `t/${BABTC_APP_ID}/${BABTC_APP_VK}`;

  // V11 Spell structure
  const spell = {
    version: 11,
    tx: {
      ins: [`${inputUtxo.txid}:${inputUtxo.vout}`],
      outs: [
        { "0": reward.miner },
        { "0": reward.dev },
        { "0": reward.staking },
      ],
      coins: [
        { amount: MIN_SPELL_SATS, dest: addressToScriptPubKey(minerAddress) },
        {
          amount: MIN_SPELL_SATS,
          dest: addressToScriptPubKey(DEV_FUND_ADDRESS),
        },
        {
          amount: MIN_SPELL_SATS,
          dest: addressToScriptPubKey(STAKING_POOL_ADDRESS),
        },
      ],
    },
    app_public_inputs: {
      [appKey]: null,
    },
  };

  const privateInputs = {
    challenge,
    nonce,
    difficulty,
  };

  return { spell, privateInputs, appKey, reward };
}

function encodeSpellToCbor(spell: any): string {
  // Convert to CBOR-friendly format
  const tx: any = {};

  // Convert ins to bytes
  if (spell.tx.ins) {
    tx.ins = spell.tx.ins.map((utxo: string) => utxoIdToBytes(utxo));
  }

  // Convert outs - use Map with integer keys
  tx.outs = spell.tx.outs.map((output: any) => {
    const map = new Map<number, any>();
    for (const [key, value] of Object.entries(output)) {
      map.set(parseInt(key, 10), value);
    }
    return map;
  });

  // Convert coins
  if (spell.tx.coins) {
    tx.coins = spell.tx.coins.map((coin: any) => ({
      amount: coin.amount,
      dest: hexToBytes(coin.dest),
    }));
  }

  // Convert app_public_inputs - use tuples for keys
  const appPublicInputs = new Map<any, any>();
  for (const [appStr, data] of Object.entries(spell.app_public_inputs)) {
    const parts = appStr.split("/");
    if (parts.length === 3) {
      const [tag, identityHex, vkHex] = parts;
      const appTuple = [tag, hexToBytes(identityHex), hexToBytes(vkHex)];
      appPublicInputs.set(appTuple, data);
    }
  }

  const cborObj = {
    version: spell.version,
    tx,
    app_public_inputs: appPublicInputs,
  };

  const encoded = cbor.encode(cborObj);
  return bytesToHex(new Uint8Array(encoded));
}

function encodePrivateInputsToCbor(inputs: any): string {
  const encoded = cbor.encode(inputs);
  return bytesToHex(new Uint8Array(encoded));
}

async function submitToProver(
  spell: any,
  privateInputs: any,
  appKey: string,
  changeAddress: string,
  prevTxs: string[],
  fundingValue: number,
): Promise<{ commitTx: string; spellTx: string }> {
  console.log("\n[PROVER] Encoding spell to CBOR...");
  const spellHex = encodeSpellToCbor(spell);
  console.log(`  Spell CBOR: ${spellHex.substring(0, 40)}...`);

  const encodedPrivateInputs: Record<string, string> = {};
  encodedPrivateInputs[appKey] = encodePrivateInputsToCbor(privateInputs);
  console.log(
    `  Private inputs CBOR: ${encodedPrivateInputs[appKey].substring(0, 40)}...`,
  );

  // Load WASM binary
  console.log("\n[PROVER] Loading WASM binary...");
  const wasmPath = path.resolve(process.cwd(), WASM_PATH);
  const wasmBinary = fs.readFileSync(wasmPath);
  const wasmHex = Buffer.from(wasmBinary).toString("hex");
  console.log(`  WASM size: ${wasmBinary.length} bytes`);

  // Map binary by VK
  const binaries: Record<string, string> = {};
  binaries[BABTC_APP_VK] = wasmHex;

  const payload = {
    spell: spellHex,
    app_private_inputs: encodedPrivateInputs,
    binaries,
    change_address: changeAddress,
    fee_rate: fundingValue ? 2.0 : 2.0001,
    chain: "bitcoin",
    prev_txs: prevTxs.map((txHex) => ({ bitcoin: txHex })),
  };

  console.log("\n[PROVER] Submitting to Charms V11...");
  const response = await fetch(PROVER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "BitcoinBaby/1.0",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Prover error ${response.status}: ${errorText}`);
  }

  const result = await response.json();

  if (!result.commitTx || !result.spellTx) {
    throw new Error("Invalid prover response: missing transactions");
  }

  return result;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log("==========================================");
  console.log("  BABTC TOKEN MINTING - V11 (STANDALONE)");
  console.log("==========================================");

  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error("\n[ERROR] MNEMONIC environment variable not set");
    console.log(
      "Usage: MNEMONIC='your words here' npx tsx scripts/mint-babtc-standalone.ts",
    );
    process.exit(1);
  }

  // Derive wallet
  console.log("\n[WALLET] Deriving...");
  const wallet = await deriveWallet(mnemonic);
  console.log(`  Address: ${wallet.address}`);

  // Check balance
  console.log("\n[BALANCE] Checking...");
  const balance = await getBalance(wallet.address);
  console.log(`  Balance: ${balance.toLocaleString()} sats`);

  if (balance < 7000) {
    console.error("\n[ERROR] Insufficient balance. Need at least 7000 sats.");
    console.log("  Get testnet4 coins: https://mempool.space/testnet4/faucet");
    process.exit(1);
  }

  // Get UTXOs
  const utxos = await getUTXOs(wallet.address);
  const validUtxos = utxos.filter((u) => u.value >= 7000 && u.status.confirmed);

  if (validUtxos.length === 0) {
    console.error("\n[ERROR] No confirmed UTXOs with at least 7000 sats.");
    process.exit(1);
  }

  const inputUtxo = validUtxos[0];
  console.log(
    `  Using UTXO: ${inputUtxo.txid}:${inputUtxo.vout} (${inputUtxo.value} sats)`,
  );

  // Get prev_tx hex
  console.log("\n[TX] Fetching previous transaction...");
  const prevTxHex = await getTxHex(inputUtxo.txid);
  console.log(`  Got tx: ${prevTxHex.substring(0, 40)}...`);

  // Create challenge
  const timestamp = Math.floor(Date.now() / 1000);
  const challenge = `${timestamp}:${wallet.address}`;

  // Mine
  const miningResult = mine(challenge, MIN_DIFFICULTY);

  // Create spell
  console.log("\n[SPELL] Creating V11 mint spell...");
  const { spell, privateInputs, appKey, reward } = createSpellV11(
    wallet.address,
    challenge,
    miningResult.nonce,
    miningResult.difficulty,
    { txid: inputUtxo.txid, vout: inputUtxo.vout },
  );

  console.log(`  Reward: ${reward.miner + reward.dev + reward.staking} BABTC`);
  console.log(`    Miner: ${reward.miner} (70%)`);
  console.log(`    Dev: ${reward.dev} (20%)`);
  console.log(`    Staking: ${reward.staking} (10%)`);

  try {
    const proverResult = await submitToProver(
      spell,
      privateInputs,
      appKey,
      wallet.address,
      [prevTxHex],
      inputUtxo.value,
    );

    console.log("\n[SUCCESS] Prover returned transactions!");
    console.log(`  Commit TX: ${proverResult.commitTx.substring(0, 40)}...`);
    console.log(`  Spell TX: ${proverResult.spellTx.substring(0, 40)}...`);

    // TODO: Sign and broadcast
    console.log(
      "\n[NEXT] Sign and broadcast these transactions to complete minting.",
    );
  } catch (error) {
    console.error("\n[ERROR] Prover failed:", error);
    console.log("\n[PROOF] Mining proof for retry:");
    console.log(
      JSON.stringify(
        {
          challenge,
          nonce: miningResult.nonce,
          hash: miningResult.hash,
          difficulty: miningResult.difficulty,
          inputUtxo,
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n[FATAL]", error.message);
  process.exit(1);
});
