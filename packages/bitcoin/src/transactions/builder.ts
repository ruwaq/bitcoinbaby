/**
 * Transaction Builder
 *
 * Builds Bitcoin transactions with Charms spell support.
 * Uses bitcoinjs-lib for transaction construction.
 */

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import type { BitcoinNetwork } from "../types";
import type { UTXO } from "../blockchain/types";
import type { SpellConfig } from "../scrolls/types";
import type { SpellV2, SpellV10 } from "../charms/types";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("TxBuilder");

// Spell type union - supports v1, v2, and v10 formats
type Spell = SpellConfig | SpellV2 | SpellV10;
import type {
  TxUTXO,
  TxInput,
  TxOutput,
  UnsignedTx,
  SignedTx,
  CoinSelection,
  FeeEstimate,
  TxBuilderOptions,
  CharmsTx,
} from "./types";
import { encodeSpellForWitness, calculateSpellSize } from "./spell-encoder";

// Initialize ECC library
bitcoin.initEccLib(ecc);

// Network configurations
const NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

// Default values
const DEFAULT_DUST_THRESHOLD = 546;
const DEFAULT_FEE_RATE = 10; // sat/vB
const RBF_SEQUENCE = 0xfffffffd;
const FINAL_SEQUENCE = 0xffffffff;

/**
 * Virtual byte estimates per input type
 * Based on typical spending conditions
 */
const INPUT_VBYTES = {
  P2TR: 57.5, // Taproot key path spend
  P2WPKH: 68, // Native SegWit
  P2SH_P2WPKH: 91, // Wrapped SegWit
  P2PKH: 148, // Legacy
  UNKNOWN: 100, // Conservative fallback
} as const;

/**
 * Output vbytes per type
 */
const OUTPUT_VBYTES = {
  P2TR: 43, // Taproot
  P2WPKH: 31, // Native SegWit
  P2SH: 32, // Script hash
  P2PKH: 34, // Legacy
} as const;

/**
 * Detect input type from scriptPubKey or witnessUtxo
 */
function detectInputType(utxo: TxUTXO): keyof typeof INPUT_VBYTES {
  // Try to detect from witnessUtxo script
  if (utxo.witnessUtxo?.script) {
    const script = utxo.witnessUtxo.script;
    if (script.length === 34 && script[0] === 0x51 && script[1] === 0x20) {
      return "P2TR"; // OP_1 <32-byte-x-only-pubkey>
    }
    if (script.length === 22 && script[0] === 0x00 && script[1] === 0x14) {
      return "P2WPKH"; // OP_0 <20-byte-pubkey-hash>
    }
  }

  // Try to detect from scriptPubKey hex
  if (utxo.scriptPubKey) {
    const spk = utxo.scriptPubKey.toLowerCase();
    // P2TR: 5120<64-hex> (34 bytes)
    if (spk.length === 68 && spk.startsWith("5120")) {
      return "P2TR";
    }
    // P2WPKH: 0014<40-hex> (22 bytes)
    if (spk.length === 44 && spk.startsWith("0014")) {
      return "P2WPKH";
    }
    // P2SH: a914<40-hex>87 (23 bytes)
    if (spk.length === 46 && spk.startsWith("a914") && spk.endsWith("87")) {
      return "P2SH_P2WPKH";
    }
    // P2PKH: 76a914<40-hex>88ac (25 bytes)
    if (spk.length === 50 && spk.startsWith("76a914") && spk.endsWith("88ac")) {
      return "P2PKH";
    }
  }

  // If tapInternalKey is present, it's almost certainly P2TR
  if (utxo.tapInternalKey) {
    return "P2TR";
  }

  return "UNKNOWN";
}

/**
 * Calculate input vbytes based on UTXO type
 */
function getInputVbytes(utxo: TxUTXO): number {
  const inputType = detectInputType(utxo);
  return INPUT_VBYTES[inputType];
}

/**
 * Transaction Builder for Bitcoin + Charms
 */
export class TransactionBuilder {
  private readonly network: BitcoinNetwork;
  private readonly networkConfig: bitcoin.Network;
  private readonly dustThreshold: number;
  private readonly enableRBF: boolean;
  private feeRate: number;

