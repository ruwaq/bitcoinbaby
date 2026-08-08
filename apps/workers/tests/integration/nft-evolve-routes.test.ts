/**
 * NFT Evolution Routes — HTTP integration tests (Task 3.2)
 *
 * Exercises the REAL Hono router end-to-end via `app.request()`, the same
 * pattern used by claim-routes-http.test.ts. The evolution routes:
 *   POST /api/nft/work/:tokenId    — accrue XP (work_proof spell)
 *   POST /api/nft/evolve/:tokenId  — level up (level_up spell)
 *
 * Both validate ownership against the indexer (Redis `nft:owned:<addr>`), guard
 * against the unconfigured/placeholder NFT_APP_ID, fetch prev_txs, build the
 * spell via the evolution service, and proxy to the Charms v15 prover —
 * returning `{ commitTxHex, spellTxHex }` on success (mirroring POST /prove).
 *
 * We stub:
 *   - getRedis (ownership check + NFT state read) with controllable return values
 *   - global fetch (prover POST + mempool prev-tx fetch)
 *
 * Tests assert the route's REAL behavior — not a tautology.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Env } from "../../src/lib/types";
import type { Redis } from "@upstash/redis";
import { Hono } from "hono";

// =============================================================================
// CONSTANTS / FIXTURES
// =============================================================================

const TEST_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const OTHER_ADDRESS =
  "tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7";
// Real-shaped (non-placeholder) app id so the placeholder guard is satisfied.
const TEST_APP_ID = "deadbeef".repeat(8); // 64 hex chars
const TEST_APP_VK =
  "0d9483a760ef91eef606e84fbff326132b3e611bc913025913bc34b6655b08ba";
const PLACEHOLDER =
  "0000000000000000000000000000000000000000000000000000000000000000";

const TOKEN_ID = 1;
const NFT_UTXO = {
  txid: "ab".repeat(32),
  vout: 0,
};

/** NFT record shape as stored in Redis (camelCase hset fields). */
function makeNftRecord(
  overrides: Record<string, string> = {},
): Record<string, string> {
  return {
    tokenId: String(TOKEN_ID),
    txid: "cd".repeat(32),
    address: TEST_ADDRESS,
    mintedAt: String(Date.now()),
    dna: "a".repeat(64),
    bloodline: "royal",
    baseType: "human",
    rarityTier: "common",
    level: "1",
    xp: "0",
    totalXp: "0",
    workCount: "0",
    lastWorkBlock: "0",
    evolutionCount: "0",
    genesisBlock: "0",
    tokensEarned: "0",
    heritage: "0",
    ...overrides,
  };
}

// =============================================================================
// REDIS MOCK
// =============================================================================

/**
 * Build a controllable Redis stub. Each method returns a vi.fn the test can
 * override per-test via mockReturnValue/mockResolvedValue.
 *
 * The routes we test use:
 *   - hgetall("nft:minted:<id>")  → NFT state
 *   - sismember("nft:owned:<addr>", "<id>") → ownership (1 / 0)
 */
function makeRedisMock() {
  return {
    hgetall: vi.fn(async () => makeNftRecord()),
    sismember: vi.fn(async () => 1),
    // Unused but defined so other routes on the same router don't blow up.
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    setnx: vi.fn(async () => 1),
    expire: vi.fn(async () => 1),
    hset: vi.fn(async () => 1),
    sadd: vi.fn(async () => 1),
    srem: vi.fn(async () => 1),
    del: vi.fn(async () => 1),
    exists: vi.fn(async () => 0),
    smembers: vi.fn(async () => []),
    incr: vi.fn(async () => 1),
  };
}

vi.mock("../../src/lib/redis", () => ({
  getRedis: vi.fn(),
}));

import { getRedis } from "../../src/lib/redis";

// =============================================================================
// FETCH MOCK (prover + mempool prev-tx)
// =============================================================================

interface CapturedProverRequest {
  url: string;
  body: Record<string, unknown>;
}

/**
 * Stub global `fetch`:
 *   - GET  → returns a canned raw-tx hex (mempool `/tx/<txid>/hex`).
 *   - POST → captures the prover request body and returns the minimal valid
 *            prover response (array of 2 `{ bitcoin }` entries so commitTx +
 *            spellTx are extracted, matching NFTMintingServiceSimple.proveOnce).
 */
