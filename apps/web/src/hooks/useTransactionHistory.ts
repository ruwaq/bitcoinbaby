"use client";

/**
 * useTransactionHistory Hook — TanStack Query powered
 *
 * Fetches and manages transaction history from Mempool.space API.
 * Supports pagination via "load more" pattern with cursor-based loading.
 *
 * Uses TanStack Query for caching and background refetch.
 * Pagination is handled via infinite query pattern (useInfiniteQuery).
 *
 * Query key: ['tx-history', address, network]
 */

import { useCallback, useRef, useEffect } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  createMempoolClient,
  type TransactionInfo,
  type BitcoinNetwork,
} from "@bitcoinbaby/bitcoin";
import type { TransactionDisplay } from "@bitcoinbaby/ui";

/**
 * Extended transaction info from Mempool API
 */
interface ExtendedTransactionInfo extends TransactionInfo {
  vin: Array<{
    txid: string;
    vout: number;
    prevout?: {
      scriptpubkey_address?: string;
      value: number;
    };
    witness?: string[];
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address?: string;
    scriptpubkey_type: string;
    value: number;
  }>;
}

/**
 * Hook state
 */
export interface TransactionHistoryState {
  /** Processed transactions ready for display */
  transactions: TransactionDisplay[];
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether more transactions are being loaded */
  isLoadingMore: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether more transactions can be loaded */
  hasMore: boolean;
  /** Current block height (for confirmation calculation) */
  currentBlockHeight: number | null;
  /** Last refresh timestamp */
  lastUpdated: number | null;
}

/**
 * Hook actions
 */
export interface TransactionHistoryActions {
  /** Load more transactions (pagination) */
  loadMore: () => Promise<void>;
  /** Refresh all transactions */
  refresh: () => Promise<void>;
}

export type UseTransactionHistoryReturn = TransactionHistoryState &
  TransactionHistoryActions;

/**
 * Hook options
 */
export interface UseTransactionHistoryOptions {
  /** Bitcoin address to fetch transactions for */
  address: string | undefined;
  /** Network to use */
  network: BitcoinNetwork;
  /** Whether to auto-refresh periodically */
  autoRefresh?: boolean;
  /** Auto-refresh interval in ms (default: 60000) */
  refreshInterval?: number;
  /** Whether to fetch on mount */
  fetchOnMount?: boolean;
}

const PAGE_SIZE = 25;

function isMiningSubmission(tx: ExtendedTransactionInfo): boolean {
  return tx.vout.some(
    (output) =>
      output.scriptpubkey_type === "op_return" ||
      output.scriptpubkey?.startsWith("6a"),
  );
}

function calculateAmount(
  tx: ExtendedTransactionInfo,
  address: string,
): { amount: number; type: "incoming" | "outgoing" | "self" } {
  const inputSum = tx.vin
    .filter((input) => input.prevout?.scriptpubkey_address === address)
    .reduce((sum, input) => sum + (input.prevout?.value || 0), 0);

  const outputSum = tx.vout
    .filter((output) => output.scriptpubkey_address === address)
    .reduce((sum, output) => sum + output.value, 0);

  const netAmount = outputSum - inputSum;

  let type: "incoming" | "outgoing" | "self";
  if (inputSum === 0 && outputSum > 0) {
    type = "incoming";
  } else if (inputSum > 0 && outputSum === 0) {
    type = "outgoing";
  } else if (inputSum > 0 && outputSum > 0) {
    type = netAmount >= 0 ? "self" : "outgoing";
  } else {
    type = "incoming";
  }

  return { amount: netAmount, type };
}

function processTransaction(
  tx: ExtendedTransactionInfo,
  address: string,
  currentBlockHeight: number | null,
): TransactionDisplay {
  const { amount, type } = calculateAmount(tx, address);

  let confirmations = 0;
  if (tx.status.confirmed && tx.status.block_height && currentBlockHeight) {
    confirmations = currentBlockHeight - tx.status.block_height + 1;
  }

  return {
    txid: tx.txid,
    amount: Math.abs(amount),
    confirmations,
    timestamp: tx.status.block_time || null,
    fee: tx.fee,
    type,
    isMiningSubmission: isMiningSubmission(tx),
  };
}

/**
 * useTransactionHistory Hook — TanStack Query with infinite pagination
 */
export function useTransactionHistory(
  options: UseTransactionHistoryOptions,
): UseTransactionHistoryReturn {
  const {
    address,
    network,
    autoRefresh = false,
    refreshInterval = 60000,
    fetchOnMount = true,
  } = options;

  const clientRef = useRef(createMempoolClient({ network }));

  useEffect(() => {
    clientRef.current = createMempoolClient({ network });
  }, [network]);

  // ---- Block height query (needed for confirmation calculation) ----
  const { data: blockHeight } = useQuery({
    queryKey: ["block-height", network],
    queryFn: async () => {
      try {
        return await clientRef.current.getBlockHeight();
      } catch {
        return null;
      }
    },
    staleTime: 60_000, // Block height changes slowly
    enabled: !!address,
  });

  // ---- Infinite query for transactions ----
  const {
    data,
    isLoading,
    isFetchingNextPage,
    error: queryError,
    hasNextPage,
    fetchNextPage,
    refetch,
    dataUpdatedAt,
  } = useInfiniteQuery({
    queryKey: ["tx-history", address, network],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      if (!address) return { txs: [], nextCursor: undefined };
      const rawTxs = (await clientRef.current.getAddressTransactions(
        address,
        pageParam,
      )) as ExtendedTransactionInfo[];
      const processed = rawTxs.map((tx) =>
        processTransaction(tx, address, blockHeight ?? null),
      );
      const nextCursor =
        rawTxs.length >= PAGE_SIZE
          ? rawTxs[rawTxs.length - 1]?.txid
          : undefined;
      return { txs: processed, nextCursor };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!address && fetchOnMount,
    refetchInterval: autoRefresh && address ? refreshInterval : false,
    placeholderData: (prev) => prev,
  });

  // Flatten all pages into a single array
  const transactions = data?.pages.flatMap((page) => page.txs) ?? [];

  const loadMore = useCallback(async (): Promise<void> => {
    if (hasNextPage && !isFetchingNextPage) {
      await fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const refresh = useCallback(async (): Promise<void> => {
    await refetch();
  }, [refetch]);

  return {
    transactions,
    isLoading,
    isLoadingMore: isFetchingNextPage,
    error: queryError instanceof Error ? queryError.message : null,
    hasMore: hasNextPage,
    currentBlockHeight: blockHeight ?? null,
    lastUpdated: dataUpdatedAt ?? null,
    loadMore,
    refresh,
  };
}
