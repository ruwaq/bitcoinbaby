#!/usr/bin/env tsx
/**
 * Treasury External Signer
 *
 * Node.js script that signs and broadcasts withdrawal batches.
 * Runs separately from Cloudflare Workers since Workers don't support
 * Node.js crypto libraries needed for Bitcoin signing.
 *
 * Flow:
 * 1. Poll Workers API for ready batches
 * 2. For each batch, get spell data
 * 3. Submit spell to Charms Prover
 * 4. Sign resulting transactions with Treasury wallet
 * 5. Broadcast to Bitcoin network
 * 6. Confirm with Workers API
 *
 * Usage:
 *   BATCH_WALLET_SEED="your mnemonic" \
 *   WORKERS_API_URL="https://api.bitcoinbaby.io" \
 *   ADMIN_KEY="your-admin-key" \
 *   tsx scripts/signer/treasury-signer.ts
 *
 * Or add to crontab for periodic execution:
 *   */15 * * * * cd /path/to/bitcoinbaby && npm run signer
 */

import * as bip39 from "bip39";
import { BIP32Factory, type BIP32Interface } from "bip32";
import * as ecc from "tiny-secp256k1";
import * as bitcoin from "bitcoinjs-lib";

// Initialize crypto
const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

// Configuration
const CONFIG = {
  // Workers API endpoint
  workersApiUrl:
    process.env.WORKERS_API_URL || "https://bitcoinbaby-api.workers.dev",

  // Admin key for Workers API
  adminKey: process.env.ADMIN_KEY || "",

  // Treasury wallet mnemonic (12 or 24 words)
  walletSeed: process.env.BATCH_WALLET_SEED || "",

  // Charms Prover URL (v11 hosted)
  proverUrl: process.env.CHARMS_PROVER_URL || "https://v11.charms.dev",

  // Mempool API for broadcasting
  mempoolApi:
    process.env.MEMPOOL_API || "https://mempool.space/testnet4/api",

  // Network
  network: bitcoin.networks.testnet,

  // Derivation path (BIP86 Taproot, testnet)
  derivationPath: "m/86'/1'/0'/0/0",

  // Poll interval (ms)
  pollInterval: 60_000, // 1 minute

  // Run once or continuously
  runOnce: process.env.RUN_ONCE === "true",
};

// Types
interface ReadyBatch {
  id: string;
  recipients: Array<{ address: string; amount: string }>;
  totalAmount: string;
  feeRate: number;
  createdAt: number;
}

interface ProverResponse {
  commit_tx?: string;
  spell_tx?: string;
  error?: string;
}

