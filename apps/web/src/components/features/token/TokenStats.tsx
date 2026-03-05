"use client";

/**
 * TokenStats - Stats cards del token $BABTC
 *
 * Muestra:
 * - Max Supply
 * - Circulating Supply (estimado)
 * - Your Balance (virtual + on-chain)
 * - Pending Withdrawals
 */

import { BABTC_CONFIG } from "@bitcoinbaby/bitcoin";
import {
  AnimatedTokenCounter,
  HelpTooltip,
  pixelBorders,
} from "@bitcoinbaby/ui";

interface TokenStatsProps {
  virtualBalance: bigint;
  onChainBalance: bigint;
  isLoading?: boolean;
}

export function TokenStats({
  virtualBalance,
  onChainBalance,
  isLoading = false,
}: TokenStatsProps) {
  const maxSupply = BABTC_CONFIG.maxSupply;
  const totalBalance = virtualBalance + onChainBalance;

  // Format large numbers with suffix (B, M, K)
  const formatLargeNumber = (value: bigint): string => {
    const num = Number(value) / 100_000_000; // Convert to token units
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4">
      {/* Max Supply */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            Max Supply
          </span>
          <HelpTooltip
            content="The maximum number of $BABTC tokens that will ever exist. Similar to Bitcoin's 21M cap."
            title="Maximum Supply"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-primary">
          {formatLargeNumber(maxSupply)}
        </div>
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          21 Billion tokens
        </div>
      </div>

      {/* Your Total Balance */}
      <div
        className={`bg-pixel-bg-medium border-4 border-pixel-success p-3 sm:p-4`}
      >
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            Your Balance
          </span>
          <HelpTooltip
            content="Your total $BABTC tokens: virtual balance (earned from mining) + on-chain balance (withdrawn to wallet)."
            title="Total Balance"
            size="sm"
          />
        </div>
        {isLoading ? (
          <div className="font-pixel text-pixel-base text-pixel-text-muted animate-pulse">
            ---
          </div>
        ) : (
          <AnimatedTokenCounter
            value={totalBalance}
            size="lg"
            showGlow={true}
            className="text-pixel-success"
          />
        )}
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          Virtual + On-chain
        </div>
      </div>

      {/* Virtual Balance */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            Virtual
          </span>
          <HelpTooltip
            content="Tokens earned from mining, stored in your virtual account. Available for withdrawal."
            title="Virtual Balance"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-secondary">
          {isLoading ? "---" : virtualBalance.toLocaleString()}
        </div>
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          Available to withdraw
        </div>
      </div>

      {/* On-Chain Balance */}
      <div className={`bg-pixel-bg-medium ${pixelBorders.medium} p-3 sm:p-4`}>
        <div className="flex items-center gap-1 mb-2">
          <span className="font-pixel text-pixel-2xs text-pixel-text-muted uppercase truncate">
            On-Chain
          </span>
          <HelpTooltip
            content="Tokens withdrawn to your Bitcoin wallet. These are Charms tokens on the Bitcoin blockchain."
            title="On-Chain Balance"
            size="sm"
          />
        </div>
        <div className="font-pixel text-pixel-base text-pixel-warning">
          {isLoading ? "---" : onChainBalance.toLocaleString()}
        </div>
        <div className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
          In your wallet
        </div>
      </div>
    </div>
  );
}

export default TokenStats;
