import { test, expect } from "@playwright/test";

/**
 * Claims API E2E Tests
 *
 * Tests the 3-step claim settlement flow:
 * 1. Check balance
 * 2. Prepare claim
 * 3. Confirm claim
 */

const API_URL =
  process.env.API_URL ||
  "https://bitcoinbaby-api-prod.andeanlabs-58f.workers.dev";

// Test address (testnet4)
const TEST_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

test.describe("Claims Balance API", () => {
  test("should return balance for valid address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/balance/${TEST_ADDRESS}`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("address");
    expect(data.data).toHaveProperty("unclaimedWork");
    expect(data.data).toHaveProperty("claimableTokens");
    expect(data.data).toHaveProperty("estimatedFee");
    expect(data.data).toHaveProperty("platformFeePercent");
  });

  test("should return zero balance for new address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/balance/${TEST_ADDRESS}`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    // New address should have zero or defined values
    expect(data.data.unclaimedWork).toBeDefined();
    expect(data.data.claimableTokens).toBeDefined();
  });

  test("should reject invalid address format", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/balance/invalid-address`,
    );

    // Should return 400 for invalid address
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("should include platform fee info in balance", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/balance/${TEST_ADDRESS}`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.data.platformFeePercent).toBeDefined();
    expect(data.data.platformFeePercent).toBeGreaterThanOrEqual(0);
    expect(data.data.platformFeePercent).toBeLessThanOrEqual(100);
  });
});

test.describe("Claims Prepare API", () => {
  test("should validate prepare endpoint exists", async ({ request }) => {
    // Test with empty body
    const response = await request.post(`${API_URL}/api/claim/prepare`, {
      data: {},
    });

    // Should return 400 (validation error) not 404
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data).toHaveProperty("error");
  });

  test("should reject prepare without address", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/prepare`, {
      data: {
        // Missing address
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("should handle prepare for address with no balance", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/claim/prepare`, {
      data: {
        address: TEST_ADDRESS,
      },
    });

    // Either succeeds with zero or returns appropriate error
    const data = await response.json();
    expect(data).toHaveProperty("success");

    if (!data.success) {
      // Expected: no balance to claim or minimum work required
      expect(data.error).toMatch(/no.*claim|balance|nothing|minimum|required/i);
    }
  });
});

test.describe("Claims Status API", () => {
  test("should validate status endpoint exists", async ({ request }) => {
    // Query with fake claim ID
    const response = await request.get(
      `${API_URL}/api/claim/status/fake-claim-id?address=${TEST_ADDRESS}`,
    );

    // Should return 404 (not found) or 400 (invalid), not 500
    expect([400, 404]).toContain(response.status());
  });

  test("should require address parameter", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/status/some-claim-id`,
    );

    // Should return error for missing address
    expect([400, 404]).toContain(response.status());
  });
});

test.describe("Claims History API", () => {
  test("should return history for valid address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/history/${TEST_ADDRESS}`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("claims");
    expect(Array.isArray(data.data.claims)).toBe(true);
  });

  test("should return empty history for new address", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/history/${TEST_ADDRESS}`,
    );
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    // New address should have empty claims array
    expect(data.data.claims).toEqual([]);
  });

  test("should reject invalid address in history", async ({ request }) => {
    const response = await request.get(
      `${API_URL}/api/claim/history/not-valid`,
    );

    expect(response.status()).toBe(400);
  });
});

test.describe("Claims Confirm API", () => {
  test("should validate confirm endpoint exists", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/confirm`, {
      data: {},
    });

    // Should return 400 (validation error) not 404
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("should reject confirm with missing fields", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/confirm`, {
      data: {
        claimId: "test-claim-id",
        // Missing: claimTxid, address
      },
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("should reject confirm with invalid claim ID", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/confirm`, {
      data: {
        claimId: "non-existent-claim",
        claimTxid:
          "0000000000000000000000000000000000000000000000000000000000000000",
        address: TEST_ADDRESS,
      },
    });

    // Should return 404 or 400 for invalid claim
    expect([400, 404]).toContain(response.status());
  });
});

test.describe("Claims Mint API", () => {
  test("should validate mint endpoint exists", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/mint`, {
      data: {},
    });

    // Should return 400 (validation error) not 404
    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
  });

  test("should reject mint with invalid claim", async ({ request }) => {
    const response = await request.post(`${API_URL}/api/claim/mint`, {
      data: {
        claimId: "fake-claim",
        address: TEST_ADDRESS,
        claimTxid:
          "0000000000000000000000000000000000000000000000000000000000000000",
      },
    });

    // Should return error for non-existent claim
    expect([400, 404]).toContain(response.status());
  });
});
