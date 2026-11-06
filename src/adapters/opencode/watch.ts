import type { OpenCodeClient, OpenCodeEvent } from "@opencode/client";

export const WATCHED_EVENTS = [
  "permission.asked",
  "session.execution.succeeded",
  "session.execution.failed",
  "session.execution.interrupted",
] as const;

type ExecutionOutcome =
  | { readonly kind: "succeeded" }
  | { readonly kind: "failed"; readonly error: string }
  | { readonly kind: "interrupted"; readonly reason: string };

export interface WatchResult {
  readonly outcome: ExecutionOutcome;
  /** Permission requests the adapter rejected, as "action resource". */
  readonly rejected: readonly string[];
}

/** Events of the subscription; the server always adds "server.connected". */
export type WatchedEvent = Extract<
  OpenCodeEvent,
  { type: (typeof WATCHED_EVENTS)[number] | "server.connected" }
>;

type ExecutionEvent = Exclude<
  WatchedEvent,
  { type: "server.connected" | "permission.asked" }
>;

function outcomeOf(event: ExecutionEvent): ExecutionOutcome {
  switch (event.type) {
    case "session.execution.succeeded":
      return { kind: "succeeded" };
    case "session.execution.failed":
      return { kind: "failed", error: event.data.error.message };
    case "session.execution.interrupted":
      return { kind: "interrupted", reason: event.data.reason };
  }
}

/**
 * Follows the event stream of one session until its execution ends. Nobody can
 * answer a permission prompt during a run, so every request is rejected.
 */
export async function watchExecution(
  client: OpenCodeClient,
  sessionID: string,
  events: AsyncIterator<WatchedEvent>,
): Promise<WatchResult> {
  const rejected: string[] = [];
  for (
    let next = await events.next();
    next.done !== true;
    next = await events.next()
  ) {
    const event = next.value;
    if (event.type === "server.connected") continue;
    if (event.data.sessionID !== sessionID) continue;
    if (event.type === "permission.asked") {
      rejected.push(`${event.data.action} ${event.data.resources.join(" ")}`);
      await client.permission.reply({
        sessionID,
        requestID: event.data.id,
        decision: "reject",
        message: "conductor runs unattended; permission requests are rejected.",
      });
      continue;
    }
    return { outcome: outcomeOf(event), rejected };
  }
  return {
    outcome: {
      kind: "failed",
      error: "OpenCode event stream ended unexpectedly",
    },
    rejected,
  };
}
