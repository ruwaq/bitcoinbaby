/**
 * CBOR Spell Encoding
 *
 * Encodes Charms spells to CBOR format for the v11 prover API.
 *
 * The Charms prover accepts two formats:
 * - JSON requests: spell = hex-encoded CBOR string
 * - CBOR requests: spell = direct CBOR object
 *
 * IMPORTANT: CBOR uses non-human-readable format for types:
 * - UtxoId: 36 bytes (32 bytes txid + 4 bytes index little-endian)
 * - App: tuple of [tag_char, identity_32_bytes, vk_32_bytes]
 * - Output keys: integers (using Map, not object)
 * - Coins.dest: bytes (script pubkey, not address string)
 *
 * Reference: https://github.com/CharmsDev/charms/blob/main/charms-data/src/lib.rs
 */

import * as cbor from "cbor2";

// =============================================================================
// TYPES
// =============================================================================

/**
 * NormalizedTransaction structure matching Charms format
 */
export interface NormalizedTransaction {
  /** Input UTXOs (format: "txid:index") */
  ins?: string[];
  /** Reference UTXOs */
  refs?: string[];
  /** Output charms - maps app index to data */
  outs: Array<Record<number, unknown>>;
  /** Beamed outputs */
  beamed_outs?: Record<number, string>;
  /** Native coin amounts - dest is script pubkey hex */
  coins?: Array<{ amount: number; dest: string }>;
}

/**
 * NormalizedSpell structure matching Charms format
 */
export interface NormalizedSpell {
  /** Protocol version (11 for current) */
  version: number;
  /** Transaction data */
  tx: NormalizedTransaction;
  /** Maps App strings to public input data */
  app_public_inputs: Record<string, unknown>;
  /** Mock mode */
  mock?: boolean;
}

/**
 * Full prover request structure
 */
export interface ProverRequest {
  /** Hex-encoded CBOR spell */
  spell: string;
  /** App private inputs (hex-encoded CBOR values) */
  app_private_inputs?: Record<string, string>;
  /** Beamed source UTXOs */
  tx_ins_beamed_source_utxos?: Record<number, [string, number?]>;
  /** App binaries (base64) */
  binaries?: Record<string, string>;
  /** Previous transactions */
  prev_txs?: Array<{ bitcoin?: string; cardano?: string }>;
  /** Change address */
  change_address: string;
  /** Fee rate in sats/vB */
  fee_rate: number;
  /** Target chain */
  chain: "bitcoin" | "cardano";
  /** Collateral UTXO (Cardano only) */
  collateral_utxo?: string;
}

// =============================================================================
// CBOR TYPE CONVERSIONS
// =============================================================================

/**
 * Convert UTXO string "txid:index" to 36-byte array for CBOR
 *
 * Format: [32 bytes txid] + [4 bytes index little-endian]
 *
 * IMPORTANT: Bitcoin txids are displayed in reverse byte order!
 * The displayed txid "abcd..." corresponds to bytes [..., cd, ab]
 * We need to reverse the bytes when converting to the internal format.
 */
function utxoIdToBytes(utxoStr: string): Uint8Array {
  const parts = utxoStr.split(":");
  if (parts.length !== 2) {
    throw new Error(`Invalid UTXO format: ${utxoStr}, expected "txid:index"`);
  }

  const txidHex = parts[0];
  const index = parseInt(parts[1], 10);

  if (txidHex.length !== 64) {
    throw new Error(
      `Invalid txid length: ${txidHex.length}, expected 64 hex chars`,
    );
  }

  const bytes = new Uint8Array(36);

  // First 32 bytes: txid (hex to bytes, REVERSED)
  // Bitcoin txids are displayed in reverse byte order
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(txidHex.substr((31 - i) * 2, 2), 16);
  }

  // Last 4 bytes: index as little-endian u32
  bytes[32] = index & 0xff;
  bytes[33] = (index >> 8) & 0xff;
  bytes[34] = (index >> 16) & 0xff;
  bytes[35] = (index >> 24) & 0xff;

  return bytes;
}

