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
 *   - work witness       = `{ operation: "work", challenge, nonce, difficulty,
 *     current_block }` (op `work` — C3 closure). xp_gain is NOT in the witness;
 *     the contract re-derives it from difficulty via `xp_from_difficulty`.
 *   - level_up witness    = `{ operation: "level_up" }`.
 *
 * See docs/superpowers/notes/charms-v15-witness-spike.md (Sections 1, 2, 5, 7).
 */

import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../lib/nft-contract-binary";
import { validateMiningProof } from "../lib/proof-validation";
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

// =============================================================================
// WORK (op `work` — C3 closure, PoW-verified on-chain)
// =============================================================================
//
// DESIGN: unlike `buildWorkProofSpellRequest` (which trusts a client-supplied
// `xpGain`), this builder VALIDATES the proof-of-work cryptographically via
// `validateMiningProof` BEFORE constructing the spell, then DERIVES xp_gain
// from the verified difficulty (never from a witness/client input). This is
// the C3 closure: the on-chain contract re-derives xp_gain the same way via
// `xp_from_difficulty`, so a forged difficulty that passed the client can't
// inflate XP — the spell's witness carries NO xp_gain field.
//
// The spell is emitted in the v15 prover wire format (same `buildSpellObject`
// the sibling builders use) so `evolve.ts` can POST it to the v15 prover and
// the contract's `validate_work` accepts the transition. NOTE: the Task 1.1
// helper `createNFTWorkSpell` (packages/bitcoin/src/charms/nft.ts) emits a
// version-2 `SpellV2` (camelCase, client format) used by the React hook — NOT
// the prover format — so it is intentionally NOT used here. The witness shape
// it documents (`{challenge, difficulty, block_height}` as public_inputs, nonce
// only in the witness) is mirrored in the `w` we build below.

/**
 * Minimum difficulty (leading-zero bits) that earns any XP. Mirrors the
 * on-chain constant `MIN_DIFFICULTY_FOR_XP` in
 * packages/bitcoin/contracts/genesis-babies/src/lib.rs:304. Below this the
 * contract's `validate_work` rejects the transition outright.
 *
 * NOTE: equals `MIN_DIFFICULTY` from `@bitcoinbaby/shared` (mining.ts:21); we
 * keep a dedicated constant here because the XP semantics are distinct from
 * the share-acceptance semantics.
 */
const MIN_DIFFICULTY_FOR_XP = 16;

/**
 * Derive XP from a verified PoW difficulty. Mirrors `xp_from_difficulty` in
 * packages/bitcoin/contracts/genesis-babies/src/lib.rs:358 — base 100 + 10%
 * per bit over `MIN_DIFFICULTY_FOR_XP`. KEEP IN SYNC with the contract; the
 * contract is authoritative (it re-derives via the same formula and enforces
 * `new.xp == old.xp + xp_from_difficulty(difficulty)`).
 *
 * Examples (must match the contract's `test_xp_from_difficulty`):
 *   <16 → 0   (below min; rejected by the builder)
 *   16 → 100  (base)
 *   17 → 110
 *   26 → 200  (doubles)
 */
function xpFromDifficulty(difficulty: number): number {
  if (difficulty < MIN_DIFFICULTY_FOR_XP) return 0;
  const bonusBits = difficulty - MIN_DIFFICULTY_FOR_XP;
  return 100 + bonusBits * 10;
}

/** Parameters for the work spell builder (op `work` — C3 closure). */
export interface WorkParams {
  appId: string;
  nftUtxo: { txid: string; vout: number };
  currentState: SparkNFTState;
  ownerAddress: string;
  /** PoW challenge (e.g. "tokenId:blockHeight"). Surfaced in the witness. */
  challenge: string;
  /** Nonce (hex, no 0x prefix) that satisfies the difficulty. */
  nonce: string;
  /**
   * Required leading-zero bits. The builder cryptographically verifies the PoW
   * against this, then derives xp_gain from it.
   */
  difficulty: number;
  /** Bitcoin block height → becomes `last_work_block`. */
  currentBlock: number;
  /** Optional: override the contract VK (defaults to the compiled binary's VK). */
  appVk?: string;
}

/**
 * Extended params including the proof material that `validateMiningProof` needs
 * to cryptographically verify the PoW before building the spell.
 */
