import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Capacitor build artifacts (generated, not source code)
    "android/**",
    "ios/**",
    // Service worker and worker files (plain JS, not TypeScript)
    "public/sw.js",
    "public/workers/**",
    // Node.js scripts
    "scripts/**",
  ]),
  // Custom rules
  {
    rules: {
      // Allow unused vars prefixed with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
