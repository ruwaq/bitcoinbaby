/**
 * Network Module
 *
 * @example
 * import {
 *   normalizeNetwork,
 *   getNetworkEndpoints,
 *   getExplorerTxUrl,
 *   DEFAULT_NETWORK,
 * } from '@bitcoinbaby/shared/network';
 *
 * // Normalize any network value
 * const network = normalizeNetwork("testnet"); // → "testnet4"
 *
 * // Get endpoints
 * const endpoints = getNetworkEndpoints("testnet4");
 *
 * // Get explorer URL
 * const txUrl = getExplorerTxUrl("testnet4", txid);
 */

export {
  // Types
  type BitcoinJsNetwork,
  type SupportedNetwork,
  type ScrollsNetwork,
  type BitcoinNetwork,
  type NetworkEndpoints,
  // Constants
  NETWORK_ENDPOINTS,
  DEFAULT_NETWORK,
  // Normalization functions
  normalizeNetwork,
  toScrollsNetwork,
  toBitcoinJsNetwork,
  // Endpoint helpers
  getNetworkEndpoints,
  getMempoolApiUrl,
  getExplorerTxUrl,
  getExplorerAddressUrl,
  // Validation
  isValidNetwork,
  isTestnet,
  isMainnet,
  // Default
  getDefaultNetwork,
} from "./config";
