import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { captureIo, type CapturedIo } from "./cli-io.js";
import { APPROVE_JSON } from "../fakes/fake-agent-runner.js";

import type { OpenAgents } from "../../src/cli/engine-setup.js";
import type { AgentRunRequest } from "../../src/core/ports/agent-runner.types.js";

const OUTPUT = {
  po: "# Requirements\n\n1. Export CSV",
  planner: "# Plan\n\n1. Add exporter",
  coder: "Implemented.",
  tester: "Tested.",
  reviewer: APPROVE_JSON,
} as const;

export interface ScriptedAgentOptions {
  /** Role whose run fails, as if the run was interrupted there. */
  readonly failAt?: AgentRunRequest["role"];
  /** File the coder writes into the repository; defaults to export.ts. */
  readonly coderFile?: string;
}

export interface ScriptedAgents {
  readonly open: OpenAgents;
  readonly closed: () => boolean;
}

/** Agents that answer every role at once and approve; the coder writes one file. */
export function scriptedAgents(
  repository: string,
  options: ScriptedAgentOptions = {},
): ScriptedAgents {
  let closed = false;
  const open: OpenAgents = () =>
    Promise.resolve({
      agents: {
        run: (request) => {
          if (request.role === options.failAt) {
            return Promise.reject(new Error("Interrupted"));
          }
          if (request.role === "coder") {
            writeFileSync(
              join(repository, options.coderFile ?? "export.ts"),
              "export const csv = 1;\n",
            );
          }
          return Promise.resolve({
            sessionId: `ses-${request.role}`,
            status: "completed",
            output: OUTPUT[request.role],
            costUsd: 0.1,
            durationMs: 10,
          });
        },
      },
      close: () => {
        closed = true;
        return Promise.resolve();
      },
    });
  return { open, closed: () => closed };
}

/** CLI io for a repository, with an isolated archive and a no-op editor. */
export function repositoryIo(
  repository: string,
  dataHome: string,
  answers: string,
): CapturedIo {
  const captured = captureIo(repository, answers);
  return {
    ...captured,
    io: { ...captured.io, env: { XDG_DATA_HOME: dataHome, EDITOR: "true" } },
  };
}
