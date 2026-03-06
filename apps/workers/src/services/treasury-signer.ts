/**
 * Treasury Signer Preparation Service
 *
 * This service prepares withdrawal batches for signing.
 * The actual signing and broadcasting must be done by an external service
 * since Cloudflare Workers don't support Node.js crypto libraries.
 *
 * Architecture:
 * 1. Workers API prepares spell data and stores it
 * 2. External signer polls GET /pool/batches/ready
 * 3. Signer builds transactions, signs, and broadcasts
 * 4. Signer confirms via POST /pool/batches/{id}/confirm
 *
 * The external signer should be a Node.js service with:
 * - @bitcoinbaby/bitcoin package
 * - Treasury wallet mnemonic
 * - Access to mempool API for broadcasting
 */

import type { Env } from "../lib/types";
import { signerLogger } from "../lib/logger";

/**
 * Batch from WithdrawPool ready for processing
 */
interface ReadyBatch {
  id: string;
  recipients: Array<{
    address: string;
    amount: string;
  }>;
  totalAmount: string;
  feeRate: number;
  createdAt: number;
}

/**
 * Charms UTXO with token balance (from Scrolls API)
 */
interface CharmsUTXO {
  utxo_id: string;
  txid: string;
  vout: number;
  satoshis: number;
  charms: Record<string, number>;
}

/**
 * Processing result
 */
export interface BatchPreparationResult {
  success: boolean;
  batchId: string;
  spell?: Record<string, unknown>;
  error?: string;
}

/**
 * Treasury Signer Preparation Service
 *
 * Prepares withdrawal data for external signing.
 * Does NOT do actual signing (requires Node.js).
 */
export class TreasurySignerService {
  private env: Env;
  private treasuryAddress: string | null = null;

  constructor(env: Env) {
    this.env = env;
    this.treasuryAddress = env.TREASURY_ADDRESS || null;
  }

  /**
   * Initialize (validate configuration)
   */
  async initialize(): Promise<boolean> {
    if (!this.treasuryAddress) {
      signerLogger.warn("TREASURY_ADDRESS not configured", {});
      // Don't fail - just log warning. Address can be set later.
    }

    // Check if BATCH_WALLET_SEED is configured (needed by external signer)
    if (!this.env.BATCH_WALLET_SEED) {
      signerLogger.warn(
        "BATCH_WALLET_SEED not configured - external signer won't work",
        {},
      );
    }

    return true;
  }

  /**
   * Get treasury address
   */
  getTreasuryAddress(): string | null {
    return this.treasuryAddress;
  }

  /**
   * Fetch ready batches from WithdrawPool
   */
  async fetchReadyBatches(): Promise<ReadyBatch[]> {
    const poolId = this.env.WITHDRAW_POOL?.idFromName("global");
    if (!poolId) {
      signerLogger.error("WithdrawPool DO not available", null, {});
      return [];
    }

    try {
      const stub = this.env.WITHDRAW_POOL.get(poolId);
      const response = await stub.fetch(
        new Request("https://internal/pool/batches/ready", {
          headers: {
            "X-Admin-Key": this.env.ADMIN_KEY || "",
          },
        }),
      );

      if (!response.ok) {
        signerLogger.error("Failed to fetch ready batches", null, {
          status: response.status,
        });
        return [];
      }

      const data = (await response.json()) as {
        success: boolean;
        data: { batches: ReadyBatch[] };
      };

      return data.success ? data.data.batches : [];
    } catch (error) {
      signerLogger.error("Error fetching ready batches", error, {});
      return [];
    }
  }

