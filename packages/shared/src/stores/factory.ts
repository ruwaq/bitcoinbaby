/**
 * Zustand Store Factory
 *
 * Standardized store creation with consistent patterns:
 * - TypeScript-safe state and actions
 * - Optional persistence with migration support
 * - Devtools integration
 * - Logging middleware
 * - Subscription helpers
 */

// Safe globals for cross-environment compatibility
declare const process: { env?: Record<string, string | undefined> } | undefined;

// Storage interface for cross-environment compatibility
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

declare const window: { localStorage?: StorageLike } | undefined;

import { create, type StateCreator, type StoreApi } from "zustand";
import {
  persist,
  createJSONStorage,
  devtools,
  subscribeWithSelector,
  type PersistOptions,
} from "zustand/middleware";
import { createLogger } from "../logging";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Base store state with version for migrations
 */
export interface BaseStoreState {
  _version: number;
}

/**
 * Common store actions
 */
export interface BaseStoreActions {
  /** Reset store to initial state */
  reset: () => void;
}

/**
 * Store creator options
 */
export interface CreateStoreOptions<TState extends BaseStoreState> {
  /** Store name (used for persistence key and devtools) */
  name: string;
  /** Current version for migrations */
  version: number;
  /** Enable persistence to localStorage */
  persist?: boolean;
  /** Enable devtools integration */
  devtools?: boolean;
  /** Enable logging middleware */
  logging?: boolean;
  /** Custom migration function */
  migrate?: (persistedState: unknown, version: number) => TState;
  /** Partialize state for persistence (exclude certain fields) */
  partialize?: (state: TState) => Partial<TState>;
}

/**
 * Store initializer function type
 */
export type StoreInitializer<TState, TActions> = (
  set: (
    partial:
      | Partial<TState & TActions>
      | ((state: TState & TActions) => Partial<TState & TActions>),
  ) => void,
  get: () => TState & TActions,
  api: StoreApi<TState & TActions>,
) => TState & TActions;

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Logging middleware for debugging
 */
function loggingMiddleware<T extends object>(
  name: string,
  creator: StateCreator<T>,
): StateCreator<T> {
  const log = createLogger(`Store:${name}`);

  return (set, get, api) => {
    const loggedSet: typeof set = (args) => {
      const prevState = get();
      set(args);
      const nextState = get();

      // Log state changes (excluding internal fields)
      const changes: Record<string, unknown> = {};
      for (const key of Object.keys(nextState) as Array<keyof T>) {
        if (prevState[key] !== nextState[key] && !String(key).startsWith("_")) {
          changes[String(key)] = nextState[key];
        }
      }

      if (Object.keys(changes).length > 0) {
        log.debug("State updated", changes);
      }
    };

    return creator(loggedSet, get, api);
  };
}

// =============================================================================
// FACTORY
// =============================================================================

/**
 * Create a typed Zustand store with standardized patterns
 *
 * @example
 * ```typescript
 * interface CounterState extends BaseStoreState {
 *   count: number;
 * }
 *
 * interface CounterActions extends BaseStoreActions {
 *   increment: () => void;
 *   decrement: () => void;
 * }
 *
 * const useCounterStore = createStore<CounterState, CounterActions>(
 *   {
 *     name: "counter",
 *     version: 1,
 *     persist: true,
 *   },
 *   (set, get) => ({
 *     // State
 *     _version: 1,
 *     count: 0,
 *
 *     // Actions
 *     increment: () => set((state) => ({ count: state.count + 1 })),
 *     decrement: () => set((state) => ({ count: state.count - 1 })),
 *     reset: () => set({ count: 0 }),
 *   }),
 * );
 * ```
 */
export function createStore<
  TState extends BaseStoreState,
  TActions extends BaseStoreActions,
