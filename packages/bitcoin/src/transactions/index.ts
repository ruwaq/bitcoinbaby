/**
 * Transactions Module
 *
 * Exports for building and signing Bitcoin transactions with Charms support.
 */

// Types
export type {
  TxUTXO,
  TxInput,
  TxOutput,
  OpReturnOutput,
  FeeEstimate,
  CoinSelection,
  UnsignedTx,
  SignedTx,
  CharmsTx,
  MiningTx,
  TxBuilderOptions,
  PSBTData,
  SigningOptions,
  BroadcastResult,
} from "./types";

// Transaction Builder
export {
  TransactionBuilder,
  createTransactionBuilder,
  estimateFee,
} from "./builder";

// Spell Encoder
export {
  encodeSpellForWitness,
  decodeSpellFromWitness,
  createSpellOpReturn,
  calculateSpellSize,
  validateSpell,
} from "./spell-encoder";

// PSBT Utilities
export { rawTxToPsbt, type FundingUtxo } from "./psbt-utils";
