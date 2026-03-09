/**
 * PSBT Utilities
 *
 * Utilities for converting raw transactions to PSBT format
 * for wallet signing. Required because Charms V11 prover
 * returns unsigned raw transactions.
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import type { MempoolClient } from "../blockchain/mempool";

// Initialize bitcoinjs-lib with secp256k1
bitcoin.initEccLib(ecc);

export interface FundingUtxo {
  txid: string;
  vout: number;
  value: number;
}

/**
 * Encode witness stack as a single buffer for PSBT finalScriptWitness
 * Format: <item_count> <item1_len> <item1> <item2_len> <item2> ...
 */
function witnessStackToScriptWitness(witness: Buffer[]): Buffer {
  let length = 0;
  for (const w of witness) {
    length += varintLength(w.length) + w.length;
  }
  length += varintLength(witness.length);

  const buffer = Buffer.allocUnsafe(length);
  let offset = writeVarint(buffer, witness.length, 0);

  for (const w of witness) {
    offset = writeVarint(buffer, w.length, offset);
    w.copy(buffer, offset);
    offset += w.length;
  }

  return buffer;
}

function varintLength(n: number): number {
  if (n < 0xfd) return 1;
  if (n <= 0xffff) return 3;
  if (n <= 0xffffffff) return 5;
  return 9;
}

function writeVarint(buffer: Buffer, n: number, offset: number): number {
  if (n < 0xfd) {
    buffer.writeUInt8(n, offset);
    return offset + 1;
  } else if (n <= 0xffff) {
    buffer.writeUInt8(0xfd, offset);
    buffer.writeUInt16LE(n, offset + 1);
    return offset + 3;
  } else if (n <= 0xffffffff) {
    buffer.writeUInt8(0xfe, offset);
    buffer.writeUInt32LE(n, offset + 1);
    return offset + 5;
  } else {
    buffer.writeUInt8(0xff, offset);
    buffer.writeUInt32LE(n >>> 0, offset + 1);
    buffer.writeUInt32LE(Math.floor(n / 0x100000000), offset + 5);
    return offset + 9;
  }
}

/**
 * Convert raw transaction hex to PSBT for wallet signing
 *
 * The Charms V11 prover returns unsigned raw transactions for security.
 * This function converts them to PSBTs that can be signed by browser wallets.
 *
 * @param rawTxHex - Raw transaction hex from prover
 * @param fundingUtxo - User's funding UTXO info
 * @param ownerAddress - User's Bitcoin address
 * @param mempoolClient - Mempool client for fetching previous tx
 * @returns PSBT in hex format for wallet signing
 */
export async function rawTxToPsbt(
  rawTxHex: string,
  fundingUtxo: FundingUtxo,
  ownerAddress: string,
  mempoolClient: MempoolClient,
): Promise<string> {
  const network = bitcoin.networks.testnet; // testnet4 uses testnet params

  // Parse the raw transaction
  const tx = bitcoin.Transaction.fromHex(rawTxHex);

  // Create a new PSBT
  const psbt = new bitcoin.Psbt({ network });

  // Get the previous transaction to extract witnessUtxo
  const prevTxHex = await mempoolClient.getTransactionHex(fundingUtxo.txid);
  const prevTx = bitcoin.Transaction.fromHex(prevTxHex);
  const prevOutput = prevTx.outs[fundingUtxo.vout];

  if (!prevOutput) {
    throw new Error(`Previous output not found at vout ${fundingUtxo.vout}`);
  }

  // Track which inputs have witness data from prover
  const inputsWithWitness: Array<{ index: number; witness: Buffer[] }> = [];

  // Add inputs with appropriate witnessUtxo for signing
  for (let i = 0; i < tx.ins.length; i++) {
    const input = tx.ins[i];
    const inputTxid = Buffer.from(input.hash).reverse().toString("hex");

    // Check if this input is our funding UTXO
    if (inputTxid === fundingUtxo.txid && input.index === fundingUtxo.vout) {
      // This is the user's input - needs signing
      const isTaproot =
        ownerAddress.startsWith("tb1p") || ownerAddress.startsWith("bc1p");

      if (isTaproot) {
        // Taproot (P2TR) input
        psbt.addInput({
          hash: input.hash,
          index: input.index,
          sequence: input.sequence,
          witnessUtxo: {
            script: prevOutput.script,
            value: prevOutput.value,
          },
          tapInternalKey: prevOutput.script.subarray(2, 34), // Extract x-only pubkey
        });
      } else {
        // SegWit (P2WPKH) input
        psbt.addInput({
          hash: input.hash,
          index: input.index,
          sequence: input.sequence,
          witnessUtxo: {
            script: prevOutput.script,
            value: prevOutput.value,
          },
        });
      }
    } else {
      // Other inputs (from prover) - add as basic input
      psbt.addInput({
        hash: input.hash,
        index: input.index,
        sequence: input.sequence,
      });

      // If input has witness data, track it for finalization
      if (input.witness && input.witness.length > 0) {
        inputsWithWitness.push({ index: i, witness: input.witness });
      }
    }
  }

  // Finalize inputs that already have witness data from prover
  for (const { index, witness } of inputsWithWitness) {
    psbt.updateInput(index, {
      finalScriptWitness: witnessStackToScriptWitness(witness),
    });
  }

  // Add all outputs
  for (const output of tx.outs) {
    psbt.addOutput({
      script: output.script,
      value: output.value,
    });
  }

  // Return as hex for wallet signing
  return psbt.toHex();
}