function stubFetchCapture(): {
  getProverRequest: () => CapturedProverRequest | undefined;
} {
  let captured: CapturedProverRequest | undefined;

  const fetchMock = vi.fn(async (url: string, opts?: RequestInit) => {
    const method = (opts && opts.method) || "GET";
    if (method === "POST") {
      const rawBody = opts && opts.body;
      const body =
        typeof rawBody === "string"
          ? (JSON.parse(rawBody) as Record<string, unknown>)
          : (rawBody as Record<string, unknown>);
      captured = { url, body };
      return new Response(
        JSON.stringify([
          { bitcoin: "dead".repeat(125) },
          { bitcoin: "beef".repeat(125) },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // GET — mempool prev-tx hex fetch.
    return new Response(
      "01000000010000000000000000000000000000000000000000000000000000000000000000ffffffff00ffffffff0100f2052a010000000000000000",
      { status: 200, headers: { "Content-Type": "text/plain" } },
    );
  });

  vi.stubGlobal("fetch", fetchMock);
  return { getProverRequest: () => captured };
}

// =============================================================================
// TEST APP
// =============================================================================

import { evolveRouter } from "../../src/routes/nft/evolve";

function buildTestApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", evolveRouter);
  return app;
}

const TEST_ENV: Partial<Env> = {
  ENVIRONMENT: "development",
  PROVER_URL: "https://v15.charms.dev",
  NFT_APP_ID: TEST_APP_ID,
  NFT_APP_VK: TEST_APP_VK,
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
// TESTS
// =============================================================================

describe("POST /api/nft/work/:tokenId", () => {
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

  it("returns 200 with commitTxHex + spellTxHex for a valid owner", async () => {
    const { getProverRequest } = stubFetchCapture();
    redis.sismember.mockResolvedValue(1 as never);
    redis.hgetall.mockResolvedValue(makeNftRecord() as never);

    const res = await sendRequest(
      app,
      `/api/nft/work/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        currentBlock: 800001,
        xpGain: 150,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: { commitTxHex?: string; spellTxHex?: string };
    };
    expect(json.success).toBe(true);
    expect(json.data?.commitTxHex).toBeTruthy();
    expect(json.data?.spellTxHex).toBeTruthy();

    // The route must have proxied to the prover with prev_txs populated.
    const captured = getProverRequest();
    expect(captured, "prover POST must have been captured").toBeTruthy();
    expect(Array.isArray(captured!.body.prev_txs)).toBe(true);
    expect(captured!.body.prev_txs.length).toBeGreaterThan(0);
    // app_private_inputs must carry the work_proof witness.
    expect(captured!.body.app_private_inputs).toBeDefined();
  });

  it("returns 403 when the requester is not the owner", async () => {
    stubFetchCapture();
    redis.sismember.mockResolvedValue(0 as never); // not owned

    const res = await sendRequest(
      app,
      `/api/nft/work/${TOKEN_ID}`,
      postJson({
        ownerAddress: OTHER_ADDRESS,
        currentBlock: 800001,
        xpGain: 150,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 503 'app ID not yet established' when NFT_APP_ID is the placeholder", async () => {
    stubFetchCapture();
    redis.sismember.mockResolvedValue(1 as never);

    const res = await sendRequest(
      app,
      `/api/nft/work/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        currentBlock: 800001,
        xpGain: 150,
        nftUtxo: NFT_UTXO,
      }),
      { ...TEST_ENV, NFT_APP_ID: PLACEHOLDER },
    );

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/app ID not yet established/i);
  });

  it("returns 404 when the NFT does not exist", async () => {
    stubFetchCapture();
    redis.hgetall.mockResolvedValue({} as never); // no record

    const res = await sendRequest(
      app,
      `/api/nft/work/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        currentBlock: 800001,
        xpGain: 150,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(404);
  });
});

describe("POST /api/nft/evolve/:tokenId", () => {
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

  it("returns 400 when the NFT is already at max level (21)", async () => {
    stubFetchCapture();
    redis.sismember.mockResolvedValue(1 as never);
    redis.hgetall.mockResolvedValue(
      makeNftRecord({ level: "21", evolutionCount: "20" }) as never,
    );

    const res = await sendRequest(
      app,
      `/api/nft/evolve/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/max level/i);
  });

  it("returns 403 from a non-owner", async () => {
    stubFetchCapture();
    redis.sismember.mockResolvedValue(0 as never);

    const res = await sendRequest(
      app,
      `/api/nft/evolve/${TOKEN_ID}`,
      postJson({
        ownerAddress: OTHER_ADDRESS,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(403);
  });

  it("returns 200 with commitTxHex + spellTxHex for a valid owner at level < 21", async () => {
    const { getProverRequest } = stubFetchCapture();
    redis.sismember.mockResolvedValue(1 as never);
    redis.hgetall.mockResolvedValue(
      makeNftRecord({ level: "2", xp: "300", evolutionCount: "1" }) as never,
    );

    const res = await sendRequest(
      app,
      `/api/nft/evolve/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        nftUtxo: NFT_UTXO,
      }),
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data?: { commitTxHex?: string; spellTxHex?: string };
    };
    expect(json.success).toBe(true);
    expect(json.data?.commitTxHex).toBeTruthy();
    expect(json.data?.spellTxHex).toBeTruthy();

    // Prover request must carry a level_up witness (operation only).
    const captured = getProverRequest();
    expect(captured, "prover POST must have been captured").toBeTruthy();
    expect(captured!.body.prev_txs.length).toBeGreaterThan(0);
    expect(captured!.body.app_private_inputs).toBeDefined();
  });

  it("returns 503 'app ID not yet established' when NFT_APP_ID is the placeholder", async () => {
    stubFetchCapture();
    redis.sismember.mockResolvedValue(1 as never);
    redis.hgetall.mockResolvedValue(makeNftRecord() as never);

    const res = await sendRequest(
      app,
      `/api/nft/evolve/${TOKEN_ID}`,
      postJson({
        ownerAddress: TEST_ADDRESS,
        nftUtxo: NFT_UTXO,
      }),
      { ...TEST_ENV, NFT_APP_ID: PLACEHOLDER },
    );

    expect(res.status).toBe(503);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/app ID not yet established/i);
  });
});
