import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { captureIo } from "../../../test/support/cli-io.js";

import { validateConfigCommand } from "./validate-config.js";

describe("validateConfigCommand", () => {
  it("reports a valid file", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conductor-validate-"));
    await writeFile(
      join(cwd, "conductor.yaml"),
      "checks:\n  - name: test\n    command: npm test\n",
    );
    const { io, out, err } = captureIo(cwd);
    expect(await validateConfigCommand({ args: [], noPr: false, io })).toBe(0);
    expect(out()).toBe(`${join(cwd, "conductor.yaml")} is valid.\n`);
    expect(err()).toBe("");
  });

  it("reports defaults and prints warnings", async () => {
    const cwd = await mkdtemp(join(tmpdir(), "conductor-validate-"));
    const { io, out, err } = captureIo(cwd);
    expect(await validateConfigCommand({ args: [], noPr: false, io })).toBe(0);
    expect(out()).toBe("Default configuration is valid.\n");
    expect(err()).toContain("warning: No conductor.yaml found");
  });

  it("rejects arguments", async () => {
    const { io } = captureIo(tmpdir());
    await expect(
      validateConfigCommand({ args: ["x"], noPr: false, io }),
    ).rejects.toThrow("validate-config takes no arguments.");
  });
});