// Logging
function log(level: "info" | "warn" | "error", message: string, data?: object) {
  const timestamp = new Date().toISOString();
  const logData = data ? ` ${JSON.stringify(data)}` : "";
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${logData}`);
}

// Treasury Wallet
class TreasuryWallet {
  private keyPair: BIP32Interface | null = null;
  private internalKey: Buffer | null = null;
  public address: string | null = null;

  async initialize(mnemonic: string): Promise<boolean> {
    if (!mnemonic) {
      log("error", "No wallet seed provided");
      return false;
    }

    if (!bip39.validateMnemonic(mnemonic)) {
      log("error", "Invalid mnemonic phrase");
      return false;
    }

    try {
      const seed = await bip39.mnemonicToSeed(mnemonic);
      const root = bip32.fromSeed(seed, CONFIG.network);
      this.keyPair = root.derivePath(CONFIG.derivationPath);

      if (!this.keyPair.privateKey) {
        log("error", "Failed to derive private key");
        return false;
      }

      // Get internal key for Taproot (x-only pubkey)
      this.internalKey = this.keyPair.publicKey.subarray(1, 33);

      // Generate address
      const { address } = bitcoin.payments.p2tr({
        internalPubkey: this.internalKey,
        network: CONFIG.network,
      });

      this.address = address ?? null;

      log("info", "Wallet initialized", { address: this.address });
      return true;
    } catch (error) {
      log("error", "Wallet initialization failed", { error: String(error) });
      return false;
    }
  }

  signTransaction(psbtHex: string): string | null {
    if (!this.keyPair?.privateKey || !this.internalKey) {
      log("error", "Wallet not initialized for signing");
      return null;
    }

    try {
      const psbt = bitcoin.Psbt.fromHex(psbtHex, { network: CONFIG.network });

      // Tweak the key for Taproot key-path spending
      const tweakedSigner = this.keyPair.tweak(
        bitcoin.crypto.taggedHash("TapTweak", this.internalKey),
      );

      // Sign all inputs
      for (let i = 0; i < psbt.inputCount; i++) {
        psbt.signInput(i, tweakedSigner);
      }

      psbt.finalizeAllInputs();
      return psbt.extractTransaction().toHex();
    } catch (error) {
      log("error", "Signing failed", { error: String(error) });
      return null;
    }
  }
}

// API Client
class SignerAPIClient {
  private baseUrl: string;
  private adminKey: string;

  constructor(baseUrl: string, adminKey: string) {
    this.baseUrl = baseUrl;
    this.adminKey = adminKey;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: object,
  ): Promise<T | null> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Admin-Key": this.adminKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        log("error", `API request failed: ${path}`, {
          status: response.status,
          error: errorText,
        });
        return null;
      }

      return (await response.json()) as T;
    } catch (error) {
      log("error", `API request error: ${path}`, { error: String(error) });
      return null;
    }
  }

  async getReadyBatches(): Promise<ReadyBatch[]> {
    const response = await this.request<{
      success: boolean;
      data: { batches: ReadyBatch[] };
    }>("GET", "/api/admin/signer/health");

    // First check health - if not healthy, return empty
    if (!response?.success) {
      return [];
    }

    // Then get ready batches
    const batchesResponse = await this.request<{
      success: boolean;
      data: { batches: ReadyBatch[] };
    }>("GET", "/api/pool/global/batches/ready");

    return batchesResponse?.data?.batches || [];
  }

  async getBatchSpell(batchId: string): Promise<object | null> {
    const response = await this.request<{
      success: boolean;
      data: { spell: object };
    }>("GET", `/api/pool/global/batches/${batchId}`);

    return response?.data?.spell || null;
  }

  async confirmBatch(batchId: string, txid: string): Promise<boolean> {
    const response = await this.request<{ success: boolean }>(
      "POST",
      `/api/pool/global/batches/${batchId}/confirm`,
      { txid },
    );

    return response?.success ?? false;
  }
}

// Prover Client
class CharmsProverClient {
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  async prove(spell: object): Promise<ProverResponse> {
    try {
      const response = await fetch(`${this.url}/prove`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "BitcoinBaby-Signer/1.0",
        },
        body: JSON.stringify({ spell }),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown");
        return { error: `Prover error: ${response.status} - ${errorText}` };
      }

      return (await response.json()) as ProverResponse;
    } catch (error) {
      return { error: `Prover request failed: ${error}` };
    }
  }
}

// Bitcoin Network Client
class BitcoinNetworkClient {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  async broadcast(txHex: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiUrl}/tx`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: txHex,
      });

      if (!response.ok) {
        const errorText = await response.text();
        log("error", "Broadcast failed", { error: errorText });
        return null;
      }

      return await response.text();
    } catch (error) {
      log("error", "Broadcast error", { error: String(error) });
      return null;
    }
  }
}

// Main Signer Service
class TreasurySigner {
  private wallet: TreasuryWallet;
  private api: SignerAPIClient;
  private prover: CharmsProverClient;
  private network: BitcoinNetworkClient;

  constructor() {
    this.wallet = new TreasuryWallet();
    this.api = new SignerAPIClient(CONFIG.workersApiUrl, CONFIG.adminKey);
    this.prover = new CharmsProverClient(CONFIG.proverUrl);
    this.network = new BitcoinNetworkClient(CONFIG.mempoolApi);
  }

  async initialize(): Promise<boolean> {
    return this.wallet.initialize(CONFIG.walletSeed);
  }

