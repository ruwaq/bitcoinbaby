/**
 * PSBT Builder Service
 *
 * Builds unsigned PSBTs for claim transactions.
 * The server obtains UTXOs and constructs the transaction,
 * user only needs to sign.
 */

import { claimLogger } from "../lib/logger";
import {
  DEFAULT_FEE_RATE,
  CLAIM_TX_SIZE_ESTIMATE,
  MIN_CLAIM_UTXO_VALUE,
  DUST_LIMIT,
  type BitcoinNetwork,
} from "../config/bitcoin";
import { stringToBytes } from "../lib/encoding";
import {
  addressToScriptPubkey,
  selectBestUtxo,
  buildOpReturnScript,
} from "../lib/bitcoin-utils";
import type {
  IPsbtBuilderService,
  PsbtBuildRequest,
  PsbtBuildResult,
} from "../interfaces/services";
import type { IMempoolService } from "../interfaces/services";
import * as bitcoin from "bitcoinjs-lib";

// Network configurations for bitcoinjs-lib
const BITCOIN_NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

export class PsbtBuilder implements IPsbtBuilderService {
  private readonly _network: BitcoinNetwork;
  private readonly mempoolService: IMempoolService;

  constructor(
    mempoolService: IMempoolService,
    network: BitcoinNetwork = "testnet4",
  ) {
    this.mempoolService = mempoolService;
    this._network = network;
  }

  /**
   * Get the configured network
   */
  get network(): BitcoinNetwork {
    return this._network;
  }

  private getNetworkConfig(): bitcoin.Network {
    return BITCOIN_NETWORKS[this._network] || bitcoin.networks.testnet;
  }

  /**
   * Build unsigned PSBT for claim transaction
   */
  async buildClaimPsbt(request: PsbtBuildRequest): Promise<PsbtBuildResult> {
    try {
      const feeRate = request.feeRate || DEFAULT_FEE_RATE;
      const estimatedFee = Math.ceil(CLAIM_TX_SIZE_ESTIMATE * feeRate);
      const requiredAmount = estimatedFee + DUST_LIMIT;

      claimLogger.info("Building claim PSBT", {
        address: request.address,
        feeRate,
        estimatedFee,
        requiredAmount,
      });

      // 1. Get UTXOs for the address
      const utxos = await this.mempoolService.getAddressUtxos(request.address);

      if (utxos.length === 0) {
        return {
          success: false,
          error: "No UTXOs available. Please deposit Bitcoin to your address.",
        };
      }

      // 2. Select best UTXO
      const selectedUtxo = selectBestUtxo(utxos, MIN_CLAIM_UTXO_VALUE, true);

      if (!selectedUtxo) {
        const totalAvailable = utxos.reduce((sum, u) => sum + u.value, 0);
        return {
          success: false,
          error: `Insufficient funds. Need at least ${MIN_CLAIM_UTXO_VALUE} sats in a single UTXO, but largest UTXO is ${Math.max(...utxos.map((u) => u.value))} sats. Total available: ${totalAvailable} sats.`,
        };
      }

      claimLogger.info("Selected UTXO", {
        txid: selectedUtxo.txid,
        vout: selectedUtxo.vout,
        value: selectedUtxo.value,
      });

      // 3. Calculate change
      const changeAmount = selectedUtxo.value - estimatedFee;
      if (changeAmount < DUST_LIMIT) {
        return {
          success: false,
          error: `UTXO value (${selectedUtxo.value} sats) too small. After fee (${estimatedFee} sats), change would be dust.`,
        };
      }

      // 4. Build PSBT using bitcoinjs-lib
      const psbt = new bitcoin.Psbt({ network: this.getNetworkConfig() });

      // Add input
      const scriptPubKey = addressToScriptPubkey(request.address);
      const isTaproot =
        request.address.startsWith("tb1p") ||
        request.address.startsWith("bc1p");

      const inputData: {
        hash: string;
        index: number;
        witnessUtxo: { script: Buffer; value: number };
        tapInternalKey?: Buffer;
      } = {
        hash: selectedUtxo.txid,
        index: selectedUtxo.vout,
        witnessUtxo: {
          script: Buffer.from(scriptPubKey),
          value: selectedUtxo.value,
        },
      };

      if (isTaproot) {
        // Extract internal pubkey from taproot scriptPubKey (starts with OP_1 (51) + PUSH32 (20))
        inputData.tapInternalKey = Buffer.from(scriptPubKey.slice(2, 34));
      }

      psbt.addInput(inputData);

      // Add OP_RETURN output
      const opReturnBytes = stringToBytes(request.opReturnData);
      const opReturnScript = buildOpReturnScript(opReturnBytes);
      psbt.addOutput({
        script: Buffer.from(opReturnScript),
        value: 0,
      });

      // Add change output
      psbt.addOutput({
        address: request.address,
        value: changeAmount,
      });

      const psbtBase64 = psbt.toBase64();
      const psbtHex = psbt.toHex();

      return {
        success: true,
        psbtBase64,
        psbtHex,
        fee: estimatedFee,
        inputUtxo: selectedUtxo,
      };
    } catch (error) {
      claimLogger.error("Failed to build claim PSBT", { error });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to build transaction",
      };
    }
  }

  /**
   * Finalize signed PSBT and extract raw transaction
   */
  async finalizePsbt(signedPsbtBase64: string): Promise<{
    success: boolean;
    txHex?: string;
    txid?: string;
    error?: string;
  }> {
    try {
      // Decode and finalize using bitcoinjs-lib
      const psbt = bitcoin.Psbt.fromBase64(signedPsbtBase64, {
        network: this.getNetworkConfig(),
      });

      psbt.finalizeAllInputs();
      const tx = psbt.extractTransaction();
      const txHex = tx.toHex();
      const txid = tx.getId();

      return {
        success: true,
        txHex,
        txid,
      };
    } catch (error) {
      claimLogger.error("Failed to finalize PSBT", { error });
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to finalize transaction",
      };
    }
  }
}

/**
 * Create PSBT builder instance
 */
export function createPsbtBuilder(
  mempoolService: IMempoolService,
  network: BitcoinNetwork = "testnet4",
): PsbtBuilder {
  return new PsbtBuilder(mempoolService, network);
}
