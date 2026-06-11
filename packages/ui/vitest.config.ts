import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    css: true, // Handle CSS imports in components
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@bitcoinbaby/core": path.resolve(__dirname, "../core/src"),
    },
  },
});