  async processBatch(batch: ReadyBatch): Promise<boolean> {
    log("info", "Processing batch", {
      batchId: batch.id,
      recipients: batch.recipients.length,
      totalAmount: batch.totalAmount,
    });

    try {
      // 1. Get spell from Workers API
      const spell = await this.api.getBatchSpell(batch.id);
      if (!spell) {
        log("error", "Failed to get spell for batch", { batchId: batch.id });
        return false;
      }

      // 2. Submit to Prover
      log("info", "Submitting to Prover...", { batchId: batch.id });
      const proverResult = await this.prover.prove(spell);

      if (proverResult.error || !proverResult.commit_tx || !proverResult.spell_tx) {
        log("error", "Prover failed", {
          batchId: batch.id,
          error: proverResult.error,
        });
        return false;
      }

      // 3. Sign commit transaction
      log("info", "Signing commit TX...", { batchId: batch.id });
      const signedCommitTx = this.wallet.signTransaction(proverResult.commit_tx);
      if (!signedCommitTx) {
        log("error", "Failed to sign commit TX", { batchId: batch.id });
        return false;
      }

      // 4. Broadcast commit transaction
      log("info", "Broadcasting commit TX...", { batchId: batch.id });
      const commitTxid = await this.network.broadcast(signedCommitTx);
      if (!commitTxid) {
        log("error", "Failed to broadcast commit TX", { batchId: batch.id });
        return false;
      }

      log("info", "Commit TX broadcast", { batchId: batch.id, commitTxid });

      // 5. Sign spell transaction
      log("info", "Signing spell TX...", { batchId: batch.id });
      const signedSpellTx = this.wallet.signTransaction(proverResult.spell_tx);
      if (!signedSpellTx) {
        log("error", "Failed to sign spell TX", { batchId: batch.id });
        return false;
      }

      // 6. Broadcast spell transaction
      log("info", "Broadcasting spell TX...", { batchId: batch.id });
      const spellTxid = await this.network.broadcast(signedSpellTx);
      if (!spellTxid) {
        log("error", "Failed to broadcast spell TX", { batchId: batch.id });
        return false;
      }

      log("info", "Spell TX broadcast", { batchId: batch.id, spellTxid });

      // 7. Confirm with Workers API
      const confirmed = await this.api.confirmBatch(batch.id, spellTxid);
      if (!confirmed) {
        log("warn", "Failed to confirm batch (TX still successful)", {
          batchId: batch.id,
          spellTxid,
        });
      }

      log("info", "Batch processed successfully", {
        batchId: batch.id,
        commitTxid,
        spellTxid,
      });

      return true;
    } catch (error) {
      log("error", "Batch processing failed", {
        batchId: batch.id,
        error: String(error),
      });
      return false;
    }
  }

  async processAllBatches(): Promise<{ processed: number; successful: number }> {
    const batches = await this.api.getReadyBatches();

    if (batches.length === 0) {
      log("info", "No batches ready for processing");
      return { processed: 0, successful: 0 };
    }

    log("info", "Found batches to process", { count: batches.length });

    let successful = 0;

    for (const batch of batches) {
      const result = await this.processBatch(batch);
      if (result) {
        successful++;
      }

      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    return { processed: batches.length, successful };
  }

  async run(): Promise<void> {
    log("info", "Treasury Signer starting...");

    // Validate configuration
    if (!CONFIG.walletSeed) {
      log("error", "BATCH_WALLET_SEED not set");
      process.exit(1);
    }

    if (!CONFIG.adminKey) {
      log("warn", "ADMIN_KEY not set - API calls may fail");
    }

    // Initialize wallet
    const initialized = await this.initialize();
    if (!initialized) {
      log("error", "Failed to initialize wallet");
      process.exit(1);
    }

    log("info", "Signer ready", {
      treasuryAddress: this.wallet.address,
      apiUrl: CONFIG.workersApiUrl,
    });

    if (CONFIG.runOnce) {
      // Single run
      const result = await this.processAllBatches();
      log("info", "Run complete", result);
      process.exit(result.successful === result.processed ? 0 : 1);
    } else {
      // Continuous polling
      log("info", "Starting continuous polling", {
        interval: CONFIG.pollInterval,
      });

      while (true) {
        try {
          await this.processAllBatches();
        } catch (error) {
          log("error", "Poll cycle failed", { error: String(error) });
        }

        await new Promise((resolve) => setTimeout(resolve, CONFIG.pollInterval));
      }
    }
  }
}

// Entry point
const signer = new TreasurySigner();
signer.run().catch((error) => {
  log("error", "Fatal error", { error: String(error) });
  process.exit(1);
});