  /**
   * Get Treasury token balance from Scrolls API
   */
  async getTreasuryTokenBalance(): Promise<bigint> {
    if (!this.treasuryAddress) {
      return 0n;
    }

    try {
      const scrollsUrl =
        this.env.SCROLLS_API_URL || "https://scrolls.charms.dev";
      const response = await fetch(
        `${scrollsUrl}/api/v1/balances/${this.treasuryAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(this.env.SCROLLS_API_KEY && {
              Authorization: `Bearer ${this.env.SCROLLS_API_KEY}`,
            }),
          },
        },
      );

      if (!response.ok) {
        signerLogger.warn("Scrolls API unavailable", {
          status: response.status,
        });
        return 0n;
      }

      const data = (await response.json()) as {
        balances?: Record<string, string>;
      };

      // Get BABTC balance ($01)
      const babtcBalance = data.balances?.["$01"] || "0";
      return BigInt(babtcBalance);
    } catch (error) {
      signerLogger.warn("Error fetching treasury balance", { error });
      return 0n;
    }
  }

  /**
   * Get Treasury UTXOs from Scrolls API
   */
  async getTreasuryCharmsUtxos(): Promise<CharmsUTXO[]> {
    if (!this.treasuryAddress) {
      return [];
    }

    try {
      const scrollsUrl =
        this.env.SCROLLS_API_URL || "https://scrolls.charms.dev";
      const response = await fetch(
        `${scrollsUrl}/api/v1/utxos/${this.treasuryAddress}`,
        {
          headers: {
            "Content-Type": "application/json",
            ...(this.env.SCROLLS_API_KEY && {
              Authorization: `Bearer ${this.env.SCROLLS_API_KEY}`,
            }),
          },
        },
      );

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as { utxos: CharmsUTXO[] };
      return data.utxos || [];
    } catch {
      return [];
    }
  }

  /**
   * Build transfer spell structure for a batch
   */
  buildTransferSpell(
    batch: ReadyBatch,
    treasuryUtxo: CharmsUTXO,
  ): Record<string, unknown> {
    // BABTC app reference
    const appVk =
      this.env.BABTC_APP_VK ||
      "ab70796e62562b5245cf746d7ecf4b95b86df582921ae42ec2ceea25612807c6";
    const genesis =
      this.env.BABTC_GENESIS ||
      "b3deba0743aeffd0e455ce442b1693107090341381e3d8bcc5f586667c3e8a81:0";
    const appRef = `${appVk}@${genesis}`;

    // Build outputs for each recipient
    const outs = batch.recipients.map((r) => ({
      [r.address]: {
        $01: Number(r.amount),
      },
    }));

    // Calculate change
    const totalSending = batch.recipients.reduce(
      (sum, r) => sum + BigInt(r.amount),
      0n,
    );
    const treasuryBalance = BigInt(treasuryUtxo.charms["$01"] || 0);
    const change = treasuryBalance - totalSending;

    // Add change output back to treasury if significant
    if (change > 546n && this.treasuryAddress) {
      outs.push({
        [this.treasuryAddress]: {
          $01: Number(change),
        },
      });
    }

    // V10 transfer spell
    return {
      version: 10,
      apps: {
        $01: appRef,
      },
      ins: [
        {
          utxo_id: treasuryUtxo.utxo_id,
          charms: {
            $01: Number(treasuryBalance),
          },
        },
      ],
      outs,
    };
  }

  /**
   * Prepare a batch for external signing
   */
  async prepareBatch(batch: ReadyBatch): Promise<BatchPreparationResult> {
    const result: BatchPreparationResult = {
      success: false,
      batchId: batch.id,
    };

    signerLogger.info("Preparing batch", {
      batchId: batch.id,
      recipients: batch.recipients.length,
      totalAmount: batch.totalAmount,
    });

    try {
      // 1. Get Treasury UTXOs
      const utxos = await this.getTreasuryCharmsUtxos();
      if (utxos.length === 0) {
        result.error = "No Treasury UTXOs available";
        return result;
      }

      // Find UTXO with enough BABTC balance
      const requiredAmount = BigInt(batch.totalAmount);
      const treasuryUtxo = utxos.find(
        (u) => BigInt(u.charms["$01"] || 0) >= requiredAmount,
      );

      if (!treasuryUtxo) {
        const available = utxos.reduce(
          (sum, u) => sum + BigInt(u.charms["$01"] || 0),
          0n,
        );
        result.error = `Insufficient Treasury balance. Need ${requiredAmount}, have ${available}`;
        return result;
      }

      // 2. Build spell structure
      const spell = this.buildTransferSpell(batch, treasuryUtxo);

      signerLogger.info("Batch prepared for signing", {
        batchId: batch.id,
        utxoId: treasuryUtxo.utxo_id,
      });

      result.success = true;
      result.spell = spell;
      return result;
    } catch (error) {
      result.error = `Preparation error: ${error}`;
      signerLogger.error("Batch preparation failed", error, {
        batchId: batch.id,
      });
      return result;
    }
  }

  /**
   * Process all ready batches (prepare spell data)
   *
   * Note: This only prepares the data. Actual signing must be done
   * by an external service that has access to the private key.
   */
  async processAllBatches(): Promise<BatchPreparationResult[]> {
    const results: BatchPreparationResult[] = [];

    // Initialize
    await this.initialize();

    // Check Treasury balance
    const balance = await this.getTreasuryTokenBalance();
    signerLogger.info("Treasury token balance", {
      balance: balance.toString(),
      address: this.treasuryAddress,
    });

    if (balance === 0n) {
      signerLogger.warn("Treasury has no tokens", {
        address: this.treasuryAddress,
      });
      // Continue anyway to log which batches would be processed
    }

    // Fetch ready batches
    const batches = await this.fetchReadyBatches();

    if (batches.length === 0) {
      signerLogger.info("No batches ready for processing");
      return results;
    }

    signerLogger.info("Processing ready batches", {
      count: batches.length,
    });

    // Prepare each batch
    for (const batch of batches) {
      const result = await this.prepareBatch(batch);
      results.push(result);
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    signerLogger.info("Batch preparation complete", {
      total: results.length,
      successful,
      failed,
    });

    return results;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    treasuryAddress: string | null;
    treasuryBalance: string;
    configuredForSigning: boolean;
    scrollsApiAvailable: boolean;
    readyBatchCount: number;
    message: string;
  }> {
    await this.initialize();

    // Check Scrolls API
    let scrollsApiAvailable = false;
    try {
      const scrollsUrl =
        this.env.SCROLLS_API_URL || "https://scrolls.charms.dev";
      const response = await fetch(`${scrollsUrl}/health`, {
        method: "GET",
      });
      scrollsApiAvailable = response.ok;
    } catch {
      scrollsApiAvailable = false;
    }

    const balance = await this.getTreasuryTokenBalance();
    const batches = await this.fetchReadyBatches();
    const configuredForSigning = !!(
      this.env.BATCH_WALLET_SEED && this.treasuryAddress
    );

    // Determine health status and message
    let message = "";
    let healthy = false;

    if (!this.treasuryAddress) {
      message = "Treasury address not configured (TREASURY_ADDRESS)";
    } else if (!this.env.BATCH_WALLET_SEED) {
      message =
        "Treasury wallet seed not configured (BATCH_WALLET_SEED) - external signer won't work";
    } else if (balance === 0n) {
      message = "Treasury has no BABTC tokens - fund the treasury first";
    } else if (!scrollsApiAvailable) {
      message = "Scrolls API unavailable - cannot query token balances";
    } else {
      healthy = true;
      message = `Ready to process ${batches.length} batches`;
    }

    return {
      healthy,
      treasuryAddress: this.treasuryAddress,
      treasuryBalance: balance.toString(),
      configuredForSigning,
      scrollsApiAvailable,
      readyBatchCount: batches.length,
      message,
    };
  }
}

/**
 * Create Treasury Signer Preparation Service
 */
export function createTreasurySigner(env: Env): TreasurySignerService {
  return new TreasurySignerService(env);
}
