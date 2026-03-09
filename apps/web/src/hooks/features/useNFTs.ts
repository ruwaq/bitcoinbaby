import { useCallback, useMemo } from "react";
import {
  useWalletStore,
  useNFTSale,
  usePendingTxStore,
  useNFTStore,
  type PendingTransaction,
  type NFTRecord,
  type NFTListingWithNFT,
} from "@bitcoinbaby/core";
import { useMintNFT, type MintStep } from "@/hooks/useMintNFT";
import { useNFTSync, useInvalidateNFTs } from "@/hooks/useNFTSync";
import { useClaimNFT } from "@/hooks/useClaimNFT";
import { useVirtualBalance } from "@/hooks/useVirtualBalance";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useEvolution } from "@/hooks/useEvolution";
import type { BabyNFTState } from "@bitcoinbaby/bitcoin";
import type { TransactionDetails } from "@bitcoinbaby/ui";

/**
 * useNFTs - Unified hook for NFT dashboard
 *
 * Combines:
 * - NFT collection with sync
 * - Minting flow
 * - Claiming flow
 * - Marketplace (buy/sell)
 * - Virtual balance for $BABY
 * - Pending NFT transactions
 *
 * @example
 * const { collection, minting, claiming, marketplace, balances } = useNFTs();
 */

export interface UseNFTsReturn {
  // Collection state
  collection: {
    nfts: BabyNFTState[];
    isLoading: boolean;
    isFetching: boolean;
    refresh: () => void;
    lastSynced: number | null;
    error: string | null;
    setNFTs: (nfts: BabyNFTState[]) => void;
    invalidate: () => void;
  };

  // Minting
  minting: {
    mint: () => Promise<{
      success: boolean;
      nft?: BabyNFTState;
      txid?: string;
      error?: string;
    }>;
    isLoading: boolean;
    error: string | null;
    lastMinted: BabyNFTState | null;
    txid: string | null;
    commitTxid: string | null;
    currentStep: MintStep;
    reset: () => void;
    canMint: boolean;
    isWalletConnected: boolean;
    price: {
      formatted: string;
      sats: bigint;
    };
    transactionDetails: TransactionDetails;
  };

  // Claiming
  claiming: {
    claim: (txid: string) => Promise<{ success: boolean; error?: string }>;
    isLoading: boolean;
    error: string | null;
    lastClaimed: NFTRecord | null;
    reset: () => void;
  };

  // Marketplace
  marketplace: {
    listings: NFTListingWithNFT[];
    isLoading: boolean;
    isProcessing: boolean;
    error: string | null;
    buyNFT: (tokenId: number) => Promise<{ success: boolean; error?: string }>;
    listNFT: (
      tokenId: number,
      price: number,
    ) => Promise<{ success: boolean; error?: string }>;
  };

  // Evolution
  evolution: {
    evolve: (nft: BabyNFTState) => Promise<{
      success: boolean;
      txid?: string;
      newLevel?: number;
      error?: string;
    }>;
    isEvolving: boolean;
    error: string | null;
    canEvolve: (nft: BabyNFTState) => boolean;
    getEvolutionCost: (nft: BabyNFTState) => bigint;
    getXPRequired: (nft: BabyNFTState) => number;
    clearError: () => void;
  };

  // Balances
  balances: {
    virtualBABY: bigint;
  };

  // Pending transactions (NFT-related only)
  pendingTransactions: PendingTransaction[];
  refreshTransactions: () => void;
  clearCompletedTransactions: () => void;

  // Wallet address
  walletAddress: string | undefined;
}

