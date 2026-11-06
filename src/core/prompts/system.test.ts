import { describe, expect, it } from "vitest";

import { ROLES } from "../schemas/role.js";

import {
  VERDICT_FORMAT,
  defaultRolePrompt,
  languageRule,
  sharedRules,
} from "./system.js";

describe("system prompts", () => {
  it("forbids git and framework files for every agent", () => {
    expect(sharedRules()).toContain("Never run git or gh");
    expect(sharedRules()).toContain(".conductor/");
  });

  it.each(ROLES)("has a distinct default prompt for %s", (role) => {
    const prompt = defaultRolePrompt(role);

    expect(prompt).toContain(
      `You are the ${role === "po" ? "product owner" : role}`,
    );
    expect(
      ROLES.filter((other) => defaultRolePrompt(other) === prompt),
    ).toEqual([role]);
  });

  it("asks the product owner for open questions", () => {
    expect(defaultRolePrompt("po")).toContain("Open questions");
  });

  it("asks the planner for guardrails", () => {
    expect(defaultRolePrompt("planner")).toContain("Guardrails");
  });

  it("tells the coder that guardrail changes are reverted", () => {
    expect(defaultRolePrompt("coder")).toContain("reverted automatically");
  });

  it("embeds the verdict format in the reviewer prompt", () => {
    expect(VERDICT_FORMAT).toContain(
      '"verdict": "approve" | "changes_requested"',
    );
    expect(VERDICT_FORMAT).toContain('"target": "coder" | "tester"');
    expect(defaultRolePrompt("reviewer")).toContain(VERDICT_FORMAT);
    expect(defaultRolePrompt("reviewer")).toContain("```json");
  });

  it("states the output language", () => {
    expect(languageRule("de")).toContain('language "de"');
  });
});
