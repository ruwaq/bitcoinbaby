/**
 * Baby Brain Engine - Procedural Text Generator
 *
 * Lightweight, zero-download drop-in replacement for the full AI engine.
 * Generates text procedurally using seed-based templates — always available,
 * starts instantly, and produces deterministic, verifiable outputs for PoUW.
 *
 * The "Baby Brain" is thematically the Genesis Spark's own thinking engine:
 * as the baby grows, its thoughts become more sophisticated.
 */

import { createLogger } from "@bitcoinbaby/shared";
import type { AITask, AIResult, AIProof, AIProgressData } from "./types";

const log = createLogger("BabyBrain");

// =============================================================================
// TYPES
// =============================================================================

export interface BabyBrainConfig {
  /** Brain complexity level (1-10), affects output sophistication */
  level?: number;
}

// =============================================================================
// TEMPLATE ENGINE
// =============================================================================

/** Deterministic PRNG seeded from a string (block hash) */
function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  let s = Math.abs(h) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/** Extract a deterministic sequence of numbers from a seed */
function seedToValues(seed: string, count: number): number[] {
  const rng = seededRandom(seed);
  return Array.from({ length: count }, () => rng());
}

const SPARK_NAMES = [
  "Satoshi",
  "Nakamoto",
  "Blocky",
  "Hashy",
  "Miner",
  "Genny",
  "Bitzy",
  "Chainy",
  "Nody",
  "Crypto",
  "Ledger",
  "Merkle",
  "Taproot",
  "Sats",
  "Nonce",
  "Mempool",
];

const CONCEPTS = [
  "blockchain blocks",
  "digital gold",
  "mining rewards",
  "hash functions",
  "proof of work",
  "decentralization",
  "the mempool",
  "validator nodes",
  "consensus rules",
  "lightning channels",
  "the genesis block",
  "difficulty adjustment",
  "Satoshi's whitepaper",
  "UTXO sets",
];

const LOCATIONS = [
  "blockchain playground",
  "mempool nursery",
  "hash rate garden",
  "difficulty mountain",
  "consensus library",
  "validator school",
  "taproot treehouse",
  "lightning tower",
  "mining crib",
];

const EMOTIONS = [
  "wonder",
  "excitement",
  "curiosity",
  "determination",
  "joy",
  "amazement",
  "inspiration",
  "delight",
];

const ACTIONS = [
  "stacked blocks",
  "validated transactions",
  "found a nonce",
  "verified signatures",
  "built a merkle tree",
  "mined a share",
  "broadcast a transaction",
  "synced with the network",
];

const LESSONS = [
  "every hash is unique like a snowflake",
  "decentralization makes the network strong",
  "small blocks can carry big dreams",
  "proof of work is proof of commitment",
  "the longest chain tells the truest story",
  "each block builds on the ones before",
  "trustless systems create the most trust",
  "mathematics secures more than walls ever could",
];

// =============================================================================
// TEMPLATE COLLECTIONS
// =============================================================================

interface TemplateSet {
  level: number; // minimum brain level for this template
  templates: string[];
}

const LORE_TEMPLATES: TemplateSet[] = [
  {
    level: 1,
    templates: [
      "Baby {name} discovered {concept} while playing in the {location}. The little one felt {emotion}.",
      "In the {location}, {name} learned that {lesson}. What a day!",
      "{name} looked at {concept} with {emotion}. The baby was learning fast.",
    ],
  },
  {
    level: 3,
    templates: [
      "Baby {name} spent the morning exploring {concept} near the {location}. After careful study, {pronoun} realized {lesson}. The discovery filled {pronoun} with {emotion}.",
      'At the {location}, {name} connected {concept} with the day\'s mining results. "{lesson}," {pronoun} thought, feeling {emotion}.',
      "During a quiet moment at the {location}, {name} had a breakthrough about {concept}. The insight was clear: {lesson}. {emotion} radiated from the tiny miner.",
    ],
  },
  {
    level: 6,
    templates: [
      'The {location} hummed with activity as {name} delved deep into {concept}. After {action}, patterns emerged from the noise. "{lesson}," {pronoun} whispered, {emotion} evident in {pronoun}\'s tiny voice. The discovery would change everything.',
      "{name} sat cross-legged in the {location}, surrounded by floating blocks and shimmering hashes. The study of {concept} had consumed {pronoun} for hours. When clarity finally came — {lesson} — {pronoun} jumped up with {emotion}, scattering data crystals everywhere.",
      "Three days of studying {concept} at the {location} led {name} to a profound realization. Having {action}, {pronoun} understood: {lesson}. The {emotion} was overwhelming. Even the ancient miners would be proud.",
    ],
  },
];

