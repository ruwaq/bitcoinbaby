/**
 * NFT Spell Utils — shared byte/CBOR helpers for Charms v15 spells.
 *
 * Extracted from nft-minting-simple.ts so the evolution service can reuse the
 * EXACT same encodings (byte-compatible spells). All helpers here are pure.
 *
 * The UTXO / bech32 / CBOR encodings mirror the v15 prover's wire format as
 * documented in docs/superpowers/notes/charms-v15-witness-spike.md.
 */

import * as cbor from "cbor2";
import { NFT_CONTRACT_VK } from "../lib/nft-contract-binary";

/** Spark NFT state in the snake_case shape the on-chain contract expects. */
export interface SparkNFTState {
  dna: string;
  bloodline: string;
  base_type: string;
  genesis_block: number;
  rarity_tier: string;
  token_id: number;
  level: number;
  xp: number;
  total_xp: number;
  work_count: number;
  last_work_block: number;
  evolution_count: number;
  tokens_earned: string;
}

/** Spell version required by the Charms v15 prover (rejects version 11). */
export const SPELL_VERSION = 15;

/** Dust amount (sats) carried by an NFT output. */
export const NFT_DUST_SATS = 330;

/** Default fee rate passed to the prover. */
export const DEFAULT_FEE_RATE = 2.0;

/**
 * Convert a hex string to a byte array. Each pair of hex chars = one byte.
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a byte array to a lowercase hex string (no separators).
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert a "txid:vout" UTXO string to the 36-byte array the spell `ins` uses.
 *
 * The txid is reversed (Bitcoin display order → internal byte order) and the
 * vout is a little-endian u32.
 */
export function utxoToBytes(utxoStr: string): Uint8Array {
  const [txidHex, indexStr] = utxoStr.split(":");
  const index = parseInt(indexStr, 10);

  const bytes = new Uint8Array(36);
  // Reverse txid bytes (Bitcoin display order).
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(txidHex.substring((31 - i) * 2, (31 - i) * 2 + 2), 16);
  }
  // Index as little-endian u32.
  bytes[32] = index & 0xff;
  bytes[33] = (index >> 8) & 0xff;
  bytes[34] = (index >> 16) & 0xff;
  bytes[35] = (index >> 24) & 0xff;

  return bytes;
}

/**
 * Convert a bech32 (or bech32m) address to its script-pubkey bytes
 * (OP_n <len> <program>).
 */
export function addressToScriptPubkey(address: string): Uint8Array {
  const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

  const pos = address.lastIndexOf("1");
  if (pos < 1) throw new Error(`Invalid bech32 address: ${address}`);

  const data: number[] = [];
  for (let i = pos + 1; i < address.length; i++) {
    const idx = BECH32_CHARSET.indexOf(address.charAt(i).toLowerCase());
    if (idx === -1) throw new Error(`Invalid bech32 character: ${address}`);
    data.push(idx);
  }

  // Remove checksum (last 6 chars).
  const payload = data.slice(0, -6);
  const version = payload[0];

  // Convert 5-bit groups to 8-bit bytes.
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  for (const value of payload.slice(1)) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }

  const program = new Uint8Array(result);

  // Build script pubkey: OP_<version> PUSHLEN <program>.
  const opVersion = version === 0 ? 0x00 : 0x50 + version;
  const scriptPubkey = new Uint8Array(2 + program.length);
  scriptPubkey[0] = opVersion;
  scriptPubkey[1] = program.length;
  scriptPubkey.set(program, 2);

  return scriptPubkey;
}

/**
 * Build the app tuple `[tag, identity_bytes, vk_bytes]` used as a CBOR key
 * inside the spell's `app_public_inputs` map.
 */
export function buildAppTuple(
  appId: string,
  appVk: string = NFT_CONTRACT_VK,
): [string, Uint8Array, Uint8Array] {
  return ["n", hexToBytes(appId), hexToBytes(appVk)];
}

/**
 * Build the full app string key `"n/<app_id>/<app_vk>"` used as a JSON key in
 * the top-level `app_private_inputs` map.
 */
export function buildAppKey(
  appId: string,
  appVk: string = NFT_CONTRACT_VK,
): string {
  return `n/${appId}/${appVk}`;
}

/**
 * CBOR-encode an object and return its hex representation. Used for both the
 * spell and the witness payloads.
 */
export function encodeCborHex(value: unknown): string {
  const bytes = cbor.encode(value);
  return bytesToHex(new Uint8Array(bytes));
}

/**
 * The spell's `app_public_inputs` map: keyed by the app tuple, value `null`
 * (empty public input `x`).
 */
export function buildEmptyAppPublicInputs(
  appId: string,
  appVk: string = NFT_CONTRACT_VK,
): Map<unknown, unknown> {
  const map = new Map<unknown, unknown>();
  map.set(buildAppTuple(appId, appVk), null);
  return map;
}

/**
 * Build the standard v15 spell CBOR object, given the spent UTXO, the output
 * NFT state, and the destination script-pubkey.
 *
 * Returns the logical spell object (caller hex-encodes via encodeCborHex).
 */
export function buildSpellObject(params: {
  nftUtxo: { txid: string; vout: number };
  outState: SparkNFTState;
  destScriptPubkey: Uint8Array;
  appId: string;
  appVk?: string;
}): {
  version: number;
  tx: {
    ins: Uint8Array[];
    outs: Map<number, SparkNFTState>[];
    coins: { amount: number; dest: Uint8Array }[];
  };
  app_public_inputs: Map<unknown, unknown>;
} {
  const { nftUtxo, outState, destScriptPubkey, appId, appVk } = params;

  const insBytes = [utxoToBytes(`${nftUtxo.txid}:${nftUtxo.vout}`)];

  const outsMap = new Map<number, SparkNFTState>();
  outsMap.set(0, outState);

  return {
    version: SPELL_VERSION,
    tx: {
      ins: insBytes,
      outs: [outsMap],
      coins: [{ amount: NFT_DUST_SATS, dest: destScriptPubkey }],
    },
    app_public_inputs: buildEmptyAppPublicInputs(appId, appVk),
  };
}
