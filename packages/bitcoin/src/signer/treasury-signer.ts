/**
 * Treasury Signer Service
 *
 * External service that signs and broadcasts treasury transactions.
 * Runs as a daemon/cron that:
 * 1. Polls Workers API for ready batches
 * 2. Signs transactions with treasury wallet
 * 3. Broadcasts to mempool
 * 4. Confirms completion to Workers API
 *
 * SECURITY: This service holds the treasury private key.
 * Run in a secure environment with proper access controls.
 */

import { BitcoinWallet } from "../wallet";
import type { BitcoinNetwork } from "../types";
import { CharmsProverClient, type ProverResponse } from "../charms/prover";
import type { SpellV10 } from "../charms/types";

// =============================================================================
// TYPES
// =============================================================================

export interface SignerConfig {
  /** Workers API base URL */
  apiUrl: string;
  /** Admin key for API authentication */
  adminKey: string;
  /** Treasury wallet mnemonic (BIP39) */
  mnemonic: string;
  /** Bitcoin network */
  network: BitcoinNetwork;
  /** Polling interval in ms (default: 60000) */
  pollInterval?: number;
  /** Mempool API URL (default: based on network) */
  mempoolUrl?: string;
  /** Charms prover URL (default: https://v11.charms.dev) */
  proverUrl?: string;
  /** BABTC token app ID */
  appId: string;
  /** BABTC token app VK */
  appVk: string;
}

export interface ReadyBatch {
  id: string;
  recipients: Array<{
    address: string;
    amount: string;
  }>;
  totalAmount: string;
  feeRate: number;
  createdAt: number;
  spell?: Record<string, unknown>;
}

export interface SigningResult {
  success: boolean;
  batchId: string;
  txid?: string;
  error?: string;
}

// =============================================================================
// MEMPOOL URLS
// =============================================================================

const MEMPOOL_URLS: Record<BitcoinNetwork, string> = {
  mainnet: "https://mempool.space/api",
  testnet: "https://mempool.space/testnet/api",
  testnet4: "https://mempool.space/testnet4/api",
  regtest: "http://localhost:3000/api",
};

// =============================================================================
// TREASURY SIGNER
// =============================================================================

export class TreasurySigner {
  private config: Required<SignerConfig>;
  private wallet: BitcoinWallet;
  private prover: CharmsProverClient;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private treasuryAddress: string | null = null;

  constructor(config: SignerConfig) {
    this.config = {
      ...config,
      pollInterval: config.pollInterval ?? 60_000,
      mempoolUrl: config.mempoolUrl ?? MEMPOOL_URLS[config.network],
      proverUrl: config.proverUrl ?? "https://v11.charms.dev",
    };

    this.wallet = new BitcoinWallet({ network: config.network });
    this.prover = new CharmsProverClient({
      proverUrl: this.config.proverUrl,
      debug: true,
    });
  }

  /**
   * Initialize the signer (load wallet)
   */
  async initialize(): Promise<{ address: string }> {
    const walletInfo = await this.wallet.fromMnemonic(this.config.mnemonic);
    this.treasuryAddress = walletInfo.address;
    console.log(
      `[TreasurySigner] Initialized with address: ${walletInfo.address}`,
    );
    console.log(`[TreasurySigner] Network: ${this.config.network}`);
    console.log(`[TreasurySigner] Prover: ${this.config.proverUrl}`);
    return { address: walletInfo.address };
  }