/**
 * Convert App string "tag/identity/vk" to CBOR tuple
 *
 * Format: [tag_char, identity_32_bytes, vk_32_bytes]
 */
function appToTuple(appStr: string): [string, Uint8Array, Uint8Array] {
  const parts = appStr.split("/");
  if (parts.length !== 3) {
    throw new Error(
      `Invalid App format: ${appStr}, expected "tag/identity/vk"`,
    );
  }

  const [tag, identityHex, vkHex] = parts;

  if (tag.length !== 1) {
    throw new Error(`Invalid tag length: ${tag.length}, expected 1 char`);
  }

  if (identityHex.length !== 64) {
    throw new Error(
      `Invalid identity length: ${identityHex.length}, expected 64 hex chars`,
    );
  }

  if (vkHex.length !== 64) {
    throw new Error(
      `Invalid vk length: ${vkHex.length}, expected 64 hex chars`,
    );
  }

  const identity = hexToBytes(identityHex);
  const vk = hexToBytes(vkHex);

  return [tag, identity, vk];
}

/**
 * Convert output object to Map with integer keys
 *
 * JavaScript object keys are always strings, but CBOR expects integer keys.
 */
function outputToIntKeyMap(
  output: Record<number, unknown>,
): Map<number, unknown> {
  const map = new Map<number, unknown>();
  for (const [key, value] of Object.entries(output)) {
    map.set(parseInt(key, 10), value);
  }
  return map;
}

/**
 * Convert spell to CBOR-compatible format with proper type encoding
 */
function spellToCborFormat(spell: NormalizedSpell): unknown {
  // Convert tx.ins from strings to bytes
  const tx: Record<string, unknown> = {};

  if (spell.tx.ins) {
    tx.ins = spell.tx.ins.map((utxo) => utxoIdToBytes(utxo));
  }

  if (spell.tx.refs) {
    tx.refs = spell.tx.refs.map((utxo) => utxoIdToBytes(utxo));
  }

  // Convert outputs to Maps with integer keys
  tx.outs = spell.tx.outs.map((output) => outputToIntKeyMap(output));

  if (spell.tx.beamed_outs) {
    tx.beamed_outs = spell.tx.beamed_outs;
  }

  // Convert coins.dest from hex string to bytes
  if (spell.tx.coins) {
    tx.coins = spell.tx.coins.map((coin) => ({
      amount: coin.amount,
      dest: hexToBytes(coin.dest),
    }));
  }

  // Convert app_public_inputs keys from strings to tuples
  const appPublicInputs = new Map<unknown, unknown>();
  for (const [appStr, data] of Object.entries(spell.app_public_inputs)) {
    const appTuple = appToTuple(appStr);
    appPublicInputs.set(appTuple, data);
  }

  const cborSpell: Record<string, unknown> = {
    version: spell.version,
    tx,
    app_public_inputs: appPublicInputs,
  };

  if (spell.mock) {
    cborSpell.mock = spell.mock;
  }

  return cborSpell;
}

// =============================================================================
// CBOR ENCODING
// =============================================================================

/**
 * Encode a NormalizedSpell to hex-encoded CBOR
 *
 * Converts the spell to CBOR format with:
 * - UtxoId as 36-byte arrays
 * - App as [tag, identity_bytes, vk_bytes] tuples
 *
 * @param spell - The spell object to encode
 * @returns Hex-encoded CBOR bytes
 */
export function encodeSpellToCbor(spell: NormalizedSpell): string {
  // Convert to CBOR-compatible format
  const cborSpell = spellToCborFormat(spell);

  // Encode to CBOR bytes
  const cborBytes = cbor.encode(cborSpell);

  // Convert to hex string
  return bytesToHex(cborBytes);
}

