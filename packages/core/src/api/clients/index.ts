/**
 * API Clients
 *
 * Domain-specific API clients for cleaner separation of concerns.
 *
 * @example
 * import { getBalanceClient, getNFTClient } from './clients';
 *
 * const balance = await getBalanceClient().getBalance(address);
 * const nfts = await getNFTClient().getOwnedNFTs(address);
 */

// Base client
export { BaseApiClient, type Environment } from "./base-client";

// Domain clients
export { BalanceClient, getBalanceClient } from "./balance-client";
export {
  NFTClient,
  getNFTClient,
  type NFTMintData,
  type XPSubmissionData,
} from "./nft-client";
export { GameClient, getGameClient } from "./game-client";
export { LeaderboardClient, getLeaderboardClient } from "./leaderboard-client";
export {
  MarketplaceClient,
  getMarketplaceClient,
  type ListNFTParams,
  type WorkProofParams,
  type ProveNFTParams,
} from "./marketplace-client";

// Cache layer
export {
  ApiCache,
  getApiCache,
  CacheKeys,
  CacheTTL,
  type CacheOptions,
} from "./cache";
