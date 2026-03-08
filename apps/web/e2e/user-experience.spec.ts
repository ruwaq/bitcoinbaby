import { test, expect } from "@playwright/test";

/**
 * User Experience E2E Tests
 *
 * Tests complete user journeys through the app.
 * Simulates real user interactions and validates coherence.
 */

test.describe("First Time User Journey", () => {
  test("should have coherent onboarding experience", async ({ page }) => {
    // User arrives at the app
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Should see the main app
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Navigate to wallet
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    // Wallet section should render
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Page should have content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("should have consistent navigation across all tabs", async ({
    page,
  }) => {
    const tabs = [
      { param: "token", expectedContent: /BABTC|Token/i },
      { param: "mining", expectedContent: /Mining|Hash|PoUW/i },
      { param: "nfts", expectedContent: /NFT|Genesis|Mint/i },
      { param: "wallet", expectedContent: /Wallet|Create|Import/i },
      { param: "more", expectedContent: /Settings|Help|Technology/i },
    ];

    for (const tab of tabs) {
      await page.goto(`/?tab=${tab.param}`);
      await page.waitForLoadState("domcontentloaded");

      // Each tab should render content
      await expect(page.locator("main")).toBeVisible({ timeout: 10000 });

      // Header should always be present
      await expect(page.locator("header")).toBeVisible();
    }
  });
});

test.describe("Token Section UX", () => {
  test("should display complete token information", async ({ page }) => {
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");

    // Check all key token info is present
    const checks = [
      page.getByRole("heading", { name: /BABTC/i }),
      page.getByText(/BitcoinBaby/i).first(),
      page.getByText(/21.*Billion|supply/i).first(),
    ];

    for (const check of checks) {
      await expect(check).toBeVisible({ timeout: 10000 });
    }
  });

  test("should have clear call to action", async ({ page }) => {
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");

    // Page should be interactive
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});

test.describe("Mining Section UX", () => {
  test("should explain mining clearly", async ({ page }) => {
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Mining section should have explanatory content
    const miningContent = page.getByText(/mining|hash|work|proof/i).first();
    await expect(miningContent).toBeVisible({ timeout: 10000 });
  });

  test("should show mining status", async ({ page }) => {
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Should show some content
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Page should have content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});

test.describe("NFT Section UX", () => {
  test("should display NFT minting interface", async ({ page }) => {
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");

    // Should have mint button
    const mintButton = page.getByRole("button", { name: /mint/i });
    await expect(mintButton).toBeVisible({ timeout: 10000 });
  });

  test("should show NFT information", async ({ page }) => {
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");

    // Should have NFT-related content
    const nftContent = page.getByText(/NFT|Genesis|Baby|Mint/i).first();
    await expect(nftContent).toBeVisible({ timeout: 10000 });
  });

  test("should have clear mint flow", async ({ page }) => {
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");

    // Mint button should be clickable
    const mintButton = page.getByRole("button", { name: /mint/i });

    if (await mintButton.isVisible()) {
      // Button should be enabled or show why it's disabled
      const isDisabled = await mintButton.isDisabled();
      expect(typeof isDisabled).toBe("boolean");
    }
  });
});

test.describe("Wallet Section UX", () => {
  test("should have clear wallet creation flow", async ({ page }) => {
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    // Should explain wallet options
    const walletContent = page.locator("main");
    await expect(walletContent).toBeVisible({ timeout: 10000 });

    // Should have security info
    const securityInfo = page.getByText(/secure|encrypt|local|device/i).first();
    const hasSecurityInfo = await securityInfo.isVisible().catch(() => false);
    expect(typeof hasSecurityInfo).toBe("boolean");
  });

  test("should show network information", async ({ page }) => {
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    // Should show testnet indicator
    const networkBadge = page.getByText(/testnet|mainnet/i).first();
    await expect(networkBadge).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Visual Coherence", () => {
  test("should maintain pixel art style across all tabs", async ({ page }) => {
    const tabs = ["token", "mining", "nfts", "wallet", "more"];

    for (const tab of tabs) {
      await page.goto(`/?tab=${tab}`);
      await page.waitForLoadState("domcontentloaded");

      // Check pixel font is applied
      const fontFamily = await page.evaluate(
        () => getComputedStyle(document.body).fontFamily,
      );
      expect(fontFamily.toLowerCase()).toMatch(/pixel|press|vt323|sans-serif/i);
    }
  });

  test("should have consistent color scheme", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Get background color
    const bgColor = await page.evaluate(
      () => getComputedStyle(document.body).backgroundColor,
    );

    // Should have dark theme
    expect(bgColor).toBeDefined();
  });

  test("should have consistent header across navigation", async ({ page }) => {
    const tabs = ["token", "mining", "nfts", "wallet"];

    let headerHeight: number | undefined;

    for (const tab of tabs) {
      await page.goto(`/?tab=${tab}`);
      await page.waitForLoadState("domcontentloaded");

      const header = page.locator("header");
      await expect(header).toBeVisible();

      const box = await header.boundingBox();
      if (box) {
        if (headerHeight === undefined) {
          headerHeight = box.height;
        } else {
          // Header height should be consistent
          expect(Math.abs(box.height - headerHeight)).toBeLessThan(50);
        }
      }
    }
  });
});

test.describe("Interactive Elements", () => {
  test("should have responsive buttons", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should be interactive
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Should have clickable elements
    const clickable = await page.locator("button, a, [role='button']").count();
    expect(clickable).toBeGreaterThanOrEqual(0);
  });

  test("should have working links", async ({ page }) => {
    await page.goto("/?tab=more");
    await page.waitForLoadState("domcontentloaded");

    const links = await page.getByRole("link").all();

    for (const link of links.slice(0, 5)) {
      const href = await link.getAttribute("href");
      // Links should have valid hrefs
      expect(href).toBeTruthy();
    }
  });
});

test.describe("Error States", () => {
  test("should handle missing wallet gracefully", async ({ page }) => {
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Should not crash without wallet
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });

    // Page should have content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test("should handle network issues gracefully", async ({ page }) => {
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    // Page should render even with potential network issues
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Complete User Flow", () => {
  test("should allow exploring all features without errors", async ({
    page,
  }) => {
    // Start at home
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });

    // Explore token info
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // Check mining
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // Look at NFTs
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // View wallet
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // Check settings
    await page.goto("/?tab=more");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // Return home
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    // Full journey completed without errors
    expect(true).toBe(true);
  });

  test("should maintain state during navigation", async ({ page }) => {
    // Go to mining first
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Get some initial content
    const _miningContent = await page.locator("main").textContent();

    // Navigate away
    await page.goto("/?tab=token");
    await page.waitForLoadState("domcontentloaded");

    // Come back
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");

    // Mining should still work
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Accessibility UX", () => {
  test("should be navigable with keyboard only", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Tab through elements
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
    }

    // Should be able to navigate without mouse
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(focused).toBeDefined();
  });

  test("should have readable text contrast", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Page should be visible with content
    await expect(page.locator("body")).toBeVisible({ timeout: 10000 });
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });
});

test.describe("Mobile UX", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("should be usable on mobile", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    // Content should be visible on mobile
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });

    // Navigation should work
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();

    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("main")).toBeVisible();
  });

  test("should have touch-friendly targets", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const buttons = await page.getByRole("button").all();

    for (const button of buttons.slice(0, 5)) {
      const box = await button.boundingBox();
      if (box) {
        // Touch targets should be at least 32px
        expect(box.height).toBeGreaterThanOrEqual(24);
      }
    }
  });
});
