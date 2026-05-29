/**
 * useNarrativePipeline — wires AI output → NarrativeEngine → NarrativeStore → UI.
 *
 * The parent hook (useMiningShareSubmission) already subscribes to
 * onAILocalTaskResolved from the mining singleton. To avoid double-subscription
 * conflicts, this hook exposes a `handleAIProof` function that the parent
 * calls after signing is done.
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

let engineInstance: NarrativeEngine | null = null;
function getEngine(): NarrativeEngine {
  if (!engineInstance) {
    engineInstance = new NarrativeEngine();
  }
  return engineInstance;
}

export interface UseNarrativePipelineOptions {
  nftState: import("@bitcoinbaby/ai").BabyNFTState | null;
}

export interface UseNarrativePipelineReturn {
  latestEvent: NarrativeEvent | null;
  narrativeState: NarrativeState | null;
  progressiveTraits: import("@bitcoinbaby/ai").PersonalityTraits | null;
  /** Call from mining hook after AI proof is signed + queued */
  handleAIProof: (proof: AIProof) => void;
  processBatch: (outputs: string[], modelUsed: string) => Promise<void>;
}

export function useNarrativePipeline({
  nftState,
}: UseNarrativePipelineOptions): UseNarrativePipelineReturn {
  const [latestEvent, setLatestEvent] = useState<NarrativeEvent | null>(null);
  const store = useNarrativeStore();
  const engineRef = useRef(getEngine());
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    if (!nftState) return;
    const initState = NarrativeEngine.initNarrativeState(nftState);
    store.getOrCreate(nftState.tokenId, initState);
  }, [nftState?.tokenId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAIProof = useCallback(
    (proof: AIProof) => {
      if (!nftState) return;

      const tokenId = nftState.tokenId;
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
        NarrativeEngine.initNarrativeState(nftState),
      );

      engineRef.current
        .processAIOutput(aiOutput, nftState, narrativeState, modelId)
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
    [nftState, store],
  );

  const processBatch = useCallback(
    async (outputs: string[], modelUsed: string) => {
      if (!nftState) return;

      const tokenId = nftState.tokenId;
      const narrativeState = store.getOrCreate(
        tokenId,
        NarrativeEngine.initNarrativeState(nftState),
      );

      for (const output of outputs) {
        // Re-read fresh state from store for each iteration to avoid mutation
        const currentState =
          store.states[tokenId] ?? NarrativeEngine.initNarrativeState(nftState);
        const result = await engineRef.current.processAIOutput(
          output,
          nftState,
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
    [nftState, store],
  );

  const narrativeState = nftState
    ? (store.states[nftState.tokenId] ?? null)
    : null;

  const progressiveTraits =
    nftState && narrativeState
      ? NarrativeEngine.getProgressiveTraits(
          narrativeState.personality,
          nftState.level,
        )
      : null;

  return {
    latestEvent,
    narrativeState,
    progressiveTraits,
    handleAIProof,
    processBatch,
  };
}
