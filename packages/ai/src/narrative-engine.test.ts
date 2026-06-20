/**
 * NarrativeEngine tests — deterministic generation from AI output.
 */

import { describe, it, expect } from "vitest";
import { NarrativeEngine } from "./narrative-engine";
import {
  generateBackstory,
  generatePersonality,
  generateArchetype,
  buildNarrativeSlots,
} from "./narrative-templates";
import type {
  NarrativeState,
  NarrativeContext,
  SparkNFTState,
} from "./narrative-types";

// =============================================================================
// FIXTURES
// =============================================================================

function makeNFT(overrides: Partial<SparkNFTState> = {}): SparkNFTState {
  return {
    dna: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    bloodline: "rogue",
    baseType: "alien",
    genesisBlock: 123456,
    rarityTier: "rare",
    tokenId: 42,
    level: 3,
    xp: 350,
    totalXp: 1500,
    workCount: 15,
    lastWorkBlock: 123500,
    evolutionCount: 2,
    tokensEarned: 500n,
    narrativeRoot: "",
    worldStateRoot: "",
    ...overrides,
  };
}

function makeNarrativeState(
  overrides: Partial<NarrativeState> = {},
): NarrativeState {
  return {
    tokenId: 42,
    events: [],
    personality: {
      curiosity: 60,
      creativity: 55,
      logic: 70,
      empathy: 45,
      humor: 50,
    },
    archetype: "Cyber Miner",
    backstory: "Born in block #123456, a rogue alien baby appeared.",
    mood: "curious",
    faction: null,
    relationships: [],
    inventory: [],
    ...overrides,
  };
}

// =============================================================================
// TESTS: Static generators
// =============================================================================

describe("generateBackstory", () => {
  it("generates deterministic backstory from DNA", () => {
    const b1 = generateBackstory("abc123", "alien", "rogue", 500000);
    const b2 = generateBackstory("abc123", "alien", "rogue", 500000);
    expect(b1).toBe(b2);
    expect(b1).toContain("500000");
    expect(b1).toContain("rogue");
  });

  it("different DNA with different baseType produces different backstory", () => {
    const b1 = generateBackstory("abc123", "human", "royal", 100);
    const b2 = generateBackstory("xyz999", "robot", "warrior", 200);
    expect(b1).not.toBe(b2);
  });
});

