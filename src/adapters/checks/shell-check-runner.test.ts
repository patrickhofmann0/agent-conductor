import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import type { CheckConfig } from "../../core/schemas/config.js";

import { createShellCheckRunner } from "./shell-check-runner.js";

const runner = createShellCheckRunner({ cwd: tmpdir() });

function check(
  command: string,
  overrides: Partial<CheckConfig> = {},
): CheckConfig {
  return { name: "test", command, required: true, timeout: 5000, ...overrides };
}

describe("createShellCheckRunner", () => {
  it("passes on exit code 0 and collects stdout and stderr", async () => {
    const result = await runner.run(check("echo out; echo err >&2"));
    expect(result).toMatchObject({
      name: "test",
      required: true,
      passed: true,
      exitCode: 0,
      timedOut: false,
      output: "out\nerr\n",
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("fails on a non-zero exit code and keeps the required flag", async () => {
    const result = await runner.run(
      check("echo broken; exit 3", { required: false }),
    );
    expect(result).toMatchObject({
      required: false,
      passed: false,
      exitCode: 3,
      output: "broken\n",
    });
  });

  it("runs in the configured directory with plain output settings", async () => {
    const result = await runner.run(check('pwd; echo "$CI $NO_COLOR"'));
    expect(result.output).toContain(`\ntrue 1\n`);
  });

  it("kills the whole process group on timeout", async () => {
    const result = await runner.run(
      check("echo started; sleep 30 & wait", { timeout: 200 }),
    );
    expect(result).toMatchObject({
      passed: false,
      exitCode: null,
      timedOut: true,
      output: "started\n\n[conductor] check timed out after 200 ms",
    });
    expect(result.durationMs).toBeLessThan(5000);
  });

  it("truncates long output", async () => {
    const short = createShellCheckRunner({ cwd: tmpdir(), maxOutputChars: 40 });
    const result = await short.run(
      check(`node -e "process.stdout.write('x'.repeat(1000))"`),
    );
    expect(result.output).toContain("characters omitted");
    expect(result.output.length).toBeLessThan(100);
  });

  it("fails when the working directory does not exist", async () => {
    const missing = createShellCheckRunner({ cwd: "/nonexistent-directory" });
    const result = await missing.run(check("true"));
    expect(result).toMatchObject({ passed: false, exitCode: null });
    expect(result.output).toMatch(/ENOENT/);
  });
});
