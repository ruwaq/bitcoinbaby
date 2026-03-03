"use client";

/**
 * NFTsSection - Genesis Babies Collection & Mint
 *
 * NFT management with:
 * - Sub-tabs: Collection | Mint New | Claim | Marketplace
 * - Collection grid with stats
 * - Random mint (no preview - surprise!)
 * - Claim legacy NFTs by txid
 */

import { useState, useCallback } from "react";
import {
  HelpTooltip,
  TransactionConfirmModal,
  PendingTransactions,
  getEvolutionStatus,
  SectionHeader,
  InfoBanner,
  TabButton,
  type BabyNFTState,
  type TransactionDetails,
} from "@bitcoinbaby/ui";
import {
  NFTMintFlow,
  NFTClaimFlow,
  NFTCollectionView,
  NFTMarketplaceView,
} from "@/components/features/nft";
import {
  useWalletStore,
  useNFTSale,
  usePendingTxStore,
  useNFTStore,
} from "@bitcoinbaby/core";
import { useMintNFT } from "@/hooks/useMintNFT";
import { useNFTSync, useInvalidateNFTs } from "@/hooks/useNFTSync";
import { useClaimNFT } from "@/hooks/useClaimNFT";
import { useVirtualBalance } from "@/hooks/useVirtualBalance";
import { useMarketplace } from "@/hooks/useMarketplace";

type SubTab = "collection" | "mint" | "claim" | "marketplace";
type MintState = "info" | "confirming" | "minting" | "revealing" | "success";

