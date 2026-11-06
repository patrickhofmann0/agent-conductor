import { describe, expect, it } from "vitest";

import { configSchema } from "./config.js";

describe("configSchema defaults", () => {
  it("fills every section from an empty object", () => {
    expect(configSchema.parse({})).toEqual({
      version: 1,
      language: "en",
      models: {},
      gates: { po: true, planner: true },
      loop: { maxIterations: 3, onLimit: "draft_pr" },
      limits: {
        phaseTimeout: 1_200_000,
        totalTimeout: 7_200_000,
        maxCostUsd: 10,
      },
      checks: [],
      guardrails: { paths: [] },
      git: {
        baseBranch: "main",
        branchPrefix: "conductor/",
        commitMessage: "feat: {{title}}",
      },
      github: {
        labels: {
          trigger: "conductor",
          approved: "conductor:approved",
          needsHuman: "conductor:needs-human",
        },
      },
      roles: {},
    });
  });

  it("fills check defaults and parses check timeouts", () => {
    const config = configSchema.parse({
      checks: [{ name: "test", command: "bun test" }],
    });

    expect(config.checks).toEqual([
      { name: "test", command: "bun test", required: true, timeout: 600_000 },
    ]);
  });

  it("fills role defaults", () => {
    const config = configSchema.parse({
      roles: { coder: { prompt: "Be brief." } },
    });

    expect(config.roles.coder).toEqual({
      prompt: "Be brief.",
      promptMode: "append",
    });
    expect(config.roles.tester).toBeUndefined();
  });

  it("keeps explicit values", () => {
    const config = configSchema.parse({
      language: "de-DE",
      models: { default: "openai/gpt-5", reviewer: "openai/o3" },
      gates: { po: false },
      loop: { maxIterations: 5, onLimit: "ask" },
      limits: { phaseTimeout: "5m", maxCostUsd: 2.5 },
    });

    expect(config.language).toBe("de-DE");
    expect(config.models).toEqual({
      default: "openai/gpt-5",
      reviewer: "openai/o3",
    });
    expect(config.gates).toEqual({ po: false, planner: true });
    expect(config.loop).toEqual({ maxIterations: 5, onLimit: "ask" });
    expect(config.limits).toEqual({
      phaseTimeout: 300_000,
      totalTimeout: 7_200_000,
      maxCostUsd: 2.5,
    });
  });

  it("accepts a $schema reference", () => {
    expect(
      configSchema.parse({ $schema: "./conductor.schema.json" }).$schema,
    ).toBe("./conductor.schema.json");
  });
});

describe("configSchema validation", () => {
  it.each([
    ["unknown top-level key", { modles: {} }],
    ["unknown nested key", { loop: { max: 3 } }],
    ["wrong version", { version: 2 }],
    ["invalid language", { language: "German" }],
    ["model without provider", { models: { default: "gpt-5" } }],
    ["zero iterations", { loop: { maxIterations: 0 } }],
    ["too many iterations", { loop: { maxIterations: 21 } }],
    ["fractional iterations", { loop: { maxIterations: 1.5 } }],
    ["unknown onLimit", { loop: { onLimit: "retry" } }],
    ["zero cost limit", { limits: { maxCostUsd: 0 } }],
    ["invalid timeout", { limits: { phaseTimeout: "soon" } }],
    ["invalid check name", { checks: [{ name: "Unit Tests", command: "x" }] }],
    ["empty check command", { checks: [{ name: "test", command: "" }] }],
    ["empty guardrail pattern", { guardrails: { paths: [""] } }],
    ["unknown role", { roles: { architect: {} } }],
    ["unknown prompt mode", { roles: { coder: { promptMode: "prepend" } } }],
    ["empty base branch", { git: { baseBranch: "" } }],
    ["model with a space", { models: { default: "openai/gpt 5" } }],
    [
      "model with a spaced provider",
      { models: { default: "my provider/gpt-5" } },
    ],
    [
      "check name with trailing symbol",
      { checks: [{ name: "test!", command: "x" }] },
    ],
    ["three-letter language", { language: "deu" }],
    ["empty label", { github: { labels: { approved: "" } } }],
  ])("rejects %s", (_name, input) => {
    expect(configSchema.safeParse(input).success).toBe(false);
  });

  it.each([
    [
      { models: { default: "gpt-5" } },
      'Use "provider/model", for example "openai/gpt-5".',
    ],
    [
      { checks: [{ name: "Unit", command: "x" }] },
      "Use lowercase letters, digits and dashes.",
    ],
    [{ language: "German" }, 'Use a language code like "en" or "de".'],
  ])("explains how to fix %j", (input, message) => {
    expect(configSchema.safeParse(input).error?.issues[0]?.message).toBe(
      message,
    );
  });

  it("accepts custom labels", () => {
    const labels = { trigger: "ai", approved: "ai:ok", needsHuman: "ai:help" };

    expect(configSchema.parse({ github: { labels } }).github.labels).toEqual(
      labels,
    );
  });

  it("rejects duplicate check names and points at the duplicate", () => {
    const result = configSchema.safeParse({
      checks: [
        { name: "test", command: "a" },
        { name: "lint", command: "b" },
        { name: "test", command: "c" },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues).toEqual([
      expect.objectContaining({
        path: ["checks", 2, "name"],
        message: 'Duplicate check name "test".',
      }),
    ]);
  });
});