export function useNFTs(): UseNFTsReturn {
  const wallet = useWalletStore((s) => s.wallet);
  const walletAddress = wallet?.address;

  // NFT Sync with TanStack Query
  const {
    nfts: ownedNFTs,
    isLoading,
    isFetching,
    refresh: refreshNFTs,
    lastSynced,
    error: syncError,
  } = useNFTSync();
  const invalidateNFTs = useInvalidateNFTs();
  const { setOwnedNFTs } = useNFTStore();

  // Pending transactions
  const pendingTransactions = usePendingTxStore((s) => s.transactions);
  const refreshTransactions = usePendingTxStore((s) => s.refresh);
  const clearCompletedTransactions = usePendingTxStore((s) => s.clearCompleted);

  // Mint NFT hook
  const {
    isLoading: isMinting,
    error: mintError,
    lastMinted,
    txid,
    commitTxid,
    currentStep,
    mint,
    reset: resetMint,
    canMint,
    isWalletConnected,
  } = useMintNFT();

  // Claim NFT hook
  const {
    isLoading: isClaiming,
    error: claimError,
    lastClaimed,
    claim,
    reset: resetClaim,
  } = useClaimNFT();

  // Virtual balance for $BABY tokens
  const { virtualBalance } = useVirtualBalance({ address: walletAddress });

  // Marketplace hook
  const {
    listings,
    isLoading: isLoadingListings,
    buyNFT,
    listNFT,
    isProcessing: isProcessingMarketplace,
    processingError: marketplaceError,
  } = useMarketplace();

  // Evolution hook
  const {
    evolve,
    isEvolving,
    error: evolutionError,
    canEvolve,
    getEvolutionCost,
    getXPRequired,
    clearError: clearEvolutionError,
  } = useEvolution();

  // NFT Sale hook for pricing
  const { formattedPrice, price } = useNFTSale({
    buyerAddress: walletAddress,
    buyerBalance: 0n,
  });

  // Calculate transaction details for minting
  const priceSats = Number(price.priceSats);
  const feeSats = 1500;

  const transactionDetails: TransactionDetails = useMemo(
    () => ({
      type: "mint" as const,
      title: "Mint Genesis Baby",
      description:
        "You are about to mint a new Genesis Baby NFT. The traits will be randomly generated - it's a surprise!",
      costs: [
        {
          label: "NFT Price",
          amount: formattedPrice,
          sublabel: "Fixed price",
        },
        {
          label: "Network Fee",
          amount: `~${feeSats.toLocaleString()} sats`,
          sublabel: "Estimated",
        },
      ],
      totalSats: priceSats + feeSats,
      formattedTotal: `${((priceSats + feeSats) / 100_000_000).toFixed(8)} BTC`,
      feeEstimate: `${feeSats.toLocaleString()} sats`,
      additionalInfo: "Testnet4 - No real BTC will be spent",
    }),
    [formattedPrice, priceSats, feeSats],
  );

  // Filter NFT-related transactions (including evolution)
  const nftTransactions = useMemo(
    () =>
      pendingTransactions.filter(
        (tx) =>
          tx.type === "nft_mint" ||
          tx.type === "nft_purchase" ||
          tx.type === "nft_evolution",
      ),
    [pendingTransactions],
  );

  // Wrapper for claim that invalidates after success
  const handleClaim = useCallback(
    async (claimTxid: string) => {
      const result = await claim(claimTxid);
      if (result.success) {
        invalidateNFTs();
        refreshNFTs();
      }
      return result;
    },
    [claim, invalidateNFTs, refreshNFTs],
  );

  return {
    collection: {
      nfts: ownedNFTs,
      isLoading,
      isFetching,
      refresh: refreshNFTs,
      lastSynced,
      error: syncError,
      setNFTs: setOwnedNFTs,
      invalidate: invalidateNFTs,
    },

    minting: {
      mint,
      isLoading: isMinting,
      error: mintError,
      lastMinted,
      txid,
      commitTxid,
      currentStep,
      reset: resetMint,
      canMint,
      isWalletConnected,
      price: {
        formatted: formattedPrice,
        sats: price.priceSats,
      },
      transactionDetails,
    },

    claiming: {
      claim: handleClaim,
      isLoading: isClaiming,
      error: claimError,
      lastClaimed,
      reset: resetClaim,
    },

    marketplace: {
      listings,
      isLoading: isLoadingListings,
      isProcessing: isProcessingMarketplace,
      error: marketplaceError,
      buyNFT,
      listNFT,
    },

    evolution: {
      evolve,
      isEvolving,
      error: evolutionError,
      canEvolve,
      getEvolutionCost,
      getXPRequired,
      clearError: clearEvolutionError,
    },

    balances: {
      virtualBABY: virtualBalance,
    },

    pendingTransactions: nftTransactions,
    refreshTransactions,
    clearCompletedTransactions,

    walletAddress,
  };
}

export default useNFTs;
