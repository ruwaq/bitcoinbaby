/**
 * Blockchain API Types
 *
 * Types for interacting with blockchain data providers.
 */

import type { BitcoinNetwork } from '../types';

/**
 * UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Address balance
 */
export interface AddressBalance {
  address: string;
  confirmed: number; // satoshis
  unconfirmed: number; // satoshis
  total: number; // satoshis
  utxoCount: number;
}

/**
 * Transaction info
 */
export interface TransactionInfo {
  txid: string;
  version: number;
  locktime: number;
  size: number;
  weight: number;
  fee: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Fee estimates (sat/vB)
 */
export interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Block information
 */
export interface BlockInfo {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

/**
 * Blockchain API client interface
 */
export interface BlockchainAPI {
  network: BitcoinNetwork;
  getBalance(address: string): Promise<AddressBalance>;
  getUTXOs(address: string): Promise<UTXO[]>;
  getTransaction(txid: string): Promise<TransactionInfo>;
  broadcastTransaction(txHex: string): Promise<string>;
  getFeeEstimates(): Promise<FeeEstimates>;
  getBlockHeight(): Promise<number>;
  getBlock(blockHash: string): Promise<BlockInfo>;
  getBlockTxids(blockHash: string): Promise<string[]>;
  getTransactionHex(txid: string): Promise<string>;
  waitForConfirmation(
    txid: string,
    options?: {
      timeoutMs?: number;
      pollIntervalMs?: number;
    }
  ): Promise<TransactionInfo>;
  getAddressTransactions(
    address: string,
    afterTxid?: string
  ): Promise<TransactionInfo[]>;
}
