/**
 * Wallet Store
 *
 * Manages wallet state, connection, and transaction signing.
 *
 * Uses a finite state machine internally to:
 * - Prevent invalid state transitions
 * - Auto-timeout zombie states (stuck in connecting/unlocking)
 * - Provide better debugging
 */

import { create } from "zustand";
import type { WalletInfo } from "../types";
import {
  createStateMachine,
  WALLET_STATE_CONFIG,
  type WalletState,
  type WalletEvent,
  type StateMachineInstance,
} from "@bitcoinbaby/shared";

// =============================================================================
// TYPES
// =============================================================================

export type SignPsbtFn = (psbtHex: string) => Promise<string | null>;
export type BroadcastTxFn = (txHex: string) => Promise<string | null>;
export type CleanupFn = () => void;
export type UnregisterFn = () => void;

// Counter for generating unique cleanup IDs
let cleanupIdCounter = 0;

// Singleton state machine instance
let walletStateMachine: StateMachineInstance<WalletState, WalletEvent> | null =
  null;

function getWalletStateMachine(): StateMachineInstance<
  WalletState,
  WalletEvent
> {
  if (!walletStateMachine) {
    walletStateMachine = createStateMachine({
      ...WALLET_STATE_CONFIG,
      onTransition: (from, to, event) => {
        console.debug(`[WalletStore] State: ${from} -> ${to} (${event})`);
      },
      onInvalidTransition: (from, event) => {
        console.warn(
          `[WalletStore] Invalid transition: ${from} + ${event} (ignored)`,
        );
      },
    });
  }
  return walletStateMachine;
}

interface WalletStore {
  // State
  wallet: WalletInfo | null;
  isConnected: boolean;
  isLoading: boolean;
  isLocked: boolean;
  error: string | null;

  // Formal state machine state (for debugging and state guards)
  connectionState: WalletState;

  // Signing functions (set by wallet provider)
  signPsbt: SignPsbtFn | null;
  broadcastTx: BroadcastTxFn | null;

  // Cleanup callbacks for external subscriptions (Map for O(1) removal)
  cleanupCallbacks: Map<number, CleanupFn>;

  // Actions
  setWallet: (wallet: WalletInfo) => void;
  startConnecting: () => void; // New: explicitly start connection
  disconnect: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLocked: (locked: boolean) => void;
  updateBalance: (balance: bigint) => void;
  updateBabyTokens: (tokens: bigint) => void;

  // Signing setup
  setSigningFunctions: (
    signPsbt: SignPsbtFn,
    broadcastTx?: BroadcastTxFn,
  ) => void;

  // Cleanup registration - returns unregister function to prevent memory leaks
  registerCleanup: (cleanup: CleanupFn) => UnregisterFn;

  // State machine helpers
  canTransition: (event: WalletEvent) => boolean;
  getStateMachineState: () => WalletState;
}

// =============================================================================
// STORE
// =============================================================================

export const useWalletStore = create<WalletStore>((set, get) => {
  // Get state machine (creates singleton if needed)
  const sm = getWalletStateMachine();

  return {
    // Initial state
    wallet: null,
    isConnected: false,
    isLoading: false,
    isLocked: true,
    error: null,
    connectionState: "idle",
    signPsbt: null,
    broadcastTx: null,
    cleanupCallbacks: new Map(),

    // Start connecting (triggers state machine transition)
    startConnecting: () => {
      if (sm.can("CONNECT")) {
        sm.transition("CONNECT");
        set({
          isLoading: true,
          error: null,
          connectionState: "connecting",
        });
      }
    },

    // Set wallet (after successful connection/unlock)
    setWallet: (wallet) => {
      // Transition state machine
      if (sm.can("SUCCESS")) {
        sm.transition("SUCCESS");
      }

      set({
        wallet,
        isConnected: true,
        isLoading: false,
        isLocked: false,
        error: null,
        connectionState: "connected",
      });
    },

    // Disconnect/lock wallet - run all cleanup callbacks first
    disconnect: () => {
      const state = get();

      // Transition state machine
      if (sm.can("DISCONNECT")) {
        sm.transition("DISCONNECT").then(() => {
          // After disconnecting finishes, transition to idle
          if (sm.can("SUCCESS")) {
            sm.transition("SUCCESS");
          }
        });
      } else {
        // Force reset if in invalid state
        sm.reset();
      }

      // Run all cleanup callbacks to prevent memory leaks
      state.cleanupCallbacks.forEach((cleanup, id) => {
        try {
          cleanup();
        } catch (e) {
          console.warn(`[WalletStore] Cleanup error (id=${id}):`, e);
        }
      });

      set({
        wallet: null,
        isConnected: false,
        isLocked: true,
        error: null,
        connectionState: "idle",
        signPsbt: null,
        broadcastTx: null,
        cleanupCallbacks: new Map(),
      });
    },

    // Loading state
    setLoading: (isLoading) => set({ isLoading }),

    // Error state
    setError: (error) => {
      // Transition to error state in state machine
      if (error && sm.can("FAILURE")) {
        sm.transition("FAILURE");
      }

      set({
        error,
        isLoading: false,
        connectionState: error ? "error" : get().connectionState,
      });
    },

    // Lock state (without full disconnect)
    // CRITICAL: When locking, also clear signing functions to prevent
    // attempts to sign with a locked wallet
    setLocked: (isLocked) => {
      // Transition state machine
      if (isLocked && sm.can("LOCK")) {
        sm.transition("LOCK");
      } else if (!isLocked && sm.can("UNLOCK")) {
        sm.transition("UNLOCK");
      }

      set((s) => ({
        isLocked,
        connectionState: isLocked ? "locked" : s.connectionState,
        // Clear signing functions when locking (not when unlocking)
        ...(isLocked
          ? {
              signPsbt: null,
              broadcastTx: null,
            }
          : {}),
      }));
    },

    // Update BTC balance (with race condition protection)
    updateBalance: (balance) =>
      set((s) => {
        if (!s.wallet || !s.isConnected) {
          console.warn(
            "[WalletStore] Attempted balance update on disconnected wallet",
          );
          return s;
        }
        return { wallet: { ...s.wallet, balance } };
      }),

    // Update BABY token balance (with race condition protection)
    updateBabyTokens: (babyTokens) =>
      set((s) => {
        if (!s.wallet || !s.isConnected) {
          console.warn(
            "[WalletStore] Attempted token update on disconnected wallet",
          );
          return s;
        }
        return { wallet: { ...s.wallet, babyTokens } };
      }),

    // Set signing functions (called by wallet provider after connection)
    setSigningFunctions: (signPsbt, broadcastTx) =>
      set({
        signPsbt,
        broadcastTx: broadcastTx || null,
      }),

    // Register a cleanup callback to run on disconnect
    // Returns an unregister function - MUST be called in useEffect cleanup
    registerCleanup: (cleanup) => {
      const id = ++cleanupIdCounter;

      set((s) => {
        const newCallbacks = new Map(s.cleanupCallbacks);
        newCallbacks.set(id, cleanup);
        return { cleanupCallbacks: newCallbacks };
      });

      // Return unregister function
      return () => {
        set((s) => {
          const newCallbacks = new Map(s.cleanupCallbacks);
          newCallbacks.delete(id);
          return { cleanupCallbacks: newCallbacks };
        });
      };
    },

    // State machine helpers
    canTransition: (event: WalletEvent) => sm.can(event),
    getStateMachineState: () => sm.getState(),
  };
});
