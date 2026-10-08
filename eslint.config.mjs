import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["out/**", "dist/**", "release/**", "node_modules/**", "**/*.d.ts"]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      "src/main/**/*.ts",
      "src/preload/**/*.ts",
      "electron.vite.config.ts",
      "vitest.config.ts",
      "scripts/**/*.mjs"
    ],
    languageOptions: {
      globals: { ...globals.node }
    }
  },
  {
    files: ["src/renderer/**/*.{ts,tsx}", "src/shared/**/*.ts"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node }
    }
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }
      ]
    }
  }
);
