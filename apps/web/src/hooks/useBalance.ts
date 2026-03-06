"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MempoolClient,
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

export function useBalance(options: UseBalanceOptions = {}) {
  const {
    address,
    network = "testnet4",
    autoRefresh = false,
    refreshInterval = 30000,
  } = options;

  const clientRef = useRef<MempoolClient | null>(null);
  // Track mounted state to prevent setState on unmounted component
  const isMountedRef = useRef(true);

  const [state, setState] = useState<BalanceState>({
    balance: null,
    utxos: [],
    fees: null,
    isLoading: false,
    error: null,
    lastUpdated: null,
  });

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize client
  useEffect(() => {
    clientRef.current = createMempoolClient({ network });
    return () => {
      clientRef.current = null;
    };
  }, [network]);

  // Fetch balance
  const fetchBalance = useCallback(async () => {
    if (!address || !clientRef.current) return;

    // Check if mounted before setState
    if (!isMountedRef.current) return;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const [balance, utxos, fees] = await Promise.all([
        clientRef.current.getBalance(address),
        clientRef.current.getUTXOs(address),
        clientRef.current.getFeeEstimates(),
      ]);

      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      setState({
        balance,
        utxos,
        fees,
        isLoading: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (err) {
      // Check if still mounted after async operation
      if (!isMountedRef.current) return;

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: err instanceof Error ? err.message : "Failed to fetch balance",
      }));
    }
  }, [address]);

  // Auto-refresh
  useEffect(() => {
    if (!address || !autoRefresh) return;

    fetchBalance();

    const intervalId = setInterval(fetchBalance, refreshInterval);
    return () => clearInterval(intervalId);
  }, [address, autoRefresh, refreshInterval, fetchBalance]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchBalance();
  }, [fetchBalance]);

  // Format balance as BTC
  const btcBalance = state.balance
    ? (state.balance.total / 100_000_000).toFixed(8)
    : "0.00000000";

  // Get confirmed vs unconfirmed
  const confirmed = state.balance?.confirmed ?? 0;
  const unconfirmed = state.balance?.unconfirmed ?? 0;

  return {
    ...state,
    btcBalance,
    confirmed,
    unconfirmed,
    refresh,
    hasBalance: (state.balance?.total ?? 0) > 0,
  };
}

export type { BalanceState, UseBalanceOptions };