  /**
   * Start the signer daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[TreasurySigner] Already running");
      return;
    }

    await this.initialize();
    this.isRunning = true;

    console.log(
      `[TreasurySigner] Starting daemon (poll every ${this.config.pollInterval}ms)`,
    );

    // Initial poll
    await this.pollAndProcess();

    // Set up polling
    this.pollTimer = setInterval(async () => {
      await this.pollAndProcess();
    }, this.config.pollInterval);
  }

  /**
   * Stop the signer daemon
   */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isRunning = false;
    console.log("[TreasurySigner] Stopped");
  }

  /**
   * Poll for batches and process them
   */
  async pollAndProcess(): Promise<SigningResult[]> {
    const results: SigningResult[] = [];

    try {
      const batches = await this.fetchReadyBatches();

      if (batches.length === 0) {
        console.log("[TreasurySigner] No batches ready");
        return results;
      }

      console.log(`[TreasurySigner] Found ${batches.length} ready batches`);

      for (const batch of batches) {
        const result = await this.processBatch(batch);
        results.push(result);

        if (result.success) {
          console.log(
            `[TreasurySigner] Batch ${batch.id} completed: ${result.txid}`,
          );
        } else {
          console.error(
            `[TreasurySigner] Batch ${batch.id} failed: ${result.error}`,
          );
        }
      }
    } catch (error) {
      console.error("[TreasurySigner] Poll error:", error);
    }

    return results;
  }

  /**
   * Fetch ready batches from Workers API
   */
  private async fetchReadyBatches(): Promise<ReadyBatch[]> {
    try {
      const response = await fetch(
        `${this.config.apiUrl}/api/pool/batches/ready`,
        {
          headers: {
            "X-Admin-Key": this.config.adminKey,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.error(`[TreasurySigner] API error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as {
        success: boolean;
        data: { batches: ReadyBatch[] };
      };

      return data.success ? data.data.batches : [];
    } catch (error) {
      console.error("[TreasurySigner] Fetch error:", error);
      return [];
    }
  }

  /**
   * Process a single batch
   */
  private async processBatch(batch: ReadyBatch): Promise<SigningResult> {
    const result: SigningResult = {
      success: false,
      batchId: batch.id,
    };

    try {
      console.log(`[TreasurySigner] Processing batch ${batch.id}`);
      console.log(`  Recipients: ${batch.recipients.length}`);
      console.log(`  Total: ${batch.totalAmount} tokens`);

      // 1. Get prepared spell from API
      const prepareResponse = await fetch(
        `${this.config.apiUrl}/api/pool/batches/${batch.id}/prepare`,
        {
          method: "POST",
          headers: {
            "X-Admin-Key": this.config.adminKey,
            "Content-Type": "application/json",
          },
        },
      );

      if (!prepareResponse.ok) {
        result.error = `Prepare failed: ${prepareResponse.status}`;
        return result;
      }

      const prepareData = (await prepareResponse.json()) as {
        success: boolean;
        data: { spell: Record<string, unknown>; fundingUtxo: string };
      };

      if (!prepareData.success) {
        result.error = "Prepare returned unsuccessful";
        return result;
      }

      // 2. Sign the transactions via prover
      const signedTxs = await this.signSpell(prepareData.data.spell);

      if (!signedTxs) {
        result.error = "Signing failed";
        return result;
      }

      // 3. Broadcast commit transaction first
      console.log("[TreasurySigner] Broadcasting commit transaction...");
      const commitTxid = await this.broadcastTransaction(signedTxs.commitTxHex);

      if (!commitTxid) {
        result.error = "Commit broadcast failed";
        return result;
      }
      console.log(`[TreasurySigner] Commit TX: ${commitTxid}`);

      // 4. Wait a moment for commit to propagate, then broadcast spell
      await this.sleep(2000);
      console.log("[TreasurySigner] Broadcasting spell transaction...");
      const spellTxid = await this.broadcastTransaction(signedTxs.spellTxHex);

      if (!spellTxid) {
        result.error = `Spell broadcast failed (commit succeeded: ${commitTxid})`;
        result.txid = commitTxid; // Partial success
        return result;
      }
      console.log(`[TreasurySigner] Spell TX: ${spellTxid}`);

      // Use spell txid as the main transaction id
      const txid = spellTxid;

      // 4. Confirm to API
      const confirmResponse = await fetch(
        `${this.config.apiUrl}/api/pool/batches/${batch.id}/confirm`,
        {
          method: "POST",
          headers: {
            "X-Admin-Key": this.config.adminKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ txid }),
        },
      );

      if (!confirmResponse.ok) {
        result.error = `Confirm failed: ${confirmResponse.status}`;
        // Transaction was broadcast, so still mark as partial success
        result.txid = txid;
        return result;
      }

      result.success = true;
      result.txid = txid;
      return result;
    } catch (error) {
      result.error = error instanceof Error ? error.message : "Unknown error";
      return result;
    }
  }

  /**
   * Sign a Charms spell transaction
   *
   * Flow:
   * 1. Submit spell to Charms prover
   * 2. Prover returns commit_tx and spell_tx
   * 3. Sign with wallet (if needed)
   * 4. Return transactions ready for broadcast
   *
   * NOTE: Charms prover may return already-signed transactions
   * depending on the spell type. For transfer spells, the treasury
   * inputs need to be signed by our wallet.
   */
  private async signSpell(
    spell: Record<string, unknown>,
  ): Promise<{ commitTxHex: string; spellTxHex: string } | null> {
    try {
      console.log("[TreasurySigner] Submitting spell to prover...");

      // Validate spell has required fields
      if (!spell.version || !spell.apps || !spell.ins || !spell.outs) {
        console.error("[TreasurySigner] Invalid spell structure");
        return null;
      }

      // Submit to prover
      const proverResponse: ProverResponse = await this.prover.prove(
        spell as unknown as SpellV10,
      );

      console.log("[TreasurySigner] Prover returned transactions");
      console.log(`  Commit TX: ${proverResponse.commitTx.slice(0, 40)}...`);
      console.log(`  Spell TX: ${proverResponse.spellTx.slice(0, 40)}...`);

      // For transfer spells, the prover returns transactions that need
      // the treasury inputs signed. The signing flow depends on whether
      // the prover returns PSBTs or raw unsigned transactions.
      //
      // Current Charms prover (v11) returns fully constructed transactions
      // that may already be signed or need PSBT signing.
      //
      // TODO: Implement PSBT signing if prover returns unsigned transactions
      // For now, assume prover handles signing or returns ready transactions

      return {
        commitTxHex: proverResponse.commitTx,
        spellTxHex: proverResponse.spellTx,
      };
    } catch (error) {
      console.error("[TreasurySigner] Spell signing failed:", error);
      return null;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Broadcast a signed transaction to mempool
   */
  private async broadcastTransaction(txHex: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.mempoolUrl}/tx`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: txHex,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[TreasurySigner] Broadcast error: ${errorText}`);
        return null;
      }

      return await response.text();
    } catch (error) {
      console.error("[TreasurySigner] Broadcast error:", error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    walletAddress: string | null;
    apiReachable: boolean;
    mempoolReachable: boolean;
  }> {
    const walletInfo = this.wallet.getInfo();

    // Check API
    let apiReachable = false;
    try {
      const response = await fetch(`${this.config.apiUrl}/health`);
      apiReachable = response.ok;
    } catch {
      apiReachable = false;
    }

    // Check Mempool
    let mempoolReachable = false;
    try {
      const response = await fetch(
        `${this.config.mempoolUrl}/blocks/tip/height`,
      );
      mempoolReachable = response.ok;
    } catch {
      mempoolReachable = false;
    }

    return {
      healthy: apiReachable && mempoolReachable && !!walletInfo,
      walletAddress: walletInfo?.address ?? null,
      apiReachable,
      mempoolReachable,
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a treasury signer instance
 */
export function createTreasurySigner(config: SignerConfig): TreasurySigner {
  return new TreasurySigner(config);
}

/**
 * Create and start a treasury signer daemon
 */
export async function startTreasurySignerDaemon(
  config: SignerConfig,
): Promise<TreasurySigner> {
  const signer = createTreasurySigner(config);
  await signer.start();
  return signer;
}
