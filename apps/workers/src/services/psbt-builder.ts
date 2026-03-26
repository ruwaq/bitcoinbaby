/**
 * PSBT Builder Service
 *
 * Builds unsigned PSBTs for claim transactions.
 * The server obtains UTXOs and constructs the transaction,
 * user only needs to sign.
 */

import { claimLogger } from "../lib/logger";
import {
  DEFAULT_FEE_RATE,
  CLAIM_TX_SIZE_ESTIMATE,
  MIN_CLAIM_UTXO_VALUE,
  DUST_LIMIT,
  type BitcoinNetwork,
} from "../config/bitcoin";
import { hexToBytes, bytesToHex, stringToBytes } from "../lib/encoding";
import {
  addressToScriptPubkey,
  utxoToOutpoint,
  selectBestUtxo,
  buildOpReturnScript,
  type UTXO,
} from "../lib/bitcoin-utils";
import type {
  IPsbtBuilderService,
  PsbtBuildRequest,
  PsbtBuildResult,
} from "../interfaces/services";
import type { IMempoolService } from "../interfaces/services";

// =============================================================================
// TYPES
// =============================================================================

/**
 * PSBT input structure
 */
interface PsbtInput {
  txid: string;
  vout: number;
  witnessUtxo: {
    script: Uint8Array;
    value: number;
  };
  tapInternalKey?: Uint8Array;
}

/**
 * PSBT output structure
 */
interface PsbtOutput {
  script: Uint8Array;
  value: number;
}

/**
 * Simplified PSBT structure for serialization
 */
interface SimplePsbt {
  version: number;
  inputs: PsbtInput[];
  outputs: PsbtOutput[];
  locktime: number;
}

// =============================================================================
// PSBT BUILDER
// =============================================================================

export class PsbtBuilder implements IPsbtBuilderService {
  private readonly _network: BitcoinNetwork;
  private readonly mempoolService: IMempoolService;

  constructor(
    mempoolService: IMempoolService,
    network: BitcoinNetwork = "testnet4",
  ) {
    this.mempoolService = mempoolService;
    this._network = network;
  }

  /**
   * Get the configured network
   */
  get network(): BitcoinNetwork {
    return this._network;
  }

