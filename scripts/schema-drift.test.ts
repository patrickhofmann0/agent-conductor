import { describe, expect, it } from "vitest";

import { evaluateSchemaDrift, serializeSchema } from "./schema-drift.js";

describe("serializeSchema", () => {
  it("pretty-prints with two spaces and a trailing newline", () => {
    expect(serializeSchema({ a: [1] })).toBe('{\n  "a": [\n    1\n  ]\n}\n');
  });
});

describe("evaluateSchemaDrift", () => {
  it("passes when neither generator nor schema file exist", () => {
    expect(evaluateSchemaDrift({ generated: null, committed: null }).ok).toBe(
      true,
    );
  });

  it("fails when the schema file exists without generator", () => {
    const result = evaluateSchemaDrift({ generated: null, committed: "{}" });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("generator");
  });

  it("fails when the generator exists without schema file", () => {
    const result = evaluateSchemaDrift({ generated: "{}", committed: null });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("schema:generate");
  });

  it("fails when generated and committed schema differ", () => {
    const result = evaluateSchemaDrift({
      generated: '{"a":1}',
      committed: '{"a":2}',
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("out of date");
  });

  it("passes when generated and committed schema are equal", () => {
    const result = evaluateSchemaDrift({
      generated: '{"a":1}',
      committed: '{"a":1}',
    });

    expect(result.ok).toBe(true);
    expect(result.message).toContain("up to date");
  });
});
