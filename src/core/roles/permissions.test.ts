import { describe, expect, it } from "vitest";

import { HARD_RULES, effectivePermissions } from "./permissions.js";

import type { PermissionRuleset } from "../schemas/permissions.js";

/** Evaluates rules like OpenCode: the last matching rule wins. */
function decide(
  rules: PermissionRuleset,
  action: string,
  resource: string,
): string | undefined {
  const matches = (pattern: string, value: string): boolean =>
    new RegExp(
      `^${pattern.replace(/[.+^$()|[\]\\{}]/g, "\\$&").replace(/\*/g, ".*")}$`,
    ).test(value) ||
    (pattern.endsWith(" *") && value === pattern.slice(0, -2));
  return rules
    .filter(
      (rule) =>
        matches(rule.action, action) && matches(rule.resource, resource),
    )
    .at(-1)?.effect;
}

describe("effectivePermissions defaults", () => {
  it.each(["po", "planner"] as const)(
    "lets %s research but not edit or run commands",
    (role) => {
      const rules = effectivePermissions(role);

      expect(decide(rules, "edit", "src/a.ts")).toBe("deny");
      expect(decide(rules, "shell", "ls")).toBe("deny");
      expect(decide(rules, "webfetch", "https://example.com")).toBe("allow");
      expect(decide(rules, "websearch", "csv rfc")).toBe("allow");
    },
  );

  it.each(["coder", "tester"] as const)(
    "lets %s edit and run commands, offline",
    (role) => {
      const rules = effectivePermissions(role);

      expect(decide(rules, "edit", "src/a.ts")).toBe("allow");
      expect(decide(rules, "shell", "npm test")).toBe("allow");
      expect(decide(rules, "webfetch", "https://example.com")).toBe("deny");
      expect(decide(rules, "websearch", "x")).toBe("deny");
    },
  );

  it("keeps the reviewer read-only and offline", () => {
    const rules = effectivePermissions("reviewer");

    expect(decide(rules, "edit", "src/a.ts")).toBe("deny");
    expect(decide(rules, "shell", "cat a")).toBe("deny");
    expect(decide(rules, "webfetch", "https://example.com")).toBe("deny");
    expect(decide(rules, "websearch", "x")).toBe("deny");
  });
});

describe("effectivePermissions hard rules", () => {
  it.each([
    ["shell", "git"],
    ["shell", "git commit -m x"],
    ["shell", "gh pr create"],
    ["subagent", "general"],
    ["question", "*"],
    ["read", ".env"],
    ["read", "config/.env.local"],
    ["external_directory", "/home/user/*"],
  ])("denies %s %s for every role", (action, resource) => {
    for (const role of [
      "po",
      "planner",
      "coder",
      "tester",
      "reviewer",
    ] as const) {
      expect(decide(effectivePermissions(role), action, resource)).toBe("deny");
    }
  });

  it("puts project rules between defaults and hard rules", () => {
    const project = [
      { action: "shell", resource: "npm publish *", effect: "deny" as const },
    ];

    const rules = effectivePermissions("coder", project);

    expect(rules.slice(-HARD_RULES.length - 1)).toEqual([
      ...project,
      ...HARD_RULES,
    ]);
    expect(decide(rules, "shell", "npm publish --tag next")).toBe("deny");
  });

  it("cannot be overridden by project rules", () => {
    const rules = effectivePermissions("coder", [
      { action: "shell", resource: "git *", effect: "allow" },
      { action: "subagent", resource: "*", effect: "allow" },
      { action: "*", resource: "*", effect: "allow" },
    ]);

    expect(decide(rules, "shell", "git push")).toBe("deny");
    expect(decide(rules, "subagent", "general")).toBe("deny");
    expect(decide(rules, "read", ".env")).toBe("deny");
  });

  it("lets project rules adjust role defaults", () => {
    const rules = effectivePermissions("reviewer", [
      { action: "shell", resource: "npm test", effect: "allow" },
    ]);

    expect(decide(rules, "shell", "npm test")).toBe("allow");
    expect(decide(rules, "shell", "rm -rf /")).toBe("deny");
  });
});
