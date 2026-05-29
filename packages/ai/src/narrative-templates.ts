/**
 * Narrative templates by BaseType + Bloodline combination.
 *
 * Each combination has a distinct tone. Templates use {slots} filled
 * by the NarrativeEngine based on AI output and NFT state.
 *
 * Structure mirrors the table from AI_WORLD_ENGINE.md:
 *   alien+rogue  → hacks, space, forbidden tech
 *   mystic+mystic → visions, prophecies, cosmic energy
 *   robot+warrior → calculated combat, system upgrades
 *   human+royal   → leadership, alliances, diplomacy
 *   animal+rogue  → instinct, survival, nature, pack
 */

import type {
  NarrativeEventType,
  NarrativeContext,
  PersonalityTraits,
  Mood,
  Archetype,
} from "./narrative-types";
import type { BaseType, Bloodline } from "./narrative-types";

// =============================================================================
// SLOT FILLERS
// =============================================================================

export interface TemplateSlots {
  title: string;
  description: string;
  eventType: NarrativeEventType;
  traitImpacts: Partial<PersonalityTraits>;
  moodEffect?: Mood;
}

export type TemplateFn = (ctx: NarrativeContext) => TemplateSlots;

// =============================================================================
// WORD BANKS BY TONE
// =============================================================================

const TONE_BANKS: Record<
  string,
  {
    subjects: string[];
    actions: string[];
    discoveries: string[];
    moods: Mood[];
  }
> = {
  "alien-rogue": {
    subjects: [
      "an encrypted transmission",
      "a derelict satellite",
      "forbidden code",
      "the dark side of the chain",
      "an alien frequency",
      "quantum noise patterns",
    ],
    actions: [
      "decrypted",
      "hacked into",
      "bypassed",
      "reprogrammed",
      "infiltrated",
      "extracted data from",
      "reverse-engineered",
    ],
    discoveries: [
      "a backdoor in an old mining protocol",
      "signals from beyond the mempool",
      "code that shouldn't exist in this block height",
      "an ancient key signing algorithm with hidden power",
    ],
    moods: ["rebellious", "curious", "focused"],
  },
  "mystic-mystic": {
    subjects: [
      "a cosmic vision",
      "the ethereal plane of consensus",
      "whispers from future blocks",
      "a prophecy in the nonce",
      "energy signatures in the hash",
      "the blockchain's dream",
    ],
    actions: [
      "meditated on",
      "channeled energy through",
      "received a vision of",
      "attuned to",
      "deciphered the aura of",
      "felt the resonance of",
    ],
    discoveries: [
      "that every hash carries a fragment of the universe's truth",
      "a hidden dimension within the proof-of-work algorithm",
      "that time is just another chain of blocks",
      "the mathematical beauty underlying scarcity itself",
    ],
    moods: ["amazed", "curious", "focused"],
  },
  "robot-warrior": {
    subjects: [
      "the mining rig's combat systems",
      "an efficiency anomaly",
      "tactical blockchain data",
      "the hashrate battlefield",
      "system defense protocols",
      "the optimal nonce strategy",
    ],
    actions: [
      "analyzed",
      "optimized",
      "engaged with",
      "deployed countermeasures against",
      "calibrated",
      "ran battle simulations on",
      "fortified defenses around",
    ],
    discoveries: [
      "a 0.3% efficiency gain through tactical nonce selection",
      "that the mempool shows signs of an incoming difficulty assault",
      "a vulnerability in lazy validation that could be exploited - or patched",
      "the perfect balance between hash power and thermal limits",
    ],
    moods: ["focused", "rebellious", "tired"],
  },
  "human-royal": {
    subjects: [
      "the council of miners",
      "a diplomatic message from another pool",
      "the community's needs",
      "a grand alliance proposal",
      "the festival of found blocks",
      "the ledger of friendships",
    ],
    actions: [
      "convened with",
      "brokered peace between",
      "organized support for",
      "inspired",
      "united",
      "negotiated terms with",
      "celebrated alongside",
    ],
    discoveries: [
      "that community trust is the rarest and most valuable resource",
      "a new way to share mining rewards more fairly",
      "that leadership isn't about hashrate — it's about heart",
      "an ancient charter protecting the rights of all miners, big and small",
    ],
    moods: ["happy", "curious", "focused"],
  },
  "animal-rogue": {
    subjects: [
      "a scent trail through the blockchain",
      "wild transactions in the undergrowth",
      "the pack's territory markers",
      "survival patterns in the mempool",
      "the call of a rival pack",
      "hidden caches in forgotten blocks",
    ],
    actions: [
      "tracked",
      "stalked through the underbrush of",
      "scent-marked territory around",
      "howled at",
      "pounced on",
      "dug up secrets from",
      "led the pack to",
    ],
    discoveries: [
      "a hidden watering hole of forgotten satoshis",
      "that the strongest chain survives — but the smartest pack thrives",
      "traces of a legendary beast that once mined the genesis block",
      "an instinct-level understanding of market cycles — like seasons",
    ],
    moods: ["curious", "rebellious", "tired"],
  },
};