  constructor(options: TxBuilderOptions) {
    this.network = options.network;
    this.networkConfig = NETWORKS[this.network];
    this.dustThreshold = options.dustThreshold ?? DEFAULT_DUST_THRESHOLD;
    this.enableRBF = options.enableRBF ?? true;
    this.feeRate = options.feeRate ?? DEFAULT_FEE_RATE;
  }

  /**
   * Set fee rate
   */
  setFeeRate(satPerVB: number): void {
    this.feeRate = satPerVB;
  }

  /**
   * Select coins for transaction
   */
  selectCoins(
    utxos: TxUTXO[],
    targetAmount: number,
    extraOutputs: number = 0,
  ): CoinSelection {
    // Sort by value descending for efficiency
    const sorted = [...utxos].sort((a, b) => b.value - a.value);

    const selected: TxUTXO[] = [];
    let totalInputValue = 0;

    // Estimate fee based on actual UTXO types
    const estimateFee = (selectedUtxos: TxUTXO[]): number => {
      // Calculate input vbytes based on actual UTXO types
      const inputVbytes = selectedUtxos.reduce(
        (sum, utxo) => sum + getInputVbytes(utxo),
        0,
      );
      // P2TR output: ~43 vbytes (we output to Taproot by default)
      const outputVbytes = (2 + extraOutputs) * OUTPUT_VBYTES.P2TR;
      const baseVbytes = 10.5; // Transaction overhead
      return Math.ceil(
        (inputVbytes + outputVbytes + baseVbytes) * this.feeRate,
      );
    };

    // Select coins
    for (const utxo of sorted) {
      selected.push(utxo);
      totalInputValue += utxo.value;

      const fee = estimateFee(selected);
      const required = targetAmount + fee + this.dustThreshold;

      if (totalInputValue >= required) {
        break;
      }
    }

    const fee = estimateFee(selected);
    const change = totalInputValue - targetAmount - fee;

    if (change < 0) {
      throw new Error(
        `Insufficient funds: need ${targetAmount + fee} sats, have ${totalInputValue} sats`,
      );
    }

    return {
      inputs: selected,
      totalInputValue,
      change: change >= this.dustThreshold ? change : 0,
      fee: change >= this.dustThreshold ? fee : fee + change,
    };
  }

  /**
   * Build a simple transfer transaction
   */
  buildTransfer(
    inputs: TxUTXO[],
    recipient: string,
    amount: number,
    changeAddress: string,
  ): UnsignedTx {
    const totalInput = inputs.reduce((sum, u) => sum + u.value, 0);

    // Estimate fee using actual UTXO types
    const vsize = this.estimateVsize(inputs, 2);
    const fee = Math.ceil(vsize * this.feeRate);

    const change = totalInput - amount - fee;

    if (change < 0) {
      throw new Error(`Insufficient funds for transfer`);
    }

    const outputs: TxOutput[] = [{ address: recipient, value: amount }];

    if (change >= this.dustThreshold) {
      outputs.push({ address: changeAddress, value: change });
    }

    return {
      inputs: inputs.map((utxo) => ({
        utxo,
        sequence: this.enableRBF ? RBF_SEQUENCE : FINAL_SEQUENCE,
      })),
      outputs,
      fee: change >= this.dustThreshold ? fee : fee + change,
      changeAddress,
      network: this.network,
    };
  }

  /**
   * Build a mining transaction with Charms spell
   */
  buildMiningTx(
    inputs: TxUTXO[],
    minerAddress: string,
    spell: Spell,
    charmsFeeAddress: string,
    charmsFee: number,
  ): CharmsTx {
    const totalInput = inputs.reduce((sum, u) => sum + u.value, 0);

    // Calculate spell witness size
    const spellSize = calculateSpellSize(spell);

    // Estimate fee using actual UTXO types (includes spell witness)
    const baseVsize = this.estimateVsize(inputs, 3); // miner + charms fee + change
    const spellVsize = Math.ceil(spellSize / 4); // Witness discount
    const vsize = baseVsize + spellVsize;
    const btcFee = Math.ceil(vsize * this.feeRate);

    const totalFees = btcFee + charmsFee;
    const change = totalInput - totalFees;

    if (change < 0) {
      throw new Error(
        `Insufficient funds: need ${totalFees} sats for fees, have ${totalInput} sats`,
      );
    }

    // Outputs: Charms fee output + change to miner
    const outputs: TxOutput[] = [
      { address: charmsFeeAddress, value: charmsFee },
    ];

    if (change >= this.dustThreshold) {
      outputs.push({ address: minerAddress, value: change });
    }

    // Encode spell for witness
    const spellWitness = encodeSpellForWitness(spell);

    return {
      inputs: inputs.map((utxo) => ({
        utxo,
        sequence: this.enableRBF ? RBF_SEQUENCE : FINAL_SEQUENCE,
      })),
      outputs,
      fee: btcFee,
      changeAddress: minerAddress,
      network: this.network,
      spell,
      spellWitness,
    };
  }

