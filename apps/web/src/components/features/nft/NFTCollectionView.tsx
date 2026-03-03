"use client";

/**
 * NFTCollectionView - Collection tab content
 *
 * Shows:
 * - NFT grid with owned NFTs
 * - Stats sidebar
 * - Selected NFT evolution panel
 * - Pending transactions
 * - Mint CTA
 */

import {
  NFTGrid,
  NFTStats,
  NFTEvolutionPanel,
  PendingTransactions,
  Button,
  getEvolutionStatus,
  type BabyNFTState,
} from "@bitcoinbaby/ui";
import type { PendingTransaction } from "@bitcoinbaby/core";

interface NFTCollectionViewProps {
  nfts: BabyNFTState[];
  isLoading: boolean;
  selectedNFT: BabyNFTState | null;
  onSelectNFT: (nft: BabyNFTState) => void;
  onClearSelection: () => void;
  evolvingIds: Set<number>;
  listingIds: Set<number>;
  tokenBalance: bigint;
  onEvolve: (nft: BabyNFTState) => Promise<void>;
  onList: (nft: BabyNFTState, price: number) => Promise<void>;
  onMintClick: () => void;
  formattedPrice: string;
  // Pending transactions
  pendingTransactions: PendingTransaction[];
  onRefreshTransactions: () => void;
  onClearCompletedTransactions: () => void;
}

export function NFTCollectionView({
  nfts,
  isLoading,
  selectedNFT,
  onSelectNFT,
  onClearSelection,
  evolvingIds,
  listingIds,
  tokenBalance,
  onEvolve,
  onList,
  onMintClick,
  formattedPrice,
  pendingTransactions,
  onRefreshTransactions,
  onClearCompletedTransactions,
}: NFTCollectionViewProps) {
  const nftTransactions = pendingTransactions.filter(
    (tx) => tx.type === "nft_mint" || tx.type === "nft_purchase",
  );

  return (
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
                onClick={onClearSelection}
                className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-error transition-colors"
              >
                x Close
              </button>
            </div>
            <NFTEvolutionPanel
              nft={selectedNFT}
              evolutionStatus={getEvolutionStatus(selectedNFT)}
              tokenBalance={tokenBalance}
              onEvolve={onEvolve}
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
            onRefresh={onRefreshTransactions}
            onClearCompleted={onClearCompletedTransactions}
            className="mt-6"
          />
        )}

        {/* Mint CTA in sidebar */}
        <div className="mt-6 bg-pixel-bg-medium border-4 border-pixel-border p-4">
          <h3 className="font-pixel text-[8px] text-pixel-secondary uppercase mb-3">
            Expand Collection
          </h3>
          <Button
            onClick={onMintClick}
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
            <Button onClick={onMintClick} variant="success">
              Mint Your First Baby
            </Button>
          </div>
        ) : (
          <NFTGrid
            nfts={nfts}
            columns={3}
            onEvolve={onEvolve}
            onSelect={onSelectNFT}
            onList={onList}
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
  );
}

export default NFTCollectionView;
