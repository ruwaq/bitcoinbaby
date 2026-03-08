/**
 * Screen Wake Lock
 *
 * Prevents the screen from dimming or locking while mining.
 * Useful for users who want to monitor mining progress.
 *
 * The wake lock is automatically released when:
 * - Tab goes to background
 * - User switches apps
 * - System goes to sleep
 *
 * We re-acquire it when the tab becomes visible again.
 */

// =============================================================================
// TYPES
// =============================================================================

import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("WakeLock");

export interface WakeLockStatus {
  isActive: boolean;
  isSupported: boolean;
  lastAcquired: number | null;
  lastReleased: number | null;
}

// =============================================================================
// WAKE LOCK CLASS
// =============================================================================

export class MiningWakeLock {
  private wakeLock: WakeLockSentinel | null = null;
  private lastAcquired: number | null = null;
  private lastReleased: number | null = null;
  private visibilityHandler: (() => void) | null = null;
  private autoReacquire = true;

  /**
   * Check if Wake Lock API is supported
   */
  static isSupported(): boolean {
    return (
      typeof navigator !== "undefined" &&
      "wakeLock" in navigator &&
      typeof navigator.wakeLock?.request === "function"
    );
  }

  /**
   * Acquire the wake lock
   * @returns true if successfully acquired
   */
  async acquire(): Promise<boolean> {
    if (!MiningWakeLock.isSupported()) {
      log.warn("API not supported on this device");
      return false;
    }

    // Can't acquire if document is not visible
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      log.warn("Cannot acquire - document not visible");
      return false;
    }

    // Already acquired
    if (this.wakeLock && !this.wakeLock.released) {
      return true;
    }

    try {
      this.wakeLock = await navigator.wakeLock.request("screen");
      this.lastAcquired = Date.now();

      // Handle automatic release by browser
      this.wakeLock.addEventListener("release", () => {
        this.lastReleased = Date.now();
        log.debug("Released by browser");
        this.wakeLock = null;
      });

      log.debug("Screen wake lock acquired");
      return true;
    } catch (err) {
      // Common reasons for failure:
      // - Document not visible
      // - Low battery mode
      // - User denied permission
      // - System policy
      log.warn("Failed to acquire", { error: err });
      return false;
    }
  }

  /**
   * Release the wake lock
   */
  async release(): Promise<void> {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
        this.wakeLock = null;
        this.lastReleased = Date.now();
        log.debug("Released manually");
      } catch {
        // Already released
      }
    }
  }

  /**
   * Enable automatic re-acquisition when tab becomes visible
   */
  enableAutoReacquire(): void {
    if (typeof document === "undefined") return;

    this.autoReacquire = true;

    if (this.visibilityHandler) return;

    this.visibilityHandler = async () => {
      if (document.visibilityState === "visible" && this.autoReacquire) {
        // Small delay to ensure document is fully visible
        await new Promise((r) => setTimeout(r, 100));
        await this.acquire();
      }
    };

    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  /**
   * Disable automatic re-acquisition
   */
  disableAutoReacquire(): void {
    this.autoReacquire = false;

    if (this.visibilityHandler) {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
  }

  /**
   * Check if wake lock is currently active
   */
  isActive(): boolean {
    return this.wakeLock !== null && !this.wakeLock.released;
  }

  /**
   * Get current status
   */
  getStatus(): WakeLockStatus {
    return {
      isActive: this.isActive(),
      isSupported: MiningWakeLock.isSupported(),
      lastAcquired: this.lastAcquired,
      lastReleased: this.lastReleased,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.disableAutoReacquire();
    this.release();
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let wakeLockInstance: MiningWakeLock | null = null;

export function getMiningWakeLock(): MiningWakeLock {
  if (!wakeLockInstance) {
    wakeLockInstance = new MiningWakeLock();
  }
  return wakeLockInstance;
}

export function destroyMiningWakeLock(): void {
  wakeLockInstance?.destroy();
  wakeLockInstance = null;
}
