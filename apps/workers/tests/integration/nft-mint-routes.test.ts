/**
 * Unified /mint route — D3
 *
 * Guards the secure two-step mint flow that replaces reserve → prove → confirm
 * (and the divergent /claim). See
 * docs/superpowers/notes/SESSION-8-HANDOFF.md for the bug catalogue this route
 * closes (#1 free mint, #2 client-supplied traits, #3 unvalidated UTXO
 * ownership, #4 race, #5 replay, #6 blind trust, #9 invisible NFTs).
 *
 * Strategy: mock Redis (getRedis) and stub global fetch so the prover POST is
 * captured while the mempool GETs return canned JSON for UTXO ownership /
 * outspend / tx-detail checks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../src/lib/types";
import type { Redis } from "@upstash/redis";
import { mintRouter } from "../../src/routes/nft/mint";

// =============================================================================
// CONSTANTS / FIXTURES
// =============================================================================

const TEST_APP_ID = "deadbeef".repeat(8); // 64 hex chars, NOT the placeholder
const TEST_APP_VK = "cafe".repeat(16);
const PLACEHOLDER =
  "0000000000000000000000000000000000000000000000000000000000000000";

const OWNER_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const TREASURY_ADDRESS =
  "tb1p7kk2fuf8kv5vjftczlezfded94v9ay9s0h7ggd87k5d5ws744lesw7smmu";

const FUNDING_UTXO = {
  txid: "ab".repeat(32),
  vout: 0,
  value: 10_000, // comfortably > price (5000) + dust (330) + fee reserve (1000)
};
const SPELL_TXID = "cd".repeat(32);

// =============================================================================
// REDIS MOCK
// =============================================================================

function makeRedisMock() {
  return {
    get: vi.fn(async () => null as unknown),
    set: vi.fn(async () => "OK"),
    setnx: vi.fn(async () => 1 as number),
    expire: vi.fn(async () => 1 as number),
    hset: vi.fn(async () => 1 as number),
    hgetall: vi.fn(async () => ({}) as Record<string, string>),
    sadd: vi.fn(async () => 1 as number),
    srem: vi.fn(async () => 1 as number),
    del: vi.fn(async () => 1 as number),
    exists: vi.fn(async () => 0 as number),
    smembers: vi.fn(async () => [] as string[]),
    incr: vi.fn(async () => 1 as number),
  };
}

vi.mock("../../src/lib/redis", () => ({
  getRedis: vi.fn(),
}));

import { getRedis } from "../../src/lib/redis";

// =============================================================================
// FETCH MOCK (prover + mempool)
// =============================================================================

interface CapturedProverRequest {
  url: string;
  body: Record<string, unknown>;
}

/**
 * Build a fetch mock that routes by URL substring:
 *   - POST .../spells/prove → capture body, return 2-tx array response.
 *   - GET .../outspend/<vout>  → { spent: false } (UTXO is unspent).
 *   - GET .../tx/<id> (JSON)   → tx detail with vout paying OWNER_ADDRESS.
 *   - GET .../tx/<id>/hex      → raw hex (used by processMint's fetchRawTransaction).
 *
 * Tests override pieces via the returned setters.
 */
