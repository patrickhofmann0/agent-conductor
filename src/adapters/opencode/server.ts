import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";

const DEFAULT_SERVE_COMMAND: readonly string[] = [
  "opencode",
  "serve",
  "--hostname",
  "127.0.0.1",
  "--port",
  "0",
];

export interface OpencodeServerOptions {
  /** Working directory of the server (the target repository). */
  readonly directory: string;
  readonly startupTimeoutMs: number;
  /** Command and arguments; defaults to a private `opencode serve` on a free port. */
  readonly command?: readonly string[];
}

export interface OpencodeServer {
  readonly url: string;
  /** Value for the HTTP `Authorization` header. */
  readonly authorization: string;
  stop(): Promise<void>;
}

const LISTENING = /server listening on (https?:\/\/\S+)/;

function waitForUrl(child: ChildProcess, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let output = "";
    const fail = (message: string): void => {
      clearTimeout(timer);
      reject(new Error(`${message}\n${output}`.trim()));
    };
    const timer = setTimeout(() => {
      fail(`opencode server did not start within ${String(timeoutMs)} ms`);
    }, timeoutMs);
    child.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      const match = LISTENING.exec(output);
      if (match?.[1] !== undefined) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.once("error", (error) => {
      fail(`opencode server failed to start: ${error.message}`);
    });
    child.once("exit", (code) => {
      fail(`opencode server exited with code ${String(code)}`);
    });
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    child.once("exit", () => {
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/** Starts a private OpenCode server for one run (ADR 0012). */
export async function startOpencodeServer(
  options: OpencodeServerOptions,
): Promise<OpencodeServer> {
  const [executable = "", ...args] = options.command ?? DEFAULT_SERVE_COMMAND;
  const password = randomBytes(32).toString("base64url");
  const child = spawn(executable, args, {
    cwd: options.directory,
    env: { ...process.env, OPENCODE_SERVER_PASSWORD: password },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const url = await waitForUrl(child, options.startupTimeoutMs);
    const token = Buffer.from(`opencode:${password}`).toString("base64");
    return {
      url,
      authorization: `Basic ${token}`,
      stop: () => stopChild(child),
    };
  } catch (error: unknown) {
    await stopChild(child);
    throw error;
  }
}
