import { describe, expect, it } from "vitest";

import { permissionRuleSchema } from "./permissions.js";

describe("permissionRuleSchema", () => {
  it.each(["allow", "deny"])("accepts the effect %s", (effect) => {
    const rule = { action: "shell", resource: "npm *", effect };

    expect(permissionRuleSchema.parse(rule)).toEqual(rule);
  });

  it.each([
    [
      "ask, because nobody can answer",
      { action: "shell", resource: "*", effect: "ask" },
    ],
    ["an empty action", { action: "", resource: "*", effect: "deny" }],
    ["an empty resource", { action: "shell", resource: "", effect: "deny" }],
    ["a missing effect", { action: "shell", resource: "*" }],
    [
      "unknown keys",
      { action: "shell", resource: "*", effect: "deny", note: "x" },
    ],
  ])("rejects %s", (_name, rule) => {
    expect(permissionRuleSchema.safeParse(rule).success).toBe(false);
  });
});
