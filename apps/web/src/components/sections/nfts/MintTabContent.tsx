"use client";

import { PendingTransactions } from "@bitcoinbaby/ui";
import {
  NFTMintFlow,
  MintAttemptsPanel,
  type MintStep,
} from "@/components/features/nft";
import type { PendingTransaction, MintAttempt } from "@bitcoinbaby/core";
import type { BabyNFTState } from "@bitcoinbaby/bitcoin";

type MintState = "info" | "confirming" | "minting" | "revealing" | "success";

interface MintTabContentProps {
  mintState: MintState;
  currentStep?: MintStep;
  isWalletConnected: boolean;
  formattedPrice: string;
  canMint: boolean;
  error: string | null;
  lastMinted: BabyNFTState | null;
  txid: string | null;
  commitTxid?: string | null;
  pendingTransactions: PendingTransaction[];
  // Mint attempt tracking
  mintAttempts?: MintAttempt[];
  pendingMintAttempts?: MintAttempt[];
  failedMintAttempts?: MintAttempt[];
  isLoadingAttempts?: boolean;
  hasPendingAttempts?: boolean;
  onRefreshAttempts?: () => void;
  // Actions
  onMintClick: () => void;
  onMintAnother: () => void;
  onViewCollection: () => void;
  onRefreshTransactions: () => void;
  onClearCompletedTransactions: () => void;
}

export function MintTabContent({
  mintState,
  currentStep,
  isWalletConnected,
  formattedPrice,
  canMint,
  error,
  lastMinted,
  txid,
  commitTxid,
  pendingTransactions,
  mintAttempts = [],
  pendingMintAttempts = [],
  failedMintAttempts = [],
  isLoadingAttempts = false,
  hasPendingAttempts = false,
  onRefreshAttempts,
  onMintClick,
  onMintAnother,
  onViewCollection,
  onRefreshTransactions,
  onClearCompletedTransactions,
}: MintTabContentProps) {
  const nftPendingTxs = pendingTransactions.filter(
    (tx) =>
      tx.status === "pending" ||
      tx.status === "mempool" ||
      tx.status === "confirming",
  );

  return (
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

      {/* Mint Attempts Panel - Shows pending/failed mints */}
      {mintAttempts.length > 0 && onRefreshAttempts && (
        <MintAttemptsPanel
          attempts={mintAttempts}
          pendingAttempts={pendingMintAttempts}
          failedAttempts={failedMintAttempts}
          isLoading={isLoadingAttempts}
          onRefresh={onRefreshAttempts}
          hasPending={hasPendingAttempts}
        />
      )}

      {/* Pending Transactions Banner */}
      {nftPendingTxs.length > 0 && (
        <PendingTransactions
          transactions={pendingTransactions}
          onRefresh={onRefreshTransactions}
          onClearCompleted={onClearCompletedTransactions}
          className="mb-6"
        />
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-3 bg-pixel-error/20 border-4 border-pixel-error">
          <p className="font-pixel text-[8px] text-pixel-error uppercase">
            {error}
          </p>
        </div>
      )}

      <NFTMintFlow
        state={mintState === "confirming" ? "info" : mintState}
        currentStep={currentStep}
        formattedPrice={formattedPrice}
        canMint={canMint}
        isWalletConnected={isWalletConnected}
        lastMinted={lastMinted}
        txid={txid}
        commitTxid={commitTxid}
        onMintClick={onMintClick}
        onMintAnother={onMintAnother}
        onViewCollection={onViewCollection}
      />
    </div>
  );
}
