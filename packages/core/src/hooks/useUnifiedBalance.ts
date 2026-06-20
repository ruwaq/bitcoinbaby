/**
 * useUnifiedBalance - Unified Balance Hook
 *
 * Consolidates all balance sources into a single, easy-to-use hook.
 * Combines: BTC balance, Token balance ($BABY), and Virtual balance.
 *
 * @example
 * const { btc, token, virtual, total, isLoading, refresh } = useUnifiedBalance({
 *   address: wallet.address,
 * });
 */

import { useMemo, useCallback } from "react";
import { useBTCBalance, useTokenBalance } from "./useCharms";
import { useBalance } from "./use-api";

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedBalanceOptions {
  /** User's Bitcoin address */
  address: string | null;
  /** Token app ID for Charms (default: SPARK_TOKEN_APP_ID) */
  tokenAppId?: string;
  /** Auto-refresh interval in ms (0 to disable) */
  refreshInterval?: number;
}

export interface BTCBalanceInfo {
  /** Confirmed satoshis */
  confirmed: number;
  /** Unconfirmed satoshis */
  unconfirmed: number;
  /** Total satoshis (confirmed + unconfirmed) */
  total: number;
  /** Formatted BTC string */
  formatted: string;
}

export interface TokenBalanceInfo {
  /** On-chain token balance */
  onChain: bigint;
  /** Pending/unconfirmed tokens */
  pending: bigint;
  /** Total on-chain tokens */
  total: bigint;
  /** Formatted token string */
  formatted: string;
}

export interface VirtualBalanceInfo {
  /** Virtual balance (mined but not withdrawn) */
  balance: bigint;
  /** Available to withdraw */
  available: bigint;
  /** Pending withdrawal */
  pending: bigint;
  /** Total mined all time */
  totalMined: bigint;
  /** Total withdrawn all time */
  totalWithdrawn: bigint;
  /** Formatted balance string */
  formatted: string;
}

export interface UseUnifiedBalanceReturn {
  /** Bitcoin balance info */
  btc: BTCBalanceInfo;
  /** Token balance info (on-chain $BABY) */
  token: TokenBalanceInfo;
  /** Virtual balance info (mined, not yet on-chain) */
  virtual: VirtualBalanceInfo;

  /** Combined total tokens (on-chain + virtual) */
  totalTokens: {
    amount: bigint;
    formatted: string;
  };

  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Refresh all balances */
  refresh: () => Promise<void>;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SPARK_TOKEN_APP_ID = "baby"; // Default token app ID
const SATS_PER_BTC = 100_000_000;
const TOKEN_DECIMALS = 8;

// =============================================================================
// HELPERS
// =============================================================================

function formatBTC(sats: number): string {
  const btc = sats / SATS_PER_BTC;
  if (btc === 0) return "0";
  if (btc < 0.0001) return `${sats} sats`;
  return `${btc.toFixed(8)} BTC`;
}

function formatTokens(amount: bigint): string {
  const divisor = BigInt(10 ** TOKEN_DECIMALS);
  const whole = amount / divisor;
  const fractional = amount % divisor;

  if (amount === 0n) return "0";

  if (fractional === 0n) {
    return whole.toLocaleString();
  }

  // Format with up to 2 decimal places
  const fractionalStr = fractional.toString().padStart(TOKEN_DECIMALS, "0");
  const decimals = fractionalStr.slice(0, 2).replace(/0+$/, "") || "0";

  if (decimals === "0") {
    return whole.toLocaleString();
  }

  return `${whole.toLocaleString()}.${decimals}`;
}

// =============================================================================
// HOOK
// =============================================================================

export function useUnifiedBalance(
  options: UnifiedBalanceOptions,
): UseUnifiedBalanceReturn {
  const { address, tokenAppId = SPARK_TOKEN_APP_ID } = options;

  // Fetch individual balances
  const btcBalance = useBTCBalance(address);
  const tokenBalance = useTokenBalance(address, tokenAppId);
  const virtualBalance = useBalance(address);

  // Combine loading states
  const isLoading =
    btcBalance.loading || tokenBalance.loading || virtualBalance.loading;

  // Combine errors
  const error = useMemo(() => {
    const errors = [
      btcBalance.error?.message,
      tokenBalance.error?.message,
      virtualBalance.error,
    ].filter(Boolean);
    return errors.length > 0 ? errors.join("; ") : null;
  }, [btcBalance.error, tokenBalance.error, virtualBalance.error]);

  // Build BTC info
  const btc: BTCBalanceInfo = useMemo(
    () => ({
      confirmed: btcBalance.confirmed,
      unconfirmed: btcBalance.unconfirmed,
      total: btcBalance.confirmed + btcBalance.unconfirmed,
      formatted: formatBTC(btcBalance.confirmed + btcBalance.unconfirmed),
    }),
    [btcBalance.confirmed, btcBalance.unconfirmed],
  );

  // Build token info
  const token: TokenBalanceInfo = useMemo(
    () => ({
      onChain: tokenBalance.balance,
      pending: 0n, // Currently not tracked separately
      total: tokenBalance.balance,
      formatted: formatTokens(tokenBalance.balance),
    }),
    [tokenBalance.balance],
  );

  // Build virtual info
  const virtual: VirtualBalanceInfo = useMemo(() => {
    const balance = virtualBalance.balance;
    if (!balance) {
      return {
        balance: 0n,
        available: 0n,
        pending: 0n,
        totalMined: 0n,
        totalWithdrawn: 0n,
        formatted: "0",
      };
    }

    const vBalance = BigInt(balance.virtualBalance || "0");
    const available = BigInt(balance.availableToWithdraw || "0");
    const pending = BigInt(balance.pendingWithdraw || "0");
    const totalMined = BigInt(balance.totalMined || "0");
    const totalWithdrawn = BigInt(balance.totalWithdrawn || "0");

    return {
      balance: vBalance,
      available,
      pending,
      totalMined,
      totalWithdrawn,
      formatted: formatTokens(vBalance),
    };
  }, [virtualBalance.balance]);

  // Combined total tokens
  const totalTokens = useMemo(() => {
    const amount = token.onChain + virtual.balance;
    return {
      amount,
      formatted: formatTokens(amount),
    };
  }, [token.onChain, virtual.balance]);

  // Refresh function
  const refresh = useCallback(async () => {
    await Promise.all([
      btcBalance.refresh(),
      tokenBalance.refresh(),
      virtualBalance.refetch(),
    ]);
  }, [btcBalance, tokenBalance, virtualBalance]);

  return {
    btc,
    token,
    virtual,
    totalTokens,
    isLoading,
    error,
    refresh,
  };
}

export default useUnifiedBalance;
