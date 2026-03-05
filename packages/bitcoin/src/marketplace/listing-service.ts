/**
 * Listing Service
 *
 * Creates and manages PSBT-based NFT listings for atomic swaps.
 *
 * Architecture follows Magic Eden / OKX pattern:
 * - Seller signs with SIGHASH_SINGLE | ANYONECANPAY
 * - Buyer completes PSBT with payment UTXOs
 * - Single atomic transaction swaps NFT for BTC
 */

import * as bitcoin from "bitcoinjs-lib";
import type { UTXO } from "../blockchain/types";
import type {
  CreateListingParams,
  CreateListingResult,
  CompletePurchaseParams,
  CompletePurchaseResult,
  PurchaseFeeBreakdown,
} from "./types";
import {
  MARKETPLACE_CONFIG,
  calculateRoyalty,
  calculateBuyerFee,
  calculateSellerReceives,
  getRoyaltyAddress,
  getMarketplaceFeeAddress,
  validateListingPrice,
} from "./config";
import type { BitcoinNetwork } from "../types";

// Network configurations
const NETWORKS: Record<BitcoinNetwork, bitcoin.Network> = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  testnet4: bitcoin.networks.testnet,
  regtest: bitcoin.networks.regtest,
};

// =============================================================================
// CONSTANTS
// =============================================================================

/** Dust limit for outputs (546 sats for P2TR) */
const DUST_LIMIT = 546;

/** SIGHASH types for atomic swaps */
const SIGHASH_SINGLE = bitcoin.Transaction.SIGHASH_SINGLE;
const SIGHASH_ANYONECANPAY = bitcoin.Transaction.SIGHASH_ANYONECANPAY;
const SIGHASH_ALL = bitcoin.Transaction.SIGHASH_ALL;

/** Estimated vbytes per input/output type */
const VBYTES = {
  P2TR_INPUT: 58,
  P2TR_OUTPUT: 43,
  OVERHEAD: 11,
};

// =============================================================================
// LISTING SERVICE
// =============================================================================

export interface ListingServiceOptions {
  network?: BitcoinNetwork;
}

export class ListingService {
  private readonly network: BitcoinNetwork;
  private readonly networkConfig: bitcoin.Network;

  constructor(options: ListingServiceOptions = {}) {
    this.network = options.network ?? "testnet4";
    this.networkConfig = NETWORKS[this.network];
  }

  // ===========================================================================
  // LISTING CREATION (Seller Side)
  // ===========================================================================

  /**
   * Create a listing PSBT for seller to sign
   *
   * The seller's PSBT contains:
   * - Input: NFT UTXO (to be signed with SIGHASH_SINGLE|ANYONECANPAY)
   * - Output 0: Payment to seller
   * - Output 1: Royalty payment
   *
   * The buyer will add:
   * - Additional inputs for payment
   * - Output for NFT to buyer
   * - Output for change
   */
  createListingPSBT(params: CreateListingParams): CreateListingResult {
    try {
      // Validate price
      const priceValidation = validateListingPrice(params.priceSats);
      if (!priceValidation.valid) {
        return { success: false, error: priceValidation.error };
      }

      // Calculate amounts
      const sellerReceives = calculateSellerReceives(params.priceSats);
      const royaltyAmount = calculateRoyalty(
        params.priceSats,
        params.royaltyPercent,
      );

      // Ensure outputs are above dust
      if (sellerReceives < BigInt(DUST_LIMIT)) {
        return {
          success: false,
          error: `Seller payment ${sellerReceives} is below dust limit`,
        };
      }

      // Create PSBT
      const psbt = new bitcoin.Psbt({ network: this.networkConfig });

      // Add NFT input (seller's)
      // Note: Seller will sign this with SIGHASH_SINGLE | ANYONECANPAY
      psbt.addInput({
        hash: params.nftUtxo.txid,
        index: params.nftUtxo.vout,
        witnessUtxo: {
          script: bitcoin.address.toOutputScript(
            params.sellerAddress,
            this.networkConfig,
          ),
          value: params.nftUtxo.value,
        },
        // Taproot key path spend info will be added when signing
        sighashType: SIGHASH_SINGLE | SIGHASH_ANYONECANPAY,
      });

      // Output 0: Payment to seller
      psbt.addOutput({
        address: params.sellerAddress,
        value: Number(sellerReceives),
      });

      // Output 1: Royalty (if non-zero and above dust)
      if (royaltyAmount >= BigInt(DUST_LIMIT)) {
        psbt.addOutput({
          address: params.royaltyAddress,
          value: Number(royaltyAmount),
        });
      }

      return {
        success: true,
        psbt: psbt.toBase64(),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create listing PSBT",
      };
    }
  }

  // ===========================================================================
  // PURCHASE COMPLETION (Buyer Side)
  // ===========================================================================

