#!/usr/bin/env npx tsx
/**
 * BABTC Token Minting Script (V11)
 *
 * Uses the @bitcoinbaby/bitcoin package for proper V11 spell creation.
 * Run from monorepo root with: npx tsx scripts/mint-babtc-v11.ts
 *
 * Environment:
 *   MNEMONIC="your twelve word mnemonic phrase here"
 */

import * as bip39 from "bip39";
import { BIP32Factory } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";
import { createHash } from "crypto";

// Hard-coded config to avoid import issues
const BABTC_TESTNET4 = {
  appId: "87b5ecfbfa392550b0a221e20f28a9453ed212a343551a2a43387d0cd183681b",
  appVk: "acf2ec0b7245eb9c3371ef4e67eb1ca3f85d712b1aeca438a6a6d1898392179d",
};

const DEV_FUND_ADDRESS =
  "tb1pyzpxkhve8wrztypx62g8pnfr2axdh4n97m9a8pwveytkkn3ar02sp592z3";
const STAKING_POOL_ADDRESS =
  "tb1pjnkc6432y0muu7r0mwrxj0sc8y9kaq7dsh477xfuk5faannhe9psxkkqmc";
const PROVER_URL = "https://v14.charms.dev";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// Configuration
const NETWORK = bitcoin.networks.testnet;
const DERIVATION_PATH = "m/86'/1'/0'/0/0";
const MIN_DIFFICULTY = 16;
const MEMPOOL_API = "https://mempool.space/testnet4/api";

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
  console.log(`  Challenge: ${challenge.substring(0, 40)}...`);

  let nonce = 0;
  const startTime = Date.now();
  let lastReport = startTime;

  while (true) {
    // Convert nonce to hex for V11 format
    const nonceHex = nonce.toString(16).padStart(8, "0");
    const data = `${challenge}:${nonceHex}`;
    const hash = sha256(data);
    const difficulty = countLeadingZeroBits(hash);

    if (difficulty >= targetDifficulty) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n[FOUND] Valid hash in ${elapsed}s!`);
      console.log(`  Nonce (hex): ${nonceHex}`);
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
// MAIN
// =============================================================================

async function main() {
  console.log("========================================");
  console.log("  BABTC TOKEN MINTING - V11 (TESTNET4)");
  console.log("========================================");

  // Get mnemonic
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error("\n[ERROR] MNEMONIC environment variable not set");
    console.log(
      "Usage: MNEMONIC='your words here' npx tsx scripts/mint-babtc-v11.ts",
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

  // Get prev_tx hex (required by V11 prover)
  console.log("\n[TX] Fetching previous transaction...");
  const prevTxHex = await getTxHex(inputUtxo.txid);
  console.log(`  Got tx: ${prevTxHex.substring(0, 40)}...`);

  // Create challenge (timestamp:address format)
  const timestamp = Math.floor(Date.now() / 1000);
  const challenge = `${timestamp}:${wallet.address}`;

  // Mine
  const miningResult = mine(challenge, MIN_DIFFICULTY);

  // Create V11 spell using the proper function
  console.log("\n[SPELL] Creating V11 mint spell...");
  const { proverRequest } = createBABTCMintSpellV11({
    appId: BABTC_TESTNET4.appId,
    appVk: BABTC_TESTNET4.appVk,
    minerAddress: wallet.address,
    devAddress: BABTC_CONFIG.addresses.devFund,
    stakingAddress: BABTC_CONFIG.addresses.stakingPool,
    challenge,
    nonce: miningResult.nonce,
    difficulty: miningResult.difficulty,
    inputUtxo: {
      txid: inputUtxo.txid,
      vout: inputUtxo.vout,
    },
    fundingUtxo: {
      txid: inputUtxo.txid,
      vout: inputUtxo.vout,
      value: inputUtxo.value,
    },
    changeAddress: wallet.address,
    prevTxs: [prevTxHex],
  });

  console.log(`  App: t/${BABTC_TESTNET4.appId.substring(0, 16)}...`);

  // Submit to prover
  console.log("\n[PROVER] Submitting to Charms V11 prover...");
  const proverClient = createCharmsProverClient({ debug: true });

  try {
    const proverResponse = await proverClient.proveV11(proverRequest);

    console.log("\n[SUCCESS] Prover returned transactions!");
    console.log(`  Commit TX: ${proverResponse.commitTx.substring(0, 40)}...`);
    console.log(`  Spell TX: ${proverResponse.spellTx.substring(0, 40)}...`);

    // TODO: Sign and broadcast transactions
    console.log("\n[TODO] Sign and broadcast transactions");
    console.log(
      "  The transactions need to be signed with the wallet's private key",
    );
    console.log("  and then broadcast to the Bitcoin network.");

    // Save for manual broadcast
    console.log("\n[SAVE] Transactions saved for manual processing:");
    console.log(
      JSON.stringify(
        {
          commitTx: proverResponse.commitTx,
          spellTx: proverResponse.spellTx,
          miningResult,
          timestamp: Date.now(),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error("\n[ERROR] Prover failed:", error);

    // Save mining proof for retry
    console.log("\n[SAVE] Mining proof saved for retry:");
    console.log(
      JSON.stringify(
        {
          challenge,
          nonce: miningResult.nonce,
          hash: miningResult.hash,
          difficulty: miningResult.difficulty,
          inputUtxo,
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
  console.error("\n[FATAL]", error.message);
  process.exit(1);
});
