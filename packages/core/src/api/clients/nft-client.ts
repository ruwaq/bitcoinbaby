/**
 * NFT API Client
 *
 * Handles all NFT-related operations:
 * - Get/Reserve/Release NFT IDs
 * - Confirm mints
 * - Get owned NFTs
 * - XP submissions
 */

import { BaseApiClient, type Environment } from "./base-client";
import type { ApiResponse, NFTRecord } from "../types";

// =============================================================================
// TYPES
// =============================================================================

export interface NFTMintData {
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

export interface WorkProofData {
  ownerAddress: string;
  shareHash: string;
  difficulty: number;
  timestamp: number;
}

export interface WorkProofResult {
  tokenId: number;
  xpGained: number;
  newXp: number;
  totalXp: number;
  workCount: number;
  bloodline: string;
  multiplier: number;
  canEvolve: boolean;
  xpToNextLevel: number;
}

export interface ProveNFTRequest {
  tokenId: number;
  address: string;
  nftState: {
    dna: string;
    bloodline: string;
    baseType: string;
    genesisBlock: number;
    rarityTier: string;
    tokenId: number;
    level: number;
    xp: number;
    totalXp: number;
    workCount: number;
    lastWorkBlock: number;
    evolutionCount: number;
    tokensEarned: string;
  };
  fundingUtxo: {
    txid: string;
    vout: number;
    value: number;
  };
}

export interface ProveNFTResult {
  tokenId: number;
  commitTxHex?: string;
  spellTxHex?: string;
  commitTxid?: string;
  spellTxid?: string;
  nextSteps: string[];
}

// =============================================================================
// CLIENT
// =============================================================================

export class NFTClient extends BaseApiClient {
  constructor(env: Environment = "development") {
    super(env);
  }

  /**
   * Get current NFT counter (total minted)
   */
  async getNFTCounter(): Promise<ApiResponse<{ count: number }>> {
    return this.get<{ count: number }>("/api/nft/counter");
  }

  /**
   * Reserve next NFT ID (atomic increment)
   * Returns the reserved token ID for minting
   */
  async reserveNFT(): Promise<
    ApiResponse<{ tokenId: number; totalMinted: number }>
  > {
    return this.post<{ tokenId: number; totalMinted: number }>(
      "/api/nft/reserve",
    );
  }

  /**
   * Release a reserved NFT ID (when mint fails after reservation)
   */
  async releaseNFT(
    tokenId: number,
  ): Promise<ApiResponse<{ released: boolean }>> {
    return this.post<{ released: boolean }>(`/api/nft/release/${tokenId}`);
  }

  /**
   * Confirm NFT mint after successful broadcast
   */
  async confirmNFTMint(
    tokenId: number,
    txid: string,
    address: string,
    nftData?: NFTMintData,
  ): Promise<ApiResponse<{ confirmed: boolean }>> {
    return this.post<{ confirmed: boolean }>(`/api/nft/confirm/${tokenId}`, {
      txid,
      address,
      nft: nftData,
    });
  }

  /**
   * Get all NFTs owned by an address
   */
  async getOwnedNFTs(
    address: string,
  ): Promise<ApiResponse<{ nfts: NFTRecord[]; count: number }>> {
    return this.get<{ nfts: NFTRecord[]; count: number }>(
      `/api/nft/owned/${address}`,
    );
  }

  /**
   * Get single NFT by token ID
   */
  async getNFT(tokenId: number): Promise<ApiResponse<NFTRecord | null>> {
    return this.get<NFTRecord | null>(`/api/nft/${tokenId}`);
  }

  /**
   * Submit work proof to gain XP for an NFT
   * XP is calculated based on difficulty and bloodline multiplier
   */
  async submitWorkProof(
    tokenId: number,
    workProof: WorkProofData,
  ): Promise<ApiResponse<WorkProofResult>> {
    return this.post<WorkProofResult>(
      `/api/nft/${tokenId}/work-proof`,
      workProof,
    );
  }

  /**
   * Request NFT proof from Charms prover
   * Returns commit + spell transactions for signing
   */
  async proveNFT(
    request: ProveNFTRequest,
  ): Promise<ApiResponse<ProveNFTResult>> {
    return this.post<ProveNFTResult>("/api/nft/prove", request);
  }

  /**
   * Request NFT evolution
   * Requires sufficient XP and BABTC balance
   */
  async evolveNFT(
    tokenId: number,
    address: string,
  ): Promise<
    ApiResponse<{
      nft: NFTRecord;
      evolutionCost: string;
      previousLevel: number;
      newLevel: number;
    }>
  > {
    return this.post<{
      nft: NFTRecord;
      evolutionCost: string;
      previousLevel: number;
      newLevel: number;
    }>("/api/nft/evolve", { tokenId, address });
  }

  /**
   * Get NFT statistics
   */
  async getNFTStats(): Promise<
    ApiResponse<{
      totalMinted: number;
      totalOwners: number;
      averageLevel: number;
    }>
  > {
    return this.get<{
      totalMinted: number;
      totalOwners: number;
      averageLevel: number;
    }>("/api/nft/stats");
  }
}

// Singleton instance
let nftClient: NFTClient | null = null;

/**
 * Get NFT client singleton
 */
export function getNFTClient(env?: Environment): NFTClient {
  if (!nftClient) {
    nftClient = new NFTClient(env);
  }
  return nftClient;
}
