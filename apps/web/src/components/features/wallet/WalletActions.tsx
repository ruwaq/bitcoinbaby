"use client";

/**
 * WalletActions - Wallet action buttons
 *
 * Primary and secondary wallet actions:
 * - Send, Withdraw, History
 * - Lock, Delete
 * - Get testnet BTC link
 */

import { Button, pixelShadows, pixelBorders } from "@bitcoinbaby/ui";

interface WalletActionsProps {
  onSend: () => void;
  onWithdraw: () => void;
  onHistory: () => void;
  onLock: () => void;
  onDelete: () => void;
  showTestnetFaucet: boolean;
}

export function WalletActions({
  onSend,
  onWithdraw,
  onHistory,
  onLock,
  onDelete,
  showTestnetFaucet,
}: WalletActionsProps) {
  return (
    <>
      {/* Primary Actions */}
      <div className="flex gap-2 sm:gap-3 pt-4 border-t-2 border-pixel-border">
        <Button onClick={onSend} variant="default" className="flex-1">
          SEND
        </Button>
        <Button onClick={onWithdraw} variant="success" className="flex-1">
          WITHDRAW
        </Button>
        <Button onClick={onHistory} variant="outline" className="flex-1">
          HISTORY
        </Button>
      </div>

      {/* Get Testnet BTC */}
      {showTestnetFaucet && (
        <a
          href="https://mempool.space/testnet4/faucet"
          target="_blank"
          rel="noopener noreferrer"
          className={`block w-full py-3 min-h-[44px] font-pixel text-pixel-xs text-center bg-pixel-secondary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all active:scale-95`}
        >
          GET TESTNET BTC
        </a>
      )}

      {/* Secondary Actions */}
      <div className="flex gap-2 sm:gap-3 pt-3">
        <Button onClick={onLock} variant="ghost" className="flex-1">
          LOCK
        </Button>
        <Button onClick={onDelete} variant="destructive">
          DELETE
        </Button>
      </div>
    </>
  );
}

export default WalletActions;
