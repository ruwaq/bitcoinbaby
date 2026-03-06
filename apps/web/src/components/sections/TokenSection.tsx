"use client";

/**
 * TokenSection - Seccion principal del token $BABTC
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
import {
  TokenHeader,
  TokenStats,
  TokenomicsCard,
  RewardTable,
  TokenActions,
  TokenLinks,
} from "../features/token";

export function TokenSection() {
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
    // Navigate to wallet claim page for on-chain minting
    window.location.href = "/wallet/claim";
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

      {/* Tokenomics */}
      <TokenomicsCard />

      {/* Reward Table */}
      <RewardTable />

      {/* Links */}
      <TokenLinks />
    </div>
  );
}

export default TokenSection;
