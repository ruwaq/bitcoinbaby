"use client";

/**
 * BalancesGrid - Grid of wallet balance cards
 *
 * Shows:
 * - BTC balance
 * - $BABY virtual balance
 * - BABTC (Charms) balance
 * - Mining boost from NFTs
 */

import { HelpTooltip } from "@bitcoinbaby/ui";

interface BalancesGridProps {
  // BTC
  btcBalance: string;
  btcUnconfirmed?: number;
  btcLoading: boolean;
  onRefreshBtc: () => void;

  // Virtual $BABY
  virtualBalance: bigint;
  totalMined: bigint;
  virtualLoading: boolean;

  // BABTC Charms
  babtcFormatted: string;
  babtcLoading: boolean;
  babtcError: Error | null;

  // Mining boost
  miningBoost: number;
  nftCount: number;
  boostLoading: boolean;
}

export function BalancesGrid({
  btcBalance,
  btcUnconfirmed,
  btcLoading,
  onRefreshBtc,
  virtualBalance,
  totalMined,
  virtualLoading,
  babtcFormatted,
  babtcLoading,
  babtcError,
  miningBoost,
  nftCount,
  boostLoading,
}: BalancesGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {/* BTC Balance */}
      <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
        <div className="flex items-center justify-between mb-1 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
              BTC BALANCE
            </label>
            <HelpTooltip
              content="Your Bitcoin balance on the blockchain. Used for transaction fees and sending."
              title="Bitcoin"
              size="sm"
            />
          </div>
          <button
            onClick={onRefreshBtc}
            disabled={btcLoading}
            className="font-pixel text-pixel-2xs text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50 p-1"
          >
            {btcLoading ? "..." : "↻"}
          </button>
        </div>
        <span className="font-pixel text-pixel-base text-pixel-text">
          {btcBalance}
        </span>
        {btcUnconfirmed !== undefined && btcUnconfirmed !== 0 && (
          <p className="font-pixel text-pixel-2xs text-pixel-secondary mt-1 truncate">
            +{(btcUnconfirmed / 100_000_000).toFixed(8)} pending
          </p>
        )}
      </div>

      {/* $BABY Virtual Balance (Primary) */}
      <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-success">
        <div className="flex items-center justify-between mb-1 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
              $BABY BALANCE
            </label>
            <HelpTooltip
              content="Tokens earned from mining. You can withdraw these to your Bitcoin wallet as Charms tokens."
              title="Mining Rewards"
              size="sm"
            />
          </div>
          {virtualLoading && (
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
              ...
            </span>
          )}
        </div>
        <span className="font-pixel text-pixel-base text-pixel-success">
          {virtualLoading ? "---" : virtualBalance.toLocaleString()}
        </span>
        <p className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1 truncate">
          Total mined: {totalMined.toLocaleString()}
        </p>
      </div>

      {/* BABTC Token Balance */}
      <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
        <div className="flex items-center justify-between mb-1 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
              BABTC (CHARMS)
            </label>
            <HelpTooltip
              content="BABTC tokens stored on Bitcoin as Charms. These are $BABY tokens that have been withdrawn to the blockchain."
              title="On-Chain Tokens"
              size="sm"
            />
          </div>
          {babtcLoading && (
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
              ...
            </span>
          )}
        </div>
        {babtcError ? (
          <span className="font-pixel text-pixel-sm text-pixel-error">
            Error
          </span>
        ) : (
          <span className="font-pixel text-pixel-base text-pixel-secondary">
            {babtcLoading ? "---" : babtcFormatted}
          </span>
        )}
      </div>

      {/* Mining Boost */}
      <div className="bg-pixel-bg-dark p-3 sm:p-4 border-2 border-pixel-border">
        <div className="flex items-center justify-between mb-1 gap-1">
          <div className="flex items-center gap-1 min-w-0">
            <label className="font-pixel text-pixel-2xs text-pixel-text-muted truncate">
              MINING BOOST
            </label>
            <HelpTooltip
              content="Extra mining rewards from your Genesis Babies NFTs. Higher rarity NFTs provide bigger boosts."
              title="NFT Boost"
              size="sm"
            />
          </div>
          {boostLoading && (
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted animate-pulse">
              ...
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className={`font-pixel text-pixel-base ${
              miningBoost > 0 ? "text-pixel-success" : "text-pixel-text"
            }`}
          >
            {boostLoading ? "---" : `+${miningBoost}%`}
          </span>
          {nftCount > 0 && (
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted">
              ({nftCount} NFT{nftCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>
        {miningBoost === 0 && !boostLoading && (
          <p className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1 truncate">
            Get Genesis Babies for boost
          </p>
        )}
      </div>
    </div>
  );
}

export default BalancesGrid;