export interface BuildWorkSpellRequestParams extends WorkParams {
  /** The PoW hash the client claims (hex, 64 chars). */
  proofHash: string;
  /** blockData for `validateMiningProof`: `"block:address:nonceHex"`. */
  proofBlockData: string;
  /** Optional proof timestamp (ms) for the freshness check. */
  proofTimestamp?: number;
}

/**
 * Build a `work` spell request (op `work` — C3 closure). Validates the PoW
 * cryptographically via `validateMiningProof` BEFORE constructing the spell,
 * derives xp_gain from the verified difficulty (never from a witness/client
 * input), and emits a v15 wire-format spell via `buildSpellObject` so the
 * prover and the contract's `validate_work` accept the transition.
 *
 * SECURITY (C3): the witness carries `{operation, challenge, nonce, difficulty,
 * current_block}` with NO `xp_gain`. The contract re-derives xp_gain via
 * `xp_from_difficulty`; we compute the SAME value here to keep `outState`
 * consistent with what the contract will accept (it enforces
 * `new.xp == old.xp + xp_from_difficulty(difficulty)`).
 *
 * Throws if the PoW is invalid or if `difficulty` is below `MIN_DIFFICULTY_FOR_XP`.
 */
export async function buildWorkSpellRequest(
  params: BuildWorkSpellRequestParams,
): Promise<EvolutionSpellResult> {
  const {
    appId,
    nftUtxo,
    currentState,
    ownerAddress,
    challenge,
    nonce,
    difficulty,
    currentBlock,
    proofHash,
    proofBlockData,
    proofTimestamp,
    appVk = NFT_CONTRACT_VK,
  } = params;

  // (1) VALIDATE the proof-of-work cryptographically before anything else.
  // This is the C3 closure: we do NOT trust the client's claimed difficulty or
  // hash. `validateMiningProof` re-hashes blockData (double SHA256) and checks
  // leading-zero bits. MiningProofInput.nonce is a NUMBER (parsed from hex).
  const proofResult = await validateMiningProof({
    hash: proofHash,
    nonce: parseInt(nonce, 16),
    difficulty,
    blockData: proofBlockData,
    timestamp: proofTimestamp,
  });
  if (!proofResult.valid) {
    throw new Error(
      `Invalid proof of work: ${proofResult.reason ?? "unknown"}`,
    );
  }

  // (2) DERIVE xp_gain from the VERIFIED difficulty — same formula as the
  // contract's `xp_from_difficulty`. The witness does NOT carry xp_gain.
  const xpGain = xpFromDifficulty(difficulty);
  if (xpGain === 0) {
    throw new Error(
      `Difficulty ${difficulty} below minimum ${MIN_DIFFICULTY_FOR_XP}; no XP`,
    );
  }

  // (3) Construct the output state: bump work_count, advance last_work_block,
  // add the DERIVED xp_gain to both xp and total_xp. Matches what the
  // contract's `validate_work` accepts (new.xp == old.xp + derived,
  // new.total_xp == old.total_xp + derived).
  const outState: SparkNFTState = {
    ...currentState,
    work_count: currentState.work_count + 1,
    total_xp: currentState.total_xp + xpGain,
    xp: currentState.xp + xpGain,
    last_work_block: currentBlock,
  };

  // (4) Build the v15 wire-format spell. `buildSpellObject` embeds `outState`
  // at `tx.outs[0].get(0)`, so the spell's outs ALREADY reflect the xp bumps
  // — no post-hoc override needed (unlike what would be required if we used
  // the version-2 `createNFTWorkSpell` from packages/bitcoin).
  const destScriptPubkey = addressToScriptPubkey(ownerAddress);
  const spellObject = buildSpellObject({
    nftUtxo,
    outState,
    destScriptPubkey,
    appId,
    appVk,
  });
  const spellHex = encodeCborHex(spellObject);

  // (5) Witness: operation "work" with the RAW PoW inputs (NO xp_gain). The
  // contract deserializes this as `WorkWitness` and re-derives xp_gain via
  // `xp_from_difficulty(difficulty)`.
  const witness = {
    operation: "work",
    challenge,
    nonce,
    difficulty,
    current_block: currentBlock,
  };

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
