import { join } from "node:path";
import { Writable } from "node:stream";

import { createShellCheckRunner } from "../adapters/checks/shell-check-runner.js";
import { createGitVcs, type GitVcs } from "../adapters/git/git-vcs.js";
import {
  createOpencodeRunner,
  createOpencodeClient,
} from "../adapters/opencode/runner.js";
import { startOpencodeServer } from "../adapters/opencode/server.js";
import { createFileRunStore } from "../adapters/store/file-run-store.js";
import { defaultEditor, editText } from "../adapters/terminal/editor.js";
import { createTerminalReporter } from "../adapters/terminal/reporter.js";
import { createTerminalGate } from "../adapters/terminal/terminal-gate.js";

import type { CliIo } from "./cli.types.js";
import type { EngineContext } from "../core/pipeline/engine.types.js";
import type { AgentRunner } from "../core/ports/agent-runner.types.js";
import type { Config } from "../core/schemas/config.js";

interface AgentRuntime {
  readonly agents: AgentRunner;
  close(): Promise<void>;
}

/** Starts whatever runs the agents for the repository in `directory`. */
export type OpenAgents = (directory: string) => Promise<AgentRuntime>;

const SERVER_STARTUP_TIMEOUT_MS = 60_000;

/** A private OpenCode server for this run (ADR 0012). */
export const openOpencode: OpenAgents = async (directory) => {
  const server = await startOpencodeServer({
    directory,
    startupTimeoutMs: SERVER_STARTUP_TIMEOUT_MS,
  });
  const client = createOpencodeClient(server);
  return {
    agents: createOpencodeRunner({ client, directory }),
    close: () => server.stop(),
  };
};

/** `$XDG_DATA_HOME/agent-conductor/runs`, by default under `~/.local/share`. */
export function archiveDirectory(env: CliIo["env"]): string {
  const dataHome =
    env["XDG_DATA_HOME"] ?? join(env["HOME"] ?? ".", ".local", "share");
  return join(dataHome, "agent-conductor", "runs");
}

function stderrStream(io: CliIo): Writable {
  return new Writable({
    write: (chunk: Buffer, _encoding, done) => {
      io.stderr(chunk.toString());
      done();
    },
  });
}

export interface EngineSetup {
  readonly io: CliIo;
  readonly config: Config;
  readonly openAgents: OpenAgents;
}

/** Wires the local adapters into the engine, runs `use` and cleans up. */
export async function withEngine<T>(
  setup: EngineSetup,
  use: (ctx: EngineContext, vcs: GitVcs) => Promise<T>,
): Promise<T> {
  const { io, config } = setup;
  const vcs = createGitVcs(io.cwd);
  const gates = createTerminalGate({
    input: io.stdin,
    output: stderrStream(io),
    edit: (template) => editText({ command: defaultEditor(io.env), template }),
  });
  const runtime = await setup.openAgents(io.cwd);
  try {
    const deps = {
      agents: runtime.agents,
      vcs,
      checks: createShellCheckRunner({ cwd: io.cwd }),
      gates,
      store: createFileRunStore({
        repository: io.cwd,
        archiveDirectory: archiveDirectory(io.env),
      }),
      publisher: { publish: () => Promise.resolve() },
      clock: { now: () => Date.now() },
      reporter: createTerminalReporter(io.stderr),
    };
    return await use({ deps, config }, vcs);
  } finally {
    gates.close();
    await runtime.close();
  }
}