/**
 * Encode app private inputs to hex-encoded CBOR
 *
 * @param inputs - The private inputs object
 * @returns Hex-encoded CBOR bytes
 */
export function encodePrivateInputsToCbor(
  inputs: Record<string, unknown>,
): string {
  const cborBytes = cbor.encode(inputs);
  return bytesToHex(cborBytes);
}

/**
 * Build a complete prover request with CBOR-encoded spell (for JSON requests)
 *
 * @param spell - The normalized spell
 * @param options - Additional request options
 * @returns Complete prover request ready to send as JSON
 */
export function buildProverRequest(
  spell: NormalizedSpell,
  options: {
    changeAddress: string;
    feeRate?: number;
    chain?: "bitcoin" | "cardano";
    appPrivateInputs?: Record<string, unknown>;
    prevTxs?: string[];
    /** App binaries - can be base64 string or Uint8Array */
    binaries?: Record<string, string | Uint8Array>;
  },
): ProverRequest {
  // Encode spell to CBOR hex
  const spellHex = encodeSpellToCbor(spell);

  // Ensure fee_rate is a float (not integer) - add small decimal if needed
  let feeRate = options.feeRate ?? 2.0;
  if (Number.isInteger(feeRate)) {
    feeRate = feeRate + 0.0001; // Force float representation
  }

  // Build request
  const request: ProverRequest = {
    spell: spellHex,
    change_address: options.changeAddress,
    fee_rate: feeRate,
    chain: options.chain ?? "bitcoin",
  };

  // Add app_private_inputs if provided
  if (options.appPrivateInputs) {
    request.app_private_inputs = {};
    for (const [appKey, inputs] of Object.entries(options.appPrivateInputs)) {
      request.app_private_inputs[appKey] = encodePrivateInputsToCbor(
        inputs as Record<string, unknown>,
      );
    }
  }

  // Add prev_txs in chain-tagged format
  if (options.prevTxs && options.prevTxs.length > 0) {
    request.prev_txs = options.prevTxs.map((txHex) => ({
      bitcoin: txHex,
    }));
  }

  // Add binaries if provided
  if (options.binaries) {
    request.binaries = {};
    for (const [vk, binary] of Object.entries(options.binaries)) {
      // Accept both base64 string or Uint8Array
      request.binaries[vk] =
        typeof binary === "string" ? binary : bytesToBase64(binary);
    }
  }

  return request;
}

/**
 * CBOR Request structure for native CBOR transport
 */
export interface CborProverRequest {
  /** Spell as direct object (not hex) */
  spell: unknown;
  /** App private inputs (CBOR objects, not hex) */
  app_private_inputs?: Record<string, unknown>;
  /** Previous transactions */
  prev_txs?: Array<{ bitcoin?: string; cardano?: string }>;
  /** Change address */
  change_address: string;
  /** Fee rate in sats/vB (must be float) */
  fee_rate: number;
  /** Target chain */
  chain: "bitcoin" | "cardano";
}

/**
 * Build a CBOR-native prover request (spell as direct object)
 *
 * Use this when sending requests with Content-Type: application/cbor
 *
 * @param spell - The normalized spell
 * @param options - Additional request options
 * @returns Complete request to encode with cbor.encode()
 */
export function buildCborProverRequest(
  spell: NormalizedSpell,
  options: {
    changeAddress: string;
    feeRate?: number;
    chain?: "bitcoin" | "cardano";
    appPrivateInputs?: Record<string, unknown>;
    prevTxs?: string[];
  },
): CborProverRequest {
  // Convert spell to CBOR-compatible format (direct object)
  const cborSpell = spellToCborFormat(spell);

  // Ensure fee_rate is a float (not integer) - add small decimal if needed
  let feeRate = options.feeRate ?? 2.0;
  if (Number.isInteger(feeRate)) {
    feeRate = feeRate + 0.0001;
  }

  // Build request
  const request: CborProverRequest = {
    spell: cborSpell,
    change_address: options.changeAddress,
    fee_rate: feeRate,
    chain: options.chain ?? "bitcoin",
  };

  // Add app_private_inputs directly (not hex encoded for CBOR)
  if (options.appPrivateInputs) {
    request.app_private_inputs = options.appPrivateInputs;
  }

  // Add prev_txs in chain-tagged format
  if (options.prevTxs && options.prevTxs.length > 0) {
    request.prev_txs = options.prevTxs.map((txHex) => ({
      bitcoin: txHex,
    }));
  }

  return request;
}

