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

import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "tiny-secp256k1";
import { BitcoinWallet } from "../wallet";
import type { BitcoinNetwork } from "../types";
import { CharmsProverClient, type ProverResponse } from "../charms/prover";
import type { SpellV10 } from "../charms/types";
import type { BlockchainAPI } from "../blockchain/types";
import { MempoolClient } from "../blockchain/mempool";
import { rawTxToPsbt, type FundingUtxo } from "../transactions/psbt-utils";
import { createLogger } from "@bitcoinbaby/shared";

// Initialize ECC for bitcoinjs-lib (PSBT signing requires it)
bitcoin.initEccLib(ecc);

const log = createLogger("TreasurySigner");

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
  /** Charms prover URL (default: https://v15.charms.dev) */
  proverUrl?: string;
  /** SPARK token app ID */
  appId: string;
  /** SPARK token app VK */
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

/**
 * Optional dependency injection for TreasurySigner.
 *
 * Production callers omit this — the signer instantiates CharmsProverClient
 * and MempoolClient internally using the config URLs.
 *
 * Tests inject mocks to avoid touching the network (see
 * tests/signer/treasury-signer.test.ts).
 */
export interface SignerDeps {
  /** Override the prover client (tests). */
  prover?: Pick<CharmsProverClient, "prove">;
  /** Override the mempool/blockchain client (tests). */
  blockchain?: BlockchainAPI;
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
  private prover: Pick<CharmsProverClient, "prove">;
  private blockchain: BlockchainAPI;
  private isRunning = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private treasuryAddress: string | null = null;

  constructor(config: SignerConfig, deps?: SignerDeps) {
    this.config = {
      ...config,
      pollInterval: config.pollInterval ?? 60_000,
      mempoolUrl: config.mempoolUrl ?? MEMPOOL_URLS[config.network],
      proverUrl: config.proverUrl ?? "https://v15.charms.dev",
    };

    this.wallet = new BitcoinWallet({ network: config.network });

    // Dependency injection (tests pass mocks; production uses real clients)
    this.prover =
      deps?.prover ??
      new CharmsProverClient({
        proverUrl: this.config.proverUrl,
        debug: true,
      });
    this.blockchain =
      deps?.blockchain ??
      new MempoolClient({
        network: config.network,
        baseUrl: this.config.mempoolUrl,
      });
  }

  /**
   * Initialize the signer (load wallet)
   */
  async initialize(): Promise<{ address: string }> {
    const walletInfo = await this.wallet.fromMnemonic(this.config.mnemonic);
    this.treasuryAddress = walletInfo.address;
    log.info(`Initialized with address: ${walletInfo.address}`);
    log.info(`Network: ${this.config.network}`);
    log.info(`Prover: ${this.config.proverUrl}`);
    return { address: walletInfo.address };
  }

  /**
   * Start the signer daemon
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      log.warn("Already running");
      return;
    }

    await this.initialize();
    this.isRunning = true;

    log.info(
      `Starting daemon (poll every ${this.config.pollInterval}ms)`,
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
    log.info("Stopped");
  }

  /**
   * Poll for batches and process them
   */
  async pollAndProcess(): Promise<SigningResult[]> {
    const results: SigningResult[] = [];

    try {
      const batches = await this.fetchReadyBatches();

      if (batches.length === 0) {
        log.info("No batches ready");
        return results;
      }

      log.info(`Found ${batches.length} ready batches`);

      for (const batch of batches) {
        const result = await this.processBatch(batch);
        results.push(result);

        if (result.success) {
          log.info(
            `Batch ${batch.id} completed: ${result.txid}`,
          );
        } else {
          log.error(
            `Batch ${batch.id} failed: ${result.error}`,
          );
        }
      }
    } catch (error) {
      log.error("Poll error:", { error });
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
        log.error(`API error: ${response.status}`);
        return [];
      }

      const data = (await response.json()) as {
        success: boolean;
        data: { batches: ReadyBatch[] };
      };

      return data.success ? data.data.batches : [];
    } catch (error) {
      log.error("Fetch error:", { error });
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
      log.info(`Processing batch ${batch.id}`);
      log.info(`  Recipients: ${batch.recipients.length}`);
      log.info(`  Total: ${batch.totalAmount} tokens`);

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
        data: {
          spell: Record<string, unknown>;
          // fundingUtxo may arrive as a JSON string or as an object depending
          // on the prepare endpoint's serialization. We normalize both.
          fundingUtxo: string | FundingUtxo;
        };
      };

      if (!prepareData.success) {
        result.error = "Prepare returned unsuccessful";
        return result;
      }

      // Normalize fundingUtxo into the FundingUtxo shape
      const fundingUtxo: FundingUtxo =
        typeof prepareData.data.fundingUtxo === "string"
          ? (JSON.parse(prepareData.data.fundingUtxo) as FundingUtxo)
          : prepareData.data.fundingUtxo;

      // 2. Sign the transactions via prover (real Schnorr PSBT signing)
      const signedTxs = await this.signSpell(
        prepareData.data.spell,
        fundingUtxo,
      );

      if (!signedTxs) {
        result.error = "Signing failed";
        return result;
      }

      // 3. Broadcast commit transaction first
      log.info("Broadcasting commit transaction...");
      const commitTxid = await this.broadcastTransaction(signedTxs.commitTxHex);

      if (!commitTxid) {
        result.error = "Commit broadcast failed";
        return result;
      }
      log.info(`Commit TX: ${commitTxid}`);

