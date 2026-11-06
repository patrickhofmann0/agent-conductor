import { afterEach, describe, expect, it } from "vitest";

import {
  startMockOpencode,
  type MockOpencode,
} from "../../../test/support/mock-opencode.js";

import { createOpencodeClient } from "./runner.js";
import { watchExecution, type WatchedEvent } from "./watch.js";

let mock: MockOpencode | undefined;

afterEach(async () => {
  await mock?.close();
  mock = undefined;
});

async function* stream(
  events: readonly WatchedEvent[],
): AsyncGenerator<WatchedEvent> {
  for (const event of events) {
    await Promise.resolve();
    yield event;
  }
}

const META = { id: "e", created: 0 };
const DURABLE = { aggregateID: "a", seq: 1, version: 1 } as const;

async function watch(
  events: readonly WatchedEvent[],
): ReturnType<typeof watchExecution> {
  mock = await startMockOpencode({
    "POST /api/session/ses_1/permission/perm_1/reply": () => undefined,
  });
  const client = createOpencodeClient({ url: mock.url, authorization: "x" });
  return watchExecution(client, "ses_1", stream(events));
}

describe("watchExecution", () => {
  it("ignores events of other sessions", async () => {
    const result = await watch([
      { ...META, type: "server.connected", data: {} },
      {
        ...META,
        type: "permission.asked",
        data: {
          id: "perm_2",
          sessionID: "ses_2",
          action: "read",
          resources: [],
        },
      },
      {
        ...META,
        type: "session.execution.succeeded",
        durable: DURABLE,
        data: { sessionID: "ses_2" },
      },
      {
        ...META,
        type: "session.execution.succeeded",
        durable: DURABLE,
        data: { sessionID: "ses_1" },
      },
    ]);
    expect(result).toEqual({ outcome: { kind: "succeeded" }, rejected: [] });
    expect(mock?.requests).toEqual([]);
  });

  it("rejects permission requests of the session", async () => {
    const result = await watch([
      {
        ...META,
        type: "permission.asked",
        data: {
          id: "perm_1",
          sessionID: "ses_1",
          action: "edit",
          resources: ["a.ts", "b.ts"],
        },
      },
      {
        ...META,
        type: "session.execution.succeeded",
        durable: DURABLE,
        data: { sessionID: "ses_1" },
      },
    ]);
    expect(result.rejected).toEqual(["edit a.ts b.ts"]);
    expect(mock?.requests[0]?.body).toMatchObject({ decision: "reject" });
  });

  it("fails when the stream ends before the execution", async () => {
    const result = await watch([]);
    expect(result.outcome).toEqual({
      kind: "failed",
      error: "OpenCode event stream ended unexpectedly",
    });
  });
});
