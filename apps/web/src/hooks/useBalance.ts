"use client";

/**
 * useBalance Hook — TanStack Query powered
 *
 * Fetches BTC balance, UTXOs, and fee estimates from Mempool.space API.
 * Uses TanStack Query for caching, background refetch, and stale-while-revalidate.
 *
 * Query key: ['btc-balance', address, network]
 * Stale time: 30s (BTC data changes slowly on testnet)
 */

import { useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  type BlockchainAPI,
  createMempoolClient,
  type AddressBalance,
  type UTXO,
  type FeeEstimates,
  type BitcoinNetwork,
} from "@bitcoinbaby/bitcoin";

interface BalanceState {
  balance: AddressBalance | null;
  utxos: UTXO[];
  fees: FeeEstimates | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
}

interface UseBalanceOptions {
  address?: string;
  network?: BitcoinNetwork;
  autoRefresh?: boolean;
  refreshInterval?: number; // ms
}

/**
 * Raw data fetcher — called by TanStack Query.
 * Returns all three data points in parallel via Promise.all.
 */
async function fetchBtcData(
  address: string,
  client: BlockchainAPI,
): Promise<{
  balance: AddressBalance;
  utxos: UTXO[];
  fees: FeeEstimates;
}> {
  const [balance, utxos, fees] = await Promise.all([
    client.getBalance(address),
    client.getUTXOs(address),
    client.getFeeEstimates(),
  ]);
  return { balance, utxos, fees };
}

export function useBalance(options: UseBalanceOptions = {}) {
  const {
    address,
    network = "testnet4",
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  // Stable client ref — recreated when network changes
  const clientRef = useRef<BlockchainAPI | null>(null);
  if (!clientRef.current) {
    clientRef.current = createMempoolClient({ network });
  }

  useEffect(() => {
    clientRef.current = createMempoolClient({ network });
  }, [network]);

  // ---- TanStack Query ----
  const {
    data,
    isLoading,
    error: queryError,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["btc-balance", address, network],
    queryFn: async () => {
      if (!address || !clientRef.current) return null;
      return fetchBtcData(address, clientRef.current);
    },
    enabled: !!address && autoRefresh,
    // Only poll when autoRefresh is enabled
    refetchInterval: autoRefresh && address ? refreshInterval : false,
    // Keep stale data visible while refetching
    placeholderData: (prev) => prev,
    // Don't refetch on mount if we already have data (manual refresh pattern)
    refetchOnMount: false,
  });

  // Manual refresh — triggers a fresh fetch
  const refresh = useCallback(() => {
    if (address) {
      refetch();
    }
  }, [address, refetch]);

  // Derived values
  const balance = data?.balance ?? null;
  const utxos = data?.utxos ?? [];
  const fees = data?.fees ?? null;

  const btcBalance = balance
    ? (balance.total / 100_000_000).toFixed(8)
    : "0.00000000";

  const confirmed = balance?.confirmed ?? 0;
  const unconfirmed = balance?.unconfirmed ?? 0;

  return {
    balance,
    utxos,
    fees,
    isLoading,
    error: queryError instanceof Error ? queryError.message : null,
    lastUpdated: dataUpdatedAt ?? null,
    btcBalance,
    confirmed,
    unconfirmed,
    refresh,
    hasBalance: (balance?.total ?? 0) > 0,
  };
}

export type { BalanceState, UseBalanceOptions };
