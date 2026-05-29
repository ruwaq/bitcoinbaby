/**
 * E2E test: full AI World Engine pipeline (CLI-runnable via vitest).
 *
 * Covers: static generators → progressive traits → engine → edge cases.
 * Run: npx vitest run src/narrative-e2e.test.ts
 */

import { describe, it, expect } from "vitest";
import { NarrativeEngine } from "./narrative-engine";
import {
  generateBackstory,
  generatePersonality,
  generateArchetype,
  buildNarrativeSlots,
} from "./narrative-templates";
import type { BabyNFTState, NarrativeContext } from "./narrative-types";

// =============================================================================
// FIXTURES
// =============================================================================

const TEST_NFTS: BabyNFTState[] = [
  {
    dna: "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0",
    bloodline: "rogue",
    baseType: "alien",
    genesisBlock: 2_500_000,
    rarityTier: "rare",
    tokenId: 1,
    level: 3,
    xp: 350,
    totalXp: 1500,
    workCount: 15,
    lastWorkBlock: 2_580_000,
    evolutionCount: 2,
    tokensEarned: 500n,
    narrativeRoot: "",
    worldStateRoot: "",
  },
  {
    dna: "beefdeadcafe1234feed5678badc0ffee99aabbccddeeff0011223344556677",
    bloodline: "mystic",
    baseType: "mystic",
    genesisBlock: 2_501_000,
    rarityTier: "epic",
    tokenId: 2,
    level: 7,
    xp: 4200,
    totalXp: 25000,
    workCount: 200,
    lastWorkBlock: 2_580_100,
    evolutionCount: 6,
    tokensEarned: 5000n,
    narrativeRoot: "",
    worldStateRoot: "",
  },
  {
    dna: "1010101010101010101010101010101020202020202020202020202020202020",
    bloodline: "royal",
    baseType: "human",
    genesisBlock: 2_502_000,
    rarityTier: "legendary",
    tokenId: 3,
    level: 9,
    xp: 30000,
    totalXp: 150000,
    workCount: 800,
    lastWorkBlock: 2_580_200,
    evolutionCount: 8,
    tokensEarned: 25000n,
    narrativeRoot: "",
    worldStateRoot: "",
  },
  {
    dna: "ffffffff00000000deadbeefcafe1234abcdef9876543210feedfacec0ffeeee",
    bloodline: "warrior",
    baseType: "robot",
    genesisBlock: 2_503_000,
    rarityTier: "common",
    tokenId: 4,
    level: 2,
    xp: 80,
    totalXp: 180,
    workCount: 8,
    lastWorkBlock: 2_580_300,
    evolutionCount: 1,
    tokensEarned: 50n,
    narrativeRoot: "",
    worldStateRoot: "",
  },
  {
    dna: "cafebabecafebabecafebabecafebabe12345678123456781234567812345678",
    bloodline: "rogue",
    baseType: "animal",
    genesisBlock: 2_504_000,
    rarityTier: "uncommon",
    tokenId: 5,
    level: 4,
    xp: 800,
    totalXp: 3500,
    workCount: 45,
    lastWorkBlock: 2_580_400,
    evolutionCount: 3,
    tokensEarned: 300n,
    narrativeRoot: "",
    worldStateRoot: "",
  },
];

const AI_OUTPUTS = [
  "analyze and optimize the blockchain difficulty adjustment for maximum efficiency",
  "a cosmic vision of ancient prophecy whispers through the blockchain",
  "the baby uncovered a secret hidden in the genesis block",
  "the baby united the community of miners and shared knowledge with everyone",
  "the baby explored the dark corners of the mempool",
];

// =============================================================================
// E2E: Static generators
// =============================================================================

