import { describe, expect, it } from "vitest";

import { FakeForge } from "../../../test/fakes/fake-forge.js";

import { createForgeGateHandler } from "./forge-gate.js";

import type { GateRequest } from "../ports/gate-handler.types.js";

const LABEL = "conductor:approved";

const request: GateRequest = {
  runId: "run",
  gate: "po",
  artifactName: "requirements.md",
  artifact: "REQ",
  branch: "conductor/run",
  since: 100,
};

async function forgeWithPullRequest(): Promise<FakeForge> {
  const forge = new FakeForge();
  await forge.createPullRequest({
    branch: "conductor/run",
    base: "main",
    title: "t",
    body: "b",
    draft: true,
  });
  return forge;
}

describe("createForgeGateHandler", () => {
  it("waits until someone reviews after the gate opened", async () => {
    const forge = await forgeWithPullRequest();
    forge.reviews.push({
      author: "a",
      authorCanApprove: true,
      state: "approve",
      body: "",
      submittedAt: 50,
    });
    const gates = createForgeGateHandler({ forge, approvedLabel: LABEL });

    expect(await gates.request(request)).toEqual({ kind: "pending" });
    expect(forge.sinceRequests).toEqual([100]);
  });

  it("revises with review comments", async () => {
    const forge = await forgeWithPullRequest();
    forge.reviews.push({
      author: "a",
      authorCanApprove: true,
      state: "request_changes",
      body: "More detail.",
      submittedAt: 200,
    });
    forge.comments.push({
      author: "a",
      authorCanApprove: true,
      body: "Typo.",
      createdAt: 150,
    });
    const gates = createForgeGateHandler({ forge, approvedLabel: LABEL });

    expect(await gates.request(request)).toEqual({
      kind: "revise",
      feedback: "Typo.\n\nMore detail.",
    });
  });

  it("approves with the label and removes it", async () => {
    const forge = await forgeWithPullRequest();
    const [pr] = forge.pullRequests;
    if (pr === undefined) throw new Error("missing PR");
    await forge.addLabels(pr, [LABEL, "keep"]);
    const gates = createForgeGateHandler({ forge, approvedLabel: LABEL });

    expect(await gates.request(request)).toEqual({ kind: "approve" });
    expect(forge.pullRequests[0]?.labels).toEqual(["keep"]);
  });

  it("fails without a pull request", async () => {
    const gates = createForgeGateHandler({
      forge: new FakeForge(),
      approvedLabel: LABEL,
    });

    await expect(gates.request(request)).rejects.toThrow(
      "No open pull request for conductor/run.",
    );
  });

  it("leaves limits to a human as a draft", async () => {
    const gates = createForgeGateHandler({
      forge: new FakeForge(),
      approvedLabel: LABEL,
    });

    expect(
      await gates.resolveLimit({ runId: "run", kind: "cost", detail: "d" }),
    ).toEqual({ kind: "draft_pr" });
  });
});
