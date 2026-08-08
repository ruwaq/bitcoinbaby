/**
 * Narrative types for AI World Engine.
 * Off-chain types that describe the baby's personality, story, and world state.
 */

// Minimal canonical type mirrors (avoids @bitcoinbaby/bitcoin dependency).
// NarrativeEngine operates on these lightweight types; the caller
// (core/mining or web) is responsible for passing the real SparkNFTState.

export type Bloodline = "royal" | "warrior" | "rogue" | "mystic";
export type RarityTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary"
  | "mythic";
export type BaseType = "human" | "animal" | "robot" | "mystic" | "alien";

export interface SparkNFTState {
  readonly dna: string;
  readonly bloodline: Bloodline;
  readonly baseType: BaseType;
  readonly genesisBlock: number;
  readonly rarityTier: RarityTier;
  readonly tokenId: number;
  readonly heritage: number;
  level: number;
  xp: number;
  totalXp: number;
  workCount: number;
  lastWorkBlock: number;
  evolutionCount: number;
  tokensEarned: bigint;
  narrativeRoot: string;
  worldStateRoot: string;
  // Fase 2 settlement state (mirrors on-chain SparkNFTState).
  lastSettleBlock: number;
  settleCount: number;
}

// =============================================================================
// PERSONALITY
// =============================================================================

export interface PersonalityTraits {
  curiosity: number; // 0-100
  creativity: number; // 0-100
  logic: number; // 0-100
  empathy: number; // 0-100
  humor: number; // 0-100
}

export type Archetype =
  | "Cyber Miner"
  | "Quantum Scholar"
  | "Pixel Shaman"
  | "Chain Whisperer"
  | "Hash Alchemist"
  | "Block Bard"
  | "Nonce Ninja"
  | "Mempool Monk";

export type Mood =
  | "happy"
  | "curious"
  | "tired"
  | "rebellious"
  | "focused"
  | "amazed";

export type NarrativeEventType =
  | "LORE"
  | "DISCOVERY"
  | "TECHNICAL"
  | "SOCIAL"
  | "MYSTICAL"
  | "EVOLUTION";

// =============================================================================
// EVENTS
// =============================================================================

export interface NarrativeEvent {
  id: string;
  timestamp: number;
  type: NarrativeEventType;
  title: string;
  description: string;
  modelUsed: string; // "smollm2" | "baby-brain" | "cloudflare-ai"
  traitImpacts: Partial<PersonalityTraits>;
  moodEffect?: Mood;
  aiOutputHash: string;
}

// =============================================================================
// NARRATIVE STATE (per baby, off-chain)
// =============================================================================

export interface NarrativeState {
  tokenId: number;
  events: NarrativeEvent[];
  personality: PersonalityTraits;
  archetype: Archetype;
  backstory: string;
  mood: Mood;
  faction: string | null;
  relationships: Relationship[];
  inventory: Item[];
}

export interface Relationship {
  targetTokenId: number;
  type: "friend" | "rival" | "mentor" | "student";
  strength: number; // 0-100
  lastInteraction: number;
}

export interface Item {
  id: string;
  name: string;
  type: "cosmetic" | "boost" | "key";
  acquiredAt: number;
}

// =============================================================================
// TEMPLATE CONTEXT
// =============================================================================

/** Context passed to template renderers */
export interface NarrativeContext {
  nft: SparkNFTState;
  personality: PersonalityTraits;
  archetype: Archetype;
  mood: Mood;
  /** Raw AI output to flavor the event */
  aiOutput: string;
  /** Recent events for continuity */
  recentEvents: NarrativeEvent[];
  /** Total work count (used for progression) */
  workCount: number;
}

// =============================================================================
// ENGINE OUTPUT
// =============================================================================

export interface NarrativeResult {
  event: NarrativeEvent;
  /** Updated personality after trait impacts */
  updatedPersonality: PersonalityTraits;
  /** Updated mood */
  updatedMood: Mood;
}