describe("generatePersonality", () => {
  it("generates traits in 50-100 range", () => {
    const p = generatePersonality(
      "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    );
    for (const [trait, val] of Object.entries(p)) {
      expect(val, `${trait} out of range: ${val}`).toBeGreaterThanOrEqual(50);
      expect(val, `${trait} out of range: ${val}`).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic", () => {
    const p1 = generatePersonality("deadbeef");
    const p2 = generatePersonality("deadbeef");
    expect(p1).toEqual(p2);
  });
});

describe("generateArchetype", () => {
  it("returns a valid archetype", () => {
    const valid = [
      "Cyber Miner",
      "Quantum Scholar",
      "Pixel Shaman",
      "Chain Whisperer",
      "Hash Alchemist",
      "Block Bard",
      "Nonce Ninja",
      "Mempool Monk",
    ];
    const a = generateArchetype("abc123");
    expect(valid).toContain(a);
  });

  it("is deterministic", () => {
    expect(generateArchetype("abc")).toBe(generateArchetype("abc"));
  });
});

// =============================================================================
// TESTS: NarrativeEngine
// =============================================================================

describe("NarrativeEngine.initNarrativeState", () => {
  it("creates state with backstory, personality, archetype", () => {
    const nft = makeNFT();
    const state = NarrativeEngine.initNarrativeState(nft);
    expect(state.tokenId).toBe(42);
    expect(state.backstory.length).toBeGreaterThan(0);
    expect(state.personality.curiosity).toBeGreaterThan(0);
    expect(state.archetype.length).toBeGreaterThan(0);
    expect(state.mood).toBe("curious");
    expect(state.events).toEqual([]);
  });

  it("is deterministic for same DNA", () => {
    const nft1 = makeNFT({ dna: "abc123" });
    const nft2 = makeNFT({ dna: "abc123" });
    const s1 = NarrativeEngine.initNarrativeState(nft1);
    const s2 = NarrativeEngine.initNarrativeState(nft2);
    expect(s1.personality).toEqual(s2.personality);
    expect(s1.archetype).toBe(s2.archetype);
    expect(s1.backstory).toBe(s2.backstory);
  });
});

describe("NarrativeEngine.getProgressiveTraits", () => {
  const fullTraits = {
    curiosity: 80,
    creativity: 75,
    logic: 90,
    empathy: 60,
    humor: 55,
  };

  it("level 1-2 only reveals curiosity", () => {
    const t = NarrativeEngine.getProgressiveTraits(fullTraits, 1);
    expect(t.curiosity).toBe(80);
    expect(t.creativity).toBe(0);
    expect(t.logic).toBe(0);
    expect(t.empathy).toBe(0);
    expect(t.humor).toBe(0);
  });

  it("level 3-5 reveals curiosity + creativity + logic", () => {
    const t = NarrativeEngine.getProgressiveTraits(fullTraits, 4);
    expect(t.curiosity).toBe(80);
    expect(t.creativity).toBe(75);
    expect(t.logic).toBe(90);
    expect(t.empathy).toBe(0);
    expect(t.humor).toBe(0);
  });

  it("level 6-8 reveals curiosity + creativity + logic + empathy + humor", () => {
    const t = NarrativeEngine.getProgressiveTraits(fullTraits, 7);
    expect(t.curiosity).toBe(80);
    expect(t.creativity).toBe(75);
    expect(t.logic).toBe(90);
    expect(t.empathy).toBe(60);
    expect(t.humor).toBe(55);
  });

  it("level 9-10 full reveal", () => {
    const t = NarrativeEngine.getProgressiveTraits(fullTraits, 10);
    expect(t).toEqual(fullTraits);
  });
});

describe("NarrativeEngine.processAIOutput", () => {
  it("returns a NarrativeResult with event", async () => {
    const engine = new NarrativeEngine();
    const nft = makeNFT();
    const state = makeNarrativeState();

    const result = await engine.processAIOutput(
      "analyze the blockchain difficulty adjustment and discover new patterns",
      nft,
      state,
      "baby-brain",
    );

    expect(result.event.id).toContain("narr-42-");
    expect(result.event.type).toBeDefined();
    expect(result.event.title.length).toBeGreaterThan(0);
    expect(result.event.description.length).toBeGreaterThan(0);
    expect(result.event.modelUsed).toBe("baby-brain");
    expect(result.event.aiOutputHash.length).toBe(64);
    expect(result.event.traitImpacts).toBeDefined();
    expect(result.updatedPersonality).toBeDefined();
    expect(result.updatedMood).toBeDefined();
  });

  it("updates personality traits within 0-100 bounds", async () => {
    const engine = new NarrativeEngine();
    const nft = makeNFT();
    const state = makeNarrativeState();

    const result = await engine.processAIOutput(
      "the baby discovered a hidden secret in the ancient mempool",
      nft,
      state,
      "smollm2",
    );

    for (const [trait, val] of Object.entries(result.updatedPersonality)) {
      expect(val, `${trait}: ${val}`).toBeGreaterThanOrEqual(0);
      expect(val, `${trait}: ${val}`).toBeLessThanOrEqual(100);
    }
  });

  it("appends events to state correctly", async () => {
    const engine = new NarrativeEngine();
    const nft = makeNFT();
    const state = makeNarrativeState();

    const r1 = await engine.processAIOutput(
      "compute the optimal nonce",
      nft,
      state,
      "baby-brain",
    );
    state.events.push(r1.event);

    const r2 = await engine.processAIOutput(
      "vision of a cosmic chain",
      nft,
      { ...state, personality: r1.updatedPersonality, mood: r1.updatedMood },
      "baby-brain",
    );

    expect(state.events.length).toBe(1);
    expect(r2.event.timestamp).toBeGreaterThanOrEqual(r1.event.timestamp);
  });
});

// =============================================================================
// TESTS: buildNarrativeSlots (template engine)
// =============================================================================

describe("buildNarrativeSlots", () => {
  it("returns valid slots for all base types", () => {
    const types: Array<SparkNFTState["baseType"]> = [
      "human",
      "animal",
      "robot",
      "mystic",
      "alien",
    ];
    const nft = makeNFT();
    const state = makeNarrativeState();

    for (const baseType of types) {
      const ctx: NarrativeContext = {
        nft: { ...nft, baseType },
        personality: state.personality,
        archetype: state.archetype,
        mood: state.mood,
        aiOutput: "the baby explores the blockchain",
        recentEvents: [],
        workCount: 5,
      };

      const slots = buildNarrativeSlots(ctx);
      expect(slots.title.length).toBeGreaterThan(0);
      expect(slots.description.length).toBeGreaterThan(0);
      expect([
        "LORE",
        "DISCOVERY",
        "TECHNICAL",
        "SOCIAL",
        "MYSTICAL",
        "EVOLUTION",
      ]).toContain(slots.eventType);
    }
  });

  it("classifies technical AI output as TECHNICAL", () => {
    const ctx: NarrativeContext = {
      nft: makeNFT(),
      personality: makeNarrativeState().personality,
      archetype: "Cyber Miner",
      mood: "curious",
      aiOutput: "analyze and optimize the hash function for better performance",
      recentEvents: [],
      workCount: 10,
    };

    const slots = buildNarrativeSlots(ctx);
    expect(slots.eventType).toBe("TECHNICAL");
  });

  it("classifies mystical AI output as MYSTICAL", () => {
    const ctx: NarrativeContext = {
      nft: makeNFT({ baseType: "mystic", bloodline: "mystic" }),
      personality: makeNarrativeState().personality,
      archetype: "Pixel Shaman",
      mood: "curious",
      aiOutput:
        "a cosmic vision of ancient prophecy whispers through the blockchain",
      recentEvents: [],
      workCount: 10,
    };

    const slots = buildNarrativeSlots(ctx);
    expect(slots.eventType).toBe("MYSTICAL");
  });

  it("classifies evolution for newly leveled babies", () => {
    const ctx: NarrativeContext = {
      nft: makeNFT({ level: 5, xp: 10 }),
      personality: makeNarrativeState().personality,
      archetype: "Hash Alchemist",
      mood: "amazed",
      aiOutput: "the baby grows stronger",
      recentEvents: [],
      workCount: 50,
    };

    const slots = buildNarrativeSlots(ctx);
    expect(slots.eventType).toBe("EVOLUTION");
  });
});
