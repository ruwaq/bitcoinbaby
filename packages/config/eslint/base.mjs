/**
 * Shared ESLint v9 flat-config base for @bitcoinbaby packages.
 *
 * Used by packages/{ai,bitcoin,core,shared,ui} and apps/workers. Each consumer
 * imports this array and spreads it, optionally appending package-specific
 * overrides:
 *
 *   import { baseConfig } from "@bitcoinbaby/config/eslint";
 *   export default tseslint.config(
 *     ...baseConfig,
 *     { rules: { /* per-package overrides *\/ } },
 *   );
 *
 * apps/web is NOT a consumer: it uses eslint-config-next (React/Next rules).
 */

import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Base flat-config array: JS + TS recommended, common ignores, and the shared
 * no-unused-vars (underscore-prefixed allowed) / no-explicit-any (warn) rules.
 */
export const baseConfig = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      // Build/tooling artifacts (must never be linted as source).
      ".wrangler/**",
      ".next/**",
      "coverage/**",
      "*.config.{js,mjs,ts}",
    ],
  },
  {
    rules: {
      // Allow unused vars/args prefixed with underscore.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any, but flag it for review.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);

export default baseConfig;
