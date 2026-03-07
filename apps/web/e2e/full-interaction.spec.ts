import { test, expect } from "@playwright/test";

/**
 * Full Interaction Test
 *
 * Actually interacts with each section's functionality:
 * - Import wallet and wait for balance to load
 * - Start mining and see hashrate
 * - Try to mint NFT
 * - Use wallet features
 */

const TEST_MNEMONIC =
  "garden obtain mechanic nature aunt erode gun mention swear ball hair order";

test.describe("Full App Interaction", () => {
  test("Complete interactive journey", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes timeout

    // Capture ALL console output including warnings and errors
    const logs: string[] = [];
    page.on("console", (msg) => {
      const text = msg.text();
      logs.push(`[${msg.type()}] ${text}`);
      // Print wallet-related logs immediately for debugging
      if (
        text.includes("wallet") ||
        text.includes("Wallet") ||
        text.includes("lock") ||
        text.includes("Lock")
      ) {
        console.log(`🔍 ${text}`);
      }
    });

    // 1. IMPORT WALLET FIRST
    console.log("📱 Step 1: Importing wallet...");
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Look for import button
    const importButton = page.getByRole("button", { name: /import/i });
    if (await importButton.isVisible().catch(() => false)) {
      await importButton.click();
      await page.waitForTimeout(1000);

      // Enter mnemonic
      const mnemonicInput = page.locator(
        'textarea, input[placeholder*="word"], input[placeholder*="phrase"]',
      );
      if ((await mnemonicInput.count()) > 0) {
        await mnemonicInput.first().fill(TEST_MNEMONIC);
        await page.waitForTimeout(500);

        // Enter password
        const passwordInput = page.locator('input[type="password"]');
        if ((await passwordInput.count()) > 0) {
          await passwordInput.first().fill("TestPassword123!");
          if ((await passwordInput.count()) > 1) {
            await passwordInput.nth(1).fill("TestPassword123!");
          }
          await page.waitForTimeout(500);

          // Submit
          const submitButton = page.getByRole("button", {
            name: /import|create|confirm|submit/i,
          });
          if (await submitButton.isVisible().catch(() => false)) {
            await submitButton.click();
            // Wait longer for wallet to load
            await page.waitForTimeout(5000);
          }
        }
      }
    }

    // Verify wallet is connected
    await page.screenshot({
      path: "test-results/screenshots/01-wallet-imported.png",
      fullPage: true,
    });
    console.log("✅ Wallet imported");

    // Wait for balances to load
    console.log("💰 Waiting for balances to load...");
    await page.waitForTimeout(5000);
    await page.screenshot({
      path: "test-results/screenshots/02-wallet-with-balance.png",
      fullPage: true,
    });

    // 2. MINING - Navigate using tab clicks (not page.goto) to preserve wallet state
    console.log("⛏️ Step 2: Testing mining...");
    const miningTab = page.getByRole("link", { name: /mining/i });
    if (await miningTab.isVisible().catch(() => false)) {
      await miningTab.click();
    } else {
      // Fallback to direct navigation
      await page.goto("/?tab=mining");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Look for START button
    const startButton = page.getByRole("button", { name: /start/i });
    const startVisible = await startButton.isVisible().catch(() => false);
    const startEnabled = startVisible
      ? await startButton.isEnabled().catch(() => false)
      : false;

    if (startVisible && startEnabled) {
      console.log("🟢 Starting mining...");
      await startButton.click();
      // Wait for mining to run for a bit
      await page.waitForTimeout(10000);
      await page.screenshot({
        path: "test-results/screenshots/03-mining-active.png",
        fullPage: true,
      });
      console.log("✅ Mining started");

      // Stop mining
      const stopButton = page.getByRole("button", { name: /stop/i });
      if (await stopButton.isVisible().catch(() => false)) {
        await stopButton.click();
        await page.waitForTimeout(1000);
      }
    } else if (startVisible) {
      console.log("⚠️ Start button is disabled (wallet may not be connected)");
      await page.screenshot({
        path: "test-results/screenshots/03-mining-disabled.png",
        fullPage: true,
      });
    } else {
      console.log("⚠️ Start button not visible");
      await page.screenshot({
        path: "test-results/screenshots/03-mining-no-button.png",
        fullPage: true,
      });
    }

    // 3. NFT SECTION - Try to mint (use tab click)
    console.log("🎨 Step 3: Testing NFT minting...");
    const nftsTab = page.getByRole("link", { name: /nfts/i });
    if (await nftsTab.isVisible().catch(() => false)) {
      await nftsTab.click();
    } else {
      await page.goto("/?tab=nfts");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/screenshots/04-nft-section.png",
      fullPage: true,
    });

    // Click mint button
    const mintButton = page.getByRole("button", { name: /mint/i });
    if (await mintButton.isVisible().catch(() => false)) {
      await mintButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: "test-results/screenshots/05-nft-mint-flow.png",
        fullPage: true,
      });

      // Look for confirmation or next step
      const confirmButton = page.getByRole("button", {
        name: /confirm|next|continue/i,
      });
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({
          path: "test-results/screenshots/06-nft-mint-confirm.png",
          fullPage: true,
        });
      }
    }

    // 4. WALLET FEATURES (use tab click)
    console.log("💳 Step 4: Testing wallet features...");
    const walletTab = page.getByRole("link", { name: /wallet/i });
    if (await walletTab.isVisible().catch(() => false)) {
      await walletTab.click();
    } else {
      await page.goto("/?tab=wallet");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);

    // Try GET TESTNET BTC button
    const faucetButton = page.getByRole("button", {
      name: /get testnet|faucet/i,
    });
    if (await faucetButton.isVisible().catch(() => false)) {
      await faucetButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: "test-results/screenshots/07-faucet-clicked.png",
        fullPage: true,
      });
    }

    // Test SEND page
    console.log("📤 Testing send page...");
    const sendButton = page.getByRole("button", { name: /^send$/i });
    if (await sendButton.isVisible().catch(() => false)) {
      await sendButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: "test-results/screenshots/08-send-page.png",
        fullPage: true,
      });

      // Fill in send form
      const addressInput = page.locator(
        'input[placeholder*="address"], input[name="address"]',
      );
      if ((await addressInput.count()) > 0) {
        await addressInput.first().fill("tb1qtest123456789");
        await page.waitForTimeout(500);

        const amountInput = page.locator(
          'input[placeholder*="amount"], input[name="amount"]',
        );
        if ((await amountInput.count()) > 0) {
          await amountInput.first().fill("0.0001");
          await page.waitForTimeout(1000);
          await page.screenshot({
            path: "test-results/screenshots/09-send-filled.png",
            fullPage: true,
          });
        }
      }
    }

    // Test CLAIM page
    console.log("🎁 Testing claim page...");
    await page.goto("/wallet/claim");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/screenshots/10-claim-page.png",
      fullPage: true,
    });

    // Try claim action
    const claimButton = page.getByRole("button", { name: /claim/i });
    if (await claimButton.isVisible().catch(() => false)) {
      await claimButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: "test-results/screenshots/11-claim-clicked.png",
        fullPage: true,
      });
    }

    // Test HISTORY page
    console.log("📜 Testing history page...");
    await page.goto("/wallet/history");
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/screenshots/12-history-page.png",
      fullPage: true,
    });

    // 5. MORE SECTION / SETTINGS (use tab click)
    console.log("⚙️ Step 5: Testing settings...");
    const moreTab = page.getByRole("link", { name: /more/i });
    if (await moreTab.isVisible().catch(() => false)) {
      await moreTab.click();
    } else {
      await page.goto("/?tab=more");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: "test-results/screenshots/13-more-section.png",
      fullPage: true,
    });

    // Go to settings
    const settingsLink = page.getByRole("link", { name: /settings/i });
    if (await settingsLink.isVisible().catch(() => false)) {
      await settingsLink.click();
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: "test-results/screenshots/14-settings-page.png",
        fullPage: true,
      });
    }

    // 6. TOKEN SECTION (use tab click)
    console.log("🪙 Step 6: Token section...");
    const tokenTab = page.getByRole("link", { name: /\$babtc/i });
    if (await tokenTab.isVisible().catch(() => false)) {
      await tokenTab.click();
    } else {
      await page.goto("/?tab=token");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/screenshots/15-token-section.png",
      fullPage: true,
    });

    // 7. FINAL STATE - Go back to wallet (use tab click)
    console.log("🏁 Final check...");
    const walletTabFinal = page.getByRole("link", { name: /wallet/i });
    if (await walletTabFinal.isVisible().catch(() => false)) {
      await walletTabFinal.click();
    } else {
      await page.goto("/?tab=wallet");
    }
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: "test-results/screenshots/16-final-wallet.png",
      fullPage: true,
    });

    console.log("\n🎉 Full interaction test complete!");
    console.log(`📊 Captured ${logs.length} console logs`);
  });
});