/**
 * Encode a CBOR prover request to bytes
 *
 * @param request - The CBOR prover request
 * @returns CBOR-encoded bytes ready to send
 */
export function encodeCborRequest(request: CborProverRequest): Uint8Array {
  return cbor.encode(request);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Convert Uint8Array to base64 string
 * Handles large arrays by processing in chunks to avoid stack overflow
 */
function bytesToBase64(bytes: Uint8Array): string {
  // Process in chunks to avoid stack overflow with large arrays
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// =============================================================================
// ADDRESS TO SCRIPT PUBKEY
// =============================================================================

/**
 * Bech32 character map
 */
const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/**
 * Decode bech32/bech32m address to witness program
 *
 * Supports:
 * - P2WPKH (bc1q.../tb1q...): 20-byte witness program
 * - P2TR (bc1p.../tb1p...): 32-byte witness program
 */
function decodeBech32(
  address: string,
): { version: number; program: Uint8Array } | null {
  const pos = address.lastIndexOf("1");
  if (pos < 1 || pos + 7 > address.length) return null;

  const data: number[] = [];
  for (let i = pos + 1; i < address.length; i++) {
    const idx = BECH32_CHARSET.indexOf(address.charAt(i).toLowerCase());
    if (idx === -1) return null;
    data.push(idx);
  }

  // Remove checksum (last 6 chars)
  const payload = data.slice(0, -6);
  if (payload.length < 1) return null;

  const version = payload[0];
  if (version > 16) return null;

  // Convert 5-bit groups to 8-bit bytes
  const witnessProgram = convert5to8(payload.slice(1));
  if (!witnessProgram) return null;

  return { version, program: witnessProgram };
}

/**
 * Convert 5-bit array to 8-bit bytes
 */
function convert5to8(data: number[]): Uint8Array | null {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];

  for (const value of data) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      result.push((acc >> bits) & 0xff);
    }
  }

  // Check for invalid padding
  if (bits >= 5 || (acc & ((1 << bits) - 1)) !== 0) {
    return null;
  }

  return new Uint8Array(result);
}

/**
 * Convert Bitcoin address to script pubkey hex
 *
 * Supports bech32 addresses:
 * - P2WPKH (tb1q/bc1q): OP_0 <20-byte hash> → 0014{40 hex chars}
 * - P2TR (tb1p/bc1p): OP_1 <32-byte key> → 5120{64 hex chars}
 *
 * @param address - Bitcoin bech32 address
 * @returns Script pubkey as hex string
 */
export function addressToScriptPubkey(address: string): string {
  const decoded = decodeBech32(address);
  if (!decoded) {
    throw new Error(`Invalid bech32 address: ${address}`);
  }

  const { version, program } = decoded;

  // Build script pubkey
  // OP_0 = 0x00, OP_1 = 0x51, OP_2 = 0x52, etc.
  // Push data: length byte followed by data
  const opVersion = version === 0 ? 0x00 : 0x50 + version;
  const pushLength = program.length;

  const scriptPubkey = new Uint8Array(2 + program.length);
  scriptPubkey[0] = opVersion;
  scriptPubkey[1] = pushLength;
  scriptPubkey.set(program, 2);

  return bytesToHex(scriptPubkey);
}

/**
 * NFT dust output amount (minimum for Charms NFTs)
 */
export const NFT_DUST_SATS = 330;