  /**
   * Complete a purchase by adding buyer's inputs and outputs
   *
   * Takes the seller's partially signed PSBT and adds:
   * - Buyer's payment inputs
   * - NFT output to buyer
   * - Marketplace fee output (if applicable)
   * - Change output to buyer
   */
  completePurchasePSBT(params: CompletePurchaseParams): CompletePurchaseResult {
    try {
      // Parse seller's PSBT
      const psbt = bitcoin.Psbt.fromBase64(params.listingPsbt);
      const feeRate = params.feeRate ?? 10;

      // Calculate the price from seller's output
      const sellerOutput = psbt.txOutputs[0];
      if (!sellerOutput) {
        return {
          success: false,
          error: "Invalid listing PSBT: no seller output",
        };
      }

      // Reverse calculate the original price from what seller receives
      // sellerReceives = price - sellerFee = price * (1 - sellerFeePercent/100)
      const sellerFeePercent = MARKETPLACE_CONFIG.sellerFeePercent;
      const priceSats =
        sellerFeePercent === 0
          ? BigInt(sellerOutput.value)
          : (BigInt(sellerOutput.value) * 10000n) /
            BigInt(10000 - Math.round(sellerFeePercent * 100));

      // Calculate fees
      const breakdown = this.calculateFeeBreakdown(priceSats, feeRate);

      // Calculate total needed from buyer
      const totalNeeded = breakdown.totalCostSats;

      // Select UTXOs for payment
      const selectedUtxos = this.selectCoins(params.buyerUtxos, totalNeeded);
      if (!selectedUtxos) {
        return {
          success: false,
          error: `Insufficient funds. Need ${totalNeeded} sats`,
        };
      }

      const totalInput = selectedUtxos.reduce(
        (sum, u) => sum + BigInt(u.value),
        0n,
      );

      // Add buyer's inputs
      for (const utxo of selectedUtxos) {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: bitcoin.address.toOutputScript(
              params.buyerAddress,
              this.networkConfig,
            ),
            value: utxo.value,
          },
          sighashType: SIGHASH_ALL,
        });
      }

      // Add NFT output to buyer (dust amount to carry the NFT)
      psbt.addOutput({
        address: params.buyerAddress,
        value: DUST_LIMIT,
      });

      // Add marketplace fee output (if above dust)
      if (breakdown.marketplaceFeeSats >= BigInt(DUST_LIMIT)) {
        psbt.addOutput({
          address: getMarketplaceFeeAddress(),
          value: Number(breakdown.marketplaceFeeSats),
        });
      }

      // Calculate and add change
      const totalOutputs =
        breakdown.sellerReceivesSats +
        breakdown.royaltySats +
        BigInt(DUST_LIMIT) + // NFT output
        breakdown.marketplaceFeeSats +
        breakdown.networkFeeSats;

      const change = totalInput - totalOutputs;

      if (change >= BigInt(DUST_LIMIT)) {
        psbt.addOutput({
          address: params.buyerAddress,
          value: Number(change),
        });
      }

      return {
        success: true,
        psbt: psbt.toBase64(),
        fee: breakdown.networkFeeSats,
        totalCost: breakdown.totalCostSats,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to complete purchase PSBT",
      };
    }
  }

  // ===========================================================================
  // FEE CALCULATION
  // ===========================================================================

  /**
   * Calculate complete fee breakdown for a purchase
   */
  calculateFeeBreakdown(
    priceSats: bigint,
    feeRate: number = 10,
  ): PurchaseFeeBreakdown {
    const royaltySats = calculateRoyalty(priceSats);
    const marketplaceFeeSats = calculateBuyerFee(priceSats);
    const sellerReceivesSats = calculateSellerReceives(priceSats);

    // Estimate transaction size
    // Typical purchase: 2 inputs (NFT + payment), 4-5 outputs
    const estimatedVbytes =
      VBYTES.OVERHEAD +
      2 * VBYTES.P2TR_INPUT + // NFT input + 1 payment input
      4 * VBYTES.P2TR_OUTPUT; // seller + royalty + NFT + change

    const networkFeeSats = BigInt(Math.ceil(estimatedVbytes * feeRate));

    const totalCostSats =
      priceSats + royaltySats + marketplaceFeeSats + networkFeeSats;

    return {
      priceSats,
      royaltySats,
      marketplaceFeeSats,
      networkFeeSats,
      totalCostSats,
      sellerReceivesSats,
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  /**
   * Simple coin selection - selects UTXOs until target is met
   */
  private selectCoins(utxos: UTXO[], targetSats: bigint): UTXO[] | null {
    // Sort by value descending for efficiency
    const sorted = [...utxos].sort((a, b) => b.value - a.value);

    const selected: UTXO[] = [];
    let total = 0n;

    for (const utxo of sorted) {
      selected.push(utxo);
      total += BigInt(utxo.value);

      // Add buffer for change output fee
      const bufferSats = BigInt(VBYTES.P2TR_OUTPUT * 10); // ~430 sats at 10 sat/vB
      if (total >= targetSats + bufferSats) {
        return selected;
      }
    }

    // Not enough funds
    return null;
  }

  /**
   * Verify a listing PSBT is valid
   */
  verifyListingPSBT(psbtBase64: string): {
    valid: boolean;
    sellerAddress?: string;
    priceSats?: bigint;
    error?: string;
  } {
    try {
      const psbt = bitcoin.Psbt.fromBase64(psbtBase64);

      // Must have at least 1 input (NFT) and 1 output (seller payment)
      if (psbt.data.inputs.length < 1) {
        return { valid: false, error: "No inputs in PSBT" };
      }

      if (psbt.txOutputs.length < 1) {
        return { valid: false, error: "No outputs in PSBT" };
      }

      // Extract seller address from first output
      const sellerOutput = psbt.txOutputs[0];
      const sellerAddress = bitcoin.address.fromOutputScript(
        sellerOutput.script,
        this.networkConfig,
      );

      return {
        valid: true,
        sellerAddress,
        priceSats: BigInt(sellerOutput.value),
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Invalid PSBT",
      };
    }
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createListingService(
  options?: ListingServiceOptions,
): ListingService {
  return new ListingService(options);
}

// =============================================================================
// ERRORS
// =============================================================================

export class ListingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ListingError";
  }
}
