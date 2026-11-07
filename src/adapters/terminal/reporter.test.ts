import { describe, expect, it } from "vitest";

import type { RunEvent } from "../../core/ports/reporter.types.js";

import { createTerminalReporter, formatEvent } from "./reporter.js";

describe("formatEvent", () => {
  it.each<[RunEvent, string]>([
    [{ type: "step_started", step: "po", iteration: 0 }, "> po"],
    [
      { type: "step_started", step: "coder", iteration: 2 },
      "> coder (iteration 2)",
    ],
    [
      {
        type: "agent_finished",
        step: "coder",
        iteration: 1,
        costUsd: 0.3049,
        durationMs: 41_400,
      },
      "  coder finished in 41s, $0.30",
    ],
    [
      { type: "guardrail_reverted", paths: ["a.test.ts", "eslint.config.js"] },
      "  ! reverted changes to protected files: a.test.ts, eslint.config.js",
    ],
    [
      { type: "limit_reached", kind: "cost", detail: "$10.20 of $10" },
      "! limit reached (cost): $10.20 of $10",
    ],
    [
      { type: "run_paused", reason: "Waiting at the po gate" },
      "Run paused: Waiting at the po gate",
    ],
    [{ type: "run_paused", reason: "" }, "Run paused"],
    [{ type: "run_finished", status: "done" }, "Run done"],
    [
      { type: "run_finished", status: "failed", reason: "HEAD changed" },
      "Run failed: HEAD changed",
    ],
  ])("formats %j", (event, line) => {
    expect(formatEvent(event)).toBe(line);
  });
});

describe("createTerminalReporter", () => {
  it("writes one line per event", () => {
    const lines: string[] = [];
    const reporter = createTerminalReporter((text) => lines.push(text));
    reporter.report({ type: "run_finished", status: "done" });
    expect(lines).toEqual(["Run done\n"]);
  });
});
