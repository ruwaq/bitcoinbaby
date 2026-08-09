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
 * - success: Show minted NFT with Motion sparkles
 */

import { motion } from "motion/react";
import {
  NFTInfoPanel,
  NFTCard,
  Button,
  pixelShadows,
  pixelBorders,
  type SparkNFTState,
} from "@bitcoinbaby/ui";
import type { MintStep } from "@/hooks/useMintNFT";

// Re-export MintStep for convenience
export type { MintStep };

const MINT_STEPS: Record<
  MintStep,
  { label: string; icon: string; description: string }
> = {
  idle: { label: "Ready", icon: "⏳", description: "Preparing to mint..." },
  checking_prover: {
    label: "Checking Prover",
    icon: "🔍",
    description: "Verifying prover is available...",
  },
  preparing: {
    label: "Preparing Mint",
    icon: "🔐",
    description:
      "Generating your ZK proof, tokenId, and traits on the server...",
  },
  signing_commit: {
    label: "Signing Commit",
    icon: "✍️",
    description: "Please sign the commit transaction...",
  },
  signing_spell: {
    label: "Signing Spell",
    icon: "🪄",
    description: "Please sign the spell transaction...",
  },
  broadcasting_commit: {
    label: "Broadcasting Commit",
    icon: "📡",
    description: "Sending commit to the network...",
  },
  broadcasting_spell: {
    label: "Broadcasting Spell",
    icon: "✨",
    description: "Sending spell to the network...",
  },
  finalizing: {
    label: "Finalizing",
    icon: "✅",
    description: "Verifying your mint on-chain and saving it...",
  },
  success: { label: "Success!", icon: "🎉", description: "Mint complete!" },
  error: { label: "Error", icon: "⚠️", description: "Mint failed" },
};

// =============================================================================
// SPARKLE CONFIG
// =============================================================================

const SPARKLES = [
  { char: "✦", x: "8%", y: "5%", delay: 0.1, size: 14 },
  { char: "✧", x: "15%", y: "12%", delay: 0.3, size: 10 },
  { char: "✦", x: "25%", y: "8%", delay: 0.15, size: 16 },
  { char: "✦", x: "88%", y: "10%", delay: 0.2, size: 12 },
  { char: "✧", x: "75%", y: "5%", delay: 0.4, size: 14 },
  { char: "✦", x: "92%", y: "15%", delay: 0.5, size: 18 },
  { char: "✦", x: "5%", y: "80%", delay: 0.25, size: 12 },
  { char: "✧", x: "20%", y: "85%", delay: 0.35, size: 11 },
  { char: "✦", x: "82%", y: "88%", delay: 0.3, size: 14 },
  { char: "✧", x: "92%", y: "92%", delay: 0.45, size: 13 },
];

const CONFETTI = ["✦", "◆", "◇", "○", "◈", "✧"];

