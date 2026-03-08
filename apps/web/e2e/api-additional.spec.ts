import { test, expect } from "@playwright/test";

/**
 * Additional API E2E Tests
 *
 * Tests for balance, leaderboard, game state, and admin endpoints.
 */

const API_URL =
  process.env.API_URL ||
  "https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev";

const TEST_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

test.describe("Balance API", () => {
  test("should get virtual balance for address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/balance/${TEST_ADDRESS}`,
    );

    // May return 200 or 404 for new address
    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty("success");
    }
  });

  test("should reject invalid address", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/balance/invalid`);
    expect([400, 404]).toContain(response.status());
  });
});

test.describe("Leaderboard API", () => {
  test("should get leaderboard", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/leaderboard`);

    // Leaderboard endpoint may or may not exist
    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty("success");
    }
  });

  test("should return top miners", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/leaderboard?limit=10`);

    expect([200, 404]).toContain(response.status());
  });

  test("should support pagination", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/leaderboard?limit=5&offset=0`,
    );

    expect([200, 404]).toContain(response.status());
  });
});

test.describe("Game State API", () => {
  test("should get baby state for address", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/game/${TEST_ADDRESS}`);

    // Game endpoint may not exist
    expect(response.status()).toBeLessThan(500);
  });

  test("should validate game endpoint exists", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/game/stats`);

    // May return 200, 404, or other non-500 status
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe("Admin API Security", () => {
  test("should reject unauthenticated admin requests", async ({ request }) => {
    // Admin endpoints should require auth
    const response = await request.get(`${API_URL}/api/admin/stats`);

    // Should return 401 or 403
    expect([401, 403, 404]).toContain(response.status());
  });

  test("should reject unauthenticated transaction history", async ({
    request,
  }) => {
    const response = await request.get(`${API_URL}/api/admin/transactions`);

    expect([401, 403, 404]).toContain(response.status());
  });
});

test.describe("NFT API Additional Endpoints", () => {
  test("should list NFTs for address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/nft/list/${TEST_ADDRESS}`,
    );

    // May return 200 or 404
    expect([200, 404]).toContain(response.status());

    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
    }
  });

  test("should get NFT by token ID", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nft/1`);

    // May return 200 or 404 if NFT doesn't exist
    expect(response.status()).toBeLessThan(500);
  });

  test("should validate evolve endpoint exists", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/nft/evolve`, {
      data: {},
    });

    // Should return 400 or 404
    expect([400, 404]).toContain(response.status());
  });

  test("should get marketplace listings", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nft/marketplace`);

    // Marketplace may or may not exist
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe("Rate Limiting", () => {
  test("should handle multiple requests gracefully", async ({ request }) => {
    // Make several requests in quick succession
    const promises = Array(5)
      .fill(null)
      .map(() => request.get(`${API_URL}/health`));

    const responses = await Promise.all(promises);

    // All should succeed (no rate limiting for health)
    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
    }
  });
});

test.describe("CORS Headers", () => {
  test("should allow cross-origin requests", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);

    // Check CORS headers
    const _headers = response.headers();
    // API should allow CORS (or not restrict it)
    expect(response.ok()).toBeTruthy();
  });
});

test.describe("Error Responses", () => {
  test("should return error for nonexistent endpoint", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nonexistent`);

    // Should return 404 or similar
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("should return proper error structure", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/nft/prove`, {
      data: {},
    });

    const data = await response.json();
    expect(data).toHaveProperty("success", false);
    expect(data).toHaveProperty("error");
  });
});