// =============================================================================
// DEFAULT (for unknown combinations)
// =============================================================================

const DEFAULT_TONE = TONE_BANKS["human-royal"];

function getTone(baseType: BaseType, bloodline: Bloodline) {
  const key = `${baseType}-${bloodline}`;
  return TONE_BANKS[key] ?? DEFAULT_TONE;
}

// =============================================================================
// DETERMINISTIC HELPERS
// =============================================================================

function pickFromSeed<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

/** Extract a numeric seed from a string (djb2) */
function hashSeed(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return h;
}

// =============================================================================
// EVENT TYPE CLASSIFIER
// =============================================================================

const EVENT_TYPE_KEYWORDS: [NarrativeEventType, string[]][] = [
  [
    "MYSTICAL",
    [
      "vision",
      "prophecy",
      "cosmic",
      "energy",
      "spirit",
      "dream",
      "whisper",
      "aura",
      "dimension",
      "ancient",
      "ritual",
    ],
  ],
  [
    "TECHNICAL",
    [
      "analyze",
      "compute",
      "hash",
      "nonce",
      "difficulty",
      "block",
      "transaction",
      "verify",
      "validate",
      "optimize",
      "calibrate",
      "efficiency",
    ],
  ],
  [
    "DISCOVERY",
    [
      "discover",
      "found",
      "uncover",
      "reveal",
      "secret",
      "hidden",
      "breakthrough",
      "realized",
      "insight",
    ],
  ],
  [
    "SOCIAL",
    [
      "friend",
      "ally",
      "community",
      "pack",
      "council",
      "diplomacy",
      "together",
      "shared",
      "helped",
      "taught",
    ],
  ],
  [
    "EVOLUTION",
    ["evolve", "transform", "level up", "grow", "mutate", "ascend"],
  ],
];

function classifyEventType(
  aiOutput: string,
  ctx: NarrativeContext,
): NarrativeEventType {
  const lower = aiOutput.toLowerCase();

  // Evolution events at level thresholds
  if (ctx.nft.level > 1 && ctx.nft.xp < 50) {
    return "EVOLUTION";
  }

  for (const [type, keywords] of EVENT_TYPE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return type;
    }
  }

  return "LORE";
}

// =============================================================================
// TITLE GENERATOR
// =============================================================================

function generateTitle(
  ctx: NarrativeContext,
  eventType: NarrativeEventType,
): string {
  const tone = getTone(ctx.nft.baseType, ctx.nft.bloodline);
  const seed = hashSeed(ctx.aiOutput);

  const formats: Record<NarrativeEventType, string[]> = {
    LORE: [
      `The ${ctx.archetype}'s Journey`,
      `Tales from the ${ctx.nft.baseType} Nursery`,
      `A ${ctx.mood} Day in the Blockchain`,
      `Whispers of ${pickFromSeed(tone.subjects, seed)}`,
    ],
    DISCOVERY: [
      `Breakthrough: ${ctx.nft.baseType} finds ${pickFromSeed(tone.discoveries, seed + 1).slice(0, 40)}`,
      `${pickFromSeed(["Eureka!", "Aha!", "Found it!", "Incredible!"], seed)} New Discovery`,
      `The ${ctx.archetype} Unlocks a Secret`,
    ],
    TECHNICAL: [
      `Analysis Report: ${pickFromSeed(tone.subjects, seed).slice(0, 30)}`,
      `Technical Breakthrough in the ${pickFromSeed(["Mempool", "Hash Lab", "Block Forge", "Chain Grid"], seed)}`,
      `System Optimization by ${ctx.archetype}`,
    ],
    SOCIAL: [
      `A New ${pickFromSeed(["Friend", "Ally", "Rival", "Connection"], seed)}`,
      `The ${ctx.archetype} Meets the Community`,
      `${pickFromSeed(["United", "Together", "Connected"], seed)} in the Blockchain`,
    ],
    MYSTICAL: [
      `Vision: ${pickFromSeed(tone.subjects, seed).slice(0, 35)}`,
      `The ${ctx.archetype}'s Prophecy`,
      `${pickFromSeed(["Cosmic", "Mystical", "Spiritual", "Ancient"], seed)} Revelation`,
    ],
    EVOLUTION: [
      `${ctx.nft.baseType} Evolution: Level ${ctx.nft.level} Achieved!`,
      `${pickFromSeed(["Transformation!", "Growth Spurt!", "Power Up!", "Ascension!"], seed)}`,
      `The ${ctx.archetype} Evolves`,
    ],
  };

  const options = formats[eventType];
  return pickFromSeed(options, seed + 2);
}

