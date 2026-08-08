/**
 * NFT Evolution Service — builds Charms v15 spells for `work_proof` and
 * `level_up` operations.
 *
 * The output states produced here MUST satisfy the on-chain validators in
 * packages/bitcoin/contracts/genesis-babies/src/lib.rs:
 *   - validate_work_proof: work_count+1, total_xp+xp_gain, xp+xp_gain,
 *     last_work_block set, level/evolution_count/tokens_earned/immutable
 *     traits unchanged.
 *   - validate_level_up:   level+1, xp=0, evolution_count+1, old.xp >=
 *     XP_REQUIREMENTS[next level], total_xp / work_count / tokens_earned /
 *     last_work_block / immutable traits unchanged.
 *
 * The private witness travels via the TOP-LEVEL `app_private_inputs` field of
 * the prover request (sibling of `spell`), keyed by `"n/<app_id>/<app_vk>"`,
 * value = hex-CBOR of the witness. Per the v15 witness spike:
 *   - work_proof witness = `{ operation: "work_proof", xp_gain, current_block }`
 *     (the contract re-deserializes `w` as `WorkProofWitness`).
 *   - level_up witness    = `{ operation: "level_up" }`.
 *
 * See docs/superpowers/notes/charms-v15-witness-spike.md (Sections 1, 2, 5, 7).
 */

import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../lib/nft-contract-binary";
import {
  type SparkNFTState,
  addressToScriptPubkey,
  buildAppKey,
  buildSpellObject,
  encodeCborHex,
  DEFAULT_FEE_RATE,
} from "./nft-spell-utils";

export type { SparkNFTState };

/** Maximum level an NFT can reach (mirrors the contract's MAX_LEVEL). */
export const MAX_LEVEL = 21;

/** Shape of the prover request returned to the caller (route adds prev_txs). */
export interface EvolutionProverRequest {
  spell: string;
  app_private_inputs: Record<string, string>;
  prev_txs: unknown[];
  binaries: Record<string, string>;
  change_address: string;
  chain: string;
  fee_rate: number;
}

/** Result of an evolution spell builder: the new state + the prover request. */
export interface EvolutionSpellResult {
  outState: SparkNFTState;
  proverRequest: EvolutionProverRequest;
}

// =============================================================================
// WORK PROOF
// =============================================================================

export interface WorkProofParams {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  /** XP gained from this work proof (private — carried only in the witness). */
  xpGain: number;
  /** Current block height (private — carried only in the witness). */
  currentBlock: number;
  /** Optional: override the contract VK (defaults to the compiled binary's VK). */
  appVk?: string;
}

/**
 * Build a `work_proof` spell request. Accrues `xpGain` XP and ticks
 * `work_count` by 1; sets `last_work_block` to `currentBlock`. Level and
 * evolution_count are unchanged; all immutable identity traits are preserved.
 *
 * The witness CBOR includes `xp_gain` + `current_block` so the contract can
 * verify the deltas without publishing them.
 */
export function buildWorkProofSpellRequest(
  params: WorkProofParams,
): EvolutionSpellResult {
  const {
    appId,
    nftUtxo,
    currentState,
    ownerAddress,
    xpGain,
    currentBlock,
    appVk = NFT_CONTRACT_VK,
  } = params;

  // Output state per validate_work_proof:
  //   work_count+1, total_xp+xp_gain, xp+xp_gain, last_work_block=currentBlock,
  //   everything else (incl. immutable traits, tokens_earned) unchanged.
  //
  // C1a: the contract now requires `new.xp == old.xp + xp_gain` (it ties the
  // spendable `xp` balance to the same gain that bumps `total_xp`). We MUST bump
  // `xp` here in lockstep, otherwise the hardened validator rejects the spell.
  const outState: SparkNFTState = {
    ...currentState,
    work_count: currentState.work_count + 1,
    total_xp: currentState.total_xp + xpGain,
    xp: currentState.xp + xpGain,
    last_work_block: currentBlock,
  };

  const destScriptPubkey = addressToScriptPubkey(ownerAddress);
  const spellObject = buildSpellObject({
    nftUtxo,
    outState,
    destScriptPubkey,
    appId,
    appVk,
  });
  const spellHex = encodeCborHex(spellObject);

  // Work-proof witness carries the private xp_gain + current_block.
  const witness = {
    operation: "work_proof",
    xp_gain: xpGain,
    current_block: currentBlock,
  };

  const proverRequest: EvolutionProverRequest = {
    spell: spellHex,
    app_private_inputs: {
      [buildAppKey(appId, appVk)]: encodeCborHex(witness),
    },
    // The route that fetches the prev tx fills `prev_txs` before proving.
    prev_txs: [],
    binaries: { [appVk]: NFT_CONTRACT_BINARY },
    change_address: ownerAddress,
    chain: "bitcoin",
    fee_rate: DEFAULT_FEE_RATE,
  };

  return { outState, proverRequest };
}

// =============================================================================
// LEVEL UP
// =============================================================================

export interface LevelUpParams {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  /** Optional: override the contract VK (defaults to the compiled binary's VK). */
  appVk?: string;
}

/**
 * Build a `level_up` spell request. Increments `level` by 1, resets `xp` to 0,
 * and bumps `evolution_count` by 1. Lifetime totals (`total_xp`, `work_count`),
 * `tokens_earned`, and `last_work_block` are unchanged, as are all immutable
 * identity traits.
 *
 * Throws if the NFT is already at MAX_LEVEL (matches the contract's `>=
 * MAX_LEVEL` rejection and the client's createNFTLevelUpSpell guard).
 */
export function buildLevelUpSpellRequest(
  params: LevelUpParams,
): EvolutionSpellResult {
  const {
    appId,
    nftUtxo,
    currentState,
    ownerAddress,
    appVk = NFT_CONTRACT_VK,
  } = params;

  if (currentState.level >= MAX_LEVEL) {
    throw new Error(
      `NFT is already at max level (${MAX_LEVEL}); cannot level up further.`,
    );
  }

  // Output state per validate_level_up:
  //   level+1, xp=0, evolution_count+1, everything else unchanged.
  const outState: SparkNFTState = {
    ...currentState,
    level: currentState.level + 1,
    xp: 0,
    evolution_count: currentState.evolution_count + 1,
  };

  const destScriptPubkey = addressToScriptPubkey(ownerAddress);
  const spellObject = buildSpellObject({
    nftUtxo,
    outState,
    destScriptPubkey,
    appId,
    appVk,
  });
  const spellHex = encodeCborHex(spellObject);

  // Level-up witness is operation-only.
  const witness = { operation: "level_up" };

  const proverRequest: EvolutionProverRequest = {
    spell: spellHex,
    app_private_inputs: {
      [buildAppKey(appId, appVk)]: encodeCborHex(witness),
    },
    prev_txs: [],
    binaries: { [appVk]: NFT_CONTRACT_BINARY },
    change_address: ownerAddress,
    chain: "bitcoin",
    fee_rate: DEFAULT_FEE_RATE,
  };

  return { outState, proverRequest };
}
