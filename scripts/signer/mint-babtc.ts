#!/usr/bin/env tsx
/**
 * BABTC Token Minting Script
 *
 * Complete CLI script to mint BABTC tokens on testnet4.
 * Performs PoW mining and submits to Charms prover.
 *
 * Usage:
 *   MNEMONIC="your twelve word mnemonic phrase here" tsx scripts/signer/mint-babtc.ts
 *
 * Or interactively:
 *   tsx scripts/signer/mint-babtc.ts
 *
 * Requirements:
 *   - Node.js 18+
 *   - testnet4 wallet with at least 7000 sats
 *   - Valid mnemonic phrase
 */

import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import * as readline from "readline";
import { createHash } from "crypto";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// Configuration
const NETWORK = bitcoin.networks.testnet;
const DERIVATION_PATH = "m/86'/1'/0'/0/0";
const MIN_DIFFICULTY = 16; // Minimum leading zero bits
const MEMPOOL_API = "https://mempool.space/testnet4/api";
const PROVER_API = "https://v14.charms.dev";

// BABTC Contract Config
const BABTC_APP_ID =
  "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b";
const BABTC_APP_VK =
  "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d";

// Distribution addresses
const DEV_FUND_ADDRESS =
  "tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3";
const STAKING_POOL_ADDRESS =
  "tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc";

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

interface MiningResult {
  hash: string;
  nonce: string;
  difficulty: number;
  challenge: string;
}

// =============================================================================
// WALLET DERIVATION
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
// BLOCKCHAIN INTERACTION
// =============================================================================

async function getUTXOs(address: string): Promise<UTXO[]> {
  const response = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
  if (!response.ok) {
    throw new Error(`Failed to fetch UTXOs: ${response.statusText}`);
  }
  return response.json();
}

async function getBalance(address: string): Promise<number> {
  const utxos = await getUTXOs(address);
  return utxos.reduce((sum, u) => sum + u.value, 0);
}

async function getFeeRate(): Promise<number> {
  const response = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  if (!response.ok) {
    return 2; // Default fallback
  }
  const fees = await response.json();
  return fees.halfHourFee || 2;
}

// =============================================================================
// MINING (PoW)
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
      // Count leading zeros in the nibble
      if (nibble < 8) count += 1;
      if (nibble < 4) count += 1;
      if (nibble < 2) count += 1;
      break;
    }
  }
  return count;
}