// =============================================================================
// DESCRIPTION GENERATOR
// =============================================================================

function generateDescription(
  ctx: NarrativeContext,
  eventType: NarrativeEventType,
): string {
  const tone = getTone(ctx.nft.baseType, ctx.nft.bloodline);
  const seed = hashSeed(ctx.aiOutput);
  const subject = pickFromSeed(tone.subjects, seed);
  const action = pickFromSeed(tone.actions, seed + 1);
  const discovery = pickFromSeed(tone.discoveries, seed + 2);

  // Blend AI output flavor into the description
  const flavor = ctx.aiOutput.slice(0, 150).trim();

  const templates: Record<NarrativeEventType, string> = {
    LORE: `While mining block ${ctx.nft.lastWorkBlock}, the ${ctx.nft.baseType} baby ${action} ${subject}. The experience was deeply ${ctx.mood}. "${flavor}"`,
    DISCOVERY: `During a routine mining session, ${action} ${subject} and discovered ${discovery}. The realization was profound. "${flavor}"`,
    TECHNICAL: `[Report #${ctx.workCount}] ${action} ${subject}. Analysis revealed ${discovery}. The data suggests continued optimization is possible. "${flavor}"`,
    SOCIAL: `At the mining hub, ${action} ${subject}. The interaction revealed ${discovery}. Bonds were strengthened. "${flavor}"`,
    MYSTICAL: `In a moment of deep focus, ${action} ${subject}. The vision was clear: ${discovery}. The ${ctx.archetype} felt truly ${ctx.mood}. "${flavor}"`,
    EVOLUTION: `The ${ctx.nft.baseType} baby has reached Level ${ctx.nft.level}! ${action} ${subject}, marking a new chapter. ${discovery}. "${flavor}"`,
  };

  return templates[eventType];
}

// =============================================================================
// TRAIT IMPACTS
// =============================================================================

function calculateTraitImpacts(
  ctx: NarrativeContext,
  eventType: NarrativeEventType,
): Partial<PersonalityTraits> {
  const seed = hashSeed(ctx.aiOutput);

  const impacts: Record<NarrativeEventType, () => Partial<PersonalityTraits>> =
    {
      LORE: () => ({
        curiosity: Math.min(3, Math.abs(seed % 5)),
        creativity: Math.min(2, Math.abs((seed + 1) % 4)),
      }),
      DISCOVERY: () => ({
        curiosity: Math.min(5, Math.abs(seed % 7)),
        logic: Math.min(3, Math.abs((seed + 1) % 5)),
        creativity: Math.min(2, Math.abs((seed + 2) % 4)),
      }),
      TECHNICAL: () => ({
        logic: Math.min(4, Math.abs(seed % 6)),
        curiosity: Math.min(2, Math.abs((seed + 1) % 4)),
      }),
      SOCIAL: () => ({
        empathy: Math.min(4, Math.abs(seed % 6)),
        humor: Math.min(3, Math.abs((seed + 1) % 5)),
      }),
      MYSTICAL: () => ({
        creativity: Math.min(5, Math.abs(seed % 7)),
        curiosity: Math.min(3, Math.abs((seed + 1) % 5)),
      }),
      EVOLUTION: () => ({
        curiosity: Math.min(2, Math.abs(seed % 4)),
        logic: Math.min(2, Math.abs((seed + 1) % 4)),
        creativity: Math.min(2, Math.abs((seed + 2) % 4)),
        empathy: Math.min(2, Math.abs((seed + 3) % 4)),
        humor: Math.min(2, Math.abs((seed + 4) % 4)),
      }),
    };

  return impacts[eventType]();
}

