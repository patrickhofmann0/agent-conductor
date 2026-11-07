import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { parse } from "yaml";
import { describe, expect, it } from "vitest";

import { captureIo } from "../../../test/support/cli-io.js";
import { parseConfig } from "../../core/config/parse.js";

import { CONFIG_TEMPLATE, initCommand } from "./init.js";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "conductor-init-"));
}

describe("initCommand", () => {
  it("writes a valid, commented conductor.yaml", async () => {
    const cwd = await tempDir();
    const { io, out } = captureIo(cwd);
    expect(await initCommand({ args: [], noPr: false, io })).toBe(0);
    const written = await readFile(join(cwd, "conductor.yaml"), "utf8");
    expect(written).toBe(CONFIG_TEMPLATE);
    expect(out()).toBe(`Created ${join(cwd, "conductor.yaml")}.\n`);
  });

  it("produces a template that passes validation", () => {
    const raw: unknown = parse(CONFIG_TEMPLATE);
    expect(parseConfig(raw).ok).toBe(true);
  });

  it("never overwrites an existing file", async () => {
    const cwd = await tempDir();
    await writeFile(join(cwd, "conductor.yaml"), "mine");
    const { io } = captureIo(cwd);
    await expect(initCommand({ args: [], noPr: false, io })).rejects.toThrow(
      /already exists/,
    );
    expect(await readFile(join(cwd, "conductor.yaml"), "utf8")).toBe("mine");
  });

  it("rethrows other write errors", async () => {
    const { io } = captureIo("/nonexistent-directory");
    await expect(initCommand({ args: [], noPr: false, io })).rejects.toThrow(
      /ENOENT/,
    );
  });

  it("rejects arguments", async () => {
    const { io } = captureIo(await tempDir());
    await expect(initCommand({ args: ["x"], noPr: false, io })).rejects.toThrow(
      "init takes no arguments.",
    );
  });
});
