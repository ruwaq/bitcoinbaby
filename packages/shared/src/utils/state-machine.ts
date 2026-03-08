/**
 * @fileoverview State Machine - Centralized state management for BitcoinBaby
 *
 * Provides type-safe finite state machines for:
 * - Wallet connection states
 * - Transaction lifecycle
 * - Mining states
 *
 * @module @bitcoinbaby/shared/utils/state-machine
 */

export interface StateConfig<S extends string, E extends string> {
  on?: Partial<Record<E, S>>;
  entry?: () => void | Promise<void>;
  exit?: () => void | Promise<void>;
  timeout?: {
    duration: number;
    event: E;
  };
}

export interface StateMachineConfig<S extends string, E extends string> {
  id: string;
  initial: S;
  states: Record<S, StateConfig<S, E>>;
  onTransition?: (from: S, to: S, event: E) => void;
  onInvalidTransition?: (from: S, event: E) => void;
}

export interface StateMachineInstance<S extends string, E extends string> {
  getState: () => S;
  can: (event: E) => boolean;
  transition: (event: E) => Promise<S>;
  reset: () => void;
  destroy: () => void;
  subscribe: (callback: (state: S) => void) => () => void;
}

/**
 * Creates a type-safe finite state machine
 *
 * @example
 * ```typescript
 * const walletMachine = createStateMachine({
 *   id: 'wallet',
 *   initial: 'idle',
 *   states: {
 *     idle: { on: { CONNECT: 'connecting' } },
 *     connecting: {
 *       on: { SUCCESS: 'connected', FAILURE: 'error' },
 *       timeout: { duration: 30000, event: 'FAILURE' }
 *     },
 *     connected: { on: { DISCONNECT: 'disconnecting' } },
 *     disconnecting: { on: { SUCCESS: 'idle' } },
 *     error: { on: { RETRY: 'connecting' } }
 *   }
 * });
 * ```
 */