function mine(challenge: string, targetDifficulty: number): MiningResult {
  console.log(`\n⛏️  Mining with difficulty ${targetDifficulty}...`);
  console.log(`   Challenge: ${challenge.substring(0, 32)}...`);

  let nonce = 0;
  const startTime = Date.now();
  let lastReport = startTime;

  while (true) {
    const nonceStr = nonce.toString();
    const data = `${challenge}:${nonceStr}`;
    const hash = sha256(data);
    const difficulty = countLeadingZeroBits(hash);

    if (difficulty >= targetDifficulty) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ Found valid hash in ${elapsed}s!`);
      console.log(`   Nonce: ${nonceStr}`);
      console.log(`   Hash: ${hash}`);
      console.log(`   Difficulty: ${difficulty} bits`);

      return {
        hash,
        nonce: nonceStr,
        difficulty,
        challenge,
      };
    }

    nonce++;

    // Progress report every 2 seconds
    if (Date.now() - lastReport > 2000) {
      const hashrate = Math.floor(nonce / ((Date.now() - startTime) / 1000));
      process.stdout.write(
        `\r   Hashes: ${nonce.toLocaleString()} (${hashrate} H/s)`,
      );
      lastReport = Date.now();
    }
  }
}

// =============================================================================
// SPELL CREATION (V11 Format)
// =============================================================================

function addressToScriptPubKey(address: string): string {
  const script = bitcoin.address.toOutputScript(address, NETWORK);
  return Buffer.from(script).toString("hex");
}

function calculateReward(difficulty: number): {
  total: bigint;
  miner: bigint;
  dev: bigint;
  staking: bigint;
} {
  // BRO-style reward: 2^(difficulty - MIN_DIFFICULTY) * 1000
  const exponent = Math.max(0, difficulty - MIN_DIFFICULTY);
  const total = BigInt(Math.pow(2, exponent) * 1000);

  // Distribution: 70% miner, 20% dev, 10% staking
  const miner = (total * 70n) / 100n;
  const dev = (total * 20n) / 100n;
  const staking = total - miner - dev;

  return { total, miner, dev, staking };
}

interface SpellV11 {
  version: number;
  apps: Record<string, string>;
  ins: Array<[number, Record<string, unknown>]>;
  outs: Array<Record<string, unknown>>;
  private_inputs?: {
    pow_challenge: string;
    pow_nonce: string;
    pow_difficulty: number;
  };
  tx: {
    ins: Array<{ txid: string; vout: number }>;
    outs: Array<{ sats: number; to: string }>;
    coins?: Array<{ amount: number; dest: string }>;
  };
}

function createMintSpell(
  minerAddress: string,
  miningResult: MiningResult,
  inputUtxo: { txid: string; vout: number },
): SpellV11 {
  const reward = calculateReward(miningResult.difficulty);

  console.log(`\n📜 Creating mint spell...`);
  console.log(`   Total reward: ${reward.total} BABTC`);
  console.log(`   Miner share: ${reward.miner} (70%)`);
  console.log(`   Dev share: ${reward.dev} (20%)`);
  console.log(`   Staking share: ${reward.staking} (10%)`);

  // Create the spell structure
  const spell: SpellV11 = {
    version: 11,
    apps: {
      [`$${BABTC_APP_ID}/BABTC`]: BABTC_APP_VK,
    },
    ins: [[0, {}]], // Input from the UTXO
    outs: [
      // Output 0: Miner reward
      { [`$${BABTC_APP_ID}/BABTC`]: { n: Number(reward.miner) } },
      // Output 1: Dev fund
      { [`$${BABTC_APP_ID}/BABTC`]: { n: Number(reward.dev) } },
      // Output 2: Staking pool
      { [`$${BABTC_APP_ID}/BABTC`]: { n: Number(reward.staking) } },
    ],
    private_inputs: {
      pow_challenge: miningResult.challenge,
      pow_nonce: miningResult.nonce,
      pow_difficulty: miningResult.difficulty,
    },
    tx: {
      ins: [inputUtxo],
      outs: [
        { sats: 700, to: minerAddress },
        { sats: 700, to: DEV_FUND_ADDRESS },
        { sats: 700, to: STAKING_POOL_ADDRESS },
      ],
      coins: [
        { amount: 700, dest: addressToScriptPubKey(minerAddress) },
        { amount: 700, dest: addressToScriptPubKey(DEV_FUND_ADDRESS) },
        { amount: 700, dest: addressToScriptPubKey(STAKING_POOL_ADDRESS) },
      ],
    },
  };

  return spell;
}

// =============================================================================
// PROVER INTERACTION
// =============================================================================

async function submitToProver(spell: SpellV11): Promise<{
  commitTx: string;
  spellTx: string;
}> {
  console.log(`\n🔐 Submitting to Charms Prover...`);

  const response = await fetch(`${PROVER_API}/spells/prove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ spell }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Prover error: ${error}`);
  }

  const result = await response.json();
  console.log(`✅ Prover response received`);
  console.log(`   Commit TX: ${result.commitTx.substring(0, 32)}...`);
  console.log(`   Spell TX: ${result.spellTx.substring(0, 32)}...`);

  return result;
}

// =============================================================================
// TRANSACTION SIGNING
// =============================================================================

async function signAndBroadcast(
  txHex: string,
  wallet: WalletInfo,
): Promise<string> {
  // Parse the transaction
  const tx = bitcoin.Transaction.fromHex(txHex);

  // Sign each input
  for (let i = 0; i < tx.ins.length; i++) {
    // For Taproot, we use Schnorr signatures
    const hash = tx.hashForWitnessV1(
      i,
      [bitcoin.script.compile([bitcoin.opcodes.OP_1, wallet.internalKey])],
      [tx.outs[0].value],
      bitcoin.Transaction.SIGHASH_DEFAULT,
    );

    const signature = ecc.signSchnorr(hash, wallet.privateKey);
    tx.setWitness(i, [Buffer.from(signature)]);
  }

  const signedHex = tx.toHex();

  // Broadcast
  console.log(`\n📡 Broadcasting transaction...`);
  const response = await fetch(`${MEMPOOL_API}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: signedHex,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Broadcast failed: ${error}`);
  }

  const txid = await response.text();
  return txid;
}

// =============================================================================
// MAIN FLOW
// =============================================================================

async function promptMnemonic(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question("\n🔑 Enter your mnemonic (12 words): ", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log(
    "╔══════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║              BABTC TOKEN MINTING - TESTNET4                   ║",
  );
  console.log(
    "╚══════════════════════════════════════════════════════════════╝",
  );

  // Get mnemonic
  let mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    mnemonic = await promptMnemonic();
  }

  // Derive wallet
  console.log("\n🔐 Deriving wallet...");
  const wallet = await deriveWallet(mnemonic);
  console.log(`   Address: ${wallet.address}`);

  // Check balance
  console.log("\n💰 Checking balance...");
  const balance = await getBalance(wallet.address);
  console.log(`   Balance: ${balance.toLocaleString()} sats`);

  if (balance < 7000) {
    console.error("\n❌ Insufficient balance. Need at least 7000 sats.");
    console.log(`   Get testnet4 coins: https://mempool.space/testnet4/faucet`);
    process.exit(1);
  }

  // Get UTXOs
  const utxos = await getUTXOs(wallet.address);
  const validUtxos = utxos.filter((u) => u.value >= 7000 && u.status.confirmed);

  if (validUtxos.length === 0) {
    console.error("\n❌ No confirmed UTXOs with at least 7000 sats.");
    process.exit(1);
  }

  const inputUtxo = validUtxos[0];
  console.log(`   Using UTXO: ${inputUtxo.txid}:${inputUtxo.vout}`);
  console.log(`   Value: ${inputUtxo.value} sats`);

  // Create challenge from UTXO
  const challenge = `${inputUtxo.txid}:${inputUtxo.vout}`;

  // Mine
  const miningResult = mine(challenge, MIN_DIFFICULTY);

  // Create spell
  const spell = createMintSpell(wallet.address, miningResult, {
    txid: inputUtxo.txid,
    vout: inputUtxo.vout,
  });

  // Submit to prover
  try {
    const proverResult = await submitToProver(spell);

    // Sign and broadcast commit TX
    console.log("\n📝 Signing commit transaction...");
    const commitTxid = await signAndBroadcast(proverResult.commitTx, wallet);
    console.log(`   Commit TXID: ${commitTxid}`);

    // Sign and broadcast spell TX
    console.log("\n📝 Signing spell transaction...");
    const spellTxid = await signAndBroadcast(proverResult.spellTx, wallet);
    console.log(`   Spell TXID: ${spellTxid}`);

    // Success!
    console.log(
      "\n╔══════════════════════════════════════════════════════════════╗",
    );
    console.log(
      "║                     🎉 MINTING COMPLETE!                      ║",
    );
    console.log(
      "╚══════════════════════════════════════════════════════════════╝",
    );
    console.log(
      `\n   Commit TX: https://mempool.space/testnet4/tx/${commitTxid}`,
    );
    console.log(`   Spell TX:  https://mempool.space/testnet4/tx/${spellTxid}`);
    console.log(
      `\n   Check balance: https://scrolls.charms.dev/api/v1/balances/${wallet.address}`,
    );
  } catch (error) {
    console.error("\n❌ Minting failed:", error);

    // Save proof for later retry
    console.log("\n📦 Saving proof for later retry...");
    console.log(
      JSON.stringify(
        {
          miningResult,
          spell,
          timestamp: Date.now(),
        },
        null,
        2,
      ),
    );

    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Fatal error:", error.message);
  process.exit(1);
});
