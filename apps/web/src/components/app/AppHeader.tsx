"use client";

/**
 * AppHeader - Persistent header with branding and status
 *
 * Contains:
 * - Logo/branding
 * - Mining status bar
 * - Wallet status
 * - Network badge
 */

import { clsx } from "clsx";
import { useNetworkStore, useWalletStore } from "@bitcoinbaby/core";
import { NetworkBadge, WalletStatusCompact } from "@bitcoinbaby/ui";
import { MiningStatusBar } from "./MiningStatusBar";

interface AppHeaderProps {
  onMiningClick?: () => void;
  onWalletClick?: () => void;
  className?: string;
}

export function AppHeader({
  onMiningClick,
  onWalletClick,
  className,
}: AppHeaderProps) {
  const { network } = useNetworkStore();
  const wallet = useWalletStore((s) => s.wallet);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 w-full",
        "flex items-center justify-between",
        "header-safe py-3 bg-pixel-bg-medium",
        "border-b-4 border-pixel-border",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-pixel-primary border-2 border-black flex items-center justify-center shadow-[2px_2px_0_0_#000]">
          <span className="font-pixel text-pixel-xs text-pixel-text-dark">
            B
          </span>
        </div>
        <div className="hidden sm:block">
          <h1 className="font-pixel text-pixel-sm text-pixel-primary leading-none">
            BITCOIN<span className="text-pixel-secondary">BABY</span>
          </h1>
        </div>
      </div>

      {/* Center: Mining Status */}
      <MiningStatusBar onClick={onMiningClick} />

      {/* Right: Network + Wallet */}
      <div className="flex items-center gap-2 sm:gap-3">
        <NetworkBadge network={network} className="hidden sm:flex" />

        {wallet ? (
          <WalletStatusCompact
            address={wallet.address}
            isLocked={false}
            onClick={onWalletClick}
          />
        ) : (
          <button
            onClick={onWalletClick}
            className={clsx(
              "px-3 py-2 min-h-[36px] font-pixel text-pixel-2xs uppercase",
              "bg-pixel-primary text-pixel-text-dark",
              "border-2 border-black shadow-[2px_2px_0_0_#000]",
              "hover:translate-x-[1px] hover:translate-y-[1px]",
              "hover:shadow-[1px_1px_0_0_#000] transition-all",
              "active:scale-95",
            )}
          >
            Connect
          </button>
        )}
      </div>
    </header>
  );
}

export default AppHeader;
