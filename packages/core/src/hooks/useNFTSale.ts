/**
 * useNFTSale Hook
 *
 * Simple hook for NFT purchase.
 * Fixed price: 50,000 sats
 * All funds → Treasury
 */

import { useState, useCallback, useMemo } from "react";
import {
  calculateNFTPrice,
  validatePurchase,
  NFT_SALE_CONFIG,
  getTreasuryAddress,
  createMempoolClient,
  TransactionBuilder,
  type NFTPriceBreakdown,
  type PurchaseValidation,
  type BitcoinNetwork,
} from "@bitcoinbaby/bitcoin";

// =============================================================================
// TYPES
// =============================================================================

export interface UseNFTSaleOptions {
  buyerAddress?: string;
  buyerBalance?: bigint;
  /** X-only public key (32 bytes) for Taproot signing */
  xOnlyPubKey?: Uint8Array;
  /** Bitcoin network (default: testnet4) */
  network?: BitcoinNetwork;
}

export interface UseNFTSaleReturn {
  /** Price info */
  price: NFTPriceBreakdown;
  /** Formatted price string */
  formattedPrice: string;
  /** Validation result */
  validation: PurchaseValidation;
  /** Can purchase? */
  canPurchase: boolean;
  /** Is purchasing? */
  isPurchasing: boolean;
  /** Error message */
  error: string | null;
  /** Initiate purchase */
  purchase: (tokenId: number) => Promise<PurchaseResult>;
}

export interface PurchaseResult {
  success: boolean;
  psbt?: string;
  error?: string;
}

// =============================================================================
// HOOK
// =============================================================================

export function useNFTSale(options: UseNFTSaleOptions = {}): UseNFTSaleReturn {
  const {
    buyerAddress,
    buyerBalance = 0n,
    xOnlyPubKey,
    network = "testnet4",
  } = options;

  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Price (fixed - no calculation needed)
  const price = useMemo(() => calculateNFTPrice(), []);

  // Validation
  const validation = useMemo(
    () =>
      validatePurchase({
        buyerAddress: buyerAddress || "",
        buyerBalance,
      }),
    [buyerAddress, buyerBalance],
  );

  // Can purchase?
  const canPurchase = !!(buyerAddress && validation.valid && !isPurchasing);

  /**
   * Purchase NFT
   *
   * Creates a PSBT for NFT purchase:
   * - Output 0: Payment to treasury (50,000 sats)
   * - Output 1: NFT to buyer (546 sats dust)
   * - Output 2: Change to buyer (if any)
   */
  const purchase = useCallback(
    async (_tokenId: number): Promise<PurchaseResult> => {
      const treasury = getTreasuryAddress();

      if (!treasury) {
        return { success: false, error: "Treasury not configured" };
      }

      if (!canPurchase) {
        return {
          success: false,
          error: validation.errors[0] || "Cannot purchase",
        };
      }

      if (!buyerAddress) {
        return { success: false, error: "No buyer address" };
      }

      setIsPurchasing(true);
      setError(null);

      try {
        // 1. Get buyer UTXOs from Mempool
        const mempool = createMempoolClient({ network });
        const rawUtxos = await mempool.getUTXOs(buyerAddress);

        if (rawUtxos.length === 0) {
          return { success: false, error: "No UTXOs available" };
        }

        // 2. Build transaction using TransactionBuilder
        const builder = new TransactionBuilder({
          network,
          enableRBF: true,
        });

        // Convert raw UTXOs to TxUTXOs format
        const txUtxos = TransactionBuilder.convertUTXOs(
          rawUtxos,
          buyerAddress,
          network,
          xOnlyPubKey,
        );

        // Select coins for the total amount needed
        const totalNeeded =
          Number(NFT_SALE_CONFIG.priceSats) + Number(NFT_SALE_CONFIG.dustLimit);
        const selection = builder.selectCoins(txUtxos, totalNeeded, 1);

        // Build unsigned transaction
        const unsignedTx = builder.buildTransfer(
          selection.inputs,
          treasury,
          Number(NFT_SALE_CONFIG.priceSats),
          buyerAddress,
        );

        // Add NFT output (dust amount to buyer - this will hold the NFT charm)
        unsignedTx.outputs.splice(1, 0, {
          address: buyerAddress,
          value: Number(NFT_SALE_CONFIG.dustLimit),
        });

        // Recalculate change after adding NFT output
        const totalOutput = unsignedTx.outputs.reduce(
          (sum, o) => sum + o.value,
          0,
        );
        const changeIndex = unsignedTx.outputs.findIndex(
          (o) =>
            o.address === buyerAddress &&
            o.value !== Number(NFT_SALE_CONFIG.dustLimit),
        );
        if (changeIndex >= 0) {
          unsignedTx.outputs[changeIndex].value =
            selection.totalInputValue - totalOutput - unsignedTx.fee;
        }

        // 4. Build PSBT
        const psbt = builder.buildPSBT(unsignedTx);

        // Return PSBT hex for wallet signing
        return {
          success: true,
          psbt: psbt.toHex(),
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Purchase failed";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsPurchasing(false);
      }
    },
    [canPurchase, validation, buyerAddress, network, xOnlyPubKey],
  );

  return {
    price,
    formattedPrice: price.displayPrice,
    validation,
    canPurchase,
    isPurchasing,
    error,
    purchase,
  };
}

// Legacy export for compatibility
export { useNFTSale as default };
