"use client";

/**
 * NFTMintFlow - Mint NFT flow states
 *
 * Handles all mint states:
 * - info: Show price and info
 * - minting: In progress
 * - revealing: Hatching animation
 * - success: Show minted NFT
 */

import {
  NFTInfoPanel,
  NFTCard,
  Button,
  type BabyNFTState,
} from "@bitcoinbaby/ui";

interface NFTMintFlowProps {
  state: "info" | "minting" | "revealing" | "success";
  formattedPrice: string;
  canMint: boolean;
  isWalletConnected: boolean;
  lastMinted: BabyNFTState | null;
  txid: string | null;
  onMintClick: () => void;
  onMintAnother: () => void;
  onViewCollection: () => void;
}

export function NFTMintFlow({
  state,
  formattedPrice,
  canMint,
  isWalletConnected,
  lastMinted,
  txid,
  onMintClick,
  onMintAnother,
  onViewCollection,
}: NFTMintFlowProps) {
  if (state === "info") {
    return (
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
            onClick={onMintClick}
            disabled={!canMint}
            variant="success"
            size="lg"
            className="px-8"
          >
            Mint Genesis Baby
          </Button>
          <p className="mt-3 font-pixel text-[7px] text-pixel-text-muted">
            {isWalletConnected
              ? "Will open wallet to sign transaction"
              : "Connect wallet first"}
          </p>
        </div>
      </>
    );
  }

  if (state === "minting") {
    return (
      <div className="bg-pixel-bg-medium border-4 border-pixel-border p-8 text-center">
        <div className="text-6xl animate-bounce mb-4">⛏️</div>
        <p className="font-pixel text-sm text-pixel-primary animate-pulse mb-2">
          MINTING...
        </p>
        <p className="font-pixel-body text-sm text-pixel-text-muted">
          Please confirm in your wallet...
        </p>
      </div>
    );
  }

  if (state === "revealing") {
    return (
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
              Transaction submitted
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
    );
  }

  if (state === "success" && lastMinted) {
    return (
      <div className="bg-pixel-bg-medium border-4 border-pixel-success p-6 shadow-[8px_8px_0_0_#000]">
        <div className="text-center mb-4">
          <p className="font-pixel text-sm text-pixel-success uppercase mb-2">
            Congratulations!
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
            onClick={onViewCollection}
            variant="ghost"
            size="sm"
            className="flex-1"
          >
            View Collection
          </Button>
          <Button
            onClick={onMintAnother}
            variant="success"
            size="sm"
            className="flex-1"
          >
            Mint Another
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

export default NFTMintFlow;
