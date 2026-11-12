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
import { createForgeGateHandler } from "../core/forge/forge-gate.js";
import { createForgePublisher } from "../core/forge/forge-publisher.js";

import type { CliIo } from "./cli.types.js";
import type { EngineContext } from "../core/pipeline/engine.types.js";
import type { AgentRunner } from "../core/ports/agent-runner.types.js";
import type { Forge } from "../core/ports/forge.types.js";
import type { GateHandler } from "../core/ports/gate-handler.types.js";
import type { Publisher } from "../core/ports/publisher.types.js";
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
  /** Publishes to pull requests when set; local branch only otherwise. */
  readonly forge?: Forge | null;
  /** Gates on pull request reviews instead of the terminal. */
  readonly forgeGates?: boolean;
}

const NO_PUBLISHER: Publisher = { publish: () => Promise.resolve() };

function forgeAdapters(
  setup: EngineSetup,
  vcs: GitVcs,
  terminal: GateHandler,
): { publisher: Publisher; gates: GateHandler } {
  const { forge, config } = setup;
  if (forge === undefined || forge === null) {
    return { publisher: NO_PUBLISHER, gates: terminal };
  }
  const labels = config.github.labels;
  return {
    publisher: createForgePublisher({
      forge,
      push: () => vcs.push("origin"),
      baseBranch: config.git.baseBranch,
      needsHumanLabel: labels.needsHuman,
    }),
    gates:
      setup.forgeGates === true
        ? createForgeGateHandler({ forge, approvedLabel: labels.approved })
        : terminal,
  };
}

/** Wires the local adapters into the engine, runs `use` and cleans up. */
export async function withEngine<T>(
  setup: EngineSetup,
  use: (ctx: EngineContext, vcs: GitVcs) => Promise<T>,
): Promise<T> {
  const { io, config } = setup;
  const vcs = createGitVcs(io.cwd);
  const terminal = createTerminalGate({
    input: io.stdin,
    output: stderrStream(io),
    edit: (template) => editText({ command: defaultEditor(io.env), template }),
  });
  const { publisher, gates } = forgeAdapters(setup, vcs, terminal);
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
      publisher,
      clock: { now: () => Date.now() },
      reporter: createTerminalReporter(io.stderr),
    };
    return await use({ deps, config }, vcs);
  } finally {
    terminal.close();
    await runtime.close();
  }
}
