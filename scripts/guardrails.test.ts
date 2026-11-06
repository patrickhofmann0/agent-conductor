import { describe, expect, it } from "vitest";

import {
  evaluateGuardrails,
  isGuardrailPath,
  scriptsDiffer,
} from "./guardrails.js";

describe("isGuardrailPath", () => {
  it.each([
    "tsconfig.json",
    "tsconfig.build.json",
    "eslint.config.js",
    "eslint.config.ts",
    ".prettierrc.json",
    ".prettierignore",
    ".dependency-cruiser.cjs",
    "knip.json",
    "vitest.config.ts",
    "stryker.config.json",
    "lefthook.yml",
    "commitlint.config.js",
    ".markdownlint-cli2.jsonc",
    ".remarkrc.json",
    ".remarkignore",
    ".github/workflows/verify.yml",
    ".github/CODEOWNERS",
    "scripts/verify-test-pairs.ts",
    "AGENTS.md",
  ])("treats %s as guardrail", (path) => {
    expect(isGuardrailPath(path)).toBe(true);
  });

  it.each([
    "src/cli/main.ts",
    "src/core/tsconfig.json",
    "docs/adr/0001-record.md",
    "package.json",
    "README.md",
    "examples/app/eslint.config.js",
  ])("does not treat %s as guardrail", (path) => {
    expect(isGuardrailPath(path)).toBe(false);
  });
});

describe("evaluateGuardrails", () => {
  it("passes when no guardrail file changed", () => {
    const result = evaluateGuardrails({
      changedFiles: ["src/cli/main.ts", "docs/PLAN.md"],
      packageScriptsChanged: false,
      approved: false,
    });

    expect(result.ok).toBe(true);
    expect(result.guardrailChanges).toEqual([]);
  });

  it("fails when a guardrail changed without approval", () => {
    const result = evaluateGuardrails({
      changedFiles: ["eslint.config.js"],
      packageScriptsChanged: false,
      approved: false,
    });

    expect(result.ok).toBe(false);
    expect(result.guardrailChanges).toEqual(["eslint.config.js"]);
    expect(result.messages.join()).toContain("guardrails-change");
  });

  it("passes when an approved guardrail change contains no code", () => {
    const result = evaluateGuardrails({
      changedFiles: ["eslint.config.js", "docs/adr/0010.md"],
      packageScriptsChanged: false,
      approved: true,
    });

    expect(result.ok).toBe(true);
    expect(result.messages).toEqual([]);
  });

  it.each(["src/cli/main.ts", "test/fakes/x.ts"])(
    "fails when an approved guardrail change also touches %s",
    (codeFile) => {
      const result = evaluateGuardrails({
        changedFiles: ["vitest.config.ts", codeFile],
        packageScriptsChanged: false,
        approved: true,
      });

      expect(result.ok).toBe(false);
      expect(result.messages.join()).toContain(codeFile);
    },
  );

  it("treats changed package scripts as a guardrail change", () => {
    const result = evaluateGuardrails({
      changedFiles: ["package.json"],
      packageScriptsChanged: true,
      approved: false,
    });

    expect(result.ok).toBe(false);
    expect(result.guardrailChanges).toEqual(["package.json#scripts"]);
  });

  it("reports both violations at once", () => {
    const result = evaluateGuardrails({
      changedFiles: ["knip.json", "src/a.ts"],
      packageScriptsChanged: false,
      approved: false,
    });

    expect(result.messages).toHaveLength(2);
  });
});

describe("scriptsDiffer", () => {
  const pkg = (scripts: unknown): string =>
    JSON.stringify({ name: "x", scripts });

  it("is false when only other fields change", () => {
    expect(
      scriptsDiffer(
        pkg({ test: "vitest" }),
        JSON.stringify({ name: "y", scripts: { test: "vitest" } }),
      ),
    ).toBe(false);
  });

  it("is true when a script changes", () => {
    expect(scriptsDiffer(pkg({ test: "vitest" }), pkg({ test: "true" }))).toBe(
      true,
    );
  });

  it("is true when scripts are added to a package without scripts", () => {
    expect(
      scriptsDiffer(JSON.stringify({ name: "x" }), pkg({ test: "vitest" })),
    ).toBe(true);
  });

  it("is true when package.json is newly created with scripts", () => {
    expect(scriptsDiffer("", pkg({ test: "vitest" }))).toBe(true);
  });

  it("is false when neither version has scripts", () => {
    expect(scriptsDiffer("", JSON.stringify({ name: "x" }))).toBe(false);
  });

  it("treats a non-object package.json as having no scripts", () => {
    expect(scriptsDiffer("null", "[]")).toBe(false);
  });
});
