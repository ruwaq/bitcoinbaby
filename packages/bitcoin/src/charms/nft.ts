/**
 * Genesis Sparks NFT Types
 *
 * NFT configuration and types for the Genesis Sparks collection.
 * Separate from token, provides mining boosts and evolution.
 */

import type { SpellV2, AppType } from "./types";

// =============================================================================
// NFT CONFIGURATION
// =============================================================================

/**
 * Genesis Sparks NFT Configuration
 */
export const GENESIS_SPARKS_CONFIG = {
  name: "Genesis Sparks",
  symbol: "GBABY",
  maxSupply: 10_000,
  appType: "n" as AppType,

  // Rarity tiers
  // BALANCED: Low individual values, incentivizes collecting multiple NFTs
  rarityTiers: {
    common: { weight: 50, boost: 0.5 },
    uncommon: { weight: 25, boost: 1 },
    rare: { weight: 15, boost: 2 },
    epic: { weight: 7, boost: 3 },
    legendary: { weight: 2.5, boost: 5 },
    mythic: { weight: 0.5, boost: 8 },
  },

  // Base types
  baseTypes: {
    human: { weight: 70, name: "Human Spark" },
    animal: { weight: 15, name: "Animal Spark" },
    robot: { weight: 5, name: "Robot Spark" },
    mystic: { weight: 9, name: "Mystic Spark" },
    alien: { weight: 1, name: "Alien Spark" },
  },

  // Max level
  maxLevel: 21,
} as const;

// =============================================================================
// NFT STATE
// =============================================================================

/**
 * Bloodline types determine base multipliers
 */
export type Bloodline = "royal" | "warrior" | "rogue" | "mystic";

/**
 * Rarity tier
 */
export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";

/**
 * Base type of the baby
 */
export type BaseType = "human" | "animal" | "robot" | "mystic" | "alien";

/**
 * Complete NFT state stored in Charm UTXO
 */
export interface SparkNFTState {
  // Immutable (set at genesis, never changes)
  readonly dna: string; // Deterministic hash for visuals
  readonly bloodline: Bloodline;
  readonly baseType: BaseType;
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number; // 1-10000
  readonly heritage: number; // 0-4 procedural culture seed

  // Mutable (evolves with gameplay)
  level: number; // 1-21
  xp: number; // 0-999 per level
  totalXp: number; // Accumulated lifetime XP
  workCount: number; // Total PoUW tasks completed
  lastWorkBlock: number; // Block of last work submission
  evolutionCount: number; // Times evolved
  tokensEarned: bigint; // Lifetime SPARK earned

  // Narrative state (merkle roots for off-chain verification)
  narrativeRoot: string; // 32-byte merkle root of narrative event history
  worldStateRoot: string; // 32-byte merkle root of personality + inventory

  // Settlement state (Fase 2 — Block-Tick batch settlement).
  // These advance ONLY via the `settle` operation (createNFTSettleSpell);
  // every other spell preserves them unchanged. Mirrors the on-chain Rust
  // fields `last_settle_block` and `settle_count`.
  lastSettleBlock: number; // bitcoin block height of last settle (0 = never)
  settleCount: number; // anti-replay settlement counter
}

/**
 * Simplified NFT info for display
 */
export interface SparkNFTInfo {
  tokenId: number;
  name: string;
  level: number;
  xp: number;
  rarityTier: RarityTier;
  baseType: BaseType;
  boost: number;
  imageUri: string;
}

// =============================================================================
// EVOLUTION SYSTEM
// =============================================================================

/**
 * XP required for each level
 */
export const XP_REQUIREMENTS: Record<number, number> = {
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 4000,
  8: 8000,
  9: 16000,
  10: 32000,
  11: 48000,
  12: 64000,
  13: 96000,
  14: 128000,
  15: 192000,
  16: 256000,
  17: 384000,
  18: 512000,
  19: 768000,
  20: 1024000,
  // Level 21 is max — no XP needed beyond
};

/**
 * Mining boost percentage by level.
 * Fair progression: 0% at level 1, 10% at level 21.
 * Differences are small to keep competition fair.
 */
