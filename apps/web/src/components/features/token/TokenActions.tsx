"use client";

/**
 * TokenActions - Acciones para interactuar con el token
 *
 * Muestra:
 * - Withdraw (virtual -> on-chain)
 * - Transfer (send tokens)
 * - Start Mining (link a mining section)
 * - Buy NFT (link a NFT section)
 */

import { useRouter } from "next/navigation";
import { pixelBorders } from "@bitcoinbaby/ui";

interface TokenActionsProps {
  virtualBalance: bigint;
  canWithdraw: boolean;
  isWithdrawing?: boolean;
  onWithdraw?: () => void;
  minWithdraw?: bigint;
}

export function TokenActions({
  virtualBalance,
  canWithdraw,
  isWithdrawing = false,
  onWithdraw,
  minWithdraw = 10_000n,
}: TokenActionsProps) {
  const router = useRouter();

  const hasEnoughToWithdraw = virtualBalance >= minWithdraw;

  return (
    <div
      className={`bg-pixel-bg-medium ${pixelBorders.medium} p-4 sm:p-6 mb-4`}
    >
      <h2 className="font-pixel text-pixel-sm text-pixel-primary mb-4">
        ACTIONS
      </h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Withdraw Button */}
        <button
          onClick={onWithdraw}
          disabled={!canWithdraw || !hasEnoughToWithdraw || isWithdrawing}
          className={`flex flex-col items-center justify-center p-4 transition-all ${
            canWithdraw && hasEnoughToWithdraw && !isWithdrawing
              ? `bg-pixel-success/20 ${pixelBorders.thin} border-pixel-success hover:bg-pixel-success/30 cursor-pointer`
              : `bg-pixel-bg-dark ${pixelBorders.thin} border-pixel-text-muted/30 cursor-not-allowed opacity-50`
          }`}
        >
          <span className="text-2xl mb-2">{isWithdrawing ? "..." : "💰"}</span>
          <span className="font-pixel text-pixel-2xs text-pixel-text">
            {isWithdrawing ? "PROCESSING" : "WITHDRAW"}
          </span>
          {!hasEnoughToWithdraw && (
            <span className="font-pixel text-pixel-2xs text-pixel-text-muted mt-1">
              Min: {minWithdraw.toLocaleString()}
            </span>
          )}
        </button>

        {/* Start Mining Button */}
        <button
          onClick={() => router.push("/?tab=mining")}
          className={`flex flex-col items-center justify-center p-4 bg-pixel-primary/20 ${pixelBorders.thin} border-pixel-primary hover:bg-pixel-primary/30 transition-all cursor-pointer`}
        >
          <span className="text-2xl mb-2">⛏️</span>
          <span className="font-pixel text-pixel-2xs text-pixel-text">
            START MINING
          </span>
        </button>

        {/* Buy NFT Button */}
        <button
          onClick={() => router.push("/?tab=nfts")}
          className={`flex flex-col items-center justify-center p-4 bg-pixel-secondary/20 ${pixelBorders.thin} border-pixel-secondary hover:bg-pixel-secondary/30 transition-all cursor-pointer`}
        >
          <span className="text-2xl mb-2">🎨</span>
          <span className="font-pixel text-pixel-2xs text-pixel-text">
            GET NFT
          </span>
        </button>

        {/* Leaderboard Button */}
        <button
          onClick={() => router.push("/leaderboard")}
          className={`flex flex-col items-center justify-center p-4 bg-pixel-warning/20 ${pixelBorders.thin} border-pixel-warning hover:bg-pixel-warning/30 transition-all cursor-pointer`}
        >
          <span className="text-2xl mb-2">🏆</span>
          <span className="font-pixel text-pixel-2xs text-pixel-text">
            LEADERBOARD
          </span>
        </button>
      </div>

      {/* Withdraw Info */}
      {virtualBalance > 0n && (
        <div className="mt-4 pt-4 border-t border-pixel-text-muted/20">
          <p className="font-pixel-body text-pixel-xs text-pixel-text-muted">
            Withdraw converts your virtual $BABY to on-chain BABTC tokens on
            Bitcoin. Minimum withdrawal: {minWithdraw.toLocaleString()} $BABY.
          </p>
        </div>
      )}
    </div>
  );
}

export default TokenActions;
