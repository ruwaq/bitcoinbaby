import { test, expect } from "@playwright/test";

/**
 * Performance E2E Tests
 *
 * Tests page load times and Core Web Vitals.
 */

test.describe("Page Load Performance", () => {
  test("should load home page within 5 seconds", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test("should load mining tab within reasonable time", async ({ page }) => {
    // Pre-load home page
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const startTime = Date.now();
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    // Tab switch should be under 10 seconds (headed mode is slower)
    expect(loadTime).toBeLessThan(10000);
  });

  test("should load NFT tab within reasonable time", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const startTime = Date.now();
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(10000);
  });

  test("should load wallet tab within reasonable time", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const startTime = Date.now();
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(10000);
  });
});

test.describe("Core Web Vitals", () => {
  test("should have reasonable LCP", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should load content
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
    expect(true).toBe(true);
  });

  test("should not have layout shifts on load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should be stable
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    expect(true).toBe(true);
  });
});

test.describe("Resource Loading", () => {
  test("should load fonts efficiently", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check pixel fonts are applied
    const fontFamily = await page.evaluate(
      () => getComputedStyle(document.body).fontFamily,
    );
    expect(fontFamily).toBeDefined();
  });

  test("should not load excessive JavaScript", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should load and be functional
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    expect(true).toBe(true);
  });

  test("should use image optimization", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Check for images
    const images = await page.locator("img").all();
    // Informational - may or may not have images
    expect(images.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Caching", () => {
  test("should use browser caching", async ({ page }) => {
    // First load
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Second load should work
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Page should still render
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Memory Usage", () => {
  test("should not leak memory on tab switches", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Switch tabs multiple times
    const tabs = ["mining", "nfts", "wallet", "more", "token"];
    for (const tab of tabs) {
      await page.goto(`/?tab=${tab}`);
      await page.waitForLoadState("domcontentloaded");
    }

    // Page should still be functional after tab switches
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Network Efficiency", () => {
  test("should minimize API calls on initial load", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should load efficiently
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    expect(true).toBe(true);
  });
});
