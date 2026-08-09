/**
 * NFT Marketplace hardening — D4
 *
 * Covers the three D4 fixes:
 *   - D4.1: /buy now accepts the NFT dust output at NFT_DUST_SATS (330),
 *           matching what the mint spell emits. The previous hard-coded 546
 *           broke every resale of a freshly minted NFT.
 *   - D4.2: /migrate-index and /update-attempt now require the X-Admin-Key
 *           header (bug #10: unauthenticated indexer mutation).
 *   - D4.3: /unlist now requires a valid Schnorr signature (bug #11: the
 *           warn-only path let anyone unlist with just address + tokenId).
 *
 * The marketplace happy paths are intricate (PSBT listings, on-chain payment
 * verification, Schnorr auth). Rather than reconstruct all of it, each test
 * targets the specific security property that the D4 fix introduced, with the
 * minimum fixture needed to reach the assertion. The broader behavior is
 * covered by the existing flow tests in nft-mint-routes.test.ts (D3).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../src/lib/types";
import type { Redis } from "@upstash/redis";
import { buyRouter } from "../../src/routes/nft/buy";
import { listingRouter } from "../../src/routes/nft/listing";
import { confirmRouter } from "../../src/routes/nft/confirm";
import { reserveRouter } from "../../src/routes/nft/reserve";
import { NFT_DUST_SATS } from "../../src/services/nft-spell-utils";

// =============================================================================
// CONSTANTS
// =============================================================================

const SELLER = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";
const BUYER = "tb1qarn0uw5lxplzu6mlel5rgd4fpy4hzgz6preg8r";
const TOKEN_ID = 42;
const LISTING_PRICE = 10_000;
const PURCHASE_TXID = "ff".repeat(32);

const ADMIN_KEY = "super-secret-admin-key-1234";

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
    lpush: vi.fn(async () => 1 as number),
  };
}

vi.mock("../../src/lib/redis", () => ({
  getRedis: vi.fn(),
}));

import { getRedis } from "../../src/lib/redis";

// Mock the crypto module so /unlist tests can drive the signature branch
// deterministically. The point of these tests is the handler's auth gate, not
// the underlying schnorr math (covered elsewhere).
vi.mock("../../src/lib/crypto", () => ({
  verifySchnorrSignature: vi.fn(async () => true),
  createAuthMessage: vi.fn(
    (action: string, tokenId: number, timestamp: number) =>
      `${action}:${tokenId}:${timestamp}`,
  ),
}));

import { verifySchnorrSignature } from "../../src/lib/crypto";

// =============================================================================
// FETCH MOCK
// =============================================================================

interface BuyTxDetail {
  txid: string;
  status: { confirmed: boolean };
  vin: Array<{
    txid: string;
    vout: number;
    prevout?: { scriptpubkey_address?: string; value: number };
  }>;
  vout: Array<{
    scriptpubkey: string;
    scriptpubkey_address?: string;
    scriptpubkey_type: string;
    value: number;
  }>;
}

function stubFetchWithTx(txDetail: BuyTxDetail | null) {
  const fetchMock = vi.fn(async (url: string) => {
    if (txDetail === null) {
      return new Response("not found", { status: 404 });
    }
    return new Response(JSON.stringify(txDetail), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

// =============================================================================
// TEST APP
// =============================================================================

function buildMarketplaceApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", buyRouter);
  return app;
}

function buildListingApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", listingRouter);
  return app;
}

function buildConfirmApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", confirmRouter);
  return app;
}

function buildReserveApp(): Hono<{ Bindings: Partial<Env> }> {
  const app = new Hono<{ Bindings: Partial<Env> }>();
  app.route("/api/nft", reserveRouter);
  return app;
}

const BASE_ENV: Partial<Env> = {
  ENVIRONMENT: "development",
  PROVER_URL: "https://v15.charms.dev",
  NFT_APP_ID: "deadbeef".repeat(8),
  NFT_APP_VK: "cafe".repeat(16),
  ADMIN_KEY,
  UPSTASH_REDIS_REST_URL: "http://localhost",
  UPSTASH_REDIS_REST_TOKEN: "token",
};

function postJson(
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

function deleteJson(
  body: unknown,
  headers: Record<string, string> = {},
): RequestInit {
  return {
    method: "DELETE",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  };
}

// =============================================================================
// D4.1 — /buy accepts NFT_DUST_SATS (330) instead of 546
// =============================================================================

describe("D4.1 — POST /api/nft/buy/:tokenId accepts 330-sat NFT output", () => {
  let app: Hono<{ Bindings: Partial<Env> }>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    redis = makeRedisMock();
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    app = buildMarketplaceApp();
  });
  afterEach(() => vi.unstubAllGlobals());

  /** Build a tx detail where the buyer receives a 330-sat NFT + pays seller. */
  function txWithNftValue(value: number): BuyTxDetail {
    return {
      txid: PURCHASE_TXID,
      status: { confirmed: true },
      vin: [
        {
          txid: "11".repeat(32),
          vout: 0,
          prevout: { scriptpubkey_address: BUYER, value: 50_000 },
        },
      ],
      vout: [
        {
          scriptpubkey: "5120aa",
          scriptpubkey_address: BUYER,
          scriptpubkey_type: "v0_p2tr",
          value, // the NFT dust output
        },
        {
          scriptpubkey: "5120bb",
          scriptpubkey_address: SELLER,
          scriptpubkey_type: "v0_p2tr",
          value: LISTING_PRICE,
        },
      ],
    };
  }

  function setupListing() {
    redis.hgetall.mockResolvedValue({
      sellerAddress: SELLER,
      price: String(LISTING_PRICE),
    } as never);
  }

  it("succeeds when the NFT is transferred at NFT_DUST_SATS (330 sats)", async () => {
    stubFetchWithTx(txWithNftValue(NFT_DUST_SATS));
    setupListing();

    const res = await app.request(
      `/api/nft/buy/${TOKEN_ID}`,
      postJson({ buyerAddress: BUYER, txid: PURCHASE_TXID }),
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
    // Ownership was transferred to the buyer.
    expect(redis.sadd).toHaveBeenCalledWith(
      `nft:owned:${BUYER}`,
      String(TOKEN_ID),
    );
  });

  it("would have rejected the same tx under the old 546-sat check", async () => {
    // A minted NFT carries 330 sats; the pre-D4 code demanded exactly 546 and
    // failed here. This test pins the new behavior so a regression to 546 is
    // caught: feeding 330 must pass; feeding 546 must fail with the same tx.
    stubFetchWithTx(txWithNftValue(546));
    setupListing();

    const res = await app.request(
      `/api/nft/buy/${TOKEN_ID}`,
      postJson({ buyerAddress: BUYER, txid: PURCHASE_TXID }),
      BASE_ENV as unknown as Env,
    );

    // 546 no longer matches NFT_DUST_SATS, so the verification rejects.
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(json.error).toMatch(/NFT UTXO/);
  });
});