function stubFetchCapture(): {
  getProverRequest: () => CapturedProverRequest | undefined;
  setOutspend: (spent: boolean) => void;
  setTxDetail: (detail: MempoolTxDetail | null) => void;
  setTxHex: (hex: string) => void;
} {
  let captured: CapturedProverRequest | undefined;
  let outspend = { spent: false };
  let txDetail: MempoolTxDetail | null = {
    txid: FUNDING_UTXO.txid,
    status: { confirmed: true },
    vout: [
      {
        scriptpubkey: "5120deadbeef",
        scriptpubkey_address: OWNER_ADDRESS,
        scriptpubkey_type: "v0_p2tr",
        value: FUNDING_UTXO.value,
      },
    ],
  };
  let txHex =
    "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100f2052a010000000000000000";

  const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
    const method = (opts && opts.method) || "GET";
    const u = String(url);

    if (method === "POST") {
      const rawBody = opts && opts.body;
      const body =
        typeof rawBody === "string"
          ? (JSON.parse(rawBody) as Record<string, unknown>)
          : (rawBody as Record<string, unknown>);
      captured = { url: u, body };
      return new Response(
        JSON.stringify([
          { bitcoin: "dead".repeat(125) },
          { bitcoin: "beef".repeat(125) },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // GET routing
    if (u.includes("/outspend/")) {
      return new Response(JSON.stringify(outspend), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (u.endsWith("/hex")) {
      return new Response(txHex, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    }
    // /tx/<txid> JSON detail
    if (txDetail === null) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(txDetail), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  vi.stubGlobal("fetch", fetchMock);
  return {
    getProverRequest: () => captured,
    setOutspend: (spent: boolean) => {
      outspend = { spent };
    },
    setTxDetail: (detail: MempoolTxDetail | null) => {
      txDetail = detail;
    },
    setTxHex: (hex: string) => {
      txHex = hex;
    },
  };
}

interface MempoolTxDetail {
  txid: string;
  status: { confirmed: boolean };
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address?: string;
    scriptpubkey_type: string;
    value: number;
  }>;
}

// =============================================================================
// TEST APP
// =============================================================================

function buildTestApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", mintRouter);
  return app;
}

const TEST_ENV: Partial<Env> = {
  ENVIRONMENT: "development",
  PROVER_URL: "https://v15.charms.dev",
  NFT_APP_ID: TEST_APP_ID,
  NFT_APP_VK: TEST_APP_VK,
  NFT_MINT_PRICE_SATS: "5000",
  NFT_TREASURY_ADDRESS: TREASURY_ADDRESS,
};

async function sendRequest(
  app: Hono<{ Bindings: Partial<Env> }>,
  path: string,
  init: RequestInit,
  env: Partial<Env> = TEST_ENV,
): Promise<Response> {
  return app.request(path, init, env as unknown as Env);
}

function postJson(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

// =============================================================================
// TESTS — /mint/prepare
// =============================================================================

describe("POST /api/nft/mint/prepare", () => {
  let app: Hono<{ Bindings: Partial<Env> }>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = makeRedisMock();
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    app = buildTestApp();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns 200 with spell hex + server-generated traits for a valid UTXO", async () => {
    const { getProverRequest } = stubFetchCapture();

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: {
        tokenId: number;
        traits?: { rarityTier: string; bloodline: string };
        commitTxHex?: string;
        spellTxHex?: string;
        priceSats: number;
        treasuryAddress: string;
      };
    };
    expect(json.success).toBe(true);
    expect(json.data?.commitTxHex).toBeTruthy();
    expect(json.data?.spellTxHex).toBeTruthy();
    // Traits are present and look well-formed.
    expect(json.data?.traits?.rarityTier).toBeTruthy();
    expect(json.data?.traits?.bloodline).toBeTruthy();
    expect(json.data?.priceSats).toBe(5000);
    expect(json.data?.treasuryAddress).toBe(TREASURY_ADDRESS);

    // The prover was hit with prev_txs populated.
    const captured = getProverRequest();
    expect(captured, "prover POST must have been captured").toBeTruthy();
    expect(Array.isArray(captured!.body.prev_txs)).toBe(true);
    expect(captured!.body.prev_txs.length).toBeGreaterThan(0);

    // The atomic payment made it into the spell (2 coins: NFT + treasury).
    expect(captured!.body.spell).toBeTruthy();
  });

  it("rejects with 400 when the funding UTXO does not belong to the requester (bug #3)", async () => {
    const { setTxDetail } = stubFetchCapture();
    setTxDetail({
      txid: FUNDING_UTXO.txid,
      status: { confirmed: true },
      vout: [
        {
          scriptpubkey: "5120aaaa",
          // Owned by someone ELSE:
          scriptpubkey_address: "tb1qsomeotheraddress000000000000000000000",
          scriptpubkey_type: "v0_p2tr",
          value: FUNDING_UTXO.value,
        },
      ],
    });

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/does not belong/i);

    // And the lock is still released? No — we hold it to rate-limit retries,
    // but we must NOT have consumed a tokenId (no incr past the supply check).
    // The prover must NOT have been called.
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the funding UTXO is already spent", async () => {
    const { setOutspend } = stubFetchCapture();
    setOutspend(true); // spent → owner resolves to null

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/spent|exist/i);
  });

  it("rejects with 400 when UTXO value is below price + dust + fee", async () => {
    stubFetchCapture();

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({
        address: OWNER_ADDRESS,
        fundingUtxo: { ...FUNDING_UTXO, value: 1000 }, // too low
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/below the minimum|insufficient/i);
  });

  it("rejects with 400 when supply is exhausted", async () => {
    stubFetchCapture();
    redis.get.mockResolvedValue("10000" as never); // MAX_SUPPLY reached

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/supply/i);
  });

  it("rejects with 409 when the funding UTXO is already being processed (race, bug #4)", async () => {
    stubFetchCapture();
    redis.setnx.mockResolvedValue(0 as never); // lock not acquired

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/in progress|already/i);
  });

  it("returns 503 when NFT_APP_ID is the placeholder (app not yet deployed)", async () => {
    stubFetchCapture();

    const res = await sendRequest(
      app,
      "/api/nft/mint/prepare",
      postJson({ address: OWNER_ADDRESS, fundingUtxo: FUNDING_UTXO }),
      { ...TEST_ENV, NFT_APP_ID: PLACEHOLDER },
    );

    expect(res.status).toBe(503);
  });
});

