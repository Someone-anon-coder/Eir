// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["**/dist/**", "**/coverage/**", "**/node_modules/**", "ts-scratch/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // CLAUDE.md §7.1 — `any` is banned outright, not just discouraged.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  eslintConfigPrettier,
);
