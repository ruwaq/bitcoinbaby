import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/**/*.spec.{ts,tsx}"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bitcoinbaby/ui": path.resolve(__dirname, "../../packages/ui/src"),
      "@bitcoinbaby/core": path.resolve(__dirname, "../../packages/core/src"),
      "@bitcoinbaby/bitcoin": path.resolve(
        __dirname,
        "../../packages/bitcoin/src",
      ),
    },
  },
});