// =============================================================================
// TESTS — /mint/finalize
// =============================================================================

describe("POST /api/nft/mint/finalize", () => {
  let app: Hono<{ Bindings: Partial<Env> }>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = makeRedisMock();
    // By default no pending record exists → /finalize regenerates from txid.
    redis.get.mockResolvedValue(null as never);
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    app = buildTestApp();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A confirmed spell tx paying NFT dust to the owner + price to treasury. */
  function validSpellTxDetail(): MempoolTxDetail {
    return {
      txid: SPELL_TXID,
      status: { confirmed: true },
      vout: [
        {
          scriptpubkey: "5120dead",
          scriptpubkey_address: OWNER_ADDRESS,
          scriptpubkey_type: "v0_p2tr",
          value: 330, // NFT_DUST_SATS
        },
        {
          scriptpubkey: "5120cafe",
          scriptpubkey_address: TREASURY_ADDRESS,
          scriptpubkey_type: "v0_p2tr",
          value: 5000, // price
        },
      ],
    };
  }

  it("returns 200 and persists the NFT (incl. nft:all-tokens, bug #9) for a confirmed spell tx", async () => {
    const { setTxDetail } = stubFetchCapture();
    setTxDetail(validSpellTxDetail());

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: { confirmed: boolean; tokenId: number };
    };
    expect(json.success).toBe(true);
    expect(json.data?.confirmed).toBe(true);

    // Closes bug #9: nft:all-tokens is updated.
    expect(redis.sadd).toHaveBeenCalledWith(
      "nft:all-tokens",
      expect.any(String),
    );
    // And the indexer sets.
    expect(redis.hset).toHaveBeenCalled();
    expect(redis.sadd).toHaveBeenCalledWith(
      `nft:owned:${OWNER_ADDRESS}`,
      expect.any(String),
    );
    // Anti-replay marker.
    expect(redis.set).toHaveBeenCalledWith(
      `nft:minted:txid:${SPELL_TXID}`,
      expect.any(String),
    );
  });

  it("rejects with 400 when the spell tx is not yet confirmed (bug #6)", async () => {
    const { setTxDetail } = stubFetchCapture();
    setTxDetail({ ...validSpellTxDetail(), status: { confirmed: false } });

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/confirmed/i);
  });

  it("rejects with 400 when the treasury output is below the price", async () => {
    const { setTxDetail } = stubFetchCapture();
    setTxDetail({
      txid: SPELL_TXID,
      status: { confirmed: true },
      vout: [
        {
          scriptpubkey: "5120dead",
          scriptpubkey_address: OWNER_ADDRESS,
          scriptpubkey_type: "v0_p2tr",
          value: 330,
        },
        {
          scriptpubkey: "5120cafe",
          scriptpubkey_address: TREASURY_ADDRESS,
          scriptpubkey_type: "v0_p2tr",
          value: 1000, // below price 5000
        },
      ],
    });

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/treasury/i);
  });

  it("rejects with 409 when the spell tx was already finalized (bug #5 replay)", async () => {
    stubFetchCapture();
    // First GET (anti-replay marker) returns an existing tokenId.
    redis.get.mockResolvedValue("42" as never);

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(409);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/already/i);
  });

  it("rejects with 409 when two finalizes race on the same spell txid (bug #4)", async () => {
    stubFetchCapture();
    // First GET (anti-replay) = null; setnx = 0 (someone else holds the lock).
    redis.get.mockResolvedValue(null as never);
    redis.setnx.mockResolvedValue(0 as never);

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(409);
  });

  it("returns 404 when the spell tx is not on-chain yet", async () => {
    const { setTxDetail } = stubFetchCapture();
    setTxDetail(null); // mempool returns 404

    const res = await sendRequest(
      app,
      "/api/nft/mint/finalize",
      postJson({ spellTxid: SPELL_TXID, address: OWNER_ADDRESS }),
    );

    expect(res.status).toBe(404);
  });
});