export function NFTsSection() {
  const [activeTab, setActiveTab] = useState<SubTab>("collection");
  const [mintState, setMintState] = useState<MintState>("info");
  const [evolvingIds, setEvolvingIds] = useState<Set<number>>(new Set());
  const [listingIds, setListingIds] = useState<Set<number>>(new Set());
  const [claimTxid, setClaimTxid] = useState("");
  const [selectedNFT, setSelectedNFT] = useState<BabyNFTState | null>(null);
  const [listFeedback, setListFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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
  const wallet = useWalletStore((s) => s.wallet);

  // Pending transactions
  const pendingTransactions = usePendingTxStore((s) => s.transactions);
  const refreshTransactions = usePendingTxStore((s) => s.refresh);
  const clearCompletedTransactions = usePendingTxStore((s) => s.clearCompleted);

  const {
    isLoading: isMinting,
    error: mintError,
    lastMinted,
    txid,
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
  const { virtualBalance } = useVirtualBalance({ address: wallet?.address });

  // Marketplace hook
  const {
    listings,
    isLoading: isLoadingListings,
    buyNFT,
    listNFT,
    isProcessing: isProcessingMarketplace,
    processingError: marketplaceError,
  } = useMarketplace();

  // NFT Sale hook for pricing
  const { formattedPrice, price } = useNFTSale({
    buyerAddress: wallet?.address,
    buyerBalance: 0n,
  });

  // Extract numeric values for transaction details
  const priceSats = Number(price.priceSats);
  const feeSats = 1500;

  // Transaction details for confirmation
  const transactionDetails: TransactionDetails = {
    type: "mint",
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
        amount: `~${(feeSats || 1500).toLocaleString()} sats`,
        sublabel: "Estimated",
      },
    ],
    totalSats: priceSats + (feeSats || 1500),
    formattedTotal: `${((priceSats + (feeSats || 1500)) / 100_000_000).toFixed(8)} BTC`,
    feeEstimate: `${(feeSats || 1500).toLocaleString()} sats`,
    additionalInfo: "Testnet4 - No real BTC will be spent",
  };

  // Handle mint button click - show confirmation first
  const handleMintClick = useCallback(() => {
    setMintState("confirming");
  }, []);

  // Handle confirmed mint
  const handleConfirmedMint = useCallback(async () => {
    setMintState("minting");

    const result = await mint();

    if (result.success && result.nft) {
      setMintState("revealing");
      await new Promise((r) => setTimeout(r, 2000));
      setOwnedNFTs([result.nft, ...ownedNFTs]);
      invalidateNFTs();
      setMintState("success");
    } else {
      setMintState("info");
    }
  }, [mint, setOwnedNFTs, ownedNFTs, invalidateNFTs]);

  const handleCancelMint = useCallback(() => {
    setMintState("info");
  }, []);

  const handleMintAnother = useCallback(() => {
    setMintState("info");
    resetMint();
  }, [resetMint]);

  const handleViewCollection = useCallback(() => {
    setMintState("info");
    resetMint();
    resetClaim();
    setActiveTab("collection");
  }, [resetMint, resetClaim]);

  // Handle claim NFT
  const handleClaimNFT = useCallback(async () => {
    if (!claimTxid.trim()) return;

    const result = await claim(claimTxid);
    if (result.success) {
      setClaimTxid("");
      invalidateNFTs();
      refreshNFTs();
    }
  }, [claimTxid, claim, invalidateNFTs, refreshNFTs]);

  // Handle selecting an NFT to view details/evolution
  const handleSelectNFT = useCallback(
    (nft: BabyNFTState) => {
      setSelectedNFT(selectedNFT?.tokenId === nft.tokenId ? null : nft);
    },
    [selectedNFT],
  );

  // Handle NFT evolution (level up)
  const handleEvolve = useCallback(
    async (nft: BabyNFTState) => {
      setEvolvingIds((prev) => new Set(prev).add(nft.tokenId));
      await new Promise((r) => setTimeout(r, 2000));

      const evolutionStatus = getEvolutionStatus(nft);
      if (evolutionStatus.canEvolve) {
        const updatedNFTs = ownedNFTs.map((n) =>
          n.tokenId === nft.tokenId ? { ...n, level: n.level + 1, xp: 0 } : n,
        );
        setOwnedNFTs(updatedNFTs);

        if (selectedNFT?.tokenId === nft.tokenId) {
          setSelectedNFT({ ...nft, level: nft.level + 1, xp: 0 });
        }
      }

      setEvolvingIds((prev) => {
        const next = new Set(prev);
        next.delete(nft.tokenId);
        return next;
      });
    },
    [ownedNFTs, setOwnedNFTs, selectedNFT],
  );

  // Handle listing an NFT for sale
  const handleListNFT = useCallback(
    async (nft: BabyNFTState, price: number) => {
      setListingIds((prev) => new Set(prev).add(nft.tokenId));
      setListFeedback(null);

      const result = await listNFT(nft.tokenId, price);

      if (result.success) {
        setListFeedback({
          type: "success",
          message: `NFT #${nft.tokenId} listed for ${price.toLocaleString()} sats!`,
        });
        setTimeout(() => setListFeedback(null), 5000);
      } else {
        setListFeedback({
          type: "error",
          message: result.error || "Failed to list NFT",
        });
      }

      setListingIds((prev) => {
        const next = new Set(prev);
        next.delete(nft.tokenId);
        return next;
      });
    },
    [listNFT],
  );

  const nftTransactions = pendingTransactions.filter(
    (tx) => tx.type === "nft_mint" || tx.type === "nft_purchase",
  );

  return (
    <div className="p-4 md:p-8 bg-pixel-bg-dark min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <SectionHeader
          title="GENESIS BABIES"
          description="Mint NFTs to boost your mining rewards"
          icon="👶"
          size="lg"
          helpTooltip={
            <HelpTooltip
              content="Genesis Babies are NFTs that boost your mining rewards. Each NFT has unique traits and rarity levels."
              title="NFT Collection"
              description="Higher rarity = Higher mining boost. Level up your NFTs by burning $BABY tokens."
              size="md"
            />
          }
          action={
            <div className="flex items-center gap-2">
              {isFetching && (
                <span className="font-pixel text-[7px] text-pixel-secondary animate-pulse">
                  Syncing...
                </span>
              )}
              {syncError && !isFetching && (
                <button
                  onClick={() => refreshNFTs()}
                  className="font-pixel text-[8px] text-pixel-error hover:text-pixel-primary bg-pixel-error/20 hover:bg-pixel-primary/20 px-2 py-1 rounded transition-colors"
                >
                  Sync failed - Retry
                </button>
              )}
              {!syncError && (
                <button
                  onClick={() => refreshNFTs()}
                  disabled={isFetching}
                  className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-primary transition-colors disabled:opacity-50"
                  title={
                    lastSynced
                      ? `Last synced: ${new Date(lastSynced).toLocaleTimeString()}`
                      : "Never synced"
                  }
                >
                  ↻ Refresh
                </button>
              )}
            </div>
          }
          className="mb-6"
        />

        {/* Sub-Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <TabButton
            active={activeTab === "collection"}
            onClick={() => setActiveTab("collection")}
            variant="primary"
          >
            My Collection ({ownedNFTs.length})
          </TabButton>
          <TabButton
            active={activeTab === "mint"}
            onClick={() => {
              setActiveTab("mint");
              setMintState("info");
            }}
            variant="success"
          >
            Mint New
          </TabButton>
          <TabButton
            active={activeTab === "claim"}
            onClick={() => {
              setActiveTab("claim");
              resetClaim();
            }}
            variant="secondary"
          >
            Claim NFT
          </TabButton>
          <TabButton
            active={activeTab === "marketplace"}
            onClick={() => setActiveTab("marketplace")}
            variant="warning"
          >
            Marketplace ({listings.length})
          </TabButton>
        </div>

        {/* List Feedback Banner */}
        {listFeedback && (
          <InfoBanner
            variant={listFeedback.type}
            onDismiss={() => setListFeedback(null)}
            className="mb-4"
          >
            <span className="font-pixel text-[9px] uppercase">
              {listFeedback.message}
            </span>
          </InfoBanner>
        )}

        {/* Tab Content */}
        {activeTab === "collection" && (
          <NFTCollectionView
            nfts={ownedNFTs}
            isLoading={isLoading}
            selectedNFT={selectedNFT}
            onSelectNFT={handleSelectNFT}
            onClearSelection={() => setSelectedNFT(null)}
            evolvingIds={evolvingIds}
            listingIds={listingIds}
            tokenBalance={virtualBalance}
            onEvolve={handleEvolve}
            onList={handleListNFT}
            onMintClick={() => {
              setActiveTab("mint");
              setMintState("info");
            }}
            formattedPrice={formattedPrice}
            pendingTransactions={pendingTransactions}
            onRefreshTransactions={refreshTransactions}
            onClearCompletedTransactions={clearCompletedTransactions}
          />
        )}

        {activeTab === "mint" && (
          <div className="max-w-2xl mx-auto">
            {/* Connection Required */}
            {!isWalletConnected && (
              <div className="mb-6 p-4 bg-pixel-bg-medium border-4 border-pixel-warning text-center">
                <p className="font-pixel text-[9px] text-pixel-warning uppercase mb-2">
                  Wallet Required
                </p>
                <p className="font-pixel-body text-sm text-pixel-text-muted mb-3">
                  Connect your wallet to mint NFTs on testnet4
                </p>
                <p className="font-pixel text-[8px] text-pixel-primary">
                  Go to Wallet tab to connect
                </p>
              </div>
            )}

            {/* Pending Transactions Banner */}
            {nftTransactions.filter(
              (tx) =>
                tx.status === "pending" ||
                tx.status === "mempool" ||
                tx.status === "confirming",
            ).length > 0 && (
              <PendingTransactions
                transactions={nftTransactions}
                onRefresh={refreshTransactions}
                onClearCompleted={clearCompletedTransactions}
                className="mb-6"
              />
            )}

            {/* Error Display */}
            {mintError && (
              <div className="mb-4 p-3 bg-pixel-error/20 border-4 border-pixel-error">
                <p className="font-pixel text-[8px] text-pixel-error uppercase">
                  {mintError}
                </p>
              </div>
            )}

            <NFTMintFlow
              state={mintState === "confirming" ? "info" : mintState}
              formattedPrice={formattedPrice}
              canMint={canMint}
              isWalletConnected={isWalletConnected}
              lastMinted={lastMinted}
              txid={txid}
              onMintClick={handleMintClick}
              onMintAnother={handleMintAnother}
              onViewCollection={handleViewCollection}
            />
          </div>
        )}

        {activeTab === "claim" && (
          <NFTClaimFlow
            isWalletConnected={isWalletConnected}
            claimTxid={claimTxid}
            onClaimTxidChange={setClaimTxid}
            isClaiming={isClaiming}
            claimError={claimError}
            lastClaimed={lastClaimed}
            onClaim={handleClaimNFT}
            onClaimAnother={() => {
              resetClaim();
              setClaimTxid("");
            }}
            onViewCollection={handleViewCollection}
          />
        )}

        {activeTab === "marketplace" && (
          <NFTMarketplaceView
            listings={listings}
            isLoading={isLoadingListings}
            currentUserAddress={wallet?.address}
            isProcessing={isProcessingMarketplace}
            error={marketplaceError}
            onBuy={buyNFT}
            onGoToCollection={() => setActiveTab("collection")}
          />
        )}

        {/* Transaction Confirmation Modal */}
        <TransactionConfirmModal
          isOpen={mintState === "confirming"}
          transaction={transactionDetails}
          isLoading={isMinting}
          onConfirm={handleConfirmedMint}
          onCancel={handleCancelMint}
        />
      </div>
    </div>
  );
}

export default NFTsSection;
