/**
 * Evolution Service
 *
 * Handles NFT evolution logic and spell generation.
 */

import type { CharmsClient } from "./client";
import type { SparkNFTState } from "./nft";
import {
  canLevelUp,
  calculateXpGain,
  getMiningBoost,
  EVOLUTION_COSTS,
  XP_REQUIREMENTS,
  LEVEL_BOOSTS,
  GENESIS_SPARKS_CONFIG,
  createNFTWorkProofSpell,
  createNFTLevelUpSpell,
} from "./nft";
import type { SpellV2 } from "./types";

// =============================================================================
// SERVICE OPTIONS
// =============================================================================

export interface EvolutionServiceOptions {
  nftAppId: string;
  nftAppVk: string;
  tokenAppId: string;
  tokenAppVk: string;
}

// =============================================================================
// EVOLUTION SERVICE
// =============================================================================

export class EvolutionService {
  private readonly client: CharmsClient;
  private readonly options: EvolutionServiceOptions;

  constructor(client: CharmsClient, options: EvolutionServiceOptions) {
    this.client = client;
    this.options = options;
  }

  // ===========================================================================
  // READ OPERATIONS
  // ===========================================================================

  /**
   * Get NFT state from UTXO
   */
  async getNFTState(
    address: string,
    tokenId?: number,
  ): Promise<SparkNFTState | null> {
    const nfts = await this.client.getOwnedNFTs(address, this.options.nftAppId);

    if (tokenId !== undefined) {
      return nfts.find((n) => n.tokenId === tokenId) || null;
    }

    // Return first NFT if no tokenId specified
    return nfts[0] || null;
  }

  /**
   * Get all owned NFTs
   */
  async getOwnedNFTs(address: string): Promise<SparkNFTState[]> {
    return this.client.getOwnedNFTs(address, this.options.nftAppId);
  }

  /**
   * Get evolution status for an NFT
   */
  getEvolutionStatus(nft: SparkNFTState): EvolutionStatus {
    const nextLevel = nft.level + 1;
    const canEvolve = canLevelUp(nft);
    const xpRequired = XP_REQUIREMENTS[nextLevel] ?? 0;
    const tokenCost = EVOLUTION_COSTS[nextLevel] ?? 0n;
    const currentBoost = getMiningBoost(nft);
    // nextBoost: use nextLevel boost if below max, otherwise stay at current level boost
    const isMaxLevel = nft.level >= GENESIS_SPARKS_CONFIG.maxLevel;
    const nextLevelBoost = isMaxLevel
      ? (LEVEL_BOOSTS[nft.level] ?? 0)
      : (LEVEL_BOOSTS[nextLevel] ?? LEVEL_BOOSTS[nft.level] ?? 0);
    const rarityBoost =
      GENESIS_SPARKS_CONFIG.rarityTiers[nft.rarityTier]?.boost ?? 0;
    const nextBoost = nextLevelBoost + rarityBoost;

    return {
      currentLevel: nft.level,
      nextLevel: canEvolve ? nextLevel : nft.level,
      currentXp: nft.xp,
      xpRequired,
      xpProgress: xpRequired > 0 ? (nft.xp / xpRequired) * 100 : 100,
      canEvolve,
      tokenCost,
      currentBoost,
      nextBoost,
      boostGain: nextBoost - currentBoost,
    };
  }

  /**
   * Calculate XP gain for work completion
   */
  calculateXpGain(nft: SparkNFTState): number {
    return calculateXpGain(nft);
  }

  /**
   * Get mining boost for an NFT
   */
  getMiningBoost(nft: SparkNFTState): number {
    return getMiningBoost(nft);
  }

  /**
   * Get best boost from all owned NFTs
   */
  async getBestBoost(address: string): Promise<number> {
    const nfts = await this.getOwnedNFTs(address);

    if (nfts.length === 0) {
      return 0;
    }

    return Math.max(...nfts.map((nft) => getMiningBoost(nft)));
  }

  // ===========================================================================
  // SPELL GENERATION
  // ===========================================================================

  /**
   * Create work proof spell (adds XP to NFT)
   */
  async createWorkProofSpell(params: {
    nftUtxo: { txid: string; vout: number };
    currentState: SparkNFTState;
    ownerAddress: string;
    workProofHash: string;
  }): Promise<SpellV2> {
    const currentBlock = await this.client.getBlockHeight();

    return createNFTWorkProofSpell({
      appId: this.options.nftAppId,
      appVk: this.options.nftAppVk,
      nftUtxo: params.nftUtxo,
      currentState: params.currentState,
      ownerAddress: params.ownerAddress,
      workProofHash: params.workProofHash,
      currentBlock,
    });
  }

