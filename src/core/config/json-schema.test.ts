import { describe, expect, it } from "vitest";

import { CONFIG_SCHEMA_ID, configJsonSchema } from "./json-schema.js";

describe("configJsonSchema", () => {
  const schema = configJsonSchema();

  it("identifies itself", () => {
    expect(schema["$id"]).toBe(
      "https://raw.githubusercontent.com/patrickhofmann0/agent-conductor/main/conductor.schema.json",
    );
    expect(schema["$id"]).toBe(CONFIG_SCHEMA_ID);
    expect(schema["title"]).toContain("conductor.yaml");
    expect(schema["$schema"]).toBe(
      "https://json-schema.org/draft/2020-12/schema",
    );
  });

  it("describes the input format with durations as strings", () => {
    expect(schema).toMatchObject({
      type: "object",
      additionalProperties: false,
      properties: {
        limits: {
          properties: { phaseTimeout: { type: "string" } },
        },
        loop: {
          properties: { onLimit: { enum: ["draft_pr", "fail", "ask"] } },
        },
      },
    });
  });

  it("does not require any key, because everything has a default", () => {
    expect(schema["required"]).toBeUndefined();
  });
});
