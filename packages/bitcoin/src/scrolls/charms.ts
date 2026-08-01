/**
 * Charms Service
 *
 * High-level service for Charms token operations.
 * Handles spell creation, token minting, and transfers.
 */

import { ScrollsClient, type ScrollsClientOptions } from "./client";
import type { ScrollsNetwork, CharmUTXO, SpellConfig } from "./types";
import {
  validateAddress,
  validateHash,
  validateSatoshis,
  validateNonce,
  validateNumberOfInputs,
  validatePositiveInt,
  assertValid,
  ValidationError,
} from "../validation";
import { stringifyWithBigInt } from "../utils";

export interface CharmsServiceOptions extends ScrollsClientOptions {
  tokenTicker?: string;
}

export class CharmsService {
  private client: ScrollsClient;
  private tokenTicker: string;

  constructor(options: CharmsServiceOptions = {}) {
    this.client = new ScrollsClient(options);
    this.tokenTicker = options.tokenTicker || "BABY";
  }

  /**
   * Set the network
   */
  setNetwork(network: ScrollsNetwork): void {
    this.client.setNetwork(network);
  }

  /**
   * Get the current network
   */
  getNetwork(): ScrollsNetwork {
    return this.client.getNetwork();
  }

  /**
   * Get the Scrolls client for direct API access
   */
  getClient(): ScrollsClient {
    return this.client;
  }

  /**
   * Create a mining spell configuration
   * This is used to mint new tokens as proof of work reward
   */
  createMiningSpell(
    minerAddress: string,
    amount: bigint,
    proofOfWork: string,
  ): SpellConfig {
    // Validate inputs
    const network = this.client.getNetwork();
    const btcNetwork = network === "main" ? "mainnet" : "testnet4";
    assertValid(
      validateAddress(minerAddress, btcNetwork),
      "minerAddress",
      "INVALID_ADDRESS",
    );
    assertValid(validateSatoshis(amount, "amount"), "amount", "INVALID_AMOUNT");
    assertValid(validateHash(proofOfWork), "proofOfWork", "INVALID_HASH");

    return {
      version: "1",
      app: `${this.tokenTicker.toLowerCase()}-miner`,
      inputs: [],
      outputs: [
        {
          type: "mint",
          address: minerAddress,
          amount,
          data: proofOfWork,
        },
      ],
    };
  }

  /**
   * Create a transfer spell configuration
   */
  createTransferSpell(
    fromUtxo: CharmUTXO,
    toAddress: string,
    amount: bigint,
  ): SpellConfig {
    // Validate inputs
    const network = this.client.getNetwork();
    const btcNetwork = network === "main" ? "mainnet" : "testnet4";
    assertValid(
      validateAddress(toAddress, btcNetwork),
      "toAddress",
      "INVALID_ADDRESS",
    );
    assertValid(validateSatoshis(amount, "amount"), "amount", "INVALID_AMOUNT");

    if (amount <= BigInt(0)) {
      throw new ValidationError(
        "Amount must be positive",
        "INVALID_AMOUNT",
        "amount",
      );
    }

    const charm = fromUtxo.charms?.find((c) => c.ticker === this.tokenTicker);
    if (!charm) {
      throw new Error(`No ${this.tokenTicker} charm found in UTXO`);
    }

    if (charm.amount < amount) {
      throw new Error(`Insufficient ${this.tokenTicker} balance`);
    }

    const changeAmount = charm.amount - amount;
    const outputs: SpellConfig["outputs"] = [
      {
        type: "transfer",
        address: toAddress,
        amount,
      },
    ];

    // Add change output if needed
    if (changeAmount > BigInt(0)) {
      outputs.push({
        type: "transfer",
        address: fromUtxo.scriptPubKey, // Back to sender
        amount: changeAmount,
      });
    }

    return {
      version: "1",
      app: `${this.tokenTicker.toLowerCase()}-transfer`,
      inputs: [
        {
          type: "charm",
          txid: fromUtxo.txid,
          vout: fromUtxo.vout,
          amount: charm.amount,
        },
      ],
      outputs,
    };
  }

  /**
   * Create OP_RETURN data for a spell
   * This embeds the spell data in a Bitcoin transaction
   */
  createSpellOpReturn(spell: SpellConfig): Uint8Array {
    // Charms uses a specific encoding for spell data
    // Format: CHARM_MAGIC + version + compressed_spell_data
    const CHARM_MAGIC = new Uint8Array([0x43, 0x48, 0x52, 0x4d]); // "CHRM"

    const spellJson = stringifyWithBigInt(spell);
    const encoder = new TextEncoder();
    const spellData = encoder.encode(spellJson);

    // Combine magic + data
    const result = new Uint8Array(CHARM_MAGIC.length + spellData.length);
    result.set(CHARM_MAGIC);
    result.set(spellData, CHARM_MAGIC.length);

    return result;
  }

  /**
   * Parse OP_RETURN data to extract spell
   */
  parseSpellOpReturn(data: Uint8Array): SpellConfig | null {
    const CHARM_MAGIC = new Uint8Array([0x43, 0x48, 0x52, 0x4d]); // "CHRM"

    // Check magic bytes
    if (data.length < CHARM_MAGIC.length) return null;
    for (let i = 0; i < CHARM_MAGIC.length; i++) {
      if (data[i] !== CHARM_MAGIC[i]) return null;
    }

    try {
      const decoder = new TextDecoder();
      const spellJson = decoder.decode(data.slice(CHARM_MAGIC.length));
      return JSON.parse(spellJson) as SpellConfig;
    } catch {
      return null;
    }
  }

  /**
   * Calculate fee for a charm transaction
   */
  async calculateFee(
    numberOfInputs: number,
    totalInputSats: number,
  ): Promise<{
    fee: number;
    feeAddress: string;
  }> {
    // Validate inputs
    assertValid(
      validateNumberOfInputs(numberOfInputs),
      "numberOfInputs",
      "INVALID_INPUT_COUNT",
    );
    assertValid(
      validatePositiveInt(
        totalInputSats,
        "totalInputSats",
        0,
        21_000_000 * 100_000_000,
      ),
      "totalInputSats",
      "INVALID_SATOSHIS",
    );

    const feeCalc = await this.client.calculateFee(
      numberOfInputs,
      totalInputSats,
    );
    return {
      fee: feeCalc.totalFee,
      feeAddress: feeCalc.feeAddress,
    };
  }

  /**
   * Derive a unique address for mining operations
   */
  async deriveMiningAddress(nonce: number): Promise<string> {
    assertValid(validateNonce(nonce), "nonce", "INVALID_NONCE");
    return this.client.deriveAddress(nonce);
  }
}

/**
 * Create a Charms service instance
 */
export function createCharmsService(
  options?: CharmsServiceOptions,
): CharmsService {
  return new CharmsService(options);
}
