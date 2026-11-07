import { OpenCode, type OpenCodeClient } from "@opencode/client";

import type {
  AgentRunner,
  AgentRunRequest,
  AgentRunResult,
  AgentRunStatus,
} from "../../core/ports/agent-runner.types.js";

import { parseModel } from "./model.js";
import { WATCHED_EVENTS, watchExecution, type WatchResult } from "./watch.js";

export interface OpencodeConnection {
  readonly url: string;
  /** Value for the HTTP `Authorization` header. */
  readonly authorization: string;
}

export interface OpencodeRunnerOptions {
  readonly client: OpenCodeClient;
  /** The repository the agents work in. */
  readonly directory: string;
}

interface OpenSession {
  readonly id: string;
  readonly costBefore: number;
}

interface Ending {
  readonly status: AgentRunStatus;
  readonly error?: string;
}

export function createOpencodeClient(
  connection: OpencodeConnection,
): OpenCodeClient {
  return OpenCode.make({
    baseUrl: connection.url,
    headers: { authorization: connection.authorization },
  });
}

async function openSession(
  options: OpencodeRunnerOptions,
  request: AgentRunRequest,
): Promise<OpenSession> {
  const { client } = options;
  if (request.sessionId !== undefined) {
    const sessionID = request.sessionId;
    await client.session.update({
      sessionID,
      permissions: request.permissions,
    });
    const info = await client.session.get({ sessionID });
    return { id: info.id, costBefore: info.cost };
  }
  const info = await client.session.create({
    agent: "build",
    location: { directory: options.directory },
    permissions: request.permissions,
    ...(request.model === undefined
      ? {}
      : { model: parseModel(request.model) }),
  });
  return { id: info.id, costBefore: 0 };
}

interface Execution {
  readonly sessionID: string;
  readonly text: string;
  readonly signal: AbortSignal;
}

async function execute(
  client: OpenCodeClient,
  execution: Execution,
): Promise<WatchResult> {
  const { sessionID, text, signal } = execution;
  const events = client.event
    .subscribe({ types: WATCHED_EVENTS, signal })
    [Symbol.asyncIterator]();
  // The first event is "server.connected": the stream is open before prompting.
  await events.next();
  await client.session.prompt({ sessionID, text });
  return watchExecution(client, sessionID, events);
}

function endingOf(watched: WatchResult): Ending {
  const { outcome, rejected } = watched;
  const errors = [
    outcome.kind === "failed" ? outcome.error : undefined,
    outcome.kind === "interrupted"
      ? `interrupted (${outcome.reason})`
      : undefined,
    rejected.length > 0
      ? `rejected permission requests: ${rejected.join(", ")}`
      : undefined,
  ].filter((text) => text !== undefined);
  const status = outcome.kind === "succeeded" ? "completed" : "error";
  return errors.length > 0 ? { status, error: errors.join("; ") } : { status };
}

async function lastAnswer(
  client: OpenCodeClient,
  sessionID: string,
): Promise<string> {
  const page = await client.message.list({
    sessionID,
    type: "assistant",
    order: "desc",
    limit: 1,
  });
  const message = page.data[0];
  if (message?.type !== "assistant") return "";
  return message.content
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runSession(
  client: OpenCodeClient,
  session: OpenSession,
  request: AgentRunRequest,
): Promise<Ending> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, request.timeoutMs);
  let ending: Ending;
  try {
    ending = endingOf(
      await execute(client, {
        sessionID: session.id,
        text: `${request.system}\n\n${request.prompt}`,
        signal: controller.signal,
      }),
    );
  } catch (error: unknown) {
    ending = { status: "error", error: describe(error) };
  } finally {
    clearTimeout(timer);
  }
  if (!controller.signal.aborted) {
    controller.abort();
    return ending;
  }
  await client.session
    .interrupt({ sessionID: session.id })
    .catch(() => undefined);
  return {
    status: "timeout",
    error: `timed out after ${String(request.timeoutMs)} ms`,
  };
}

async function finish(
  client: OpenCodeClient,
  session: OpenSession,
  ending: Ending,
): Promise<Pick<AgentRunResult, "status" | "output" | "costUsd" | "error">> {
  try {
    const info = await client.session.get({ sessionID: session.id });
    const output = await lastAnswer(client, session.id);
    return { output, costUsd: info.cost - session.costBefore, ...ending };
  } catch (error: unknown) {
    const reason = [ending.error, describe(error)].filter(
      (text) => text !== undefined,
    );
    const status = ending.status === "completed" ? "error" : ending.status;
    return { status, output: "", costUsd: 0, error: reason.join("; ") };
  }
}

/** Runs each agent in its own OpenCode session (ADR 0012). */
export function createOpencodeRunner(
  options: OpencodeRunnerOptions,
): AgentRunner {
  return {
    run: async (request) => {
      const started = Date.now();
      let session: OpenSession;
      try {
        session = await openSession(options, request);
      } catch (error: unknown) {
        return {
          sessionId: request.sessionId ?? "",
          status: "error",
          output: "",
          costUsd: 0,
          durationMs: Date.now() - started,
          error: describe(error),
        };
      }
      const ending = await runSession(options.client, session, request);
      const details = await finish(options.client, session, ending);
      return {
        sessionId: session.id,
        ...details,
        durationMs: Date.now() - started,
      };
    },
  };
}
