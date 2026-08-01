/**
 * useNarrativePipeline — wires AI output → NarrativeEngine → NarrativeStore → UI.
 *
 * Two modes:
 * - World Mode (nftState = null): AI generates world lore, rules, factions
 * - Baby Mode (nftState set): AI generates stories about the specific NFT baby
 *
 * Flow:
 *   1. AI proof arrives → handleAILocalTaskResolved (useMiningShareSubmission)
 *   2. Sign proof → queue to SyncManager
 *   3. Call handleAIProof → NarrativeEngine → NarrativeStore → UI
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useNarrativeStore } from "@bitcoinbaby/core";
import { NarrativeEngine } from "@bitcoinbaby/ai";
import type { NarrativeEvent, NarrativeState } from "@bitcoinbaby/ai";
import type { AIProof } from "@bitcoinbaby/ai";
import { createLogger } from "@bitcoinbaby/shared";

const log = createLogger("useNarrativePipeline");

/** Fixed tokenId for world-mode stories (no NFT owned) */
const WORLD_TOKEN_ID = -1;

/** Minimal world nftState used when user has no NFT */
function createWorldNftState(): import("@bitcoinbaby/ai").SparkNFTState {
  return {
    dna: "0000000000000000",
    bloodline: "mystic" as const,
    baseType: "mystic" as const,
    genesisBlock: 0,
    rarityTier: "common" as const,
    tokenId: WORLD_TOKEN_ID,
    heritage: 0,
    level: 1,
    xp: 0,
    totalXp: 0,
    workCount: 0,
    lastWorkBlock: 0,
    evolutionCount: 0,
    tokensEarned: 0n,
    narrativeRoot: "",
    worldStateRoot: "",
  };
}

let engineInstance: NarrativeEngine | null = null;
function getEngine(): NarrativeEngine {
  if (!engineInstance) {
    engineInstance = new NarrativeEngine();
  }
  return engineInstance;
}

export interface UseNarrativePipelineOptions {
  nftState: import("@bitcoinbaby/ai").SparkNFTState | null;
}

export interface UseNarrativePipelineReturn {
  latestEvent: NarrativeEvent | null;
  narrativeState: NarrativeState | null;
  progressiveTraits: import("@bitcoinbaby/ai").PersonalityTraits | null;
  handleAIProof: (proof: AIProof) => void;
  processBatch: (outputs: string[], modelUsed: string) => Promise<void>;
  /** Whether operating in world mode (no NFT) */
  isWorldMode: boolean;
}

export function useNarrativePipeline({
  nftState,
}: UseNarrativePipelineOptions): UseNarrativePipelineReturn {
  const [latestEvent, setLatestEvent] = useState<NarrativeEvent | null>(null);
  const store = useNarrativeStore();
  const engineRef = useRef(getEngine());
  const processedRef = useRef(new Set<string>());

  // Resolve effective state: real NFT or world-mode fallback
  const effectiveNft = nftState ?? createWorldNftState();
  const tokenId = effectiveNft.tokenId;
  const isWorldMode = nftState === null;

  useEffect(() => {
    const initState = NarrativeEngine.initNarrativeState(effectiveNft);
    store.getOrCreate(tokenId, initState);
  }, [tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAIProof = useCallback(
    (proof: AIProof) => {
      const aiOutput = proof.output;
      const modelId = proof.modelId;

      if (processedRef.current.has(proof.taskId)) return;
      processedRef.current.add(proof.taskId);

      if (processedRef.current.size > 500) {
        const entries = [...processedRef.current];
        processedRef.current = new Set(entries.slice(-250));
      }

      const narrativeState = store.getOrCreate(
        tokenId,
        NarrativeEngine.initNarrativeState(effectiveNft),
      );

      engineRef.current
        .processAIOutput(aiOutput, effectiveNft, narrativeState, modelId)
        .then((result) => {
          store.addEvent(tokenId, result.event);
          store.updatePersonality(tokenId, result.updatedPersonality);
          store.updateMood(tokenId, result.updatedMood);
          setLatestEvent(result.event);
        })
        .catch((err) => {
          log.error("NarrativeEngine processing failed", {
            error: err instanceof Error ? err.message : String(err),
          });
        });
    },
    [tokenId, effectiveNft, store],
  );

  const processBatch = useCallback(
    async (outputs: string[], modelUsed: string) => {
      const narrativeState = store.getOrCreate(
        tokenId,
        NarrativeEngine.initNarrativeState(effectiveNft),
      );

      for (const output of outputs) {
        const currentState =
          store.states[tokenId] ??
          NarrativeEngine.initNarrativeState(effectiveNft);
        const result = await engineRef.current.processAIOutput(
          output,
          effectiveNft,
          currentState,
          modelUsed,
        );
        store.addEvent(tokenId, result.event);
        store.updatePersonality(tokenId, result.updatedPersonality);
        store.updateMood(tokenId, result.updatedMood);
      }

      setLatestEvent(
        narrativeState.events[narrativeState.events.length - 1] ?? null,
      );
    },
    [tokenId, effectiveNft, store],
  );

  const narrativeState = store.states[tokenId] ?? null;

  const progressiveTraits = narrativeState
    ? NarrativeEngine.getProgressiveTraits(
        narrativeState.personality,
        effectiveNft.level,
      )
    : null;

  return {
    latestEvent,
    narrativeState,
    progressiveTraits,
    handleAIProof,
    processBatch,
    isWorldMode,
  };
}