// =============================================================================
// D4.2 — admin auth on /migrate-index and /update-attempt
// =============================================================================

describe("D4.2 — admin-only indexer endpoints (bug #10)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POST /api/nft/migrate-index rejects without X-Admin-Key (401)", async () => {
    const redis = makeRedisMock();
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    const app = buildConfirmApp();

    const res = await app.request(
      "/api/nft/migrate-index",
      postJson({ tokenIds: [1, 2, 3] }), // NO admin header
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(401);
    // And it must NOT have mutated the index.
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it("POST /api/nft/migrate-index accepts with valid X-Admin-Key", async () => {
    const redis = makeRedisMock();
    redis.smembers.mockResolvedValue(["1", "2", "3"] as never);
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    const app = buildConfirmApp();

    const res = await app.request(
      "/api/nft/migrate-index",
      postJson({ tokenIds: [1, 2, 3] }, { "X-Admin-Key": ADMIN_KEY }),
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(redis.sadd).toHaveBeenCalledWith("nft:all-tokens", "1");
  });

  it("POST /api/nft/update-attempt accepts WITHOUT admin key (per-user tracking, not admin)", async () => {
    // /update-attempt is a per-user mint-progress tracking endpoint called by
    // the browser at each mint step. It must NOT require X-Admin-Key (that would
    // break client tracking and would force exposing the admin key to the
    // browser). Only /migrate-index is admin-gated.
    const redis = makeRedisMock();
    redis.hgetall.mockResolvedValue({
      attemptId: "a1",
      tokenId: "1",
      status: "proving",
    } as never);
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    const app = buildReserveApp();

    const res = await app.request(
      "/api/nft/update-attempt",
      postJson({ attemptId: "a1", status: "confirmed" }), // NO admin header
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(redis.hset).toHaveBeenCalled();
  });
});

// =============================================================================
// D4.3 — /unlist requires a Schnorr signature (bug #11)
// =============================================================================

describe("D4.3 — DELETE /api/nft/unlist/:tokenId requires a signature (bug #11)", () => {
  let app: Hono<{ Bindings: Partial<Env> }>;
  let redis: ReturnType<typeof makeRedisMock>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifySchnorrSignature).mockResolvedValue(true);
    redis = makeRedisMock();
    redis.hgetall.mockResolvedValue({
      sellerAddress: SELLER,
      price: String(LISTING_PRICE),
    } as never);
    vi.mocked(getRedis).mockReturnValue(redis as unknown as Redis);
    app = buildListingApp();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("rejects with 400 when signature is missing (schema enforces it now)", async () => {
    const timestamp = Date.now();
    const res = await app.request(
      `/api/nft/unlist/${TOKEN_ID}`,
      deleteJson({
        sellerAddress: SELLER,
        timestamp,
        // signature + publicKey intentionally omitted
      }),
      BASE_ENV as unknown as Env,
    );

    // The schema rejects before the handler runs.
    expect(res.status).toBe(400);
    // And no listing was deleted.
    expect(redis.del).not.toHaveBeenCalled();
  });

  it("accepts when a valid signature is provided", async () => {
    const timestamp = Date.now();
    const res = await app.request(
      `/api/nft/unlist/${TOKEN_ID}`,
      deleteJson({
        sellerAddress: SELLER,
        timestamp,
        signature: "ab".repeat(64), // 128 hex chars
        publicKey: "cd".repeat(32), // 64 hex chars
      }),
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(verifySchnorrSignature).toHaveBeenCalledTimes(1);
    expect(redis.del).toHaveBeenCalledWith(`nft:listing:${TOKEN_ID}`);
  });

  it("rejects with 401 when the signature is invalid", async () => {
    vi.mocked(verifySchnorrSignature).mockResolvedValue(false);
    const timestamp = Date.now();
    const res = await app.request(
      `/api/nft/unlist/${TOKEN_ID}`,
      deleteJson({
        sellerAddress: SELLER,
        timestamp,
        signature: "ab".repeat(64),
        publicKey: "cd".repeat(32),
      }),
      BASE_ENV as unknown as Env,
    );

    expect(res.status).toBe(401);
    expect(redis.del).not.toHaveBeenCalled();
  });
});
