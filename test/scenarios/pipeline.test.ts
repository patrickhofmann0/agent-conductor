import { describe, expect, it } from "vitest";

import { createTestEngine, RUN_ID } from "../fakes/test-engine.js";
import { startRun } from "../../src/core/pipeline/engine.js";
import { HARD_RULES } from "../../src/core/roles/permissions.js";

const input = {
  kind: "issue" as const,
  title: "Add CSV export",
  body: "Users need CSV.",
  ref: "o/r#42",
};
const checks = [
  { name: "test", command: "bun test" },
  { name: "lint", command: "bun lint", required: false },
];

function changes(
  route: string,
  target: "coder" | "tester",
  message: string,
): string {
  const finding = { id: `${target}-1`, severity: "high", target, message };
  return `\`\`\`json\n${JSON.stringify({ verdict: "changes_requested", route, summary: "Not yet", findings: [finding] })}\n\`\`\``;
}

describe("scenario: happy path", () => {
  it("goes from issue to a single-commit pull request", async () => {
    const engine = createTestEngine({ checks });
    engine.agents
      .script("coder", {
        effect: () => {
          engine.vcs.change("src/export.ts");
        },
      })
      .script("tester", {
        effect: () => {
          engine.vcs.change("src/export.test.ts");
        },
      });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({
      status: "done",
      iteration: 1,
      testerPaths: ["src/export.test.ts"],
    });
    expect(engine.agents.requests.map((request) => request.role)).toEqual([
      "po",
      "planner",
      "coder",
      "tester",
      "reviewer",
    ]);
    expect(engine.gates.requests.map((request) => request.gate)).toEqual([
      "po",
      "planner",
    ]);
    expect(engine.checks.runs).toEqual(["test", "lint"]);
    expect(engine.vcs.squashes).toEqual([
      { since: "base", message: "feat: Add CSV export" },
    ]);
    expect(engine.store.archived.has(RUN_ID)).toBe(true);
    const final = engine.publisher.published.at(-1);
    expect(final?.stage).toBe("final");
    expect(final?.body).toContain("Closes o/r#42");
    expect(state.costUsd).toBeCloseTo(0.5);
  });

  it("ends every agent's permissions with the hard rules", async () => {
    const engine = createTestEngine({
      roles: {
        coder: {
          permissions: [
            { action: "shell", resource: "git *", effect: "allow" },
          ],
        },
      },
    });

    await startRun(engine.ctx, { runId: RUN_ID, input });

    for (const request of engine.agents.requests) {
      expect(request.permissions.slice(-HARD_RULES.length)).toEqual(HARD_RULES);
    }
  });
});

describe("scenario: review loop", () => {
  it("routes findings to the tester only", async () => {
    const engine = createTestEngine();
    engine.agents.script("reviewer", {
      output: changes("tester", "tester", "Cover quotes"),
    });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.agents.requests.map((request) => request.role)).toEqual([
      "po",
      "planner",
      "coder",
      "tester",
      "reviewer",
      "tester",
      "reviewer",
    ]);
    expect(engine.agents.requestsFor("tester")[1]?.prompt).toContain(
      "Cover quotes",
    );
    expect(state).toMatchObject({ status: "done", iteration: 2 });
  });

  it("routes findings to the coder and skips the tester", async () => {
    const engine = createTestEngine();
    engine.agents.script("reviewer", {
      output: changes("coder", "coder", "Escape commas"),
    });

    await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(
      engine.agents.requests.map((request) => request.role).slice(5),
    ).toEqual(["coder", "reviewer"]);
    expect(engine.agents.requestsFor("coder")[1]?.prompt).toContain(
      "Escape commas",
    );
  });

  it("keeps iterating while a required check fails, even if the reviewer approves", async () => {
    const engine = createTestEngine({ checks });
    engine.checks.script("test", {
      passed: false,
      output: "expected 2, got 3",
    });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({ status: "done", iteration: 2 });
    expect(engine.agents.requestsFor("coder")[1]?.prompt).toContain(
      "expected 2, got 3",
    );
    expect(engine.agents.requestsFor("coder")[1]?.prompt).toContain(
      "required-checks-failed",
    );
  });
});

describe("scenario: guardrails", () => {
  it("reverts a coder that weakens tests and tells reviewer and coder", async () => {
    const engine = createTestEngine({
      guardrails: { paths: ["**/*.test.ts"] },
    });
    engine.agents
      .script("coder", {
        effect: () => {
          engine.vcs.change("src/a.ts", "src/old.test.ts");
        },
      })
      .script("reviewer", {
        output: changes("coder", "coder", "Do not touch tests"),
      });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(engine.vcs.reverts).toEqual([
      { paths: ["src/old.test.ts"], commit: "c2" },
    ]);
    expect(engine.agents.requestsFor("reviewer")[0]?.prompt).toContain(
      "guardrail-violation-coder-1",
    );
    expect(engine.agents.requestsFor("coder")[1]?.prompt).toContain(
      "guardrail-violation-coder-1",
    );
    expect(state.status).toBe("done");
  });

  it("stops the run when an agent touches version control", async () => {
    const engine = createTestEngine();
    engine.agents.script("tester", {
      effect: () => {
        engine.vcs.tamper();
      },
    });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state.status).toBe("failed");
    expect(state.outcome).toContain(
      "Version control was modified during the tester phase",
    );
    expect(engine.publisher.published.map((request) => request.stage)).toEqual([
      "gate",
      "gate",
    ]);
    expect(engine.vcs.squashes).toEqual([]);
  });
});

describe("scenario: reviewer output", () => {
  it("recovers from an invalid answer", async () => {
    const engine = createTestEngine();
    engine.agents.script("reviewer", { output: "LGTM!" });

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state.status).toBe("done");
    expect(engine.agents.requestsFor("reviewer")).toHaveLength(2);
  });

  it("gives up after three invalid answers", async () => {
    const engine = createTestEngine();
    engine.agents.script(
      "reviewer",
      { output: "LGTM" },
      { output: "LGTM" },
      { output: "LGTM" },
    );

    const state = await startRun(engine.ctx, { runId: RUN_ID, input });

    expect(state).toMatchObject({ status: "needs_human", needsHuman: true });
    expect(state.outcome).toContain("no valid verdict after 3 attempts");
  });
});
