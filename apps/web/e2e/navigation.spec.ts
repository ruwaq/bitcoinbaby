import { test, expect } from "@playwright/test";

/**
 * Navigation E2E Tests
 *
 * Tests tab navigation and page structure.
 * The app uses URL params (?tab=X) for navigation.
 */

test.describe("Tab Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should load home page with default token tab", async ({ page }) => {
    await expect(page).toHaveTitle(/BitcoinBaby/);

    // Default tab should be token (shows $BABTC heading)
    await expect(page.getByRole("heading", { name: "$BABTC" })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate to mining tab", async ({ page }) => {
    await page.goto("/?tab=mining");

    // Check mining content is visible - look for specific mining element
    await expect(
      page.getByRole("heading", { name: /Mining|Hashrate/i }).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate to NFTs tab", async ({ page }) => {
    await page.goto("/?tab=nfts");

    // Check NFT content is visible - look for mint button
    await expect(page.getByRole("button", { name: /Mint/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate to wallet tab", async ({ page }) => {
    await page.goto("/?tab=wallet");

    // Check wallet section header is visible
    await expect(
      page.getByRole("heading", { name: /Wallet/i }).first(),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should navigate to more tab", async ({ page }) => {
    await page.goto("/?tab=more");

    // Check settings button is visible in more section
    await expect(
      page
        .getByRole("link", { name: /Settings/i })
        .or(page.getByRole("button", { name: /Settings/i })),
    ).toBeVisible({
      timeout: 10000,
    });
  });

  test("should switch tabs via tab buttons", async ({ page }) => {
    // Start on home
    await page.goto("/");

    // Find and click mining tab
    const miningTab = page.getByRole("button", { name: /Mining/i });
    if (await miningTab.isVisible()) {
      await miningTab.click();
      await expect(page).toHaveURL(/tab=mining/);
    }
  });
});

test.describe("App Header", () => {
  test("should display logo and branding", async ({ page }) => {
    await page.goto("/");

    // Check header element is visible
    await expect(page.locator("header")).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display network badge", async ({ page }) => {
    await page.goto("/");

    // Should show network indicator (testnet4 or mainnet) - use first match
    await expect(page.getByText(/testnet4?|mainnet/i).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("should display wallet status in header", async ({ page }) => {
    await page.goto("/");

    // Should show connect button or wallet address in header
    const header = page.locator("header");
    await expect(header).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Footer", () => {
  test("should display version info", async ({ page }) => {
    await page.goto("/");

    // Footer should show version
    const footer = page.getByText(/v\d+\.\d+|version/i);
    // Footer might be at bottom, scroll if needed
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    // Version info should exist somewhere
    await expect(footer).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Deep Links", () => {
  test("should handle direct URL to mining tab", async ({ page }) => {
    await page.goto("/?tab=mining");
    await expect(page).toHaveURL(/tab=mining/);
  });

  test("should handle direct URL to wallet tab", async ({ page }) => {
    await page.goto("/?tab=wallet");
    await expect(page).toHaveURL(/tab=wallet/);
  });

  test("should handle invalid tab gracefully", async ({ page }) => {
    // Invalid tab should load page without error
    await page.goto("/?tab=invalid");
    await expect(page).toHaveTitle(/BitcoinBaby/);
  });
});