      // 4. Wait a moment for commit to propagate, then broadcast spell
      await this.sleep(2000);
      log.info("Broadcasting spell transaction...");
      const spellTxid = await this.broadcastTransaction(signedTxs.spellTxHex);

      if (!spellTxid) {
        result.error = `Spell broadcast failed (commit succeeded: ${commitTxid})`;
        result.txid = commitTxid; // Partial success
        return result;
      }
      log.info(`Spell TX: ${spellTxid}`);

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
   *   1. Submit spell to Charms prover
   *   2. Prover returns UNSIGNED commit_tx and spell_tx (raw hex)
   *   3. Convert each TX to a PSBT via rawTxToPsbt (which fetches the prevTx
   *      via the blockchain client to populate witnessUtxo)
   *   4. Sign the treasury input with the wallet's tweaked Schnorr signer
   *      (BIP-340/341 key-path spend)
   *   5. Return fully signed transactions ready for broadcast
   *
   * The Charms prover (v11/v15) intentionally returns UNSIGNED raw
   * transactions for security — see psbt-utils.ts header comment. The
   * treasury (this signer) holds the private key and must sign its own
   * input. Without this step, broadcasting the prover's hex directly would
   * fail mempool policy (invalid witness).
   *
   * @param spell - Charms spell object (validated by prover before submit)
   * @param fundingUtxo - Treasury UTXO that anchors the commit TX
   * @returns Signed { commitTxHex, spellTxHex } or null on failure
   */
  async signSpell(
    spell: Record<string, unknown>,
    fundingUtxo: FundingUtxo,
  ): Promise<{ commitTxHex: string; spellTxHex: string } | null> {
    try {
      log.info("Submitting spell to prover...");

      // Validate spell has required fields
      if (!spell.version || !spell.apps || !spell.ins || !spell.outs) {
        log.error("Invalid spell structure");
        return null;
      }

      // 1. Submit to prover (returns UNSIGNED raw hex)
      const proverResponse: ProverResponse = await this.prover.prove(
        spell as unknown as SpellV10,
      );

      log.info("Prover returned transactions");
      log.info(`  Commit TX: ${proverResponse.commitTx.slice(0, 40)}...`);
      log.info(`  Spell TX: ${proverResponse.spellTx.slice(0, 40)}...`);

      if (!this.treasuryAddress) {
        log.error("Signer not initialized — call initialize() first");
        return null;
      }

      // 2. Sign the commit TX (its input spends the funding UTXO)
      const signedCommitHex = await this.signProverTx(
        proverResponse.commitTx,
        fundingUtxo,
      );

      // 3. Sign the spell TX. Its prevout is the commit TX's output, which
      //    is also a Taproot output owned by the treasury (the prover wires
      //    it that way). We need the commit TX's txid + the vout it produced.
      //
      // IMPORTANT: the commit txid is computed from the UNSIGNED commit TX
      // (SegWit commitment means signing does not change the txid). Computing
      // it from the signed hex is also valid but adds unnecessary work and
      // risks confusion; we use the unsigned version for clarity.
      const unsignedCommitTx = bitcoin.Transaction.fromHex(
        proverResponse.commitTx,
      );
      const commitTxid = unsignedCommitTx.getId();
      // The commit TX output 0 pays to the treasury (Taproot); the spell
      // TX spends it. We derive the value from the commit TX's first output.
      const spellFundingUtxo: FundingUtxo = {
        txid: commitTxid,
        vout: 0,
        value: unsignedCommitTx.outs[0]?.value ?? 0,
      };

      const signedSpellHex = await this.signProverTx(
        proverResponse.spellTx,
        spellFundingUtxo,
      );

      log.info("Successfully signed commit + spell transactions");
      return {
        commitTxHex: signedCommitHex,
        spellTxHex: signedSpellHex,
      };
    } catch (error) {
      log.error("Spell signing failed:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * Sign a single prover-returned transaction.
   *
   * Converts the raw hex to a PSBT, signs the treasury input with the
   * wallet's BIP-340/341 tweaked Schnorr signer, and returns the fully
   * signed hex.
   */
  private async signProverTx(
    txHex: string,
    fundingUtxo: FundingUtxo,
  ): Promise<string> {
    if (!this.treasuryAddress) {
      throw new Error("Signer not initialized");
    }

    // Convert raw unsigned TX to PSBT, populating witnessUtxo from prevTx
    const psbtHex = await rawTxToPsbt(
      txHex,
      fundingUtxo,
      this.treasuryAddress,
      this.blockchain,
      this.config.network,
    );

    const psbt = bitcoin.Psbt.fromHex(psbtHex, {
      network: this.networkConfig(),
    });

    // Sign + finalize using the wallet's tweaked Schnorr signer (BIP-340/341).
    // wallet.signAndFinalizePSBT handles key negation and TapTweak internally.
    const { hex } = this.wallet.signAndFinalizePSBT(psbt);
    return hex;
  }

  /**
   * Get the bitcoinjs-lib Network object for the configured network.
   */
  private networkConfig(): bitcoin.Network {
    if (this.config.network === "mainnet") return bitcoin.networks.bitcoin;
    if (this.config.network === "regtest") return bitcoin.networks.regtest;
    // testnet + testnet4 share the same bech32 hrp ('tb')
    return bitcoin.networks.testnet;
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
        log.error(`Broadcast error: ${errorText}`);
        return null;
      }

      return await response.text();
    } catch (error) {
      log.error("Broadcast error:", { error });
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
