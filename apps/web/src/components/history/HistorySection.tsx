"use client";

/**
 * HistorySection - Reusable Transaction History Interface
 *
 * Displays complete transaction history for the connected wallet.
 * Features:
 * - Full transaction list with filters
 * - Incoming vs outgoing indicators
 * - Pending vs confirmed status
 * - Block explorer links
 *
 * Used by both HistorySheet (overlay) and history page.
 */

import { useState, useMemo } from "react";
import { useWallet, useTransactionHistory } from "@/hooks";
import {
  TransactionList,
  NetworkBadge,
  type TransactionDisplay,
} from "@bitcoinbaby/ui";
import { useNetworkStore } from "@bitcoinbaby/core";
import { satsToBtc } from "@/utils/format";

/**
 * Filter options for transaction list
 */
type TransactionFilter = "all" | "incoming" | "outgoing" | "pending";

/**
 * Filter button component
 */
function FilterButton({
  label,
  isActive,
  count,
  onClick,
}: {
  label: string;
  isActive: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2 py-1
        font-pixel text-[7px] uppercase
        border-2 border-black
        transition-all
        ${
          isActive
            ? "bg-pixel-primary text-black shadow-[2px_2px_0_0_#000]"
            : "bg-pixel-bg-dark text-pixel-text hover:bg-pixel-bg-light"
        }
      `}
    >
      {label} ({count})
    </button>
  );
}

/**
 * Statistics card component
 */
function StatCard({
  label,
  value,
  subValue,
  color = "text-pixel-text",
}: {
  label: string;
  value: string;
  subValue?: string;
  color?: string;
}) {
  return (
    <div className="bg-pixel-bg-dark p-2 border-2 border-black">
      <label className="font-pixel text-[6px] text-pixel-text-muted block mb-0.5">
        {label}
      </label>
      <span className={`font-pixel text-xs ${color}`}>{value}</span>
      {subValue && (
        <span className="font-pixel text-[6px] text-pixel-text-muted block mt-0.5">
          {subValue}
        </span>
      )}
    </div>
  );
}

export function HistorySection() {
  // Network configuration
  const { network, config } = useNetworkStore();

  // Wallet state
  const { wallet, isLocked, hasStoredWallet } = useWallet();

  // Transaction history
  const {
    transactions,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    currentBlockHeight,
    lastUpdated,
  } = useTransactionHistory({
    address: wallet?.address,
    network,
    autoRefresh: true,
    refreshInterval: 60000, // Refresh every minute
  });

  // Filter state
  const [filter, setFilter] = useState<TransactionFilter>("all");

  // Calculate statistics
  const stats = useMemo(() => {
    const incoming = transactions.filter((tx) => tx.type === "incoming");
    const outgoing = transactions.filter((tx) => tx.type === "outgoing");
    const pending = transactions.filter((tx) => tx.confirmations === 0);

    const totalReceived = incoming.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSent = outgoing.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalCount: transactions.length,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      pendingCount: pending.length,
      totalReceived,
      totalSent,
    };
  }, [transactions]);

  // Filter transactions
  const filteredTransactions = useMemo((): TransactionDisplay[] => {
    switch (filter) {
      case "incoming":
        return transactions.filter((tx) => tx.type === "incoming");
      case "outgoing":
        return transactions.filter((tx) => tx.type === "outgoing");
      case "pending":
        return transactions.filter((tx) => tx.confirmations === 0);
      default:
        return transactions;
    }
  }, [transactions, filter]);

  // No wallet state
  if (!hasStoredWallet) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-pixel-bg-light border-4 border-pixel-border">
          <span className="font-pixel text-2xl text-pixel-text-muted">?</span>
        </div>
        <h2 className="font-pixel text-sm text-pixel-primary mb-2">
          NO WALLET FOUND
        </h2>
        <p className="font-pixel-body text-xs text-pixel-text-muted">
          Create or import a wallet to view transaction history
        </p>
      </div>
    );
  }

  // Locked wallet state
  if (isLocked) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
          <span className="font-pixel text-2xl text-pixel-error">LOCK</span>
        </div>
        <h2 className="font-pixel text-sm text-pixel-primary mb-2">
          WALLET LOCKED
        </h2>
        <p className="font-pixel-body text-xs text-pixel-text-muted">
          Unlock your wallet to view history
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <NetworkBadge network={network} />
          {currentBlockHeight && (
            <span className="font-pixel text-[7px] text-pixel-secondary">
              Block #{currentBlockHeight.toLocaleString()}
            </span>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50"
        >
          {isLoading ? "..." : "REFRESH"}
        </button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          label="RECEIVED"
          value={`${satsToBtc(stats.totalReceived)}`}
          subValue={`${stats.incomingCount} txs`}
          color="text-pixel-success"
        />
        <StatCard
          label="SENT"
          value={`${satsToBtc(stats.totalSent)}`}
          subValue={`${stats.outgoingCount} txs`}
          color="text-pixel-error"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        <FilterButton
          label="ALL"
          isActive={filter === "all"}
          count={stats.totalCount}
          onClick={() => setFilter("all")}
        />
        <FilterButton
          label="IN"
          isActive={filter === "incoming"}
          count={stats.incomingCount}
          onClick={() => setFilter("incoming")}
        />
        <FilterButton
          label="OUT"
          isActive={filter === "outgoing"}
          count={stats.outgoingCount}
          onClick={() => setFilter("outgoing")}
        />
        <FilterButton
          label="PENDING"
          isActive={filter === "pending"}
          count={stats.pendingCount}
          onClick={() => setFilter("pending")}
        />
      </div>

      {/* Transaction List */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore && filter === "all"} // Only show load more for unfiltered
        onLoadMore={loadMore}
        explorerUrl={config.explorerUrl}
        currentBlockHeight={currentBlockHeight ?? undefined}
      />

      {/* Last updated */}
      {lastUpdated && (
        <p className="font-pixel text-[6px] text-pixel-text-muted text-center">
          Updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* Explorer link */}
      {wallet?.address && (
        <a
          href={`${config.explorerUrl}/address/${wallet.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center font-pixel text-[8px] text-pixel-secondary hover:text-pixel-primary underline"
        >
          View on Explorer
        </a>
      )}
    </div>
  );
}

export default HistorySection;