  /**
   * Build mining TX with OP_RETURN (BRO-style Phase 1)
   *
   * Creates a transaction with:
   * - Output 0: OP_RETURN with challenge:nonce:hash
   * - Output 1: spellOutputSats to miner address (for spell input)
   * - Output 2: change to miner address
   *
   * @param inputs - UTXOs to spend
   * @param minerAddress - Miner's address for outputs
   * @param opReturnData - Data for OP_RETURN (challenge:nonce:hash)
   * @param spellOutputSats - Sats for spell input output (default 700)
   */
  buildMiningTxWithOpReturn(
    inputs: TxUTXO[],
    minerAddress: string,
    opReturnData: string,
    spellOutputSats: number = 700,
  ): UnsignedTx & { hex: string } {
    const totalInput = inputs.reduce((sum, u) => sum + u.value, 0);

    // Estimate fee: inputs + OP_RETURN + spell output + change
    const baseVsize = this.estimateVsize(inputs, 3);
    const opReturnVsize = Math.ceil((opReturnData.length + 3) / 4); // OP_RETURN overhead
    const vsize = baseVsize + opReturnVsize;
    const btcFee = Math.ceil(vsize * this.feeRate);

    const change = totalInput - btcFee - spellOutputSats;

    if (change < 0) {
      throw new Error(
        `Insufficient funds: need ${btcFee + spellOutputSats} sats, have ${totalInput} sats`,
      );
    }

    // Build OP_RETURN script
    const opReturnScript = bitcoin.script.compile([
      bitcoin.opcodes.OP_RETURN,
      Buffer.from(opReturnData, "utf8"),
    ]);

    // Build outputs
    const outputs: TxOutput[] = [
      // OP_RETURN (no value)
      { address: "", value: 0, script: opReturnScript },
      // Spell input output (for future mint spell)
      { address: minerAddress, value: spellOutputSats },
    ];

    // Add change if above dust
    if (change >= this.dustThreshold) {
      outputs.push({ address: minerAddress, value: change });
    }

    // Build transaction
    const txb = new bitcoin.Psbt({ network: this.networkConfig });

    // Add inputs
    for (const utxo of inputs) {
      const inputData: Parameters<typeof txb.addInput>[0] = {
        hash: utxo.txid,
        index: utxo.vout,
        sequence: this.enableRBF ? RBF_SEQUENCE : FINAL_SEQUENCE,
        witnessUtxo: {
          script: Buffer.from(
            utxo.witnessUtxo?.script || this.addressToScript(minerAddress),
          ),
          value: utxo.value,
        },
      };

      if (utxo.tapInternalKey) {
        inputData.tapInternalKey = Buffer.from(utxo.tapInternalKey);
      }

      txb.addInput(inputData);
    }

    // Add outputs
    for (const output of outputs) {
      if (output.script) {
        // OP_RETURN output
        txb.addOutput({
          script: output.script,
          value: output.value,
        });
      } else {
        txb.addOutput({
          address: output.address,
          value: output.value,
        });
      }
    }

    // Extract hex (unsigned, for reference)
    // Note: This won't be valid until signed
    const tx: UnsignedTx & { hex: string } = {
      inputs: inputs.map((utxo) => ({
        utxo,
        sequence: this.enableRBF ? RBF_SEQUENCE : FINAL_SEQUENCE,
      })),
      outputs,
      fee: btcFee,
      changeAddress: minerAddress,
      network: this.network,
      hex: "", // Will be filled after signing
    };

    return tx;
  }

