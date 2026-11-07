import { describe, expect, it } from "vitest";

import { parseModel } from "./model.js";

describe("parseModel", () => {
  it("splits provider and model", () => {
    expect(parseModel("anthropic/claude-sonnet")).toEqual({
      providerID: "anthropic",
      id: "claude-sonnet",
    });
  });

  it("keeps further slashes in the model ID", () => {
    expect(parseModel("openrouter/anthropic/claude")).toEqual({
      providerID: "openrouter",
      id: "anthropic/claude",
    });
  });

  it("reads a variant after #", () => {
    expect(parseModel("openai/gpt-5#high")).toEqual({
      providerID: "openai",
      id: "gpt-5",
      variant: "high",
    });
  });

  it.each(["claude", "/claude", "anthropic/", "anthropic/claude#"])(
    "rejects %j",
    (model) => {
      expect(() => parseModel(model)).toThrow(/Invalid model/);
    },
  );
});
