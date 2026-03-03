/**
 * Charms Hooks
 *
 * React hooks for interacting with Charms protocol.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  createCharmsClient,
  formatTokenAmount,
  BABTC_CONFIG,
  type CharmsClientOptions,
} from "@bitcoinbaby/bitcoin";
import { useNFTStore } from "../stores/nft-store";

// =============================================================================
// TYPES
// =============================================================================

interface UseCharmsOptions extends CharmsClientOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// =============================================================================
// CLIENT SINGLETON
// =============================================================================

let clientInstance: ReturnType<typeof createCharmsClient> | null = null;

function getClient(options?: CharmsClientOptions) {
  if (!clientInstance) {
    clientInstance = createCharmsClient(options);
  }
  return clientInstance;
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook for token balance
 */
export function useTokenBalance(
  address: string | null,
  appId: string,
  options?: UseCharmsOptions,
) {
  const [balance, setBalance] = useState<bigint>(0n);
  const [formatted, setFormatted] = useState("0.00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => getClient(options), [options]);

  const refresh = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const bal = await client.getTokenBalance(address, appId);
      setBalance(bal);
      setFormatted(formatTokenAmount(bal, BABTC_CONFIG.decimals));
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address, appId, client]);

  useEffect(() => {
    refresh();

    if (options?.autoRefresh !== false) {
      const interval = setInterval(
        refresh,
        options?.refreshInterval || 120_000,
      );
      return () => clearInterval(interval);
    }
  }, [refresh, options?.autoRefresh, options?.refreshInterval]);

  return { balance, formatted, loading, error, refresh };
}

/**
 * Hook for owned NFTs (READ-ONLY)
 *
 * @deprecated This hook only reads from NFTStore. Use useNFTSync from
 * apps/web/src/hooks/useNFTSync.ts for fetching NFT data from the server.
 *
 * DATA FLOW (Single Source of Truth):
 * 1. useNFTSync (web app) fetches from Workers API (fast, indexed)
 * 2. useNFTSync calls setOwnedNFTs() to update NFTStore
 * 3. This hook (and useMiningBoost) reads from NFTStore
 *
 * DO NOT fetch from blockchain here - it's slow and creates race conditions.
 */
export function useOwnedNFTs(
  _address: string | null,
  _appId: string,
  _options?: UseCharmsOptions,
) {
  // Read-only from NFTStore (populated by useNFTSync in web app)
  const { ownedNFTs, isLoading, error, bestBoost, totalNFTs } = useNFTStore();

  return {
    nfts: ownedNFTs,
    loading: isLoading,
    error,
    bestBoost,
    totalNFTs,
    refresh: () => {
      console.warn(
        "[useOwnedNFTs] refresh() is a no-op. Use useNFTSync for fetching.",
      );
    },
  };
}

/**
 * Hook for mining boost
 *
 * Reads directly from the NFT store which is populated by useNFTSync.
 * This avoids duplicate blockchain queries and ensures consistency.
 *
 * The NFT store is populated by:
 * - useNFTSync (apps/web) - calls our Workers API for indexed NFT data
 * - Persistence from localStorage (rehydrates on page load)
 */
export function useMiningBoost(
  _address: string | null,
  _appId: string,
  _options?: UseCharmsOptions,
) {
  // Read directly from NFT store (populated by useNFTSync in web app)
  const { bestBoost, totalNFTs, isLoading, ownedNFTs } = useNFTStore();

  // Debug: Log if store has data but boost is 0
  useEffect(() => {
    if (ownedNFTs.length > 0 && bestBoost === 0) {
      console.warn(
        "[useMiningBoost] NFTs found but bestBoost is 0. NFTs:",
        ownedNFTs.map((n) => ({
          tokenId: n.tokenId,
          level: n.level,
          rarityTier: n.rarityTier,
        })),
      );
    }
  }, [ownedNFTs, bestBoost]);

  return {
    boost: bestBoost,
    nftCount: totalNFTs,
    loading: isLoading,
    refresh: () => {}, // No-op - refresh handled by useNFTSync
  };
}

/**
 * Hook for BTC balance
 */
export function useBTCBalance(
  address: string | null,
  options?: UseCharmsOptions,
) {
  const [confirmed, setConfirmed] = useState(0);
  const [unconfirmed, setUnconfirmed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => getClient(options), [options]);

  const refresh = useCallback(async () => {
    if (!address) return;

    setLoading(true);
    setError(null);

    try {
      const balance = await client.getBalance(address);
      setConfirmed(balance.confirmed);
      setUnconfirmed(balance.unconfirmed);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [address, client]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 60_000); // 1 minute
    return () => clearInterval(interval);
  }, [refresh]);

  const total = confirmed + unconfirmed;
  const btc = total / 100_000_000;

  return {
    confirmed,
    unconfirmed,
    total,
    btc,
    loading,
    error,
    refresh,
  };
}

/**
 * Hook for fee estimates
 */
export function useFeeEstimates(options?: UseCharmsOptions) {
  const [fees, setFees] = useState<{
    fastestFee: number;
    halfHourFee: number;
    hourFee: number;
    economyFee: number;
    minimumFee: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => getClient(options), [options]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const estimates = await client.getFeeEstimates();
      setFees(estimates);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 30_000); // 30 seconds
    return () => clearInterval(interval);
  }, [refresh]);

  return { fees, loading, error, refresh };
}

/**
 * Hook for block height
 */
export function useBlockHeight(options?: UseCharmsOptions) {
  const [height, setHeight] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => getClient(options), [options]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const h = await client.getBlockHeight();
      setHeight(h);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refresh();

    const interval = setInterval(refresh, 60_000); // 1 minute
    return () => clearInterval(interval);
  }, [refresh]);

  return { height, loading, error, refresh };
}

/**
 * Combined dashboard hook
 *
 * @deprecated NFT data should be fetched via useNFTSync in the web app.
 * This hook reads NFT data from NFTStore (read-only).
 *
 * For full dashboard functionality in web app, use individual hooks:
 * - useVirtualBalance (for token balance)
 * - useNFTSync (for NFT fetching)
 * - useFeeEstimates (for network fees)
 */
export function useDashboard(
  address: string | null,
  tokenAppId: string,
  _nftAppId: string,
  options?: UseCharmsOptions,
) {
  const btc = useBTCBalance(address, options);
  const token = useTokenBalance(address, tokenAppId, options);
  const fees = useFeeEstimates(options);
  const block = useBlockHeight(options);

  // Read NFT data from store (populated by useNFTSync)
  const {
    ownedNFTs,
    totalNFTs,
    bestBoost,
    isLoading: nftsLoading,
  } = useNFTStore();

  const loading =
    btc.loading ||
    token.loading ||
    nftsLoading ||
    fees.loading ||
    block.loading;

  const refresh = useCallback(async () => {
    await Promise.all([
      btc.refresh(),
      token.refresh(),
      fees.refresh(),
      block.refresh(),
    ]);
    // Note: NFT refresh is handled by useNFTSync, not here
  }, [btc, token, fees, block]);

  return {
    // BTC
    btcBalance: btc.total,
    btcFormatted: btc.btc.toFixed(8),

    // Token
    tokenBalance: token.balance,
    tokenFormatted: token.formatted,

    // NFTs (read-only from store)
    ownedNFTs,
    nftCount: totalNFTs,
    miningBoost: bestBoost,

    // Network
    feeRate: fees.fees?.halfHourFee || 0,
    blockHeight: block.height,

    // Meta
    loading,
    refresh,
  };
}
