import { describe, expect, it } from "vitest";

import { HARD_DENIED_COMMANDS, effectivePermissions } from "./permissions.js";

const DENY_GIT = { git: "deny", "git *": "deny", gh: "deny", "gh *": "deny" };

describe("effectivePermissions defaults", () => {
  it.each(["po", "planner"] as const)(
    "lets %s read and browse, but not edit or run commands",
    (role) => {
      expect(effectivePermissions(role)).toEqual({
        edit: "deny",
        bash: { "*": "deny", ...DENY_GIT },
        webfetch: "allow",
      });
    },
  );

  it.each(["coder", "tester"] as const)(
    "lets %s edit and run commands except git",
    (role) => {
      expect(effectivePermissions(role)).toEqual({
        edit: "allow",
        bash: { "*": "allow", ...DENY_GIT },
        webfetch: "deny",
      });
    },
  );

  it("keeps the reviewer read-only and offline", () => {
    expect(effectivePermissions("reviewer")).toEqual({
      edit: "deny",
      bash: { "*": "deny", ...DENY_GIT },
      webfetch: "deny",
    });
  });
});

describe("effectivePermissions overrides", () => {
  it("applies overrides per tool", () => {
    expect(
      effectivePermissions("coder", { webfetch: "allow", edit: "deny" }),
    ).toEqual({
      edit: "deny",
      bash: { "*": "allow", ...DENY_GIT },
      webfetch: "allow",
    });
  });

  it("accepts bash pattern maps and appends the hard denies last", () => {
    const permissions = effectivePermissions("reviewer", {
      bash: { "*": "deny", "ls *": "allow" },
    });

    expect(permissions.bash).toEqual({
      "*": "deny",
      "ls *": "allow",
      ...DENY_GIT,
    });
    expect(Object.keys(permissions.bash).slice(-4)).toEqual(
      Object.keys(HARD_DENIED_COMMANDS),
    );
  });

  it("cannot allow git or gh", () => {
    const permissions = effectivePermissions("coder", {
      bash: { "git *": "allow", "gh *": "allow", git: "allow", "*": "allow" },
    });

    expect(permissions.bash).toEqual({ "*": "allow", ...DENY_GIT });
  });

  it("moves user entries for git and gh behind the hard denies, because the last match wins", () => {
    const permissions = effectivePermissions("coder", {
      bash: { "git *": "allow", "*": "allow", "npm *": "deny" },
    });

    expect(Object.entries(permissions.bash)).toEqual([
      ["*", "allow"],
      ["npm *", "deny"],
      ["git", "deny"],
      ["git *", "deny"],
      ["gh", "deny"],
      ["gh *", "deny"],
    ]);
  });

  it("does not mutate the defaults", () => {
    effectivePermissions("coder", { bash: { "npm *": "deny" } });

    expect(effectivePermissions("coder").bash).toEqual({
      "*": "allow",
      ...DENY_GIT,
    });
  });
});
