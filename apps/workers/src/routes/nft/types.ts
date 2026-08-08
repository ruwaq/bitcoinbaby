/**
 * NFT Route Types
 *
 * Shared types and interfaces used across NFT sub-routers.
 */

// =============================================================================
// DETERMINISTIC RANDOM (re-exported from shared lib)
// =============================================================================

export { createSeededRandom } from "../../lib/deterministic-random";

// =============================================================================
// NFT RECORD
// =============================================================================

export interface NFTRecord {
  tokenId: number;
  txid: string;
  address: string;
  mintedAt: number;
  dna: string;
  bloodline: string;
  baseType: string;
  rarityTier: string;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  evolutionCount: number;
  genesisBlock: number;
  lastWorkBlock: number;
  tokensEarned: string;
  heritage: number;
}

export function parseNFTData(
  data: Record<string, unknown>,
  tokenId?: number,
): NFTRecord {
  return {
    tokenId: tokenId ?? parseInt(data.tokenId as string, 10),
    dna: data.dna as string,
    bloodline: data.bloodline as string,
    baseType: data.baseType as string,
    genesisBlock: parseInt(data.genesisBlock as string, 10) || 0,
    rarityTier: data.rarityTier as string,
    level: parseInt(data.level as string, 10) || 1,
    xp: parseInt(data.xp as string, 10) || 0,
    totalXp: parseInt(data.totalXp as string, 10) || 0,
    workCount: parseInt(data.workCount as string, 10) || 0,
    lastWorkBlock: parseInt(data.lastWorkBlock as string, 10) || 0,
    evolutionCount: parseInt(data.evolutionCount as string, 10) || 0,
    tokensEarned: (data.tokensEarned as string) || "0",
    heritage: parseInt(data.heritage as string, 10) || 0,
    txid: data.txid as string,
    address: data.address as string,
    mintedAt: parseInt(data.mintedAt as string, 10),
  };
}
