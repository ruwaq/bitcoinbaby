"use client";

/**
 * Transaction History Page
 *
 * Displays complete transaction history for the connected wallet.
 * Features:
 * - Full transaction list with pagination
 * - Incoming vs outgoing indicators
 * - Pending vs confirmed status
 * - Mining submissions highlighted separately
 * - Block explorer links
 */

import { useState, useMemo } from "react";
import Link from "next/link";
import { useWallet, useTransactionHistory } from "@/hooks";
import {
  TransactionList,
  NetworkBadge,
  pixelShadows,
  pixelBorders,
  type TransactionDisplay,
} from "@bitcoinbaby/ui";
import { useNetworkStore } from "@bitcoinbaby/core";

/**
 * Filter options for transaction list
 */
type TransactionFilter = "all" | "incoming" | "outgoing" | "mining" | "pending";

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
        px-3 py-1.5
        font-pixel text-[8px] uppercase
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
    <div className="bg-pixel-bg-dark p-3 border-2 border-black">
      <label className="font-pixel text-[8px] text-pixel-text-muted block mb-1">
        {label}
      </label>
      <span className={`font-pixel text-sm ${color}`}>{value}</span>
      {subValue && (
        <span className="font-pixel text-[8px] text-pixel-text-muted block mt-0.5">
          {subValue}
        </span>
      )}
    </div>
  );
}

export default function TransactionHistoryPage() {
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
    const mining = transactions.filter((tx) => tx.isMiningSubmission);

    const totalReceived = incoming.reduce((sum, tx) => sum + tx.amount, 0);
    const totalSent = outgoing.reduce((sum, tx) => sum + tx.amount, 0);

    return {
      totalCount: transactions.length,
      incomingCount: incoming.length,
      outgoingCount: outgoing.length,
      pendingCount: pending.length,
      miningCount: mining.length,
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
      case "mining":
        return transactions.filter((tx) => tx.isMiningSubmission);
      case "pending":
        return transactions.filter((tx) => tx.confirmations === 0);
      default:
        return transactions;
    }
  }, [transactions, filter]);

  // Format BTC value
  const formatBtc = (sats: number): string => {
    return (sats / 100_000_000).toFixed(8);
  };

  // Wallet not connected state
  if (!hasStoredWallet) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-pixel-bg-light border-4 border-black">
              <span className="font-pixel text-3xl text-pixel-text-muted">
                ?
              </span>
            </div>
            <h2 className="font-pixel text-lg text-pixel-text mb-4">
              NO WALLET CONNECTED
            </h2>
            <p className="font-pixel-body text-sm text-pixel-text-muted mb-8">
              Create or import a wallet to view your transaction history.
            </p>
            <Link
              href="/wallet"
              className={`inline-block px-6 py-3 font-pixel text-sm bg-pixel-primary text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
            >
              GO TO WALLET
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Wallet locked state
  if (isLocked) {
    return (
      <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
              <span className="font-pixel text-3xl text-pixel-error">X</span>
            </div>
            <h2 className="font-pixel text-lg text-pixel-text mb-4">
              WALLET LOCKED
            </h2>
            <p className="font-pixel-body text-sm text-pixel-text-muted mb-8">
              Unlock your wallet to view transaction history.
            </p>
            <Link
              href="/wallet"
              className={`inline-block px-6 py-3 font-pixel text-sm bg-pixel-success text-black ${pixelBorders.thick} ${pixelShadows.md} hover:translate-x-[2px] hover:translate-y-[2px] ${pixelShadows.smHover} transition-all`}
            >
              UNLOCK WALLET
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-pixel-bg-dark">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-pixel text-xl text-pixel-primary">
              TRANSACTION HISTORY
            </h1>
            <div className="flex items-center gap-3">
              <NetworkBadge network={network} />
              <Link
                href="/wallet"
                className="font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary"
              >
                BACK
              </Link>
            </div>
          </div>

          {/* Address */}
          <div className="flex items-center gap-2">
            <span className="font-pixel text-[10px] text-pixel-text-muted">
              {wallet?.address
                ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-8)}`
                : ""}
            </span>
            {currentBlockHeight && (
              <span className="font-pixel text-[8px] text-pixel-secondary">
                Block #{currentBlockHeight.toLocaleString()}
              </span>
            )}
          </div>
        </header>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
          <StatCard
            label="TOTAL TXS"
            value={stats.totalCount.toString()}
            subValue={`${stats.pendingCount} pending`}
          />
          <StatCard
            label="RECEIVED"
            value={`${formatBtc(stats.totalReceived)}`}
            subValue={`${stats.incomingCount} txs`}
            color="text-pixel-success"
          />
          <StatCard
            label="SENT"
            value={`${formatBtc(stats.totalSent)}`}
            subValue={`${stats.outgoingCount} txs`}
            color="text-pixel-error"
          />
          <StatCard
            label="MINING"
            value={stats.miningCount.toString()}
            subValue="submissions"
            color="text-pixel-primary"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          <FilterButton
            label="ALL"
            isActive={filter === "all"}
            count={stats.totalCount}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            label="INCOMING"
            isActive={filter === "incoming"}
            count={stats.incomingCount}
            onClick={() => setFilter("incoming")}
          />
          <FilterButton
            label="OUTGOING"
            isActive={filter === "outgoing"}
            count={stats.outgoingCount}
            onClick={() => setFilter("outgoing")}
          />
          <FilterButton
            label="MINING"
            isActive={filter === "mining"}
            count={stats.miningCount}
            onClick={() => setFilter("mining")}
          />
          <FilterButton
            label="PENDING"
            isActive={filter === "pending"}
            count={stats.pendingCount}
            onClick={() => setFilter("pending")}
          />

          {/* Refresh button */}
          <button
            onClick={refresh}
            disabled={isLoading}
            className="ml-auto px-3 py-1.5 font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50"
          >
            {isLoading ? "..." : "REFRESH"}
          </button>
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
          <p className="font-pixel text-[8px] text-pixel-text-muted text-center mt-4">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}

        {/* Footer links */}
        <div className="flex justify-center gap-4 mt-6 pt-4 border-t-2 border-dashed border-pixel-border">
          <a
            href={`${config.explorerUrl}/address/${wallet?.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[10px] text-pixel-secondary hover:text-pixel-primary underline"
          >
            View on Explorer
          </a>
          <Link
            href="/wallet/send"
            className="font-pixel text-[10px] text-pixel-secondary hover:text-pixel-primary underline"
          >
            Send Bitcoin
          </Link>
        </div>
      </div>
    </main>
  );
}
