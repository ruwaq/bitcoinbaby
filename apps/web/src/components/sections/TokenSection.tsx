"use client";

/**
 * TokenSection - Seccion principal del token $SPARK
 *
 * Muestra toda la informacion sobre el token:
 * - Header con logo, nombre, badges
 * - Stats: supply, balance, etc.
 * - Tokenomics: distribucion, formula
 * - Reward table
 * - Actions: claim, mining, NFT
 * - Links: explorers, docs
 */

import { useUnifiedBalance, useWalletStore } from "@bitcoinbaby/core";
import { pixelBorders } from "@bitcoinbaby/ui";
import { useRouter } from "next/navigation";
import {
  TokenHeader,
  TokenStats,
  TokenomicsCard,
  RewardTable,
  TokenActions,
  TokenLinks,
} from "../features/token";

export function TokenSection() {
  const router = useRouter();

  // Get wallet address from store
  const wallet = useWalletStore((s) => s.wallet);
  const address = wallet?.address || null;

  // Get all balances using unified hook
  const { virtual, token, isLoading } = useUnifiedBalance({
    address,
  });

  // Check if user can claim (min 10,000 $BABY)
  const minClaim = 10_000n;
  const canClaim = address && virtual.balance >= minClaim && !isLoading;
  const isClaiming = false; // Actual claim goes through wallet page

  const handleClaim = async () => {
    // Navigate to wallet tab with claim view for on-chain minting
    router.push("/?tab=wallet&view=claim");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6">
      {/* Token Header */}
      <TokenHeader />

      {/* Stats Grid */}
      <TokenStats
        virtualBalance={virtual.balance}
        onChainBalance={token.onChain}
        isLoading={isLoading}
      />

      {/* Actions */}
      <TokenActions
        virtualBalance={virtual.balance}
        canClaim={!!canClaim}
        isClaiming={isClaiming}
        onClaim={handleClaim}
        minClaim={minClaim}
      />

      {/* Advanced Tokenomics & Resources */}
      <details className="mt-6 group">
        <summary
          className={`font-pixel text-pixel-2xs bg-pixel-bg-medium ${pixelBorders.medium} p-4 text-pixel-text-muted hover:text-pixel-primary flex items-center justify-between cursor-pointer list-none [&::-webkit-details-marker]:hidden outline-none select-none`}
        >
          <span>ADVANCED TOKENOMICS & RESOURCES</span>
          <span className="transform group-open:rotate-180 transition-transform duration-200">
            ▼
          </span>
        </summary>
        <div className="mt-6 flex flex-col gap-6">
          {/* Tokenomics */}
          <TokenomicsCard />

          {/* Reward Table */}
          <RewardTable />

          {/* Links */}
          <TokenLinks />
        </div>
      </details>
    </div>
  );
}

export default TokenSection;
