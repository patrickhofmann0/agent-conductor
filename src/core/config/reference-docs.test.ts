import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { configJsonSchema } from "./json-schema.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Every configurable key as written in the reference, e.g. `checks[].name`. */
function keyPaths(schema: Record<string, unknown>, prefix = ""): string[] {
  const properties = schema["properties"];
  if (!isRecord(properties)) return [];
  return Object.entries(properties).flatMap(([key, child]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    if (!isRecord(child)) return [path];
    const items = child["items"];
    const values = child["additionalProperties"];
    if (isRecord(child["properties"])) return keyPaths(child, path);
    if (isRecord(items) && isRecord(items["properties"]))
      return keyPaths(items, `${path}[]`);
    if (isRecord(values) && isRecord(values["properties"]))
      return keyPaths(values, `${path}.<role>`);
    return [path];
  });
}

describe("configuration reference", () => {
  const reference = readFileSync("docs/guide/configuration.md", "utf8");
  const paths = keyPaths(configJsonSchema());

  it("finds the keys of the schema", () => {
    expect(paths).toContain("loop.maxIterations");
    expect(paths).toContain("checks[].timeout");
    expect(paths).toContain("roles.<role>.permissions[].action");
  });

  it("documents every configuration key", () => {
    const missing = paths.filter((path) => !reference.includes(`\`${path}\``));

    expect(missing).toEqual([]);
  });
});
