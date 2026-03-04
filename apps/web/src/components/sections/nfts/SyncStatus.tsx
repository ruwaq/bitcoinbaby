"use client";

interface SyncStatusProps {
  isFetching: boolean;
  error: string | null;
  lastSynced: number | null;
  onRefresh: () => void;
}

export function SyncStatus({
  isFetching,
  error,
  lastSynced,
  onRefresh,
}: SyncStatusProps) {
  return (
    <div className="flex items-center gap-2">
      {isFetching && (
        <span className="font-pixel text-[7px] text-pixel-secondary animate-pulse">
          Syncing...
        </span>
      )}
      {error && !isFetching && (
        <button
          onClick={onRefresh}
          className="font-pixel text-[8px] text-pixel-error hover:text-pixel-primary bg-pixel-error/20 hover:bg-pixel-primary/20 px-2 py-1 rounded transition-colors"
        >
          Sync failed - Retry
        </button>
      )}
      {!error && (
        <button
          onClick={onRefresh}
          disabled={isFetching}
          className="font-pixel text-[7px] text-pixel-text-muted hover:text-pixel-primary transition-colors disabled:opacity-50"
          title={
            lastSynced
              ? `Last synced: ${new Date(lastSynced).toLocaleTimeString()}`
              : "Never synced"
          }
        >
          ↻ Refresh
        </button>
      )}
    </div>
  );
}