const TECHNICAL_TEMPLATES: TemplateSet[] = [
  {
    level: 2,
    templates: [
      "Today {name} learned about {concept}. The basics: hashes, blocks, and chains. Simple but powerful.",
      "{name} practiced {action}. Each attempt was better than the last. Progress!",
      "Studying {concept} in the {location}, {name} took notes carefully. The fundamentals matter.",
    ],
  },
  {
    level: 4,
    templates: [
      "{name} ran a simulation of {concept} using the {location}'s quantum sandbox. After {action}, the results showed: {lesson}. Statistical significance: high. Confidence: growing.",
      "Technical analysis of {concept} commenced at the {location}. {name} configured the parameters, ran {action}, and observed: {lesson}. This warranted further investigation.",
      "The diagnostics on {concept} returned fascinating data. {name}, having {action}, correlated the findings: {lesson}. The implications for block validation were significant.",
    ],
  },
  {
    level: 7,
    templates: [
      "ABSTRACT — This paper presents findings on {concept} from experiments conducted at the {location}. Baby {name}, after {action}, demonstrates that {lesson}. The methodology involved deterministic seed analysis, template-based generation, and cross-referencing with known blockchain states. Results indicate a 99.7% confidence in the hypothesis.",
      "TECHNICAL REPORT — Subject: {concept}. Location: {location}. Researcher: {name}. Method: {action}. Key insight: {lesson}. The experiment confirms theoretical predictions and opens new avenues for exploration in consensus mechanisms.",
    ],
  },
];

const STORY_TEMPLATES: TemplateSet[] = [
  {
    level: 1,
    templates: [
      "Once upon a time, {name} went to the {location}. There, {pronoun} found {concept}. {emotion}! The end.",
      "{name} woke up feeling {emotion}. Today was the day to explore {concept}. Adventure awaited!",
    ],
  },
  {
    level: 3,
    templates: [
      "Chapter 1: The Discovery\n\n{name} had always been curious about {concept}. One morning at the {location}, {pronoun} decided to investigate. After {action}, {pronoun} learned that {lesson}. The {emotion} was just the beginning of a much larger adventure.",
    ],
  },
  {
    level: 5,
    templates: [
      "THE BABY MINER CHRONICLES\nEpisode {episode}: The Mystery of {concept}\n\nDeep within the {location}, {name} faced the biggest challenge yet. Rumors of {concept} had spread across the network. Armed with nothing but {pronoun}'s trusty abacus and unwavering determination, {pronoun} began the investigation.\n\nAfter hours of {action}, a breakthrough: {lesson}. The mystery was solved, but {name} knew this was only the first clue in a much larger puzzle. {emotion} propelled {pronoun} forward into the next chapter.",
    ],
  },
];

const ALL_TEMPLATE_SETS = [
  ...LORE_TEMPLATES,
  ...TECHNICAL_TEMPLATES,
  ...STORY_TEMPLATES,
];

// =============================================================================
// ENGINE
// =============================================================================

export class BabyBrainEngine {
  private config: BabyBrainConfig;
  private isInitialized = false;
  private currentLevel = 1;

  constructor(config: BabyBrainConfig = {}) {
    this.config = { level: 5, ...config };
    this.currentLevel = this.config.level!;
  }

  /**
   * Initialize — resolves instantly, no model download needed.
   * The onProgress callback is called once with 100% for UI consistency.
   */
  async initialize(
    onProgress?: (progressData: AIProgressData) => void,
  ): Promise<void> {
    if (this.isInitialized) return;

    log.info("Initializing Baby Brain Engine (instant, no download)...");

    // Simulate a brief initialization for UX feedback
    if (onProgress) {
      onProgress({
        progress: 50,
        loaded: 0,
        total: 0,
        status: "initiate",
        file: "baby-brain.wisdom",
        filesCount: 1,
        doneCount: 0,
      });
    }

    // Tiny delay so the UI can show the transition
    await new Promise((r) => setTimeout(r, 100));

    if (onProgress) {
      onProgress({
        progress: 100,
        loaded: 1,
        total: 1,
        status: "done",
        file: "baby-brain.wisdom",
        filesCount: 1,
        doneCount: 1,
      });
    }

    this.isInitialized = true;
    log.info("Baby Brain ready! Level:", { level: this.currentLevel });
  }

  /**
   * Execute a task using procedural text generation.
   * Deterministic: same task.seed always produces the same output.
   */
  async executeTask(task: AITask): Promise<AIResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = performance.now();

    let output: string;
    try {
      output = this.generate(task.input, task.seed);
    } catch (error) {
      log.error("Baby Brain generation failed", { error });
      output = "Baby brain needs a nap... zzz..."; // never fails
    }

