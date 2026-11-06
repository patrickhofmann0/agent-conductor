import { afterEach, describe, expect, it } from "vitest";

import type {
  AgentRunRequest,
  AgentRunResult,
} from "../../core/ports/agent-runner.types.js";
import {
  startMockOpencode,
  type MockOpencode,
  type MockRoutes,
} from "../../../test/support/mock-opencode.js";

import { createOpencodeClient, createOpencodeRunner } from "./runner.js";

const S = "/api/session/ses_1";

function executionEvent(type: string, data: object = {}): object {
  return { type, id: "e", created: 0, data: { sessionID: "ses_1", ...data } };
}

function answer(text: string): unknown {
  return {
    data: [
      {
        type: "assistant",
        content: [
          { type: "reasoning", text: "thinking" },
          { type: "text", text },
        ],
      },
    ],
    cursor: {},
  };
}

function routes(onPrompt: (mock: MockOpencode) => void): MockRoutes {
  return {
    "POST /api/session": () => ({ data: { id: "ses_1", cost: 0 } }),
    [`POST ${S}/prompt`]: (_body, mock) => {
      onPrompt(mock);
      return { data: { id: "msg_1", type: "user" } };
    },
    [`GET ${S}`]: () => ({ data: { id: "ses_1", cost: 0.75 } }),
    [`PATCH ${S}`]: () => undefined,
    [`GET ${S}/message`]: () => answer("Done."),
    [`POST ${S}/interrupt`]: () => ({ interrupted: true }),
    [`POST ${S}/permission/perm_1/reply`]: () => undefined,
  };
}

const WITHOUT_MODEL: AgentRunRequest = {
  role: "coder",
  system: "You are the coder.",
  prompt: "Implement it.",
  permissions: [{ action: "shell", resource: "git *", effect: "deny" }],
  timeoutMs: 5000,
};

const REQUEST: AgentRunRequest = {
  ...WITHOUT_MODEL,
  model: "anthropic/claude#high",
};

function without(mockRoutes: MockRoutes, key: string): MockRoutes {
  return Object.fromEntries(
    Object.entries(mockRoutes).filter(([route]) => route !== key),
  );
}

let mock: MockOpencode | undefined;

afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

async function runWith(
  mockRoutes: MockRoutes,
  request: AgentRunRequest = REQUEST,
): Promise<{ result: AgentRunResult; server: MockOpencode }> {
  const server = await startMockOpencode(mockRoutes);
  mock = server;
  const client = createOpencodeClient({
    url: server.url,
    authorization: "Basic abc",
  });
  const runner = createOpencodeRunner({ client, directory: "/repo" });
  return { result: await runner.run(request), server };
}

function bodyOf(server: MockOpencode, method: string, path: string): unknown {
  return server.requests.find((r) => r.method === method && r.path === path)
    ?.body;
}

describe("createOpencodeRunner", () => {
  it("creates a session, prompts and returns the answer and cost", async () => {
    const { result, server } = await runWith(
      routes((m) => {
        m.emit(executionEvent("session.execution.succeeded"));
      }),
    );
    expect(result).toMatchObject({
      sessionId: "ses_1",
      status: "completed",
      output: "Done.",
      costUsd: 0.75,
    });
    expect(result.error).toBeUndefined();
    expect(bodyOf(server, "POST", "/api/session")).toEqual({
      agent: "build",
      location: { directory: "/repo" },
      permissions: REQUEST.permissions,
      model: { providerID: "anthropic", id: "claude", variant: "high" },
    });
    expect(bodyOf(server, "POST", `${S}/prompt`)).toEqual({
      text: "You are the coder.\n\nImplement it.",
    });
    expect(server.requests.every((r) => r.authorization === "Basic abc")).toBe(
      true,
    );
  });

  it("omits the model when none is configured", async () => {
    const { server } = await runWith(
      routes((m) => {
        m.emit(executionEvent("session.execution.succeeded"));
      }),
      WITHOUT_MODEL,
    );
    expect(bodyOf(server, "POST", "/api/session")).not.toHaveProperty("model");
  });

  it("rejects permission requests and reports them", async () => {
    const { result, server } = await runWith(
      routes((m) => {
        m.emit(
          executionEvent("permission.asked", {
            id: "perm_1",
            action: "shell",
            resources: ["rm -rf /"],
          }),
        );
        m.emit(executionEvent("session.execution.succeeded"));
      }),
    );
    expect(result.status).toBe("completed");
    expect(result.error).toBe("rejected permission requests: shell rm -rf /");
    expect(
      bodyOf(server, "POST", `${S}/permission/perm_1/reply`),
    ).toMatchObject({ decision: "reject" });
  });

  it("reports a failed execution", async () => {
    const { result } = await runWith(
      routes((m) => {
        m.emit(
          executionEvent("session.execution.failed", {
            error: { type: "api", message: "rate limited" },
          }),
        );
      }),
    );
    expect(result).toMatchObject({ status: "error", error: "rate limited" });
  });

  it("reports an interrupted execution", async () => {
    const { result } = await runWith(
      routes((m) => {
        m.emit(
          executionEvent("session.execution.interrupted", {
            reason: "shutdown",
          }),
        );
      }),
    );
    expect(result).toMatchObject({
      status: "error",
      error: "interrupted (shutdown)",
    });
  });

  it("interrupts the session on timeout", async () => {
    const { result, server } = await runWith(
      routes(() => undefined),
      { ...REQUEST, timeoutMs: 200 },
    );
    expect(result).toMatchObject({
      status: "timeout",
      error: "timed out after 200 ms",
      costUsd: 0.75,
    });
    expect(server.requests.map((r) => r.path)).toContain(`${S}/interrupt`);
  });

  it("continues an existing session and counts only the new cost", async () => {
    let cost = 0.5;
    const { result, server } = await runWith(
      {
        ...routes((m) => {
          cost = 2;
          m.emit(executionEvent("session.execution.succeeded"));
        }),
        [`GET ${S}`]: () => ({ data: { id: "ses_1", cost } }),
      },
      { ...REQUEST, sessionId: "ses_1" },
    );
    expect(result).toMatchObject({ status: "completed", costUsd: 1.5 });
    expect(bodyOf(server, "PATCH", S)).toEqual({
      permissions: REQUEST.permissions,
    });
    expect(server.requests.some((r) => r.path === "/api/session")).toBe(false);
  });

  it("reports an error when the session cannot be created", async () => {
    const { result } = await runWith({});
    expect(result).toMatchObject({
      sessionId: "",
      status: "error",
      costUsd: 0,
    });
    expect(result.error).toMatch(/^No route /);
  });

  it("reports an error when the prompt fails", async () => {
    const { result } = await runWith(
      without(
        routes(() => undefined),
        `POST ${S}/prompt`,
      ),
    );
    expect(result).toMatchObject({ status: "error" });
    expect(result.error).toMatch(/^No route /);
  });

  it("turns a failed result lookup into an error", async () => {
    const { result } = await runWith(
      without(
        routes((m) => {
          m.emit(executionEvent("session.execution.succeeded"));
        }),
        `GET ${S}/message`,
      ),
    );
    expect(result).toMatchObject({ status: "error", output: "", costUsd: 0 });
  });

  it("returns an empty answer when there is no assistant message", async () => {
    const { result } = await runWith({
      ...routes((m) => {
        m.emit(executionEvent("session.execution.succeeded"));
      }),
      [`GET ${S}/message`]: () => ({ data: [], cursor: {} }),
    });
    expect(result).toMatchObject({ status: "completed", output: "" });
  });
});
