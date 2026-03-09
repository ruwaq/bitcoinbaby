/**
 * BitcoinBaby API Module
 *
 * Exports for the Cloudflare Workers API client.
 */

export {
  BitcoinBabyClient,
  getApiClient,
  resetApiClient,
  type NFTRecord,
  type NFTRecordWithListing,
  type NFTListing,
  type NFTListingWithNFT,
  type NFTSale,
  type WorkProofResult,
  type EvolutionConfirmResult,
  type NFTExplorerQuery,
  type NFTExplorerResponse,
  type NFTGlobalStats,
} from "./client";
export type { MintAttempt } from "./clients/nft-client";
export type {
  ApiResponse,
  BalanceResponse,
  CreditResponse,
  MiningProof,
  PoolType,
  PoolStatusResponse,
  WithdrawRequest,
  WithdrawResponse,
  WithdrawStatus,
  GameState,
  GameStats,
  WsMessage,
  WsMessageType,
} from "./types";
