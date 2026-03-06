"use client";

/**
 * NFTMintFlow - Mint NFT flow states with prover integration
 *
 * Handles all mint states:
 * - info: Show price and info
 * - proving: Generating ZK proof
 * - signing: Signing transactions
 * - broadcasting: Broadcasting to network
 * - revealing: Hatching animation
 * - success: Show minted NFT
 */

import {
  NFTInfoPanel,
  NFTCard,
  Button,
  pixelShadows,
  pixelBorders,
  type BabyNFTState,
} from "@bitcoinbaby/ui";

// Step definitions for progress display
const MINT_STEPS = {
  idle: { label: "", icon: "" },
  reserving: { label: "Reserving Token ID", icon: "🎟️" },
  generating_traits: { label: "Generating Traits", icon: "🧬" },
  proving: { label: "Generating ZK Proof", icon: "🔐" },
  signing_commit: { label: "Sign Commit TX", icon: "✍️" },
  signing_spell: { label: "Sign Spell TX", icon: "✍️" },
  broadcasting_commit: { label: "Broadcasting Commit", icon: "📡" },
  broadcasting_spell: { label: "Broadcasting Spell", icon: "📡" },
  confirming: { label: "Confirming", icon: "✅" },
  success: { label: "Complete!", icon: "🎉" },
  error: { label: "Error", icon: "❌" },
} as const;

export type MintStep = keyof typeof MINT_STEPS;

interface NFTMintFlowProps {
  state: "info" | "minting" | "revealing" | "success";
  currentStep?: MintStep;
  formattedPrice: string;
  canMint: boolean;
  isWalletConnected: boolean;
  lastMinted: BabyNFTState | null;
  txid: string | null;
  commitTxid?: string | null;
  onMintClick: () => void;
  onMintAnother: () => void;
  onViewCollection: () => void;
}

