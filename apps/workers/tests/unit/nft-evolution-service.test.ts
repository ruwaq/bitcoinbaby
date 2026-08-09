/**
 * NFT Evolution Service — Task 3.1
 *
 * Guards `buildWorkProofSpellRequest` / `buildLevelUpSpellRequest`. The output
 * states MUST satisfy the on-chain `validate_work_proof` / `validate_level_up`
 * validators in packages/bitcoin/contracts/genesis-babies/src/lib.rs, and the
 * private witness MUST travel via the top-level `app_private_inputs` field of
 * the prover request (sibling of `spell`), per
 * docs/superpowers/notes/charms-v15-witness-spike.md.
 *
 * For work_proof the witness carries `xp_gain` + `current_block` (private data
 * the contract re-deserializes as `WorkProofWitness`); for level_up it is just
 * `{ operation: "level_up" }`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildWorkProofSpellRequest,
  buildLevelUpSpellRequest,
} from "../../src/services/nft-evolution-service";
import type { SparkNFTState } from "../../src/services/nft-minting-simple";
import { NFT_CONTRACT_VK } from "../../src/lib/nft-contract-binary";
import * as cbor from "cbor2";

// `buildWorkSpellRequest` validates the PoW cryptographically via
// `validateMiningProof` (it does real hash256). Mock it so the tests don't
// need a genuine PoW solution. Hoisted before the SUT import below.
vi.mock("../../src/lib/proof-validation", () => ({
  validateMiningProof: vi
    .fn()
    .mockResolvedValue({ valid: true, calculatedReward: 100n }),
}));

import { buildWorkSpellRequest } from "../../src/services/nft-evolution-service";
import { validateMiningProof } from "../../src/lib/proof-validation";

const APP_ID = "deadbeef".repeat(8); // 64 hex chars
const NFT_UTXO = { txid: "00".repeat(32), vout: 0 };

// A valid bech32 address that addressToScriptPubkey() can parse (same one used
// in nft-mint-witness.test.ts).
const OWNER_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

const baseState: SparkNFTState = {
  dna: "a".repeat(64),
  bloodline: "royal",
  base_type: "human",
  genesis_block: 800000,
  rarity_tier: "common",
  token_id: 1,
  level: 1,
  xp: 0,
  total_xp: 0,
  work_count: 0,
  last_work_block: 800000,
  evolution_count: 0,
  tokens_earned: "0",
  heritage: 0,
};

describe("buildWorkProofSpellRequest", () => {
  it("produces output state with work_count+1, total_xp+xpGain, xp+xpGain, last_work_block updated", () => {
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: baseState,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 150,
      currentBlock: 800001,
    });
    expect(req.outState.work_count).toBe(1);
    expect(req.outState.total_xp).toBe(150);
    // C1a: spendable `xp` must tick by the SAME xpGain as total_xp, otherwise
    // the hardened validate_work_proof rejects the spell.
    expect(req.outState.xp).toBe(150);
    expect(req.outState.last_work_block).toBe(800001);
    expect(req.outState.level).toBe(1);
    expect(req.outState.evolution_count).toBe(0);
    // C2: tokens_earned must NOT change on a work proof.
    expect(req.outState.tokens_earned).toBe(baseState.tokens_earned);
  });

  it("bumps xp alongside total_xp from a non-zero starting xp (C1a invariant)", () => {
    // Start with some accrued xp/total_xp and confirm both tick by xpGain.
    const started: SparkNFTState = {
      ...baseState,
      xp: 200,
      total_xp: 500,
      work_count: 3,
    };
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: started,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 75,
      currentBlock: 800050,
    });
    expect(req.outState.xp).toBe(275); // 200 + 75
    expect(req.outState.total_xp).toBe(575); // 500 + 75
    expect(req.outState.work_count).toBe(4);
  });

  it("preserves immutable traits in the output state", () => {
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: baseState,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 100,
      currentBlock: 800010,
    });
    expect(req.outState.dna).toBe(baseState.dna);
    expect(req.outState.bloodline).toBe(baseState.bloodline);
    expect(req.outState.token_id).toBe(baseState.token_id);
    expect(req.outState.rarity_tier).toBe(baseState.rarity_tier);
  });

  it("includes app_private_inputs with a work_proof witness carrying xp_gain + current_block", () => {
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: baseState,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 150,
      currentBlock: 800001,
    });
    const key = `n/${APP_ID}/${NFT_CONTRACT_VK}`;
    const witnessHex = req.proverRequest.app_private_inputs[key];
    expect(witnessHex, `witness must be keyed by "${key}"`).toBeDefined();

    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(witnessHex, "hex")),
    ) as { operation: string; xp_gain: number; current_block: number };
    expect(decoded).toEqual({
      operation: "work_proof",
      xp_gain: 150,
      current_block: 800001,
    });
  });

  it("spell version is 15", () => {
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: baseState,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 100,
      currentBlock: 800001,
    });
    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(req.proverRequest.spell, "hex")),
    ) as { version: number };
    expect(decoded.version).toBe(15);
  });

  it("spell ins reference the current NFT UTXO and outs carry the new state", () => {
    const req = buildWorkProofSpellRequest({
      appId: APP_ID,
      nftUtxo: { txid: "11".repeat(32), vout: 2 },
      currentState: baseState,
      ownerAddress: OWNER_ADDRESS,
      xpGain: 100,
      currentBlock: 800001,
    });
    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(req.proverRequest.spell, "hex")),
    ) as {
      version: number;
      tx: { ins: Uint8Array[]; outs: Map<number, SparkNFTState>[] };
    };
    // exactly one input (the spent NFT UTXO)
    expect(decoded.tx.ins).toHaveLength(1);
    // exactly one output carrying the new state at index 0
    expect(decoded.tx.outs).toHaveLength(1);
    const out0 = decoded.tx.outs[0];
    const outState = out0 instanceof Map ? out0.get(0) : (out0 as any)[0];
    expect(outState.work_count).toBe(1);
    expect(outState.total_xp).toBe(100);
  });
});

describe("buildLevelUpSpellRequest", () => {
  it("increments level, resets xp, bumps evolution_count", () => {
    const leveled: SparkNFTState = {
      ...baseState,
      level: 3,
      xp: 250,
      total_xp: 1000,
      evolution_count: 2,
    };
    const req = buildLevelUpSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: leveled,
      ownerAddress: OWNER_ADDRESS,
    });
    expect(req.outState.level).toBe(4);
    expect(req.outState.xp).toBe(0);
    expect(req.outState.evolution_count).toBe(3);
    expect(req.outState.total_xp).toBe(1000); // unchanged
    expect(req.outState.work_count).toBe(leveled.work_count); // unchanged
    expect(req.outState.tokens_earned).toBe(leveled.tokens_earned); // unchanged
    expect(req.outState.last_work_block).toBe(leveled.last_work_block); // unchanged
  });

  it("preserves immutable traits in the output state", () => {
    const req = buildLevelUpSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: { ...baseState, level: 2, xp: 100 },
      ownerAddress: OWNER_ADDRESS,
    });
    expect(req.outState.dna).toBe(baseState.dna);
    expect(req.outState.genesis_block).toBe(baseState.genesis_block);
    expect(req.outState.token_id).toBe(baseState.token_id);
  });

  it("throws at max level 21", () => {
    const max: SparkNFTState = { ...baseState, level: 21 };
    expect(() =>
      buildLevelUpSpellRequest({
        appId: APP_ID,
        nftUtxo: NFT_UTXO,
        currentState: max,
        ownerAddress: OWNER_ADDRESS,
      }),
    ).toThrow(/max level/i);
  });

  it("includes app_private_inputs with a level_up witness", () => {
    const req = buildLevelUpSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: { ...baseState, level: 2, xp: 100 },
      ownerAddress: OWNER_ADDRESS,
    });
    const key = `n/${APP_ID}/${NFT_CONTRACT_VK}`;
    const witnessHex = req.proverRequest.app_private_inputs[key];
    expect(witnessHex, `witness must be keyed by "${key}"`).toBeDefined();

    const decoded = cbor.decode(
      new Uint8Array(
        Buffer.from(req.proverRequest.app_private_inputs[key], "hex"),
      ),
    ) as { operation: string };
    expect(decoded).toEqual({ operation: "level_up" });
  });

  it("spell version is 15 and outs carry the leveled state", () => {
    const req = buildLevelUpSpellRequest({
      appId: APP_ID,
      nftUtxo: NFT_UTXO,
      currentState: { ...baseState, level: 5, xp: 1000 },
      ownerAddress: OWNER_ADDRESS,
    });
    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(req.proverRequest.spell, "hex")),
    ) as {
      version: number;
      tx: { ins: Uint8Array[]; outs: Map<number, SparkNFTState>[] };
    };
    expect(decoded.version).toBe(15);
    expect(decoded.tx.ins).toHaveLength(1);
    const out0 = decoded.tx.outs[0];
    const outState = out0 instanceof Map ? out0.get(0) : (out0 as any)[0];
    expect(outState.level).toBe(6);
    expect(outState.xp).toBe(0);
  });
});

describe("buildWorkSpellRequest", () => {
  beforeEach(() => {
    vi.mocked(validateMiningProof).mockClear();
  });

  const workParams = {
    appId: APP_ID,
    nftUtxo: NFT_UTXO,
    currentState: baseState,
    ownerAddress: OWNER_ADDRESS,
    challenge: "1:100",
    nonce: "1a2b",
    difficulty: 16,
    currentBlock: 800050,
    proofHash: "0".repeat(64),
    proofBlockData: "100:tb1ptest:1a2b",
  };

  it("validates the PoW BEFORE building the spell (calls validateMiningProof)", async () => {
    await buildWorkSpellRequest(workParams);
    expect(validateMiningProof).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(validateMiningProof).mock.calls[0][0];
    // nonce in MiningProofInput is a NUMBER (parsed from hex).
    expect(arg.nonce).toBe(0x1a2b);
    expect(arg.difficulty).toBe(16);
    expect(arg.hash).toBe(workParams.proofHash);
    expect(arg.blockData).toBe(workParams.proofBlockData);
  });

  it("builds a work spell with witness operation 'work' (NOT 'work_proof')", async () => {
    const { proverRequest } = await buildWorkSpellRequest(workParams);
    const key = `n/${APP_ID}/${NFT_CONTRACT_VK}`;
    const witnessHex = proverRequest.app_private_inputs[key];
    expect(witnessHex, `witness must be keyed by "${key}"`).toBeDefined();

    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(witnessHex, "hex")),
    ) as Record<string, unknown>;
    expect(decoded.operation).toBe("work");
    // The witness must carry the raw PoW inputs so the contract can re-verify.
    expect(decoded.challenge).toBe("1:100");
    expect(decoded.nonce).toBe("1a2b");
    expect(decoded.difficulty).toBe(16);
    expect(decoded.current_block).toBe(800050);
  });

  it("witness does NOT carry xp_gain (C3 closure — xp is DERIVED on-chain)", async () => {
    const { proverRequest } = await buildWorkSpellRequest(workParams);
    const key = `n/${APP_ID}/${NFT_CONTRACT_VK}`;
    const witnessHex = proverRequest.app_private_inputs[key];
    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(witnessHex, "hex")),
    ) as Record<string, unknown>;
    expect(decoded.xp_gain).toBeUndefined();
    expect(decoded.xpGain).toBeUndefined();
  });

  it("derives xp_gain from difficulty (never from witness input) and bumps xp + total_xp", async () => {
    const { outState } = await buildWorkSpellRequest({
      ...workParams,
      difficulty: 16, // base difficulty → xp_from_difficulty(16) = 100
    });
    expect(outState.work_count).toBe(1);
    expect(outState.last_work_block).toBe(800050);
    expect(outState.xp).toBe(100);
    expect(outState.total_xp).toBe(100);
  });

  it("derives 110 XP at difficulty 17 (+10% per bit over min) — matches contract xp_from_difficulty", async () => {
    const { outState } = await buildWorkSpellRequest({
      ...workParams,
      difficulty: 17,
    });
    expect(outState.xp).toBe(110);
    expect(outState.total_xp).toBe(110);
  });

  it("derives 200 XP at difficulty 26 (doubles the base)", async () => {
    const { outState } = await buildWorkSpellRequest({
      ...workParams,
      difficulty: 26,
    });
    expect(outState.xp).toBe(200);
    expect(outState.total_xp).toBe(200);
  });

  it("bumps xp on top of an existing non-zero xp balance (C1a invariant)", async () => {
    const started: SparkNFTState = {
      ...baseState,
      xp: 200,
      total_xp: 500,
      work_count: 3,
    };
    const { outState } = await buildWorkSpellRequest({
      ...workParams,
      currentState: started,
      difficulty: 16, // +100 XP
    });
    expect(outState.xp).toBe(300); // 200 + 100
    expect(outState.total_xp).toBe(600); // 500 + 100
    expect(outState.work_count).toBe(4);
  });

  it("throws when PoW is invalid (rejects forged difficulty)", async () => {
    vi.mocked(validateMiningProof).mockResolvedValueOnce({
      valid: false,
      reason: "Hash does not meet difficulty",
    });
    await expect(
      buildWorkSpellRequest({ ...workParams, difficulty: 99 }),
    ).rejects.toThrow(/Invalid proof of work/);
  });

  it("throws when difficulty is below MIN_DIFFICULTY_FOR_XP (16) — no zero-XP work", async () => {
    // validateMiningProof returns valid (default mock), but difficulty < 16 must
    // still be rejected by the builder before building the spell.
    await expect(
      buildWorkSpellRequest({ ...workParams, difficulty: 10 }),
    ).rejects.toThrow(/below minimum/i);
  });

  it("produces a version-15 spell whose outs carry the xp-bumped state", async () => {
    const { proverRequest } = await buildWorkSpellRequest({
      ...workParams,
      difficulty: 16, // +100 XP
    });
    const decoded = cbor.decode(
      new Uint8Array(Buffer.from(proverRequest.spell, "hex")),
    ) as {
      version: number;
      tx: { ins: Uint8Array[]; outs: Map<number, SparkNFTState>[] };
    };
    expect(decoded.version).toBe(15);
    expect(decoded.tx.ins).toHaveLength(1);
    expect(decoded.tx.outs).toHaveLength(1);
    const out0 = decoded.tx.outs[0];
    const outState = out0 instanceof Map ? out0.get(0) : (out0 as any)[0];
    // The spell's outs MUST reflect the derived xp (consistency with the
    // contract's `validate_work`, which checks new.xp == old.xp + derived).
    expect(outState.xp).toBe(100);
    expect(outState.total_xp).toBe(100);
    expect(outState.work_count).toBe(1);
    expect(outState.last_work_block).toBe(800050);
  });
});
