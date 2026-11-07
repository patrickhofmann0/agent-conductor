import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import pkg from "../../package.json" with { type: "json" };
import { captureIo } from "../../test/support/cli-io.js";

import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, runCli } from "./main.js";

async function tempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), "conductor-main-"));
}

describe("runCli", () => {
  it.each([["--version"], ["-v"]])(
    "prints the package version for %s",
    async (flag) => {
      const { io, out, err } = captureIo(tmpdir());
      expect(await runCli([flag], io)).toBe(EXIT_OK);
      expect(out()).toBe(`${pkg.version}\n`);
      expect(err()).toBe("");
    },
  );

  it.each([[[]], [["--help"]], [["-h"]], [["init", "--help"]]])(
    "prints help for %j",
    async (argv) => {
      const { io, out, err } = captureIo(tmpdir());
      expect(await runCli(argv, io)).toBe(EXIT_OK);
      expect(out()).toContain("Usage: conductor <command>");
      expect(out()).toContain("validate-config");
      expect(err()).toBe("");
    },
  );

  it("prefers --version over --help", async () => {
    const { io, out } = captureIo(tmpdir());
    await runCli(["--help", "--version"], io);
    expect(out()).toBe(`${pkg.version}\n`);
  });

  it("rejects unknown options with a usage error", async () => {
    const { io, out, err } = captureIo(tmpdir());
    expect(await runCli(["--nope"], io)).toBe(EXIT_USAGE);
    expect(out()).toBe("");
    expect(err()).toContain("--nope");
    expect(err()).toContain("Usage: conductor");
  });

  it("rejects unknown commands with a usage error", async () => {
    const { io, err } = captureIo(tmpdir());
    expect(await runCli(["deploy"], io)).toBe(EXIT_USAGE);
    expect(err()).toContain('Unknown command "deploy".');
  });

  it("runs a command", async () => {
    const { io, out } = captureIo(await tempDir());
    expect(await runCli(["validate-config"], io)).toBe(EXIT_OK);
    expect(out()).toBe("Default configuration is valid.\n");
  });

  it("maps wrong command arguments to a usage error", async () => {
    const { io, err } = captureIo(await tempDir());
    expect(await runCli(["init", "extra"], io)).toBe(EXIT_USAGE);
    expect(err()).toBe("init takes no arguments.\n");
  });

  it("maps command failures to exit code 1", async () => {
    const cwd = await tempDir();
    await writeFile(join(cwd, "conductor.yaml"), "foo: 1\n");
    const { io, err } = captureIo(cwd);
    expect(await runCli(["validate-config"], io)).toBe(EXIT_FAILURE);
    expect(err()).toContain("Invalid");
  });
});