  /**
   * Build unsigned PSBT for claim transaction
   */
  async buildClaimPsbt(request: PsbtBuildRequest): Promise<PsbtBuildResult> {
    try {
      const feeRate = request.feeRate || DEFAULT_FEE_RATE;
      const estimatedFee = Math.ceil(CLAIM_TX_SIZE_ESTIMATE * feeRate);
      const requiredAmount = estimatedFee + DUST_LIMIT;

      claimLogger.info("Building claim PSBT", {
        address: request.address,
        feeRate,
        estimatedFee,
        requiredAmount,
      });

      // 1. Get UTXOs for the address
      const utxos = await this.mempoolService.getAddressUtxos(request.address);

      if (utxos.length === 0) {
        return {
          success: false,
          error: "No UTXOs available. Please deposit Bitcoin to your address.",
        };
      }

      // 2. Select best UTXO
      const selectedUtxo = selectBestUtxo(utxos, MIN_CLAIM_UTXO_VALUE, true);

      if (!selectedUtxo) {
        const totalAvailable = utxos.reduce((sum, u) => sum + u.value, 0);
        return {
          success: false,
          error: `Insufficient funds. Need at least ${MIN_CLAIM_UTXO_VALUE} sats in a single UTXO, but largest UTXO is ${Math.max(...utxos.map((u) => u.value))} sats. Total available: ${totalAvailable} sats.`,
        };
      }

      claimLogger.info("Selected UTXO", {
        txid: selectedUtxo.txid,
        vout: selectedUtxo.vout,
        value: selectedUtxo.value,
      });

      // 3. Calculate change
      const changeAmount = selectedUtxo.value - estimatedFee;
      if (changeAmount < DUST_LIMIT) {
        return {
          success: false,
          error: `UTXO value (${selectedUtxo.value} sats) too small. After fee (${estimatedFee} sats), change would be dust.`,
        };
      }

      // 4. Build PSBT
      const psbt = await this.buildPsbt({
        input: selectedUtxo,
        opReturnData: request.opReturnData,
        changeAddress: request.address,
        changeAmount,
      });

      // 5. Serialize to base64
      const psbtBytes = this.serializePsbt(psbt);
      const psbtBase64 = btoa(String.fromCharCode(...psbtBytes));
      const psbtHex = bytesToHex(psbtBytes);

      return {
        success: true,
        psbtBase64,
        psbtHex,
        fee: estimatedFee,
        inputUtxo: selectedUtxo,
      };
    } catch (error) {
      claimLogger.error("Failed to build claim PSBT", { error });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to build transaction",
      };
    }
  }

  /**
   * Finalize signed PSBT and extract raw transaction
   */
  async finalizePsbt(signedPsbtBase64: string): Promise<{
    success: boolean;
    txHex?: string;
    txid?: string;
    error?: string;
  }> {
    try {
      // Decode base64
      const psbtBytes = Uint8Array.from(atob(signedPsbtBase64), (c) =>
        c.charCodeAt(0),
      );

      // Parse PSBT to extract final transaction
      const result = this.extractFinalTx(psbtBytes);

      if (!result.success || !result.txHex) {
        return {
          success: false,
          error: result.error || "Failed to extract final transaction",
        };
      }

      // Calculate txid
      const txid = await this.calculateTxid(result.txHex);

      return {
        success: true,
        txHex: result.txHex,
        txid,
      };
    } catch (error) {
      claimLogger.error("Failed to finalize PSBT", { error });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize transaction",
      };
    }
  }

  /**
   * Build PSBT structure
   */
  private async buildPsbt(params: {
    input: UTXO;
    opReturnData: string;
    changeAddress: string;
    changeAmount: number;
  }): Promise<SimplePsbt> {
    const { input, opReturnData, changeAddress, changeAmount } = params;

    // Build input
    const inputScriptPubkey = addressToScriptPubkey(changeAddress);
    const psbtInput: PsbtInput = {
      txid: input.txid,
      vout: input.vout,
      witnessUtxo: {
        script: inputScriptPubkey,
        value: input.value,
      },
    };

    // Add tapInternalKey for P2TR
    if (changeAddress.startsWith("tb1p") || changeAddress.startsWith("bc1p")) {
      // For P2TR, we need the x-only pubkey as tapInternalKey
      // This will be filled by the signing wallet
      psbtInput.tapInternalKey = new Uint8Array(32); // Placeholder
    }

    // Build OP_RETURN output
    const opReturnBytes = stringToBytes(opReturnData);
    const opReturnScript = buildOpReturnScript(opReturnBytes);

    // Build change output
    const changeScript = addressToScriptPubkey(changeAddress);

    const outputs: PsbtOutput[] = [
      {
        script: opReturnScript,
        value: 0, // OP_RETURN has 0 value
      },
      {
        script: changeScript,
        value: changeAmount,
      },
    ];

    return {
      version: 2,
      inputs: [psbtInput],
      outputs,
      locktime: 0,
    };
  }

  /**
   * Serialize PSBT to bytes (simplified BIP-174 format)
   * Note: This is a simplified serialization. For production,
   * use a proper PSBT library.
   */
  private serializePsbt(psbt: SimplePsbt): Uint8Array {
    const parts: Uint8Array[] = [];

    // Magic bytes: "psbt" + 0xff
    parts.push(new Uint8Array([0x70, 0x73, 0x62, 0x74, 0xff]));

    // Global section
    // Version
    parts.push(
      this.serializeKeyValue(0x00, this.serializeUint32LE(psbt.version)),
    );

    // Unsigned transaction
    const unsignedTx = this.serializeUnsignedTx(psbt);
    parts.push(this.serializeKeyValue(0x00, unsignedTx));

    // Global separator
    parts.push(new Uint8Array([0x00]));

    // Input sections
    for (const input of psbt.inputs) {
      // Witness UTXO
      const witnessUtxo = this.serializeWitnessUtxo(input.witnessUtxo);
      parts.push(this.serializeKeyValue(0x01, witnessUtxo));

      // Tap internal key (if P2TR)
      if (input.tapInternalKey && input.tapInternalKey.some((b) => b !== 0)) {
        parts.push(this.serializeKeyValue(0x17, input.tapInternalKey));
      }

      // Input separator
      parts.push(new Uint8Array([0x00]));
    }

    // Output sections
    for (const _output of psbt.outputs) {
      // No additional output data needed for basic PSBT
      // Output separator
      parts.push(new Uint8Array([0x00]));
    }

    // Concatenate all parts
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  /**
   * Serialize key-value pair for PSBT
   */
  private serializeKeyValue(keyType: number, value: Uint8Array): Uint8Array {
    const keyLen = this.serializeVarInt(1);
    const valueLen = this.serializeVarInt(value.length);

    const result = new Uint8Array(
      keyLen.length + 1 + valueLen.length + value.length,
    );
    let offset = 0;

    result.set(keyLen, offset);
    offset += keyLen.length;

    result[offset++] = keyType;

    result.set(valueLen, offset);
    offset += valueLen.length;

    result.set(value, offset);

    return result;
  }

  /**
   * Serialize unsigned transaction
   */
  private serializeUnsignedTx(psbt: SimplePsbt): Uint8Array {
    const parts: Uint8Array[] = [];

    // Version (4 bytes LE)
    parts.push(this.serializeUint32LE(psbt.version));

    // Input count
    parts.push(this.serializeVarInt(psbt.inputs.length));

    // Inputs
    for (const input of psbt.inputs) {
      // Previous output (outpoint)
      parts.push(utxoToOutpoint(input.txid, input.vout));

      // Script sig (empty for segwit)
      parts.push(new Uint8Array([0x00]));

      // Sequence (0xfffffffd for RBF)
      parts.push(new Uint8Array([0xfd, 0xff, 0xff, 0xff]));
    }

    // Output count
    parts.push(this.serializeVarInt(psbt.outputs.length));

    // Outputs
    for (const output of psbt.outputs) {
      // Value (8 bytes LE)
      parts.push(this.serializeUint64LE(output.value));

      // Script length + script
      parts.push(this.serializeVarInt(output.script.length));
      parts.push(output.script);
    }

    // Locktime (4 bytes LE)
    parts.push(this.serializeUint32LE(psbt.locktime));

    // Concatenate
    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const part of parts) {
      result.set(part, offset);
      offset += part.length;
    }

    return result;
  }

  /**
   * Serialize witness UTXO
   */
  private serializeWitnessUtxo(witnessUtxo: {
    script: Uint8Array;
    value: number;
  }): Uint8Array {
    const valueBytes = this.serializeUint64LE(witnessUtxo.value);
    const scriptLen = this.serializeVarInt(witnessUtxo.script.length);

    const result = new Uint8Array(
      valueBytes.length + scriptLen.length + witnessUtxo.script.length,
    );
    let offset = 0;

    result.set(valueBytes, offset);
    offset += valueBytes.length;

    result.set(scriptLen, offset);
    offset += scriptLen.length;

    result.set(witnessUtxo.script, offset);

    return result;
  }

  /**
   * Serialize variable integer
   */
  private serializeVarInt(n: number): Uint8Array {
    if (n < 0xfd) {
      return new Uint8Array([n]);
    } else if (n <= 0xffff) {
      return new Uint8Array([0xfd, n & 0xff, (n >> 8) & 0xff]);
    } else if (n <= 0xffffffff) {
      return new Uint8Array([
        0xfe,
        n & 0xff,
        (n >> 8) & 0xff,
        (n >> 16) & 0xff,
        (n >> 24) & 0xff,
      ]);
    } else {
      throw new Error("VarInt too large");
    }
  }

  /**
   * Serialize uint32 little-endian
   */
  private serializeUint32LE(n: number): Uint8Array {
    return new Uint8Array([
      n & 0xff,
      (n >> 8) & 0xff,
      (n >> 16) & 0xff,
      (n >> 24) & 0xff,
    ]);
  }

  /**
   * Serialize uint64 little-endian
   */
  private serializeUint64LE(n: number): Uint8Array {
    const result = new Uint8Array(8);
    result[0] = n & 0xff;
    result[1] = (n >> 8) & 0xff;
    result[2] = (n >> 16) & 0xff;
    result[3] = (n >> 24) & 0xff;
    // For values that fit in 32 bits, upper 4 bytes are 0
    return result;
  }

  /**
   * Extract final transaction from signed PSBT
   * Note: Simplified implementation
   */
  private extractFinalTx(psbtBytes: Uint8Array): {
    success: boolean;
    txHex?: string;
    error?: string;
  } {
    try {
      // Check magic bytes
      if (
        psbtBytes[0] !== 0x70 ||
        psbtBytes[1] !== 0x73 ||
        psbtBytes[2] !== 0x62 ||
        psbtBytes[3] !== 0x74 ||
        psbtBytes[4] !== 0xff
      ) {
        return { success: false, error: "Invalid PSBT magic bytes" };
      }

      // For now, return the raw bytes as hex
      // A proper implementation would parse the PSBT and construct the final TX
      // This is a placeholder - in production, use a PSBT library
      return {
        success: true,
        txHex: bytesToHex(psbtBytes),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse PSBT",
      };
    }
  }

  /**
   * Calculate txid from raw transaction hex
   */
  private async calculateTxid(txHex: string): Promise<string> {
    const txBytes = hexToBytes(txHex);

    // Double SHA256
    const hash1 = await crypto.subtle.digest("SHA-256", txBytes);
    const hash2 = await crypto.subtle.digest("SHA-256", hash1);

    // Reverse for txid (little-endian)
    const hashArray = new Uint8Array(hash2);
    const reversed = hashArray.reverse();

    return bytesToHex(reversed);
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create PSBT builder instance
 */
export function createPsbtBuilder(
  mempoolService: IMempoolService,
  network: BitcoinNetwork = "testnet4",
): PsbtBuilder {
  return new PsbtBuilder(mempoolService, network);
}