// =============================================================================
// MOOD EFFECT
// =============================================================================

function calculateMoodEffect(
  ctx: NarrativeContext,
  eventType: NarrativeEventType,
): Mood | undefined {
  const tone = getTone(ctx.nft.baseType, ctx.nft.bloodline);
  const seed = hashSeed(ctx.aiOutput);

  // 40% chance of mood change per event
  if (Math.abs(seed % 10) < 4) {
    return pickFromSeed(tone.moods, seed + 5);
  }

  return undefined;
}

// =============================================================================
// PUBLIC API
// =============================================================================

export function buildNarrativeSlots(ctx: NarrativeContext): TemplateSlots {
  const eventType = classifyEventType(ctx.aiOutput, ctx);
  const title = generateTitle(ctx, eventType);
  const description = generateDescription(ctx, eventType);
  const traitImpacts = calculateTraitImpacts(ctx, eventType);
  const moodEffect = calculateMoodEffect(ctx, eventType);

  return { title, description, eventType, traitImpacts, moodEffect };
}

// =============================================================================
// BACKSTORY & PERSONALITY GENERATION (static, deterministic from DNA)
// =============================================================================

const ARCHETYPES: Archetype[] = [
  "Cyber Miner",
  "Quantum Scholar",
  "Pixel Shaman",
  "Chain Whisperer",
  "Hash Alchemist",
  "Block Bard",
  "Nonce Ninja",
  "Mempool Monk",
];

const BACKSTORY_TEMPLATES: Record<BaseType, string[]> = {
  human: [
    "Born in block #{block}, a human baby with {bloodline} blood. Destined to unite miners across the chain.",
    "In the great block #{block}, a {bloodline} human emerged — a natural leader from the first hash.",
  ],
  animal: [
    "From the wild mempool of block #{block}, an animal baby of {bloodline} lineage appeared. Instinct guides every move.",
    "Block #{block}: a {bloodline} animal baby was found near the genesis watering hole. The pack sensed something special.",
  ],
  robot: [
    "Assembled at block #{block}, this robot baby runs {bloodline} firmware v1.0. Efficiency is its first directive.",
    "Block #{block} boot sequence complete. {bloodline}-class robot baby online. Mission: optimize all the things.",
  ],
  mystic: [
    "When block #{block} was mined, a {bloodline} mystic baby manifested from the hash itself. The blockchain whispered its first prophecy.",
    "The elders foretold a {bloodline} mystic would appear at block #{block}. The cosmos aligned with the difficulty adjustment.",
  ],
  alien: [
    "Transmission received at block #{block}: a {bloodline} alien baby. Origin unknown. Purpose: classified.",
    "Block #{block} contained something extra — a {bloodline} alien baby, encoded in the coinbase transaction. First contact.",
  ],
};

export function generateBackstory(
  dna: string,
  baseType: BaseType,
  bloodline: Bloodline,
  genesisBlock: number,
): string {
  const templates = BACKSTORY_TEMPLATES[baseType] ?? BACKSTORY_TEMPLATES.human;
  const seed = hashSeed(dna);
  const template = pickFromSeed(templates, seed);
  return template
    .replace("{block}", String(genesisBlock))
    .replace("{bloodline}", bloodline);
}

export function generatePersonality(dna: string): PersonalityTraits {
  // Deterministic from DNA sections
  const segments = [
    dna.slice(0, 12),
    dna.slice(13, 25),
    dna.slice(26, 38),
    dna.slice(39, 51),
    dna.slice(52, 64),
  ];
  const traits = segments.map((s) => (parseInt(s, 16) % 51) + 50); // 50-100 base range
  return {
    curiosity: traits[0],
    creativity: traits[1],
    logic: traits[2],
    empathy: traits[3],
    humor: traits[4],
  };
}

export function generateArchetype(dna: string): Archetype {
  const seed = hashSeed(dna);
  return ARCHETYPES[Math.abs(seed) % ARCHETYPES.length];
}
