/**
 * Marketplace API Client
 *
 * Handles all NFT marketplace operations:
 * - List/unlist NFTs
 * - Get listings
 * - Buy NFTs
 * - Work proofs (XP from mining)
 * - NFT Explorer
 * - Evolution confirmation
 */

import { BaseApiClient, type Environment } from "./base-client";
import type {
  ApiResponse,
  NFTListing,
  NFTListingWithNFT,
  NFTSale,
  NFTRecord,
  NFTProveResult,
  WorkProofResult,
  EvolutionConfirmResult,
  NFTExplorerQuery,
  NFTExplorerResponse,
  NFTGlobalStats,
} from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface ListNFTParams {
  tokenId: number;
  price: number;
  sellerAddress: string;
  sellerPsbt?: string;
  nftUtxo?: { txid: string; vout: number; value: number };
}

export interface WorkProofParams {
  ownerAddress: string;
  shareHash: string;
  difficulty: number;
  timestamp: number;
}

export interface ProveNFTParams {
  address: string;
  dna: string;
  bloodline: string;
  baseType: string;
  rarityTier: string;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  evolutionCount: number;
}

// =============================================================================
// CLIENT
// =============================================================================

export class MarketplaceClient extends BaseApiClient {
  constructor(env: Environment = "development") {
    super(env);
  }

  // ===========================================================================
  // MARKETPLACE
  // ===========================================================================

  /**
   * List an NFT for sale on the marketplace
   */
  async listNFT(params: ListNFTParams): Promise<ApiResponse<NFTListing>> {
    return this.post<NFTListing>("/api/nft/list", params);
  }

  /**
   * Remove an NFT listing from the marketplace
   */
  async unlistNFT(
    tokenId: number,
    sellerAddress: string,
  ): Promise<ApiResponse<{ tokenId: number; unlisted: boolean }>> {
    return this.delete<{ tokenId: number; unlisted: boolean }>(
      `/api/nft/unlist/${tokenId}`,
      { "X-Wallet-Address": sellerAddress },
    );
  }

  /**
   * Get all active marketplace listings
   */
  async getListings(): Promise<
    ApiResponse<{ listings: NFTListingWithNFT[]; count: number }>
  > {
    return this.get<{ listings: NFTListingWithNFT[]; count: number }>(
      "/api/nft/listings",
    );
  }

  /**
   * Buy a listed NFT
   */
  async buyNFT(
    tokenId: number,
    buyerAddress: string,
    txid?: string,
  ): Promise<ApiResponse<NFTSale>> {
    return this.post<NFTSale>(`/api/nft/buy/${tokenId}`, {
      buyerAddress,
      txid,
    });
  }

  // ===========================================================================
  // WORK PROOF (XP FROM MINING)
  // ===========================================================================

  /**
   * Submit work proof to gain XP for an NFT
   *
   * When a user mines a valid share, their equipped NFT gains XP.
   */
  async submitWorkProof(
    tokenId: number,
    params: WorkProofParams,
  ): Promise<ApiResponse<WorkProofResult>> {
    return this.post<WorkProofResult>(`/api/nft/${tokenId}/work-proof`, params);
  }

  // ===========================================================================
  // NFT EXPLORER
  // ===========================================================================

  /**
   * Get all minted NFTs with filtering and pagination
   *
   * Used for the Explorer tab to browse all NFTs in the collection.
   */
  async getAllNFTs(
    query: NFTExplorerQuery = {},
  ): Promise<ApiResponse<NFTExplorerResponse>> {
    const params = new URLSearchParams();
    if (query.page) params.set("page", query.page.toString());
    if (query.limit) params.set("limit", query.limit.toString());
    if (query.sort) params.set("sort", query.sort);
    if (query.bloodline) params.set("bloodline", query.bloodline);
    if (query.rarity) params.set("rarity", query.rarity);
    if (query.forSale) params.set("forSale", query.forSale);

    const queryString = params.toString();
    const url = `/api/nft/all${queryString ? `?${queryString}` : ""}`;
    return this.get<NFTExplorerResponse>(url);
  }

  /**
   * Get global NFT statistics
   */
  async getNFTStats(): Promise<ApiResponse<NFTGlobalStats>> {
    return this.get<NFTGlobalStats>("/api/nft/stats");
  }

  // ===========================================================================
  // MINTING & EVOLUTION
  // ===========================================================================

  /**
   * Prove NFT mint via backend
   */
  async proveNFT(params: ProveNFTParams): Promise<ApiResponse<NFTProveResult>> {
    return this.post<NFTProveResult>("/api/nft/prove", params);
  }

  /**
   * Claim an NFT by providing the mint transaction ID
   * Verifies the transaction on blockchain and registers the NFT
   */
  async claimNFT(
    txid: string,
    address: string,
  ): Promise<ApiResponse<NFTRecord>> {
    return this.post<NFTRecord>("/api/nft/claim", { txid, address });
  }

  /**
   * Confirm on-chain evolution transaction
   *
   * Called after a client broadcasts an evolution transaction to the blockchain.
   * Updates the server state to reflect the new level.
   */
  async confirmEvolution(
    tokenId: number,
    txid: string,
    newLevel: number,
    address: string,
  ): Promise<ApiResponse<EvolutionConfirmResult>> {
    return this.post<EvolutionConfirmResult>("/api/nft/confirm-evolution", {
      tokenId,
      txid,
      newLevel,
      address,
    });
  }
}

// Singleton instance
let marketplaceClient: MarketplaceClient | null = null;

/**
 * Get marketplace client singleton
 */
export function getMarketplaceClient(env?: Environment): MarketplaceClient {
  if (!marketplaceClient) {
    marketplaceClient = new MarketplaceClient(env);
  }
  return marketplaceClient;
}