>(
  options: CreateStoreOptions<TState>,
  initializer: StoreInitializer<TState, TActions>,
) {
  const isDev =
    typeof process !== "undefined" && process?.env?.NODE_ENV === "development";

  const {
    name,
    version,
    persist: enablePersist = false,
    devtools: enableDevtools = isDev,
    logging: enableLogging = isDev,
    migrate,
    partialize,
  } = options;

  type Store = TState & TActions;

  // Build the store creator with middleware layers
  let creator: StateCreator<Store, [], []> = initializer as StateCreator<
    Store,
    [],
    []
  >;

  // Apply logging middleware
  if (enableLogging) {
    creator = loggingMiddleware(name, creator);
  }

  // Apply persistence
  if (enablePersist) {
    const persistOptions: PersistOptions<Store, Partial<Store>> = {
      name: `bitcoinbaby-${name}`,
      version,
      storage: createJSONStorage(() => {
        // Safe localStorage access for SSR
        if (typeof window !== "undefined" && window?.localStorage) {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      migrate: migrate as PersistOptions<Store, Partial<Store>>["migrate"],
      partialize: partialize as ((state: Store) => Partial<Store>) | undefined,
    };

    const persistedCreator = persist(creator, persistOptions);
    creator = persistedCreator as unknown as StateCreator<Store, [], []>;
  }

  // Apply devtools
  if (enableDevtools) {
    const devtoolsCreator = devtools(creator, { name });
    creator = devtoolsCreator as unknown as StateCreator<Store, [], []>;
  }

  // Apply subscribeWithSelector for fine-grained subscriptions
  const selectorCreator = subscribeWithSelector(creator);

  return create(selectorCreator as unknown as StateCreator<Store>);
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a simple store without persistence
 *
 * @example
 * ```typescript
 * const useUIStore = createSimpleStore({
 *   isOpen: false,
 *   toggle: () => set((s) => ({ isOpen: !s.isOpen })),
 * });
 * ```
 */
export function createSimpleStore<T extends object>(
  initialState: T | ((set: (partial: Partial<T>) => void, get: () => T) => T),
) {
  if (typeof initialState === "function") {
    return create<T>()(initialState as StateCreator<T>);
  }
  return create<T>()(() => initialState);
}

/**
 * Create a persisted store with minimal configuration
 *
 * @example
 * ```typescript
 * const usePrefsStore = createPersistedStore("user-prefs", {
 *   theme: "dark",
 *   locale: "en",
 * });
 * ```
 */
export function createPersistedStore<T extends object>(
  name: string,
  initialState: T,
) {
  return create<T>()(
    persist(() => initialState, {
      name: `bitcoinbaby-${name}`,
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined" && window?.localStorage) {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
    }),
  );
}

/**
 * Create selector hooks for a store
 *
 * @example
 * ```typescript
 * const selectors = createSelectors(useCounterStore);
 * const count = selectors.use.count(); // Subscribes only to count
 * ```
 */
export function createSelectors<S extends StoreApi<object>>(store: S) {
  type State = ReturnType<S["getState"]>;

  const selectors: Record<string, () => unknown> = {};

  for (const key of Object.keys(store.getState())) {
    selectors[key] = () =>
      (
        store as unknown as {
          subscribe: (selector: (s: State) => unknown) => unknown;
        }
      ).subscribe((state: State) => state[key as keyof State]);
  }

  return { use: selectors as { [K in keyof State]: () => State[K] } };
}

/**
 * Combine multiple stores into a single hook
 * Useful for components that need data from multiple stores
 *
 * @example
 * ```typescript
 * const useDashboard = combineStores({
 *   wallet: useWalletStore,
 *   mining: useMiningStore,
 * });
 *
 * const { wallet, mining } = useDashboard();
 * ```
 */
export function combineStores<T extends Record<string, () => unknown>>(
  stores: T,
): () => { [K in keyof T]: ReturnType<T[K]> } {
  return () => {
    const result = {} as { [K in keyof T]: ReturnType<T[K]> };
    for (const [key, store] of Object.entries(stores)) {
      result[key as keyof T] = store() as ReturnType<T[keyof T]>;
    }
    return result;
  };
}
