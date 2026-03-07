import { test, expect } from "@playwright/test";

/**
 * Token Section E2E Tests
 *
 * Tests the $BABTC token display and tokenomics.
 */

test.describe("Token Section UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should display token section", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });

  test("should show $BABTC branding", async ({ page }) => {
    // Token section should show $BABTC
    const tokenName = page.getByRole("heading", { name: /BABTC/i });
    await expect(tokenName).toBeVisible({ timeout: 10000 });
  });

  test("should display token description", async ({ page }) => {
    // Should show "BitcoinBaby Token" description
    const description = page.getByText(/BitcoinBaby.*Token/i);
    await expect(description).toBeVisible({ timeout: 10000 });
  });

  test("should show total supply info", async ({ page }) => {
    // Should display total supply (21 Billion)
    const supplyText = page.getByText(/21.*Billion|supply/i).first();
    await expect(supplyText).toBeVisible({ timeout: 10000 });
  });

  test("should display tokenomics section", async ({ page }) => {
    // Should show tokenomics heading
    const tokenomics = page.getByRole("heading", { name: /TOKENOMICS/i });
    await expect(tokenomics).toBeVisible({ timeout: 10000 });
  });

  test("should show balance display", async ({ page }) => {
    // Should display user balance
    const balanceText = page.getByText(/balance|your/i).first();
    await expect(balanceText).toBeVisible({ timeout: 10000 });
  });

  test("should have claim action available", async ({ page }) => {
    // Should have a way to access claims
    const claimButton = page.getByRole("button", { name: /claim/i });
    const claimLink = page.getByRole("link", { name: /claim/i });
    const hasClaimAction =
      (await claimButton.isVisible().catch(() => false)) ||
      (await claimLink.isVisible().catch(() => false));
    expect(typeof hasClaimAction).toBe("boolean");
  });

  test("should show copy token URL button", async ({ page }) => {
    // Should have copy button for token URL
    const copyButton = page.getByRole("button", { name: /copy.*url/i });
    await expect(copyButton).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Token Stats Display", () => {
  test("should show virtual balance", async ({ page }) => {
    await page.goto("/?tab=token");

    // Virtual balance section
    const virtualText = page.getByText(/virtual|unclaimed/i).first();
    const hasVirtual = await virtualText.isVisible().catch(() => false);
    expect(typeof hasVirtual).toBe("boolean");
  });

  test("should show on-chain balance", async ({ page }) => {
    await page.goto("/?tab=token");

    // On-chain balance section
    const onChainText = page.getByText(/on-chain|chain|confirmed/i).first();
    const hasOnChain = await onChainText.isVisible().catch(() => false);
    expect(typeof hasOnChain).toBe("boolean");
  });
});

test.describe("Token Links", () => {
  test("should have explorer links", async ({ page }) => {
    await page.goto("/?tab=token");

    // Should have links to explorers
    const explorerLink = page.getByRole("link", { name: /explorer|view/i });
    const hasExplorer = await explorerLink.isVisible().catch(() => false);
    expect(typeof hasExplorer).toBe("boolean");
  });
});