  /**
   * Build PSBT (Partially Signed Bitcoin Transaction)
   */
  buildPSBT(tx: UnsignedTx, spellWitness?: Uint8Array): bitcoin.Psbt {
    const psbt = new bitcoin.Psbt({ network: this.networkConfig });

    // Add inputs
    for (const input of tx.inputs) {
      const { utxo } = input;

      // Get the script for the input
      // Priority: witnessUtxo.script > changeAddress > first non-OP_RETURN output
      let script: Uint8Array;
      if (utxo.witnessUtxo?.script && utxo.witnessUtxo.script.length > 0) {
        script = utxo.witnessUtxo.script;
      } else if (tx.changeAddress) {
        script = this.addressToScript(tx.changeAddress);
      } else {
        // Find first output with a valid address (skip OP_RETURN outputs)
        const validOutput = tx.outputs.find(
          (o) => o.address && o.address.length > 0,
        );
        if (!validOutput) {
          throw new Error(
            "Cannot determine script for input - no valid output address found",
          );
        }
        script = this.addressToScript(validOutput.address);
      }

      // Base input data
      const inputData: Parameters<typeof psbt.addInput>[0] = {
        hash: utxo.txid,
        index: utxo.vout,
        sequence:
          input.sequence ?? (this.enableRBF ? RBF_SEQUENCE : FINAL_SEQUENCE),
        witnessUtxo: {
          script: Buffer.from(script),
          value: utxo.value,
        },
      };

      // Add tapInternalKey for Taproot inputs (P2TR)
      if (utxo.tapInternalKey) {
        if (utxo.tapInternalKey.length !== 32) {
          throw new Error(
            `Invalid tapInternalKey length for input ${utxo.txid}:${utxo.vout}. ` +
              "Expected 32 bytes (x-only public key).",
          );
        }
        inputData.tapInternalKey = Buffer.from(utxo.tapInternalKey);
      }

      psbt.addInput(inputData);
    }

    // Add outputs
    for (const output of tx.outputs) {
      if (output.script) {
        // Script-based output (e.g., OP_RETURN)
        psbt.addOutput({
          script: output.script,
          value: output.value,
        });
      } else if (output.address && output.address.length > 0) {
        // Address-based output
        psbt.addOutput({
          address: output.address,
          value: output.value,
        });
      } else {
        throw new Error("Output must have either script or valid address");
      }
    }

    // Add OP_RETURN if spell witness is provided and small enough
    if (spellWitness && spellWitness.length <= 80) {
      psbt.addOutput({
        script: bitcoin.script.compile([
          bitcoin.opcodes.OP_RETURN,
          Buffer.from(spellWitness),
        ]),
        value: 0,
      });
    }

    return psbt;
  }

  /**
   * Sign a PSBT with private key
   * Note: Properly cleans up tweaked private key from memory after signing
   */
  signPSBT(
    psbt: bitcoin.Psbt,
    privateKey: Uint8Array,
    inputIndices?: number[],
  ): bitcoin.Psbt {
    const { signer, cleanup } = this.createTweakedSigner(privateKey);
    const indicesToSign = inputIndices ?? psbt.data.inputs.map((_, i) => i);

    try {
      for (const index of indicesToSign) {
        psbt.signInput(index, signer);
      }
      return psbt;
    } finally {
      // Always clean up sensitive key material
      cleanup();
    }
  }

  /**
   * Finalize and extract transaction
   */
  finalizePSBT(psbt: bitcoin.Psbt): SignedTx {
    // Calculate fee before finalizing (need input values from witnessUtxo)
    let totalInputValue = 0;
    for (const input of psbt.data.inputs) {
      if (input.witnessUtxo) {
        totalInputValue += input.witnessUtxo.value;
      } else if (input.nonWitnessUtxo) {
        // For non-witness inputs, parse the previous tx to get the value
        // This is more complex and rarely needed for our use case
        log.warn("Non-witness UTXO found, fee calculation may be inaccurate");
      }
    }

    const totalOutputValue = psbt.txOutputs.reduce(
      (sum, out) => sum + out.value,
      0,
    );

    // Finalize all inputs
    psbt.finalizeAllInputs();

    // Extract transaction
    const tx = psbt.extractTransaction();

    // Fee = inputs - outputs
    const fee = totalInputValue - totalOutputValue;

    return {
      hex: tx.toHex(),
      txid: tx.getId(),
      vsize: tx.virtualSize(),
      fee: fee > 0 ? fee : 0, // Sanity check
      inputCount: tx.ins.length,
      outputCount: tx.outs.length,
    };
  }

