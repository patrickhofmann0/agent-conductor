import { PassThrough } from "node:stream";

import { describe, expect, it } from "vitest";

import type { GateRequest } from "../../core/ports/gate-handler.types.js";

import { createTerminalGate } from "./terminal-gate.js";

const REQUEST: GateRequest = {
  runId: "run-1",
  gate: "po",
  artifactName: "requirements.md",
  artifact: "# Requirements\n\n- Export CSV\n",
};

interface Setup {
  readonly answers: string;
  readonly edit?: (template: string) => Promise<string>;
}

function setup({ answers, edit }: Setup): {
  gate: ReturnType<typeof createTerminalGate>;
  printed: () => string;
  templates: string[];
} {
  const input = new PassThrough();
  input.end(answers);
  const output = new PassThrough();
  let text = "";
  output.on("data", (chunk: Buffer) => {
    text += chunk.toString();
  });
  const templates: string[] = [];
  const gate = createTerminalGate({
    input,
    output,
    edit: (template) => {
      templates.push(template);
      return edit === undefined ? Promise.resolve("") : edit(template);
    },
  });
  return { gate, printed: () => text, templates };
}

describe("createTerminalGate request", () => {
  it("shows the artifact and approves", async () => {
    const { gate, printed } = setup({ answers: "A\n" });
    expect(await gate.request(REQUEST)).toEqual({ kind: "approve" });
    expect(printed()).toContain("po gate: requirements.md");
    expect(printed()).toContain("- Export CSV\n");
  });

  it("collects inline feedback until an empty line", async () => {
    const { gate } = setup({ answers: "r\nAdd tests.\nKeep it small.\n\n" });
    expect(await gate.request(REQUEST)).toEqual({
      kind: "revise",
      feedback: "Add tests.\nKeep it small.",
    });
  });

  it("uses the editor for feedback", async () => {
    const { gate, templates } = setup({
      answers: "e\n",
      edit: () => Promise.resolve("Use semicolons."),
    });
    expect(await gate.request(REQUEST)).toEqual({
      kind: "revise",
      feedback: "Use semicolons.",
    });
    expect(templates[0]).toMatch(/^# Feedback for requirements.md \(po gate\)/);
  });

  it("asks again after empty feedback or a failing editor", async () => {
    const { gate, printed } = setup({
      answers: "r\n\ne\na\n",
      edit: () => Promise.reject(new Error("Editor broke")),
    });
    expect(await gate.request(REQUEST)).toEqual({ kind: "approve" });
    expect(printed()).toContain("Feedback is empty.");
    expect(printed()).toContain("Editor broke");
  });

  it("asks again after an unknown answer", async () => {
    const { gate, printed } = setup({ answers: "maybe\na\n" });
    expect(await gate.request(REQUEST)).toEqual({ kind: "approve" });
    expect(printed()).toContain("Please answer a, r, e or x.");
  });

  it("aborts with the given reason or a default", async () => {
    const withReason = setup({ answers: "x\nWrong issue\n" });
    expect(await withReason.gate.request(REQUEST)).toEqual({
      kind: "abort",
      reason: "Wrong issue",
    });
    const withoutReason = setup({ answers: "x\n\n" });
    expect(await withoutReason.gate.request(REQUEST)).toEqual({
      kind: "abort",
      reason: "Aborted by the user at the po gate",
    });
  });

  it("aborts when the input ends", async () => {
    const { gate } = setup({ answers: "" });
    expect(await gate.request(REQUEST)).toEqual({
      kind: "abort",
      reason: "Input closed at the po gate",
    });
  });
});

describe("createTerminalGate resolveLimit", () => {
  const LIMIT = { runId: "run-1", kind: "cost", detail: "$10 spent" } as const;

  it.each([
    ["c\n", { kind: "continue" }],
    ["d\n", { kind: "draft_pr" }],
    ["?\nx\n\n", { kind: "abort", reason: "Aborted by the user at a limit" }],
    ["", { kind: "abort", reason: "Input closed at a limit" }],
  ])("answers %j with %j", async (answers, decision) => {
    const { gate, printed } = setup({ answers });
    expect(await gate.resolveLimit(LIMIT)).toEqual(decision);
    expect(printed()).toContain("Limit reached (cost): $10 spent");
  });

  it("closes the input", async () => {
    const { gate } = setup({ answers: "c\n" });
    gate.close();
    expect(await gate.resolveLimit(LIMIT)).toMatchObject({ kind: "abort" });
  });
});
