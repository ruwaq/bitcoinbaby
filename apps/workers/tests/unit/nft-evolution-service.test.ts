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

import { describe, it, expect } from "vitest";
import {
  buildWorkProofSpellRequest,
  buildLevelUpSpellRequest,
} from "../../src/services/nft-evolution-service";
import type { SparkNFTState } from "../../src/services/nft-minting-simple";
import { NFT_CONTRACT_VK } from "../../src/lib/nft-contract-binary";
import * as cbor from "cbor2";

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
  it("produces output state with work_count+1, total_xp+xpGain, last_work_block updated", () => {
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
    expect(req.outState.last_work_block).toBe(800001);
    expect(req.outState.level).toBe(1);
    expect(req.outState.evolution_count).toBe(0);
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
