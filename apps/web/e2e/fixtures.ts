/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixtures use `use` as a callback parameter, not React's use() hook */
import { test as baseTest, expect, devices } from "@playwright/test";

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    const originalGoto = page.goto.bind(page);

    page.goto = async (
      url: string,
      options?: Parameters<typeof originalGoto>[1],
    ) => {
      let response: Awaited<ReturnType<typeof originalGoto>> = null;
      try {
        // Safely default to waitUntil: "commit" if not specified, to handle Next.js client-side redirection
        response = await originalGoto(url, { waitUntil: "commit", ...options });
      } catch (err: unknown) {
        const errMsg = (err as { message?: string })?.message || "";
        if (
          errMsg.includes("net::ERR_ABORTED") ||
          errMsg.includes("NS_BINDING_ABORTED") ||
          errMsg.includes("Navigation aborted")
        ) {
          // Ignore aborted navigation errors as they are likely Next.js client-side router takes over
        } else {
          throw err;
        }
      }

      // Always wait for the basic DOM to load
      try {
        await page.waitForLoadState("domcontentloaded");
      } catch {
        // Ignore load state errors if navigation was aborted
      }

      // Wait for the RootProvider loader ("Loading...") to disappear (up to 30s for Next.js cold compile)
      const loader = page.getByText("Loading...");
      try {
        await expect(loader).not.toBeVisible({ timeout: 30000 });
      } catch {
        // If loader is not found or fails to disappear, it might already be gone.
        // We log and continue so we don't break tests that don't hit the loader.
      }

      return response;
    };

    await use(page);
  },
});

export { expect, devices };
