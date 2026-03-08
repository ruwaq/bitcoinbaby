/**
 * Tab Coordinator using Web Locks API
 *
 * Ensures only ONE tab mines at a time to prevent:
 * - Wasted CPU (3 tabs = 3x CPU usage for same work)
 * - Duplicate hash submissions
 * - Race conditions
 *
 * Uses Web Locks API for leader election - when a tab closes,
 * another tab automatically becomes the leader.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TabCoordinatorEvents {
  onBecomeLeader?: () => void;
  onLostLeadership?: () => void;
  onWaitingForLeadership?: () => void;
}

import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("TabCoordinator");

export interface TabInfo {
  isLeader: boolean;
  isWaiting: boolean;
  activeTabCount: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const LOCK_NAME = "bitcoinbaby-mining-leader";
const HEARTBEAT_CHANNEL = "bitcoinbaby-mining-heartbeat";

// =============================================================================
// TAB COORDINATOR
// =============================================================================

export class MiningTabCoordinator {
  private isLeader = false;
  private isWaiting = false;
  private releaseLock: (() => void) | null = null;
  private events: TabCoordinatorEvents = {};
  private broadcastChannel: BroadcastChannel | null = null;
  private activeTabCount = 1;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(events: TabCoordinatorEvents = {}) {
    this.events = events;
    this.setupBroadcastChannel();
  }

  /**
   * Check if Web Locks API is supported
   */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "locks" in navigator;
  }

  /**
   * Attempt to become the mining leader
   * Returns immediately if already leader, otherwise waits
   */
  async requestLeadership(): Promise<void> {
    if (!MiningTabCoordinator.isSupported()) {
      log.warn("Web Locks not supported, assuming leader");
      this.isLeader = true;
      this.events.onBecomeLeader?.();
      return;
    }

    if (this.isLeader) {
      return;
    }

    this.isWaiting = true;
    this.events.onWaitingForLeadership?.();
    log.debug("Requesting mining leadership...");

    try {
      await navigator.locks.request(
        LOCK_NAME,
        { mode: "exclusive" },
        async () => {
          this.isLeader = true;
          this.isWaiting = false;
          log.info("This tab is now the mining leader");
          this.events.onBecomeLeader?.();

          // Notify other tabs
          this.broadcastStatus("leader-claimed");

          // Keep the lock until we release it
          return new Promise<void>((resolve) => {
            this.releaseLock = () => {
              this.isLeader = false;
              this.events.onLostLeadership?.();
              this.broadcastStatus("leader-released");
              resolve();
            };
          });
        },
      );
    } catch (err) {
      log.error("Failed to acquire leadership", { error: err });
      this.isWaiting = false;
    }
  }

  /**
   * Release leadership (allows another tab to take over)
   */
  releaseLeadership(): void {
    if (this.releaseLock) {
      log.debug("Releasing leadership");
      this.releaseLock();
      this.releaseLock = null;
    }
  }

  /**
   * Check if another tab currently holds the mining lock
   */
  async isAnotherTabMining(): Promise<boolean> {
    if (!MiningTabCoordinator.isSupported()) {
      return false;
    }

    try {
      const state = await navigator.locks.query();
      return state.held?.some((lock) => lock.name === LOCK_NAME) ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Try to steal leadership (for when user explicitly starts mining in this tab)
   * Note: This doesn't actually "steal" - it just checks availability
   */
  async tryImmediateLeadership(): Promise<boolean> {
    if (!MiningTabCoordinator.isSupported()) {
      this.isLeader = true;
      return true;
    }

    try {
      let acquired = false;

      await navigator.locks.request(
        LOCK_NAME,
        { mode: "exclusive", ifAvailable: true },
        async (lock) => {
          if (lock) {
            acquired = true;
            this.isLeader = true;
            this.events.onBecomeLeader?.();
            this.broadcastStatus("leader-claimed");

            // Keep the lock
            return new Promise<void>((resolve) => {
              this.releaseLock = () => {
                this.isLeader = false;
                this.events.onLostLeadership?.();
                resolve();
              };
            });
          }
        },
      );

      return acquired;
    } catch {
      return false;
    }
  }

  /**
   * Get current tab info
   */
  getInfo(): TabInfo {
    return {
      isLeader: this.isLeader,
      isWaiting: this.isWaiting,
      activeTabCount: this.activeTabCount,
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.releaseLeadership();
    this.stopHeartbeat();
    this.broadcastChannel?.close();
    this.broadcastChannel = null;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private setupBroadcastChannel(): void {
    if (typeof BroadcastChannel === "undefined") return;

    try {
      this.broadcastChannel = new BroadcastChannel(HEARTBEAT_CHANNEL);

      this.broadcastChannel.onmessage = (event) => {
        const { type, tabId } = event.data;

        if (type === "heartbeat") {
          // Track active tabs
          this.handleHeartbeat(tabId);
        } else if (type === "leader-claimed" && !this.isLeader) {
          log.debug("Another tab claimed leadership");
        } else if (type === "leader-released" && this.isWaiting) {
          // Leadership is available, try to claim it
          this.requestLeadership();
        }
      };

      // Start sending heartbeats
      this.startHeartbeat();
    } catch {
      // BroadcastChannel not available
    }
  }

  private broadcastStatus(type: string): void {
    this.broadcastChannel?.postMessage({
      type,
      tabId: this.getTabId(),
      timestamp: Date.now(),
    });
  }

  private startHeartbeat(): void {
    // Send initial heartbeat
    this.broadcastStatus("heartbeat");

    // Send heartbeat every 5 seconds
    this.heartbeatInterval = setInterval(() => {
      this.broadcastStatus("heartbeat");
    }, 5000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private tabHeartbeats = new Map<string, number>();

  private handleHeartbeat(tabId: string): void {
    this.tabHeartbeats.set(tabId, Date.now());

    // Clean up old tabs (no heartbeat in 15 seconds)
    const now = Date.now();
    for (const [id, timestamp] of this.tabHeartbeats.entries()) {
      if (now - timestamp > 15000) {
        this.tabHeartbeats.delete(id);
      }
    }

    this.activeTabCount = this.tabHeartbeats.size;
  }

  private tabId: string | null = null;

  private getTabId(): string {
    if (!this.tabId) {
      this.tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    return this.tabId;
  }
}

// =============================================================================
// SINGLETON
// =============================================================================

let coordinatorInstance: MiningTabCoordinator | null = null;

export function getTabCoordinator(
  events?: TabCoordinatorEvents,
): MiningTabCoordinator {
  if (!coordinatorInstance) {
    coordinatorInstance = new MiningTabCoordinator(events);
  }
  return coordinatorInstance;
}

export function destroyTabCoordinator(): void {
  coordinatorInstance?.destroy();
  coordinatorInstance = null;
}
