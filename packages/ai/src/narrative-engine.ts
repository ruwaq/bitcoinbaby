/**
 * NarrativeEngine — AI World Engine core.
 *
 * Transforms raw AI output (from SmolLM2, BabyBrain, or Cloudflare AI) into
 * structured narrative events. Each event has a type, trait impacts, mood effects,
 * and is deterministically flavored by the baby's DNA, bloodline, and base type.
 *
 * Architecture:
 *   Raw AI output → classify event type → select templates by tone →
 *   generate title + description → calculate trait/mood impacts → NarrativeEvent
 *
 * All generation is deterministic given the same inputs (AI output + NFT state),
 * so proofs can be verified by re-running the engine.
 */

import { createLogger } from "@bitcoinbaby/shared";
import type { SparkNFTState } from "./narrative-types";
import type {
  NarrativeEvent,
  NarrativeState,
  NarrativeResult,
  PersonalityTraits,
  NarrativeContext,
} from "./narrative-types";
import {
  buildNarrativeSlots,
  generateBackstory,
  generatePersonality,
  generateArchetype,
} from "./narrative-templates";

const log = createLogger("NarrativeEngine");

// =============================================================================
// HELPERS
// =============================================================================

/** SHA-256 of a string via Web Crypto (browser) or subtle fallback */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// =============================================================================
// ENGINE
// =============================================================================

export class NarrativeEngine {
  /**
   * Process raw AI output into a structured narrative event.
   *
   * @param aiOutput - Raw text from SmolLM2, BabyBrain, or Cloudflare AI
   * @param nft - Current on-chain NFT state (for DNA, level, bloodline, etc.)
   * @param narrativeState - Current off-chain narrative state (for continuity)
   * @param modelUsed - Which model generated the output
   * @returns Structured event + updated personality/mood
   */
  async processAIOutput(
    aiOutput: string,
    nft: SparkNFTState,
    narrativeState: NarrativeState,
    modelUsed: string,
  ): Promise<NarrativeResult> {
    const ctx: NarrativeContext = {
      nft,
      personality: narrativeState.personality,
      archetype: narrativeState.archetype,
      mood: narrativeState.mood,
      aiOutput,
      recentEvents: narrativeState.events.slice(-10),
      workCount: nft.workCount,
    };

    const slots = buildNarrativeSlots(ctx);
    const aiOutputHash = await sha256(aiOutput);

    const event: NarrativeEvent = {
      id: `narr-${nft.tokenId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type: slots.eventType,
      title: slots.title,
      description: slots.description,
      modelUsed,
      traitImpacts: slots.traitImpacts,
      moodEffect: slots.moodEffect,
      aiOutputHash,
    };

    // Apply trait impacts (capped 0-100)
    const updatedPersonality = this.applyTraitImpacts(
      narrativeState.personality,
      slots.traitImpacts,
    );

    // Apply mood effect
    const updatedMood = slots.moodEffect ?? narrativeState.mood;

    log.info(`Narrative event: ${slots.eventType} — "${slots.title}"`, {
      tokenId: nft.tokenId,
      model: modelUsed,
    });

    return { event, updatedPersonality, updatedMood };
  }

  /**
   * Initialize a fresh NarrativeState for a newly minted NFT.
   * Deterministic from DNA — same DNA always produces the same initial state.
   */
  static initNarrativeState(nft: SparkNFTState): NarrativeState {
    const backstory = generateBackstory(
      nft.dna,
      nft.baseType,
      nft.bloodline,
      nft.genesisBlock,
    );
    const personality = generatePersonality(nft.dna);
    const archetype = generateArchetype(nft.dna);

    return {
      tokenId: nft.tokenId,
      events: [],
      personality,
      archetype,
      backstory,
      mood: "curious",
      faction: null,
      relationships: [],
      inventory: [],
    };
  }

  /**
   * Get progressive traits based on level.
   * Early levels reveal only basic traits; later levels reveal the full personality.
   */
  static getProgressiveTraits(
    personality: PersonalityTraits,
    level: number,
  ): PersonalityTraits {
    // Level 1-2: only curiosity
    // Level 3-5: + creativity + logic
    // Level 6-8: + empathy + humor
    // Level 9-10: full reveal (archetype + destiny)
    return {
      curiosity: personality.curiosity,
      creativity: level >= 3 ? personality.creativity : 0,
      logic: level >= 3 ? personality.logic : 0,
      empathy: level >= 6 ? personality.empathy : 0,
      humor: level >= 6 ? personality.humor : 0,
    };
  }

  // =============================================================================
  // PRIVATE
  // =============================================================================

  private applyTraitImpacts(
    current: PersonalityTraits,
    impacts: Partial<PersonalityTraits>,
  ): PersonalityTraits {
    return {
      curiosity: clamp(current.curiosity + (impacts.curiosity ?? 0), 0, 100),
      creativity: clamp(current.creativity + (impacts.creativity ?? 0), 0, 100),
      logic: clamp(current.logic + (impacts.logic ?? 0), 0, 100),
      empathy: clamp(current.empathy + (impacts.empathy ?? 0), 0, 100),
      humor: clamp(current.humor + (impacts.humor ?? 0), 0, 100),
    };
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
