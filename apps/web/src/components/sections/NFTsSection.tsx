"use client";

/**
 * NFTsSection - Genesis Sparks Collection & Mint
 *
 * NFT management with sub-tabs: Collection | Mint New | Claim | Marketplace
 * Uses consolidated useNFTs hook for all NFT-related state management.
 */

import {
  HelpTooltip,
  TransactionConfirmModal,
  SectionHeader,
  InfoBanner,
  pixelBorders,
} from "@bitcoinbaby/ui";
import {
  NFTClaimFlow,
  NFTCollectionView,
  NFTExplorerView,
  NFTMarketplaceView,
} from "@/components/features/nft";
import { SyncStatus, NFTTabNav, MintTabContent, useNFTsSection } from "./nfts";

export function NFTsSection() {
  const {
    // State
    activeTab,
    setActiveTab,
    mintState,
    evolvingIds,
    listingIds,
    claimTxid,
    setClaimTxid,
    selectedNFT,
    setSelectedNFT,
    listFeedback,
    setListFeedback,
    // Data
    collection,
    minting,
    claiming,
    marketplace,
    explorer,
    balances,
    pendingTransactions,
    refreshTransactions,
    clearCompletedTransactions,
    mintAttempts,
    walletAddress,
    // Handlers
    handleMintClick,
    handleConfirmedMint,
    handleCancelMint,
    handleMintAnother,
    handleViewCollection,
    handleClaimNFT,
    handleSelectNFT,
    handleEvolve,
    handleListNFT,
    handleMintTabClick,
  } = useNFTsSection();

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
              content="Genesis Sparks are NFTs that boost your mining rewards. Each NFT has unique traits and rarity levels."
              title="NFT Collection"
              description="Higher rarity = Higher mining boost. Level up your NFTs by burning $BABY tokens."
              size="md"
            />
          }
          action={
            <SyncStatus
              isFetching={collection.isFetching}
              error={collection.error}
              lastSynced={collection.lastSynced}
              onRefresh={collection.refresh}
            />
          }
          className="mb-6"
        />

        {/* Tab Navigation */}
        <NFTTabNav
          activeTab={activeTab}
          explorerCount={explorer.total}
          collectionCount={collection.nfts.length}
          onTabChange={setActiveTab}
          onMintTabClick={handleMintTabClick}
        />

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
        {activeTab === "explorer" && (
          <NFTExplorerView
            nfts={explorer.nfts}
            total={explorer.total}
            page={explorer.page}
            totalPages={explorer.totalPages}
            isLoading={explorer.isLoading}
            error={explorer.error}
            filters={explorer.filters}
            stats={explorer.stats}
            currentUserAddress={walletAddress}
            isProcessing={marketplace.isProcessing}
            onFiltersChange={explorer.setFilters}
            onPageChange={explorer.setPage}
            onBuy={marketplace.buyNFT}
          />
        )}

        {activeTab === "collection" && (
          <NFTCollectionView
            nfts={collection.nfts}
            isLoading={collection.isLoading}
            error={collection.error}
            selectedNFT={selectedNFT}
            onSelectNFT={handleSelectNFT}
            onClearSelection={() => setSelectedNFT(null)}
            evolvingIds={evolvingIds}
            listingIds={listingIds}
            tokenBalance={balances.virtualBABY}
            onEvolve={handleEvolve}
            onList={handleListNFT}
            onMintClick={handleMintTabClick}
            onRetry={collection.refresh}
            formattedPrice={minting.price.formatted}
            pendingTransactions={pendingTransactions}
            onRefreshTransactions={refreshTransactions}
            onClearCompletedTransactions={clearCompletedTransactions}
          />
        )}

        {activeTab === "marketplace" && (
          <NFTMarketplaceView
            listings={marketplace.listings}
            isLoading={marketplace.isLoading}
            error={marketplace.error}
            currentUserAddress={walletAddress}
            isProcessing={marketplace.isProcessing}
            onBuy={marketplace.buyNFT}
            onUnlist={marketplace.unlistNFT}
            onGoToCollection={() => setActiveTab("collection")}
          />
        )}

        {activeTab === "mint" && (
          <div className="flex flex-col gap-6">
            <MintTabContent
              mintState={mintState}
              currentStep={minting.currentStep}
              isWalletConnected={minting.isWalletConnected}
              formattedPrice={minting.price.formatted}
              canMint={minting.canMint}
              error={minting.error}
              lastMinted={minting.lastMinted}
              txid={minting.txid}
              commitTxid={minting.commitTxid}
              pendingTransactions={pendingTransactions}
              mintAttempts={mintAttempts.attempts}
              pendingMintAttempts={mintAttempts.pendingAttempts}
              failedMintAttempts={mintAttempts.failedAttempts}
              isLoadingAttempts={mintAttempts.isLoading}
              hasPendingAttempts={mintAttempts.hasPending}
              onRefreshAttempts={mintAttempts.refresh}
              onClearFailedAttempts={mintAttempts.clearFailed}
              onMintClick={handleMintClick}
              onMintAnother={handleMintAnother}
              onViewCollection={handleViewCollection}
              onRefreshTransactions={refreshTransactions}
              onClearCompletedTransactions={clearCompletedTransactions}
            />

            {/* Collapsible Manual Claim Accordion */}
            <details className="group">
              <summary
                className={`font-pixel text-pixel-2xs bg-pixel-bg-medium ${pixelBorders.medium} p-4 text-pixel-text-muted hover:text-pixel-primary flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden outline-none select-none`}
              >
                <span>MANUAL CLAIM WORKFLOW</span>
                <span className="transform group-open:rotate-180 transition-transform duration-200">
                  ▼
                </span>
              </summary>
              <div className="mt-4">
                <NFTClaimFlow
                  isWalletConnected={minting.isWalletConnected}
                  claimTxid={claimTxid}
                  onClaimTxidChange={setClaimTxid}
                  isClaiming={claiming.isLoading}
                  claimError={claiming.error}
                  lastClaimed={claiming.lastClaimed}
                  onClaim={handleClaimNFT}
                  onClaimAnother={() => {
                    claiming.reset();
                    setClaimTxid("");
                  }}
                  onViewCollection={handleViewCollection}
                />
              </div>
            </details>
          </div>
        )}

        {/* Transaction Confirmation Modal */}
        <TransactionConfirmModal
          isOpen={mintState === "confirming"}
          transaction={minting.transactionDetails}
          isLoading={minting.isLoading}
          onConfirm={handleConfirmedMint}
          onCancel={handleCancelMint}
        />
      </div>
    </div>
  );
}

export default NFTsSection;