describe("E2E — Static Generators", () => {
  it("generates deterministic backstory for all base types", () => {
    for (const nft of TEST_NFTS) {
      const b1 = generateBackstory(
        nft.dna,
        nft.baseType,
        nft.bloodline,
        nft.genesisBlock,
      );
      const b2 = generateBackstory(
        nft.dna,
        nft.baseType,
        nft.bloodline,
        nft.genesisBlock,
      );
      expect(b1).toBe(b2);
      expect(b1.length).toBeGreaterThan(20);
    }
  });

  it("generates deterministic personality in 50-100 range", () => {
    for (const nft of TEST_NFTS) {
      const p1 = generatePersonality(nft.dna);
      const p2 = generatePersonality(nft.dna);
      expect(p1).toEqual(p2);
      for (const [trait, val] of Object.entries(p1)) {
        expect(val, `${trait}: ${val}`).toBeGreaterThanOrEqual(50);
        expect(val).toBeLessThanOrEqual(100);
      }
    }
  });

  it("generates deterministic archetype", () => {
    for (const nft of TEST_NFTS) {
      expect(generateArchetype(nft.dna)).toBe(generateArchetype(nft.dna));
    }
  });

  it("produces different outputs for different DNA", () => {
    const b1 = generateBackstory(
      TEST_NFTS[0].dna,
      TEST_NFTS[0].baseType,
      TEST_NFTS[0].bloodline,
      100,
    );
    const b2 = generateBackstory(
      TEST_NFTS[1].dna,
      TEST_NFTS[1].baseType,
      TEST_NFTS[1].bloodline,
      100,
    );
    expect(b1).not.toBe(b2);
  });
});

// =============================================================================
// E2E: Progressive traits
// =============================================================================

describe("E2E — Progressive Traits", () => {
  const full = {
    curiosity: 80,
    creativity: 75,
    logic: 90,
    empathy: 60,
    humor: 55,
  };

  it("level 1-2: only curiosity", () => {
    for (let lv = 1; lv <= 2; lv++) {
      const t = NarrativeEngine.getProgressiveTraits(full, lv);
      expect(t.curiosity).toBe(80);
      expect(t.creativity).toBe(0);
      expect(t.logic).toBe(0);
      expect(t.empathy).toBe(0);
      expect(t.humor).toBe(0);
    }
  });

  it("level 3-5: curiosity + creativity + logic", () => {
    for (let lv = 3; lv <= 5; lv++) {
      const t = NarrativeEngine.getProgressiveTraits(full, lv);
      expect(t.curiosity).toBe(80);
      expect(t.creativity).toBe(75);
      expect(t.logic).toBe(90);
      expect(t.empathy).toBe(0);
    }
  });

  it("level 6-10: all traits", () => {
    for (let lv = 6; lv <= 10; lv++) {
      const t = NarrativeEngine.getProgressiveTraits(full, lv);
      expect(t.curiosity).toBe(80);
      expect(t.creativity).toBe(75);
      expect(t.logic).toBe(90);
      expect(t.empathy).toBe(60);
      expect(t.humor).toBe(55);
    }
  });
});

// =============================================================================
// E2E: NarrativeEngine pipeline
// =============================================================================

describe("E2E — NarrativeEngine Pipeline", () => {
  const engine = new NarrativeEngine();

  it("processes 5 AI outputs × 5 NFTs = 25 events", async () => {
    let totalEvents = 0;
    const types = new Set<string>();

    for (const nft of TEST_NFTS) {
      const ns = NarrativeEngine.initNarrativeState(nft);
      for (const output of AI_OUTPUTS) {
        const result = await engine.processAIOutput(
          output,
          nft,
          ns,
          "test-model",
        );
        expect(result.event.id).toContain("narr-");
        expect(result.event.aiOutputHash).toHaveLength(64);
        expect([
          "LORE",
          "DISCOVERY",
          "TECHNICAL",
          "SOCIAL",
          "MYSTICAL",
          "EVOLUTION",
        ]).toContain(result.event.type);
        expect(result.event.title.length).toBeGreaterThan(0);
        expect(result.event.description.length).toBeGreaterThan(0);

        types.add(result.event.type);
        totalEvents++;

        // Update state for next iteration
        ns.events.push(result.event);
        ns.personality = result.updatedPersonality;
        ns.mood = result.updatedMood;
      }
    }

    expect(totalEvents).toBe(25);
    expect(types.size).toBeGreaterThanOrEqual(3); // At least 3 distinct types
  });

  it("initNarrativeState produces valid initial state for all NFTs", () => {
    for (const nft of TEST_NFTS) {
      const state = NarrativeEngine.initNarrativeState(nft);
      expect(state.tokenId).toBe(nft.tokenId);
      expect(state.backstory.length).toBeGreaterThan(0);
      expect(state.archetype.length).toBeGreaterThan(0);
      expect(state.personality.curiosity).toBeGreaterThan(0);
      expect(state.mood).toBe("curious");
      expect(state.events).toEqual([]);
    }
  });
});

