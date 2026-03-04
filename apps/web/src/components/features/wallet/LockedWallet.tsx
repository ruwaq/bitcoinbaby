"use client";

/**
 * LockedWallet - Wallet locked state UI
 *
 * Shows when wallet exists but is locked:
 * - Lock icon and message
 * - Unlock button
 * - Delete/restore option
 */

import { Button, pixelCard, pixelBorders } from "@bitcoinbaby/ui";

interface LockedWalletProps {
  isLoading: boolean;
  onUnlock: () => void;
  onDelete: () => void;
}

export function LockedWallet({
  isLoading,
  onUnlock,
  onDelete,
}: LockedWalletProps) {
  return (
    <div className={`${pixelCard.primary} p-6`}>
      <div className="text-center py-12">
        <div
          className={`w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-pixel-error/20 ${pixelBorders.error}`}
        >
          <span className="font-pixel text-3xl text-pixel-error">🔒</span>
        </div>
        <h2 className="font-pixel text-lg text-pixel-text mb-2">
          WALLET LOCKED
        </h2>
        <p className="font-pixel-body text-sm text-pixel-text-muted mb-6">
          Enter your password to access your wallet
        </p>
        <Button
          onClick={onUnlock}
          disabled={isLoading}
          variant="success"
          size="lg"
        >
          UNLOCK WALLET
        </Button>
      </div>

      <div className="border-t-2 border-pixel-border pt-6 mt-6">
        <p className="font-pixel text-pixel-xs text-pixel-text-muted text-center mb-4">
          Forgot password? You can restore using your recovery phrase.
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={onDelete} variant="destructive" size="sm">
            DELETE & RESTORE
          </Button>
        </div>
      </div>
    </div>
  );
}

export default LockedWallet;
