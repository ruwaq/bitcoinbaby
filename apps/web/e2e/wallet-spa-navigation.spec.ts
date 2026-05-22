import { test, expect } from "./fixtures";

/**
 * Wallet SPA Navigation Test
 *
 * Tests that wallet stays connected when navigating between tabs
 * using SPA navigation (button clicks, not page.goto)
 */

const TEST_MNEMONIC =
  "garden obtain mechanic nature aunt erode gun mention swear ball hair order";
const TEST_PASSWORD = "TestPassword123!";

test.describe("Wallet SPA Navigation", () => {
  test("Wallet stays connected when navigating between tabs", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 minutes

    // Track wallet connection state
    const walletStates: { section: string; connected: boolean }[] = [];

    // Helper to get wallet address from header
    async function getWalletAddress(): Promise<string> {
      const addr = await page
        .locator('button:has-text("tb1")')
        .first()
        .textContent()
        .catch(() => "");
      return addr || "";
    }

    // Helper to click a tab button
    async function clickTab(tabName: string): Promise<void> {
      const tabIdMap: Record<string, string> = {
        "Mining": "mining",
        "NFTs": "nfts",
        "Wallet": "wallet",
        "More": "more",
        "Token": "token",
        "$BABTC": "token"
      };
      const id = tabIdMap[tabName] || tabName.toLowerCase();
      await page.getByTestId(`tab-${id}`).click();
    }

    // 1. IMPORT WALLET
    console.log("📱 Step 1: Importing wallet...");
    await page.goto("/?tab=wallet");
    await page.waitForLoadState("domcontentloaded");

    // Wait for either the import button (wallet not connected) or address button (wallet already connected)
    const importButton = page.getByRole("button", { name: /import/i });
    const addressButton = page.locator('button:has-text("tb1")');
    
    await Promise.race([
      importButton.waitFor({ state: "visible", timeout: 20000 }),
      addressButton.first().waitFor({ state: "visible", timeout: 20000 })
    ]).catch(() => {});

    // Click Import button if visible
    if (await importButton.isVisible().catch(() => false)) {
      await importButton.click();
      
      // Wait for mnemonic input field to be visible and ready
      const mnemonicInput = page.locator("textarea");
      await mnemonicInput.waitFor({ state: "visible", timeout: 5000 });
      await mnemonicInput.fill(TEST_MNEMONIC);

      // Fill passwords
      const passwordInputs = page.locator('input[type="password"]');
      await passwordInputs.first().waitFor({ state: "visible", timeout: 5000 });
      if ((await passwordInputs.count()) >= 2) {
        await passwordInputs.first().fill(TEST_PASSWORD);
        await passwordInputs.nth(1).fill(TEST_PASSWORD);

        // Submit
        const submitBtn = page.getByRole("button", {
          name: "IMPORT WALLET",
          exact: true,
        });
        await submitBtn.waitFor({ state: "visible", timeout: 5000 });
        await submitBtn.click();
        
        // Wait for the import modal/action to complete and address button to appear
        await addressButton.first().waitFor({ state: "visible", timeout: 20000 }).catch(() => {});
      }
    }

    // Verify wallet connected
    const initialAddr = await getWalletAddress();
    console.log(`Initial: ${initialAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-01-initial.png",
      fullPage: true,
    });

    // 2. Navigate to MINING tab
    console.log("⛏️ Step 2: Mining...");
    await clickTab("Mining");
    await page.waitForTimeout(3000);
    const miningAddr = await getWalletAddress();
    walletStates.push({ section: "Mining", connected: !!miningAddr });
    console.log(`Mining: ${miningAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-02-mining.png",
      fullPage: true,
    });

    // 3. Navigate to NFTs tab
    console.log("🎨 Step 3: NFTs...");
    await clickTab("NFTs");
    await page.waitForTimeout(3000);
    const nftsAddr = await getWalletAddress();
    walletStates.push({ section: "NFTs", connected: !!nftsAddr });
    console.log(`NFTs: ${nftsAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-03-nfts.png",
      fullPage: true,
    });

    // 4. Navigate to $BABTC tab
    console.log("🪙 Step 4: Token...");
    await clickTab("$BABTC");
    await page.waitForTimeout(3000);
    const tokenAddr = await getWalletAddress();
    walletStates.push({ section: "Token", connected: !!tokenAddr });
    console.log(`Token: ${tokenAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-04-token.png",
      fullPage: true,
    });

    // 5. Navigate to MORE tab
    console.log("⚙️ Step 5: More...");
    await clickTab("More");
    await page.waitForTimeout(3000);
    const moreAddr = await getWalletAddress();
    walletStates.push({ section: "More", connected: !!moreAddr });
    console.log(`More: ${moreAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-05-more.png",
      fullPage: true,
    });

    // 6. Navigate BACK to Wallet
    console.log("💳 Step 6: Back to Wallet...");
    await clickTab("Wallet");
    await page.waitForTimeout(3000);
    const finalAddr = await getWalletAddress();
    walletStates.push({ section: "Wallet (Final)", connected: !!finalAddr });
    console.log(`Final: ${finalAddr.slice(0, 15) || "NOT CONNECTED"}`);
    await page.screenshot({
      path: "test-results/screenshots/spa-06-final.png",
      fullPage: true,
    });

    // Check for locked state
    const isLocked = await page
      .locator("text=/wallet locked/i")
      .isVisible()
      .catch(() => false);
    if (isLocked) {
      console.log("⚠️ Wallet is LOCKED!");
    }

    // Summary
    console.log("\n📊 Summary:");
    walletStates.forEach(({ section, connected }) => {
      console.log(`  ${connected ? "✅" : "❌"} ${section}`);
    });

    const disconnections = walletStates.filter((s) => !s.connected).length;
    console.log(`\nDisconnections: ${disconnections}`);

    expect(disconnections).toBe(0);
  });
});