// =============================================================================
// E2E: Edge cases
// =============================================================================

describe("E2E — Edge Cases", () => {
  const engine = new NarrativeEngine();
  const nft = TEST_NFTS[0];
  const ns = NarrativeEngine.initNarrativeState(nft);

  it("handles empty AI output", async () => {
    const result = await engine.processAIOutput("", nft, ns, "test");
    expect(result.event.title.length).toBeGreaterThan(0);
    expect(result.event.aiOutputHash).toHaveLength(64);
  });

  it("handles very long AI output (5000 chars)", async () => {
    const result = await engine.processAIOutput(
      "x".repeat(5000),
      nft,
      ns,
      "test",
    );
    expect(result.event.title.length).toBeGreaterThan(0);
    expect(result.event.description.length).toBeGreaterThan(50);
  });

  it("handles unicode AI output", async () => {
    const result = await engine.processAIOutput(
      "🌟✨ blockchain cosmos 🌌",
      nft,
      ns,
      "test",
    );
    expect(result.event.title.length).toBeGreaterThan(0);
  });

  it("trait impacts stay within 0-100 bounds", async () => {
    // Process 100 events to stress test trait bounds
    for (let i = 0; i < 50; i++) {
      const result = await engine.processAIOutput(
        AI_OUTPUTS[i % AI_OUTPUTS.length]!,
        nft,
        ns,
        "test",
      );
      for (const [trait, val] of Object.entries(result.updatedPersonality)) {
        expect(
          val,
          `${trait}: ${val} at iteration ${i}`,
        ).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
      ns.personality = result.updatedPersonality;
    }
  });
});

// =============================================================================
// E2E: Template slots
// =============================================================================

describe("E2E — Template Slots", () => {
  const nft = TEST_NFTS[0];
  const ns = NarrativeEngine.initNarrativeState(nft);

  it("builds valid slots for all base types", () => {
    const types = ["human", "animal", "robot", "mystic", "alien"] as const;
    for (const baseType of types) {
      const ctx: NarrativeContext = {
        nft: { ...nft, baseType },
        personality: ns.personality,
        archetype: ns.archetype,
        mood: ns.mood,
        aiOutput: "the baby explores the blockchain",
        recentEvents: [],
        workCount: 5,
      };
      const slots = buildNarrativeSlots(ctx);
      expect(slots.title.length).toBeGreaterThan(0);
      expect(slots.description.length).toBeGreaterThan(0);
    }
  });

  it("classifies technical keywords correctly", () => {
    const ctx: NarrativeContext = {
      nft,
      personality: ns.personality,
      archetype: ns.archetype,
      mood: ns.mood,
      recentEvents: [],
      workCount: 10,
      aiOutput: "analyze and optimize the hash function for better performance",
    };
    expect(buildNarrativeSlots(ctx).eventType).toBe("TECHNICAL");
  });

  it("classifies mystical keywords correctly", () => {
    const ctx: NarrativeContext = {
      nft: { ...nft, baseType: "mystic", bloodline: "mystic" },
      personality: ns.personality,
      archetype: "Pixel Shaman",
      mood: ns.mood,
      recentEvents: [],
      workCount: 10,
      aiOutput: "a cosmic vision of ancient prophecy whispers",
    };
    expect(buildNarrativeSlots(ctx).eventType).toBe("MYSTICAL");
  });
});