  /**
   * Build and sign a complete mining transaction
   */
  async buildAndSignMiningTx(
    utxos: TxUTXO[],
    privateKey: Uint8Array,
    minerAddress: string,
    spell: SpellConfig,
    charmsFeeAddress: string,
    charmsFee: number,
  ): Promise<SignedTx> {
    // Select coins
    const selection = this.selectCoins(utxos, charmsFee, 1);

    // Build transaction
    const tx = this.buildMiningTx(
      selection.inputs,
      minerAddress,
      spell,
      charmsFeeAddress,
      charmsFee,
    );

    // Build PSBT
    const psbt = this.buildPSBT(tx, tx.spellWitness);

    // Update inputs with proper witness UTXO
    for (let i = 0; i < tx.inputs.length; i++) {
      const input = tx.inputs[i];
      psbt.updateInput(i, {
        witnessUtxo: {
          script: Buffer.from(this.addressToScript(minerAddress)),
          value: input.utxo.value,
        },
      });
    }

    // Sign
    this.signPSBT(psbt, privateKey);

    // Finalize
    return this.finalizePSBT(psbt);
  }

  /**
   * Estimate virtual size of transaction
   * @param inputs - UTXOs or count (uses Taproot estimate for count)
   * @param outputCount - Number of outputs
   */
  private estimateVsize(
    inputs: TxUTXO[] | number,
    outputCount: number,
  ): number {
    const base = 10.5; // Transaction overhead

    // Calculate input vbytes
    let inputVbytes: number;
    if (typeof inputs === "number") {
      // Fallback: assume Taproot for backward compatibility
      inputVbytes = inputs * INPUT_VBYTES.P2TR;
    } else {
      // Use actual UTXO types
      inputVbytes = inputs.reduce((sum, utxo) => sum + getInputVbytes(utxo), 0);
    }

    // Assume P2TR outputs (our default output type)
    const outputVbytes = outputCount * OUTPUT_VBYTES.P2TR;

    return Math.ceil(base + inputVbytes + outputVbytes);
  }

  /**
   * Convert address to output script
   */
  private addressToScript(address: string): Uint8Array {
    return bitcoin.address.toOutputScript(address, this.networkConfig);
  }

  /**
   * Create a tweaked signer for Taproot (BIP86 key path spend)
   *
   * For Taproot signing with bitcoinjs-lib:
   * - publicKey must be the TWEAKED x-only public key (matches the output script)
   * - The private key must be tweaked with the TapTweak hash
   * - Signer needs signSchnorr() method for Taproot
   *
   * Note: bitcoinjs-lib compares signer.publicKey against the tweaked key
   * extracted from the witnessUtxo script, NOT against tapInternalKey.
   */
  private createTweakedSigner(privateKey: Uint8Array): {
    signer: bitcoin.Signer & { signSchnorr: (hash: Buffer) => Buffer };
    cleanup: () => void;
  } {
    // Get compressed public key (33 bytes: 02/03 prefix + 32 byte x-coordinate)
    const publicKey = ecc.pointFromScalar(privateKey);
    if (!publicKey) {
      throw new Error("Invalid private key");
    }

    // Extract x-only public key (32 bytes) - this is the INTERNAL key
    const xOnlyInternalKey = Buffer.from(publicKey.slice(1, 33));

    // Tweak the key for Taproot (BIP86 key path spend)
    const tweakHash = bitcoin.crypto.taggedHash("TapTweak", xOnlyInternalKey);

    // Handle parity: if the public key has odd Y coordinate (0x03 prefix),
    // we need to negate the private key before tweaking
    let privKeyToTweak = privateKey;
    if (publicKey[0] === 0x03) {
      privKeyToTweak = ecc.privateNegate(privateKey);
    }

    const tweakedPrivateKey = ecc.privateAdd(privKeyToTweak, tweakHash);

    if (!tweakedPrivateKey) {
      throw new Error("Failed to tweak private key");
    }

    // Store in a mutable array so we can zero it later
    const tweakedKeyArray = new Uint8Array(tweakedPrivateKey);

    // Compute the TWEAKED x-only public key
    // This is what appears in the P2TR output script
    const tweakedPubKey = ecc.xOnlyPointAddTweak(xOnlyInternalKey, tweakHash);
    if (!tweakedPubKey) {
      throw new Error("Failed to compute tweaked public key");
    }
    const xOnlyTweakedKey = Buffer.from(tweakedPubKey.xOnlyPubkey);

    // Return signer with TWEAKED publicKey (for matching against output script)
    const signer = {
      // publicKey must match the key in the P2TR output script
      publicKey: xOnlyTweakedKey,
      sign: (hash: Buffer): Buffer => {
        // For non-Taproot inputs (ECDSA with original key)
        const sig = ecc.sign(hash, privateKey);
        return Buffer.from(sig);
      },
      signSchnorr: (hash: Buffer): Buffer => {
        // For Taproot inputs (Schnorr with TWEAKED key)
        const sig = ecc.signSchnorr(hash, tweakedKeyArray);
        return Buffer.from(sig);
      },
    };

    // Cleanup function to zero out sensitive key material
    const cleanup = () => {
      tweakedKeyArray.fill(0);
    };

    return { signer, cleanup };
  }

