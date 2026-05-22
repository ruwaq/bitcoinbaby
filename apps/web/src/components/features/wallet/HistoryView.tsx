"use client";

/**
 * HistoryView - Reusable Transaction History component for SPA wallet dashboard
 */

import { useState, useMemo } from "react";
import { useWallet, useTransactionHistory } from "@/hooks";
import {
  TransactionList,
  NetworkBadge,
  pixelShadows,
  pixelBorders,
  type TransactionDisplay,
} from "@bitcoinbaby/ui";
import { useNetworkStore } from "@bitcoinbaby/core";
import { satsToBtc } from "@/utils/format";

type TransactionFilter = "all" | "incoming" | "outgoing" | "mining" | "pending";

interface HistoryViewProps {
  onBack: () => void;
}

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
      role="radio"
      aria-checked={isActive}
      aria-label={`Filter by ${label.toLowerCase()}: ${count} transactions`}
      className={`
        px-2.5 py-1
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

export function HistoryView({ onBack }: HistoryViewProps) {
  const { network, config } = useNetworkStore();
  const { wallet, isLocked } = useWallet();

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
    refreshInterval: 60000,
  });

  const [filter, setFilter] = useState<TransactionFilter>("all");

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b-2 border-pixel-border">
        <div>
          <h2 className="font-pixel text-md text-pixel-primary">
            TRANSACTION HISTORY
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-pixel text-[8px] text-pixel-text-muted">
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
        </div>
        <div className="flex items-center gap-2">
          <NetworkBadge network={network} />
          <button
            onClick={onBack}
            className="font-pixel text-pixel-2xs text-pixel-text-muted hover:text-pixel-primary transition-colors border-2 border-pixel-border px-2 py-1 bg-pixel-bg-medium"
          >
            ← BACK
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard
          label="TOTAL TXS"
          value={stats.totalCount.toString()}
          subValue={`${stats.pendingCount} pending`}
        />
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
        <StatCard
          label="MINING"
          value={stats.miningCount.toString()}
          subValue="submissions"
          color="text-pixel-primary"
        />
      </div>

      {/* Filters */}
      <div
        className="flex flex-wrap gap-2 items-center"
        role="radiogroup"
        aria-label="Transaction filters"
      >
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

        <button
          onClick={refresh}
          disabled={isLoading}
          aria-label="Refresh transaction list"
          className="ml-auto px-2 py-1 font-pixel text-[8px] text-pixel-text-muted hover:text-pixel-primary disabled:opacity-50"
        >
          {isLoading ? "..." : "REFRESH"}
        </button>
      </div>

      {/* Transaction List */}
      <TransactionList
        transactions={filteredTransactions}
        isLoading={isLoading}
        error={error}
        hasMore={hasMore && filter === "all"}
        onLoadMore={loadMore}
        onRetry={refresh}
        explorerUrl={config.explorerUrl}
        currentBlockHeight={currentBlockHeight ?? undefined}
      />

      {/* Last updated */}
      {lastUpdated && (
        <p className="font-pixel text-[8px] text-pixel-text-muted text-center">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      )}

      {/* Footer Explorer Link */}
      <div className="text-center pt-2">
        <a
          href={`${config.explorerUrl}/address/${wallet?.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-[8px] text-pixel-secondary hover:text-pixel-primary underline"
        >
          View on Explorer
        </a>
      </div>
    </div>
  );
}
