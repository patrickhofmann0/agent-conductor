import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ConfigError, loadConfig } from "./config-file.js";

async function directoryWith(content?: string): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), "conductor-config-"));
  if (content !== undefined) {
    await writeFile(join(directory, "conductor.yaml"), content);
  }
  return directory;
}

describe("loadConfig", () => {
  it("uses defaults and warns when the file is missing", async () => {
    const loaded = await loadConfig(await directoryWith());
    expect(loaded.path).toBeNull();
    expect(loaded.config.loop.maxIterations).toBe(3);
    expect(loaded.warnings).toEqual([
      "No conductor.yaml found; using defaults.",
      "No checks configured; only the reviewer judges the result.",
    ]);
  });

  it("reads YAML and applies defaults", async () => {
    const directory = await directoryWith(
      "loop:\n  maxIterations: 5\nchecks:\n  - name: test\n    command: npm test\n",
    );
    const loaded = await loadConfig(directory);
    expect(loaded.path).toBe(join(directory, "conductor.yaml"));
    expect(loaded.config.loop.maxIterations).toBe(5);
    expect(loaded.config.checks[0]?.timeout).toBe(600_000);
    expect(loaded.warnings).toEqual([]);
  });

  it("treats an empty file as defaults", async () => {
    const loaded = await loadConfig(await directoryWith(""));
    expect(loaded.config.git.baseBranch).toBe("main");
  });

  it("lists every schema problem", async () => {
    const directory = await directoryWith(
      "loop:\n  maxIterations: 0\nfoo: 1\n",
    );
    const error = await loadConfig(directory).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConfigError);
    expect(error instanceof ConfigError ? error.errors : []).toHaveLength(2);
    expect(String(error)).toContain("loop.maxIterations");
  });

  it("reports YAML syntax errors", async () => {
    const directory = await directoryWith("loop: [\n");
    await expect(loadConfig(directory)).rejects.toThrow(
      /Invalid .*conductor\.yaml/,
    );
  });

  it("rethrows unexpected read errors", async () => {
    const directory = await directoryWith();
    await writeFile(join(directory, "file"), "");
    await expect(loadConfig(join(directory, "file"))).rejects.toThrow(
      /ENOTDIR/,
    );
  });
});
