/**
 * NFT Mint witness plumbing — Task 2.1
 *
 * Guards the fix for the routing bug described in
 * docs/superpowers/notes/charms-v15-witness-spike.md: the contract's `w`
 * argument (the 4th arg of `app_contract`) was ALWAYS empty because the worker
 * never sent `app_private_inputs`. As a result every mint silently fell
 * through to the transfer branch (`nft_state_preserved`).
 *
 * These tests assert the Prover API request built by NFTMintingServiceSimple:
 *   - includes a top-level `app_private_inputs` field (sibling of
 *     `spell` / `binaries` / `prev_txs`), keyed by the full
 *     `"n/<app_id>/<app_vk>"` string, whose value is hex-CBOR of
 *     `{ operation: "mint" }`.
 *   - uses spell version 15 (the v15 prover rejects version 11).
 *
 * `app_public_inputs` MUST stay inside the spell (it is not moved) — that is
 * verified too, to prevent an accidental refactor.
 *
 * Strategy: use `network: "regtest"` so `fetchRawTransaction` returns its
 * built-in stub without touching the network, and stub global `fetch` to
 * capture the prover POST body and return a minimal valid prover response.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NFTMintingServiceSimple } from "../../src/services/nft-minting-simple";
import {
  NFT_CONTRACT_VK,
  NFT_CONTRACT_BINARY,
} from "../../src/lib/nft-contract-binary";
import * as cbor from "cbor2";

// A valid regtest/testnet bech32 address that addressToScriptPubkey() can parse.
const VALID_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

// Minimal-but-valid NFTMintRequest payload.
function buildRequest(): Parameters<NFTMintingServiceSimple["processMint"]>[0] {
  return {
    tokenId: 1,
    ownerAddress: VALID_ADDRESS,
    nftState: {
      dna: "deadbeef",
      bloodline: "genesis",
      baseType: "baby",
      genesisBlock: 0,
      rarityTier: "common",
      tokenId: 1,
      level: 1,
      xp: 0,
      totalXp: 0,
      workCount: 0,
      lastWorkBlock: 0,
      evolutionCount: 0,
      tokensEarned: "0",
      heritage: 0,
    },
    fundingUtxo: {
      txid: "00".repeat(32),
      vout: 0,
      value: 5000,
    },
  };
}

interface CapturedRequest {
  url: string;
  body: any;
}

/**
 * Stub global fetch so that:
 *   - any GET (health checks, tx fetches) returns a benign 200, and
 *   - the POST to .../spells/prove captures its JSON body and returns a
 *     minimal valid prover response (an array of 2 `{ bitcoin }` entries so
 *     proveOnce() extracts commitTx + spellTx).
 *
 * Returns a handle through which the test can read the captured POST body.
 */
function stubFetchCapture(): {
  fetchMock: ReturnType<typeof vi.fn>;
  getProverRequest: () => CapturedRequest | undefined;
} {
  let captured: CapturedRequest | undefined;

  const fetchMock = vi.fn(async (url: string, opts?: any) => {
    const method = (opts && opts.method) || "GET";
    if (method === "POST") {
      const rawBody = opts && opts.body;
      const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
      captured = { url, body };
      // Minimal valid prover response: array with >=2 bitcoin txs.
      return new Response(
        JSON.stringify([
          { bitcoin: "dead".repeat(125) },
          { bitcoin: "beef".repeat(125) },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // GETs (health check / mempool) — regtest short-circuits tx fetch, but be safe.
    return new Response("", { status: 200 });
  });

  vi.stubGlobal("fetch", fetchMock);
  return {
    fetchMock,
    getProverRequest: () => captured,
  };
}

describe("NFTMintingServiceSimple — witness plumbing (Task 2.1)", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("includes app_private_inputs with operation 'mint' keyed by the full app string", async () => {
    const appId = "deadbeef".repeat(8); // 64 hex chars
    const service = new NFTMintingServiceSimple({
      appId,
      network: "regtest",
    });

    const { getProverRequest } = stubFetchCapture();

    const result = await service.processMint(buildRequest());

    // The mint should reach the prover and return success.
    expect(result.success).toBe(true);

    const captured = getProverRequest();
    expect(captured, "prover POST must have been captured").toBeTruthy();
    const body = captured!.body;

    // 1. app_private_inputs is a top-level field, NOT nested in the spell.
    expect(
      body.app_private_inputs,
      "app_private_inputs must be present",
    ).toBeDefined();
    expect(typeof body.app_private_inputs).toBe("object");

    // 2. Keyed by the FULL app string "n/<app_id>/<app_vk>" (not just the VK).
    const expectedKey = `n/${appId}/${NFT_CONTRACT_VK}`;
    const witnessHex = body.app_private_inputs[expectedKey];
    expect(
      witnessHex,
      `app_private_inputs must be keyed by the full app string "${expectedKey}"`,
    ).toBeDefined();
    expect(typeof witnessHex).toBe("string");

    // 3. Value decodes (CBOR) to { operation: "mint" }.
    const decoded = cbor.decode(new Uint8Array(Buffer.from(witnessHex, "hex")));
    expect(decoded).toEqual({ operation: "mint" });
  });

  it("sets spell version to 15", async () => {
    const appId = "deadbeef".repeat(8);
    const service = new NFTMintingServiceSimple({
      appId,
      network: "regtest",
    });

    const { getProverRequest } = stubFetchCapture();

    const result = await service.processMint(buildRequest());
    expect(result.success).toBe(true);

    const body = getProverRequest()!.body;

    // spell is hex-encoded CBOR; decode and read version.
    expect(typeof body.spell).toBe("string");
    const decoded = cbor.decode(new Uint8Array(Buffer.from(body.spell, "hex")));
    expect(decoded.version).toBe(15);
  });

  it("keeps app_public_inputs INSIDE the spell (does not move it to the request top level)", async () => {
    const appId = "deadbeef".repeat(8);
    const service = new NFTMintingServiceSimple({
      appId,
      network: "regtest",
    });

    const { getProverRequest } = stubFetchCapture();

    await service.processMint(buildRequest());

    const body = getProverRequest()!.body;

    // app_public_inputs must NOT be hoisted to the request top level.
    expect(
      body.app_public_inputs,
      "app_public_inputs must stay inside the spell, not on the request body",
    ).toBeUndefined();

    // ... and must be present inside the decoded spell.
    const decoded = cbor.decode(new Uint8Array(Buffer.from(body.spell, "hex")));
    expect(decoded.app_public_inputs).toBeDefined();
  });

  it("sends binaries and prev_txs alongside the witness", async () => {
    const appId = "deadbeef".repeat(8);
    const service = new NFTMintingServiceSimple({
      appId,
      network: "regtest",
    });

    const { getProverRequest } = stubFetchCapture();

    await service.processMint(buildRequest());

    const body = getProverRequest()!.body;

    // binaries keyed by the app VK with the compiled contract binary.
    expect(body.binaries).toBeDefined();
    expect(body.binaries[NFT_CONTRACT_VK]).toBe(NFT_CONTRACT_BINARY);

    // prev_txs present (regtest stub tx).
    expect(Array.isArray(body.prev_txs)).toBe(true);
    expect(body.prev_txs.length).toBeGreaterThan(0);
    expect(body.prev_txs[0].bitcoin).toBeTruthy();
  });
});