export const LEVEL_BOOSTS: Record<number, number> = {
  1: 0,
  2: 0.1,
  3: 0.2,
  4: 0.3,
  5: 0.5,
  6: 1,
  7: 1.25,
  8: 1.5,
  9: 1.75,
  10: 2,
  11: 2.5,
  12: 3,
  13: 3.5,
  14: 4,
  15: 4.5,
  16: 5,
  17: 5.5,
  18: 6,
  19: 7,
  20: 8,
  21: 10,
};

/**
 * Get mining boost for an NFT (level only — rarity is visual)
 */
export function getMiningBoost(nft: SparkNFTState): number {
  return LEVEL_BOOSTS[nft.level] ?? 0;
}

/**
 * Check if NFT can level up
 */
export function canLevelUp(nft: SparkNFTState): boolean {
  if (nft.level >= GENESIS_SPARKS_CONFIG.maxLevel) {
    return false;
  }

  const requiredXp = XP_REQUIREMENTS[nft.level + 1];
  return nft.xp >= requiredXp;
}

/**
 * Calculate XP gained from work
 * Base: 100 XP, modified by bloodline
 */
export function calculateXpGain(nft: SparkNFTState): number {
  const baseXp = 100;

  const bloodlineMultipliers: Record<Bloodline, number> = {
    royal: 1.5,
    warrior: 1.2,
    rogue: 1.0,
    mystic: 1.3,
  };

  return Math.floor(baseXp * bloodlineMultipliers[nft.bloodline]);
}

// =============================================================================
// DNA & TRAITS
// =============================================================================

/**
 * Trait categories for generation
 */
export interface TraitSet {
  background: string;
  body: string;
  eyes: string;
  mouth: string;
  accessories: string[];
  effects: string | null;
}

/**
 * Generate deterministic traits from DNA
 */
export function getTraitsFromDNA(dna: string): TraitSet {
  // DNA is a 64-char hex string
  // Each section determines a trait

  const sections = {
    background: dna.slice(0, 4),
    body: dna.slice(4, 8),
    eyes: dna.slice(8, 12),
    mouth: dna.slice(12, 16),
    accessory1: dna.slice(16, 20),
    accessory2: dna.slice(20, 24),
    effects: dna.slice(24, 28),
  };

  // Convert hex to trait indices (simplified)
  const toIndex = (hex: string, max: number) => parseInt(hex, 16) % max;

  return {
    background: `bg_${toIndex(sections.background, 25)}`,
    body: `body_${toIndex(sections.body, 5)}`, // 5 base types
    eyes: `eyes_${toIndex(sections.eyes, 20)}`,
    mouth: `mouth_${toIndex(sections.mouth, 15)}`,
    accessories: [
      `acc_${toIndex(sections.accessory1, 40)}`,
      toIndex(sections.accessory2, 100) < 30
        ? `acc_${toIndex(sections.accessory2, 40)}`
        : "", // 30% chance of second accessory
    ].filter(Boolean),
    effects:
      toIndex(sections.effects, 100) < 30
        ? `effect_${toIndex(sections.effects, 20)}`
        : null, // 30% chance of effect
  };
}

/**
 * Calculate rarity score from traits
 */
export function calculateRarityScore(traits: TraitSet): number {
  let score = 0;

  // More accessories = rarer
  score += traits.accessories.length * 20;

  // Effects are rare
  if (traits.effects) {
    score += 50;
  }

  // Certain trait indices are rarer
  const bodyIndex = parseInt(traits.body.split("_")[1]);
  if (bodyIndex === 4)
    score += 100; // Alien
  else if (bodyIndex === 3)
    score += 50; // Mystic
  else if (bodyIndex === 2) score += 30; // Robot

  return score;
}

// =============================================================================
// SPELL GENERATION
// =============================================================================

/**
 * NFT genesis (mint) spell parameters
 */
export interface NFTGenesisParams {
  appId: string;
  appVk: string;
  ownerAddress: string;
  tokenId: number;
  dna: string;
  bloodline: Bloodline;
  baseType: BaseType;
  rarityTier: RarityTier;
  genesisBlock: number;
  heritage: number;
}

