import { describe, expect, it } from "vitest";

import pkg from "../../package.json" with { type: "json" };

import { EXIT_OK, EXIT_USAGE, runCli } from "./main.js";

function capture(): {
  out: string[];
  err: string[];
  io: Parameters<typeof runCli>[1];
} {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    io: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
    },
  };
}

describe("runCli", () => {
  it.each([["--version"], ["-v"]])(
    "prints the package version for %s",
    (flag) => {
      const { out, err, io } = capture();

      const code = runCli([flag], io);

      expect(code).toBe(EXIT_OK);
      expect(out).toEqual([`${pkg.version}\n`]);
      expect(err).toEqual([]);
    },
  );

  it.each([[[]], [["--help"]], [["-h"]]])("prints help for %j", (argv) => {
    const { out, err, io } = capture();

    const code = runCli(argv, io);

    expect(code).toBe(EXIT_OK);
    expect(out.join("")).toContain("Usage: conductor");
    expect(out.join("")).toContain("--version");
    expect(err).toEqual([]);
  });

  it("prefers --version over --help", () => {
    const { out, io } = capture();

    runCli(["--help", "--version"], io);

    expect(out).toEqual([`${pkg.version}\n`]);
  });

  it("rejects unknown options with a usage error", () => {
    const { out, err, io } = capture();

    const code = runCli(["--nope"], io);

    expect(code).toBe(EXIT_USAGE);
    expect(out).toEqual([]);
    expect(err.join("")).toContain("--nope");
    expect(err.join("")).toContain("Usage: conductor");
  });

  it("rejects positional arguments with a usage error", () => {
    const { err, io } = capture();

    const code = runCli(["run"], io);

    expect(code).toBe(EXIT_USAGE);
    expect(err.join("")).toContain("Usage: conductor");
  });
});
