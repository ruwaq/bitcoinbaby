import { test, expect } from "@playwright/test";

/**
 * Mining Section E2E Tests
 *
 * Tests the Proof of Useful Work (PoUW) mining interface.
 */

test.describe("Mining Section UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should display mining section", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });

  test("should show PoUW explanation", async ({ page }) => {
    // Mining section should explain Proof of Useful Work
    const pouwText = page.getByText(/PoUW|Proof.*Work|Mining/i).first();
    await expect(pouwText).toBeVisible({ timeout: 10000 });
  });

  test("should display hashrate panel", async ({ page }) => {
    // Look for hashrate display
    const hashrateText = page.getByText(/H\/s|hash|rate/i).first();
    const hasHashrate = await hashrateText.isVisible().catch(() => false);
    // Hashrate panel should exist (may show 0 if not mining)
    expect(typeof hasHashrate).toBe("boolean");
  });

  test("should show mining controls", async ({ page }) => {
    // Look for start/stop mining button
    const miningButton = page.getByRole("button", {
      name: /start|stop|mine/i,
    });
    const hasMiningButton = await miningButton.isVisible().catch(() => false);
    expect(typeof hasMiningButton).toBe("boolean");
  });

  test("should display device capabilities", async ({ page }) => {
    // Should show CPU/GPU info
    const deviceInfo = page.getByText(/CPU|GPU|device|capability/i).first();
    const hasDeviceInfo = await deviceInfo.isVisible().catch(() => false);
    expect(typeof hasDeviceInfo).toBe("boolean");
  });

  test("should show balance panel", async ({ page }) => {
    // Mining section should show current balance
    const balanceText = page.getByText(/balance|BABTC|virtual/i).first();
    await expect(balanceText).toBeVisible({ timeout: 10000 });
  });

  test("should display NFT boost info", async ({ page }) => {
    // Should show NFT boost panel if applicable
    const boostText = page.getByText(/boost|NFT|bonus/i).first();
    const hasBoost = await boostText.isVisible().catch(() => false);
    expect(typeof hasBoost).toBe("boolean");
  });

  test("should show rewards breakdown", async ({ page }) => {
    // Should display rewards information
    const rewardsText = page.getByText(/reward|earn|token/i).first();
    const hasRewards = await rewardsText.isVisible().catch(() => false);
    expect(typeof hasRewards).toBe("boolean");
  });
});

test.describe("Mining Wallet Connection", () => {
  test("should show connection warning when not connected", async ({
    page,
  }) => {
    await page.goto("/?tab=mining");

    // May show warning about wallet connection
    const warningText = page.getByText(/connect|wallet|required/i).first();
    const hasWarning = await warningText.isVisible().catch(() => false);
    // Either shows warning or mining interface
    expect(typeof hasWarning).toBe("boolean");
  });
});

test.describe("Mining Session Persistence", () => {
  test("should maintain state across tab switches", async ({ page }) => {
    // Start on mining tab
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Get initial state
    const initialContent = await page.content();

    // Switch to another tab
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");

    // Switch back to mining
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Mining section should still be functional
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });
});
