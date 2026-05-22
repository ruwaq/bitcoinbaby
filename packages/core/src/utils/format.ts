/**
 * Formatting utilities for common values across the app
 */

/**
 * Format hashrate to human-readable string
 * @param h - Speed in T/s
 * @returns Formatted string like "1.5 MT/s", "250 KT/s", or "500 T/s"
 */
export function formatHashrate(h: number): string {
  if (h >= 1_000_000_000) return `${(h / 1_000_000_000).toFixed(2)} GT/s`;
  if (h >= 1_000_000) return `${(h / 1_000_000).toFixed(2)} MT/s`;
  if (h >= 1_000) return `${(h / 1_000).toFixed(2)} KT/s`;
  return `${h.toFixed(1)} T/s`;
}

/**
 * Format total count (hashes, shares, etc) to human-readable string
 * @param n - Number to format
 * @returns Formatted string like "1.5M", "250K", or "500"
 */
export function formatTotal(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

/**
 * Format duration in seconds to human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "2h 30m 15s" or "5m 30s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }
  return `${minutes}m ${secs}s`;
}

/**
 * Format duration in seconds to time format (HH:MM:SS)
 * @param seconds - Duration in seconds
 * @returns Formatted string like "02:30:15" or "00:05:30"
 */
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Number of bytes
 * @returns Formatted string like "1.5 GB", "250 MB", or "500 KB"
 */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(2)} KB`;
  return `${bytes} B`;
}