export function createStateMachine<S extends string, E extends string>(
  config: StateMachineConfig<S, E>,
): StateMachineInstance<S, E> {
  let currentState: S = config.initial;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const subscribers = new Set<(state: S) => void>();

  const clearStateTimeout = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const setupStateTimeout = () => {
    clearStateTimeout();
    const stateConfig = config.states[currentState];

    if (stateConfig.timeout) {
      timeoutId = setTimeout(() => {
        instance.transition(stateConfig.timeout!.event);
      }, stateConfig.timeout.duration);
    }
  };

  const notifySubscribers = () => {
    subscribers.forEach((callback) => callback(currentState));
  };

  const instance: StateMachineInstance<S, E> = {
    getState: () => currentState,

    can: (event: E): boolean => {
      const stateConfig = config.states[currentState];
      return !!stateConfig.on?.[event];
    },

    transition: async (event: E): Promise<S> => {
      const stateConfig = config.states[currentState];
      const nextState = stateConfig.on?.[event];

      if (!nextState) {
        config.onInvalidTransition?.(currentState, event);
        console.warn(
          `[StateMachine:${config.id}] Invalid transition: ${currentState} + ${event}`,
        );
        return currentState;
      }

      // Exit current state
      clearStateTimeout();
      await stateConfig.exit?.();

      const prevState = currentState;
      currentState = nextState;

      // Enter new state
      const newStateConfig = config.states[currentState];
      await newStateConfig.entry?.();
      setupStateTimeout();

      config.onTransition?.(prevState, currentState, event);
      notifySubscribers();

      return currentState;
    },

    reset: () => {
      clearStateTimeout();
      currentState = config.initial;
      setupStateTimeout();
      notifySubscribers();
    },

    destroy: () => {
      clearStateTimeout();
      subscribers.clear();
    },

    subscribe: (callback: (state: S) => void) => {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
  };

  // Setup initial state timeout
  setupStateTimeout();

  return instance;
}

// ============================================================================
// Pre-configured State Machines for BitcoinBaby
// ============================================================================

export type WalletState =
  | "idle"
  | "connecting"
  | "connected"
  | "locked"
  | "unlocking"
  | "disconnecting"
  | "error";

export type WalletEvent =
  | "CONNECT"
  | "SUCCESS"
  | "FAILURE"
  | "DISCONNECT"
  | "LOCK"
  | "UNLOCK"
  | "RETRY"
  | "TIMEOUT";

export const WALLET_STATE_CONFIG: StateMachineConfig<WalletState, WalletEvent> =
  {
    id: "wallet",
    initial: "idle",
    states: {
      idle: {
        on: { CONNECT: "connecting" },
      },
      connecting: {
        on: {
          SUCCESS: "connected",
          FAILURE: "error",
          TIMEOUT: "error",
        },
        timeout: { duration: 30000, event: "TIMEOUT" },
      },
      connected: {
        on: {
          DISCONNECT: "disconnecting",
          LOCK: "locked",
        },
      },
      locked: {
        on: {
          UNLOCK: "unlocking",
          DISCONNECT: "disconnecting",
        },
      },
      unlocking: {
        on: {
          SUCCESS: "connected",
          FAILURE: "locked",
          TIMEOUT: "locked",
        },
        timeout: { duration: 30000, event: "TIMEOUT" },
      },
      disconnecting: {
        on: {
          SUCCESS: "idle",
          FAILURE: "error",
        },
        timeout: { duration: 5000, event: "SUCCESS" },
      },
      error: {
        on: {
          RETRY: "connecting",
          DISCONNECT: "idle",
        },
      },
    },
  };

export type TxState =
  | "idle"
  | "building"
  | "signing"
  | "broadcasting"
  | "pending"
  | "confirming"
  | "confirmed"
  | "rejected"
  | "failed";

export type TxEvent =
  | "BUILD"
  | "SIGN"
  | "REJECT"
  | "BROADCAST"
  | "SUBMITTED"
  | "MEMPOOL"
  | "CONFIRM"
  | "FINALIZE"
  | "FAIL"
  | "RESET"
  | "TIMEOUT";

export const TX_STATE_CONFIG: StateMachineConfig<TxState, TxEvent> = {
  id: "transaction",
  initial: "idle",
  states: {
    idle: {
      on: { BUILD: "building" },
    },
    building: {
      on: {
        SIGN: "signing",
        FAIL: "failed",
        TIMEOUT: "failed",
      },
      timeout: { duration: 30000, event: "TIMEOUT" },
    },
    signing: {
      on: {
        BROADCAST: "broadcasting",
        REJECT: "rejected",
        TIMEOUT: "rejected",
      },
      timeout: { duration: 120000, event: "TIMEOUT" }, // 2 min for user to sign
    },
    broadcasting: {
      on: {
        SUBMITTED: "pending",
        FAIL: "failed",
        TIMEOUT: "failed",
      },
      timeout: { duration: 30000, event: "TIMEOUT" },
    },
    pending: {
      on: {
        MEMPOOL: "confirming",
        FAIL: "failed",
        TIMEOUT: "failed",
      },
      timeout: { duration: 600000, event: "TIMEOUT" }, // 10 min to reach mempool
    },
    confirming: {
      on: {
        FINALIZE: "confirmed",
        FAIL: "failed",
      },
      // No timeout - confirmations can take variable time
    },
    confirmed: {
      on: { RESET: "idle" },
    },
    rejected: {
      on: { RESET: "idle" },
    },
    failed: {
      on: { RESET: "idle", BUILD: "building" },
    },
  },
};

export type MiningState =
  | "idle"
  | "initializing"
  | "mining"
  | "submitting"
  | "paused"
  | "stopping"
  | "error"
  | "gpu_unavailable";

export type MiningEvent =
  | "START"
  | "READY"
  | "PAUSE"
  | "RESUME"
  | "FOUND"
  | "SUBMITTED"
  | "STOP"
  | "ERROR"
  | "GPU_FAIL"
  | "RETRY"
  | "TIMEOUT";

export const MINING_STATE_CONFIG: StateMachineConfig<MiningState, MiningEvent> =
  {
    id: "mining",
    initial: "idle",
    states: {
      idle: {
        on: { START: "initializing" },
      },
      initializing: {
        on: {
          READY: "mining",
          GPU_FAIL: "gpu_unavailable",
          ERROR: "error",
          TIMEOUT: "error",
        },
        timeout: { duration: 30000, event: "TIMEOUT" },
      },
      mining: {
        on: {
          FOUND: "submitting",
          PAUSE: "paused",
          STOP: "stopping",
          ERROR: "error",
        },
      },
      submitting: {
        on: {
          SUBMITTED: "mining",
          ERROR: "mining", // Continue mining even if submission fails
          TIMEOUT: "mining",
        },
        timeout: { duration: 60000, event: "TIMEOUT" },
      },
      paused: {
        on: {
          RESUME: "mining",
          STOP: "stopping",
        },
      },
      stopping: {
        on: {
          READY: "idle",
          TIMEOUT: "idle",
        },
        timeout: { duration: 5000, event: "TIMEOUT" },
      },
      error: {
        on: {
          RETRY: "initializing",
          STOP: "idle",
        },
      },
      gpu_unavailable: {
        on: {
          RETRY: "initializing", // Retry with CPU
          STOP: "idle",
        },
      },
    },
  };

// Factory functions
export function createWalletStateMachine() {
  return createStateMachine(WALLET_STATE_CONFIG);
}

export function createTxStateMachine() {
  return createStateMachine(TX_STATE_CONFIG);
}

export function createMiningStateMachine() {
  return createStateMachine(MINING_STATE_CONFIG);
}
