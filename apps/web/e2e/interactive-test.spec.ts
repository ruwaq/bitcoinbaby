import { test, expect } from "@playwright/test";

/**
 * Interactive Testing with Screenshots
 *
 * Complete user journey with wallet import and screenshots.
 */

const TEST_MNEMONIC =
  "garden obtain mechanic nature aunt erode gun mention swear ball hair order";

test.describe("Interactive App Testing", () => {
  test("Complete app exploration with screenshots", async ({ page }) => {
    // Configure longer timeout for interactive testing
    test.setTimeout(120000);

    // Capture console errors
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      consoleErrors.push(`Page error: ${err.message}`);
    });

    // 1. HOME PAGE
    console.log("📸 Opening home page...");
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/01-home-token-tab.png",
      fullPage: true,
    });
    console.log("✅ Home page captured");

    // 2. MINING TAB
    console.log("📸 Opening mining tab...");
    await page.goto("/?tab=mining");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/02-mining-tab.png",
      fullPage: true,
    });
    console.log("✅ Mining tab captured");

    // 3. NFT TAB
    console.log("📸 Opening NFT tab...");
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/03-nft-tab.png",
      fullPage: true,
    });
    console.log("✅ NFT tab captured");

    // 4. WALLET TAB (before import)
    console.log("📸 Opening wallet tab...");
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/04-wallet-no-wallet.png",
      fullPage: true,
    });
    console.log("✅ Wallet tab (no wallet) captured");

    // 5. TRY TO IMPORT WALLET
    console.log("📸 Looking for import button...");
    const importButton = page.getByRole("button", { name: /import/i });
    if (await importButton.isVisible().catch(() => false)) {
      await importButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: "test-results/screenshots/05-import-wallet-modal.png",
        fullPage: true,
      });
      console.log("✅ Import modal captured");

      // Look for mnemonic input
      const mnemonicInput = page.locator(
        'textarea, input[placeholder*="word"], input[placeholder*="phrase"], input[placeholder*="mnemonic"]',
      );
      if ((await mnemonicInput.count()) > 0) {
        await mnemonicInput.first().fill(TEST_MNEMONIC);
        await page.waitForTimeout(500);
        await page.screenshot({
          path: "test-results/screenshots/06-mnemonic-entered.png",
          fullPage: true,
        });
        console.log("✅ Mnemonic entered");

        // Look for password input
        const passwordInput = page.locator('input[type="password"]');
        if ((await passwordInput.count()) > 0) {
          await passwordInput.first().fill("TestPassword123!");
          if ((await passwordInput.count()) > 1) {
            await passwordInput.nth(1).fill("TestPassword123!");
          }
          await page.screenshot({
            path: "test-results/screenshots/07-password-entered.png",
            fullPage: true,
          });
          console.log("✅ Password entered");

          // Submit
          const submitButton = page.getByRole("button", {
            name: /import|create|confirm|submit/i,
          });
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            await page.waitForTimeout(3000);
            await page.screenshot({
              path: "test-results/screenshots/08-wallet-imported.png",
              fullPage: true,
            });
            console.log("✅ Wallet import submitted");
          }
        }
      }
    }

    // 6. MORE TAB
    console.log("📸 Opening more tab...");
    await page.goto("/?tab=more");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/09-more-tab.png",
      fullPage: true,
    });
    console.log("✅ More tab captured");

    // 7. SETTINGS PAGE
    console.log("📸 Opening settings...");
    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: "test-results/screenshots/10-settings-page.png",
        fullPage: true,
      });
      console.log("✅ Settings page captured");
    }

    // 8. SEND PAGE
    console.log("📸 Opening send page...");
    await page.goto("/wallet/send");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/11-send-page.png",
      fullPage: true,
    });
    console.log("✅ Send page captured");

    // 9. CLAIM PAGE
    console.log("📸 Opening claim page...");
    await page.goto("/wallet/claim");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/12-claim-page.png",
      fullPage: true,
    });
    console.log("✅ Claim page captured");

    // 10. HISTORY PAGE
    console.log("📸 Opening history page...");
    await page.goto("/wallet/history");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/13-history-page.png",
      fullPage: true,
    });
    console.log("✅ History page captured");

    // 11. BACK TO WALLET TAB (after import attempt)
    console.log("📸 Final wallet state...");
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/14-wallet-final.png",
      fullPage: true,
    });
    console.log("✅ Final wallet state captured");

    // 12. NFT MINT ATTEMPT
    console.log("📸 Testing NFT mint flow...");
    await page.goto("/?tab=nfts");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);

    const mintButton = page.getByRole("button", { name: /mint/i });
    if (await mintButton.isVisible().catch(() => false)) {
      await mintButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: "test-results/screenshots/15-mint-clicked.png",
        fullPage: true,
      });
      console.log("✅ Mint button clicked");
    }

    // 13. MOBILE VIEW
    console.log("📸 Testing mobile view...");
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "test-results/screenshots/16-mobile-home.png",
      fullPage: true,
    });
    console.log("✅ Mobile home captured");

    await page.goto("/?tab=mining");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "test-results/screenshots/17-mobile-mining.png",
      fullPage: true,
    });
    console.log("✅ Mobile mining captured");

    await page.goto("/?tab=nfts");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "test-results/screenshots/18-mobile-nfts.png",
      fullPage: true,
    });
    console.log("✅ Mobile NFTs captured");

    await page.goto("/?tab=wallet");
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: "test-results/screenshots/19-mobile-wallet.png",
      fullPage: true,
    });
    console.log("✅ Mobile wallet captured");

    console.log("\n🎉 All screenshots captured in test-results/screenshots/");

    // Report any console errors
    if (consoleErrors.length > 0) {
      console.log("\n⚠️ Console errors captured:");
      consoleErrors.forEach((err, i) => {
        console.log(`  ${i + 1}. ${err}`);
      });
    } else {
      console.log("\n✅ No console errors detected");
    }
  });
});
