/**
 * DevFund Provider — Local Bitcoin simulation for development & testing
 *
 * Provides:
 * - A pre-funded wallet with 100 BTC (10,000,000,000 sats)
 * - Fake UTXOs for testing transactions
 * - Mock mempool that always confirms
 * - No external network calls
 *
 * Activate by setting NEXT_PUBLIC_NETWORK=dev or NEXT_PUBLIC_DEV_FUND=true
 *
 * SECURITY: This provider ONLY works when ENVIRONMENT !== "production".
 * It will throw if accidentally used in production.
 */

import type {
  BlockchainAPI,
  AddressBalance,
  UTXO,
  FeeEstimates,
} from "../blockchain/types";
import type { BitcoinNetwork } from "../types";

// =============================================================================
// DEV FUND WALLET
// =============================================================================

/** Pre-funded dev wallet with 100 BTC */
export const DEV_FUND = {
  address: "tb1qdev0000000000000000000000000000000fund",
  privateKey:
    "0000000000000000000000000000000000000000000000000000000000000001",
  publicKey:
    "0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798",
  mnemonic:
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about",
  balance: 10_000_000_000n, // 100 BTC in sats
};

// =============================================================================
// MOCK DATA
// =============================================================================

function generateMockUtxos(_address: string): UTXO[] {
  // Generate 5 UTXOs of varying sizes for realistic testing
  return [
    {
      txid: "a".repeat(64),
      vout: 0,
      value: 1_000_000, // 0.01 BTC
      status: { confirmed: true, block_height: 999999 },
    },
    {
      txid: "b".repeat(64),
      vout: 0,
      value: 5_000_000, // 0.05 BTC
      status: { confirmed: true, block_height: 999998 },
    },
    {
      txid: "c".repeat(64),
      vout: 1,
      value: 10_000_000, // 0.1 BTC
      status: { confirmed: true, block_height: 999997 },
    },
    {
      txid: "d".repeat(64),
      vout: 0,
      value: 50_000_000, // 0.5 BTC
      status: { confirmed: true, block_height: 999996 },
    },
    {
      txid: "e".repeat(64),
      vout: 2,
      value: 100_000_000, // 1 BTC
      status: { confirmed: true, block_height: 999995 },
    },
  ];
}

// =============================================================================
// DEV FUND PROVIDER
// =============================================================================

export class DevFundProvider implements BlockchainAPI {
  network: BitcoinNetwork;

  constructor(network: BitcoinNetwork = "testnet4") {
    this.network = network;
    this.assertNotProduction();
  }

  private assertNotProduction(): void {
    if (
      typeof process !== "undefined" &&
      process.env?.NODE_ENV === "production"
    ) {
      throw new Error(
        "DevFundProvider cannot be used in production. Use a real Bitcoin provider.",
      );
    }
  }

  async getAddressBalance(address: string): Promise<AddressBalance> {
    // Dev fund address gets 100 BTC
    const balance =
      address === DEV_FUND.address ? Number(DEV_FUND.balance) : 100_000_000; // 1 BTC for any other address

    return {
      address,
      confirmed: balance,
      unconfirmed: 0,
      total: balance,
      utxoCount: 5,
    };
  }

  async getUTXOs(address: string): Promise<UTXO[]> {
    if (address === DEV_FUND.address) {
      return generateMockUtxos(address);
    }
    return generateMockUtxos(address);
  }

  async getFeeEstimates(): Promise<FeeEstimates> {
    return {
      fastestFee: 1,
      halfHourFee: 1,
      hourFee: 1,
      economyFee: 1,
      minimumFee: 1,
    };
  }

  async broadcastTransaction(_txHex: string): Promise<string> {
    const fakeTxid = "f".repeat(63) + Math.floor(Math.random() * 10).toString();
    console.log("[DevFund] Broadcast tx:", fakeTxid);
    return fakeTxid;
  }

  async getTransaction(
    _txid: string,
  ): Promise<import("../blockchain/types").TransactionInfo> {
    return {
      txid: _txid,
      version: 2,
      locktime: 0,
      size: 250,
      weight: 1000,
      fee: 1000,
      status: { confirmed: true, block_height: 999999 },
    };
  }

  async getBlock(
    _blockHash: string,
  ): Promise<import("../blockchain/types").BlockInfo> {
    return {
      id: _blockHash,
      height: 999999,
      version: 1,
      timestamp: Date.now() / 1000,
      tx_count: 100,
      size: 1000000,
      weight: 4000000,
      merkle_root: "0".repeat(64),
      previousblockhash: "0".repeat(64),
      mediantime: Date.now() / 1000 - 600,
      nonce: 0,
      bits: 0x1d00ffff,
      difficulty: 1,
    };
  }

  async getBlockTxids(_blockHash: string): Promise<string[]> {
    return ["a".repeat(64), "b".repeat(64), "c".repeat(64)];
  }

  async getTransactionHex(_txid: string): Promise<string> {
    return "02000000000101" + "0".repeat(128);
  }

  async waitForConfirmation(
    _txid: string,
    _options?: { timeoutMs?: number; pollIntervalMs?: number },
  ): Promise<import("../blockchain/types").TransactionInfo> {
    return this.getTransaction(_txid);
  }

  async getAddressTransactions(
    _address: string,
    _afterTxid?: string,
  ): Promise<import("../blockchain/types").TransactionInfo[]> {
    return [
      await this.getTransaction("a".repeat(64)),
      await this.getTransaction("b".repeat(64)),
    ];
  }

  async getBalance(
    address: string,
  ): Promise<import("../blockchain/types").AddressBalance> {
    return this.getAddressBalance(address);
  }

  async getCurrentBlockHash(): Promise<string> {
    return "0".repeat(64);
  }

  async getBlockHeight(): Promise<number> {
    return 999999;
  }
}

// =============================================================================
// FACTORY
// =============================================================================

let devProviderInstance: DevFundProvider | null = null;

export function getDevFundProvider(
  network: BitcoinNetwork = "testnet4",
): DevFundProvider {
  if (!devProviderInstance) {
    devProviderInstance = new DevFundProvider(network);
  }
  return devProviderInstance;
}

/**
 * Check if dev fund mode is enabled
 */
export function isDevFundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return (
    localStorage.getItem("bitcoinbaby-dev-fund") === "true" ||
    new URLSearchParams(window.location.search).get("dev") === "true"
  );
}

/**
 * Enable dev fund mode (call from browser console or UI)
 */
export function enableDevFund(): void {
  const wasAlreadyEnabled =
    localStorage.getItem("bitcoinbaby-dev-fund") === "true";
  localStorage.setItem("bitcoinbaby-dev-fund", "true");
  console.log(
    "[DevFund] 🚀 Dev Fund ENABLED. All wallets get 1 BTC for testing.",
  );
  // Only reload on FIRST activation to apply the new client
  if (!wasAlreadyEnabled && typeof window !== "undefined") {
    console.log("[DevFund] First activation — reloading to apply...");
    window.location.reload();
  }
}

/**
 * Disable dev fund mode
 */
export function disableDevFund(): void {
  localStorage.removeItem("bitcoinbaby-dev-fund");
  console.log("[DevFund] Dev Fund DISABLED. Using real network.");
}
