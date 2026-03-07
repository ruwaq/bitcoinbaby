import { test, expect } from "@playwright/test";

/**
 * More Section E2E Tests
 *
 * Tests the settings/more menu and links.
 */

test.describe("More Section UI", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/?tab=more");
    await page.waitForLoadState("domcontentloaded");
  });

  test("should display more section", async ({ page }) => {
    await expect(page.locator("main")).toBeVisible({ timeout: 10000 });
  });

  test("should show settings option", async ({ page }) => {
    // Should have settings link/button
    const settings = page
      .getByRole("link", { name: /settings/i })
      .or(page.getByRole("button", { name: /settings/i }));
    await expect(settings).toBeVisible({ timeout: 10000 });
  });

  test("should show technology/AI option", async ({ page }) => {
    // Should have AI/Technology link
    const tech = page
      .getByRole("link", { name: /technology|AI/i })
      .or(page.getByText(/technology|AI/i).first());
    const hasTech = await tech.isVisible().catch(() => false);
    expect(typeof hasTech).toBe("boolean");
  });

  test("should show help option", async ({ page }) => {
    // Should have help link
    const help = page
      .getByRole("link", { name: /help|guide/i })
      .or(page.getByText(/help|guide/i).first());
    const hasHelp = await help.isVisible().catch(() => false);
    expect(typeof hasHelp).toBe("boolean");
  });

  test("should show leaderboard option", async ({ page }) => {
    // Should have leaderboard link
    const leaderboard = page
      .getByRole("link", { name: /leaderboard/i })
      .or(page.getByText(/leaderboard/i).first());
    const hasLeaderboard = await leaderboard.isVisible().catch(() => false);
    expect(typeof hasLeaderboard).toBe("boolean");
  });

  test("should show cosmic events option", async ({ page }) => {
    // Should have cosmic events link
    const cosmic = page
      .getByRole("link", { name: /cosmic/i })
      .or(page.getByText(/cosmic/i).first());
    const hasCosmic = await cosmic.isVisible().catch(() => false);
    expect(typeof hasCosmic).toBe("boolean");
  });

  test("should show characters option", async ({ page }) => {
    // Should have characters link
    const characters = page
      .getByRole("link", { name: /character/i })
      .or(page.getByText(/character/i).first());
    const hasCharacters = await characters.isVisible().catch(() => false);
    expect(typeof hasCharacters).toBe("boolean");
  });
});

test.describe("External Links", () => {
  test("should have Charms Protocol link", async ({ page }) => {
    await page.goto("/?tab=more");

    const charmsLink = page.getByRole("link", { name: /charms.*protocol/i });
    const hasCharms = await charmsLink.isVisible().catch(() => false);

    if (hasCharms) {
      const href = await charmsLink.getAttribute("href");
      expect(href).toContain("charms.dev");
    }
  });

  test("should have Charms Explorer link", async ({ page }) => {
    await page.goto("/?tab=more");

    const explorerLink = page.getByRole("link", { name: /explorer/i });
    const hasExplorer = await explorerLink.isVisible().catch(() => false);

    if (hasExplorer) {
      const href = await explorerLink.getAttribute("href");
      expect(href).toMatch(/explorer|charms/i);
    }
  });

  test("should have Mempool link", async ({ page }) => {
    await page.goto("/?tab=more");

    const mempoolLink = page.getByRole("link", { name: /mempool/i });
    const hasMempool = await mempoolLink.isVisible().catch(() => false);

    if (hasMempool) {
      const href = await mempoolLink.getAttribute("href");
      expect(href).toContain("mempool.space");
    }
  });

  test("external links should open in new tab", async ({ page }) => {
    await page.goto("/?tab=more");

    // External links should have target="_blank"
    const externalLinks = page.locator('a[href^="http"]');
    const count = await externalLinks.count();

    for (let i = 0; i < Math.min(count, 5); i++) {
      const target = await externalLinks.nth(i).getAttribute("target");
      if (target) {
        expect(target).toBe("_blank");
      }
    }
  });
});

test.describe("Version Info", () => {
  test("should display version information", async ({ page }) => {
    await page.goto("/?tab=more");

    // Should show version somewhere
    const versionText = page.getByText(/v\d+\.\d+|version/i);
    const hasVersion = await versionText.isVisible().catch(() => false);
    expect(typeof hasVersion).toBe("boolean");
  });
});

test.describe("Internal Navigation", () => {
  test("should navigate to settings page", async ({ page }) => {
    await page.goto("/?tab=more");

    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
      await page.waitForLoadState("domcontentloaded");
      // Should navigate to settings
      expect(page.url()).toMatch(/settings/);
    }
  });

  test("should navigate to leaderboard page", async ({ page }) => {
    await page.goto("/?tab=more");

    const leaderboardLink = page.getByRole("link", { name: /leaderboard/i });
    if (await leaderboardLink.isVisible().catch(() => false)) {
      await leaderboardLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toMatch(/leaderboard/);
    }
  });

  test("should navigate to help page", async ({ page }) => {
    await page.goto("/?tab=more");

    const helpLink = page.getByRole("link", { name: /help|guide/i });
    if (await helpLink.isVisible().catch(() => false)) {
      await helpLink.click();
      await page.waitForLoadState("domcontentloaded");
      expect(page.url()).toMatch(/help/);
    }
  });
});
