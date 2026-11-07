import { PassThrough } from "node:stream";

import type { CliIo } from "../../src/cli/cli.types.js";

export interface CapturedIo {
  readonly io: CliIo;
  readonly out: () => string;
  readonly err: () => string;
}

/** CLI io that records stdout/stderr and reads stdin from `input`. */
export function captureIo(cwd: string, input = ""): CapturedIo {
  const out: string[] = [];
  const err: string[] = [];
  const stdin = new PassThrough();
  stdin.end(input);
  return {
    io: {
      stdout: (text) => out.push(text),
      stderr: (text) => err.push(text),
      stdin,
      cwd,
      env: {},
    },
    out: () => out.join(""),
    err: () => err.join(""),
  };
}
