"use client";

/**
 * WalletActions - Wallet action buttons
 *
 * Primary and secondary wallet actions:
 * - Send, Claim, History (navigate to dedicated pages)
 * - Legacy Withdraw (deprecated, redirects to old system)
 * - Lock, Delete
 * - Get testnet BTC link
 */

import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

interface WalletActionsProps {
  onLock: () => void;
  onDelete: () => void;
  showTestnetFaucet: boolean;
  onViewChange?: (view: "send" | "claim" | "history") => void;
}

export function WalletActions({
  onLock,
  onDelete,
  showTestnetFaucet,
  onViewChange,
}: WalletActionsProps) {
  return (
    <>
      {/* Primary Actions - Navigate to dedicated pages */}
      <nav
        className="flex gap-2 sm:gap-3 pt-4 border-t-2 border-pixel-border"
        aria-label="Wallet actions"
      >
        <Button
          variant="default"
          className="w-full"
          onClick={() => onViewChange?.("send")}
          aria-label="Send Bitcoin"
        >
          SEND
        </Button>
        <Button
          variant="success"
          className="w-full"
          onClick={() => onViewChange?.("claim")}
          aria-label="Claim SPARK tokens"
        >
          CLAIM
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => onViewChange?.("history")}
          aria-label="View transaction history"
        >
          HISTORY
        </Button>
      </nav>

      {/* Get Testnet BTC */}
      {showTestnetFaucet && (
        <a
          href="https://mempool.space/testnet4/faucet"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Get free testnet Bitcoin from faucet (opens in new tab)"
          className={`block w-full py-3 min-h-[44px] font-pixel text-pixel-xs text-center bg-pixel-secondary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:scale-95`}
        >
          GET TESTNET BTC
        </a>
      )}

      {/* Secondary Actions */}
      <div
        className="flex gap-2 sm:gap-3 pt-3"
        role="group"
        aria-label="Wallet security actions"
      >
        <Button
          onClick={onLock}
          variant="ghost"
          className="flex-1"
          aria-label="Lock wallet"
        >
          LOCK
        </Button>
        <Button
          onClick={onDelete}
          variant="destructive"
          aria-label="Delete wallet permanently"
        >
          DELETE
        </Button>
      </div>
    </>
  );
}

export default WalletActions;
