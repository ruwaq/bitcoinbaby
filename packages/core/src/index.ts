export * from "./stores";
export * from "./types";
export * from "./mining";
export * from "./game";
export * from "./storage";
export * from "./hooks";
export * from "./utils";
export * from "./cosmic";
export * from "./tokenomics";
export * from "./offline";
export * from "./rewards";

// Centralized constants
// See packages/core/src/constants/index.ts for full guide
export * from "./constants/retry-config";
export * from "./constants/polling";
export * from "./constants/app-ids";
export * from "./constants/mining";

// API exports (with prefixed names to avoid conflicts)
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
  type NFTExplorerQuery,
  type NFTExplorerResponse,
  type NFTGlobalStats,
} from "./api";
export type {
  ApiResponse,
  BalanceResponse,
  CreditResponse,
  MiningProof as ApiMiningProof,
  PoolType,
  PoolStatusResponse,
  WithdrawRequest,
  WithdrawResponse,
  WithdrawStatus,
  GameState as ApiGameState,
  GameStats as ApiGameStats,
  WsMessage,
  WsMessageType,
} from "./api";
