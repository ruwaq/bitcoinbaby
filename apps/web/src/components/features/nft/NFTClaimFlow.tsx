"use client";

/**
 * NFTClaimFlow - Claim existing NFT by transaction ID
 *
 * For claiming legacy NFTs minted before indexing system.
 */

import {
  InfoBanner,
  Button,
  pixelShadows,
  pixelBorders,
} from "@bitcoinbaby/ui";
import type { NFTRecord } from "@bitcoinbaby/core";

interface NFTClaimFlowProps {
  isWalletConnected: boolean;
  claimTxid: string;
  onClaimTxidChange: (value: string) => void;
  isClaiming: boolean;
  claimError: string | null;
  lastClaimed: NFTRecord | null;
  onClaim: () => void;
  onClaimAnother: () => void;
  onViewCollection: () => void;
}

export function NFTClaimFlow({
  isWalletConnected,
  claimTxid,
  onClaimTxidChange,
  isClaiming,
  claimError,
  lastClaimed,
  onClaim,
  onClaimAnother,
  onViewCollection,
}: NFTClaimFlowProps) {
  return (
    <div className="max-w-2xl mx-auto">
      {/* Connection Required */}
      {!isWalletConnected && (
        <div
          className={`mb-6 p-4 bg-pixel-bg-medium ${pixelBorders.warning} text-center`}
        >
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
      <div
        className={`bg-pixel-bg-medium border-4 border-pixel-secondary p-4 mb-6 ${pixelShadows.md}`}
      >
        <h3 className="font-pixel text-[10px] text-pixel-secondary uppercase mb-3">
          Claim Existing NFT
        </h3>
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-3">
          If you minted an NFT before our indexing system was live, you can
          claim it here by entering the transaction ID.
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
          <span className="font-pixel text-[8px] uppercase">{claimError}</span>
        </InfoBanner>
      )}

      {/* Claim Form */}
      {!lastClaimed ? (
        <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-6`}>
          <label className="block font-pixel text-[8px] text-pixel-text-muted uppercase mb-2">
            Transaction ID (txid)
          </label>
          <input
            type="text"
            value={claimTxid}
            onChange={(e) => onClaimTxidChange(e.target.value)}
            placeholder="Enter txid or mempool.space URL..."
            className={`w-full font-pixel-body text-sm bg-pixel-bg-dark text-pixel-text ${pixelBorders.medium} p-3 mb-4 focus:border-pixel-secondary outline-none`}
            disabled={isClaiming}
          />

          <p className="font-pixel text-[6px] text-pixel-text-muted mb-4">
            Example:
            37b13fdc8dcd85b2892500c213cf2d7c7e4af8fed75903a7f2606b062b78d4b4
            <br />
            Or paste: https://mempool.space/testnet4/tx/37b13f...
          </p>

          <Button
            onClick={onClaim}
            disabled={!isWalletConnected || isClaiming || !claimTxid.trim()}
            variant="secondary"
            className="w-full"
          >
            {isClaiming ? "Claiming..." : "Claim NFT"}
          </Button>
        </div>
      ) : (
        /* Claim Success */
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.success} p-6 ${pixelShadows.lg}`}
        >
          <div className="text-center mb-4">
            <p className="font-pixel text-sm text-pixel-success uppercase mb-2">
              NFT Claimed Successfully!
            </p>
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              Genesis Baby #{lastClaimed.tokenId} is now in your collection
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
              onClick={onViewCollection}
              variant="success"
              size="sm"
              className="flex-1"
            >
              View Collection
            </Button>
            <Button
              onClick={onClaimAnother}
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
  );
}

export default NFTClaimFlow;
