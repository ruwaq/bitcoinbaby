"use client";

/**
 * NarrativeDebugPanel — Test harness for AI World Engine.
 *
 * Allows injecting fake AI outputs to test the NarrativeEngine → NarrativeStore → UI
 * pipeline without needing real mining or AI model downloads.
 *
 * Only renders in development mode.
 */

import { useState, useCallback } from "react";
import { NarrativeEngine } from "@bitcoinbaby/ai";
import { useNarrativeStore } from "@bitcoinbaby/core";
import type { SparkNFTState } from "@bitcoinbaby/ai";
import type { BaseType, Bloodline } from "@bitcoinbaby/bitcoin";

// =============================================================================
// SAMPLE AI OUTPUTS (covers all event types)
// =============================================================================

const SAMPLE_OUTPUTS: Record<string, string> = {
  "LORE (alien/rogue)":
    "the baby explored the dark side of the chain and discovered an ancient encrypted transmission hidden in the mempool",
  "DISCOVERY (mystic)":
    "a vision revealed hidden patterns in the hash function that nobody had ever uncovered before",
  "TECHNICAL (robot)":
    "analyze and optimize the difficulty adjustment algorithm for maximum efficiency and precision",
  "SOCIAL (human/royal)":
    "the baby united the community of miners and shared knowledge about blockchain consensus with everyone",
  "MYSTICAL (mystic)":
    "a cosmic prophecy whispered through the ancient blocks revealing energy signatures never seen before",
  "EVOLUTION (any)":
    "the baby transformed and evolved after reaching a new level of understanding through mining work",
};

// =============================================================================
// RANDOM NFT GENERATOR
// =============================================================================

const BLOODLINES: Bloodline[] = ["royal", "warrior", "rogue", "mystic"];
const BASE_TYPES: BaseType[] = ["human", "animal", "robot", "mystic", "alien"];

function randomDNA(): string {
  return Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
}

