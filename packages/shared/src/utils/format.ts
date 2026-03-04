/**
 * Formatting Utilities
 *
 * Common formatting functions for display.
 */

/**
 * Format a number with SI suffixes (K, M, B, T)
 */
export function formatNumber(value: number, decimals = 2): string {
  if (value >= 1_000_000_000_000) {
    return `${(value / 1_000_000_000_000).toFixed(decimals)}T`;
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(decimals)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(decimals)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(decimals)}K`;
  }
  return value.toLocaleString();
}

/**
 * Format hashrate with appropriate unit
 */
export function formatHashrate(hashesPerSecond: number): string {
  if (hashesPerSecond >= 1_000_000_000_000) {
    return `${(hashesPerSecond / 1_000_000_000_000).toFixed(2)} TH/s`;
  }
  if (hashesPerSecond >= 1_000_000_000) {
    return `${(hashesPerSecond / 1_000_000_000).toFixed(2)} GH/s`;
  }
  if (hashesPerSecond >= 1_000_000) {
    return `${(hashesPerSecond / 1_000_000).toFixed(2)} MH/s`;
  }
  if (hashesPerSecond >= 1_000) {
    return `${(hashesPerSecond / 1_000).toFixed(2)} KH/s`;
  }
  return `${hashesPerSecond.toFixed(0)} H/s`;
}

/**
 * Format bytes with appropriate unit
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_099_511_627_776) {
    return `${(bytes / 1_099_511_627_776).toFixed(2)} TB`;
  }
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  }
  if (bytes >= 1_024) {
    return `${(bytes / 1_024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

/**
 * Format satoshis to BTC
 */
export function formatBtc(satoshis: bigint | number, decimals = 8): string {
  const sats = typeof satoshis === "bigint" ? Number(satoshis) : satoshis;
  return (sats / 100_000_000).toFixed(decimals);
}

/**
 * Format satoshis with comma separators
 */
export function formatSatoshis(satoshis: bigint | number): string {
  const sats = typeof satoshis === "bigint" ? satoshis : BigInt(satoshis);
  return sats.toLocaleString();
}

/**
 * Format duration in human-readable form
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;

  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0
      ? `${hours}h ${remainingMinutes}m`
      : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

/**
 * Truncate a string (e.g., addresses) with ellipsis
 */
export function truncate(str: string, startChars = 6, endChars = 4): string {
  if (str.length <= startChars + endChars + 3) return str;
  return `${str.slice(0, startChars)}...${str.slice(-endChars)}`;
}

/**
 * Format a Bitcoin address for display
 */
export function formatAddress(address: string, chars = 6): string {
  return truncate(address, chars, chars);
}

/**
 * Format a transaction ID for display
 */
export function formatTxid(txid: string, chars = 8): string {
  return truncate(txid, chars, chars);
}

/**
 * Format a date relative to now
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 0) return "in the future";
  if (diff < 1000) return "just now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;

  return new Date(timestamp).toLocaleDateString();
}
