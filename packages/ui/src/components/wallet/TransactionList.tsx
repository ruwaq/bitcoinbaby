"use client";

/**
 * TransactionList - Transaction history display component
 *
 * Displays a paginated list of Bitcoin transactions with:
 * - Incoming vs outgoing indicators
 * - Pending vs confirmed status
 * - Block explorer links
 * - Loading and empty states
 *
 * Pixel art styling consistent with BitcoinBaby design.
 */

import { clsx } from "clsx";

/**
 * Transaction display data
 */
export interface TransactionDisplay {
  /** Transaction ID */
  txid: string;
  /** Amount in satoshis (positive = incoming, negative = outgoing) */
  amount: number;
  /** Number of confirmations (0 = pending) */
  confirmations: number;
  /** Transaction timestamp (Unix seconds) */
  timestamp: number | null;
  /** Transaction fee in satoshis */
  fee: number;
  /** Transaction type hint */
  type?: "incoming" | "outgoing" | "self";
  /** Whether this is a mining submission */
  isMiningSubmission?: boolean;
}

interface TransactionListProps {
  /** List of transactions to display */
  transactions: TransactionDisplay[];
  /** Whether transactions are loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Whether more transactions can be loaded */
  hasMore: boolean;
  /** Callback to load more transactions */
  onLoadMore?: () => void;
  /** Callback to retry/refresh when error occurs */
  onRetry?: () => void;
  /** Block explorer base URL */
  explorerUrl: string;
  /** Current block height for confirmation calculation */
  currentBlockHeight?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format satoshis to BTC string
 */
function formatBtc(sats: number): string {
  const btc = Math.abs(sats) / 100_000_000;
  return btc.toFixed(8);
}

/**
 * Format timestamp to readable date
 */
function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return "Pending";
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Truncate transaction ID for display
 */
function truncateTxid(txid: string, chars = 8): string {
  if (txid.length <= chars * 2 + 3) return txid;
  return `${txid.slice(0, chars)}...${txid.slice(-chars)}`;
}

/**
 * Get confirmation status text
 */
function getConfirmationText(confirmations: number): string {
  if (confirmations === 0) return "PENDING";
  if (confirmations === 1) return "1 CONF";
  if (confirmations < 6) return `${confirmations} CONFS`;
  return "CONFIRMED";
}

/**
 * Single transaction row component
 */
function TransactionRow({
  tx,
  explorerUrl,
}: {
  tx: TransactionDisplay;
  explorerUrl: string;
}) {
  const isIncoming = tx.amount > 0;
  const isPending = tx.confirmations === 0;
  const isConfirmed = tx.confirmations >= 6;

  return (
    <div
      className={clsx(
        "flex items-center gap-3 p-3",
        "border-2 border-black",
        "bg-pixel-bg-dark",
        isPending && "animate-pulse",
      )}
    >
      {/* Direction Icon */}
      <div
        className={clsx(
          "w-10 h-10 flex items-center justify-center",
          "border-2 border-black",
          "flex-shrink-0",
          isIncoming ? "bg-pixel-success" : "bg-pixel-error",
        )}
      >
        <span className="font-pixel text-sm text-black">
          {tx.isMiningSubmission ? "M" : isIncoming ? "+" : "-"}
        </span>
      </div>

      {/* Transaction Info */}
      <div className="flex-1 min-w-0">
        {/* TXID */}
        <a
          href={`${explorerUrl}/tx/${tx.txid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-pixel text-[10px] text-pixel-secondary hover:text-pixel-primary underline truncate block"
        >
          {truncateTxid(tx.txid)}
        </a>

        {/* Timestamp and Type */}
        <div className="flex items-center gap-2 mt-1">
          <span className="font-pixel text-[8px] text-pixel-text-muted">
            {formatTimestamp(tx.timestamp)}
          </span>
          {tx.isMiningSubmission && (
            <span className="px-1 py-0.5 font-pixel text-[6px] bg-pixel-primary text-black border border-black">
              MINING
            </span>
          )}
        </div>
      </div>

      {/* Amount and Status */}
      <div className="text-right flex-shrink-0">
        {/* Amount */}
        <div
          className={clsx(
            "font-pixel text-sm",
            isIncoming ? "text-pixel-success" : "text-pixel-error",
          )}
        >
          {isIncoming ? "+" : "-"}
          {formatBtc(tx.amount)} BTC
        </div>

        {/* Confirmation Status */}
        <div
          className={clsx(
            "font-pixel text-[8px] mt-1",
            isPending
              ? "text-pixel-warning"
              : isConfirmed
                ? "text-pixel-success"
                : "text-pixel-secondary",
          )}
        >
          {getConfirmationText(tx.confirmations)}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading skeleton for transaction row
 */
function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 border-2 border-black bg-pixel-bg-dark animate-pulse">
      {/* Icon placeholder */}
      <div className="w-10 h-10 bg-pixel-bg-light border-2 border-black" />

      {/* Content placeholder */}
      <div className="flex-1">
        <div className="h-3 w-32 bg-pixel-bg-light mb-2" />
        <div className="h-2 w-20 bg-pixel-bg-light" />
      </div>

      {/* Amount placeholder */}
      <div className="text-right">
        <div className="h-4 w-24 bg-pixel-bg-light mb-1" />
        <div className="h-2 w-16 bg-pixel-bg-light" />
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-pixel-bg-light border-4 border-black">
        <span className="font-pixel text-2xl text-pixel-text-muted">?</span>
      </div>
      <h3 className="font-pixel text-sm text-pixel-text mb-2">
        NO TRANSACTIONS
      </h3>
      <p className="font-pixel-body text-sm text-pixel-text-muted">
        Your transaction history will appear here once you send or receive
        Bitcoin.
      </p>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-pixel-error/20 border-4 border-pixel-error">
        <span className="font-pixel text-2xl text-pixel-error">!</span>
      </div>
      <h3 className="font-pixel text-sm text-pixel-error mb-2">
        FAILED TO LOAD
      </h3>
      <p className="font-pixel-body text-xs text-pixel-text-muted mb-4">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={clsx(
            "px-4 py-2",
            "font-pixel text-[10px] uppercase",
            "bg-pixel-bg-light text-pixel-text",
            "border-2 border-black",
            "shadow-[2px_2px_0_0_#000]",
            "hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_0_#000]",
          )}
        >
          Retry
        </button>
      )}
    </div>
  );
}

/**
 * TransactionList Component
 *
 * @example
 * ```tsx
 * <TransactionList
 *   transactions={txList}
 *   isLoading={false}
 *   error={null}
 *   hasMore={true}
 *   onLoadMore={() => fetchMore()}
 *   explorerUrl="https://mempool.space/testnet4"
 * />
 * ```
 */
export function TransactionList({
  transactions,
  isLoading,
  error,
  hasMore,
  onLoadMore,
  onRetry,
  explorerUrl,
  className,
}: TransactionListProps) {
  // Show loading skeletons
  if (isLoading && transactions.length === 0) {
    return (
      <div className={clsx("space-y-2", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <TransactionSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Show error state (no transactions)
  if (error && transactions.length === 0) {
    return (
      <div
        className={clsx(
          "bg-pixel-bg-medium border-4 border-pixel-border",
          className,
        )}
      >
        <ErrorState message={error} onRetry={onRetry ?? onLoadMore} />
      </div>
    );
  }

  // Show empty state
  if (!isLoading && transactions.length === 0) {
    return (
      <div
        className={clsx(
          "bg-pixel-bg-medium border-4 border-pixel-border",
          className,
        )}
      >
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={clsx("space-y-2", className)}>
      {/* Error banner when we have cached transactions but refresh failed */}
      {error && transactions.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-pixel-error/10 border-2 border-pixel-error">
          <span className="font-pixel text-sm text-pixel-error">!</span>
          <div className="flex-1 min-w-0">
            <p className="font-pixel text-[10px] text-pixel-error">
              REFRESH FAILED
            </p>
            <p className="font-pixel text-[8px] text-pixel-text-muted truncate">
              {error}
            </p>
          </div>
          {(onRetry ?? onLoadMore) && (
            <button
              onClick={onRetry ?? onLoadMore}
              className="px-2 py-1 font-pixel text-[8px] text-pixel-error border border-pixel-error hover:bg-pixel-error/20"
            >
              RETRY
            </button>
          )}
        </div>
      )}

      {/* Transaction List */}
      {transactions.map((tx) => (
        <TransactionRow key={tx.txid} tx={tx} explorerUrl={explorerUrl} />
      ))}

      {/* Load More Button */}
      {hasMore && (
        <button
          onClick={onLoadMore}
          disabled={isLoading}
          className={clsx(
            "w-full py-3",
            "font-pixel text-[10px] uppercase",
            "bg-pixel-bg-medium text-pixel-text",
            "border-2 border-dashed border-pixel-border",
            "hover:bg-pixel-bg-light hover:border-solid",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors",
          )}
        >
          {isLoading ? "LOADING..." : "LOAD MORE"}
        </button>
      )}

      {/* Loading indicator when fetching more */}
      {isLoading && transactions.length > 0 && (
        <div className="flex justify-center py-4">
          <div className="font-pixel text-[10px] text-pixel-text-muted animate-pulse">
            LOADING MORE...
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * TransactionListCompact - Compact version for dashboard widgets
 */
export function TransactionListCompact({
  transactions,
  isLoading,
  explorerUrl,
  maxItems = 3,
  onViewAll,
  className,
}: {
  transactions: TransactionDisplay[];
  isLoading: boolean;
  explorerUrl: string;
  maxItems?: number;
  onViewAll?: () => void;
  className?: string;
}) {
  const displayTxs = transactions.slice(0, maxItems);

  if (isLoading && transactions.length === 0) {
    return (
      <div className={clsx("space-y-1", className)}>
        {Array.from({ length: maxItems }).map((_, i) => (
          <div
            key={i}
            className="h-8 bg-pixel-bg-light border border-black animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={clsx("text-center py-4", className)}>
        <span className="font-pixel text-[8px] text-pixel-text-muted">
          NO RECENT TRANSACTIONS
        </span>
      </div>
    );
  }

  return (
    <div className={clsx("space-y-1", className)}>
      {displayTxs.map((tx) => {
        const isIncoming = tx.amount > 0;
        const isPending = tx.confirmations === 0;

        return (
          <a
            key={tx.txid}
            href={`${explorerUrl}/tx/${tx.txid}`}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "flex items-center gap-2 p-2",
              "border border-black",
              "bg-pixel-bg-dark",
              "hover:bg-pixel-bg-light transition-colors",
              isPending && "opacity-70",
            )}
          >
            <span
              className={clsx(
                "font-pixel text-[10px]",
                isIncoming ? "text-pixel-success" : "text-pixel-error",
              )}
            >
              {isIncoming ? "+" : "-"}
            </span>
            <span className="font-pixel text-[8px] text-pixel-text flex-1 truncate">
              {truncateTxid(tx.txid, 6)}
            </span>
            <span
              className={clsx(
                "font-pixel text-[8px]",
                isIncoming ? "text-pixel-success" : "text-pixel-error",
              )}
            >
              {formatBtc(tx.amount)}
            </span>
          </a>
        );
      })}

      {transactions.length > maxItems && onViewAll && (
        <button
          onClick={onViewAll}
          className="w-full py-1 font-pixel text-[8px] text-pixel-secondary hover:text-pixel-primary"
        >
          VIEW ALL ({transactions.length})
        </button>
      )}
    </div>
  );
}