  /**
   * Create level up spell (burns tokens, increases level)
   */
  async createLevelUpSpell(params: {
    nftUtxo: { txid: string; vout: number };
    tokenUtxo: { txid: string; vout: number };
    currentState: SparkNFTState;
    tokenAmount: bigint;
    ownerAddress: string;
  }): Promise<SpellV2> {
    // Validate can level up
    if (!canLevelUp(params.currentState)) {
      throw new EvolutionError(
        `Cannot level up: insufficient XP (${params.currentState.xp}/${XP_REQUIREMENTS[params.currentState.level + 1]})`,
      );
    }

    // Validate token amount
    const cost = EVOLUTION_COSTS[params.currentState.level + 1];
    if (params.tokenAmount < cost) {
      throw new EvolutionError(
        `Insufficient tokens: ${params.tokenAmount} < ${cost}`,
      );
    }

    return createNFTLevelUpSpell({
      nftAppId: this.options.nftAppId,
      nftAppVk: this.options.nftAppVk,
      tokenAppId: this.options.tokenAppId,
      tokenAppVk: this.options.tokenAppVk,
      nftUtxo: params.nftUtxo,
      tokenUtxo: params.tokenUtxo,
      currentState: params.currentState,
      tokenAmount: params.tokenAmount,
      ownerAddress: params.ownerAddress,
    });
  }

  // ===========================================================================
  // EVOLUTION EXECUTION
  // ===========================================================================

  /**
   * Execute work proof (add XP to NFT)
   *
   * Full flow:
   * 1. Create spell
   * 2. Build transaction
   * 3. Sign with Scrolls
   * 4. Broadcast
   */
  async executeWorkProof(params: {
    nftUtxo: { txid: string; vout: number };
    currentState: SparkNFTState;
    ownerAddress: string;
    workProofHash: string;
    signTransaction: (psbt: string) => Promise<string>;
  }): Promise<EvolutionResult> {
    // 1. Create spell
    const spell = await this.createWorkProofSpell({
      nftUtxo: params.nftUtxo,
      currentState: params.currentState,
      ownerAddress: params.ownerAddress,
      workProofHash: params.workProofHash,
    });

    // 2. Get fee info
    const feeEstimates = await this.client.getFeeEstimates();

    // 3. Calculate new XP state (same cap logic as the on-chain spell)
    const xpGain = calculateXpGain(params.currentState);
    const nextLevelReq = XP_REQUIREMENTS[params.currentState.level + 1];
    const rawNewXp = params.currentState.xp + xpGain;
    const cappedNewXp =
      nextLevelReq !== undefined
        ? Math.min(rawNewXp, nextLevelReq)
        : rawNewXp;
    // NOTE: Work-proof does NOT auto-level-up — that requires a separate levelUp tx.
    // We report whether the player CAN now level up (canLevelUpNow flag).
    const canLevelUpNow =
      nextLevelReq !== undefined && cappedNewXp >= nextLevelReq;

    return {
      spell,
      type: "work_proof",
      xpGained: xpGain,
      newXp: cappedNewXp,
      newLevel: params.currentState.level, // Level unchanged — levelUp is a separate tx
      tokensBurned: 0n,
      estimatedFee: feeEstimates.halfHourFee * 200, // ~200 vbytes
      canLevelUpNow,
    };
  }

  /**
   * Execute level up (burn tokens, increase level)
   */
  async executeLevelUp(params: {
    nftUtxo: { txid: string; vout: number };
    tokenUtxo: { txid: string; vout: number };
    currentState: SparkNFTState;
    tokenAmount: bigint;
    ownerAddress: string;
    signTransaction: (psbt: string) => Promise<string>;
  }): Promise<EvolutionResult> {
    // 1. Create spell
    const spell = await this.createLevelUpSpell({
      nftUtxo: params.nftUtxo,
      tokenUtxo: params.tokenUtxo,
      currentState: params.currentState,
      tokenAmount: params.tokenAmount,
      ownerAddress: params.ownerAddress,
    });

    // 2. Get fee info
    const feeEstimates = await this.client.getFeeEstimates();
    const cost = EVOLUTION_COSTS[params.currentState.level + 1];

    return {
      spell,
      type: "level_up",
      xpGained: 0,
      newXp: 0,
      newLevel: params.currentState.level + 1,
      tokensBurned: cost,
      estimatedFee: feeEstimates.halfHourFee * 300, // ~300 vbytes
    };
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface EvolutionStatus {
  currentLevel: number;
  nextLevel: number;
  currentXp: number;
  xpRequired: number;
  xpProgress: number; // 0-100
  canEvolve: boolean;
  tokenCost: bigint;
  currentBoost: number;
  nextBoost: number;
  boostGain: number;
}

export interface EvolutionResult {
  spell: SpellV2;
  type: "work_proof" | "level_up";
  xpGained: number;
  newXp: number;
  newLevel: number;
  tokensBurned: bigint;
  estimatedFee: number;
  /** Only present for work_proof: true if the player can now submit a levelUp tx */
  canLevelUpNow?: boolean;
}

// =============================================================================
// ERRORS
// =============================================================================

export class EvolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvolutionError";
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createEvolutionService(
  client: CharmsClient,
  options: EvolutionServiceOptions,
): EvolutionService {
  return new EvolutionService(client, options);
}