interface NFTMintFlowProps {
  state: "info" | "minting" | "revealing" | "success" | "error";
  currentStep?: MintStep;
  formattedPrice: string;
  canMint: boolean;
  isWalletConnected: boolean;
  lastMinted: SparkNFTState | null;
  txid: string | null;
  commitTxid?: string | null;
  error?: string | null;
  suggestedAction?: string | null;
  onMintClick: () => void;
  onMintAnother: () => void;
  onViewCollection: () => void;
  onDismissError?: () => void;
  onRetry?: () => void;
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
  error,
  suggestedAction,
  onMintClick,
  onMintAnother,
  onViewCollection,
  onDismissError,
  onRetry,
}: NFTMintFlowProps) {
  if (state === "info") {
    return (
      <>
        <motion.div
          className={`bg-pixel-bg-medium ${pixelBorders.success} p-4 mb-6 text-center ${pixelShadows.md}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="font-pixel text-[8px] text-pixel-text-muted uppercase mb-1">
            Mint Price
          </p>
          <p className="font-pixel text-2xl text-pixel-success">
            {formattedPrice}
          </p>
          <p className="font-pixel text-[7px] text-pixel-text-muted mt-1">
            Random traits — it&apos;s a surprise!
          </p>
        </motion.div>

        <NFTInfoPanel className="mb-6" />

        <div className="text-center">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Button
              onClick={onMintClick}
              variant="success"
              size="lg"
              disabled={!canMint || !isWalletConnected}
            >
              {isWalletConnected
                ? "Mint Genesis Spark"
                : "Connect wallet first"}
            </Button>
          </motion.div>
          {!isWalletConnected && (
            <p className="font-pixel text-[7px] text-pixel-text-muted mt-2">
              Connect your wallet to mint
            </p>
          )}
        </div>
      </>
    );
  }

  if (state === "minting" || state === "revealing") {
    const stepInfo = MINT_STEPS[currentStep];
    const isRevealing = state === "revealing";

    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.accent} p-6 ${pixelShadows.lg}`}
      >
        {isRevealing ? (
          <div className="relative">
            <motion.div
              className="text-8xl mb-4"
              animate={{ scale: [1, 1.1, 0.95, 1] }}
              transition={{ duration: 0.8, repeat: Infinity }}
            >
              🥚
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                className="w-20 h-20 border-4 border-pixel-primary rounded-full"
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
          </div>
        ) : (
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            {stepInfo.icon || "⛏️"}
          </motion.div>
        )}

        <p className="font-pixel text-sm text-pixel-primary animate-pulse">
          {isRevealing ? "HATCHING..." : stepInfo.label}
        </p>
        <p className="font-pixel text-[8px] text-pixel-text-muted text-center mt-1">
          {stepInfo.description}
        </p>

        {!isRevealing && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-1">
              <span className="font-pixel text-[7px] text-pixel-text-muted">
                Progress
              </span>
            </div>
            <div className="grid grid-cols-9 gap-1">
              {[
                "checking_prover",
                "preparing",
                "signing_commit",
                "signing_spell",
                "broadcasting_commit",
                "broadcasting_spell",
                "finalizing",
                "success",
              ].map((step, i) => {
                const stepIdx = Object.keys(MINT_STEPS).indexOf(currentStep);
                const isDone = i < stepIdx;
                const isCurrent = i === stepIdx;
                return (
                  <div
                    key={step}
                    className={`h-2 border pixel-border ${
                      isDone
                        ? "bg-pixel-success border-pixel-success"
                        : isCurrent
                          ? "bg-pixel-primary border-pixel-primary animate-pulse"
                          : "bg-pixel-bg-dark border-pixel-border/30"
                    }`}
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
        )}

        {!isRevealing && (
          <div className="mt-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
            <p className="font-pixel text-[7px] text-pixel-text-muted text-center">
              Using Charms protocol — all ZK proofs verified on Bitcoin
            </p>
          </div>
        )}
      </div>
    );
  }

  if (state === "error") {
    const action = suggestedAction || error || "An unexpected error occurred.";
    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.error} p-6 ${pixelShadows.lg} text-center`}
      >
        <motion.div
          className="text-5xl mb-4"
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ duration: 0.5 }}
        >
          ⚠️
        </motion.div>
        <h3 className="font-pixel text-sm text-pixel-error uppercase mb-2">
          Mint Failed
        </h3>
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-4">
          {error || "An unexpected error occurred."}
        </p>
        {suggestedAction && (
          <div className="inline-block bg-pixel-bg-dark border-2 border-pixel-warning/50 px-3 py-1.5 mb-4">
            <p className="font-pixel text-[8px] text-pixel-warning flex items-center gap-1">
              <span>💡</span>
              {action}
            </p>
          </div>
        )}
        <div className="flex gap-2 justify-center mt-4">
          {onRetry && (
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Button onClick={onRetry} variant="secondary" size="sm">
                Try Again
              </Button>
            </motion.div>
          )}
          {onDismissError && (
            <Button onClick={onDismissError} variant="ghost" size="sm">
              Dismiss
            </Button>
          )}
        </div>
      </div>
    );
  }

  if (state === "success" && lastMinted) {
    return (
      <div
        className={`bg-pixel-bg-medium ${pixelBorders.success} p-6 ${pixelShadows.lg} relative overflow-hidden`}
      >
        {/* 8-bit Celebration — Motion Sparkles */}
        <div className="absolute inset-0 pointer-events-none">
          {SPARKLES.map(({ char, x, y, delay, size }, i) => (
            <motion.span
              key={i}
              className="absolute font-mono pointer-events-none"
              style={{ left: x, top: y, fontSize: `${size}px` }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.5, 0],
                x: [0, (i % 2 ? 30 : -30) * ((i % 3) + 1)],
                y: [0, (i % 2 ? -40 : -50) * ((i % 3) + 1)],
                rotate: [0, i * 45],
              }}
              transition={{ duration: 1.2, delay, ease: "easeOut" }}
            >
              {char}
            </motion.span>
          ))}
          {CONFETTI.map((char, i) => (
            <motion.span
              key={`conf-${i}`}
              className="absolute font-mono text-xs pointer-events-none"
              style={{ left: `${20 + i * 10}%`, top: "50%" }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                scale: [0, 1.3, 0],
                x: (i - 2.5) * 30,
                y: (i % 2 === 0 ? -1 : 1) * 45,
                rotate: i * 60,
              }}
              transition={{
                duration: 1.2,
                delay: 0.5 + i * 0.1,
                ease: "easeOut",
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Rainbow border glow */}
        <motion.div
          className="absolute inset-0 pointer-events-none border-4 rounded-lg"
          animate={{
            borderColor: [
              "rgba(34,197,94,0.3)",
              "rgba(168,85,247,0.3)",
              "rgba(59,130,246,0.3)",
              "rgba(251,146,60,0.3)",
              "rgba(34,197,94,0.3)",
            ],
          }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: [0.5, 1.05, 0.97, 1.02, 1], opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="text-center mb-4">
            <p className="font-pixel text-sm text-pixel-success uppercase mb-2">
              Congratulations!
            </p>
            <p className="font-pixel text-[8px] text-pixel-text-muted">
              You got a new Genesis Spark!
            </p>
          </div>

          <div className="mb-4">
            <NFTCard nft={lastMinted} showTokenId />
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4 p-3 bg-pixel-bg-dark border-2 border-pixel-border">
            {[
              { label: "Rarity", value: lastMinted.rarityTier },
              { label: "Bloodline", value: lastMinted.bloodline },
              { label: "Type", value: lastMinted.baseType },
              { label: "Mining Boost", value: `+${lastMinted.level * 10}%` },
            ].map(({ label, value }) => (
              <div key={label}>
                <span className="font-pixel text-[6px] text-pixel-text-muted uppercase">
                  {label}
                </span>
                <p className="font-pixel text-[10px] text-pixel-secondary capitalize">
                  {value}
                </p>
              </div>
            ))}
          </div>

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

          <div className="mb-4 p-2 bg-pixel-bg-dark border-2 border-pixel-accent rounded">
            <p className="font-pixel text-[6px] text-pixel-accent mb-1">
              Charms NFT
            </p>
            <p className="font-pixel-body text-[8px] text-pixel-text-muted">
              This is a real Charms NFT on Bitcoin Testnet4. It will appear in
              the Scrolls indexer once confirmed.
            </p>
          </div>

          <div className="flex gap-2">
            <motion.div
              className="flex-1"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                onClick={onViewCollection}
                variant="ghost"
                size="sm"
                className="w-full"
              >
                View Collection
              </Button>
            </motion.div>
            <motion.div
              className="flex-1"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <Button
                onClick={onMintAnother}
                variant="success"
                size="sm"
                className="w-full"
              >
                Mint Another
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}

export default NFTMintFlow;