  /**
   * Convert Mempool UTXOs to TxUTXOs
   *
   * @param utxos - Raw UTXOs from mempool API
   * @param address - Address that owns the UTXOs
   * @param network - Bitcoin network
   * @param xOnlyPubKey - X-only public key (32 bytes) for Taproot inputs.
   *                      Required for P2TR addresses (bc1p.../tb1p...) to construct valid PSBTs.
   *                      Optional for other address types (SegWit, Legacy).
   */
  static convertUTXOs(
    utxos: UTXO[],
    address: string,
    network: BitcoinNetwork,
    xOnlyPubKey?: Uint8Array,
  ): TxUTXO[] {
    const networkConfig = NETWORKS[network];
    const script = bitcoin.address.toOutputScript(address, networkConfig);

    // Validate xOnlyPubKey for Taproot addresses
    const isTaproot = address.startsWith("bc1p") || address.startsWith("tb1p");
    if (isTaproot && (!xOnlyPubKey || xOnlyPubKey.length !== 32)) {
      throw new Error(
        "Taproot addresses (bc1p.../tb1p...) require a 32-byte x-only public key for PSBT construction. " +
          "Pass the xOnlyPubKey parameter (bytes 1-33 of compressed public key).",
      );
    }

    return utxos.map((utxo) => ({
      txid: utxo.txid,
      vout: utxo.vout,
      value: utxo.value,
      witnessUtxo: {
        script: new Uint8Array(script),
        value: utxo.value,
      },
      // Only include tapInternalKey for Taproot addresses
      tapInternalKey:
        isTaproot && xOnlyPubKey ? new Uint8Array(xOnlyPubKey) : undefined,
    }));
  }
}

/**
 * Create a transaction builder
 */
export function createTransactionBuilder(
  options: TxBuilderOptions,
): TransactionBuilder {
  return new TransactionBuilder(options);
}

/**
 * Estimate fee for a transaction
 * @param inputs - UTXOs or count (uses Taproot estimate for count)
 * @param outputCount - Number of outputs
 * @param feeRate - Satoshis per virtual byte
 * @param spellSize - Optional spell witness size in bytes
 */
export function estimateFee(
  inputs: TxUTXO[] | number,
  outputCount: number,
  feeRate: number,
  spellSize: number = 0,
): FeeEstimate {
  const base = 10.5;
  const spellVsize = Math.ceil(spellSize / 4); // Witness discount

  // Calculate input vbytes based on actual types or fallback to Taproot
  let inputVbytes: number;
  if (typeof inputs === "number") {
    inputVbytes = inputs * INPUT_VBYTES.P2TR;
  } else {
    inputVbytes = inputs.reduce((sum, utxo) => sum + getInputVbytes(utxo), 0);
  }

  const outputVbytes = outputCount * OUTPUT_VBYTES.P2TR;
  const vsize = Math.ceil(base + inputVbytes + outputVbytes + spellVsize);

  return {
    satPerVB: feeRate,
    totalFee: Math.ceil(vsize * feeRate),
    vsize,
  };
}