/**
 * Generate NFT genesis spell
 */
export function createNFTGenesisSpell(params: NFTGenesisParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;

  const initialState: SparkNFTState = {
    dna: params.dna,
    bloodline: params.bloodline,
    baseType: params.baseType,
    genesisBlock: params.genesisBlock,
    rarityTier: params.rarityTier,
    tokenId: params.tokenId,
    heritage: params.heritage,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: params.genesisBlock,
    evolutionCount: 0,
    tokensEarned: 0n,
    narrativeRoot: "",
    worldStateRoot: "",
    // Fase 2: fresh mints start unsettled (the on-chain contract enforces this
    // via is_valid_initial_state — last_settle_block==0, settle_count==0).
    lastSettleBlock: 0,
    settleCount: 0,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    ins: [], // Mint from nothing
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: initialState,
        },
        sats: 546,
      },
    ],
  };
}

/**
 * Work proof spell parameters (XP gain)
 */
export interface NFTWorkProofParams {
  appId: string;
  appVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  workProofHash: string;
  currentBlock: number;
}

/**
 * Generate work proof spell (adds XP)
 * XP is capped at the requirement for the next level to prevent overflow.
 */
export function createNFTWorkProofSpell(params: NFTWorkProofParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;
  const xpGain = calculateXpGain(params.currentState);
  const nextLevelReq = XP_REQUIREMENTS[params.currentState.level + 1];

  // Cap XP at the next level's requirement so the UTXO state stays bounded
  const rawNewXp = params.currentState.xp + xpGain;
  const cappedNewXp =
    nextLevelReq !== undefined ? Math.min(rawNewXp, nextLevelReq) : rawNewXp;

  const newState: SparkNFTState = {
    ...params.currentState,
    xp: cappedNewXp,
    totalXp: params.currentState.totalXp + xpGain,
    workCount: params.currentState.workCount + 1,
    lastWorkBlock: params.currentBlock,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    public_inputs: {
      work_proof: params.workProofHash,
      block_height: params.currentBlock,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}

/**
 * Work spell parameters (C3 closure — op `work`, PoW-verified on-chain).
 *
 * Carries the inputs needed to structure the spell's public_inputs (challenge,
 * difficulty, block_height) and the state transition (work_count bump,
 * last_work_block advance). The nonce and the full witness are NOT carried here
 * — the caller (buildWorkSpellRequest) assembles `app_private_inputs`
 * separately, since the prover takes it as a sibling field to the spell.
 */
export interface NFTWorkParams {
  appId: string;
  appVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  /** The PoW challenge (e.g. "tokenId:blockHeight"). Surfaced in public_inputs. */
  challenge: string;
  /** Required leading-zero bits the hash must have. Drives xp_gain derivation. */
  difficulty: number;
  /** Bitcoin block height → becomes lastWorkBlock. */
  currentBlock: number;
}

/**
 * Generate work spell (op `work` — C3 closure). Structures only the spell's
 * public_inputs (challenge, difficulty, block_height) and the state transition
 * (workCount bump, lastWorkBlock advance). The contract verifies the PoW
 * on-chain via the private witness `w` and derives xp_gain via
 * `xp_from_difficulty`; that witness (carrying the nonce) is assembled by the
 * caller, NOT here.
 *
 * The caller (buildWorkSpellRequest in the worker) is responsible for bumping
 * xp/totalXp in the outState to match the contract's derived value, because
 * the contract enforces `new.xp == old.xp + xp_from_difficulty(difficulty)`.
 */
export function createNFTWorkSpell(params: NFTWorkParams): SpellV2 {
  const appRef = `n/${params.appId}/${params.appVk}`;

  // Only bump workCount + lastWorkBlock. xp/totalXp left unchanged — the caller
  // bumps them to match the contract's derived xp_gain.
  // (See buildWorkSpellRequest in nft-evolution-service.ts, Task 1.2.)
  const newState: SparkNFTState = {
    ...params.currentState,
    workCount: params.currentState.workCount + 1,
    lastWorkBlock: params.currentBlock,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    // public_inputs (`_x`) is NOT dereferenced by `validate_work` — the
    // contract reads challenge/nonce/difficulty from the PRIVATE witness `w`
    // (`app_private_inputs`). We surface challenge/difficulty/block_height
    // here as informational public inputs; the nonce lives in the witness,
    // which the caller (buildWorkSpellRequest, Task 1.2) constructs.
    public_inputs: {
      challenge: params.challenge,
      difficulty: params.difficulty,
      block_height: params.currentBlock,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}

/**
 * Level up spell parameters
 */
export interface NFTLevelUpParams {
  nftAppId: string;
  nftAppVk: string;
  tokenAppId: string;
  tokenAppVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
}

/**
 * Generate level up spell (XP-based, no token burning).
 * Increases level by 1 and resets XP to 0.
 */
export function createNFTLevelUpSpell(params: NFTLevelUpParams): SpellV2 {
  if (params.currentState.level >= GENESIS_SPARKS_CONFIG.maxLevel) {
    throw new Error(
      `NFT is already at max level (${GENESIS_SPARKS_CONFIG.maxLevel}). Cannot level up further.`,
    );
  }

  const nftAppRef = `n/${params.nftAppId}/${params.nftAppVk}`;
  const nextLevel = params.currentState.level + 1;

  const newState: SparkNFTState = {
    ...params.currentState,
    level: nextLevel,
    xp: 0,
    evolutionCount: params.currentState.evolutionCount + 1,
  };

  return {
    version: 2,
    apps: {
      $00: nftAppRef,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}

// =============================================================================
// SETTLEMENT (Fase 2 — Block-Tick batch settlement)
// =============================================================================

/**
 * Settle spell parameters. Commits an accumulated narrative Merkle root on-chain
 * and advances the settlement counter. Gameplay counters (level, xp, tokens) are
 * preserved unchanged — settle anchors narrative only.
 *
 * See spec Sección 2 / AI_WORLD_ENGINE F7.
 */
export interface NFTSettleParams {
  appId: string;
  appVk: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  narrativeRoot: string; // 64-hex-char new Merkle root
  settleBlock: number; // bitcoin block height at settlement
}

/**
 * Generate a settle spell — commits the narrative root + advances the settle
 * counter. The on-chain contract (`validate_settle` in genesis-babies) checks:
 *   - the root is a well-formed 64-hex-char string,
 *   - `settleCount` ticks by exactly 1,
 *   - `lastSettleBlock` moves strictly forward,
 *   - all gameplay counters (level, xp, totalXp, workCount, evolutionCount,
 *     tokensEarned, lastWorkBlock) are UNCHANGED.
 *
 * This function mirrors those checks client-side (failing fast with a clear
 * error) so misbuilt spells are rejected before they reach the prover.
 */
export function createNFTSettleSpell(params: NFTSettleParams): SpellV2 {
  if (
    params.narrativeRoot.length !== 64 ||
    !/^[0-9a-fA-F]{64}$/.test(params.narrativeRoot)
  ) {
    throw new Error(
      `Invalid narrative root: must be 64 hex chars, got length ${params.narrativeRoot.length}`,
    );
  }
  if (params.settleBlock <= params.currentState.lastSettleBlock) {
    throw new Error(
      `Settle block must advance: ${params.settleBlock} <= ${params.currentState.lastSettleBlock}`,
    );
  }

  const appRef = `n/${params.appId}/${params.appVk}`;
  const newState: SparkNFTState = {
    ...params.currentState,
    narrativeRoot: params.narrativeRoot,
    lastSettleBlock: params.settleBlock,
    settleCount: (params.currentState.settleCount ?? 0) + 1,
  };

  return {
    version: 2,
    apps: {
      $00: appRef,
    },
    ins: [
      {
        utxo_id: `${params.nftUtxo.txid}:${params.nftUtxo.vout}`,
        charms: {
          $00: params.currentState,
        },
      },
    ],
    outs: [
      {
        address: params.ownerAddress,
        charms: {
          $00: newState,
        },
        sats: 546,
      },
    ],
  };
}
