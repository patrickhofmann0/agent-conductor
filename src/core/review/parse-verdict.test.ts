import { describe, expect, it } from "vitest";

import { extractJson, parseVerdict } from "./parse-verdict.js";

const verdict = {
  verdict: "approve",
  route: "both",
  summary: "Good",
  findings: [],
};
const json = JSON.stringify(verdict);

describe("extractJson", () => {
  it("takes a json code block", () => {
    expect(
      extractJson(`Here you go:\n\`\`\`json\n${json}\n\`\`\`\nThanks`),
    ).toBe(json);
  });

  it("takes an unlabeled code block instead of surrounding braces", () => {
    expect(extractJson(`Note {x}\n\`\`\`\n${json}\n\`\`\``)).toBe(json);
  });

  it("tolerates trailing spaces after the fence", () => {
    expect(extractJson(`\`\`\`json  \n${json}\n\`\`\``)).toBe(json);
  });

  it("takes the last code block", () => {
    expect(extractJson('```json\n{"a":1}\n```\n```json\n{"b":2}\n```')).toBe(
      '{"b":2}',
    );
  });

  it("falls back to the outermost braces", () => {
    expect(extractJson(`Result: ${json} done`)).toBe(json);
  });

  it.each(["no json here", "} before {", "{"])(
    "returns null for %j",
    (output) => {
      expect(extractJson(output)).toBeNull();
    },
  );
});

describe("parseVerdict", () => {
  it("parses a valid verdict", () => {
    expect(parseVerdict(`\`\`\`json\n${json}\n\`\`\``)).toEqual({
      ok: true,
      verdict,
    });
  });

  it("reports a missing JSON object", () => {
    expect(parseVerdict("I approve.")).toEqual({
      ok: false,
      error: "No JSON object found in the answer.",
    });
  });

  it("reports invalid JSON with the parser message", () => {
    const result = parseVerdict("```json\n{verdict: approve}\n```");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(
      /^Invalid JSON \(SyntaxError: .+\)$/,
    );
  });

  it("reports every schema problem with its path", () => {
    const result = parseVerdict(
      JSON.stringify({
        verdict: "maybe",
        summary: "x",
        findings: [{ id: "a" }],
      }),
    );

    expect(result.ok).toBe(false);
    const error = !result.ok ? result.error : "";
    expect(error).toMatch(
      /^The JSON does not match the format\. verdict: Invalid option.*; findings\.0\.severity: /,
    );
  });

  it("names the root for non-object JSON", () => {
    const result = parseVerdict("```json\n[1]\n```");

    expect(!result.ok && result.error).toContain("(root): ");
  });
});
