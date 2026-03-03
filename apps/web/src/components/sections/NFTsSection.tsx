"use client";

/**
 * NFTsSection - Genesis Babies Collection & Mint
 *
 * NFT management with:
 * - Sub-tabs: Collection | Mint New | Claim
 * - Collection grid with stats
 * - Random mint (no preview - surprise!)
 * - Info panel showing what you could get
 * - Claim legacy NFTs by txid
 */

import { useState, useCallback } from "react";
import {
  NFTGrid,
  NFTStats,
  NFTCard,
  NFTInfoPanel,
  NFTEvolutionPanel,
  HelpTooltip,
  TransactionConfirmModal,
  PendingTransactions,
  getEvolutionStatus,
  SectionHeader,
  InfoBanner,
  Button,
  type BabyNFTState,
  type TransactionDetails,
} from "@bitcoinbaby/ui";
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
  const nftTransactions = pendingTransactions.filter(
    (tx) => tx.type === "nft_mint" || tx.type === "nft_purchase",
  );

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
  const feeSats = 1500; // Estimated network fee

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
      // Show reveal animation
      setMintState("revealing");

      // Wait for reveal animation
      await new Promise((r) => setTimeout(r, 2000));

      // Optimistic update: Add to collection immediately
      setOwnedNFTs([result.nft, ...ownedNFTs]);

      // Invalidate cache to trigger background refetch from blockchain
      invalidateNFTs();

      setMintState("success");
    } else {
      setMintState("info");
    }
  }, [mint, setOwnedNFTs, ownedNFTs, invalidateNFTs]);

  // Handle cancel confirmation
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
      // Invalidate cache to refetch from server with proper type conversion
      invalidateNFTs();
      // Also trigger a refresh to show the new NFT
      refreshNFTs();
    }
  }, [claimTxid, claim, invalidateNFTs, refreshNFTs]);

  const nfts = ownedNFTs;

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

      // Simulate evolution delay (in production, this would be a blockchain tx)
      await new Promise((r) => setTimeout(r, 2000));

      // Update local state optimistically
      const evolutionStatus = getEvolutionStatus(nft);
      if (evolutionStatus.canEvolve) {
        // Update the NFT with new level and reset XP
        const updatedNFTs = ownedNFTs.map((n) =>
          n.tokenId === nft.tokenId ? { ...n, level: n.level + 1, xp: 0 } : n,
        );
        setOwnedNFTs(updatedNFTs);

        // Update selected NFT if it's the one being evolved
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
        // Clear success message after 5 seconds
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
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("collection")}
            className={`font-pixel text-[9px] uppercase px-4 py-2 border-4 transition-all ${
              activeTab === "collection"
                ? "bg-pixel-primary text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]"
                : "bg-pixel-bg-medium text-pixel-text border-pixel-border hover:border-pixel-primary"
            }`}
          >
            My Collection ({nfts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab("mint");
              setMintState("info");
            }}
            className={`font-pixel text-[9px] uppercase px-4 py-2 border-4 transition-all ${
              activeTab === "mint"
                ? "bg-pixel-success text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]"
                : "bg-pixel-bg-medium text-pixel-text border-pixel-border hover:border-pixel-success"
            }`}
          >
            Mint New
          </button>
          <button
            onClick={() => {
              setActiveTab("claim");
              resetClaim();
            }}
            className={`font-pixel text-[9px] uppercase px-4 py-2 border-4 transition-all ${
              activeTab === "claim"
                ? "bg-pixel-secondary text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]"
                : "bg-pixel-bg-medium text-pixel-text border-pixel-border hover:border-pixel-secondary"
            }`}
          >
            Claim NFT
          </button>
          <button
            onClick={() => setActiveTab("marketplace")}
            className={`font-pixel text-[9px] uppercase px-4 py-2 border-4 transition-all ${
              activeTab === "marketplace"
                ? "bg-pixel-warning text-pixel-text-dark border-black shadow-[4px_4px_0_0_#000]"
                : "bg-pixel-bg-medium text-pixel-text border-pixel-border hover:border-pixel-warning"
            }`}
          >
            Marketplace ({listings.length})
          </button>
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
        {activeTab === "collection" ? (
          /* Collection View */
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Stats Panel (Sidebar) */}
            <div className="lg:col-span-1 order-2 lg:order-1">
              {/* Selected NFT Evolution Panel */}
              {selectedNFT && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-pixel text-[9px] text-pixel-primary uppercase">
                      Selected: #{selectedNFT.tokenId}
                    </h3>
                    <button
                      onClick={() => setSelectedNFT(null)}
                      className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-error transition-colors"
                    >
                      x Close
                    </button>
                  </div>
                  <NFTEvolutionPanel
                    nft={selectedNFT}
                    evolutionStatus={getEvolutionStatus(selectedNFT)}
                    tokenBalance={virtualBalance}
                    onEvolve={handleEvolve}
                    isEvolving={evolvingIds.has(selectedNFT.tokenId)}
                  />
                </div>
              )}

              <NFTStats
                nfts={nfts}
                isLoading={isLoading}
                showRarityBreakdown={true}
                className={selectedNFT ? "" : "sticky top-4"}
              />

              {/* Pending Transactions */}
              {nftTransactions.length > 0 && (
                <PendingTransactions
                  transactions={nftTransactions}
                  onRefresh={refreshTransactions}
                  onClearCompleted={clearCompletedTransactions}
                  className="mt-6"
                />
              )}

              {/* Mint CTA in sidebar */}
              <div className="mt-6 bg-pixel-bg-medium border-4 border-pixel-border p-4">
                <h3 className="font-pixel text-[8px] text-pixel-secondary uppercase mb-3">
                  Expand Collection
                </h3>
                <Button
                  onClick={() => {
                    setActiveTab("mint");
                    setMintState("info");
                  }}
                  variant="success"
                  size="sm"
                  className="w-full"
                >
                  Mint New Baby
                </Button>
                <p className="mt-2 font-pixel text-[7px] text-pixel-text-muted text-center">
                  {formattedPrice}
                </p>
              </div>
            </div>

            {/* NFT Grid (Main Content) */}
            <div className="lg:col-span-3 order-1 lg:order-2">
              {nfts.length === 0 && !isLoading ? (
                <div className="bg-pixel-bg-medium border-4 border-pixel-border p-8 text-center">
                  <div className="text-6xl mb-4">👶</div>
                  <h3 className="font-pixel text-sm text-pixel-text mb-2">
                    No Genesis Babies Yet
                  </h3>
                  <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                    Mint your first Genesis Baby to start earning mining boosts!
                  </p>
                  <Button
                    onClick={() => {
                      setActiveTab("mint");
                      setMintState("info");
                    }}
                    variant="success"
                  >
                    Mint Your First Baby
                  </Button>
                </div>
              ) : (
                <NFTGrid
                  nfts={nfts}
                  columns={3}
                  onEvolve={handleEvolve}
                  onSelect={handleSelectNFT}
                  onList={handleListNFT}
                  selectedTokenId={selectedNFT?.tokenId}
                  evolvingIds={evolvingIds}
                  listingIds={listingIds}
                  isLoading={isLoading}
                  skeletonCount={6}
                  showControls={true}
                />
              )}
            </div>
          </div>
        ) : (
          /* Mint View */
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

            {/* Mint States */}
            {mintState === "info" && (
              <>
                {/* Price Banner */}
                <div className="bg-pixel-bg-medium border-4 border-pixel-success p-4 mb-6 text-center shadow-[4px_4px_0_0_#000]">
                  <p className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-1">
                    Mint Price
                  </p>
                  <p className="font-pixel text-2xl text-pixel-success">
                    {formattedPrice}
                  </p>
                  <p className="font-pixel text-[7px] text-pixel-text-muted mt-1">
                    Random traits - it&apos;s a surprise!
                  </p>
                </div>

                {/* Info Panel */}
                <NFTInfoPanel className="mb-6" />

                {/* Mint Button */}
                <div className="text-center">
                  <Button
                    onClick={handleMintClick}
                    disabled={!canMint}
                    variant="success"
                    size="lg"
                    className="px-8"
                  >
                    💰 Mint Genesis Baby
                  </Button>
                  <p className="mt-3 font-pixel text-[7px] text-pixel-text-muted">
                    {isWalletConnected
                      ? "Will open wallet to sign transaction"
                      : "Connect wallet first"}
                  </p>
                </div>
              </>
            )}

            {mintState === "minting" && (
              <div className="bg-pixel-bg-medium border-4 border-pixel-border p-8 text-center">
                <div className="text-6xl animate-bounce mb-4">⛏️</div>
                <p className="font-pixel text-sm text-pixel-primary animate-pulse mb-2">
                  MINTING...
                </p>
                <p className="font-pixel-body text-sm text-pixel-text-muted">
                  Please confirm in your wallet...
                </p>
              </div>
            )}

            {mintState === "revealing" && (
              <div className="bg-pixel-bg-medium border-4 border-pixel-primary p-8 text-center">
                <div className="relative">
                  {/* Egg animation */}
                  <div className="text-8xl animate-pulse mb-4">🥚</div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 border-4 border-pixel-primary rounded-full animate-ping opacity-50" />
                  </div>
                </div>
                <p className="font-pixel text-sm text-pixel-primary animate-pulse">
                  HATCHING...
                </p>
                <p className="font-pixel text-[8px] text-pixel-text-muted mt-2">
                  Your Genesis Baby is being born!
                </p>

                {/* Transaction Status */}
                {txid && (
                  <div className="mt-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border rounded">
                    <p className="font-pixel text-[7px] text-pixel-secondary mb-1">
                      📡 Transaction submitted
                    </p>
                    <a
                      href={`https://mempool.space/testnet4/tx/${txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-pixel-body text-[9px] text-pixel-primary hover:text-pixel-secondary break-all underline"
                    >
                      {txid.slice(0, 16)}...{txid.slice(-8)}
                    </a>
                    <p className="font-pixel text-[6px] text-pixel-text-muted mt-2">
                      Waiting for confirmation... This may take a few minutes.
                    </p>
                  </div>
                )}
              </div>
            )}

            {mintState === "success" && lastMinted && (
              <div className="bg-pixel-bg-medium border-4 border-pixel-success p-6 shadow-[8px_8px_0_0_#000]">
                <div className="text-center mb-4">
                  <p className="font-pixel text-sm text-pixel-success uppercase mb-2">
                    🎉 Congratulations! 🎉
                  </p>
                  <p className="font-pixel text-[8px] text-pixel-text-muted">
                    You got a new Genesis Baby!
                  </p>
                </div>

                {/* NFT Card */}
                <div className="mb-4">
                  <NFTCard nft={lastMinted} showTokenId />
                </div>

                {/* Traits Display */}
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Rarity
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastMinted.rarityTier}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Bloodline
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastMinted.bloodline}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Type
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastMinted.baseType}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Mining Boost
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-success">
                      +{lastMinted.level * 10}%
                    </p>
                  </div>
                </div>

                {/* Transaction ID */}
                {txid && (
                  <div className="mb-4 p-2 bg-pixel-bg-dark border-2 border-pixel-border">
                    <p className="font-pixel text-[6px] text-pixel-text-muted uppercase mb-1">
                      Transaction
                    </p>
                    <p className="font-pixel-body text-[10px] text-pixel-text break-all">
                      {txid}
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleViewCollection}
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                  >
                    View Collection
                  </Button>
                  <Button
                    onClick={handleMintAnother}
                    variant="success"
                    size="sm"
                    className="flex-1"
                  >
                    Mint Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Claim View */}
        {activeTab === "claim" && (
          <div className="max-w-2xl mx-auto">
            {/* Connection Required */}
            {!isWalletConnected && (
              <div className="mb-6 p-4 bg-pixel-bg-medium border-4 border-pixel-warning text-center">
                <p className="font-pixel text-[9px] text-pixel-warning uppercase mb-2">
                  Wallet Required
                </p>
                <p className="font-pixel-body text-sm text-pixel-text-muted mb-3">
                  Connect your wallet to claim NFTs
                </p>
                <p className="font-pixel text-[8px] text-pixel-primary">
                  Go to Wallet tab to connect
                </p>
              </div>
            )}

            {/* Claim Instructions */}
            <div className="bg-pixel-bg-medium border-4 border-pixel-secondary p-4 mb-6 shadow-[4px_4px_0_0_#000]">
              <h3 className="font-pixel text-[10px] text-pixel-secondary uppercase mb-3">
                Claim Existing NFT
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted mb-3">
                If you minted an NFT before our indexing system was live, you
                can claim it here by entering the transaction ID.
              </p>
              <ul className="font-pixel text-[7px] text-pixel-text-muted space-y-1">
                <li>• The transaction must be confirmed on the blockchain</li>
                <li>• Transaction must contain a valid CHARM/NFT mint</li>
                <li>• Your wallet address must have received an output</li>
              </ul>
            </div>

            {/* Error Display */}
            {claimError && (
              <InfoBanner variant="error" className="mb-4">
                <span className="font-pixel text-[8px] uppercase">
                  {claimError}
                </span>
              </InfoBanner>
            )}

            {/* Claim Form */}
            {!lastClaimed ? (
              <div className="bg-pixel-bg-medium border-4 border-pixel-border p-6">
                <label className="block font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
                  Transaction ID (txid)
                </label>
                <input
                  type="text"
                  value={claimTxid}
                  onChange={(e) => setClaimTxid(e.target.value)}
                  placeholder="Enter txid or mempool.space URL..."
                  className="w-full font-pixel-body text-sm bg-pixel-bg-dark text-pixel-text border-4 border-pixel-border p-3 mb-4 focus:border-pixel-secondary outline-none"
                  disabled={isClaiming}
                />

                <p className="font-pixel text-[6px] text-pixel-text-muted mb-4">
                  Example:
                  37b13fdc8dcd85b2892500c213cf2d7c7e4af8fed75903a7f2606b062b78d4b4
                  <br />
                  Or paste: https://mempool.space/testnet4/tx/37b13f...
                </p>

                <Button
                  onClick={handleClaimNFT}
                  disabled={
                    !isWalletConnected || isClaiming || !claimTxid.trim()
                  }
                  variant="secondary"
                  className="w-full"
                >
                  {isClaiming ? "Claiming..." : "Claim NFT"}
                </Button>
              </div>
            ) : (
              /* Claim Success */
              <div className="bg-pixel-bg-medium border-4 border-pixel-success p-6 shadow-[8px_8px_0_0_#000]">
                <div className="text-center mb-4">
                  <p className="font-pixel text-sm text-pixel-success uppercase mb-2">
                    NFT Claimed Successfully!
                  </p>
                  <p className="font-pixel text-[8px] text-pixel-text-muted">
                    Genesis Baby #{lastClaimed.tokenId} is now in your
                    collection
                  </p>
                </div>

                {/* Traits Display */}
                <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Token ID
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-primary">
                      #{lastClaimed.tokenId}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Rarity
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastClaimed.rarityTier}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Bloodline
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastClaimed.bloodline}
                    </p>
                  </div>
                  <div>
                    <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                      Type
                    </span>
                    <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                      {lastClaimed.baseType}
                    </p>
                  </div>
                </div>

                {/* Transaction Link */}
                <div className="mb-4 p-2 bg-pixel-bg-dark border-2 border-pixel-border">
                  <p className="font-pixel text-[6px] text-pixel-text-muted uppercase mb-1">
                    Transaction
                  </p>
                  <a
                    href={`https://mempool.space/testnet4/tx/${lastClaimed.txid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-pixel-body text-[10px] text-pixel-primary hover:text-pixel-secondary break-all underline"
                  >
                    {lastClaimed.txid}
                  </a>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleViewCollection}
                    variant="success"
                    size="sm"
                    className="flex-1"
                  >
                    View Collection
                  </Button>
                  <Button
                    onClick={() => {
                      resetClaim();
                      setClaimTxid("");
                    }}
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                  >
                    Claim Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Marketplace View */}
        {activeTab === "marketplace" && (
          <div className="max-w-4xl mx-auto">
            {/* Marketplace Header */}
            <div className="bg-pixel-bg-medium border-4 border-pixel-warning p-4 mb-6 shadow-[4px_4px_0_0_#000]">
              <h3 className="font-pixel text-[10px] text-pixel-warning uppercase mb-2">
                NFT Marketplace
              </h3>
              <p className="font-pixel-body text-sm text-pixel-text-muted">
                Buy and sell Genesis Babies with other players. All transactions
                are recorded on-chain.
              </p>
            </div>

            {/* Error Display */}
            {marketplaceError && (
              <InfoBanner variant="error" className="mb-4">
                <span className="font-pixel text-[8px] uppercase">
                  {marketplaceError}
                </span>
              </InfoBanner>
            )}

            {/* Listings */}
            {isLoadingListings ? (
              <div className="text-center py-12">
                <div className="text-4xl animate-bounce mb-4">🛒</div>
                <p className="font-pixel text-[9px] text-pixel-text-muted animate-pulse">
                  Loading marketplace...
                </p>
              </div>
            ) : listings.length === 0 ? (
              <div className="bg-pixel-bg-medium border-4 border-pixel-border p-8 text-center">
                <div className="text-6xl mb-4">🏪</div>
                <h3 className="font-pixel text-sm text-pixel-text mb-2">
                  No Listings Yet
                </h3>
                <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
                  Be the first to list your Genesis Baby for sale!
                </p>
                <Button
                  onClick={() => setActiveTab("collection")}
                  variant="warning"
                >
                  Go to Collection
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {listings.map((listing) => (
                  <div
                    key={listing.tokenId}
                    className="bg-pixel-bg-medium border-4 border-pixel-border p-4 shadow-[4px_4px_0_0_#000]"
                  >
                    {/* NFT Info */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-pixel text-[9px] text-pixel-text">
                        #{listing.tokenId.toString().padStart(4, "0")}
                      </span>
                      <span className="font-pixel text-[7px] text-pixel-text-muted uppercase px-2 py-1 bg-pixel-bg-dark border border-pixel-border">
                        {listing.nft.rarityTier}
                      </span>
                    </div>

                    {/* Traits */}
                    <div className="mb-3 space-y-1">
                      <p className="font-pixel text-[7px] text-pixel-text-muted">
                        Type:{" "}
                        <span className="text-pixel-secondary capitalize">
                          {listing.nft.baseType}
                        </span>
                      </p>
                      <p className="font-pixel text-[7px] text-pixel-text-muted">
                        Bloodline:{" "}
                        <span className="text-pixel-secondary capitalize">
                          {listing.nft.bloodline}
                        </span>
                      </p>
                      <p className="font-pixel text-[7px] text-pixel-text-muted">
                        Level:{" "}
                        <span className="text-pixel-secondary">
                          {listing.nft.level}
                        </span>
                      </p>
                    </div>

                    {/* Price */}
                    <div className="mb-3 p-2 bg-pixel-bg-dark border-2 border-pixel-warning/30 text-center">
                      <p className="font-pixel text-[7px] text-pixel-text-muted uppercase">
                        Price
                      </p>
                      <p className="font-pixel text-sm text-pixel-warning">
                        {(listing.price / 100_000_000).toFixed(8)} BTC
                      </p>
                      <p className="font-pixel text-[6px] text-pixel-text-muted">
                        ({listing.price.toLocaleString()} sats)
                      </p>
                    </div>

                    {/* Seller */}
                    <p className="font-pixel text-[6px] text-pixel-text-muted mb-3 truncate">
                      Seller: {listing.sellerAddress.slice(0, 12)}...
                    </p>

                    {/* Buy Button */}
                    <Button
                      onClick={() => buyNFT(listing.tokenId)}
                      disabled={
                        !isWalletConnected ||
                        isProcessingMarketplace ||
                        listing.sellerAddress === wallet?.address
                      }
                      variant="success"
                      size="sm"
                      className="w-full"
                    >
                      {listing.sellerAddress === wallet?.address
                        ? "Your Listing"
                        : isProcessingMarketplace
                          ? "Processing..."
                          : "Buy Now"}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Info */}
            <div className="mt-6 p-4 bg-pixel-bg-dark border-2 border-pixel-border">
              <p className="font-pixel text-[7px] text-pixel-text-muted">
                Note: To list your NFT for sale, go to your Collection and
                select an NFT. Listing feature coming soon!
              </p>
            </div>
          </div>
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
