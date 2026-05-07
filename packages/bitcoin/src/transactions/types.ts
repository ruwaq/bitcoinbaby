/**
 * Transaction Types
 *
 * Types for building and signing Bitcoin transactions with Charms support.
 */

import type { BitcoinNetwork } from "../types";
import type { SpellConfig } from "../scrolls/types";
import type { SpellV2, SpellV10 } from "../charms/types";

// Spell type union - supports v1, v2, and v10 formats
export type Spell = SpellConfig | SpellV2 | SpellV10;

/**
 * UTXO for transaction input
 */
export interface TxUTXO {
  txid: string;
  vout: number;
  value: number; // satoshis
  scriptPubKey?: string;
  witnessUtxo?: {
    script: Uint8Array;
    value: number;
  };
  /**
   * X-only internal public key for Taproot (32 bytes)
   * Required for proper PSBT construction with P2TR inputs
   */
  tapInternalKey?: Uint8Array;
  /** UTXO status from mempool/electrum API (spent UTXOs must be filtered out) */
  status?: {
    confirmed: boolean;
    spent?: boolean;
  };
}

/**
 * Transaction input
 */
export interface TxInput {
  utxo: TxUTXO;
  sequence?: number;
}

/**
 * Transaction output
 */
export interface TxOutput {
  address: string;
  value: number; // satoshis
  /** Custom script (for OP_RETURN outputs) */
  script?: Buffer;
}

/**
 * OP_RETURN output for spell data
 */
export interface OpReturnOutput {
  data: Uint8Array;
}

/**
 * Fee estimation result
 */
export interface FeeEstimate {
  /** Satoshis per virtual byte */
  satPerVB: number;
  /** Total estimated fee in satoshis */
  totalFee: number;
  /** Virtual size of transaction */
  vsize: number;
}

/**
 * Coin selection result
 */
export interface CoinSelection {
  inputs: TxUTXO[];
  totalInputValue: number;
  change: number;
  fee: number;
}

/**
 * Unsigned transaction ready for signing
 */
export interface UnsignedTx {
  inputs: TxInput[];
  outputs: TxOutput[];
  opReturn?: OpReturnOutput;
  fee: number;
  changeAddress?: string;
  network: BitcoinNetwork;
}

/**
 * Signed transaction ready for broadcast
 */
export interface SignedTx {
  hex: string;
  txid: string;
  vsize: number;
  fee: number;
  inputCount: number;
  outputCount: number;
}

/**
 * Transaction with Charms spell
 */
export interface CharmsTx extends UnsignedTx {
  spell: Spell;
  spellWitness: Uint8Array;
}

/**
 * Mining transaction for $BABY minting
 */
export interface MiningTx {
  /** Miner's address to receive tokens */
  minerAddress: string;
  /** Proof of work hash */
  proofHash: string;
  /** Nonce that produced the hash */
  nonce: number;
  /** Difficulty achieved (leading zero bits) */
  difficulty: number;
  /** Token amount to mint */
  tokenAmount: bigint;
  /** Spell configuration */
  spell: SpellConfig;
  /** Built transaction (after construction) */
  transaction?: SignedTx;
}

/**
 * Transaction builder options
 */
export interface TxBuilderOptions {
  network: BitcoinNetwork;
  /** Fee rate in sat/vB (default: from mempool) */
  feeRate?: number;
  /** Dust threshold in satoshis (default: 546) */
  dustThreshold?: number;
  /** Enable RBF (default: true) */
  enableRBF?: boolean;
}

/**
 * PSBT (Partially Signed Bitcoin Transaction) data
 */
export interface PSBTData {
  /** Base64 encoded PSBT */
  psbt: string;
  /** Inputs that need signing */
  inputsToSign: number[];
  /** Whether all inputs are signed */
  isComplete: boolean;
}

/**
 * Signing options
 */
export interface SigningOptions {
  /** Sign all inputs (default: true) */
  signAll?: boolean;
  /** Specific input indices to sign */
  inputIndices?: number[];
  /** Sighash type (default: SIGHASH_DEFAULT for Taproot) */
  sighashType?: number;
}

/**
 * Transaction broadcast result
 */
export interface BroadcastResult {
  success: boolean;
  txid?: string;
  error?: string;
}
