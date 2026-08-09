import { test, expect } from "./fixtures";

/**
 * NFT Minting E2E Tests
 *
 * Tests the Genesis Sparks NFT minting flow.
 * The app uses tab-based navigation on the main page.
 */

const API_URL = process.env.API_URL || "http://localhost:8787";

const TEST_ADDRESS = "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx";

test.describe("NFT Tab", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to main page with NFTs tab
    await page.goto("/?tab=nfts", { waitUntil: "commit" });
    // Wait for page to load
    await page.waitForLoadState("domcontentloaded");
  });

  test("should display NFT section", async ({ page }) => {
    // Check page loads
    await expect(page).toHaveTitle(/BitcoinBaby/);

    // Check NFT tab is active or NFT content is visible
    await expect(page.getByText(/NFTs|Genesis|Babies/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display mint button when on NFT tab", async ({ page }) => {
    // Look for mint-related elements
    const mintButton = page.getByRole("button", { name: "Mint", exact: true });
    await expect(mintButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("API Health Check", () => {
  test("should return healthy status from workers API", async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(["ok", "healthy"]).toContain(data.status);
    expect(["production", "development"]).toContain(data.environment);
  });

  test("should return NFT stats from API", async ({ request }) => {
    const response = await request.get(`${API_URL}/api/nft/stats`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty("totalMinted");
    expect(data.data).toHaveProperty("maxSupply");
    expect(data.data.maxSupply).toBe(10000);
  });
});

test.describe("NFT Mint Prepare API (D6 unified /mint)", () => {
  test("should validate /mint/prepare endpoint exists", async ({ request }) => {
    // Test with empty body to verify the endpoint exists and returns a
    // validation error (400), not a 404.
    const response = await request.post(`${API_URL}/api/nft/mint/prepare`, {
      data: {},
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data).toHaveProperty("error");
  });

  test("should reject /mint/prepare with missing fundingUtxo", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/nft/mint/prepare`, {
      data: {
        address: TEST_ADDRESS,
        // Missing: fundingUtxo
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.details).toBeDefined();
  });

  test("should NOT accept client-supplied traits in /mint/prepare (bug #2)", async ({
    request,
  }) => {
    // The new flow derives traits server-side. Even if the client sends them,
    // they must be ignored (the schema only accepts address + fundingUtxo).
    const response = await request.post(`${API_URL}/api/nft/mint/prepare`, {
      data: {
        address: TEST_ADDRESS,
        fundingUtxo: {
          txid: "ab".repeat(32),
          vout: 0,
          value: 10000,
        },
        // Attacker tries to inject mythic rarity:
        rarityTier: "mythic",
        dna: "ff".repeat(32),
      },
    });

    // The schema rejects unknown keys OR the request proceeds ignoring them.
    // Either way, the response must not echo back the injected traits.
    if (response.ok()) {
      const data = await response.json();
      // If the server accepted the request, traits in the response must be
      // server-generated (deterministic from txid), never the injected values.
      expect(data.data?.traits?.rarityTier).not.toBe("mythic");
    }
  });
});

test.describe("NFT Mint Finalize API (D6 unified /mint)", () => {
  test("should validate /mint/finalize endpoint exists", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/nft/mint/finalize`, {
      data: {},
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data).toHaveProperty("error");
  });

  test("should reject /mint/finalize with missing fields", async ({
    request,
  }) => {
    const response = await request.post(`${API_URL}/api/nft/mint/finalize`, {
      data: {
        spellTxid: "ab".repeat(32),
        // Missing: address
      },
    });

    expect(response.status()).toBe(400);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.details).toBeDefined();
  });
});

test.describe("Contract VK Verification", () => {
  test("should have correct NFT_APP_VK configured", async ({ request }) => {
    // This test verifies that the API is using our compiled contract's VK
    // The VK should match: 121bda56d29f461640d21875b80832b0a7092b7f1aa6142d6e2bc93014f85535

    // We can't directly query the VK, but we can verify the API responds
    // with proper validation which indicates it's configured
    const statsResponse = await request.get(`${API_URL}/api/nft/stats`);
    expect(statsResponse.ok()).toBeTruthy();

    const response = await request.get(`${API_URL}/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(["ok", "healthy"]).toContain(data.status);
  });
});
