// @ts-check
import eslint from "@eslint/js";
import comments from "@eslint-community/eslint-plugin-eslint-comments/configs";
import vitest from "@vitest/eslint-plugin";
import prettier from "eslint-config-prettier";
import tseslint from "typescript-eslint";

/**
 * GUARDRAIL FILE. Changes require the `guardrails-change` label and must not
 * be combined with changes in src/ or test/. See docs/adr/0010.
 */

const PROTECTED_RULES = [
  "@typescript-eslint/no-explicit-any",
  "@typescript-eslint/ban-ts-comment",
  "@typescript-eslint/consistent-type-assertions",
  "@typescript-eslint/no-non-null-assertion",
  "no-restricted-globals",
  "no-restricted-imports",
  "no-restricted-syntax",
  "max-lines",
  "max-lines-per-function",
  "complexity",
  "max-depth",
  "max-params",
  "vitest/no-focused-tests",
  "vitest/no-disabled-tests",
];

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "reports/**",
      ".stryker-tmp/**",
      "node_modules/**",
      ".dependency-cruiser.cjs",
    ],
  },
  {
    linterOptions: { reportUnusedDisableDirectives: "error" },
  },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  comments.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Type safety
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-assertions": [
        "error",
        { assertionStyle: "never" },
      ],
      "@typescript-eslint/ban-ts-comment": [
        "error",
        {
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          "ts-expect-error": "allow-with-description",
          minimumDescriptionLength: 10,
        },
      ],
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // Runtime portability: shipped code must run on plain Node.js
      "no-restricted-globals": [
        "error",
        {
          name: "Bun",
          message: "Use node:* APIs. The package must run on Node.js.",
        },
        {
          name: "Deno",
          message: "Use node:* APIs. The package must run on Node.js.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["bun", "bun:*"],
              message: "Use node:* APIs. The package must run on Node.js.",
            },
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use named exports." },
      ],

      // Size and complexity
      "max-lines": [
        "error",
        { max: 250, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 60, skipBlankLines: true, skipComments: true },
      ],
      complexity: ["error", 10],
      "max-depth": ["error", 3],
      "max-params": ["error", 3],

      // Output only through the CLI layer
      "no-console": "error",

      // Disable comments must be justified and may not touch guardrail rules
      "@eslint-community/eslint-comments/require-description": [
        "error",
        { ignore: [] },
      ],
      "@eslint-community/eslint-comments/no-unlimited-disable": "error",
      "@eslint-community/eslint-comments/no-restricted-disable": [
        "error",
        ...PROTECTED_RULES,
      ],
    },
  },
  {
    files: ["src/cli/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // *.types.ts files are exempt from the test-pair rule, so they may hold types only.
    files: ["**/*.types.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "ExportDefaultDeclaration", message: "Use named exports." },
        ...[
          "FunctionDeclaration",
          "ClassDeclaration",
          "VariableDeclaration",
          "ExpressionStatement",
          "TSEnumDeclaration",
        ].map((selector) => ({
          selector,
          message: "*.types.ts files may only contain types and interfaces.",
        })),
      ],
    },
  },
  {
    files: ["**/*.test.ts"],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,
      "vitest/no-focused-tests": "error",
      "vitest/no-disabled-tests": "error",
      "vitest/expect-expect": "error",
      "max-lines-per-function": "off",
    },
  },
  {
    files: ["scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    files: ["*.config.ts", "*.config.js", "eslint.config.js"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
