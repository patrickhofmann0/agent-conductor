import { describe, expect, it } from "vitest";

import {
  defaultRolePrompt,
  languageRule,
  sharedRules,
} from "../prompts/system.js";
import { configSchema } from "../schemas/config.js";

import { roleSettings } from "./settings.js";

const config = (input: unknown = {}) => configSchema.parse(input);

describe("roleSettings", () => {
  it("combines shared rules, role prompt and language", () => {
    const { system } = roleSettings(config({ language: "de" }), "planner");

    expect(system).toBe(
      [sharedRules(), defaultRolePrompt("planner"), languageRule("de")].join(
        "\n\n",
      ),
    );
  });

  it("appends project instructions by default", () => {
    const { system } = roleSettings(
      config({ roles: { coder: { prompt: "Use pnpm." } } }),
      "coder",
    );

    expect(system).toContain(defaultRolePrompt("coder"));
    expect(system).toContain("Project-specific instructions:\nUse pnpm.");
  });

  it("replaces the role prompt but keeps shared rules", () => {
    const { system } = roleSettings(
      config({
        roles: { coder: { prompt: "Only fix typos.", promptMode: "replace" } },
      }),
      "coder",
    );

    expect(system).not.toContain(defaultRolePrompt("coder"));
    expect(system).toContain(sharedRules());
    expect(system).toContain("Only fix typos.");
  });

  it("ignores a prompt mode without prompt", () => {
    const { system } = roleSettings(
      config({ roles: { coder: { promptMode: "replace" } } }),
      "coder",
    );

    expect(system).toContain(defaultRolePrompt("coder"));
  });

  it("uses the role model before the default model", () => {
    const models = { default: "openai/gpt-5", reviewer: "openai/o3" };

    expect(roleSettings(config({ models }), "reviewer").model).toBe(
      "openai/o3",
    );
    expect(roleSettings(config({ models }), "coder").model).toBe(
      "openai/gpt-5",
    );
  });

  it("omits the model when none is configured", () => {
    expect("model" in roleSettings(config(), "coder")).toBe(false);
  });

  it("applies permission overrides", () => {
    const settings = roleSettings(
      config({ roles: { reviewer: { permissions: { webfetch: "allow" } } } }),
      "reviewer",
    );

    expect(settings.permissions.webfetch).toBe("allow");
    expect(settings.permissions.edit).toBe("deny");
  });
});
