/**
 * NFT API Client
 *
 * Handles all NFT-related operations:
 * - Get/Reserve/Release NFT IDs
 * - Confirm mints
 * - Get owned NFTs
 * - XP submissions
 */

import { HTTP_TIMEOUTS } from "@bitcoinbaby/shared";
import { BaseApiClient, type Environment } from "./base-client";
import type { ApiResponse, NFTRecord } from "../types";
import type { MintPrepareResult, MintFinalizeResult } from "../client";

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
    heritage: number;
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

export interface MintAttempt {
  attemptId: string;
  tokenId: number;
  status:
    | "reserved"
    | "proving"
    | "signing"
    | "broadcasting"
    | "confirmed"
    | "failed";
  reservedAt: number;
  lastUpdatedAt: number;
  error: string | null;
  commitTxid: string | null;
  spellTxid: string | null;
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
   * Check prover health before minting
   * Returns availability status and latency
   */
  async checkProverHealth(): Promise<
    ApiResponse<{ available: boolean; latencyMs: number; error?: string }>
  > {
    return this.get<{ available: boolean; latencyMs: number; error?: string }>(
      "/api/nft/prover-health",
    );
  }

  /**
   * Get mint attempts for an address
   * Shows pending, failed, and recent successful mints
   */
  async getMintAttempts(
    address: string,
  ): Promise<ApiResponse<{ attempts: MintAttempt[]; count: number }>> {
    return this.get<{ attempts: MintAttempt[]; count: number }>(
      `/api/nft/mint-attempts/${address}`,
    );
  }

  /**
   * Update mint attempt status
   * Call this at each step of the minting process for user visibility
   */
  async updateMintAttempt(
    attemptId: string,
    status: MintAttempt["status"],
    options?: { error?: string; commitTxid?: string; spellTxid?: string },
  ): Promise<ApiResponse<{ updated: boolean; status: string }>> {
    return this.post<{ updated: boolean; status: string }>(
      "/api/nft/update-attempt",
      {
        attemptId,
        status,
        ...options,
      },
    );
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

  // ===========================================================================
  // UNIFIED /mint FLOW (D3 + D6)
  // ===========================================================================

  /**
   * Step 1: prepare the atomic mint spell server-side. Server picks tokenId +
   * traits and returns unsigned commit + spell hexes. See client.ts:prepareMint
   * for the full contract.
   */
  async prepareMint(params: {
    address: string;
    fundingUtxo: { txid: string; vout: number; value: number };
  }): Promise<ApiResponse<MintPrepareResult>> {
    return this.postWithTimeout<MintPrepareResult>(
      "/api/nft/mint/prepare",
      params,
      HTTP_TIMEOUTS.PROVER_FULL,
    );
  }

  /**
   * Step 2: finalize after broadcasting the spell tx. Server verifies the tx
   * on-chain and persists the NFT.
   */
  async finalizeMint(params: {
    spellTxid: string;
    address: string;
  }): Promise<ApiResponse<MintFinalizeResult>> {
    return this.post<MintFinalizeResult>("/api/nft/mint/finalize", params);
  }

  /**
   * Request NFT evolution
   * Requires sufficient XP and SPARK balance
   */
  async evolveNFT(
    tokenId: number,
    address: string,
  ): Promise<
    ApiResponse<{
      nft: NFTRecord;
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