export function NFTMintFlow({
  state,
  currentStep = "idle",
  formattedPrice,
  canMint,
  isWalletConnected,
  lastMinted,
  txid,
  commitTxid,
  onMintClick,
  onMintAnother,
  onViewCollection,
}: NFTMintFlowProps) {
  if (state === "info") {
    return (
      <>
        {/* Price Banner */}
        <div
          className={`bg-pixel-bg-medium ${pixelBorders.success} p-4 mb-6 text-center ${pixelShadows.md}`}
        >
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
    const stepInfo = MINT_STEPS[currentStep] || MINT_STEPS.idle;
    const isProving = currentStep === "proving";
    const isSigning =
      currentStep === "signing_commit" || currentStep === "signing_spell";
    const isBroadcasting =
      currentStep === "broadcasting_commit" ||
      currentStep === "broadcasting_spell";

    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.medium} p-8 text-center`}
      >
        {/* Step Icon */}
        <div className="text-6xl animate-bounce mb-4">
          {stepInfo.icon || "⛏️"}
        </div>

        {/* Step Label */}
        <p className="font-pixel text-sm text-pixel-primary animate-pulse mb-2">
          {stepInfo.label || "MINTING..."}
        </p>

        {/* Step Description */}
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
          {isSigning && "Please confirm in your wallet..."}
          {isProving && "This may take 30-60 seconds..."}
          {isBroadcasting && "Submitting to Bitcoin network..."}
          {currentStep === "reserving" && "Getting your unique token ID..."}
          {currentStep === "generating_traits" &&
            "Rolling the dice for your Baby..."}
          {currentStep === "confirming" && "Almost there..."}
        </p>

        {/* Progress Steps */}
        <div className="mt-6 px-4">
          <div className="flex justify-between items-center mb-2">
            <span className="font-pixel text-[7px] text-pixel-text-muted">
              Progress
            </span>
          </div>
          <div className="grid grid-cols-9 gap-1">
            {[
              "reserving",
              "generating_traits",
              "proving",
              "signing_commit",
              "signing_spell",
              "broadcasting_commit",
              "broadcasting_spell",
              "confirming",
              "success",
            ].map((step, index) => {
              const stepKeys = Object.keys(MINT_STEPS);
              const currentIndex = stepKeys.indexOf(currentStep);
              const stepIndex = stepKeys.indexOf(step);
              const isComplete = stepIndex < currentIndex;
              const isCurrent = step === currentStep;

              return (
                <div
                  key={step}
                  className={`h-2 rounded-sm transition-all duration-300 ${
                    isComplete
                      ? "bg-pixel-success"
                      : isCurrent
                        ? "bg-pixel-primary animate-pulse"
                        : "bg-pixel-border"
                  }`}
                  title={MINT_STEPS[step as MintStep].label}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="font-pixel text-[6px] text-pixel-text-muted">
              Start
            </span>
            <span className="font-pixel text-[6px] text-pixel-text-muted">
              Complete
            </span>
          </div>
        </div>

        {/* Prover Note */}
        {isProving && (
          <div className="mt-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border rounded">
            <p className="font-pixel text-[7px] text-pixel-secondary mb-1">
              ZK Proof Generation
            </p>
            <p className="font-pixel-body text-[8px] text-pixel-text-muted">
              The Charms prover is generating a zero-knowledge proof for your
              NFT. This proves your NFT is valid without revealing the contract
              details.
            </p>
          </div>
        )}
      </div>
    );
  }

  if (state === "revealing") {
    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.accent} p-8 text-center`}
      >
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
        <div className="mt-4 space-y-2">
          {commitTxid && (
            <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border rounded">
              <p className="font-pixel text-[6px] text-pixel-secondary mb-1">
                Commit TX
              </p>
              <a
                href={`https://mempool.space/testnet4/tx/${commitTxid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel-body text-[8px] text-pixel-primary hover:text-pixel-secondary break-all underline"
              >
                {commitTxid.slice(0, 12)}...{commitTxid.slice(-8)}
              </a>
            </div>
          )}
          {txid && (
            <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-success rounded">
              <p className="font-pixel text-[6px] text-pixel-success mb-1">
                Spell TX (NFT)
              </p>
              <a
                href={`https://mempool.space/testnet4/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel-body text-[8px] text-pixel-primary hover:text-pixel-secondary break-all underline"
              >
                {txid.slice(0, 12)}...{txid.slice(-8)}
              </a>
            </div>
          )}
        </div>

        <p className="font-pixel text-[6px] text-pixel-text-muted mt-4">
          Waiting for confirmation... This may take a few minutes.
        </p>
      </div>
    );
  }

  if (state === "success" && lastMinted) {
    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.success} p-6 ${pixelShadows.lg}`}
      >
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

        {/* Transaction IDs */}
        <div className="mb-4 space-y-2">
          {commitTxid && (
            <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-border">
              <p className="font-pixel text-[6px] text-pixel-text-muted uppercase mb-1">
                Commit TX
              </p>
              <a
                href={`https://mempool.space/testnet4/tx/${commitTxid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel-body text-[9px] text-pixel-primary hover:text-pixel-secondary break-all underline"
              >
                {commitTxid}
              </a>
            </div>
          )}
          {txid && (
            <div className="p-2 bg-pixel-bg-dark border-2 border-pixel-success">
              <p className="font-pixel text-[6px] text-pixel-success uppercase mb-1">
                Spell TX (NFT Location)
              </p>
              <a
                href={`https://mempool.space/testnet4/tx/${txid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel-body text-[9px] text-pixel-primary hover:text-pixel-secondary break-all underline"
              >
                {txid}
              </a>
            </div>
          )}
        </div>

        {/* Charms Verification Note */}
        <div className="mb-4 p-2 bg-pixel-bg-dark border-2 border-pixel-accent rounded">
          <p className="font-pixel text-[6px] text-pixel-accent mb-1">
            Charms NFT
          </p>
          <p className="font-pixel-body text-[8px] text-pixel-text-muted">
            This is a real Charms NFT on Bitcoin Testnet4. It will appear in the
            Scrolls indexer once confirmed.
          </p>
        </div>

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