function makeRandomNFT(): SparkNFTState {
  return {
    dna: randomDNA(),
    bloodline: BLOODLINES[Math.floor(Math.random() * BLOODLINES.length)],
    baseType: BASE_TYPES[Math.floor(Math.random() * BASE_TYPES.length)],
    genesisBlock: 2_500_000 + Math.floor(Math.random() * 50_000),
    rarityTier: "rare",
    heritage: 2,
    tokenId: Math.floor(Math.random() * 100) + 1,
    level: Math.floor(Math.random() * 8) + 1,
    xp: Math.floor(Math.random() * 500),
    totalXp: Math.floor(Math.random() * 5000),
    workCount: Math.floor(Math.random() * 100),
    lastWorkBlock: 2_580_000,
    evolutionCount: Math.floor(Math.random() * 5),
    tokensEarned: BigInt(Math.floor(Math.random() * 10000)) * 100_000_000n,
    narrativeRoot: "",
    worldStateRoot: "",
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export function NarrativeDebugPanel() {
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const [nft, setNft] = useState<SparkNFTState>(makeRandomNFT);
  const [selectedOutput, setSelectedOutput] = useState(
    Object.keys(SAMPLE_OUTPUTS)[0],
  );
  const [customOutput, setCustomOutput] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  // Get the actual store reference for imperative calls (not reactive)
  const store = useNarrativeStore.getState;

  const engineRef = useState(() => new NarrativeEngine())[0];

  const runTest = useCallback(async () => {
    setIsRunning(true);
    const logs: string[] = [];
    const start = performance.now();

    try {
      // 1. Init narrative state
      const initState = NarrativeEngine.initNarrativeState(nft);
      store().getOrCreate(nft.tokenId, initState);
      logs.push(
        `INIT: tokenId=${nft.tokenId} baseType=${nft.baseType} bloodline=${nft.bloodline} level=${nft.level}`,
      );
      logs.push(`  archetype=${initState.archetype}`);
      logs.push(`  backstory=${initState.backstory.slice(0, 80)}...`);
      logs.push(
        `  personality: curiosity=${initState.personality.curiosity} creativity=${initState.personality.creativity} logic=${initState.personality.logic} empathy=${initState.personality.empathy} humor=${initState.personality.humor}`,
      );

      // 2. Progressive traits
      const progTraits = NarrativeEngine.getProgressiveTraits(
        initState.personality,
        nft.level,
      );
      logs.push(
        `PROGRESSIVE (level ${nft.level}): curiosity=${progTraits.curiosity} creativity=${progTraits.creativity} logic=${progTraits.logic} empathy=${progTraits.empathy} humor=${progTraits.humor}`,
      );

      // 3. Process AI output
      const aiOutput = customOutput || SAMPLE_OUTPUTS[selectedOutput];
      const result = await engineRef.processAIOutput(
        aiOutput,
        nft,
        initState,
        "baby-brain-debug",
      );
      store().addEvent(nft.tokenId, result.event);
      store().updatePersonality(nft.tokenId, result.updatedPersonality);
      store().updateMood(nft.tokenId, result.updatedMood);

      logs.push(
        `EVENT: type=${result.event.type} model=${result.event.modelUsed}`,
      );
      logs.push(`  title="${result.event.title}"`);
      logs.push(`  desc="${result.event.description}"`);
      logs.push(`  mood=${result.updatedMood} (was ${initState.mood})`);
      logs.push(
        `  trait impacts: ${JSON.stringify(result.event.traitImpacts)}`,
      );
      logs.push(
        `  updated personality: curiosity=${result.updatedPersonality.curiosity} creativity=${result.updatedPersonality.creativity} logic=${result.updatedPersonality.logic} empathy=${result.updatedPersonality.empathy} humor=${result.updatedPersonality.humor}`,
      );

      // 4. Verify store
      const stored = store().states[nft.tokenId];
      logs.push(`STORE: ${stored?.events.length ?? 0} events stored`);
    } catch (err) {
      logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }

    const elapsed = performance.now() - start;
    logs.push(`DONE in ${elapsed.toFixed(1)}ms`);

    setResults(logs);
    setIsRunning(false);
  }, [nft, selectedOutput, customOutput, engineRef, store]);

  return (
    <div
      style={{
        margin: "16px auto",
        maxWidth: 520,
        padding: 16,
        background: "#0f0f1b",
        border: "4px solid #4fc3f7",
        boxShadow: "4px 4px 0 0 #000",
        fontFamily: "'Pixelify Sans', monospace",
        color: "#fff",
        imageRendering: "pixelated",
      }}
    >
      <h2
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10,
          color: "#4fc3f7",
          marginBottom: 12,
        }}
      >
        NARRATIVE DEBUG
      </h2>

      {/* NFT controls */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 10, color: "#9ca3af" }}>
          tokenId={nft.tokenId} | {nft.baseType}/{nft.bloodline} | Lv{nft.level}{" "}
          | {nft.workCount} works
        </label>
        <button
          onClick={() => setNft(makeRandomNFT())}
          style={{
            display: "block",
            marginTop: 4,
            padding: "4px 12px",
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7,
            background: "#1a1a2e",
            color: "#f7931a",
            border: "2px solid #f7931a",
            cursor: "pointer",
          }}
        >
          RANDOMIZE NFT
        </button>
      </div>

      {/* Output selector */}
      <div style={{ marginBottom: 10 }}>
        <label
          style={{
            fontSize: 10,
            color: "#9ca3af",
            display: "block",
            marginBottom: 4,
          }}
        >
          AI OUTPUT:
        </label>
        <select
          value={selectedOutput}
          onChange={(e) => setSelectedOutput(e.target.value)}
          style={{
            width: "100%",
            padding: "4px 8px",
            fontFamily: "'VT323', monospace",
            fontSize: 13,
            background: "#1a1a2e",
            color: "#fff",
            border: "2px solid #374151",
          }}
        >
          {Object.keys(SAMPLE_OUTPUTS).map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <textarea
          value={customOutput}
          onChange={(e) => setCustomOutput(e.target.value)}
          placeholder="Or type custom AI output..."
          rows={2}
          style={{
            width: "100%",
            marginTop: 4,
            padding: "4px 8px",
            fontFamily: "'VT323', monospace",
            fontSize: 12,
            background: "#1a1a2e",
            color: "#9ca3af",
            border: "2px solid #374151",
            resize: "vertical",
          }}
        />
      </div>

      {/* Run button */}
      <button
        onClick={runTest}
        disabled={isRunning}
        style={{
          width: "100%",
          padding: "8px 16px",
          marginBottom: 12,
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 9,
          background: isRunning ? "#374151" : "#4ade80",
          color: "#000",
          border: "4px solid #000",
          cursor: isRunning ? "wait" : "pointer",
          boxShadow: "4px 4px 0 0 #000",
        }}
      >
        {isRunning ? "RUNNING..." : "[ RUN TEST ]"}
      </button>

      {/* Results log */}
      {results.length > 0 && (
        <div
          style={{
            padding: 8,
            background: "#000",
            border: "2px solid #374151",
            fontFamily: "'VT323', monospace",
            fontSize: 12,
            color: "#4ade80",
            lineHeight: 1.6,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {results.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
