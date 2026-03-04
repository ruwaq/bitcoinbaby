/**
 * Store Factory Module
 *
 * @example
 * import {
 *   createStore,
 *   createSimpleStore,
 *   createPersistedStore,
 *   type BaseStoreState,
 *   type BaseStoreActions,
 * } from '@bitcoinbaby/shared/stores';
 */

export {
  // Factory
  createStore,
  createSimpleStore,
  createPersistedStore,
  // Helpers
  createSelectors,
  combineStores,
  // Types
  type BaseStoreState,
  type BaseStoreActions,
  type CreateStoreOptions,
  type StoreInitializer,
} from "./factory";