    const computeTime = performance.now() - startTime;

    // Generate cryptographic proof (same structure as full AI engine)
    const proofData: AIProof = {
      taskId: task.id,
      taskType: task.type,
      inputPrompt: task.input,
      seed: task.seed,
      output,
      computeTime,
      modelId: `baby-brain-v${this.currentLevel}`,
      timestamp: Date.now(),
    };

    const proofHash = await this.sha256(JSON.stringify(proofData));
    const proof = JSON.stringify({ ...proofData, hash: proofHash });

    return {
      taskId: task.id,
      output,
      computeTime,
      proof,
      verified: false, // Server-side verification
    };
  }

  /**
   * Core generation logic — deterministic from seed.
   */
  private generate(prompt: string, seed: string): string {
    const rng = seededRandom(seed);
    const values = seedToValues(seed, 20);

    // Classify the prompt to pick the right template category
    const promptLower = prompt.toLowerCase();
    let templatePool: TemplateSet[];

    if (
      promptLower.includes("technical") ||
      promptLower.includes("explain") ||
      promptLower.includes("summarize") ||
      promptLower.includes("how does")
    ) {
      templatePool = TECHNICAL_TEMPLATES;
    } else if (
      promptLower.includes("story") ||
      promptLower.includes("describe") ||
      promptLower.includes("write a")
    ) {
      templatePool = STORY_TEMPLATES;
    } else {
      templatePool = LORE_TEMPLATES;
    }

    // Filter templates by current brain level
    const available = templatePool.filter((t) => t.level <= this.currentLevel);
    const pool = available.length > 0 ? available : templatePool;

    // Deterministically select template set and template
    const setIdx = Math.floor(values[0] * pool.length);
    const selectedSet = pool[setIdx % pool.length];
    const tplIdx = Math.floor(values[1] * selectedSet.templates.length);
    let template = selectedSet.templates[tplIdx % selectedSet.templates.length];

    // Fill template slots
    const name = SPARK_NAMES[Math.floor(values[2] * SPARK_NAMES.length)];
    const pronoun =
      name === "Satoshi" || name === "Nakamoto"
        ? "they"
        : Math.floor(values[3] * 2) < 1
          ? "he"
          : "she";
    const concept = CONCEPTS[Math.floor(values[4] * CONCEPTS.length)];
    const location = LOCATIONS[Math.floor(values[5] * LOCATIONS.length)];
    const emotion = EMOTIONS[Math.floor(values[6] * EMOTIONS.length)];
    const action = ACTIONS[Math.floor(values[7] * ACTIONS.length)];
    const lesson = LESSONS[Math.floor(values[8] * LESSONS.length)];
    const episode = Math.floor(values[9] * 100) + 1;

    template = template
      .replace(/\{name\}/g, name)
      .replace(/\{pronoun\}/g, pronoun)
      .replace(/\{concept\}/g, concept)
      .replace(/\{location\}/g, location)
      .replace(/\{emotion\}/g, emotion)
      .replace(/\{action\}/g, action)
      .replace(/\{lesson\}/g, lesson)
      .replace(/\{episode\}/g, String(episode));

    return template;
  }

  /**
   * Verify a proof's structural integrity.
   */
  async verifyProof(proofString: string): Promise<boolean> {
    try {
      const proof = JSON.parse(proofString);
      const { hash, ...proofData } = proof;
      const expectedHash = await this.sha256(JSON.stringify(proofData));
      return hash === expectedHash;
    } catch {
      return false;
    }
  }

  /**
   * SHA-256 via Web Crypto API
   */
  private async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(data),
    );
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Set brain level (affects output complexity)
   */
  setLevel(level: number): void {
    this.currentLevel = Math.max(1, Math.min(10, level));
    log.info("Baby Brain level set to", { level: this.currentLevel });
  }

  /** No GPU resources to release */
  dispose(): void {
    this.isInitialized = false;
    log.info("Baby Brain disposed (no GPU resources)");
  }

  getStatus(): {
    initialized: boolean;
    hasWebGPU: boolean;
    modelLoaded: string;
    level: number;
    modelChainStatus: Array<{
      id: string;
      name: string;
      status: "pending" | "loading" | "loaded" | "failed";
      error?: string;
    }>;
  } {
    return {
      initialized: this.isInitialized,
      hasWebGPU: false,
      modelLoaded: `baby-brain-v${this.currentLevel}`,
      level: this.currentLevel,
      modelChainStatus: [
        { id: "baby-brain", name: "BabyBrain", status: "loaded" },
      ],
    };
  }

  async hasWebGPU(): Promise<boolean> {
    return false;
  }
}
