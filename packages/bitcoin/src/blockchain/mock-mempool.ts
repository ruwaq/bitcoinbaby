/**
 * Mock Mempool Client
 *
 * Simulates a Bitcoin blockchain in memory. Useful for instant local testing
 * without running a real Bitcoin node or depending on external networks.
 */

import type { BitcoinNetwork } from "../types";
import type {
  BlockchainAPI,
  UTXO,
  AddressBalance,
  TransactionInfo,
  FeeEstimates,
  BlockInfo,
} from "./types";
import * as bitcoin from "bitcoinjs-lib";

export class MockMempoolClient implements BlockchainAPI {
  readonly network: BitcoinNetwork;

  // In-memory database for address UTXOs
  private utxosDb: Map<string, UTXO[]> = new Map();
  // In-memory database for transaction details
  private txsDb: Map<string, TransactionInfo> = new Map();
  // In-memory database for transaction hexes
  private txHexDb: Map<string, string> = new Map();
  // In-memory database for address transaction history
  private addressTxsDb: Map<string, TransactionInfo[]> = new Map();

  constructor(network: BitcoinNetwork = "testnet4") {
    this.network = network;
  }

  /**
   * Helper to ensure an address has some mock UTXOs (automatic faucet)
   */
  private ensureFunds(address: string): void {
    if (!this.utxosDb.has(address) || this.utxosDb.get(address)!.length === 0) {
      const mockUtxos: UTXO[] = [
        {
          txid: "0000000000000000000000000000000000000000000000000000000000000001",
          vout: 0,
          value: 20000000, // 0.2 BTC
          status: {
            confirmed: true,
            block_height: 800000,
            block_time: Math.floor(Date.now() / 1000) - 3600,
          },
        },
        {
          txid: "0000000000000000000000000000000000000000000000000000000000000002",
          vout: 1,
          value: 30000000, // 0.3 BTC
          status: {
            confirmed: true,
            block_height: 800001,
            block_time: Math.floor(Date.now() / 1000) - 1800,
          },
        },
      ];
      this.utxosDb.set(address, mockUtxos);
    }
  }

  async getBalance(address: string): Promise<AddressBalance> {
    this.ensureFunds(address);
    const utxos = this.utxosDb.get(address) || [];
    const confirmed = utxos.reduce((acc, curr) => acc + curr.value, 0);
    return {
      address,
      confirmed,
      unconfirmed: 0,
      total: confirmed,
      utxoCount: utxos.length,
    };
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    this.ensureFunds(address);
    return this.utxosDb.get(address) || [];
  }

  async getTransaction(txid: string): Promise<TransactionInfo> {
    const tx = this.txsDb.get(txid);
    if (!tx) {
      throw new Error(`Transaction ${txid} not found in mock database`);
    }
    return tx;
  }

  async broadcastTransaction(txHex: string): Promise<string> {
    try {
      const tx = bitcoin.Transaction.fromHex(txHex);
      const txid = tx.getId();

      const bitcoinJsNetwork =
        this.network === "mainnet"
          ? bitcoin.networks.bitcoin
          : this.network === "regtest"
            ? bitcoin.networks.regtest
            : bitcoin.networks.testnet;

      const involvedAddresses = new Set<string>();

      // 1. Remove consumed UTXOs (inputs)
      for (const input of tx.ins) {
        const inputTxid = Buffer.from(input.hash).reverse().toString("hex");
        const inputVout = input.index;

        for (const [address, utxos] of this.utxosDb.entries()) {
          const index = utxos.findIndex(
            (u) => u.txid === inputTxid && u.vout === inputVout,
          );
          if (index !== -1) {
            utxos.splice(index, 1);
            this.utxosDb.set(address, utxos);
            involvedAddresses.add(address);
            break;
          }
        }
      }

      // 2. Add newly created UTXOs (outputs)
      for (let i = 0; i < tx.outs.length; i++) {
        const out = tx.outs[i];
        try {
          const destAddress = bitcoin.address.fromOutputScript(
            out.script,
            bitcoinJsNetwork,
          );

          const newUtxo: UTXO = {
            txid,
            vout: i,
            value: out.value,
            status: {
              confirmed: true,
              block_height: 800010,
              block_time: Math.floor(Date.now() / 1000),
            },
          };

          const currentUtxos = this.utxosDb.get(destAddress) || [];
          currentUtxos.push(newUtxo);
          this.utxosDb.set(destAddress, currentUtxos);
          involvedAddresses.add(destAddress);
        } catch {
          // Ignore outputs that do not map to an address (e.g., OP_RETURN)
        }
      }

      // 3. Register transaction in details map
      const txInfo: TransactionInfo = {
        txid,
        version: tx.version,
        locktime: tx.locktime,
        size: tx.virtualSize(),
        weight: tx.weight(),
        fee: 250, // Mocked static fee
        status: {
          confirmed: true,
          block_height: 800010,
          block_time: Math.floor(Date.now() / 1000),
        },
      };

      this.txsDb.set(txid, txInfo);
      this.txHexDb.set(txid, txHex);

      // 4. Update address transactions history
      for (const address of involvedAddresses) {
        const txs = this.addressTxsDb.get(address) || [];
        txs.unshift(txInfo); // Add newest first
        this.addressTxsDb.set(address, txs);
      }

      return txid;
    } catch (e) {
      throw new Error(
        `Failed to decode/broadcast mock transaction: ${(e as Error).message}`,
        { cause: e },
      );
    }
  }

  async getFeeEstimates(): Promise<FeeEstimates> {
    return {
      fastestFee: 2,
      halfHourFee: 2,
      hourFee: 1,
      economyFee: 1,
      minimumFee: 1,
    };
  }

  async getBlockHeight(): Promise<number> {
    return 800010;
  }

  async getBlock(blockHash: string): Promise<BlockInfo> {
    return {
      id: blockHash,
      height: 800010,
      version: 1,
      timestamp: Math.floor(Date.now() / 1000),
      tx_count: this.txsDb.size || 1,
      size: 1000,
      weight: 4000,
      merkle_root:
        "0000000000000000000000000000000000000000000000000000000000000000",
      previousblockhash:
        "0000000000000000000000000000000000000000000000000000000000000000",
      mediantime: Math.floor(Date.now() / 1000) - 600,
      nonce: 12345,
      bits: 0x1d00ffff,
      difficulty: 1,
    };
  }

  async getBlockTxids(_blockHash: string): Promise<string[]> {
    // Return all txs currently registered in our database to allow Merkle proof builds to succeed
    const txids = Array.from(this.txsDb.keys());
    return txids.length > 0
      ? txids
      : ["0000000000000000000000000000000000000000000000000000000000000001"];
  }

  async getTransactionHex(txid: string): Promise<string> {
    const hex = this.txHexDb.get(txid);
    if (!hex) {
      // Return a dummy transaction hex if not found, to avoid crash on initial mock wallet setup
      return "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100f2052a010000000000000000";
    }
    return hex;
  }

  async waitForConfirmation(txid: string): Promise<TransactionInfo> {
    // In mock client, all transactions are confirmed immediately
    return this.getTransaction(txid);
  }

  async getAddressTransactions(
    address: string,
    _afterTxid?: string,
  ): Promise<TransactionInfo[]> {
    this.ensureFunds(address);
    return this.addressTxsDb.get(address) || [];
  }
}
