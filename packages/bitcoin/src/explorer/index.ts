/**
 * Charms Explorer API
 *
 * Client for querying Charms token balances and UTXOs from the
 * Charms Explorer indexer.
 *
 * @example
 * ```typescript
 * import { createExplorerClient } from '@bitcoinbaby/bitcoin';
 *
 * const explorer = createExplorerClient({ network: 'testnet4' });
 *
 * // Get all charms for an address
 * const charms = await explorer.getWalletCharms(address);
 *
 * // Get BABY token balance
 * const balance = await explorer.getTokenBalance(address, 'BABY');
 * ```
 */

export {
  CharmsExplorerClient,
  ExplorerAPIError,
  getExplorerClient,
  createExplorerClient,
  type ExplorerClientOptions,
  type ExplorerNetwork,
  type CharmBalance,
  type CharmUTXO,
  type WalletCharmsResponse,
  type WalletUTXOsResponse,
} from "./client";
