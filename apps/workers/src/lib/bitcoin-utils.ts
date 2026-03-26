/**
 * Bitcoin Utilities
 *
 * Centralized Bitcoin-specific utilities for address conversion,
 * UTXO handling, and transaction building helpers.
 */

import { hexToBytes, bytesToHex, reverseBytes } from "./encoding";

// =============================================================================
// BECH32/BECH32M DECODING
// =============================================================================

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

/**
 * Decode bech32/bech32m address to get witness version and program
 */
export function decodeBech32Address(address: string): {
  hrp: string;
  version: number;
  program: Uint8Array;
} {
  // Find separator
  const sepIndex = address.lastIndexOf("1");
  if (sepIndex < 1 || sepIndex + 7 > address.length) {
    throw new Error("Invalid bech32 address");
  }

  const hrp = address.slice(0, sepIndex).toLowerCase();
  const data = address.slice(sepIndex + 1).toLowerCase();

  // Decode data
  const values: number[] = [];
  for (const char of data) {
    const value = BECH32_CHARSET.indexOf(char);
    if (value === -1) {
      throw new Error(`Invalid character in bech32 address: ${char}`);
    }
    values.push(value);
  }

  // Remove checksum (last 6 values)
  const dataValues = values.slice(0, -6);

  // First value is witness version
  const version = dataValues[0];
  if (version > 16) {
    throw new Error(`Invalid witness version: ${version}`);
  }

  // Convert 5-bit values to 8-bit bytes
  const program = convert5to8(dataValues.slice(1));

  return { hrp, version, program };
}

/**
 * Convert 5-bit array to 8-bit array
 */
function convert5to8(data: number[]): Uint8Array {
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

  return new Uint8Array(result);
}

// =============================================================================
// ADDRESS TO SCRIPT CONVERSION
// =============================================================================

/**
 * Convert Bitcoin address to scriptPubkey
 * Supports P2WPKH (bc1q/tb1q) and P2TR (bc1p/tb1p)
 */
export function addressToScriptPubkey(address: string): Uint8Array {
  const { version, program } = decodeBech32Address(address);

  if (version === 0 && program.length === 20) {
    // P2WPKH: OP_0 <20-byte-hash>
    return new Uint8Array([0x00, 0x14, ...program]);
  } else if (version === 1 && program.length === 32) {
    // P2TR: OP_1 <32-byte-key>
    return new Uint8Array([0x51, 0x20, ...program]);
  } else {
    throw new Error(
      `Unsupported witness version ${version} or program length ${program.length}`,
    );
  }
}

/**
 * Get x-only public key from P2TR address
 */
export function getXOnlyPubkeyFromAddress(address: string): Uint8Array {
  const { version, program } = decodeBech32Address(address);

  if (version !== 1 || program.length !== 32) {
    throw new Error("Address is not P2TR");
  }

  return program;
}

// =============================================================================
// UTXO HANDLING
// =============================================================================

/**
 * UTXO structure
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status?: {
    confirmed: boolean;
    block_height?: number;
  };
}

/**
 * Convert UTXO to 36-byte outpoint format
 * Format: txid (32 bytes LE) + vout (4 bytes LE)
 */
export function utxoToOutpoint(txid: string, vout: number): Uint8Array {
  // Convert txid from hex and reverse for little-endian
  const txidBytes = reverseBytes(hexToBytes(txid));

  // Convert vout to 4-byte little-endian
  const voutBytes = new Uint8Array(4);
  voutBytes[0] = vout & 0xff;
  voutBytes[1] = (vout >> 8) & 0xff;
  voutBytes[2] = (vout >> 16) & 0xff;
  voutBytes[3] = (vout >> 24) & 0xff;

  // Concatenate
  const result = new Uint8Array(36);
  result.set(txidBytes, 0);
  result.set(voutBytes, 32);

  return result;
}

/**
 * Convert UTXO string (txid:vout) to outpoint bytes
 */
export function utxoStringToOutpoint(utxoStr: string): Uint8Array {
  const [txid, voutStr] = utxoStr.split(":");
  if (!txid || !voutStr) {
    throw new Error(`Invalid UTXO string format: ${utxoStr}`);
  }
  return utxoToOutpoint(txid, parseInt(voutStr, 10));
}

/**
 * Convert outpoint bytes back to UTXO string
 */
export function outpointToUtxoString(outpoint: Uint8Array): string {
  if (outpoint.length !== 36) {
    throw new Error("Outpoint must be 36 bytes");
  }

  // Extract and reverse txid
  const txidBytes = reverseBytes(outpoint.slice(0, 32));
  const txid = bytesToHex(txidBytes);

  // Extract vout (little-endian)
  const vout =
    outpoint[32] |
    (outpoint[33] << 8) |
    (outpoint[34] << 16) |
    (outpoint[35] << 24);

  return `${txid}:${vout}`;
}

// =============================================================================
// UTXO SELECTION
// =============================================================================

/**
 * Select best UTXO for a transaction
 * Strategy: Select largest UTXO that meets minimum requirement
 */
export function selectBestUtxo(
  utxos: UTXO[],
  minValue: number,
  preferConfirmed: boolean = true,
): UTXO | null {
  // Filter by minimum value
  let candidates = utxos.filter((utxo) => utxo.value >= minValue);

  // Prefer confirmed if requested
  if (preferConfirmed) {
    const confirmed = candidates.filter((utxo) => utxo.status?.confirmed);
    if (confirmed.length > 0) {
      candidates = confirmed;
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // Return largest
  return candidates.reduce((best, current) =>
    current.value > best.value ? current : best,
  );
}

/**
 * Calculate total value of UTXOs
 */
export function calculateTotalValue(utxos: UTXO[]): number {
  return utxos.reduce((sum, utxo) => sum + utxo.value, 0);
}

// =============================================================================
// TRANSACTION HELPERS
// =============================================================================

/**
 * Calculate double SHA256 of data (Bitcoin standard)
 */
export async function doubleSha256(data: Uint8Array): Promise<Uint8Array> {
  const first = await crypto.subtle.digest("SHA-256", data);
  const second = await crypto.subtle.digest("SHA-256", first);
  return new Uint8Array(second);
}

/**
 * Extract txid from raw transaction hex
 * txid = reversed double SHA256 of serialized tx
 */
export async function extractTxid(txHex: string): Promise<string> {
  const txBytes = hexToBytes(txHex);
  const hash = await doubleSha256(txBytes);
  return bytesToHex(reverseBytes(hash));
}

/**
 * Build OP_RETURN script
 * @param data - Data to include (max 80 bytes)
 */
export function buildOpReturnScript(data: Uint8Array): Uint8Array {
  if (data.length > 80) {
    throw new Error("OP_RETURN data cannot exceed 80 bytes");
  }

  // OP_RETURN (0x6a) + push opcode + data
  if (data.length <= 75) {
    // Direct push
    return new Uint8Array([0x6a, data.length, ...data]);
  } else {
    // OP_PUSHDATA1
    return new Uint8Array([0x6a, 0x4c, data.length, ...data]);
  }
}
